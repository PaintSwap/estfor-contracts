// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {VaultClanInfo, ClanBattleInfo, Vault} from "../globals/clans.sol";
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
  error ClanDoesntExist(uint256 clanId);

  function initializeMMR(
    uint48[] storage sortedClansByMMR,
    IClans clans,
    mapping(uint256 clanId => VaultClanInfo clanInfo) storage clanInfos,
    uint256[] calldata clanIds,
    uint16[] calldata mmrs
  ) external {
    require(clanIds.length == mmrs.length, LengthMismatch());

    for (uint256 i = 0; i < clanIds.length; ++i) {
      clans.setMMR(clanIds[i], mmrs[i]);
      _insertMMRArray(sortedClansByMMR, mmrs[i], uint32(clanIds[i]));
      clanInfos[clanIds[i]].isInMMRArray = true;
    }
  }

  function forceMMRUpdate(
    uint48[] storage sortedClansByMMR,
    IClans clans,
    mapping(uint256 clanId => VaultClanInfo clanInfo) storage clanInfos,
    uint256[] calldata clanIds
  ) external returns (uint256[] memory clanIdsToDelete) {
    // Create an array to mark elements for deletion
    uint256 length = sortedClansByMMR.length;
    bool[] memory toDelete = new bool[](length);
    clanIdsToDelete = new uint256[](clanIds.length);
    uint256 clanIdsToDeletelength;

    // Mark elements for deletion
    for (uint256 i = 0; i < clanIds.length; ++i) {
      uint256 index = type(uint256).max;
      for (uint256 j = 0; j < length; ++j) {
        if (_getClanId(sortedClansByMMR[j]) == clanIds[i]) {
          index = j;
          break;
        }
      }

      if (
        index != type(uint256).max &&
        (!_hasLockedFunds(clanInfos[clanIds[i]]) || clans.maxMemberCapacity(clanIds[i]) == 0)
      ) {
        toDelete[index] = true;
        clanInfos[clanIds[i]].isInMMRArray = false;
        clanIdsToDelete[clanIdsToDeletelength++] = clanIds[i];
      }
    }

    // Perform a single shift operation at the end
    uint256 shiftCount = 0;
    for (uint256 i = 0; i < length; ++i) {
      if (toDelete[i]) {
        ++shiftCount;
      } else if (shiftCount != 0) {
        sortedClansByMMR[i - shiftCount] = sortedClansByMMR[i];
      }
    }

    // Reduce the length of the array
    assembly ("memory-safe") {
      sstore(sortedClansByMMR.slot, sub(length, shiftCount))
      mstore(clanIdsToDelete, clanIdsToDeletelength)
    }
  }

  function claimFunds(
    uint48[] storage sortedClansByMMR,
    VaultClanInfo storage clanInfo,
    uint256 clanId
  ) external returns (uint256 total, uint256 numLocksClaimed) {
    uint256 defendingVaultsOffset = clanInfo.defendingVaultsOffset;
    // There a few cases to consider here:
    // 1. The first one is not expired, so we can't claim anything
    // 2. The first one is expired, but the second one is not, so we can claim the first one
    // 3. The first one is expired, and the second one is expired, so we can claim both
    // We don't need to set claimed = true unless we know the second one is not expired yet
    for (uint256 i = defendingVaultsOffset; i < clanInfo.defendingVaults.length; ++i) {
      Vault storage defendingVault = clanInfo.defendingVaults[i];
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

    require(total != 0, NothingToClaim());

    uint256 totalBrushLocked = clanInfo.totalBrushLocked;
    clanInfo.totalBrushLocked = uint96(totalBrushLocked - total);
    bool hasRemainingLockedBrush = totalBrushLocked - total != 0;
    if (!hasRemainingLockedBrush) {
      uint256 length = sortedClansByMMR.length;
      for (uint256 i = 0; i < length; ++i) {
        bool foundClan = _getClanId(sortedClansByMMR[i]) == clanId;
        if (foundClan) {
          // Shift everything to the left and pop
          for (uint256 j = i; j < length - 1; ++j) {
            sortedClansByMMR[j] = sortedClansByMMR[j + 1];
          }
          sortedClansByMMR.pop();
          clanInfo.isInMMRArray = false;
          break;
        }
      }
    }
    clanInfo.defendingVaultsOffset = uint24(defendingVaultsOffset);
  }

  function checkWithinRange(
    uint48[] storage sortedClansByMMR,
    uint256 clanId,
    uint256 defendingClanId,
    IClans clans,
    uint256 mmrAttackDistance
  ) external view {
    (uint256 clanIndex, uint256 defendingClanIndex) = _getClanIndices(sortedClansByMMR, clanId, defendingClanId);
    uint48[] memory modifiedSortedClansByMMR;
    if (clanIndex == type(uint256).max) {
      (modifiedSortedClansByMMR, clanIndex) = _insertMMRArrayInMemory(
        sortedClansByMMR,
        clans.getMMR(clanId),
        uint32(clanId)
      );
      if (clanIndex <= defendingClanIndex) {
        ++defendingClanIndex;
      }
    } else {
      modifiedSortedClansByMMR = sortedClansByMMR;
    }

    require(
      _isWithinRange(modifiedSortedClansByMMR, clanIndex, defendingClanIndex, mmrAttackDistance),
      OutsideMMRRange()
    );
  }

  function _hasLockedFunds(VaultClanInfo storage clanInfo) internal view returns (bool) {
    uint256 length = clanInfo.defendingVaults.length;
    if (length == 0) {
      return false;
    }
    // 1 value has not expired yet
    return
      (clanInfo.defendingVaults[length - 1].timestamp > block.timestamp) ||
      (clanInfo.defendingVaults[length - 1].timestamp1 > block.timestamp);
  }

  function _getClanIndicesMemory(
    uint48[] memory sortedClansByMMR,
    uint256 clanId,
    uint256 defendingClanId
  ) private pure returns (uint256 clanIndex, uint256 defendingIndex) {
    uint256 numFound;
    clanIndex = type(uint256).max;
    defendingIndex = type(uint256).max;
    for (uint256 i = 0; i < sortedClansByMMR.length; ++i) {
      if (_getClanId(sortedClansByMMR[i]) == clanId) {
        clanIndex = i;
        ++numFound;
      }

      if (_getClanId(sortedClansByMMR[i]) == defendingClanId) {
        defendingIndex = i;
        ++numFound;
      }

      if (numFound == 2) {
        break;
      }
    }
  }

  function _getClanIndices(
    uint48[] storage sortedClansByMMR,
    uint256 clanId,
    uint256 defendingClanId
  ) private view returns (uint256 clanIndex, uint256 defendingIndex) {
    uint256 numFound;
    clanIndex = type(uint256).max;
    defendingIndex = type(uint256).max;
    for (uint256 i = 0; i < sortedClansByMMR.length; ++i) {
      if (_getClanId(sortedClansByMMR[i]) == clanId) {
        clanIndex = i;
        ++numFound;
      }

      if (_getClanId(sortedClansByMMR[i]) == defendingClanId) {
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
    uint256 clanId,
    uint256 defendingClanId,
    uint256 mmrAttackDistance
  ) external pure returns (bool) {
    uint48[] memory sortedClansByMMR = new uint48[](clanIds.length);
    for (uint256 i = 0; i < clanIds.length; ++i) {
      sortedClansByMMR[i] = (uint32(clanIds[i]) << 16) | mmrs[i];
    }
    (uint256 clanIndex, uint256 defendingClanIndex) = _getClanIndicesMemory(sortedClansByMMR, clanId, defendingClanId);

    require(clanIndex != type(uint256).max, ClanDoesntExist(clanId));
    require(defendingClanIndex != type(uint256).max, ClanDoesntExist(defendingClanId));

    return _isWithinRange(sortedClansByMMR, clanIndex, defendingClanIndex, mmrAttackDistance);
  }

  // Range is not taken into account for the attacker with the same MMR as surrounding clans.
  // So with this array [400, 500, 500, 500, 600] with a range of 1, any attacker at 500 can attack the defender at 400 and 600
  // If there are any duplicates at the edge of the range, then the attacker can attack any with that MMR
  // So with the above array the 400 MMR clan can attack any 500 MMR clans with a range of 1
  function _isWithinRange(
    uint48[] memory sortedClansByMMR,
    uint256 clanIdIndex,
    uint256 defendingClanIdIndex,
    uint256 mmrAttackDistance
  ) private pure returns (bool) {
    // If they are within range then just return
    uint256 directDistance = (clanIdIndex > defendingClanIdIndex)
      ? clanIdIndex - defendingClanIdIndex
      : defendingClanIdIndex - clanIdIndex;
    if (mmrAttackDistance >= directDistance) {
      return true;
    }

    // Have the same MMR
    uint256 defenderMMR = _getMMR(sortedClansByMMR[defendingClanIdIndex]);
    uint256 attackerMMR = _getMMR(sortedClansByMMR[clanIdIndex]);
    if (defenderMMR == attackerMMR) {
      return true;
    }

    // Find the lower and upper bounds of clans with the same MMR as the attacking clan so that
    uint256 attackerLowerBound = clanIdIndex;
    uint256 attackerUpperBound = clanIdIndex;

    while (
      attackerLowerBound != 0 &&
      _getMMR(sortedClansByMMR[attackerLowerBound - 1]) == _getMMR(sortedClansByMMR[clanIdIndex])
    ) {
      --attackerLowerBound;
    }

    while (
      attackerUpperBound < sortedClansByMMR.length - 1 &&
      _getMMR(sortedClansByMMR[attackerUpperBound + 1]) == _getMMR(sortedClansByMMR[clanIdIndex])
    ) {
      ++attackerUpperBound;
    }

    uint256 boundDistance = defendingClanIdIndex > clanIdIndex
      ? defendingClanIdIndex - attackerUpperBound
      : attackerLowerBound - defendingClanIdIndex;
    if (mmrAttackDistance >= boundDistance) {
      return true;
    }

    // If outside range, check if MMR is the same as the MMR as that at the edge of the range
    int256 rangeEdgeIndex = int256(
      defendingClanIdIndex > clanIdIndex
        ? attackerUpperBound + mmrAttackDistance
        : attackerLowerBound - mmrAttackDistance
    );

    if (rangeEdgeIndex < 0) {
      rangeEdgeIndex = 0;
    } else if (rangeEdgeIndex >= int256(sortedClansByMMR.length)) {
      rangeEdgeIndex = int256(sortedClansByMMR.length - 1);
    }

    return defenderMMR == _getMMR(sortedClansByMMR[uint256(rangeEdgeIndex)]);
  }

  function blockAttacks(
    IItemNFT itemNFT,
    uint16 itemTokenId,
    VaultClanInfo storage clanInfo
  ) external returns (uint256 blockAttacksTimestamp) {
    Item memory item = itemNFT.getItem(itemTokenId);
    require(
      item.equipPosition == EquipPosition.LOCKED_VAULT && item.boostType == BoostType.PVP_BLOCK,
      NotALockedVaultDefenceItem()
    );

    require(
      (clanInfo.blockAttacksTimestamp + uint256(clanInfo.blockAttacksCooldownHours) * 3600) <= block.timestamp,
      BlockAttacksCooldown()
    );

    blockAttacksTimestamp = block.timestamp + item.boostDuration;
    clanInfo.blockAttacksTimestamp = uint40(blockAttacksTimestamp);
    clanInfo.blockAttacksCooldownHours = uint8(item.boostValue);

    itemNFT.burn(msg.sender, itemTokenId, 1);
  }

  function fulfillUpdateMMR(
    uint256 kA,
    uint256 kD,
    uint48[] storage sortedClansByMMR,
    IClans clans,
    uint256 attackingClanId,
    uint256 defendingClanId,
    bool didAttackersWin,
    mapping(uint256 clanId => VaultClanInfo clanInfo) storage clanInfos
  ) external returns (int256 attackingMMRDiff, int256 defendingMMRDiff) {
    (uint256 clanIndex, uint256 defendingClanIndex) = _getClanIndices(
      sortedClansByMMR,
      attackingClanId,
      defendingClanId
    );
    bool clanInArray = clanIndex != type(uint256).max;
    uint256 attackingMMR = clanInArray ? _getMMR(sortedClansByMMR[clanIndex]) : clans.getMMR(attackingClanId);

    uint256 defendingMMR = defendingClanIndex != type(uint256).max
      ? _getMMR(sortedClansByMMR[defendingClanIndex])
      : clans.getMMR(defendingClanId);

    (uint256 newAttackingMMR, uint256 newDefendingMMR) = getNewMMRs(
      kA,
      kD,
      uint16(attackingMMR),
      uint16(defendingMMR),
      didAttackersWin
    );

    attackingMMRDiff = int256(newAttackingMMR) - int256(attackingMMR);
    defendingMMRDiff = int256(newDefendingMMR) - int256(defendingMMR);

    // Tried to use a struct but got "Could not create stack layout after 1000 iterations" error
    uint256[] memory indices = new uint256[](2);
    uint16[] memory newMMRs = new uint16[](2);
    uint32[] memory clanIds = new uint32[](2);
    bool[] memory upwardFlags = new bool[](2);
    uint256 length;

    if (attackingMMRDiff != 0) {
      clans.setMMR(attackingClanId, uint16(newAttackingMMR));

      if (clanInArray) {
        // Attacking a clan while you have locked funds
        indices[length] = clanIndex;
        newMMRs[length] = uint16(newAttackingMMR);
        clanIds[length] = uint32(attackingClanId);
        upwardFlags[length++] = didAttackersWin;
      } else if (didAttackersWin) {
        // Attacking a clan while you have no locked funds and win
        clanIndex = _insertMMRArray(sortedClansByMMR, uint16(newAttackingMMR), uint32(attackingClanId));
        clanInfos[attackingClanId].isInMMRArray = true;
        if (clanIndex <= defendingClanIndex && defendingClanIndex != type(uint256).max) {
          ++defendingClanIndex;
        }
      }
    }

    if (defendingMMRDiff != 0) {
      clans.setMMR(defendingClanId, uint16(newDefendingMMR));

      bool defendingClanInArray = defendingClanIndex != type(uint256).max;
      if (defendingClanInArray) {
        // Attacking a clan while they have locked funds
        indices[length] = defendingClanIndex;
        newMMRs[length] = uint16(newDefendingMMR);
        clanIds[length] = uint32(defendingClanId);
        upwardFlags[length++] = !didAttackersWin;
      }
    }

    assembly ("memory-safe") {
      mstore(indices, length)
      mstore(newMMRs, length)
      mstore(clanIds, length)
      mstore(upwardFlags, length)
    }
    if (length != 0) {
      _updateMMRArrays(sortedClansByMMR, indices, newMMRs, clanIds, upwardFlags);
    }
  }

  function checkCanAttackVaults(
    uint256 clanId,
    uint256 defendingClanId,
    uint16 itemTokenId,
    uint256 maxLockedVaults,
    uint256 numPackedVaults,
    IItemNFT itemNFT,
    mapping(uint256 clanId => VaultClanInfo clanInfo) storage clanInfos,
    mapping(uint256 clanId => mapping(uint256 otherClanId => ClanBattleInfo battleInfo)) storage lastClanBattles
  ) external view returns (bool isReattacking, bool isUsingSuperAttack, uint256 superAttackCooldownTimestamp) {
    // Must have at least 1 combatant
    VaultClanInfo storage clanInfo = clanInfos[clanId];
    require(clanInfo.playerIds.length != 0, NoCombatants());
    require(clanId != defendingClanId, CannotAttackSelf());

    // Does this clan have any brush to even attack?
    VaultClanInfo storage defendingClanInfo = clanInfos[defendingClanId];
    require(defendingClanInfo.totalBrushLocked != 0, NoBrushToAttack());
    require(defendingClanInfo.blockAttacksTimestamp <= block.timestamp, ClanIsBlockingAttacks());
    require(clanInfo.attackingCooldownTimestamp <= block.timestamp, ClanAttackingCooldown());
    require(!clanInfo.currentlyAttacking, CannotAttackWhileStillAttacking());

    uint256 length = clanInfo.defendingVaults.length;
    uint256 defendingVaultsOffset = clanInfo.defendingVaultsOffset;
    require(length - defendingVaultsOffset <= maxLockedVaults / numPackedVaults, MaxLockedVaultsReached());

    uint256 numReattacks;
    (isReattacking, numReattacks) = _checkCanReattackVaults(clanId, defendingClanId, lastClanBattles);

    bool canReattack;
    if (itemTokenId != 0) {
      Item memory item = itemNFT.getItem(itemTokenId);
      bool isValidItem = item.equipPosition == EquipPosition.LOCKED_VAULT;
      require(isValidItem, NotALockedVaultAttackItem());

      if (isReattacking) {
        require(item.boostType == BoostType.PVP_REATTACK, NotALockedVaultAttackItem());
        canReattack = item.boostValue > numReattacks;
      } else {
        isUsingSuperAttack = item.boostType == BoostType.PVP_SUPER_ATTACK;
        require(isUsingSuperAttack, SpecifyingItemWhenNotReattackingOrSuperAttacking());
        require(clanInfo.superAttackCooldownTimestamp <= block.timestamp, ClanSuperAttackingCooldown());
        superAttackCooldownTimestamp = block.timestamp + item.boostDuration;
      }
    }

    require(!(isReattacking && !canReattack), ClanAttackingSameClanCooldown());
    require(!(isReattacking && isUsingSuperAttack), CannotReattackAndSuperAttackSameTime());
  }

  function getNewMMRs(
    uint256 kA,
    uint256 kD,
    uint16 attackingMMR,
    uint16 defendingMMR,
    bool didAttackersWin
  ) public pure returns (uint16 newAttackerMMR, uint16 newDefenderMMR) {
    uint256 Sa = didAttackersWin ? 100 : 0; // attacker score variable scaled up
    uint256 Sd = didAttackersWin ? 0 : 100; // defender score variable scaled up

    (uint256 changeA, bool negativeA) = _ratingChange(attackingMMR, defendingMMR, Sa, kA);
    (uint256 changeD, bool negativeD) = _ratingChange(defendingMMR, attackingMMR, Sd, kD);

    int _newAttackerMMR = int24(uint24(attackingMMR)) + (negativeA ? -int(changeA) : int(changeA));
    int _newDefenderMMR = int24(uint24(defendingMMR)) + (negativeD ? -int(changeD) : int(changeD));

    if (_newAttackerMMR < 0) {
      _newAttackerMMR = 0;
    }

    if (_newDefenderMMR < 0) {
      _newDefenderMMR = 0;
    }

    newAttackerMMR = uint16(uint24(int24(_newAttackerMMR)));
    newDefenderMMR = uint16(uint24(int24(_newDefenderMMR)));
  }

  function getSortedClanIdsByMMR(uint48[] storage sortedClansByMMR) external view returns (uint32[] memory clanIds) {
    uint256 length = sortedClansByMMR.length;
    clanIds = new uint32[](length);
    for (uint256 i; i < length; ++i) {
      clanIds[i] = uint32(_getClanId(sortedClansByMMR[i]));
    }
  }

  function getSortedMMR(uint48[] storage sortedClansByMMR) external view returns (uint16[] memory mmrs) {
    uint256 length = sortedClansByMMR.length;
    mmrs = new uint16[](length);
    for (uint256 i; i < length; ++i) {
      mmrs[i] = uint16(_getMMR(sortedClansByMMR[i]));
    }
  }

  function getIdleClans(
    uint48[] storage sortedClansByMMR,
    mapping(uint256 clanId => VaultClanInfo clanInfo) storage clanInfos,
    IClans clans
  ) external view returns (uint256[] memory clanIds) {
    uint256 origLength = sortedClansByMMR.length;
    clanIds = new uint256[](origLength);
    uint256 length;

    for (uint256 i; i < origLength; ++i) {
      uint256 clanId = _getClanId(sortedClansByMMR[i]);
      if (!_hasLockedFunds(clanInfos[clanId]) || clans.maxMemberCapacity(clanId) == 0) {
        clanIds[length++] = uint32(clanId);
      }
    }

    assembly ("memory-safe") {
      mstore(clanIds, length)
    }
  }

  function _lowerBound(uint48[] storage sortedClansByMMR, uint256 targetMMR) internal view returns (uint256) {
    if (sortedClansByMMR.length == 0) {
      return 0;
    }

    uint256 low = 0;
    uint256 high = sortedClansByMMR.length;

    while (low < high) {
      uint256 mid = (low + high) / 2;
      uint256 clanMMR = _getMMR(sortedClansByMMR[mid]);
      if (clanMMR < targetMMR) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  function checkCanAssignCombatants(
    VaultClanInfo storage clanInfo,
    uint48[] calldata playerIds,
    uint8 maxClanCombatants
  ) external view {
    require(!clanInfo.currentlyAttacking, CannotChangeCombatantsDuringAttack());
    require(playerIds.length <= maxClanCombatants, TooManyCombatants());
    // Can only change combatants every so often
    require(clanInfo.assignCombatantsCooldownTimestamp <= block.timestamp, ClanCombatantsChangeCooldown());
  }

  function clearCooldowns(
    uint256 clanId,
    uint256[] calldata otherClanIds,
    VaultClanInfo storage clanInfo,
    mapping(uint256 clanId => mapping(uint256 otherClanId => ClanBattleInfo battleInfo)) storage lastClanBattles
  ) external {
    clanInfo.attackingCooldownTimestamp = 0;
    clanInfo.assignCombatantsCooldownTimestamp = 0;
    clanInfo.currentlyAttacking = false;
    clanInfo.superAttackCooldownTimestamp = 0;
    clanInfo.blockAttacksTimestamp = 0;
    clanInfo.blockAttacksCooldownHours = 0;

    for (uint256 i; i < otherClanIds.length; ++i) {
      uint256 lowerClanId = clanId < otherClanIds[i] ? clanId : otherClanIds[i];
      uint256 higherClanId = clanId < otherClanIds[i] ? otherClanIds[i] : clanId;
      delete lastClanBattles[lowerClanId][higherClanId];
    }
  }

  function _updateMMRArrays(
    uint48[] storage sortedClansByMMR,
    uint256[] memory indices,
    uint16[] memory newMMRs,
    uint32[] memory clanIds,
    bool[] memory upwardFlags
  ) private {
    // Adjust each index, update one by one
    for (uint256 i = 0; i < indices.length; ++i) {
      uint256 currentIndex = indices[i];
      uint16 newMMR = newMMRs[i];
      uint32 clanId = clanIds[i];
      bool upward = upwardFlags[i];

      uint256 newIndex = _updateSingleMMR(sortedClansByMMR, currentIndex, newMMR, clanId, upward);
      // Adjust subsequent indices if needed
      for (uint256 j = i + 1; j < indices.length; ++j) {
        if (upward && indices[j] >= currentIndex && indices[j] <= newIndex) {
          --indices[j]; // Adjust index if it falls within the shifted range
        } else if (!upward && indices[j] <= currentIndex && indices[j] >= newIndex) {
          ++indices[j]; // Adjust index if it falls within the shifted range
        }
      }
    }
  }

  function _updateSingleMMR(
    uint48[] storage sortedClansByMMR,
    uint256 currentIndex,
    uint16 newMMR,
    uint32 clanId,
    bool upward
  ) internal returns (uint256) {
    uint256 i = currentIndex;
    // Check if the new position would be different
    bool shouldMove = false;
    if (upward && i < sortedClansByMMR.length - 1) {
      shouldMove = _getMMR(sortedClansByMMR[i + 1]) < newMMR;
    } else if (!upward && i != 0) {
      shouldMove = _getMMR(sortedClansByMMR[i - 1]) >= newMMR;
    }

    if (!shouldMove) {
      // If position doesn't change, just update the MMR and return
      _setPackedClanIdAndMMR(sortedClansByMMR, i, clanId, newMMR);
      return i;
    }

    if (upward) {
      // Shift elements left if newMMR is higher
      while (i < sortedClansByMMR.length - 1 && _getMMR(sortedClansByMMR[i + 1]) < newMMR) {
        sortedClansByMMR[i] = sortedClansByMMR[i + 1];
        ++i;
      }
    } else {
      // Shift elements right if newMMR is lower
      while (i != 0 && _getMMR(sortedClansByMMR[i - 1]) >= newMMR) {
        sortedClansByMMR[i] = sortedClansByMMR[i - 1];
        --i;
      }
    }

    _setPackedClanIdAndMMR(sortedClansByMMR, i, clanId, newMMR);
    return i;
  }

  function insertMMRArray(uint48[] storage sortedClansByMMR, uint16 mmr, uint32 clanId) external {
    _insertMMRArray(sortedClansByMMR, mmr, clanId);
  }

  function _insertMMRArray(
    uint48[] storage sortedClansByMMR,
    uint16 mmr,
    uint32 clanId
  ) private returns (uint256 index) {
    // Find where to insert it into the array
    index = _lowerBound(sortedClansByMMR, mmr);
    sortedClansByMMR.push(); // expand array
    // Shift array to the right
    for (uint256 i = sortedClansByMMR.length - 1; i > index; --i) {
      sortedClansByMMR[i] = sortedClansByMMR[i - 1];
    }
    _setPackedClanIdAndMMR(sortedClansByMMR, index, clanId, mmr);
  }

  function _insertMMRArrayInMemory(
    uint48[] storage sortedClansByMMR,
    uint16 mmr,
    uint32 clanId
  ) private view returns (uint48[] memory newSortedClansByMMR, uint256 index) {
    // Find where to insert it into the array
    index = _lowerBound(sortedClansByMMR, mmr);

    // Copy to memory and shift any after the index to the right
    newSortedClansByMMR = new uint48[](sortedClansByMMR.length + 1);
    for (uint256 i = 0; i < newSortedClansByMMR.length; ++i) {
      if (i < index) {
        newSortedClansByMMR[i] = sortedClansByMMR[i];
      } else if (i == index) {
        newSortedClansByMMR[i] = (uint32(clanId) << 16) | mmr;
      } else {
        newSortedClansByMMR[i] = sortedClansByMMR[i - 1];
      }
    }
  }

  function _setPackedClanIdAndMMR(uint48[] storage sortedClansByMMR, uint256 index, uint32 clanId, uint16 mmr) private {
    sortedClansByMMR[index] = (uint32(clanId) << 16) | mmr;
  }

  function _getUnpackedClanIdAndMMR(
    uint48[] storage sortedClansByMMR,
    uint256 index
  ) private view returns (uint32 clanId, uint16 mmr) {
    uint48 packed = sortedClansByMMR[index];
    clanId = uint32(packed >> 16);
    mmr = uint16(packed);
  }

  function _checkCanReattackVaults(
    uint256 clanId,
    uint256 defendingClanId,
    mapping(uint256 clanId => mapping(uint256 otherClanId => ClanBattleInfo battleInfo)) storage lastClanBattles
  ) private view returns (bool isReattacking, uint256 numReattacks) {
    // Check if they are re-attacking this clan and allowed to
    uint256 lowerClanId = clanId < defendingClanId ? clanId : defendingClanId;
    uint256 higherClanId = clanId < defendingClanId ? defendingClanId : clanId;
    ClanBattleInfo storage battleInfo = lastClanBattles[lowerClanId][higherClanId];
    if (lowerClanId == clanId) {
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

  function _getMMR(uint48 packed) private pure returns (uint256) {
    return uint16(packed);
  }

  function _getClanId(uint48 packed) private pure returns (uint256) {
    return uint32(packed >> 16);
  }

  // This function is adapted from the solidity ELO library
  /// @notice Get the 16th root of a number, used in MMR calculations
  /// @dev MMR calculations require the 400th root (10 ^ (x / 400)), however this can be simplified to the 16th root (10 ^ ((x / 25) / 16))
  function _sixteenthRoot(uint256 x) internal pure returns (uint256) {
    return Math.sqrt(Math.sqrt(Math.sqrt(Math.sqrt(x))));
  }

  // This function is adapted from the solidity ELO library
  /// @notice Calculates the change in MMR rating, after a given outcome.
  /// @param ratingA the MMR rating of the clan A
  /// @param ratingD the MMR rating of the clan D
  /// @param score the _score of the clan A, scaled by 100. 100 = win, 0 = loss
  /// @param kFactor the k-factor or development multiplier used to calculate the change in MMR rating. 20 is the typical value
  /// @return change the change in MMR rating of clan D
  /// @return isNegative the directional change of clan A's MMR. Opposite sign for clan D
  function _ratingChange(
    uint256 ratingA,
    uint256 ratingD,
    uint256 score,
    uint256 kFactor
  ) internal pure returns (uint256 change, bool isNegative) {
    uint256 kFactorScaled; // scaled up `kFactor` by 100
    bool negative = ratingD < ratingA;
    uint256 ratingDiff; // absolute value difference between `_ratingA` and `_ratingD`

    unchecked {
      // scale up the inputs by a factor of 100
      // since our MMR math is scaled up by 100 (to avoid low precision integer division)
      kFactorScaled = kFactor * 10_000;
      ratingDiff = negative ? ratingA - ratingD : ratingD - ratingA;
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
    uint256 powered; // the value of 10 ^ numerator
    uint256 poweredRoot; // the value of 16th root of 10 ^ numerator (fully resolved 10 ^ (ratingDiff / 400))
    uint256 kExpectedScore; // the expected _score with K factor distributed
    uint256 kScore; // the actual _score with K factor distributed

    unchecked {
      // Apply offset of 800 to scale the result by 100
      n = negative ? 800 - ratingDiff : 800 + ratingDiff;

      // (x / 400) is the same as ((x / 25) / 16))
      powered = 10 ** (n / 25); // divide by 25 to avoid reach uint256 max
      poweredRoot = _sixteenthRoot(powered); // x ^ (1 / 16) is the same as 16th root of x

      // given `change = _kFactor * (_score - expectedScore)` we can distribute _kFactor to both terms
      kExpectedScore = kFactorScaled / (100 + poweredRoot); // both numerator and denominator scaled up by 100
      kScore = kFactor * score; // input _score is already scaled up by 100

      // determines the sign of the MMR change
      isNegative = kScore < kExpectedScore;
      change = (isNegative ? kExpectedScore - kScore : kScore - kExpectedScore) / 100;
    }
  }
}
