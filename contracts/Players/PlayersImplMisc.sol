// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {RandomnessBeacon} from "../RandomnessBeacon.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {CombatStyleLibrary} from "../libraries/CombatStyleLibrary.sol";
import {IPlayersMiscDelegate, IPlayersMiscDelegateView} from "../interfaces/IPlayersDelegates.sol";
import {ActivityType} from "../ActivityPoints/interfaces/IActivityPoints.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplMisc is PlayersBase, IPlayersMiscDelegate, IPlayersMiscDelegateView {
  using CombatStyleLibrary for uint8;
  using CombatStyleLibrary for CombatStyle;

  // === XP Threshold rewards ===
  function claimableXPThresholdRewardsImpl(
    uint256 oldTotalXP,
    uint256 newTotalXP
  ) external view returns (uint256[] memory itemTokenIds, uint256[] memory amounts) {
    uint16 prevIndex = _findBaseXPThreshold(oldTotalXP);
    uint16 nextIndex = _findBaseXPThreshold(newTotalXP);

    uint256 diff = nextIndex - prevIndex;
    itemTokenIds = new uint256[](diff);
    amounts = new uint256[](diff);
    uint256 length;
    for (uint256 i; i < diff; ++i) {
      uint32 xpThreshold = _getXPReward(prevIndex + 1 + i);
      Equipment[] memory items = _xpRewardThresholds[xpThreshold];
      if (items.length != 0) {
        // TODO: Currently assumes there is only 1 item per threshold
        itemTokenIds[length] = items[0].itemTokenId;
        amounts[length] = items[0].amount;
        length++;
      }
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, length)
      mstore(amounts, length)
    }
  }

  function _checkXPThresholdRewards(XPThresholdReward calldata xpThresholdReward) private pure {
    for (uint256 i; i < xpThresholdReward.rewards.length; ++i) {
      require(xpThresholdReward.rewards[i].itemTokenId != NONE, InvalidItemTokenId());
      require(xpThresholdReward.rewards[i].amount != 0, InvalidAmount());
    }
  }

  function addXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external {
    for (uint256 i = 0; i < xpThresholdRewards.length; ++i) {
      XPThresholdReward calldata xpThresholdReward = xpThresholdRewards[i];

      // Check that it is part of the hexBytes
      uint16 index = _findBaseXPThreshold(xpThresholdReward.xpThreshold);
      uint32 xpThreshold = _getXPReward(index);
      require(xpThresholdReward.xpThreshold == xpThreshold, XPThresholdNotFound());

      require(_xpRewardThresholds[xpThresholdReward.xpThreshold].length == 0, XPThresholdAlreadyExists());
      _checkXPThresholdRewards(xpThresholdReward);

      _xpRewardThresholds[xpThresholdReward.xpThreshold] = xpThresholdReward.rewards;
      emit AdminAddThresholdReward(xpThresholdReward);
    }
  }

  function editXPThresholdRewards(XPThresholdReward[] calldata xpThresholdRewards) external {
    for (uint256 i = 0; i < xpThresholdRewards.length; ++i) {
      XPThresholdReward calldata xpThresholdReward = xpThresholdRewards[i];
      require(_xpRewardThresholds[xpThresholdReward.xpThreshold].length != 0, XPThresholdDoesNotExist());
      _checkXPThresholdRewards(xpThresholdReward);
      _xpRewardThresholds[xpThresholdReward.xpThreshold] = xpThresholdReward.rewards;
      emit AdminEditThresholdReward(xpThresholdReward);
    }
  }

  // Index not level, add one after (check for > max)
  function _findBaseXPThreshold(uint256 xp) private pure returns (uint16) {
    uint256 low;
    uint256 high = XP_THRESHOLD_REWARDS.length / 4;

    while (low < high) {
      uint256 mid = (low + high) / 2;

      // Note that mid will always be strictly less than high (i.e. it will be a valid array index)
      // Math.average rounds down (it does integer division with truncation).
      if (_getXPReward(mid) > xp) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    if (low != 0) {
      return uint16(low - 1);
    } else {
      return 0;
    }
  }

  function _getXPReward(uint256 index) private pure returns (uint32) {
    uint256 key = index * 4;
    return
      uint32(
        XP_THRESHOLD_REWARDS[key] |
          (bytes4(XP_THRESHOLD_REWARDS[key + 1]) >> 8) |
          (bytes4(XP_THRESHOLD_REWARDS[key + 2]) >> 16) |
          (bytes4(XP_THRESHOLD_REWARDS[key + 3]) >> 24)
      );
  }

  // === End XP Threshold rewards ===

  function dailyRewardsViewImpl(
    address from,
    uint256 playerId
  ) public view returns (uint256[] memory itemTokenIds, uint256[] memory amounts, bytes32 dailyRewardMask) {
    uint256 streakStart = (((block.timestamp - 4 days) / 1 weeks) * 1 weeks) + 4 days;
    bool hasRandomWordLastSunday = _randomnessBeacon.lastRandomWordsUpdatedTime() >= streakStart;
    if (hasRandomWordLastSunday) {
      uint256 streakStartIndex = streakStart / 1 weeks;
      bytes32 mask = _dailyRewardMasks[playerId];
      uint16 lastRewardStartIndex = uint16(uint256(mask));
      if (lastRewardStartIndex < streakStartIndex) {
        mask = bytes32(streakStartIndex); // Reset the mask
      }

      uint256 maskIndex = (((block.timestamp / 1 days) * 1 days) - streakStart) / 1 days;

      // Claim daily/weekly reward
      if (mask[maskIndex] == 0 && _dailyRewardsEnabled) {
        uint256 totalXP = _players[playerId].totalXP;
        uint256 playerTier;

        // Work out the tier
        if (totalXP >= TIER_6_DAILY_REWARD_START_XP) {
          playerTier = 6;
        } else if (totalXP >= TIER_5_DAILY_REWARD_START_XP) {
          playerTier = 5;
        } else if (totalXP >= TIER_4_DAILY_REWARD_START_XP) {
          playerTier = 4;
        } else if (totalXP >= TIER_3_DAILY_REWARD_START_XP) {
          playerTier = 3;
        } else if (totalXP >= TIER_2_DAILY_REWARD_START_XP) {
          playerTier = 2;
        } else {
          playerTier = 1;
        }

        (uint256 itemTokenId, uint256 amount) = _dailyRewardsScheduler.getDailyReward(playerTier, playerId);
        // Can only get the daily reward on an account once per day regardless of how many heros claim
        uint256 lastWalletTimestamp = _walletDailyInfo[from].lastDailyRewardClaimedTimestamp;
        if (itemTokenId != NONE && lastWalletTimestamp < (block.timestamp / 1 days) * 1 days) {
          // Add clan member boost to daily reward (if applicable)
          uint256 clanTierMembership = _clans.getClanTierMembership(playerId);
          amount += (amount * clanTierMembership) / 10; // +10% extra for each clan tier

          dailyRewardMask = mask | ((bytes32(hex"ff") >> (maskIndex * 8)));
          bool canClaimWeeklyRewards = uint256(dailyRewardMask >> (25 * 8)) == 2 ** (7 * 8) - 1;
          uint256 length = canClaimWeeklyRewards ? 2 : 1;
          itemTokenIds = new uint256[](length);
          amounts = new uint256[](length);
          itemTokenIds[0] = itemTokenId;
          uint256 divisor = _isEvolved(playerId) ? 1 : 10; // Divide amount by 10 if not evolved
          amounts[0] = Math.max(1, amount / divisor);
          // Claim weekly rewards (this shifts the left-most 7 day streaks to the very right and checks all bits are set)
          if (canClaimWeeklyRewards) {
            (itemTokenIds[1], amounts[1]) = _dailyRewardsScheduler.getWeeklyReward(playerTier, playerId);
            amounts[1] = Math.max(1, amounts[1] / divisor);
          }
        }
      }
    }
  }

  function dailyClaimedRewardsImpl(uint256 playerId) external view returns (bool[7] memory claimed) {
    uint256 streakStart = ((((block.timestamp - 4 days) / 1 weeks)) * 1 weeks) + 4 days;
    uint256 streakStartIndex = streakStart / 1 weeks;
    bytes32 mask = _dailyRewardMasks[playerId];
    uint16 lastRewardStartIndex = uint16(uint256(mask));
    if (lastRewardStartIndex < streakStartIndex) {
      mask = bytes32(streakStartIndex);
    }

    for (uint256 i; i < 7; ++i) {
      claimed[i] = mask[i] != 0;
    }
  }

  function handleDailyRewards(address from, uint256 playerId) external {
    (
      uint256[] memory rewardItemTokenIds,
      uint256[] memory rewardAmounts,
      bytes32 dailyRewardMask
    ) = dailyRewardsViewImpl(from, playerId);
    if (uint256(dailyRewardMask) != 0) {
      _dailyRewardMasks[playerId] = dailyRewardMask;
    }
    bool isEvolved = _isEvolved(playerId);
    if (rewardAmounts.length != 0) {
      _itemNFT.mint(from, rewardItemTokenIds[0], rewardAmounts[0]);
      emit DailyReward(from, playerId, rewardItemTokenIds[0], rewardAmounts[0]);

      // blue tickets
      _activityPoints.rewardBlueTickets(ActivityType.players_evt_dailyreward, from, isEvolved, rewardAmounts[0]);

      // airdrop ticket
      _activityPoints.rewardGreenTickets(ActivityType.players_dailyreward, from, isEvolved);

      // Mint coins if they are evolved
      if (isEvolved) {
        _itemNFT.mint(
          from,
          65480, // coin
          10
        );
      }

      _walletDailyInfo[from].lastDailyRewardClaimedTimestamp = uint40(block.timestamp);
    }

    if (rewardAmounts.length > 1) {
      _itemNFT.mint(from, rewardItemTokenIds[1], rewardAmounts[1]);
      emit WeeklyReward(from, playerId, rewardItemTokenIds[1], rewardAmounts[1]);

      _activityPoints.rewardBlueTickets(ActivityType.players_evt_weeklyreward, from, isEvolved, rewardAmounts[1]);
    }
  }

  function _getConsumablesEquipment(
    uint256 playerId,
    uint256 currentActionStartTimestamp,
    uint256 xpElapsedTime,
    ActionChoice calldata actionChoice,
    uint16 regenerateId,
    uint16 foodConsumed,
    PendingQueuedActionProcessed calldata pendingQueuedActionProcessed,
    uint16 baseInputItemsConsumedNum
  ) private view returns (Equipment[] memory consumedEquipment, Equipment memory producedEquipment) {
    consumedEquipment = new Equipment[](MAX_CONSUMED_PER_ACTION);
    uint256 consumedEquipmentLength;
    if (regenerateId != NONE && foodConsumed != 0) {
      consumedEquipment[consumedEquipmentLength] = Equipment(regenerateId, foodConsumed);
      consumedEquipmentLength++;
    }

    if (baseInputItemsConsumedNum != 0) {
      if (actionChoice.inputTokenId1 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          actionChoice.inputTokenId1,
          baseInputItemsConsumedNum * actionChoice.inputAmount1
        );
        ++consumedEquipmentLength;
      }
      if (actionChoice.inputTokenId2 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          actionChoice.inputTokenId2,
          baseInputItemsConsumedNum * actionChoice.inputAmount2
        );
        ++consumedEquipmentLength;
      }
      if (actionChoice.inputTokenId3 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          actionChoice.inputTokenId3,
          baseInputItemsConsumedNum * actionChoice.inputAmount3
        );
        ++consumedEquipmentLength;
      }
    }

    if (actionChoice.outputTokenId != 0) {
      uint8 successPercent = 100;
      // Some might be burnt when cooking for instance
      if (actionChoice.successPercent != 100) {
        // Only does the first skill

        uint256 minLevel = PlayersLibrary._getLevel(actionChoice.skillMinXP1);
        uint256 skillLevel = PlayersLibrary._getLevel(
          PlayersLibrary.getAbsoluteActionStartXP(
            actionChoice.skill1,
            pendingQueuedActionProcessed,
            _playerXP[playerId]
          )
        );
        uint256 extraBoost = skillLevel - minLevel;
        successPercent = uint8(Math.min(MAX_SUCCESS_PERCENT_CHANCE, actionChoice.successPercent + extraBoost));
      }

      uint24 numProduced = uint24(
        (uint256(baseInputItemsConsumedNum) * actionChoice.outputAmount * successPercent) / 100
      );

      if (xpElapsedTime != 0) {
        // Check for any gathering boosts
        ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];
        if (playerBoost.boostType == BoostType.GATHERING || playerBoost.lastBoostType == BoostType.GATHERING) {
          uint256 boostedTime = playerBoost.boostType == BoostType.GATHERING
            ? PlayersLibrary.getBoostedTime(
              currentActionStartTimestamp,
              xpElapsedTime,
              playerBoost.startTime,
              playerBoost.duration
            )
            : 0;

          uint256 lastBoostedTime = playerBoost.lastBoostType == BoostType.GATHERING
            ? PlayersLibrary.getBoostedTime(
              currentActionStartTimestamp,
              xpElapsedTime,
              playerBoost.lastStartTime,
              playerBoost.lastDuration
            )
            : 0;

          uint256 boostedVal = playerBoost.boostType == BoostType.GATHERING ? playerBoost.value : 0;
          uint256 lastBoostedVal = playerBoost.lastBoostType == BoostType.GATHERING ? playerBoost.lastValue : 0;

          numProduced += uint24(
            (numProduced * ((boostedTime * boostedVal) + (lastBoostedTime * lastBoostedVal))) / (xpElapsedTime * 100)
          );
        }
      }

      if (numProduced != 0) {
        producedEquipment = Equipment(actionChoice.outputTokenId, numProduced);
      }
    }

    assembly ("memory-safe") {
      mstore(consumedEquipment, consumedEquipmentLength)
    }
  }

  function _processConsumablesView(
    address from,
    uint256 playerId,
    QueuedAction calldata queuedAction,
    uint256 currentActionStartTimestamp,
    uint256 elapsedTime,
    CombatStats calldata combatStats,
    ActionChoice calldata actionChoice,
    uint256 numSpawnedPerHour,
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates,
    PendingQueuedActionProcessed calldata pendingQueuedActionProcessed
  )
    private
    view
    returns (
      Equipment[] memory consumedEquipments,
      Equipment memory producedEquipment,
      uint256 xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
    )
  {
    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    bool isCombat = queuedAction.combatStyle._isCombatStyle();
    if (isCombat) {
      // Fetch the requirements for it
      CombatStats memory enemyCombatStats = _worldActions.getCombatStats(queuedAction.actionId);

      uint256 combatElapsedTime;
      (xpElapsedTime, combatElapsedTime, baseInputItemsConsumedNum, foodConsumed, died) = PlayersLibrary
        .determineBattleOutcome(
          from,
          address(_itemNFT),
          elapsedTime,
          actionChoice,
          queuedAction.regenerateId,
          numSpawnedPerHour,
          combatStats,
          enemyCombatStats,
          _alphaCombat,
          _betaCombat,
          _alphaCombatHealing,
          pendingQueuedActionEquipmentStates
        );
    } else {
      (xpElapsedTime, baseInputItemsConsumedNum) = PlayersLibrary.getNonCombatAdjustedElapsedTime(
        from,
        address(_itemNFT),
        elapsedTime,
        actionChoice,
        pendingQueuedActionEquipmentStates
      );
    }

    (consumedEquipments, producedEquipment) = _getConsumablesEquipment(
      playerId,
      currentActionStartTimestamp,
      xpElapsedTime,
      actionChoice,
      queuedAction.regenerateId,
      foodConsumed,
      pendingQueuedActionProcessed,
      baseInputItemsConsumedNum
    );
  }

  function processConsumablesView(
    address from,
    uint256 playerId,
    QueuedAction calldata queuedAction,
    ActionChoice calldata actionChoice,
    CombatStats calldata combatStats,
    uint256 elapsedTime,
    uint256 startTime,
    uint256 numSpawnedPerHour,
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates, // Memory as it is modified
    PendingQueuedActionProcessed calldata pendingQueuedActionProcessed
  )
    external
    view
    returns (
      Equipment[] memory consumedEquipments,
      Equipment memory producedEquipment,
      uint256 xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
    )
  {
    // Processed
    uint256 prevProcessedTime = queuedAction.prevProcessedTime;
    uint256 veryStartTime = startTime - prevProcessedTime;
    uint256 prevXPElapsedTime = queuedAction.prevProcessedXPTime;

    // Total used
    if (prevProcessedTime != 0) {
      uint16 currentActionProcessedFoodConsumed = _players[playerId].currentActionProcessedFoodConsumed;
      uint16 currentActionProcessedBaseInputItemsConsumedNum = _players[playerId]
        .currentActionProcessedBaseInputItemsConsumedNum;

      (Equipment[] memory prevConsumedEquipments, Equipment memory prevProducedEquipment) = _getConsumablesEquipment(
        playerId,
        veryStartTime,
        prevXPElapsedTime,
        actionChoice,
        queuedAction.regenerateId,
        currentActionProcessedFoodConsumed,
        pendingQueuedActionProcessed,
        currentActionProcessedBaseInputItemsConsumedNum
      );

      // Copy existing pending
      PendingQueuedActionEquipmentState
        memory extendedPendingQueuedActionEquipmentState = pendingQueuedActionEquipmentStates[
          pendingQueuedActionEquipmentStates.length - 1
        ];

      if (prevConsumedEquipments.length != 0) {
        // Add to produced
        extendedPendingQueuedActionEquipmentState.producedItemTokenIds = new uint256[](prevConsumedEquipments.length);
        extendedPendingQueuedActionEquipmentState.producedAmounts = new uint256[](prevConsumedEquipments.length);
        for (uint256 j = 0; j < prevConsumedEquipments.length; ++j) {
          extendedPendingQueuedActionEquipmentState.producedItemTokenIds[j] = prevConsumedEquipments[j].itemTokenId;
          extendedPendingQueuedActionEquipmentState.producedAmounts[j] = prevConsumedEquipments[j].amount;
        }
      }
      if (prevProducedEquipment.itemTokenId != NONE) {
        // Add to consumed
        extendedPendingQueuedActionEquipmentState.consumedItemTokenIds = new uint256[](1);
        extendedPendingQueuedActionEquipmentState.consumedAmounts = new uint256[](1);
        extendedPendingQueuedActionEquipmentState.consumedItemTokenIds[0] = prevProducedEquipment.itemTokenId;
        extendedPendingQueuedActionEquipmentState.consumedAmounts[0] = prevProducedEquipment.amount;
      }

      Equipment[] memory processedConsumedEquipments;
      (
        processedConsumedEquipments,
        producedEquipment,
        xpElapsedTime,
        died,
        foodConsumed,
        baseInputItemsConsumedNum
      ) = _processConsumablesView(
        from,
        playerId,
        queuedAction,
        veryStartTime,
        elapsedTime + prevProcessedTime,
        combatStats,
        actionChoice,
        numSpawnedPerHour,
        pendingQueuedActionEquipmentStates,
        pendingQueuedActionProcessed
      );
      delete extendedPendingQueuedActionEquipmentState;

      // Get the difference
      consumedEquipments = new Equipment[](processedConsumedEquipments.length); // This should be greater than _consumedEquipments
      uint256 consumedEquipmentsLength;
      for (uint256 j = 0; j < processedConsumedEquipments.length; ++j) {
        // Check if it exists in _consumedEquipments and if so, subtract the amount
        bool nonZero = true;
        for (uint256 k = 0; k < prevConsumedEquipments.length; ++k) {
          if (processedConsumedEquipments[j].itemTokenId == prevConsumedEquipments[k].itemTokenId) {
            if (processedConsumedEquipments[j].amount >= prevConsumedEquipments[k].amount) {
              processedConsumedEquipments[j].amount = uint24(
                processedConsumedEquipments[j].amount - prevConsumedEquipments[k].amount
              );
            } else {
              processedConsumedEquipments[j].amount = 0;
            }
            nonZero = processedConsumedEquipments[j].amount != 0;
            break;
          }
        }
        if (nonZero) {
          consumedEquipments[consumedEquipmentsLength++] = processedConsumedEquipments[j];
        }
      }

      assembly ("memory-safe") {
        mstore(consumedEquipments, consumedEquipmentsLength)
      }

      // Do the same for outputEquipment, check if it exists and subtract amount
      if (producedEquipment.amount >= prevProducedEquipment.amount) {
        producedEquipment.amount = uint24(producedEquipment.amount - prevProducedEquipment.amount);
      } else {
        producedEquipment.amount = 0;
      }
      if (producedEquipment.amount == 0) {
        producedEquipment.itemTokenId = NONE;
      }

      if (xpElapsedTime >= prevXPElapsedTime) {
        // Maybe died
        xpElapsedTime = xpElapsedTime - prevXPElapsedTime;
      } else {
        xpElapsedTime = 0;
      }
      // These are scrolls/arrows, doesn't affect melee
      if (baseInputItemsConsumedNum >= currentActionProcessedBaseInputItemsConsumedNum) {
        baseInputItemsConsumedNum = uint16(baseInputItemsConsumedNum - currentActionProcessedBaseInputItemsConsumedNum);
      } else {
        baseInputItemsConsumedNum = 0;
      }

      if (foodConsumed >= currentActionProcessedFoodConsumed) {
        foodConsumed = uint16(foodConsumed - currentActionProcessedFoodConsumed);
      } else {
        // Could be lower if combat equation or items change later
        foodConsumed = 0;
      }
    } else {
      (
        consumedEquipments,
        producedEquipment,
        xpElapsedTime,
        died,
        foodConsumed,
        baseInputItemsConsumedNum
      ) = _processConsumablesView(
        from,
        playerId,
        queuedAction,
        veryStartTime,
        elapsedTime + prevProcessedTime,
        combatStats,
        actionChoice,
        numSpawnedPerHour,
        pendingQueuedActionEquipmentStates,
        pendingQueuedActionProcessed
      );
    }
  }

  function mintedPlayer(
    address from,
    uint256 playerId,
    Skill[2] calldata startSkills,
    uint256[] calldata startingItemTokenIds,
    uint256[] calldata startingAmounts
  ) external {
    uint256 length = uint256(startSkills[1] != Skill.NONE ? 2 : 1);
    uint32 xpEach = uint32(START_XP / length);

    bool fromBridge = startingItemTokenIds.length == 0;
    uint256 levelsGained;
    if (!fromBridge) {
      for (uint256 i; i < length; ++i) {
        Skill skill = startSkills[i];
        levelsGained += _updateXP(from, playerId, skill, xpEach, true);
      }
    }

    Player storage player = _players[playerId];
    player.totalXP = uint48(START_XP);
    player.totalLevel = uint16(START_LEVEL + levelsGained);
    player.skillBoosted1 = startSkills[0];
    player.skillBoosted2 = startSkills[1]; // Can be NONE

    // Mint starting equipment
    if (!fromBridge) {
      _itemNFT.mintBatch(from, startingItemTokenIds, startingAmounts);
    }
  }

  function _claimTotalXPThresholdRewards(
    address from,
    uint256 playerId,
    uint256 oldTotalXP,
    uint256 newTotalXP
  ) private {
    (uint256[] memory itemTokenIds, uint256[] memory amounts) = _claimableXPThresholdRewards(oldTotalXP, newTotalXP);
    if (itemTokenIds.length != 0) {
      _itemNFT.mintBatch(from, itemTokenIds, amounts);
      _activityPoints.rewardBlueTickets(
        ActivityType.players_evt_claimedxpthresholdrewards,
        from,
        _isEvolved(playerId),
        1
      );
      emit ClaimedXPThresholdRewards(from, playerId, itemTokenIds, amounts);
    }
  }

  function _modifyXPRelative(address from, uint256 playerId, Skill skill, uint56 gainedXP, bool skipEffects) private {
    require(_playerNFT.balanceOf(from, playerId) != 0, NotOwnerOfPlayer());

    // TODO: For now, could pass it in but requires a lot of changes
    PlayerInfo memory playerInfo = _playerNFT.getPlayerInfo(playerId);
    bool isNewOrBridgedPlayer = playerInfo.mintedTimestamp == uint40(block.timestamp);

    uint256 levelsGained = _updateXP(from, playerId, skill, gainedXP, isNewOrBridgedPlayer);
    uint48 newTotalXP = uint48(_players[playerId].totalXP + gainedXP);
    if (!skipEffects) {
      _claimTotalXPThresholdRewards(from, playerId, _players[playerId].totalXP, newTotalXP);
    }
    Player storage player = _players[playerId];
    player.totalXP = newTotalXP;
    player.totalLevel += uint16(levelsGained);

    // Update any in-progress actions. If things like passive actions give XP we want to make sure not to take it into account for any in-progress actions
    if (gainedXP > type(uint24).max) {
      if (player.currentActionProcessedSkill1 == skill) {
        player.currentActionProcessedXPGained1 += uint24(gainedXP);
      } else if (player.currentActionProcessedSkill2 == skill) {
        player.currentActionProcessedXPGained2 += uint24(gainedXP);
      } else if (player.currentActionProcessedSkill3 == skill) {
        player.currentActionProcessedXPGained3 += uint24(gainedXP);
      }
    }
  }

  function modifyXP(address from, uint256 playerId, Skill skill, uint56 xp, bool skipEffects) external {
    // Make sure it isn't less XP
    uint256 oldXP = PlayersLibrary.readXP(skill, _playerXP[playerId]);
    require(xp >= oldXP, TestInvalidXP());
    uint56 gainedXP = uint56(xp - oldXP);
    _modifyXPRelative(from, playerId, skill, gainedXP, skipEffects);
  }

  function buyBrushQuest(address to, uint256 playerId, uint256 questId, bool useExactETH) external payable {
    // This is a one off quest
    (uint256[] memory itemTokenIds /*uint256[] memory amounts*/, , Skill skillGained, uint32 xpGained) = _quests
      .getQuestCompletedRewards(QUEST_PURSE_STRINGS);

    uint256 oldXP = PlayersLibrary.readXP(skillGained, _playerXP[playerId]);
    bool skipEffects = true;
    _modifyXPRelative(to, playerId, skillGained, uint56(oldXP + xpGained), skipEffects);

    bool success = _quests.buyBrushQuest{value: msg.value}(msg.sender, to, playerId, questId, useExactETH);
    require(success, BuyBrushFailed());
    // Not handled currently
    require(itemTokenIds.length == 0, InvalidReward());
  }

  // Random rewards
  function getRandomRewards(
    uint256 playerId,
    uint40 startTimestamp,
    uint40 skillSentinelTime, // Can be skill end time or the current time that the action was actually processed
    uint256 numTickets,
    ActionRewards memory actionRewards,
    uint8 successPercent,
    uint8 fullAttireBonusRewardsPercent
  ) external view returns (uint256[] memory ids, uint256[] memory amounts, bool hasRandomWord) {
    ids = new uint256[](MAX_RANDOM_REWARDS_PER_ACTION);
    amounts = new uint256[](MAX_RANDOM_REWARDS_PER_ACTION);
    uint256 length;
    RandomReward[] memory randomRewards = _setupRandomRewards(actionRewards);

    if (randomRewards.length != 0) {
      hasRandomWord = _randomnessBeacon.hasRandomWord(skillSentinelTime);
      if (hasRandomWord) {
        uint256 numiations = Math.min(MAX_UNIQUE_TICKETS, numTickets);

        bytes memory randomBytes = _randomnessBeacon.getRandomBytes(
          numiations,
          startTimestamp,
          skillSentinelTime,
          playerId
        );
        uint256 multiplier = numTickets / MAX_UNIQUE_TICKETS;

        // Cache some values for later
        uint16[] memory extraChances = new uint16[](MAX_RANDOM_REWARDS_PER_ACTION);
        uint16[] memory extraChancesExcess = new uint16[](MAX_RANDOM_REWARDS_PER_ACTION);
        uint256[] memory mintMultipliers = new uint256[](MAX_RANDOM_REWARDS_PER_ACTION);
        uint256[] memory mintMultipliersExcess = new uint256[](MAX_RANDOM_REWARDS_PER_ACTION);
        uint256 randomRewardsLength = randomRewards.length;
        for (uint256 i; i < randomRewardsLength; ++i) {
          RandomReward memory randomReward = randomRewards[i];
          mintMultipliers[i] = 1;
          mintMultipliersExcess[i] = 1;
          if (numTickets > MAX_UNIQUE_TICKETS) {
            if (randomReward.chance <= RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF) {
              // Rare item, increase chance if there aren't enough unique tickets
              extraChances[i] = uint16(randomReward.chance * multiplier);
              extraChancesExcess[i] = uint16(randomReward.chance * (multiplier + 1));
            } else {
              mintMultipliers[i] = multiplier;
              mintMultipliersExcess[i] = multiplier + 1;
            }
          }
        }

        uint256 remainder = numTickets % MAX_UNIQUE_TICKETS;
        // The first set has an increased mint multiplier as the tickets spill over
        length = _randomRewardsLoop(
          0,
          remainder,
          extraChancesExcess,
          mintMultipliersExcess,
          ids,
          amounts,
          randomRewards,
          successPercent,
          fullAttireBonusRewardsPercent,
          randomBytes
        );
        // The next set uses the base multiplier
        uint256 otherLength = _randomRewardsLoop(
          remainder,
          numiations,
          extraChances,
          mintMultipliers,
          ids,
          amounts,
          randomRewards,
          successPercent,
          fullAttireBonusRewardsPercent,
          randomBytes
        );
        length = Math.max(length, otherLength);
      }
    }
    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }
  }

  function getRandomRewardChanceMultiplierCutoff() external pure returns (uint256) {
    return RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF;
  }

  function _setupRandomRewards(
    ActionRewards memory rewards
  ) private pure returns (RandomReward[] memory randomRewards) {
    randomRewards = new RandomReward[](4);
    uint256 randomRewardLength;
    if (rewards.randomRewardTokenId1 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        rewards.randomRewardTokenId1,
        rewards.randomRewardChance1,
        rewards.randomRewardAmount1
      );
      randomRewardLength++;
    }
    if (rewards.randomRewardTokenId2 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        rewards.randomRewardTokenId2,
        rewards.randomRewardChance2,
        rewards.randomRewardAmount2
      );
      randomRewardLength++;
    }
    if (rewards.randomRewardTokenId3 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        rewards.randomRewardTokenId3,
        rewards.randomRewardChance3,
        rewards.randomRewardAmount3
      );
      randomRewardLength++;
    }
    if (rewards.randomRewardTokenId4 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        rewards.randomRewardTokenId4,
        rewards.randomRewardChance4,
        rewards.randomRewardAmount4
      );
      randomRewardLength++;
    }

    assembly ("memory-safe") {
      mstore(randomRewards, randomRewardLength)
    }
  }

  function _getSlice(bytes memory b, uint256 index) private pure returns (uint16) {
    uint256 key = index * 2;
    return uint16(b[key] | (bytes2(b[key + 1]) >> 8));
  }

  function _randomRewardsLoop(
    uint256 start,
    uint256 end,
    uint16[] memory extraChances,
    uint256[] memory mintMultipliers,
    uint256[] memory ids,
    uint256[] memory amounts,
    RandomReward[] memory randomRewards,
    uint8 successPercent,
    uint8 fullAttireBonusRewardsPercent,
    bytes memory randomBytes
  ) private pure returns (uint256 length) {
    uint256 randomRewardsLength = randomRewards.length;
    for (uint256 i = start; i < end; ++i) {
      uint256 operation = (uint256(_getSlice(randomBytes, i)) * 100) / successPercent;

      // If there is above MAX_UNIQUE_TICKETS tickets we need to mint more if a ticket is hit unless it
      // is a rare item in which case we just increase the change that it can get get

      // The random component is out of 65535, so we can take 2 bytes at a time from the total bytes array
      {
        uint256 extraChance = (operation * fullAttireBonusRewardsPercent) / 100;
        if (operation > extraChance) {
          operation -= extraChance;
        } else {
          operation = 1;
        }
      }
      uint16 rand = uint16(Math.min(type(uint16).max, operation));

      for (uint256 j; j < randomRewardsLength; ++j) {
        RandomReward memory randomReward = randomRewards[j];

        uint16 updatedRand = rand;
        uint16 extraChance = extraChances[j];
        if (updatedRand > extraChance) {
          updatedRand -= extraChance;
        } else {
          updatedRand = 1;
        }
        if (updatedRand <= randomReward.chance) {
          // This random reward's chance was hit, so add it to the hits
          ids[j] = randomReward.itemTokenId;
          amounts[j] += randomReward.amount * mintMultipliers[j];
          length = Math.max(length, j + 1);
        } else {
          // A common one isn't found so a rarer one won't be.
          break;
        }
      }
    }
  }
}
