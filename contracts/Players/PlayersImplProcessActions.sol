// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {PlayersUpgradeableImplDummyBase, PlayersBase} from "./PlayersImplBase.sol";
import {PlayerLibrary} from "./PlayerLibrary.sol";

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
        emit ActionAborted(_from, _playerId, queuedAction.attire.queueId);
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

      uint128 _queueId = queuedAction.attire.queueId;
      Skill skill = _getSkillFromStyle(queuedAction.combatStyle, queuedAction.actionId);

      if (!died) {
        pointsAccrued = _getPointsAccrued(_from, _playerId, queuedAction, skill, xpElapsedTime);
      } else {
        emit Died(_from, _playerId, _queueId);
      }

      if (!fullyFinished) {
        // Add the remainder if this action is not fully consumed
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, remainingSkillsLength++);
        nextStartTime += elapsedTime;
      }

      if (pointsAccrued != 0) {
        if (_isCombatStyle(queuedAction.combatStyle)) {
          // Update health too with 33% of the points gained from combat
          _updateXP(_from, _playerId, Skill.HEALTH, uint32((uint(pointsAccrued) * 333333) / 1000000));
          _cacheCombatStats(players[_playerId], xp[_playerId][Skill.HEALTH], skill, xp[_playerId][skill]);
        }
        _updateXP(_from, _playerId, skill, pointsAccrued);

        uint8 actionSuccessPercent = world.getActionSuccessPercent(queuedAction.actionId);
        (uint[] memory newIds, uint[] memory newAmounts) = _getRewards(
          uint40(queuedAction.startTime + xpElapsedTime),
          xpElapsedTime,
          queuedAction.actionId,
          actionSuccessPercent
        );

        ActionRewards memory actionRewards = world.getActionRewards(queuedAction.actionId);
        _addPendingRandomReward(
          _from,
          _playerId,
          pendingRandomRewards[_playerId],
          actionRewards,
          queuedAction.actionId,
          queuedAction.choiceId,
          _queueId,
          uint40(skillEndTime),
          uint24(xpElapsedTime)
        );

        // This loot might be needed for a future task so mint now rather than later
        // But this could be improved
        if (newIds.length != 0) {
          itemNFT.mintBatch(_from, newIds, newAmounts);
          emit Rewards(_from, _playerId, _queueId, newIds, newAmounts);
        }

        allPointsAccrued += pointsAccrued;
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

    _claimRandomRewards(_playerId);

    assembly ("memory-safe") {
      mstore(remainingSkills, remainingSkillsLength)
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
      CombatStats memory _enemyCombatStats = world.getCombatStats(_queuedAction.actionId);
      (xpElapsedTime, combatElapsedTime, numConsumed) = PlayerLibrary.getCombatAdjustedElapsedTimes(
        _from,
        itemNFT,
        world,
        _elapsedTime,
        _actionChoice,
        _queuedAction,
        _combatStats,
        _enemyCombatStats,
        alphaCombat,
        betaCombat
      );

      (died) = _processFoodConsumed(
        _from,
        _playerId,
        _queuedAction,
        combatElapsedTime,
        _combatStats,
        _enemyCombatStats
      );
    } else {
      (xpElapsedTime, numConsumed) = PlayerLibrary.getNonCombatAdjustedElapsedTime(
        _from,
        itemNFT,
        _elapsedTime,
        _actionChoice
      );
    }

    if (numConsumed != 0) {
      _processInputConsumables(_from, _playerId, _actionChoice, numConsumed, _queuedAction.attire.queueId);
    }

    if (_actionChoice.outputTokenId != 0) {
      uint8 successPercent = 100;
      if (_actionChoice.successPercent != 100) {
        uint minLevel = PlayerLibrary.getLevel(_actionChoice.minXP);
        uint skillLevel = PlayerLibrary.getLevel(xp[_playerId][_actionChoice.skill]);
        uint extraBoost = skillLevel - minLevel;

        successPercent = uint8(
          PlayerLibrary.min(MAX_SUCCESS_PERCENT_CHANCE, _actionChoice.successPercent + extraBoost)
        );
      }

      itemNFT.mint(_from, _actionChoice.outputTokenId, (numConsumed * successPercent) / 100);
      emit Reward(
        _from,
        _playerId,
        _queuedAction.attire.queueId,
        _actionChoice.outputTokenId,
        (numConsumed * successPercent) / 100
      );
    }
  }

  function _processInputConsumables(
    address _from,
    uint _playerId,
    ActionChoice memory _actionChoice,
    uint24 _numConsumed,
    uint128 _queueId
  ) private {
    _processConsumable(_from, _playerId, _actionChoice.inputTokenId1, _numConsumed * _actionChoice.num1, _queueId);
    _processConsumable(_from, _playerId, _actionChoice.inputTokenId2, _numConsumed * _actionChoice.num2, _queueId);
    _processConsumable(_from, _playerId, _actionChoice.inputTokenId3, _numConsumed * _actionChoice.num3, _queueId);
  }

  function _processConsumable(
    address _from,
    uint _playerId,
    uint16 _itemTokenId,
    uint24 _numConsumed,
    uint128 _queueId
  ) private {
    if (_itemTokenId == 0) {
      return;
    }
    // Balance should be checked beforehand
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
    (foodConsumed, died) = PlayerLibrary.foodConsumedView(
      _from,
      _queuedAction,
      _combatElapsedTime,
      itemNFT,
      _combatStats,
      _enemyCombatStats,
      alphaCombat,
      betaCombat
    );

    _processConsumable(_from, _playerId, _queuedAction.regenerateId, foodConsumed, _queuedAction.attire.queueId);
  }

  function _cacheCombatStats(Player storage _player, uint32 _healthXP, Skill _skill, uint32 _xp) private {
    {
      int16 _health = int16(PlayerLibrary.getLevel(_healthXP));
      _player.health = _health;
    }

    int16 _level = int16(PlayerLibrary.getLevel(_xp));
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

  function _getSkillFromStyle(CombatStyle _combatStyle, uint16 _actionId) private view returns (Skill skill) {
    if (_combatStyle == CombatStyle.MELEE) {
      skill = Skill.MELEE;
    } else if (_combatStyle == CombatStyle.MAGIC) {
      skill = Skill.MAGIC;
    }
    /* else if (_combatStyle == Skill.RANGE) {
            skill = Skill.RANGE;
          } */
    else if (
      _combatStyle == CombatStyle.MELEE_DEFENCE ||
      _combatStyle == CombatStyle.RANGE_DEFENCE ||
      _combatStyle == CombatStyle.MAGIC_DEFENCE
    ) {
      skill = Skill.DEFENCE;
    } else {
      // Not a combat style, get the skill from the action
      skill = world.getSkill(_actionId);
    }
  }

  function _getRewards(
    uint40 _skillEndTime,
    uint _elapsedTime,
    uint16 _actionId,
    uint8 _successPercent
  ) private returns (uint[] memory newIds, uint[] memory newAmounts) {
    bytes memory data = _delegatecall(
      implRewards,
      abi.encodeWithSignature(
        "getRewards(uint40,uint256,uint16,uint8)",
        _skillEndTime,
        _elapsedTime,
        _actionId,
        _successPercent
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
    remainingAction.timespan = uint16(end - prevEndTime);

    // Build a list of the skills queued that remain
    remainingSkills[length] = remainingAction;
  }

  function _addPendingRandomReward(
    address _from,
    uint _playerId,
    PendingRandomReward[] storage _pendingRandomRewards,
    ActionRewards memory _actionRewards,
    uint16 _actionId,
    uint16 _choiceId,
    uint128 _queueId,
    uint40 _skillEndTime,
    uint24 _elapsedTime
  ) private {
    bool hasRandomRewards = _actionRewards.randomRewardTokenId1 != NONE; // A precheck as an optimization
    if (hasRandomRewards) {
      bool hasSeed = world.hasSeed(_skillEndTime);
      if (!hasSeed) {
        // There's no seed for this yet, so add it to the loot queue. (TODO: They can force add it later)
        _pendingRandomRewards.push(
          PendingRandomReward({
            actionId: _actionId,
            choiceId: _choiceId,
            queueId: _queueId,
            timestamp: uint40(_skillEndTime),
            elapsedTime: uint24(_elapsedTime)
          })
        );
        emit AddPendingRandomReward(_from, _playerId, _queueId, _skillEndTime, _elapsedTime);
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
}
