// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {PlayersUpgradeableImplDummyBase, PlayersBase} from "./PlayersImplBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";

/* solhint-disable no-global-import */
import "../globals/players.sol";
import "../globals/items.sol";
import "../globals/actions.sol";
import "../globals/rewards.sol";

/* solhint-enable no-global-import */

contract PlayersImplProcessActions is PlayersUpgradeableImplDummyBase, PlayersBase {
  using UnsafeMath for U256;
  using UnsafeMath for uint8;
  using UnsafeMath for uint32;
  using UnsafeMath for uint40;
  using UnsafeMath for uint128;
  using UnsafeMath for uint256;

  constructor() {
    _checkStartSlot();
  }

  function processActions(address _from, uint _playerId) external returns (QueuedAction[] memory remainingSkills) {
    Player storage player = players_[_playerId];
    if (player.actionQueue.length == 0) {
      // No actions remaining
      _processActionsFinished(_from, _playerId);
      return remainingSkills;
    }

    uint previousTotalXP = player.totalXP;
    uint32 allPointsAccrued;

    uint[] memory choiceIds = new uint[](player.actionQueue.length);
    uint[] memory choiceIdAmounts = new uint[](player.actionQueue.length);
    uint choiceIdsLength;

    remainingSkills = new QueuedAction[](player.actionQueue.length); // Max
    uint remainingSkillsLength;
    uint nextStartTime = block.timestamp;
    PendingQueuedActionState memory pendingQueuedActionState;
    U256 bounds = player.actionQueue.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      QueuedAction storage queuedAction = player.actionQueue[i];
      bool isCombat = _isCombatStyle(queuedAction.combatStyle);
      CombatStats memory combatStats;
      if (isCombat) {
        // This will only ones that they have a balance for at this time. This will check balances
        combatStats = _getCachedCombatStats(player);
        _updateCombatStats(_from, combatStats, queuedAction.attire, pendingQueuedActionState);
      }
      bool missingRequiredHandEquipment = _updateStatsFromHandEquipment(
        _from,
        [queuedAction.rightHandEquipmentTokenId, queuedAction.leftHandEquipmentTokenId],
        combatStats,
        isCombat,
        pendingQueuedActionState
      );
      if (missingRequiredHandEquipment) {
        emit ActionAborted(_from, _playerId, queuedAction.queueId);
        continue;
      }

      uint32 pointsAccrued;
      uint skillEndTime = queuedAction.startTime +
        (
          speedMultiplier[_playerId] > 1
            ? uint(queuedAction.timespan) / speedMultiplier[_playerId]
            : queuedAction.timespan
        );

      uint elapsedTime = _getElapsedTime(_playerId, skillEndTime, queuedAction);
      if (elapsedTime == 0) {
        // Haven't touched this action yet so add it all
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, remainingSkillsLength);
        remainingSkillsLength = remainingSkillsLength.inc();
        nextStartTime += queuedAction.timespan;
        continue;
      }

      bool fullyFinished = elapsedTime >= queuedAction.timespan;

      // Create some items if necessary (smithing ores to bars for instance)
      bool died;

      ActionChoice memory actionChoice;

      uint xpElapsedTime = elapsedTime;
      if (queuedAction.choiceId != 0) {
        // Includes combat
        uint combatElapsedTime;
        actionChoice = world.getActionChoice(isCombat ? NONE : queuedAction.actionId, queuedAction.choiceId);
        uint24 baseNumConsumed;
        uint24 numProduced;
        (xpElapsedTime, combatElapsedTime, died, baseNumConsumed, numProduced) = _processConsumables(
          _from,
          _playerId,
          queuedAction,
          elapsedTime,
          combatStats,
          actionChoice,
          pendingQueuedActionState
        );

        Skill skill = _getSkillFromChoiceOrStyle(actionChoice, queuedAction.combatStyle, queuedAction.actionId);
        if (skill == Skill.COOKING) {
          if (numProduced > 0) {
            choiceIdAmounts[choiceIdsLength] = numProduced; // Assume we want amount cooked
            choiceIds[choiceIdsLength] = queuedAction.choiceId;
            choiceIdsLength = choiceIdsLength.inc();
          }
        } else {
          if (baseNumConsumed > 0) {
            choiceIdAmounts[choiceIdsLength] = baseNumConsumed;
            choiceIds[choiceIdsLength] = queuedAction.choiceId;
            choiceIdsLength = choiceIdsLength.inc();
          }
        }
      }

      uint64 _queueId = queuedAction.queueId;
      Skill skill = _getSkillFromChoiceOrStyle(actionChoice, queuedAction.combatStyle, queuedAction.actionId);

      uint pointsAccruedExclBaseBoost;
      if (!died) {
        (pointsAccrued, pointsAccruedExclBaseBoost) = _getPointsAccrued(
          _from,
          _playerId,
          queuedAction,
          skill,
          xpElapsedTime,
          pendingQueuedActionState
        );
      } else {
        emit Died(_from, _playerId, _queueId);
      }

      if (!fullyFinished) {
        // Add the remainder if this action is not fully consumed
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, remainingSkillsLength);
        remainingSkillsLength = remainingSkillsLength.inc();
        nextStartTime = queuedAction.startTime.add(queuedAction.timespan);
      }

      if (pointsAccrued != 0) {
        uint32 healthPointsAccrued;
        _updateXP(_from, _playerId, skill, pointsAccrued);
        if (_isCombatStyle(queuedAction.combatStyle)) {
          healthPointsAccrued = _getHealthPointsFromCombat(_playerId, pointsAccruedExclBaseBoost);
          _updateXP(_from, _playerId, Skill.HEALTH, healthPointsAccrued);
          _cacheCombatStats(players_[_playerId], xp_[_playerId][Skill.HEALTH], skill, xp_[_playerId][skill]);
        }

        allPointsAccrued = uint32(allPointsAccrued.add(pointsAccrued).add(healthPointsAccrued));
      }

      (uint[] memory newIds, uint[] memory newAmounts) = _getRewards(
        _playerId,
        queuedAction.startTime,
        xpElapsedTime,
        queuedAction.actionId
      );

      ActionRewards memory actionRewards = world.getActionRewards(queuedAction.actionId);
      _addPendingRandomReward(
        _from,
        _playerId,
        pendingRandomRewards[_playerId],
        actionRewards,
        queuedAction.actionId,
        _queueId,
        uint40(skillEndTime),
        uint24(xpElapsedTime),
        queuedAction.attire,
        skill,
        pendingQueuedActionState
      );

      // This loot might be needed for a future task so mint now rather than later
      // But this could be improved
      if (newIds.length != 0) {
        itemNFT.mintBatch(_from, newIds, newAmounts);
        emit Rewards(_from, _playerId, _queueId, newIds, newAmounts);
      }

      if (fullyFinished) {
        emit ActionFinished(_from, _playerId, _queueId);
      } else {
        emit ActionPartiallyFinished(_from, _playerId, _queueId, elapsedTime);
      }
    }

    if (allPointsAccrued != 0) {
      uint newTotalXP = previousTotalXP.add(allPointsAccrued);
      _claimTotalXPThresholdRewards(_from, _playerId, previousTotalXP, newTotalXP);
      player.totalXP = uint128(newTotalXP);
    }

    // Quest Rewards
    assembly ("memory-safe") {
      mstore(choiceIds, choiceIdsLength)
      mstore(choiceIdAmounts, choiceIdsLength)
    }
    _processQuests(_from, _playerId, choiceIds, choiceIdAmounts);

    _processActionsFinished(_from, _playerId);

    assembly ("memory-safe") {
      mstore(remainingSkills, remainingSkillsLength)
    }
  }

  function _processQuests(
    address _from,
    uint _playerId,
    uint[] memory _choiceIds,
    uint[] memory _choiceIdAmounts
  ) private {
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
      itemNFT.mintBatch(_from, itemTokenIds, amounts);
    }

    // Burn some items if quest requires it.
    U256 bounds = itemTokenIdsBurned.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      itemNFT.burn(_from, itemTokenIdsBurned[i], amountsBurned[i]);
    }
  }

  function _processActionsFinished(address _from, uint _playerId) private {
    _claimRandomRewards(_playerId);
    _handleDailyRewards(_from, _playerId);

    // Clear boost if it has expired
    PlayerBoostInfo storage playerBoost = activeBoosts_[_playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime.add(playerBoost.duration) <= block.timestamp) {
      delete activeBoosts_[_playerId];
      emit BoostFinished(_playerId);
    }
  }

  function _processConsumables(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _elapsedTime,
    CombatStats memory _combatStats,
    ActionChoice memory _actionChoice,
    PendingQueuedActionState memory _pendingQueuedActionState
  ) private returns (uint xpElapsedTime, uint combatElapsedTime, bool died, uint24 numConsumed, uint24 numProduced) {
    bool isCombat = _isCombatStyle(_queuedAction.combatStyle);

    if (isCombat) {
      CombatStats memory enemyCombatStats = world.getCombatStats(_queuedAction.actionId);
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
        _pendingQueuedActionState
      );

      died = _processFoodConsumed(_from, _playerId, _queuedAction, combatElapsedTime, _combatStats, enemyCombatStats);

      if (died) {
        xpElapsedTime = 0;
      }
    } else {
      (xpElapsedTime, numConsumed) = PlayersLibrary.getNonCombatAdjustedElapsedTime(
        _from,
        itemNFT,
        _elapsedTime,
        _actionChoice,
        _pendingQueuedActionState
      );
    }

    _processInputConsumables(_from, _playerId, _actionChoice, numConsumed, _queuedAction.queueId);

    if (_actionChoice.outputTokenId != 0) {
      uint8 successPercent = 100;
      if (_actionChoice.successPercent != 100) {
        uint minLevel = PlayersLibrary.getLevel(_actionChoice.minXP);
        uint skillLevel = PlayersLibrary.getLevel(xp_[_playerId][_actionChoice.skill]);
        uint extraBoost = skillLevel - minLevel;

        successPercent = uint8(
          PlayersLibrary.min(MAX_SUCCESS_PERCENT_CHANCE_, _actionChoice.successPercent.add(extraBoost))
        );
      }

      numProduced = (numConsumed * _actionChoice.outputNum * successPercent) / 100;

      // Check for any gathering boosts
      PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
      uint boostedTime = PlayersLibrary.getBoostedTime(_queuedAction.startTime, _elapsedTime, activeBoost);
      if (boostedTime > 0 && activeBoost.boostType == BoostType.GATHERING) {
        numProduced += uint24((boostedTime * numProduced * activeBoost.val) / (3600 * 100));
      }
      if (numProduced != 0) {
        itemNFT.mint(_from, _actionChoice.outputTokenId, numProduced);
        emit Reward(_from, _playerId, _queuedAction.queueId, _actionChoice.outputTokenId, numProduced);
      }
    }
  }

  function _processInputConsumables(
    address _from,
    uint _playerId,
    ActionChoice memory _actionChoice,
    uint24 _numConsumed,
    uint64 _queueId
  ) private {
    if (_numConsumed != 0) {
      _processConsumable(_from, _playerId, _actionChoice.inputTokenId1, _numConsumed * _actionChoice.num1, _queueId);
      _processConsumable(_from, _playerId, _actionChoice.inputTokenId2, _numConsumed * _actionChoice.num2, _queueId);
      _processConsumable(_from, _playerId, _actionChoice.inputTokenId3, _numConsumed * _actionChoice.num3, _queueId);
    }
  }

  function _processConsumable(
    address _from,
    uint _playerId,
    uint16 _itemTokenId,
    uint24 _numConsumed,
    uint64 _queueId
  ) private {
    if (_itemTokenId == NONE) {
      return;
    }
    emit Consume(_from, _playerId, _queueId, _itemTokenId, _numConsumed);
    itemNFT.burn(_from, _itemTokenId, _numConsumed);
  }

  function _processFoodConsumed(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _combatElapsedTime,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats
  ) private returns (bool died) {
    uint24 foodConsumed;
    // Figure out how much food should be used
    PendingQueuedActionState memory pendingQueuedActionState;
    (foodConsumed, died) = PlayersLibrary.foodConsumedView(
      _from,
      _queuedAction,
      _combatElapsedTime,
      itemNFT,
      _combatStats,
      _enemyCombatStats,
      alphaCombat,
      betaCombat,
      pendingQueuedActionState
    );
    if (foodConsumed != 0) {
      _processConsumable(_from, _playerId, _queuedAction.regenerateId, foodConsumed, _queuedAction.queueId);
    }
  }

  function _cacheCombatStats(Player storage _player, uint128 _healthXP, Skill _skill, uint128 _xp) private {
    {
      int16 _health = int16(PlayersLibrary.getLevel(_healthXP));
      _player.health = _health;
    }

    int16 _level = int16(PlayersLibrary.getLevel(_xp));
    if (_skill == Skill.MELEE) {
      _player.melee = _level;
    } else if (_skill == Skill.MAGIC) {
      _player.magic = _level;
    }
    /* else if (_skill == Skill.RANGE) {
            _player.range = _level;
          } */
    else if (_skill == Skill.DEFENCE) {
      _player.defence = _level;
    }
  }

  function _getRewards(
    uint _playerId,
    uint40 _skillStartTime,
    uint _elapsedTime,
    uint16 _actionId
  ) private returns (uint[] memory newIds, uint[] memory newAmounts) {
    bytes memory data = _delegatecall(
      implRewards,
      abi.encodeWithSignature(
        "getRewards(uint256,uint40,uint256,uint16)",
        _playerId,
        _skillStartTime,
        _elapsedTime,
        _actionId
      )
    );
    return abi.decode(data, (uint[], uint[]));
  }

  function _addRemainingSkill(
    QueuedAction[] memory remainingSkills,
    QueuedAction storage queuedAction,
    uint prevEndTime,
    uint length
  ) private view {
    uint40 end = uint40(queuedAction.startTime.add(queuedAction.timespan));

    QueuedAction memory remainingAction = queuedAction;
    remainingAction.startTime = uint40(prevEndTime);
    remainingAction.timespan = uint24(end.sub(prevEndTime));

    // Build a list of the skills queued that remain
    remainingSkills[length] = remainingAction;
  }

  function _addPendingRandomReward(
    address _from,
    uint _playerId,
    PendingRandomReward[] storage _pendingRandomRewards,
    ActionRewards memory _actionRewards,
    uint16 _actionId,
    uint64 _queueId,
    uint40 _skillStartTime,
    uint24 _elapsedTime,
    Attire storage _attire,
    Skill _skill,
    PendingQueuedActionState memory _pendingQueuedActionState
  ) private {
    bool hasRandomRewards = _actionRewards.randomRewardTokenId1 != NONE; // A precheck as an optimization
    if (hasRandomRewards) {
      bool hasRandomWord = world.hasRandomWord(_skillStartTime.add(_elapsedTime));
      if (!hasRandomWord) {
        PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
        BoostType boostType;
        uint16 boostValue;
        uint24 boostedTime;
        if (activeBoost.boostType == BoostType.GATHERING) {
          boostedTime = PlayersLibrary.getBoostedTime(_skillStartTime, _elapsedTime, activeBoost);
            boostType = activeBoost.boostType;
            boostValue = activeBoost.val;
          }
        }

        // Special case where thieving gives you a bonus if wearing full equipment
        uint8 bonusRewardsPercent = fullAttireBonus[_skill].bonusRewardsPercent;
        uint8 fullAttireBonusRewardsPercent;
        if (bonusRewardsPercent != 0) {
          // Check if they have the full equipment set, if so they can get some bonus
          bool skipNeck = true;
          (uint16[] memory itemTokenIds, uint[] memory balances) = _getAttireWithBalance(
            _from,
            _attire,
            skipNeck,
            _pendingQueuedActionState
          );
          bool hasFullAttire = PlayersLibrary.extraBoostFromFullAttire(
            itemTokenIds,
            balances,
            fullAttireBonus[_skill].itemTokenIds
          );

          if (hasFullAttire) {
            fullAttireBonusRewardsPercent = bonusRewardsPercent;
          }
        }

        // There's no random word for this yet, so add it to the loot queue. (TODO: They can force add it later)
        _pendingRandomRewards.push(
          PendingRandomReward({
            actionId: _actionId,
            queueId: _queueId,
            startTime: uint40(_skillStartTime),
            elapsedTime: uint24(_elapsedTime),
            boostType: boostType,
            boostValue: boostValue,
            boostedTime: boostedTime,
            fullAttireBonusRewardsPercent: fullAttireBonusRewardsPercent
          })
        );
        emit AddPendingRandomReward(_from, _playerId, _queueId, _skillStartTime, _elapsedTime);
      }
    }
  }

  function _claimTotalXPThresholdRewards(address _from, uint _playerId, uint _oldTotalXP, uint _newTotalXP) private {
    (uint[] memory itemTokenIds, uint[] memory amounts) = _claimableXPThresholdRewards(_oldTotalXP, _newTotalXP);
    if (itemTokenIds.length != 0) {
      itemNFT.mintBatch(_from, itemTokenIds, amounts);
      emit ClaimedXPThresholdRewards(_from, _playerId, itemTokenIds, amounts);
    }
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

  function _updateXP(address _from, uint _playerId, Skill _skill, uint128 _pointsAccrued) private {
    uint oldPoints = xp_[_playerId][_skill];
    uint newPoints = oldPoints.add(_pointsAccrued);
    if (newPoints > type(uint32).max) {
      newPoints = type(uint32).max;
    }
    xp_[_playerId][_skill] = uint32(newPoints);
    emit AddXP(_from, _playerId, _skill, uint32(newPoints));

    uint16 oldLevel = PlayersLibrary.getLevel(oldPoints);
    uint16 newLevel = PlayersLibrary.getLevel(newPoints);
    // Update the player's level
    if (newLevel > oldLevel) {
      emit LevelUp(_from, _playerId, _skill, oldLevel, newLevel);
    }
  }

  function testModifyXP(uint _playerId, Skill _skill, uint128 _xp) external {
    // Make sure it isn't less XP
    uint128 oldPoints = xp_[_playerId][_skill];
    if (_xp < oldPoints) {
      revert TestInvalidXP();
    }
    address from = msg.sender;
    uint128 updatedPoints = uint128(_xp.sub(oldPoints));
    _updateXP(msg.sender, _playerId, _skill, updatedPoints);
    _claimTotalXPThresholdRewards(from, _playerId, oldPoints, _xp);
    players_[_playerId].totalXP = uint128(players_[_playerId].totalXP.add(updatedPoints));
  }

  function _handleDailyRewards(address _from, uint _playerId) private {
    (Equipment[] memory rewards, bytes32 dailyRewardMask) = dailyRewardsView(_playerId);
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
}
