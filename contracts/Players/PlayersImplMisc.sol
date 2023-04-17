// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

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
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        if (xpThresholdReward.rewards[i].itemTokenId == NONE) {
          revert InvalidItemTokenId();
        }
        if (xpThresholdReward.rewards[i].amount == 0) {
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
  ) public view returns (Equipment[] memory rewards, bytes32 dailyRewardMask) {
    uint streakStart = ((block.timestamp.sub(4 days)).div(1 weeks)).mul(1 weeks).add(4 days);
    uint streakStartIndex = streakStart.div(1 weeks);
    bytes32 mask = dailyRewardMasks[_playerId];
    uint16 lastRewardStartIndex = uint16(uint256(mask));
    if (lastRewardStartIndex < streakStartIndex) {
      mask = bytes32(streakStartIndex); // Reset the mask
    }

    uint maskIndex = ((block.timestamp.div(1 days)).mul(1 days).sub(streakStart)).div(1 days);

    // Claim daily reward as long as it's been set
    if (mask[maskIndex] == 0 && dailyRewardsEnabled) {
      Equipment memory dailyReward = world.getDailyReward();
      if (dailyReward.itemTokenId != NONE) {
        dailyRewardMask = mask | ((bytes32(hex"ff") >> (maskIndex * 8)));
        bool canClaimWeeklyRewards = uint(dailyRewardMask >> (25 * 8)) == 2 ** (7 * 8) - 1;
        uint length = canClaimWeeklyRewards ? 2 : 1;
        rewards = new Equipment[](length);
        rewards[0] = dailyReward;

        // Claim weekly rewards (this shifts the left-most 7 day streaks to the very right and checks all bits are set)
        if (canClaimWeeklyRewards) {
          rewards[1] = world.getWeeklyReward();
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
    (Equipment[] memory rewards, bytes32 dailyRewardMask) = dailyRewardsViewImpl(_playerId);
    if (uint(dailyRewardMask) != 0) {
      dailyRewardMasks[_playerId] = dailyRewardMask;
    }
    if (rewards.length >= 1) {
      Equipment memory dailyReward = rewards[0];
      itemNFT.mint(_from, dailyReward.itemTokenId, dailyReward.amount);
      emit DailyReward(_from, _playerId, dailyReward.itemTokenId, dailyReward.amount);
    }

    if (rewards.length == 2) {
      Equipment memory weeklyReward = rewards[1];
      itemNFT.mint(_from, weeklyReward.itemTokenId, weeklyReward.amount);
      emit WeeklyReward(_from, _playerId, weeklyReward.itemTokenId, weeklyReward.amount);
    }
  }

  function processQuests(
    address _from,
    uint _playerId,
    uint[] memory _choiceIds,
    uint[] memory _choiceIdAmounts
  ) external override {
    (
      uint[] memory itemTokenIds,
      uint[] memory amounts,
      uint[] memory itemTokenIdsBurned,
      uint[] memory amountsBurned,
      Skill[] memory skillsGained,
      uint32[] memory xpGained,
      uint[] memory _questsCompleted,
      PlayerQuest[] memory questsCompletedInfo
    ) = quests.processQuests(_playerId, _choiceIds, _choiceIdAmounts);
    // Mint the rewards
    if (itemTokenIds.length != 0) {
      itemNFT.mintBatch(_from, itemTokenIds, amounts);
    }

    // Burn some items if quest requires it.
    U256 bounds = itemTokenIdsBurned.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      itemNFT.burn(_from, itemTokenIdsBurned[i], amountsBurned[i]);
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
    bool _isAlpha
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
    isAlpha = _isAlpha;
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

  function processConsumablesViewImpl(
    address _from,
    uint _playerId,
    QueuedAction memory _queuedAction,
    uint _elapsedTime,
    CombatStats memory _combatStats,
    ActionChoice memory _actionChoice,
    PendingQueuedActionEquipmentState[] memory _pendingQueuedActionEquipmentStates
  )
    external
    view
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory outputEquipment,
      uint xpElapsedTime,
      uint refundTime,
      bool died,
      uint24 numConsumed,
      uint24 numProduced
    )
  {
    consumedEquipment = new Equipment[](MAX_CONSUMED_PER_ACTION);
    uint consumedEquipmentLength;

    // Figure out how much food should be consumed.
    // This is based on the damage done from battling
    bool isCombat = _isCombatStyle(_queuedAction.combatStyle);
    if (isCombat) {
      // Fetch the requirements for it
      CombatStats memory enemyCombatStats = world.getCombatStats(_queuedAction.actionId);

      uint combatElapsedTime;
      (xpElapsedTime, combatElapsedTime, numConsumed) = PlayersLibrary.getCombatAdjustedElapsedTimes(
        _from,
        itemNFT,
        world,
        _elapsedTime,
        _actionChoice,
        _queuedAction,
        _combatStats,
        enemyCombatStats,
        alphaCombat,
        betaCombat,
        _pendingQueuedActionEquipmentStates
      );

      uint24 foodConsumed;
      (foodConsumed, died) = PlayersLibrary.foodConsumedView(
        _from,
        _queuedAction.regenerateId,
        combatElapsedTime,
        itemNFT,
        _combatStats,
        enemyCombatStats,
        alphaCombat,
        betaCombat,
        _pendingQueuedActionEquipmentStates
      );

      if (died) {
        xpElapsedTime = 0;
      }

      if (_queuedAction.regenerateId != NONE && foodConsumed != 0) {
        consumedEquipment[consumedEquipmentLength] = Equipment(_queuedAction.regenerateId, foodConsumed);
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
    } else {
      (xpElapsedTime, refundTime, numConsumed) = PlayersLibrary.getNonCombatAdjustedElapsedTime(
        _from,
        itemNFT,
        _elapsedTime,
        _actionChoice,
        _pendingQueuedActionEquipmentStates
      );
    }

    if (numConsumed != 0) {
      if (_actionChoice.inputTokenId1 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId1,
          numConsumed * _actionChoice.inputAmount1
        );
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
      if (_actionChoice.inputTokenId2 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId2,
          numConsumed * _actionChoice.inputAmount2
        );
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
      if (_actionChoice.inputTokenId3 != NONE) {
        consumedEquipment[consumedEquipmentLength] = Equipment(
          _actionChoice.inputTokenId3,
          numConsumed * _actionChoice.inputAmount3
        );
        consumedEquipmentLength = consumedEquipmentLength.inc();
      }
    }

    if (_actionChoice.outputTokenId != 0) {
      uint8 successPercent = 100;
      if (_actionChoice.successPercent != 100) {
        uint minLevel = PlayersLibrary.getLevel(_actionChoice.minXP);
        uint skillLevel = PlayersLibrary.getLevel(xp_[_playerId][_actionChoice.skill]);
        uint extraBoost = skillLevel - minLevel;

        successPercent = uint8(
          PlayersLibrary.min(MAX_SUCCESS_PERCENT_CHANCE_, _actionChoice.successPercent + extraBoost)
        );
      }

      numProduced = uint24((numConsumed * _actionChoice.outputAmount * successPercent) / 100);

      // Check for any gathering boosts
      PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
      uint boostedTime = PlayersLibrary.getBoostedTime(_queuedAction.startTime, _elapsedTime, activeBoost);
      if (boostedTime != 0 && activeBoost.boostType == BoostType.GATHERING) {
        numProduced += uint24((boostedTime * numProduced * activeBoost.val) / (3600 * 100));
      }

      if (numProduced != 0) {
        outputEquipment = Equipment(_actionChoice.outputTokenId, numProduced);
      }
    }

    assembly ("memory-safe") {
      mstore(consumedEquipment, consumedEquipmentLength)
    }
  }

  function mintedPlayer(address _from, uint _playerId, Skill[2] calldata _startSkills) external {
    Player storage player = players_[_playerId];
    player.health = 1;
    player.melee = 1;
    player.magic = 1;
    player.range = 1;
    player.defence = 1;
    player.totalXP = uint128(START_XP_);

    U256 length = uint256(_startSkills[1] != Skill.NONE ? 2 : 1).asU256();
    uint32 xpEach = uint32(START_XP_ / length.asUint256());

    for (U256 iter; iter < length; iter = iter.inc()) {
      uint i = iter.asUint256();
      Skill skill = _startSkills[i];
      int16 level = int16(PlayersLibrary.getLevel(xpEach));
      if (skill == Skill.HEALTH) {
        player.health = level;
      } else if (skill == Skill.MELEE) {
        player.melee = level;
      } else if (skill == Skill.MAGIC) {
        player.magic = level;
      } else if (skill == Skill.RANGE) {
        player.range = level;
      } else if (skill == Skill.DEFENCE) {
        player.defence = level;
      }
      _updateXP(_from, _playerId, skill, xpEach);
    }

    player.skillBoosted1 = _startSkills[0];
    player.skillBoosted2 = _startSkills[1]; // Can be NONE
  }
}
