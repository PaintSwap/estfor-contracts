// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {PlayersUpgradeableImplDummyBase, PlayersBase} from "./PlayersImplBase.sol";
import {PlayersLibrary} from "./PlayersLibrary.sol";

/* solhint-disable no-global-import */
import "../globals/players.sol";
import "../globals/items.sol";
import "../globals/actions.sol";
import "../globals/rewards.sol";

/* solhint-enable no-global-import */

contract PlayersImplProcessActions is PlayersUpgradeableImplDummyBase, PlayersBase {
  constructor() {
    _checkStartSlot();
  }

  function processActions(address _from, uint _playerId) external returns (QueuedAction[] memory remainingSkills) {
    Player storage player = players[_playerId];
    if (player.actionQueue.length == 0) {
      // No actions remaining
      _processActionsFinished(_from, _playerId);
      return remainingSkills;
    }

    uint previousTotalXP = player.totalXP;
    uint32 allPointsAccrued;

    remainingSkills = new QueuedAction[](player.actionQueue.length); // Max
    uint remainingSkillsLength;
    uint nextStartTime = block.timestamp;
    for (uint i = 0; i < player.actionQueue.length; ++i) {
      QueuedAction storage queuedAction = player.actionQueue[i];
      bool isCombat = _isCombatStyle(queuedAction.combatStyle);
      CombatStats memory combatStats;
      if (isCombat) {
        // This will only ones that they have a balance for at this time. This will check balances
        combatStats = _getCachedCombatStats(player);
        _updateCombatStats(_from, combatStats, queuedAction.attire);
      }
      bool missingRequiredHandEquipment = _updateStatsFromHandEquipment(
        _from,
        [queuedAction.rightHandEquipmentTokenId, queuedAction.leftHandEquipmentTokenId],
        combatStats,
        isCombat
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
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, remainingSkillsLength++);
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

        (xpElapsedTime, combatElapsedTime, died) = _processConsumables(
          _from,
          _playerId,
          queuedAction,
          elapsedTime,
          combatStats,
          actionChoice
        );
      }

      uint64 _queueId = queuedAction.queueId;
      Skill skill = _getSkillFromChoiceOrStyle(actionChoice, queuedAction.combatStyle, queuedAction.actionId);

      if (!died) {
        pointsAccrued = _getPointsAccrued(_from, _playerId, queuedAction, skill, xpElapsedTime);
      } else {
        emit Died(_from, _playerId, _queueId);
      }

      if (!fullyFinished) {
        // Add the remainder if this action is not fully consumed
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, remainingSkillsLength++);
        nextStartTime = queuedAction.startTime + queuedAction.timespan;
      }

      if (pointsAccrued != 0) {
        if (_isCombatStyle(queuedAction.combatStyle)) {
          // Update health too with 33% of the points gained from combat
          _updateXP(_from, _playerId, Skill.HEALTH, uint32((uint(pointsAccrued) * 333333) / 1000000));
          _cacheCombatStats(players[_playerId], xp[_playerId][Skill.HEALTH], skill, xp[_playerId][skill]);
        }
        _updateXP(_from, _playerId, skill, pointsAccrued);

        allPointsAccrued += pointsAccrued;
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
        skill
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
      _claimTotalXPThresholdRewards(_from, _playerId, previousTotalXP, previousTotalXP + allPointsAccrued);
      player.totalXP = uint160(previousTotalXP + allPointsAccrued);
    }

    _processActionsFinished(_from, _playerId);

    assembly ("memory-safe") {
      mstore(remainingSkills, remainingSkillsLength)
    }
  }

  function _processActionsFinished(address _from, uint _playerId) private {
    _claimRandomRewards(_playerId);
    _handleDailyRewards(_from, _playerId);

    // Clear boost if it has expired
    PlayerBoostInfo storage playerBoost = activeBoosts[_playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime + playerBoost.duration <= block.timestamp) {
      delete activeBoosts[_playerId];
      emit BoostFinished(_playerId);
    }
  }

  function _processConsumables(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _elapsedTime,
    CombatStats memory _combatStats,
    ActionChoice memory _actionChoice
  ) private returns (uint xpElapsedTime, uint combatElapsedTime, bool died) {
    bool isCombat = _isCombatStyle(_queuedAction.combatStyle);
    uint24 numConsumed;

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
        betaCombat
      );

      (died) = _processFoodConsumed(_from, _playerId, _queuedAction, combatElapsedTime, _combatStats, enemyCombatStats);
    } else {
      (xpElapsedTime, numConsumed) = PlayersLibrary.getNonCombatAdjustedElapsedTime(
        _from,
        itemNFT,
        _elapsedTime,
        _actionChoice
      );
    }

    _processInputConsumables(_from, _playerId, _actionChoice, numConsumed, _queuedAction.queueId);

    if (_actionChoice.outputTokenId != 0) {
      uint8 successPercent = 100;
      if (_actionChoice.successPercent != 100) {
        uint minLevel = PlayersLibrary.getLevel(_actionChoice.minXP);
        uint skillLevel = PlayersLibrary.getLevel(xp[_playerId][_actionChoice.skill]);
        uint extraBoost = skillLevel - minLevel;

        successPercent = uint8(
          PlayersLibrary.min(MAX_SUCCESS_PERCENT_CHANCE, _actionChoice.successPercent + extraBoost)
        );
      }

      uint amount = (numConsumed * successPercent) / 100;
      if (amount != 0) {
        itemNFT.mint(_from, _actionChoice.outputTokenId, amount);
        emit Reward(_from, _playerId, _queuedAction.queueId, _actionChoice.outputTokenId, amount);
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
    (foodConsumed, died) = PlayersLibrary.foodConsumedView(
      _from,
      _queuedAction,
      _combatElapsedTime,
      itemNFT,
      _combatStats,
      _enemyCombatStats,
      alphaCombat,
      betaCombat
    );
    if (foodConsumed != 0) {
      _processConsumable(_from, _playerId, _queuedAction.regenerateId, foodConsumed, _queuedAction.queueId);
    }
  }

  function _cacheCombatStats(Player storage _player, uint32 _healthXP, Skill _skill, uint32 _xp) private {
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
    uint40 end = queuedAction.startTime + queuedAction.timespan;

    QueuedAction memory remainingAction = queuedAction;
    remainingAction.startTime = uint40(prevEndTime);
    remainingAction.timespan = uint24(end - prevEndTime);

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
    Skill _skill
  ) private {
    bool hasRandomRewards = _actionRewards.randomRewardTokenId1 != NONE; // A precheck as an optimization
    if (hasRandomRewards) {
      bool hasRandomWord = world.hasRandomWord(_skillStartTime + _elapsedTime);
      if (!hasRandomWord) {
        PlayerBoostInfo storage activeBoost = activeBoosts[_playerId];
        BoostType boostType;
        uint16 boostValue;
        uint24 boostedTime;
        if (activeBoost.boostType == BoostType.GATHERING) {
          boostedTime = PlayersLibrary.getBoostedTime(_skillStartTime, _elapsedTime, activeBoost);
          if (boostedTime > 0) {
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
          (uint16[] memory itemTokenIds, uint[] memory balances) = _getAttireWithBalance(_from, _attire, skipNeck);
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

  function _claimableXPThresholdRewards(
    uint _oldTotalXP,
    uint _newTotalXP
  ) private returns (uint[] memory ids, uint[] memory amounts) {
    bytes memory data = _delegatecall(
      implRewards,
      abi.encodeWithSignature("claimableXPThresholdRewards(uint256,uint256)", _oldTotalXP, _newTotalXP)
    );
    return abi.decode(data, (uint[], uint[]));
  }

  function _claimTotalXPThresholdRewards(address _from, uint _playerId, uint _oldTotalXP, uint _newTotalXP) private {
    (uint[] memory itemTokenIds, uint[] memory amounts) = _claimableXPThresholdRewards(_oldTotalXP, _newTotalXP);
    if (itemTokenIds.length != 0) {
      itemNFT.mintBatch(_from, itemTokenIds, amounts);
      emit ClaimedXPThresholdRewards(_from, _playerId, itemTokenIds, amounts);
    }
  }

  function addFullAttireBonus(FullAttireBonusInput calldata _fullAttireBonus) external {
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
    for (uint i = 0; i < expectedEquipPositions.length; ++i) {
      if (_fullAttireBonus.itemTokenIds[i] == NONE) {
        revert InvalidItemTokenId();
      }
      if (itemNFT.getItem(_fullAttireBonus.itemTokenIds[i]).equipPosition != expectedEquipPositions[i]) {
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

  function mintedPlayer(address _from, uint _playerId, Skill[2] calldata _startSkills) external {
    Player storage player = players[_playerId];
    player.health = 1;
    player.melee = 1;
    player.magic = 1;
    player.range = 1;
    player.defence = 1;
    player.totalXP = uint160(START_XP);

    uint length = _startSkills[1] != Skill.NONE ? 2 : 1;
    uint32 xpEach = uint32(START_XP / length);
    for (uint i = 0; i < length; i++) {
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
  }

  function _updateXP(address _from, uint _playerId, Skill _skill, uint32 _pointsAccrued) private {
    uint oldPoints = xp[_playerId][_skill];
    uint newPoints = oldPoints + _pointsAccrued;
    if (newPoints > type(uint32).max) {
      newPoints = type(uint32).max;
    }
    xp[_playerId][_skill] = uint32(newPoints);
    emit AddXP(_from, _playerId, _skill, _pointsAccrued);

    uint16 oldLevel = PlayersLibrary.getLevel(oldPoints);
    uint16 newLevel = PlayersLibrary.getLevel(newPoints);
    // Update the player's level
    if (newLevel > oldLevel) {
      emit LevelUp(_from, _playerId, _skill, newLevel);
    }
  }

  function testModifyXP(uint _playerId, Skill _skill, uint32 _xp) external {
    // Make sure it isn't less XP
    uint32 oldPoints = xp[_playerId][_skill];
    if (_xp < oldPoints) {
      revert TestInvalidXP();
    }
    address from = msg.sender;
    _updateXP(msg.sender, _playerId, _skill, _xp - oldPoints);
    _claimTotalXPThresholdRewards(from, _playerId, oldPoints, _xp);
    players[_playerId].totalXP += uint160(_xp - oldPoints);
  }

  function _handleDailyRewards(address _from, uint _playerId) private {
    uint streakStart = ((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days;
    uint streakStartIndex = streakStart / 1 weeks;
    bytes32 mask = dailyRewardMasks[_playerId];
    uint16 lastRewardStartIndex = uint16(uint256(mask));
    if (lastRewardStartIndex < streakStartIndex) {
      mask = bytes32(streakStartIndex); // Reset the mask
    }

    uint maskIndex = ((block.timestamp / 1 days) * 1 days - streakStart) / 1 days;

    // Claim daily reward as long as it's been set
    if (mask[maskIndex] == 0 && dailyRewardsEnabled) {
      Equipment memory dailyReward = world.getDailyReward();
      if (dailyReward.itemTokenId != NONE) {
        mask = mask | ((bytes32(hex"ff") >> (maskIndex * 8)));
        dailyRewardMasks[_playerId] = mask;

        itemNFT.mint(_from, dailyReward.itemTokenId, dailyReward.amount);
        emit DailyReward(_from, _playerId, dailyReward.itemTokenId, dailyReward.amount);

        // Claim weekly rewards (this shifts the left-most 7 day streaks to the very right and checks all bits are set)
        bool canClaimWeeklyRewards = uint(mask >> (25 * 8)) == 2 ** (7 * 8) - 1;
        if (canClaimWeeklyRewards) {
          Equipment memory weeklyReward = world.getWeeklyReward();
          if (weeklyReward.itemTokenId != NONE) {
            itemNFT.mint(_from, weeklyReward.itemTokenId, weeklyReward.amount);
            emit WeeklyReward(_from, _playerId, weeklyReward.itemTokenId, weeklyReward.amount);
          }
        }
      }
    }
  }
}
