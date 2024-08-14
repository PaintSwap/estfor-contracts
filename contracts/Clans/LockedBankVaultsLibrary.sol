// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ClanInfo, ClanBattleInfo, Vault, MAX_CLAN_COMBATANTS} from "../globals/clans.sol";
import {Item, EquipPosition, BoostType} from "../globals/players.sol";
import {IItemNFT} from "../interfaces/IItemNFT.sol";
import {IClans} from "../interfaces/IClans.sol";

library LockedBankVaultsLibrary {
  error LengthMismatch();
  error CannotChangeCombatantsDuringAttack();
  error TooManyCombatants();
  error ClanCombatantsChangeCooldown();
  error NoCombatants();
  error CannotAttackSelf();
  error NoBrushToAttack();
  error ClanIsBlockingAttacks();
  error ClanAttackingCooldown();
  error CannotAttackWhileStillAttacking();
  error MaxLockedVaultsReached();
  error NotALockedVaultAttackItem();
  error SpecifyingItemWhenNotReattackingOrSuperAttacking();
  error ClanSuperAttackingCooldown();
  error ClanAttackingSameClanCooldown();
  error CannotReattackAndSuperAttackSameTime();
  error OutsideMMRRange();
  error NothingToClaim();
  error NotALockedVaultDefenceItem();
  error BlockAttacksCooldown();

  function initializeMMR(
    uint48[] storage _sortedClansByMMR,
    IClans _clans,
    mapping(uint clanId => ClanInfo _clanInfo) storage _clanInfos,
    uint[] calldata _clanIds,
    uint16[] calldata _mmrs
  ) external {
    if (_clanIds.length != _mmrs.length) {
      revert LengthMismatch();
    }

    for (uint i = 0; i < _clanIds.length; ++i) {
      _clans.setMMR(_clanIds[i], _mmrs[i]);
      _insertMMRArray(_sortedClansByMMR, _mmrs[i], uint32(_clanIds[i]));
      _clanInfos[_clanIds[i]].isInMMRArray = true;
    }
  }

  function forceMMRUpdate(
    uint48[] storage _sortedClansByMMR,
    IClans _clans,
    mapping(uint clanId => ClanInfo _clanInfo) storage _clanInfos,
    uint[] calldata _clanIds
  ) external returns (uint[] memory clanIdsToDelete) {
    // Create an array to mark elements for deletion
    uint256 length = _sortedClansByMMR.length;
    bool[] memory toDelete = new bool[](length);
    clanIdsToDelete = new uint[](_clanIds.length);
    uint clanIdsToDeletelength;

    // Mark elements for deletion
    for (uint256 i = 0; i < _clanIds.length; ++i) {
      uint index = type(uint).max;
      for (uint j = 0; j < length; ++j) {
        if (_getClanId(_sortedClansByMMR[j]) == _clanIds[i]) {
          index = j;
          break;
        }
      }

      if (
        index != type(uint).max &&
        (!_hasLockedFunds(_clanInfos[_clanIds[i]]) || _clans.maxMemberCapacity(_clanIds[i]) == 0)
      ) {
        toDelete[index] = true;
        _clanInfos[_clanIds[i]].isInMMRArray = false;
        clanIdsToDelete[clanIdsToDeletelength++] = _clanIds[i];
      }
    }

    // Perform a single shift operation at the end
    uint256 shiftCount = 0;
    for (uint256 i = 0; i < length; ++i) {
      if (toDelete[i]) {
        ++shiftCount;
      } else if (shiftCount > 0) {
        _sortedClansByMMR[i - shiftCount] = _sortedClansByMMR[i];
      }
    }

    // Reduce the length of the array
    assembly ("memory-safe") {
      sstore(_sortedClansByMMR.slot, sub(length, shiftCount))
      mstore(clanIdsToDelete, clanIdsToDeletelength)
    }
  }

  function claimFunds(
    uint48[] storage _sortedClansByMMR,
    ClanInfo storage _clanInfo,
    uint256 _clanId
  ) external returns (uint256 total, uint256 numLocksClaimed) {
    uint defendingVaultsOffset = _clanInfo.defendingVaultsOffset;
    // There a few cases to consider here:
    // 1. The first one is not expired, so we can't claim anything
    // 2. The first one is expired, but the second one is not, so we can claim the first one
    // 3. The first one is expired, and the second one is expired, so we can claim both
    // We don't need to set claimed = true unless we know the second one is not expired yet
    for (uint i = defendingVaultsOffset; i < _clanInfo.defendingVaults.length; ++i) {
      Vault storage defendingVault = _clanInfo.defendingVaults[i];
      if (defendingVault.timestamp > block.timestamp) {
        // Has not expired yet
        break;
      }

      if (defendingVault.timestamp != 0 && !defendingVault.claimed) {
        total += defendingVault.amount;
        ++numLocksClaimed;
      }

      if (defendingVault.timestamp1 > block.timestamp) {
        // Has not expired yet
        defendingVault.amount = 0; // Clear the first one so that we don't try to use it again
        defendingVault.timestamp = 0;
        defendingVault.claimed = true; // First one is claimed at least
        break;
      }

      if (defendingVault.timestamp1 != 0) {
        total += defendingVault.amount1;
        ++numLocksClaimed;
        ++defendingVaultsOffset;
      } else {
        // First one is claimed, second one is not set yet, so need to make sure we don't try and claim it again
        defendingVault.claimed = true;
      }
    }

    if (total == 0) {
      revert NothingToClaim();
    }

    uint totalBrushLocked = _clanInfo.totalBrushLocked;
    _clanInfo.totalBrushLocked = uint96(totalBrushLocked - total);
    bool hasRemainingLockedBrush = totalBrushLocked - total != 0;
    if (!hasRemainingLockedBrush) {
      uint length = _sortedClansByMMR.length;
      for (uint i = 0; i < length; ++i) {
        bool foundClan = _getClanId(_sortedClansByMMR[i]) == _clanId;
        if (foundClan) {
          // Shift everything to the left and pop
          for (uint j = i; j < length - 1; ++j) {
            _sortedClansByMMR[j] = _sortedClansByMMR[j + 1];
          }
          _sortedClansByMMR.pop();
          _clanInfo.isInMMRArray = false;
          break;
        }
      }
    }
    _clanInfo.defendingVaultsOffset = uint24(defendingVaultsOffset);
  }

  function checkWithinRange(
    uint48[] storage _sortedClansByMMR,
    uint _clanId,
    uint _defendingClanId,
    IClans _clans,
    uint _mmrAttackDistance
  ) external view {
    (uint clanIndex, uint defendingClanIndex) = _getClanIndices(_sortedClansByMMR, _clanId, _defendingClanId);
    uint48[] memory modifiedSortedClansByMMR;
    if (clanIndex == type(uint256).max) {
      (modifiedSortedClansByMMR, clanIndex) = _insertMMRArrayInMemory(
        _sortedClansByMMR,
        _clans.getMMR(_clanId),
        uint32(_clanId)
      );
      if (clanIndex <= defendingClanIndex) {
        ++defendingClanIndex;
      }
    } else {
      modifiedSortedClansByMMR = _sortedClansByMMR;
    }

    if (!_isWithinRange(modifiedSortedClansByMMR, clanIndex, defendingClanIndex, _mmrAttackDistance)) {
      revert OutsideMMRRange();
    }
  }

  function _hasLockedFunds(ClanInfo storage _clanInfo) internal view returns (bool) {
    uint length = _clanInfo.defendingVaults.length;
    if (length == 0) {
      return false;
    }
    // 1 value has not expired yet
    return
      (_clanInfo.defendingVaults[length - 1].timestamp > block.timestamp) ||
      (_clanInfo.defendingVaults[length - 1].timestamp1 > block.timestamp);
  }

  function _getClanIndicesMemory(
    uint48[] memory _sortedClansByMMR,
    uint _clanId,
    uint _defendingClanId
  ) private pure returns (uint clanIndex, uint defendingIndex) {
    uint numFound;
    clanIndex = type(uint256).max;
    defendingIndex = type(uint256).max;
    for (uint i = 0; i < _sortedClansByMMR.length; ++i) {
      if (_getClanId(_sortedClansByMMR[i]) == _clanId) {
        clanIndex = i;
        ++numFound;
      }

      if (_getClanId(_sortedClansByMMR[i]) == _defendingClanId) {
        defendingIndex = i;
        ++numFound;
      }

      if (numFound == 2) {
        break;
      }
    }
  }

  function _getClanIndices(
    uint48[] storage _sortedClansByMMR,
    uint _clanId,
    uint _defendingClanId
  ) private view returns (uint clanIndex, uint defendingIndex) {
    uint numFound;
    clanIndex = type(uint256).max;
    defendingIndex = type(uint256).max;
    for (uint i = 0; i < _sortedClansByMMR.length; ++i) {
      if (_getClanId(_sortedClansByMMR[i]) == _clanId) {
        clanIndex = i;
        ++numFound;
      }

      if (_getClanId(_sortedClansByMMR[i]) == _defendingClanId) {
        defendingIndex = i;
        ++numFound;
      }

      if (numFound == 2) {
        break;
      }
    }
  }

  // Useful for testing
  function isWithinRange(
    uint32[] calldata clanIds,
    uint16[] calldata mmrs,
    uint _clanId,
    uint _defendingClanId,
    uint _mmrAttackDistance
  ) external pure returns (bool) {
    uint48[] memory sortedClansByMMR = new uint48[](clanIds.length);
    for (uint i = 0; i < clanIds.length; ++i) {
      sortedClansByMMR[i] = (uint32(clanIds[i]) << 16) | mmrs[i];
    }
    (uint clanIndex, uint defendingClanIndex) = _getClanIndicesMemory(sortedClansByMMR, _clanId, _defendingClanId);

    if (clanIndex == type(uint256).max) {
      revert OutsideMMRRange();
    }
    if (defendingClanIndex == type(uint256).max) {
      revert OutsideMMRRange();
    }

    return _isWithinRange(sortedClansByMMR, clanIndex, defendingClanIndex, _mmrAttackDistance);
  }

  function _isWithinRange(
    uint48[] memory _sortedClansByMMR,
    uint256 _clanIdIndex,
    uint256 _defendingClanIdIndex,
    uint256 _mmrAttackDistance
  ) private pure returns (bool) {
    // Calculate direct distance
    uint256 directDistance = (_clanIdIndex > _defendingClanIdIndex)
      ? _clanIdIndex - _defendingClanIdIndex
      : _defendingClanIdIndex - _clanIdIndex;

    if (_mmrAttackDistance >= directDistance) {
      return true;
    }

    // If outside range, check if MMR is the same as the MMR as that at the edge of the range
    int256 rangeEdgeIndex = int256(
      _defendingClanIdIndex > _clanIdIndex ? _clanIdIndex + _mmrAttackDistance : _clanIdIndex - _mmrAttackDistance
    );

    if (rangeEdgeIndex < 0 || rangeEdgeIndex >= int256(_sortedClansByMMR.length)) {
      return false;
    }

    return _getMMR(_sortedClansByMMR[_defendingClanIdIndex]) == _getMMR(_sortedClansByMMR[uint256(rangeEdgeIndex)]);
  }

  function blockAttacks(
    IItemNFT _itemNFT,
    uint16 _itemTokenId,
    ClanInfo storage _clanInfo
  ) external returns (uint256 blockAttacksTimestamp) {
    Item memory item = _itemNFT.getItem(_itemTokenId);
    if (item.equipPosition != EquipPosition.LOCKED_VAULT || item.boostType != BoostType.PVP_BLOCK) {
      revert NotALockedVaultDefenceItem();
    }

    if ((_clanInfo.blockAttacksTimestamp + uint(_clanInfo.blockAttacksCooldownHours) * 3600) > block.timestamp) {
      revert BlockAttacksCooldown();
    }

    blockAttacksTimestamp = block.timestamp + item.boostDuration;
    _clanInfo.blockAttacksTimestamp = uint40(blockAttacksTimestamp);
    _clanInfo.blockAttacksCooldownHours = uint8(item.boostValue);

    _itemNFT.burn(msg.sender, _itemTokenId, 1);
  }

  function fulfillUpdateMMR(
    uint256 _Ka,
    uint256 _Kd,
    uint48[] storage _sortedClansByMMR,
    IClans _clans,
    uint256 _attackingClanId,
    uint256 _defendingClanId,
    bool _didAttackersWin,
    mapping(uint clanId => ClanInfo clanInfo) storage _clanInfos
  ) external returns (int256 attackingMMRDiff, int256 defendingMMRDiff) {
    (uint256 clanIndex, uint256 defendingClanIndex) = _getClanIndices(
      _sortedClansByMMR,
      _attackingClanId,
      _defendingClanId
    );
    bool clanInArray = clanIndex != type(uint256).max;
    uint256 attackingMMR = clanInArray ? _getMMR(_sortedClansByMMR[clanIndex]) : _clans.getMMR(_attackingClanId);

    uint256 defendingMMR = defendingClanIndex != type(uint256).max
      ? _getMMR(_sortedClansByMMR[defendingClanIndex])
      : _clans.getMMR(_defendingClanId);

    (uint newAttackingMMR, uint newDefendingMMR) = getNewMMRs(
      _Ka,
      _Kd,
      uint16(attackingMMR),
      uint16(defendingMMR),
      _didAttackersWin
    );

    attackingMMRDiff = int256(newAttackingMMR) - int256(attackingMMR);
    defendingMMRDiff = int256(newDefendingMMR) - int256(defendingMMR);

    // Tried to use a struct but got "Could not create stack layout after 1000 iterations" error
    uint[] memory indices = new uint[](2);
    uint16[] memory newMMRs = new uint16[](2);
    uint32[] memory clanIds = new uint32[](2);
    bool[] memory upwardFlags = new bool[](2);
    uint length;

    if (attackingMMRDiff != 0) {
      _clans.setMMR(_attackingClanId, uint16(newAttackingMMR));

      if (clanInArray) {
        // Attacking a clan while you have locked funds
        indices[length] = clanIndex;
        newMMRs[length] = uint16(newAttackingMMR);
        clanIds[length] = uint32(_attackingClanId);
        upwardFlags[length++] = _didAttackersWin;
      } else if (_didAttackersWin) {
        // Attacking a clan while you have no locked funds and win
        clanIndex = _insertMMRArray(_sortedClansByMMR, uint16(newAttackingMMR), uint32(_attackingClanId));
        _clanInfos[_attackingClanId].isInMMRArray = true;
        if (clanIndex <= defendingClanIndex && defendingClanIndex != type(uint256).max) {
          ++defendingClanIndex;
        }
      }
    }

    if (defendingMMRDiff != 0) {
      _clans.setMMR(_defendingClanId, uint16(newDefendingMMR));

      bool defendingClanInArray = defendingClanIndex != type(uint256).max;
      if (defendingClanInArray) {
        // Attacking a clan while they have locked funds
        indices[length] = defendingClanIndex;
        newMMRs[length] = uint16(newDefendingMMR);
        clanIds[length] = uint32(_defendingClanId);
        upwardFlags[length++] = !_didAttackersWin;
      }
    }

    assembly ("memory-safe") {
      mstore(indices, length)
      mstore(newMMRs, length)
      mstore(clanIds, length)
      mstore(upwardFlags, length)
    }
    if (length > 0) {
      _updateMMRArrays(_sortedClansByMMR, indices, newMMRs, clanIds, upwardFlags);
    }
  }

  function checkCanAttackVaults(
    uint _clanId,
    uint _defendingClanId,
    uint16 _itemTokenId,
    uint256 _maxLockedVaults,
    uint256 _numPackedVaults,
    IItemNFT _itemNFT,
    mapping(uint clanId => ClanInfo clanInfo) storage _clanInfos,
    mapping(uint clanId => mapping(uint otherClanId => ClanBattleInfo battleInfo)) storage _lastClanBattles
  ) external view returns (bool isReattacking, bool isUsingSuperAttack, uint superAttackCooldownTimestamp) {
    // Must have at least 1 combatant
    ClanInfo storage clanInfo = _clanInfos[_clanId];
    if (clanInfo.playerIds.length == 0) {
      revert NoCombatants();
    }

    if (_clanId == _defendingClanId) {
      revert CannotAttackSelf();
    }

    // Does this clan have any brush to even attack?
    ClanInfo storage defendingClanInfo = _clanInfos[_defendingClanId];
    if (defendingClanInfo.totalBrushLocked == 0) {
      revert NoBrushToAttack();
    }

    if (defendingClanInfo.blockAttacksTimestamp > block.timestamp) {
      revert ClanIsBlockingAttacks();
    }

    if (clanInfo.attackingCooldownTimestamp > block.timestamp) {
      revert ClanAttackingCooldown();
    }

    if (clanInfo.currentlyAttacking) {
      revert CannotAttackWhileStillAttacking();
    }

    uint length = clanInfo.defendingVaults.length;
    uint defendingVaultsOffset = clanInfo.defendingVaultsOffset;
    if (length - defendingVaultsOffset > _maxLockedVaults / _numPackedVaults) {
      revert MaxLockedVaultsReached();
    }

    uint numReattacks;
    (isReattacking, numReattacks) = _checkCanReattackVaults(_clanId, _defendingClanId, _lastClanBattles);

    bool canReattack;
    if (_itemTokenId != 0) {
      Item memory item = _itemNFT.getItem(_itemTokenId);
      bool isValidItem = item.equipPosition == EquipPosition.LOCKED_VAULT;
      if (!isValidItem) {
        revert NotALockedVaultAttackItem();
      }

      if (isReattacking) {
        if (item.boostType != BoostType.PVP_REATTACK) {
          revert NotALockedVaultAttackItem();
        }
        canReattack = item.boostValue > numReattacks;
      } else {
        isUsingSuperAttack = item.boostType == BoostType.PVP_SUPER_ATTACK;
        if (!isUsingSuperAttack) {
          revert SpecifyingItemWhenNotReattackingOrSuperAttacking();
        }

        if (clanInfo.superAttackCooldownTimestamp > block.timestamp) {
          revert ClanSuperAttackingCooldown();
        }
        superAttackCooldownTimestamp = block.timestamp + item.boostDuration;
      }
    }

    if (isReattacking && !canReattack) {
      revert ClanAttackingSameClanCooldown();
    }

    if (isReattacking && isUsingSuperAttack) {
      revert CannotReattackAndSuperAttackSameTime();
    }
  }

  function getNewMMRs(
    uint256 _Ka,
    uint256 _Kd,
    uint16 _attackingMMR,
    uint16 _defendingMMR,
    bool _didAttackersWin
  ) public pure returns (uint16 newAttackerMMR, uint16 newDefenderMMR) {
    uint256 Sa = _didAttackersWin ? 100 : 0; // attacker score variable scaled up
    uint256 Sd = _didAttackersWin ? 0 : 100; // defender score variable scaled up

    (uint changeA, bool negativeA) = _ratingChange(_attackingMMR, _defendingMMR, Sa, _Ka);
    (uint changeD, bool negativeD) = _ratingChange(_defendingMMR, _attackingMMR, Sd, _Kd);

    int _newAttackerMMR = int24(uint24(_attackingMMR)) + (negativeA ? -int(changeA) : int(changeA));
    int _newDefenderMMR = int24(uint24(_defendingMMR)) + (negativeD ? -int(changeD) : int(changeD));

    if (_newAttackerMMR < 0) {
      _newAttackerMMR = 0;
    }

    if (_newDefenderMMR < 0) {
      _newDefenderMMR = 0;
    }

    newAttackerMMR = uint16(uint24(int24(_newAttackerMMR)));
    newDefenderMMR = uint16(uint24(int24(_newDefenderMMR)));
  }

  function getSortedClanIdsByMMR(uint48[] storage _sortedClansByMMR) external view returns (uint32[] memory clanIds) {
    uint length = _sortedClansByMMR.length;
    clanIds = new uint32[](length);
    for (uint i; i < length; ++i) {
      clanIds[i] = uint32(_getClanId(_sortedClansByMMR[i]));
    }
  }

  function getSortedMMR(uint48[] storage _sortedClansByMMR) external view returns (uint16[] memory mmrs) {
    uint length = _sortedClansByMMR.length;
    mmrs = new uint16[](length);
    for (uint i; i < length; ++i) {
      mmrs[i] = uint16(_getMMR(_sortedClansByMMR[i]));
    }
  }

  function getIdleClans(
    uint48[] storage _sortedClansByMMR,
    mapping(uint clanId => ClanInfo _clanInfo) storage _clanInfos,
    IClans _clans
  ) external view returns (uint256[] memory clanIds) {
    uint256 origLength = _sortedClansByMMR.length;
    clanIds = new uint256[](origLength);
    uint256 length;

    for (uint i; i < origLength; ++i) {
      uint clanId = _getClanId(_sortedClansByMMR[i]);
      if (!_hasLockedFunds(_clanInfos[clanId]) || _clans.maxMemberCapacity(clanId) == 0) {
        clanIds[length++] = uint32(clanId);
      }
    }

    assembly ("memory-safe") {
      mstore(clanIds, length)
    }
  }

  function _lowerBound(uint48[] storage _sortedClansByMMR, uint _targetMMR) internal view returns (uint) {
    if (_sortedClansByMMR.length == 0) {
      return 0;
    }

    uint low = 0;
    uint high = _sortedClansByMMR.length;

    while (low < high) {
      uint mid = (low + high) / 2;
      uint clanMMR = _getMMR(_sortedClansByMMR[mid]);
      if (clanMMR < _targetMMR) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  function checkCanAssignCombatants(ClanInfo storage _clanInfo, uint48[] calldata _playerIds) external view {
    if (_clanInfo.currentlyAttacking) {
      revert CannotChangeCombatantsDuringAttack();
    }

    if (_playerIds.length > MAX_CLAN_COMBATANTS) {
      revert TooManyCombatants();
    }

    // Can only change combatants every so often
    if (_clanInfo.assignCombatantsCooldownTimestamp > block.timestamp) {
      revert ClanCombatantsChangeCooldown();
    }
  }

  function clearCooldowns(
    uint _clanId,
    uint[] calldata _otherClanIds,
    ClanInfo storage _clanInfo,
    mapping(uint clanId => mapping(uint otherClanId => ClanBattleInfo battleInfo)) storage _lastClanBattles
  ) external {
    _clanInfo.attackingCooldownTimestamp = 0;
    _clanInfo.assignCombatantsCooldownTimestamp = 0;
    _clanInfo.currentlyAttacking = false;
    _clanInfo.superAttackCooldownTimestamp = 0;
    _clanInfo.blockAttacksTimestamp = 0;
    _clanInfo.blockAttacksCooldownHours = 0;

    for (uint i; i < _otherClanIds.length; ++i) {
      uint lowerClanId = _clanId < _otherClanIds[i] ? _clanId : _otherClanIds[i];
      uint higherClanId = _clanId < _otherClanIds[i] ? _otherClanIds[i] : _clanId;
      delete _lastClanBattles[lowerClanId][higherClanId];
    }
  }

  function _updateMMRArrays(
    uint48[] storage _sortedClansByMMR,
    uint[] memory _indices,
    uint16[] memory _newMMRs,
    uint32[] memory _clanIds,
    bool[] memory _upwardFlags
  ) private {
    // Adjust each index, update one by one
    for (uint i = 0; i < _indices.length; ++i) {
      uint currentIndex = _indices[i];
      uint16 newMMR = _newMMRs[i];
      uint32 clanId = _clanIds[i];
      bool upward = _upwardFlags[i];

      uint newIndex = _updateSingleMMR(_sortedClansByMMR, currentIndex, newMMR, clanId, upward);
      // Adjust subsequent indices if needed
      for (uint j = i + 1; j < _indices.length; ++j) {
        if (upward && _indices[j] >= currentIndex && _indices[j] <= newIndex) {
          --_indices[j]; // Adjust index if it falls within the shifted range
        } else if (!upward && _indices[j] <= currentIndex && _indices[j] >= newIndex) {
          ++_indices[j]; // Adjust index if it falls within the shifted range
        }
      }
    }
  }

  function _updateSingleMMR(
    uint48[] storage _sortedClansByMMR,
    uint _currentIndex,
    uint16 _newMMR,
    uint32 _clanId,
    bool _upward
  ) internal returns (uint) {
    uint i = _currentIndex;
    // Check if the new position would be different
    bool shouldMove = false;
    if (_upward && i < _sortedClansByMMR.length - 1) {
      shouldMove = _getMMR(_sortedClansByMMR[i + 1]) < _newMMR;
    } else if (!_upward && i > 0) {
      shouldMove = _getMMR(_sortedClansByMMR[i - 1]) >= _newMMR;
    }

    if (!shouldMove) {
      // If position doesn't change, just update the MMR and return
      _setPackedClanIdAndMMR(_sortedClansByMMR, i, _clanId, _newMMR);
      return i;
    }

    if (_upward) {
      // Shift elements left if newMMR is higher
      while (i < _sortedClansByMMR.length - 1 && _getMMR(_sortedClansByMMR[i + 1]) < _newMMR) {
        _sortedClansByMMR[i] = _sortedClansByMMR[i + 1];
        ++i;
      }
    } else {
      // Shift elements right if newMMR is lower
      while (i > 0 && _getMMR(_sortedClansByMMR[i - 1]) >= _newMMR) {
        _sortedClansByMMR[i] = _sortedClansByMMR[i - 1];
        --i;
      }
    }

    _setPackedClanIdAndMMR(_sortedClansByMMR, i, _clanId, _newMMR);
    return i;
  }

  function insertMMRArray(uint48[] storage _sortedClansByMMR, uint16 _mmr, uint32 _clanId) external {
    _insertMMRArray(_sortedClansByMMR, _mmr, _clanId);
  }

  function _insertMMRArray(
    uint48[] storage _sortedClansByMMR,
    uint16 _mmr,
    uint32 _clanId
  ) private returns (uint index) {
    // Find where to insert it into the array
    index = _lowerBound(_sortedClansByMMR, _mmr);
    _sortedClansByMMR.push(); // expand array
    // Shift array to the right
    for (uint i = _sortedClansByMMR.length - 1; i > index; --i) {
      _sortedClansByMMR[i] = _sortedClansByMMR[i - 1];
    }
    _setPackedClanIdAndMMR(_sortedClansByMMR, index, _clanId, _mmr);
  }

  function _insertMMRArrayInMemory(
    uint48[] storage _sortedClansByMMR,
    uint16 _mmr,
    uint32 _clanId
  ) private view returns (uint48[] memory newSortedClansByMMR, uint index) {
    // Find where to insert it into the array
    index = _lowerBound(_sortedClansByMMR, _mmr);

    // Copy to memory and shift any after the index to the right
    newSortedClansByMMR = new uint48[](_sortedClansByMMR.length + 1);
    for (uint i = 0; i < newSortedClansByMMR.length; ++i) {
      if (i < index) {
        newSortedClansByMMR[i] = _sortedClansByMMR[i];
      } else if (i == index) {
        newSortedClansByMMR[i] = (uint32(_clanId) << 16) | _mmr;
      } else {
        newSortedClansByMMR[i] = _sortedClansByMMR[i - 1];
      }
    }
  }

  function _setPackedClanIdAndMMR(
    uint48[] storage _sortedClansByMMR,
    uint256 _index,
    uint32 _clanId,
    uint16 _mmr
  ) private {
    _sortedClansByMMR[_index] = (uint32(_clanId) << 16) | _mmr;
  }

  function _getUnpackedClanIdAndMMR(
    uint48[] storage _sortedClansByMMR,
    uint256 _index
  ) private view returns (uint32 clanId, uint16 mmr) {
    uint48 packed = _sortedClansByMMR[_index];
    clanId = uint32(packed >> 16);
    mmr = uint16(packed);
  }

  function _checkCanReattackVaults(
    uint _clanId,
    uint _defendingClanId,
    mapping(uint clanId => mapping(uint otherClanId => ClanBattleInfo battleInfo)) storage lastClanBattles
  ) private view returns (bool isReattacking, uint numReattacks) {
    // Check if they are re-attacking this clan and allowed to
    uint lowerClanId = _clanId < _defendingClanId ? _clanId : _defendingClanId;
    uint higherClanId = _clanId < _defendingClanId ? _defendingClanId : _clanId;
    ClanBattleInfo storage battleInfo = lastClanBattles[lowerClanId][higherClanId];
    if (lowerClanId == _clanId) {
      if (battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp > block.timestamp) {
        numReattacks = battleInfo.numReattacks;
        isReattacking = true;
      }
    } else {
      if (battleInfo.lastOtherClanIdAttackClanIdCooldownTimestamp > block.timestamp) {
        numReattacks = battleInfo.numReattacksOtherClan;
        isReattacking = true;
      }
    }
  }

  function _getMMR(uint48 _packed) private pure returns (uint) {
    return uint16(_packed);
  }

  function _getClanId(uint48 _packed) private pure returns (uint) {
    return uint32(_packed >> 16);
  }

  // This function is adapted from the solidity ELO library
  /// @notice Get the 16th root of a number, used in MMR calculations
  /// @dev MMR calculations require the 400th root (10 ^ (x / 400)), however this can be simplified to the 16th root (10 ^ ((x / 25) / 16))
  function _sixteenthRoot(uint256 x) internal pure returns (uint256) {
    return Math.sqrt(Math.sqrt(Math.sqrt(Math.sqrt(x))));
  }

  // This function is adapted from the solidity ELO library
  /// @notice Calculates the change in MMR rating, after a given outcome.
  /// @param _ratingA the MMR rating of the clan A
  /// @param _ratingD the MMR rating of the clan D
  /// @param _score the _score of the clan A, scaled by 100. 100 = win, 0 = loss
  /// @param _kFactor the k-factor or development multiplier used to calculate the change in MMR rating. 20 is the typical value
  /// @return change the change in MMR rating of clan D
  /// @return isNegative the directional change of clan A's MMR. Opposite sign for clan D
  function _ratingChange(
    uint256 _ratingA,
    uint256 _ratingD,
    uint256 _score,
    uint256 _kFactor
  ) internal pure returns (uint256 change, bool isNegative) {
    uint256 kFactor; // scaled up `_kFactor` by 100
    bool negative = _ratingD < _ratingA;
    uint256 ratingDiff; // absolute value difference between `_ratingA` and `_ratingD`

    unchecked {
      // scale up the inputs by a factor of 100
      // since our MMR math is scaled up by 100 (to avoid low precision integer division)
      kFactor = _kFactor * 10_000;
      ratingDiff = negative ? _ratingA - _ratingD : _ratingD - _ratingA;
    }

    // checks against overflow/underflow, discovered via fuzzing
    // large rating diffs leads to 10^ratingDiff being too large to fit in a uint256
    if (ratingDiff >= 800) {
      ratingDiff = 799;
    }

    // ----------------------------------------------------------------------
    // Below, we'll be running simplified versions of the following formulas:
    // expected _score = 1 / (1 + 10 ^ (ratingDiff / 400))
    // MMR change = _kFactor * (_score - expectedScore)

    uint256 n; // numerator of the power, with scaling, (numerator of `ratingDiff / 400`)
    uint256 _powered; // the value of 10 ^ numerator
    uint256 powered; // the value of 16th root of 10 ^ numerator (fully resolved 10 ^ (ratingDiff / 400))
    uint256 kExpectedScore; // the expected _score with K factor distributed
    uint256 kScore; // the actual _score with K factor distributed

    unchecked {
      // Apply offset of 800 to scale the result by 100
      n = negative ? 800 - ratingDiff : 800 + ratingDiff;

      // (x / 400) is the same as ((x / 25) / 16))
      _powered = 10 ** (n / 25); // divide by 25 to avoid reach uint256 max
      powered = _sixteenthRoot(_powered); // x ^ (1 / 16) is the same as 16th root of x

      // given `change = _kFactor * (_score - expectedScore)` we can distribute _kFactor to both terms
      kExpectedScore = kFactor / (100 + powered); // both numerator and denominator scaled up by 100
      kScore = _kFactor * _score; // input _score is already scaled up by 100

      // determines the sign of the MMR change
      isNegative = kScore < kExpectedScore;
      change = (isNegative ? kExpectedScore - kScore : kScore - kExpectedScore) / 100;
    }
  }
}
