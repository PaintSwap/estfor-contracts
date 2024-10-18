// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {PlayersImplBase} from "./PlayersImplBase.sol";
import {PlayersBase} from "./PlayersBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {World} from "../World.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";
import {CombatStyleLibrary} from "../libraries/CombatStyleLibrary.sol";
import {IPlayersMiscDelegate, IPlayersMiscDelegateView} from "../interfaces/IPlayersDelegates.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplMisc is PlayersImplBase, PlayersBase, IPlayersMiscDelegate, IPlayersMiscDelegateView {
  using UnsafeMath for U256;
  using UnsafeMath for uint8;
  using UnsafeMath for uint16;
  using UnsafeMath for uint24;
  using UnsafeMath for uint32;
  using UnsafeMath for uint40;
  using UnsafeMath for uint128;
  using UnsafeMath for uint256;
  using CombatStyleLibrary for uint8;
  using CombatStyleLibrary for CombatStyle;

  constructor() {
    _checkStartSlot();
  }

  // === XP Threshold rewards ===
  function claimableXPThresholdRewardsImpl(
    uint256 _oldTotalXP,
    uint256 _newTotalXP
  ) external view returns (uint256[] memory itemTokenIds, uint256[] memory amounts) {
    uint16 prevIndex = _findBaseXPThreshold(_oldTotalXP);
    uint16 nextIndex = _findBaseXPThreshold(_newTotalXP);

    uint256 diff = nextIndex - prevIndex;
    itemTokenIds = new uint256[](diff);
    amounts = new uint256[](diff);
    U256 length;
    for (U256 iter; iter.lt(diff); iter = iter.inc()) {
      uint256 i = iter.asUint256();
      uint32 xpThreshold = _getXPReward(prevIndex.inc().add(i));
      Equipment[] memory items = xpRewardThresholds[xpThreshold];
      if (items.length != 0) {
        // TODO: Currently assumes there is only 1 item per threshold
        uint256 l = length.asUint256();
        itemTokenIds[l] = items[0].itemTokenId;
        amounts[l] = items[0].amount;
        length = length.inc();
      }
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, length)
      mstore(amounts, length)
    }
  }

  function _checkXPThresholdRewards(XPThresholdReward calldata _xpThresholdReward) private pure {
    U256 bounds = _xpThresholdReward.rewards.length.asU256();
    for (U256 jIter; jIter < bounds; jIter = jIter.inc()) {
      uint256 j = jIter.asUint256();
      if (_xpThresholdReward.rewards[j].itemTokenId == NONE) {
        revert InvalidItemTokenId();
      }
      if (_xpThresholdReward.rewards[j].amount == 0) {
        revert InvalidAmount();
      }
    }
  }

  function addXPThresholdRewards(XPThresholdReward[] calldata _xpThresholdRewards) external {
    U256 iter = _xpThresholdRewards.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      XPThresholdReward calldata xpThresholdReward = _xpThresholdRewards[iter.asUint256()];

      // Check that it is part of the hexBytes
      uint16 index = _findBaseXPThreshold(xpThresholdReward.xpThreshold);
      uint32 xpThreshold = _getXPReward(index);
      if (xpThresholdReward.xpThreshold != xpThreshold) {
        revert XPThresholdNotFound();
      }

      if (xpRewardThresholds[xpThresholdReward.xpThreshold].length != 0) {
        revert XPThresholdAlreadyExists();
      }
      _checkXPThresholdRewards(xpThresholdReward);

      xpRewardThresholds[xpThresholdReward.xpThreshold] = xpThresholdReward.rewards;
      emit AdminAddThresholdReward(xpThresholdReward);
    }
  }

  function editXPThresholdRewards(XPThresholdReward[] calldata _xpThresholdRewards) external {
    U256 iter = _xpThresholdRewards.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      XPThresholdReward calldata xpThresholdReward = _xpThresholdRewards[iter.asUint256()];
      if (xpRewardThresholds[xpThresholdReward.xpThreshold].length == 0) {
        revert XPThresholdDoesNotExist();
      }
      _checkXPThresholdRewards(xpThresholdReward);
      xpRewardThresholds[xpThresholdReward.xpThreshold] = xpThresholdReward.rewards;
      emit AdminEditThresholdReward(xpThresholdReward);
    }
  }

  // Index not level, add one after (check for > max)
  function _findBaseXPThreshold(uint256 xp) private pure returns (uint16) {
    U256 low;
    U256 high = xpRewardBytes.length.asU256().div(4);

    while (low < high) {
      U256 mid = (low + high).div(2);

      // Note that mid will always be strictly less than high (i.e. it will be a valid array index)
      // Math.average rounds down (it does integer division with truncation).
      if (_getXPReward(mid.asUint256()) > xp) {
        high = mid;
      } else {
        low = mid.inc();
      }
    }

    if (low.neq(0)) {
      return low.dec().asUint16();
    } else {
      return 0;
    }
  }

  function _getXPReward(uint256 _index) private pure returns (uint32) {
    U256 index = _index.asU256().mul(4);
    return
      uint32(
        xpRewardBytes[index.asUint256()] |
          (bytes4(xpRewardBytes[index.add(1).asUint256()]) >> 8) |
          (bytes4(xpRewardBytes[index.add(2).asUint256()]) >> 16) |
          (bytes4(xpRewardBytes[index.add(3).asUint256()]) >> 24)
      );
  }

  // === End XP Threshold rewards ===

  function dailyRewardsViewImpl(
    address _from,
    uint256 playerId
  ) public view returns (uint256[] memory itemTokenIds, uint256[] memory amounts, bytes32 dailyRewardMask) {
    uint256 streakStart = ((block.timestamp.sub(4 days)).div(1 weeks)).mul(1 weeks).add(4 days);
    bool hasRandomWordLastSunday = world.lastRandomWordsUpdatedTime() >= streakStart;
    if (hasRandomWordLastSunday) {
      uint256 streakStartIndex = streakStart.div(1 weeks);
      bytes32 mask = dailyRewardMasks[playerId];
      uint16 lastRewardStartIndex = uint16(uint256(mask));
      if (lastRewardStartIndex < streakStartIndex) {
        mask = bytes32(streakStartIndex); // Reset the mask
      }

      uint256 maskIndex = ((block.timestamp.div(1 days)).mul(1 days).sub(streakStart)).div(1 days);

      // Claim daily/weekly reward
      if (mask[maskIndex] == 0 && dailyRewardsEnabled) {
        uint256 totalXP = _players[playerId].totalXP;
        uint256 playerTier;

        // Work out the tier
        if (totalXP >= TIER_5_DAILY_REWARD_START_XP) {
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

        (uint256 itemTokenId, uint256 amount) = world.getDailyReward(playerTier, playerId);
        // Can only get the daily reward on an account once per day regardless of how many heros claim
        uint256 lastWalletTimestamp = walletDailyInfo[_from].lastDailyRewardClaimedTimestamp;
        if (itemTokenId != NONE && lastWalletTimestamp < (block.timestamp / 1 days) * 1 days) {
          // Add clan member boost to daily reward (if applicable)
          uint256 clanTierMembership = clans.getClanTierMembership(playerId);
          amount += (amount * clanTierMembership) / 10; // +10% extra for each clan tier

          dailyRewardMask = mask | ((bytes32(hex"ff") >> (maskIndex * 8)));
          bool canClaimWeeklyRewards = uint256(dailyRewardMask >> (25 * 8)) == 2 ** (7 * 8) - 1;
          uint256 length = canClaimWeeklyRewards ? 2 : 1;
          itemTokenIds = new uint256[](length);
          amounts = new uint256[](length);
          itemTokenIds[0] = itemTokenId;
          amounts[0] = amount;

          // Claim weekly rewards (this shifts the left-most 7 day streaks to the very right and checks all bits are set)
          if (canClaimWeeklyRewards) {
            (itemTokenIds[1], amounts[1]) = world.getWeeklyReward(playerTier, playerId);
          }
        }
      }
    }
  }

  function dailyClaimedRewardsImpl(uint256 playerId) external view returns (bool[7] memory claimed) {
    uint256 streakStart = ((block.timestamp.sub(4 days)).div(1 weeks)).mul(1 weeks).add(4 days);
    uint256 streakStartIndex = streakStart.div(1 weeks);
    bytes32 mask = dailyRewardMasks[playerId];
    uint16 lastRewardStartIndex = uint16(uint256(mask));
    if (lastRewardStartIndex < streakStartIndex) {
      mask = bytes32(streakStartIndex);
    }

    for (U256 iter; iter.lt(7); iter = iter.inc()) {
      uint256 i = iter.asUint256();
      claimed[i] = mask[i] != 0;
    }
  }

  function handleDailyRewards(address _from, uint256 playerId) external {
    (
      uint256[] memory rewardItemTokenIds,
      uint256[] memory rewardAmounts,
      bytes32 dailyRewardMask
    ) = dailyRewardsViewImpl(_from, playerId);
    if (uint256(dailyRewardMask) != 0) {
      dailyRewardMasks[playerId] = dailyRewardMask;
    }
    if (rewardAmounts.length != 0) {
      itemNFT.mint(_from, rewardItemTokenIds[0], rewardAmounts[0]);
      emit DailyReward(_from, playerId, rewardItemTokenIds[0], rewardAmounts[0]);

      walletDailyInfo[_from].lastDailyRewardClaimedTimestamp = uint40(block.timestamp);
    }

    if (rewardAmounts.length > 1) {
      itemNFT.mint(_from, rewardItemTokenIds[1], rewardAmounts[1]);
      emit WeeklyReward(_from, playerId, rewardItemTokenIds[1], rewardAmounts[1]);
    }
  }

  function _getConsumablesEquipment(
    uint256 playerId,
    uint256 _currentActionStartTime,
    uint256 _xpElapsedTime,
    ActionChoice calldata _actionChoice,
    uint16 regenerateId,
    uint16 _foodConsumed,
    PendingQueuedActionProcessed calldata _pendingQueuedActionProcessed,
    uint16 baseInputItemsConsumedNum
  ) private view returns (Equipment[] memory consumedEquipment, Equipment memory producedEquipment) {
    consumedEquipment = new Equipment[](MAX_CONSUMED_PER_ACTION);
    uint256 consumedEquipmentLength;
    if (regenerateId != NONE && _foodConsumed != 0) {
      consumedEquipment[consumedEquipmentLength] = Equipment(regenerateId, _foodConsumed);
      consumedEquipmentLength = consumedEquipmentLength.inc();
    }

    bool useSecondInputTokens = uint8(
      _actionChoice.packedData >> ACTION_CHOICE_USE_ALTERNATE_INPUTS_SECOND_STORAGE_SLOT
    ) &
      1 ==
      1;

    if (baseInputItemsConsumedNum != 0) {
      if (_actionChoice.inputTokenId1 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId1,
          baseInputItemsConsumedNum *
            (useSecondInputTokens ? _actionChoice.newInputAmount1 : _actionChoice.inputAmount1)
        );
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
      if (_actionChoice.inputTokenId2 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId2,
          baseInputItemsConsumedNum *
            (useSecondInputTokens ? _actionChoice.newInputAmount2 : _actionChoice.inputAmount2)
        );
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
      if (_actionChoice.inputTokenId3 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId3,
          baseInputItemsConsumedNum *
            (useSecondInputTokens ? _actionChoice.newInputAmount3 : _actionChoice.inputAmount3)
        );
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
    }

    if (_actionChoice.outputTokenId != 0) {
      uint8 successPercent = 100;
      // Some might be burnt when cooking for instance
      if (_actionChoice.successPercent != 100) {
        uint256 minLevel = PlayersLibrary.getLevel(_actionChoice.minXP);
        uint256 skillLevel = PlayersLibrary.getLevel(
          PlayersLibrary.getAbsoluteActionStartXP(
            uint8(_actionChoice.skill),
            _pendingQueuedActionProcessed,
            _playerXP[playerId]
          )
        );
        uint256 extraBoost = skillLevel - minLevel;

        successPercent = uint8(Math.min(MAX_SUCCESS_PERCENT_CHANCE_, _actionChoice.successPercent + extraBoost));
      }

      uint24 numProduced = uint24(
        (uint256(baseInputItemsConsumedNum) * _actionChoice.outputAmount * successPercent) / 100
      );

      if (_xpElapsedTime != 0) {
        // Check for any gathering boosts
        PlayerBoostInfo storage activeBoost = _activeBoosts[playerId];
        uint256 boostedTime = PlayersLibrary.getBoostedTime(
          _currentActionStartTime,
          _xpElapsedTime,
          activeBoost.startTime,
          activeBoost.duration
        );
        if (boostedTime != 0 && activeBoost.boostType == BoostType.GATHERING) {
          numProduced += uint24((boostedTime * numProduced * activeBoost.value) / (_xpElapsedTime * 100));
        }
      }

      if (numProduced != 0) {
        producedEquipment = Equipment(_actionChoice.outputTokenId, numProduced);
      }
    }

    assembly ("memory-safe") {
      mstore(consumedEquipment, consumedEquipmentLength)
    }
  }

  function _processConsumablesView(
    address _from,
    uint256 playerId,
    QueuedAction calldata _queuedAction,
    uint256 _currentActionStartTime,
    uint256 _elapsedTime,
    CombatStats calldata _combatStats,
    ActionChoice calldata _actionChoice,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates,
    PendingQueuedActionProcessed calldata _pendingQueuedActionProcessed
  )
    private
    view
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory producedEquipment,
      uint256 xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
    )
  {
    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    bool isCombat = _queuedAction.combatStyle.asCombatStyle().isCombat();
    if (isCombat) {
      // Fetch the requirements for it
      CombatStats memory enemyCombatStats = world.getCombatStats(_queuedAction.actionId);

      uint256 combatElapsedTime;
      (xpElapsedTime, combatElapsedTime, baseInputItemsConsumedNum, foodConsumed, died) = PlayersLibrary
        .getCombatAdjustedElapsedTimes(
          _from,
          address(itemNFT),
          address(world),
          _elapsedTime,
          _actionChoice,
          _queuedAction.regenerateId,
          _queuedAction,
          _combatStats,
          enemyCombatStats,
          alphaCombat,
          betaCombat,
          _alphaCombatHealing,
          _pendingQueuedActionEquipmentStates
        );
    } else {
      (xpElapsedTime, baseInputItemsConsumedNum) = PlayersLibrary.getNonCombatAdjustedElapsedTime(
        _from,
        address(itemNFT),
        _elapsedTime,
        _actionChoice,
        _pendingQueuedActionEquipmentStates
      );
    }

    (consumedEquipment, producedEquipment) = _getConsumablesEquipment(
      playerId,
      _currentActionStartTime,
      xpElapsedTime,
      _actionChoice,
      _queuedAction.regenerateId,
      foodConsumed,
      _pendingQueuedActionProcessed,
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
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates, // Memory as it is modified
    PendingQueuedActionProcessed calldata _pendingQueuedActionProcessed
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
    uint256 veryStartTime = startTime.sub(prevProcessedTime);
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
        _pendingQueuedActionProcessed,
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

      Equipment[] memory __consumedEquipments;
      (
        __consumedEquipments,
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
        pendingQueuedActionEquipmentStates,
        _pendingQueuedActionProcessed
      );
      delete extendedPendingQueuedActionEquipmentState;

      // Get the difference
      consumedEquipments = new Equipment[](__consumedEquipments.length); // This should be greater than _consumedEquipments
      uint256 consumedEquipmentsLength;
      for (uint256 j = 0; j < __consumedEquipments.length; ++j) {
        // Check if it exists in _consumedEquipments and if so, subtract the amount
        bool nonZero = true;
        for (uint256 k = 0; k < prevConsumedEquipments.length; ++k) {
          if (__consumedEquipments[j].itemTokenId == prevConsumedEquipments[k].itemTokenId) {
            if (__consumedEquipments[j].amount >= prevConsumedEquipments[k].amount) {
              __consumedEquipments[j].amount = uint24(
                __consumedEquipments[j].amount.sub(prevConsumedEquipments[k].amount)
              );
            } else {
              __consumedEquipments[j].amount = 0;
            }
            nonZero = __consumedEquipments[j].amount != 0;
            break;
          }
        }
        if (nonZero) {
          consumedEquipments[consumedEquipmentsLength++] = __consumedEquipments[j];
        }
      }

      assembly ("memory-safe") {
        mstore(consumedEquipments, consumedEquipmentsLength)
      }

      // Do the same for outputEquipment, check if it exists and subtract amount
      if (producedEquipment.amount >= prevProducedEquipment.amount) {
        producedEquipment.amount = uint24(producedEquipment.amount.sub(prevProducedEquipment.amount));
      } else {
        producedEquipment.amount = 0;
      }
      if (producedEquipment.amount == 0) {
        producedEquipment.itemTokenId = NONE;
      }

      if (xpElapsedTime >= prevXPElapsedTime) {
        // Maybe died
        xpElapsedTime = xpElapsedTime.sub(prevXPElapsedTime);
      } else {
        xpElapsedTime = 0;
      }
      // These are scrolls/arrows, doesn't affect melee
      if (baseInputItemsConsumedNum >= currentActionProcessedBaseInputItemsConsumedNum) {
        baseInputItemsConsumedNum = uint16(
          baseInputItemsConsumedNum.sub(currentActionProcessedBaseInputItemsConsumedNum)
        );
      } else {
        baseInputItemsConsumedNum = 0;
      }

      if (foodConsumed >= currentActionProcessedFoodConsumed) {
        foodConsumed = uint16(foodConsumed.sub(currentActionProcessedFoodConsumed));
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
        pendingQueuedActionEquipmentStates,
        _pendingQueuedActionProcessed
      );
    }
  }

  function mintedPlayer(
    address _from,
    uint256 playerId,
    Skill[2] calldata _startSkills,
    uint256[] calldata _startingItemTokenIds,
    uint256[] calldata _startingAmounts
  ) external {
    Player storage player = _players[playerId];
    player.totalXP = uint56(START_XP_);

    U256 length = uint256(_startSkills[1] != Skill.NONE ? 2 : 1).asU256();
    uint32 xpEach = uint32(START_XP_ / length.asUint256());

    for (U256 iter; iter < length; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      Skill skill = _startSkills[i];
      _updateXP(_from, playerId, skill, xpEach);
    }

    player.skillBoosted1 = _startSkills[0];
    player.skillBoosted2 = _startSkills[1]; // Can be NONE

    // Mint starting equipment
    itemNFT.mintBatch(_from, _startingItemTokenIds, _startingAmounts);
  }

  function buyBrushQuest(address _to, uint256 playerId, uint256 questId, bool _useExactETH) external payable {
    // This is a one off quest
    (uint256[] memory itemTokenIds /*uint256[] memory amounts*/, , Skill skillGained, uint32 xpGained) = quests
      .getQuestCompletedRewards(QUEST_PURSE_STRINGS);
    // Must update before the call to buyBrushQuest so the indexer can remove the in-progress XP update
    _updateXP(msg.sender, playerId, skillGained, xpGained);

    bool success = quests.buyBrushQuest{value: msg.value}(msg.sender, _to, playerId, questId, _useExactETH);
    if (!success) {
      revert BuyBrushFailed();
    } else {
      if (itemTokenIds.length != 0) {
        // Not handled currently
        revert InvalidReward();
      }
    }
  }

  // Random rewards
  function getRandomRewards(
    uint256 playerId,
    uint40 _startTimestamp,
    uint40 _skillSentinelTime, // Can be skill end time or the current time that the action was actually processed
    uint256 _numTickets,
    ActionRewards memory _actionRewards,
    uint8 successPercent,
    uint8 _fullAttireBonusRewardsPercent
  ) external view returns (uint256[] memory ids, uint256[] memory amounts, bool hasRandomWord) {
    ids = new uint256[](MAX_RANDOM_REWARDS_PER_ACTION);
    amounts = new uint256[](MAX_RANDOM_REWARDS_PER_ACTION);
    uint256 length;
    RandomReward[] memory randomRewards = _setupRandomRewards(_actionRewards);

    if (randomRewards.length != 0) {
      hasRandomWord = world.hasRandomWord(_skillSentinelTime);
      if (hasRandomWord) {
        uint256 numIterations = Math.min(MAX_UNIQUE_TICKETS, _numTickets);

        bytes memory randomBytes = world.getRandomBytes(numIterations, _startTimestamp, _skillSentinelTime, playerId);
        uint256 multiplier = _numTickets / MAX_UNIQUE_TICKETS;

        // Cache some values for later
        uint16[] memory extraChances = new uint16[](MAX_RANDOM_REWARDS_PER_ACTION);
        uint16[] memory extraChancesExcess = new uint16[](MAX_RANDOM_REWARDS_PER_ACTION);
        uint256[] memory mintMultipliers = new uint256[](MAX_RANDOM_REWARDS_PER_ACTION);
        uint256[] memory mintMultipliersExcess = new uint256[](MAX_RANDOM_REWARDS_PER_ACTION);
        U256 randomRewardsLength = randomRewards.length.asU256();
        for (U256 iterJ; iterJ < randomRewardsLength; iterJ = iterJ.inc()) {
          uint256 j = iterJ.asUint256();
          RandomReward memory randomReward = randomRewards[j];
          mintMultipliers[j] = 1;
          mintMultipliersExcess[j] = 1;
          if (_numTickets > MAX_UNIQUE_TICKETS) {
            if (randomReward.chance <= RANDOM_REWARD_CHANCE_MULTIPLIER_CUTOFF_) {
              // Rare item, increase chance if there aren't enough unique tickets
              extraChances[j] = uint16(randomReward.chance * multiplier);
              extraChancesExcess[j] = uint16(randomReward.chance * (multiplier + 1));
            } else {
              mintMultipliers[j] = multiplier;
              mintMultipliersExcess[j] = multiplier + 1;
            }
          }
        }

        uint256 remainder = _numTickets % MAX_UNIQUE_TICKETS;
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
          _fullAttireBonusRewardsPercent,
          randomBytes
        );
        // The next set uses the base multiplier
        uint256 otherLength = _randomRewardsLoop(
          remainder,
          numIterations,
          extraChances,
          mintMultipliers,
          ids,
          amounts,
          randomRewards,
          successPercent,
          _fullAttireBonusRewardsPercent,
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

  function _setupRandomRewards(
    ActionRewards memory _rewards
  ) private pure returns (RandomReward[] memory randomRewards) {
    randomRewards = new RandomReward[](4);
    uint256 randomRewardLength;
    if (_rewards.randomRewardTokenId1 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        _rewards.randomRewardTokenId1,
        _rewards.randomRewardChance1,
        _rewards.randomRewardAmount1
      );
      randomRewardLength = randomRewardLength.inc();
    }
    if (_rewards.randomRewardTokenId2 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        _rewards.randomRewardTokenId2,
        _rewards.randomRewardChance2,
        _rewards.randomRewardAmount2
      );
      randomRewardLength = randomRewardLength.inc();
    }
    if (_rewards.randomRewardTokenId3 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        _rewards.randomRewardTokenId3,
        _rewards.randomRewardChance3,
        _rewards.randomRewardAmount3
      );
      randomRewardLength = randomRewardLength.inc();
    }
    if (_rewards.randomRewardTokenId4 != 0) {
      randomRewards[randomRewardLength] = RandomReward(
        _rewards.randomRewardTokenId4,
        _rewards.randomRewardChance4,
        _rewards.randomRewardAmount4
      );
      randomRewardLength = randomRewardLength.inc();
    }

    assembly ("memory-safe") {
      mstore(randomRewards, randomRewardLength)
    }
  }

  function _getSlice(bytes memory _b, uint256 _index) private pure returns (uint16) {
    uint256 index = _index.mul(2);
    return uint16(_b[index] | (bytes2(_b[index.inc()]) >> 8));
  }

  function _randomRewardsLoop(
    uint256 _start,
    uint256 _end,
    uint16[] memory _extraChances,
    uint256[] memory _mintMultipliers,
    uint256[] memory _ids,
    uint256[] memory _amounts,
    RandomReward[] memory _randomRewards,
    uint8 successPercent,
    uint8 _fullAttireBonusRewardsPercent,
    bytes memory _randomBytes
  ) private pure returns (uint256 length) {
    U256 randomRewardsLength = _randomRewards.length.asU256();
    for (U256 iter = _start.asU256(); iter.lt(_end); iter = iter.inc()) {
      uint256 i = iter.asUint256();
      uint256 operation = (uint256(_getSlice(_randomBytes, i)) * 100) / successPercent;

      // If there is above MAX_UNIQUE_TICKETS tickets we need to mint more if a ticket is hit unless it
      // is a rare item in which case we just increase the change that it can get get

      // The random component is out of 65535, so we can take 2 bytes at a time from the total bytes array
      {
        uint256 extraChance = (operation * _fullAttireBonusRewardsPercent) / 100;
        if (operation > extraChance) {
          operation -= extraChance;
        } else {
          operation = 1;
        }
      }
      uint16 rand = uint16(Math.min(type(uint16).max, operation));

      for (U256 iterJ; iterJ < randomRewardsLength; iterJ = iterJ.inc()) {
        uint256 j = iterJ.asUint256();
        RandomReward memory randomReward = _randomRewards[j];

        uint16 updatedRand = rand;
        uint16 extraChance = _extraChances[j];
        if (updatedRand > extraChance) {
          updatedRand -= extraChance;
        } else {
          updatedRand = 1;
        }
        if (updatedRand <= randomReward.chance) {
          // This random reward's chance was hit, so add it to the hits
          _ids[j] = randomReward.itemTokenId;
          _amounts[j] += randomReward.amount * _mintMultipliers[j];
          length = Math.max(length, j + 1);
        } else {
          // A common one isn't found so a rarer one won't be.
          break;
        }
      }
    }
  }
}
