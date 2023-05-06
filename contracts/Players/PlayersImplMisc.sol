// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {PlayersUpgradeableImplDummyBase, PlayersBase} from "./PlayersImplBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {PlayerNFT} from "../PlayerNFT.sol";
import {World} from "../World.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Quests} from "../Quests.sol";
import {Clans} from "../Clans/Clans.sol";

/* solhint-disable no-global-import */
import "../globals/players.sol";
import "../globals/items.sol";
import "../globals/actions.sol";
import "../globals/rewards.sol";

/* solhint-enable no-global-import */

contract PlayersImplMisc is
  PlayersUpgradeableImplDummyBase,
  PlayersBase,
  IPlayersMiscDelegate,
  IPlayersMiscDelegateView
{
  using UnsafeMath for U256;
  using UnsafeMath for uint8;
  using UnsafeMath for uint16;
  using UnsafeMath for uint32;
  using UnsafeMath for uint40;
  using UnsafeMath for uint128;
  using UnsafeMath for uint256;

  error CannotCallInitializerOnImplementation();

  constructor() {
    _checkStartSlot();

    // Effectively the same as __disableInitializer
    uint max = type(uint8).max;
    assembly ("memory-safe") {
      // Set initialized
      sstore(0, max)
    }
  }

  // === XP Threshold rewards ===
  function claimableXPThresholdRewardsImpl(
    uint _oldTotalXP,
    uint _newTotalXP
  ) external view returns (uint[] memory itemTokenIds, uint[] memory amounts) {
    uint16 prevIndex = _findBaseXPThreshold(_oldTotalXP);
    uint16 nextIndex = _findBaseXPThreshold(_newTotalXP);

    uint diff = nextIndex - prevIndex;
    itemTokenIds = new uint[](diff);
    amounts = new uint[](diff);
    U256 length;
    for (U256 iter; iter.lt(diff); iter = iter.inc()) {
      uint i = iter.asUint256();
      uint32 xpThreshold = _getXPReward(prevIndex.inc().add(i));
      Equipment[] memory items = xpRewardThresholds[xpThreshold];
      if (items.length != 0) {
        // TODO: Currently assumes there is only 1 item per threshold
        uint l = length.asUint256();
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

      U256 bounds = xpThresholdReward.rewards.length.asU256();
      for (U256 jIter; jIter < bounds; jIter = jIter.inc()) {
        uint j = jIter.asUint256();
        if (xpThresholdReward.rewards[j].itemTokenId == NONE) {
          revert InvalidItemTokenId();
        }
        if (xpThresholdReward.rewards[j].amount == 0) {
          revert InvalidAmount();
        }
      }

      xpRewardThresholds[xpThresholdReward.xpThreshold] = xpThresholdReward.rewards;
      emit AdminAddThresholdReward(xpThresholdReward);
    }
  }

  // Index not level, add one after (check for > max)
  function _findBaseXPThreshold(uint256 _xp) private pure returns (uint16) {
    U256 low;
    U256 high = xpRewardBytes.length.asU256().div(4);

    while (low < high) {
      U256 mid = (low + high).div(2);

      // Note that mid will always be strictly less than high (i.e. it will be a valid array index)
      // Math.average rounds down (it does integer division with truncation).
      if (_getXPReward(mid.asUint256()) > _xp) {
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

  // === XP Threshold rewards ===

  function dailyRewardsViewImpl(
    uint _playerId
  ) public view returns (uint[] memory itemTokenIds, uint[] memory amounts, bytes32 dailyRewardMask) {
    uint streakStart = ((block.timestamp.sub(4 days)).div(1 weeks)).mul(1 weeks).add(4 days);
    uint streakStartIndex = streakStart.div(1 weeks);
    bytes32 mask = dailyRewardMasks[_playerId];
    uint16 lastRewardStartIndex = uint16(uint256(mask));
    if (lastRewardStartIndex < streakStartIndex) {
      mask = bytes32(streakStartIndex); // Reset the mask
    }

    uint maskIndex = ((block.timestamp.div(1 days)).mul(1 days).sub(streakStart)).div(1 days);

    // Claim daily reward
    if (mask[maskIndex] == 0 && dailyRewardsEnabled) {
      (uint itemTokenId, uint amount) = world.getDailyReward();
      if (itemTokenId != NONE) {
        // Add clan member boost to daily reward (if applicable)
        uint clanTierMembership = clans.getClanTierMembership(_playerId);
        amount += (amount * clanTierMembership) / 10; // +10% extra for each clan tier

        dailyRewardMask = mask | ((bytes32(hex"ff") >> (maskIndex * 8)));
        bool canClaimWeeklyRewards = uint(dailyRewardMask >> (25 * 8)) == 2 ** (7 * 8) - 1;
        uint length = canClaimWeeklyRewards ? 2 : 1;
        itemTokenIds = new uint[](length);
        amounts = new uint[](length);
        itemTokenIds[0] = itemTokenId;
        amounts[0] = amount;

        // Claim weekly rewards (this shifts the left-most 7 day streaks to the very right and checks all bits are set)
        if (canClaimWeeklyRewards) {
          (itemTokenIds[1], amounts[1]) = world.getWeeklyReward();
        }
      }
    }
  }

  function dailyClaimedRewardsImpl(uint _playerId) external view returns (bool[7] memory claimed) {
    uint streakStart = ((block.timestamp.sub(4 days)).div(1 weeks)).mul(1 weeks).add(4 days);
    uint streakStartIndex = streakStart.div(1 weeks);
    bytes32 mask = dailyRewardMasks[_playerId];
    uint16 lastRewardStartIndex = uint16(uint256(mask));
    if (lastRewardStartIndex < streakStartIndex) {
      mask = bytes32(streakStartIndex);
    }

    for (U256 iter; iter.lt(7); iter = iter.inc()) {
      uint i = iter.asUint256();
      claimed[i] = mask[i] != 0;
    }
  }

  function handleDailyRewards(address _from, uint _playerId) external {
    (uint[] memory rewardItemTokenIds, uint[] memory rewardAmounts, bytes32 dailyRewardMask) = dailyRewardsViewImpl(
      _playerId
    );
    if (uint(dailyRewardMask) != 0) {
      dailyRewardMasks[_playerId] = dailyRewardMask;
    }
    if (rewardAmounts.length >= 1) {
      itemNFT.mint(_from, rewardItemTokenIds[0], rewardAmounts[0]);
      emit DailyReward(_from, _playerId, rewardItemTokenIds[0], rewardAmounts[0]);
    }

    if (rewardAmounts.length == 2) {
      itemNFT.mint(_from, rewardItemTokenIds[1], rewardAmounts[1]);
      emit WeeklyReward(_from, _playerId, rewardItemTokenIds[1], rewardAmounts[1]);
    }
  }

  function initialize(
    ItemNFT _itemNFT,
    PlayerNFT _playerNFT,
    World _world,
    AdminAccess _adminAccess,
    Quests _quests,
    Clans _clans,
    address _implQueueActions,
    address _implProcessActions,
    address _implRewards,
    address _implMisc,
    bool _isBeta
  ) external {
    // Check that this isn't called on this contract (implementation) directly.
    // Slot 0 on the Players contract is initializable
    uint val;
    assembly ("memory-safe") {
      val := sload(0)
    }

    if (val == type(uint8).max) {
      revert CannotCallInitializerOnImplementation();
    }

    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    world = _world;
    adminAccess = _adminAccess;
    quests = _quests;
    clans = _clans;
    implQueueActions = _implQueueActions;
    implProcessActions = _implProcessActions;
    implRewards = _implRewards;
    implMisc = _implMisc;

    nextQueueId = 1;
    alphaCombat = 1;
    betaCombat = 1;
    isBeta = _isBeta;
  }

  function addFullAttireBonuses(FullAttireBonusInput[] calldata _fullAttireBonuses) external {
    U256 bounds = _fullAttireBonuses.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      FullAttireBonusInput calldata _fullAttireBonus = _fullAttireBonuses[i];

      if (_fullAttireBonus.skill == Skill.NONE) {
        revert InvalidSkill();
      }
      EquipPosition[5] memory expectedEquipPositions = [
        EquipPosition.HEAD,
        EquipPosition.BODY,
        EquipPosition.ARMS,
        EquipPosition.LEGS,
        EquipPosition.FEET
      ];
      U256 jbounds = expectedEquipPositions.length.asU256();
      for (U256 jter; jter < jbounds; jter = jter.inc()) {
        uint j = jter.asUint256();
        if (_fullAttireBonus.itemTokenIds[j] == NONE) {
          revert InvalidItemTokenId();
        }
        if (itemNFT.getItem(_fullAttireBonus.itemTokenIds[j]).equipPosition != expectedEquipPositions[j]) {
          revert InvalidEquipPosition();
        }
      }

      fullAttireBonus[_fullAttireBonus.skill] = FullAttireBonus(
        _fullAttireBonus.bonusXPPercent,
        _fullAttireBonus.bonusRewardsPercent,
        _fullAttireBonus.itemTokenIds
      );
      emit AddFullAttireBonus(
        _fullAttireBonus.skill,
        _fullAttireBonus.itemTokenIds,
        _fullAttireBonus.bonusXPPercent,
        _fullAttireBonus.bonusRewardsPercent
      );
    }
  }

  function processConsumablesViewStateTrans(
    uint _playerId,
    uint _currentActionStartTime,
    uint _elapsedTime,
    ActionChoice memory _actionChoice,
    uint16 _regenerateId,
    uint16 _foodConsumed,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    uint16 baseInputItemsConsumedNum
  ) public view returns (Equipment[] memory consumedEquipment, Equipment memory producedEquipment) {
    consumedEquipment = new Equipment[](MAX_CONSUMED_PER_ACTION);
    uint consumedEquipmentLength;
    if (_regenerateId != NONE && _foodConsumed != 0) {
      consumedEquipment[consumedEquipmentLength] = Equipment(_regenerateId, _foodConsumed);
      consumedEquipmentLength = consumedEquipmentLength.inc();
    }

    if (baseInputItemsConsumedNum != 0) {
      if (_actionChoice.inputTokenId1 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId1,
          baseInputItemsConsumedNum * _actionChoice.inputAmount1
        );
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
      if (_actionChoice.inputTokenId2 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId2,
          baseInputItemsConsumedNum * _actionChoice.inputAmount2
        );
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
      if (_actionChoice.inputTokenId3 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId3,
          baseInputItemsConsumedNum * _actionChoice.inputAmount3
        );
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
    }

    if (_actionChoice.outputTokenId != 0) {
      uint8 successPercent = 100;
      if (_actionChoice.successPercent != 100) {
        uint minLevel = PlayersLibrary.getLevel(_actionChoice.minXP);
        uint skillLevel = PlayersLibrary.getLevel(
          PlayersLibrary.getAbsoluteActionStartXP(_actionChoice.skill, _pendingQueuedActionProcessed, xp_[_playerId])
        );
        uint extraBoost = skillLevel - minLevel;

        successPercent = uint8(Math.min(MAX_SUCCESS_PERCENT_CHANCE_, _actionChoice.successPercent + extraBoost));
      }

      // Some might be burnt cooking for instance
      uint16 numProduced = uint16(
        (uint(baseInputItemsConsumedNum) * _actionChoice.outputAmount * successPercent) / 100
      );

      // Check for any gathering boosts
      PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
      uint boostedTime = PlayersLibrary.getBoostedTime(_currentActionStartTime, _elapsedTime, activeBoost);
      if (boostedTime != 0 && activeBoost.boostType == BoostType.GATHERING) {
        numProduced += uint16((boostedTime * numProduced * activeBoost.val) / (3600 * 100));
      }

      if (numProduced != 0) {
        producedEquipment = Equipment(_actionChoice.outputTokenId, numProduced);
      }
    }

    assembly ("memory-safe") {
      mstore(consumedEquipment, consumedEquipmentLength)
    }
  }

  function processConsumablesViewImpl(
    address _from,
    uint _playerId,
    QueuedAction memory _queuedAction,
    uint _currentActionStartTime,
    uint _elapsedTime,
    CombatStats memory _combatStats,
    ActionChoice memory _actionChoice,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed
  )
    external
    view
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory producedEquipment,
      uint xpElapsedTime,
      bool died,
      uint16 foodConsumed,
      uint16 baseInputItemsConsumedNum
    )
  {
    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    bool isCombat = _isCombatStyle(_queuedAction.combatStyle);
    if (isCombat) {
      // Fetch the requirements for it
      CombatStats memory enemyCombatStats = world.getCombatStats(_queuedAction.actionId);

      uint combatElapsedTime;
      (xpElapsedTime, combatElapsedTime, baseInputItemsConsumedNum, foodConsumed, died) = PlayersLibrary
        .getCombatAdjustedElapsedTimes(
          _from,
          itemNFT,
          world,
          _elapsedTime,
          _actionChoice,
          _queuedAction.regenerateId,
          _queuedAction,
          _combatStats,
          enemyCombatStats,
          alphaCombat,
          betaCombat,
          _pendingQueuedActionEquipmentStates
        );
    } else {
      (xpElapsedTime, baseInputItemsConsumedNum) = PlayersLibrary.getNonCombatAdjustedElapsedTime(
        _from,
        itemNFT,
        _elapsedTime,
        _actionChoice,
        _pendingQueuedActionEquipmentStates
      );
    }

    (consumedEquipment, producedEquipment) = processConsumablesViewStateTrans(
      _playerId,
      _currentActionStartTime,
      _elapsedTime,
      _actionChoice,
      _queuedAction.regenerateId,
      foodConsumed,
      _pendingQueuedActionProcessed,
      baseInputItemsConsumedNum
    );
  }

  function mintedPlayer(
    address _from,
    uint _playerId,
    Skill[2] calldata _startSkills,
    uint[] calldata _startingItemTokenIds,
    uint[] calldata _startingAmounts
  ) external {
    Player storage player = players_[_playerId];
    player.totalXP = uint56(START_XP_);

    U256 length = uint256(_startSkills[1] != Skill.NONE ? 2 : 1).asU256();
    uint32 xpEach = uint32(START_XP_ / length.asUint256());

    for (U256 iter; iter < length; iter = iter.inc()) {
      uint i = iter.asUint256();
      Skill skill = _startSkills[i];
      _updateXP(_from, _playerId, skill, xpEach);
    }

    player.skillBoosted1 = _startSkills[0];
    player.skillBoosted2 = _startSkills[1]; // Can be NONE

    // Mint starting equipment
    itemNFT.mintBatch(_from, _startingItemTokenIds, _startingAmounts);
  }
}
