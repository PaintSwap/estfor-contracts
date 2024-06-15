// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ClanInfo, ClanBattleInfo, Vault, MAX_CLAN_COMBATANTS} from "../globals/clans.sol";
import {Item, EquipPosition, BoostType} from "../globals/players.sol";
import {IItemNFT} from "../interfaces/IItemNFT.sol";
import {IClans} from "../interfaces/IClans.sol";

import {EstforLibrary} from "../EstforLibrary.sol";

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
    uint32[] storage _sortedClanIdsByMMR,
    uint16[] storage _sortedMMR,
    IClans _clans,
    mapping(uint clanId => ClanInfo _clanInfo) storage _clanInfos,
    uint[] calldata clanIds,
    uint16[] calldata mmrs
  ) external {
    if (clanIds.length != mmrs.length) {
      revert LengthMismatch();
    }

    for (uint i = 0; i < clanIds.length; ++i) {
      _clans.setMMR(clanIds[i], mmrs[i]);
      _insertMMRArray(_sortedClanIdsByMMR, _sortedMMR, mmrs[i], uint32(clanIds[i]));
      _clanInfos[clanIds[i]].isInMMRArray = true;
    }
  }

  function forceMMRUpdate(
    uint32[] storage _sortedClanIdsByMMR,
    uint16[] storage _sortedMMR,
    IClans _clans,
    mapping(uint clanId => ClanInfo _clanInfo) storage _clanInfos,
    uint[] calldata _clanIds
  ) external returns (uint[] memory clanIdsToDelete) {
    // Create an array to mark elements for deletion
    uint256 length = _sortedClanIdsByMMR.length;
    bool[] memory toDelete = new bool[](length);
    clanIdsToDelete = new uint[](_clanIds.length);
    uint clanIdsToDeletelength;

    // Mark elements for deletion
    for (uint256 i = 0; i < _clanIds.length; ++i) {
      uint index = type(uint).max;
      for (uint j = 0; j < length; ++j) {
        if (_sortedClanIdsByMMR[j] == _clanIds[i]) {
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
        _sortedClanIdsByMMR[i - shiftCount] = _sortedClanIdsByMMR[i];
        _sortedMMR[i - shiftCount] = _sortedMMR[i];
      }
    }

    // Reduce the length of the array
    assembly ("memory-safe") {
      sstore(_sortedClanIdsByMMR.slot, sub(length, shiftCount))
      sstore(_sortedMMR.slot, sub(length, shiftCount))
      mstore(clanIdsToDelete, clanIdsToDeletelength)
    }
  }

  function claimFunds(
    uint32[] storage _sortedClanIdsByMMR,
    uint16[] storage _sortedMMR,
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
      for (uint i = 0; i < _sortedClanIdsByMMR.length; ++i) {
        if (_sortedClanIdsByMMR[i] == _clanId) {
          // Shift everything to the left and pop
          for (uint j = i; j < _sortedClanIdsByMMR.length - 1; ++j) {
            _sortedClanIdsByMMR[j] = _sortedClanIdsByMMR[j + 1];
            _sortedMMR[j] = _sortedMMR[j + 1];
          }
          _sortedClanIdsByMMR.pop();
          _sortedMMR.pop();
          _clanInfo.isInMMRArray = false;
          break;
        }
      }
    }
    _clanInfo.defendingVaultsOffset = uint24(defendingVaultsOffset);
  }

  function updateMMRArray(
    uint32[] storage _sortedClanIdsByMMR,
    uint16[] storage _sortedMMR,
    uint _clanId,
    uint _defendingClanId,
    IClans _clans,
    uint _mmrAttackDistance,
    mapping(uint clanId => ClanInfo _clanInfo) storage _clanInfos
  ) external {
    (uint clanIndex, uint defendingClanIndex) = _getClanIndices(_sortedClanIdsByMMR, _clanId, _defendingClanId);
    if (clanIndex == type(uint256).max) {
      clanIndex = _insertMMRArray(_sortedClanIdsByMMR, _sortedMMR, _clans.getMMR(_clanId), uint32(_clanId));
      _clanInfos[_clanId].isInMMRArray = true;
    }

    if (!_isWithinRange(_sortedClanIdsByMMR, clanIndex, defendingClanIndex, _mmrAttackDistance)) {
      revert OutsideMMRRange();
    }
  }

  function _hasLockedFunds(ClanInfo storage _clanInfo) private view returns (bool) {
    uint length = _clanInfo.defendingVaults.length;
    if (length == 0) {
      return false;
    }
    // 1 value has not expired yet
    return
      (_clanInfo.defendingVaults[length - 1].timestamp > block.timestamp) ||
      (_clanInfo.defendingVaults[length - 1].timestamp1 > block.timestamp);
  }

  function _getClanIndices(
    uint32[] storage _sortedClanIdsByMMR,
    uint _clanId,
    uint _defendingClanId
  ) private view returns (uint clanIndex, uint defendingIndex) {
    uint numFound;
    clanIndex = type(uint256).max;
    defendingIndex = type(uint256).max;
    for (uint i = 0; i < _sortedClanIdsByMMR.length; ++i) {
      if (_sortedClanIdsByMMR[i] == _clanId) {
        clanIndex = i;
        ++numFound;
      }

      if (_sortedClanIdsByMMR[i] == _defendingClanId) {
        defendingIndex = i;
        ++numFound;
      }

      if (numFound == 2) {
        break;
      }
    }
  }

  function _isWithinRange(
    uint32[] storage _sortedClanIdsByMMR,
    uint256 _clanIdIndex,
    uint256 _defendingClanIdIndex,
    uint256 _mmrAttackDistance
  ) private view returns (bool) {
    // Calculate direct distance
    uint256 directDistance = (_clanIdIndex > _defendingClanIdIndex)
      ? _clanIdIndex - _defendingClanIdIndex
      : _defendingClanIdIndex - _clanIdIndex;

    //  Increase distance extending the array bounds
    uint extraDistance = 0;
    if (_clanIdIndex < _mmrAttackDistance) {
      // At front
      extraDistance = _mmrAttackDistance - _clanIdIndex;
    } else if (_clanIdIndex + _mmrAttackDistance >= _sortedClanIdsByMMR.length) {
      extraDistance = _clanIdIndex + _mmrAttackDistance - (_sortedClanIdsByMMR.length - 1);
    }

    return (_mmrAttackDistance + extraDistance) >= directDistance;
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
    uint32[] storage _sortedClanIdsByMMR,
    uint16[] storage _sortedMMR,
    IClans _clans,
    uint256 _attackingClanId,
    uint256 _defendingClanId,
    bool _didAttackersWin,
    mapping(uint clanId => ClanInfo clanInfo) storage _clanInfos
  ) external returns (int256 attackingMMRDiff, int256 defendingMMRDiff) {
    (uint256 clanIndex, uint256 defendingClanIndex) = _getClanIndices(
      _sortedClanIdsByMMR,
      _attackingClanId,
      _defendingClanId
    );
    bool clanInArray = clanIndex != type(uint256).max;
    uint256 attackingMMR = clanInArray ? _sortedMMR[clanIndex] : _clans.getMMR(_attackingClanId);

    uint256 defendingMMR = defendingClanIndex != type(uint256).max
      ? _sortedMMR[defendingClanIndex]
      : _clans.getMMR(_defendingClanId);

    // TODO: Update later (Get a minimum of 1?)
    int256 diff = int256(attackingMMR) - int256(defendingMMR);
    uint256 absDiff = uint256(diff > 0 ? diff : -diff); // Absolute value of diff

    if (_didAttackersWin) {
      attackingMMRDiff = int256(Math.max(absDiff / 10, 1));
      defendingMMRDiff = -int256(Math.max(absDiff / 5, 1));
    } else {
      attackingMMRDiff = -int256(Math.max(absDiff / 10, 1));
      defendingMMRDiff = int256(Math.max(absDiff / 5, 1));
    }

    // Tried to use a struct but got "Could not create stack layout after 1000 iterations" error
    uint[] memory indices = new uint[](2);
    uint16[] memory newMMRs = new uint16[](2);
    uint32[] memory clanIds = new uint32[](2);
    bool[] memory upwardFlags = new bool[](2);
    uint length;

    if (attackingMMRDiff != 0 && defendingMMR != 0) {
      uint newAttackingMMR = uint(int(attackingMMR) + attackingMMRDiff);

      _clans.setMMR(_attackingClanId, uint16(newAttackingMMR));

      if (clanInArray) {
        // Attacking a clan while you have locked funds
        indices[length] = clanIndex;
        newMMRs[length] = uint16(newAttackingMMR);
        clanIds[length] = uint32(_attackingClanId);
        upwardFlags[length++] = _didAttackersWin;
      } else {
        // Attacking a clan while you have no locked funds
        _insertMMRArray(_sortedClanIdsByMMR, _sortedMMR, uint16(newAttackingMMR), uint32(_attackingClanId));
        _clanInfos[_attackingClanId].isInMMRArray = true;
      }
    }

    if (defendingMMRDiff != 0 && attackingMMR != 0) {
      uint newDefendingMMR = uint(int(defendingMMR) + defendingMMRDiff);
      _clans.setMMR(_defendingClanId, uint16(newDefendingMMR));

      bool defendingClanInArray = defendingClanIndex != type(uint256).max;
      // Clan might have no locked funds anymore
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
      _updateMMRArrays(_sortedClanIdsByMMR, _sortedMMR, indices, newMMRs, clanIds, upwardFlags);
    }
  }

  function _updateMMRArrays(
    uint32[] storage _sortedClanIdsByMMR,
    uint16[] storage _sortedMMR,
    uint[] memory _indices,
    uint16[] memory _newMMRs,
    uint32[] memory _clanIds,
    bool[] memory _upwardFlags
  ) public {
    // Adjust each index update one by one
    for (uint i = 0; i < _indices.length; ++i) {
      uint currentIndex = _indices[i];
      uint16 _newMMR = _newMMRs[i];
      uint32 _clanId = _clanIds[i];
      bool _upward = _upwardFlags[i];

      uint newIndex = _updateSingleMMR(_sortedClanIdsByMMR, _sortedMMR, currentIndex, _newMMR, _clanId, _upward);

      // Adjust subsequent indices if needed
      for (uint j = i + 1; j < _indices.length; ++j) {
        if (_upward && _indices[j] >= currentIndex && _indices[j] <= newIndex) {
          --_indices[j]; // Adjust index if it falls within the shifted range
        } else if (!_upward && _indices[j] <= currentIndex && _indices[j] >= newIndex) {
          ++_indices[j]; // Adjust index if it falls within the shifted range
        }
      }
    }
  }

  function _updateSingleMMR(
    uint32[] storage _sortedClanIdsByMMR,
    uint16[] storage _sortedMMR,
    uint _currentIndex,
    uint16 _newMMR,
    uint32 _clanId,
    bool _upward
  ) internal returns (uint) {
    if (_upward) {
      // Shift elements left if newMMR is greater
      uint i = _currentIndex;
      while (i < _sortedMMR.length - 1 && _sortedMMR[i + 1] <= _newMMR) {
        _sortedMMR[i] = _sortedMMR[i + 1];
        _sortedClanIdsByMMR[i] = _sortedClanIdsByMMR[i + 1];
        ++i;
      }
      _sortedMMR[i] = _newMMR;
      _sortedClanIdsByMMR[i] = _clanId;
      return i;
    } else {
      // Shift elements right if newMMR is less
      uint i = _currentIndex;
      while (i > 0 && _sortedMMR[i - 1] > _newMMR) {
        _sortedMMR[i] = _sortedMMR[i - 1];
        _sortedClanIdsByMMR[i] = _sortedClanIdsByMMR[i - 1];
        --i;
      }
      _sortedMMR[i] = _newMMR;
      _sortedClanIdsByMMR[i] = _clanId;
      return i;
    }
  }

  function insertMMRArray(
    uint32[] storage _sortedClanIdsByMMR,
    uint16[] storage _sortedMMR,
    uint16 _mmr,
    uint32 _clanId
  ) external {
    _insertMMRArray(_sortedClanIdsByMMR, _sortedMMR, _mmr, _clanId);
  }

  function _insertMMRArray(
    uint32[] storage _sortedClanIdsByMMR,
    uint16[] storage _sortedMMR,
    uint16 _mmr,
    uint32 _clanId
  ) private returns (uint index) {
    // Use upper bound for this to find where to insert it
    index = EstforLibrary.upperBound(_sortedMMR, _mmr);
    _sortedMMR.push(); // expand array
    _sortedClanIdsByMMR.push(); // expand array

    for (uint i = _sortedMMR.length - 1; i > index; --i) {
      _sortedMMR[i] = _sortedMMR[i - 1];
      _sortedClanIdsByMMR[i] = _sortedClanIdsByMMR[i - 1];
    }
    _sortedMMR[index] = _mmr;
    _sortedClanIdsByMMR[index] = _clanId;
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
}
