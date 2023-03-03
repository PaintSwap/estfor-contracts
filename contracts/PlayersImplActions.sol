// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./PlayersImplBase.sol";

import {PlayerLibrary} from "./PlayerLibrary.sol";

contract PlayersImplActions is PlayersImplBase {
  function consumeActions(address _from, uint _playerId) external returns (QueuedAction[] memory remainingSkills) {
    Player storage player = players[_playerId];
    if (player.actionQueue.length == 0) {
      // No actions remaining
      return remainingSkills;
    }

    // TODO: Check they have everything (attire is checked already)
    uint previousSkillPoints = player.totalSkillPoints;
    uint32 allpointsAccrued;

    remainingSkills = new QueuedAction[](player.actionQueue.length); // Max
    uint length;
    uint nextStartTime = block.timestamp;
    for (uint i = 0; i < player.actionQueue.length; ++i) {
      QueuedAction storage queuedAction = player.actionQueue[i];

      // This will only ones that they have a balance for at this time. This will check balances
      CombatStats memory combatStats = _updateCombatStats(
        _from,
        player.combatStats,
        queuedAction.attire,
        true,
        queuedAction.startTime
      );

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
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, length);
        nextStartTime += queuedAction.timespan;
        length = i + 1;
        continue;
      }

      bool fullyFinished = elapsedTime >= queuedAction.timespan;

      // Create some items if necessary (smithing ores to bars for instance)
      bool died;

      ActionChoice memory actionChoice;
      bool isCombat = _isCombat(queuedAction.combatStyle);

      uint xpElapsedTime = elapsedTime;

      if (queuedAction.choiceId != 0) {
        // Includes combat
        // { || isCombat) {
        uint combatElapsedTime;
        actionChoice = world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);

        (xpElapsedTime, combatElapsedTime, died) = PlayerLibrary.processConsumables(
          _from,
          _playerId,
          queuedAction,
          elapsedTime,
          world,
          itemNFT,
          combatStats,
          actionChoice
        );
      }
      uint128 _queueId = queuedAction.attire.queueId;
      if (!died) {
        bool _isCombatSkill = _isCombat(queuedAction.combatStyle);
        uint16 xpPerHour = world.getXPPerHour(queuedAction.actionId, _isCombatSkill ? NONE : queuedAction.choiceId);
        pointsAccrued = uint32((xpElapsedTime * xpPerHour) / 3600);
        pointsAccrued += _extraXPFromBoost(_playerId, _isCombatSkill, queuedAction.startTime, elapsedTime, xpPerHour);
      } else {
        emit Died(_from, _playerId, _queueId);
      }

      if (!fullyFinished) {
        // Add the remainder if this action is not fully consumed
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, length);
        nextStartTime += elapsedTime;
        length = i + 1;
      }

      if (pointsAccrued > 0) {
        Skill skill = PlayerLibrary.getSkillFromStyle(queuedAction.combatStyle, queuedAction.actionId, world);

        if (_isCombat(queuedAction.combatStyle)) {
          // Update health too with 33%
          _updateSkillPoints(_playerId, Skill.HEALTH, (pointsAccrued * 33) / 100);
          PlayerLibrary.cacheCombatStats(
            players[_playerId],
            skillPoints[_playerId][Skill.HEALTH],
            skill,
            skillPoints[_playerId][skill]
          );
        }
        _updateSkillPoints(_playerId, skill, pointsAccrued);

        ActionRewards memory actionRewards = world.getActionRewards(queuedAction.actionId);
        (uint[] memory newIds, uint[] memory newAmounts) = PlayerLibrary.getRewards(
          _from,
          uint40(queuedAction.startTime + xpElapsedTime),
          xpElapsedTime,
          world,
          actionRewards
        );

        _addPendingRandomReward(
          pendingRandomRewards[_playerId],
          actionRewards,
          queuedAction.actionId,
          _queueId,
          uint40(skillEndTime),
          uint24(xpElapsedTime)
        );

        // This loot might be needed for a future task so mint now rather than later
        // But this could be improved
        if (newIds.length > 0) {
          itemNFT.mintBatch(_from, newIds, newAmounts);
          emit Rewards(_from, _playerId, _queueId, newIds, newAmounts);
        }
        allpointsAccrued += pointsAccrued;
      }

      if (fullyFinished) {
        emit ActionFinished(_from, _playerId, _queueId);
      } else {
        emit ActionPartiallyFinished(_from, _playerId, _queueId, elapsedTime);
      }
    }

    if (allpointsAccrued > 0) {
      // Check if they have levelled up
      _handleLevelUpRewards(_from, _playerId, previousSkillPoints, previousSkillPoints + allpointsAccrued);
    }

    claimRandomRewards(_playerId);

    assembly ("memory-safe") {
      mstore(remainingSkills, length)
    }
  }

  function claimRandomRewards(uint _playerId) public isOwnerOfPlayerAndActive(_playerId) {
    address from = msg.sender;
    (uint[] memory ids, uint[] memory amounts, uint numRemoved) = PlayerLibrary.claimableRandomRewards(
      from,
      world,
      pendingRandomRewards[_playerId]
    );

    if (numRemoved > 0) {
      // Shift the remaining rewards to the front of the array
      for (uint i; i < pendingRandomRewards[_playerId].length - numRemoved; ++i) {
        pendingRandomRewards[_playerId][i] = pendingRandomRewards[_playerId][i + numRemoved];
      }

      for (uint i; i < numRemoved; ++i) {
        pendingRandomRewards[_playerId].pop();
      }

      itemNFT.mintBatch(from, ids, amounts);
      //      emit Rewards(from, _playerId, _queueId, ids, amounts);
    }
  }

  function _extraXPFromBoost(
    uint _playerId,
    bool _isCombatSkill,
    uint _actionStartTime,
    uint _elapsedTime,
    uint16 _xpPerHour
  ) private view returns (uint32 boostPointsAccrued) {
    return
      PlayerLibrary.extraXPFromBoost(
        _isCombatSkill,
        _actionStartTime,
        _elapsedTime,
        _xpPerHour,
        activeBoosts[_playerId]
      );
  }

  function _isCombat(CombatStyle _combatStyle) private pure returns (bool) {
    return _combatStyle != CombatStyle.NONE;
  }

  function _getElapsedTime(
    uint _playerId,
    uint _skillEndTime,
    QueuedAction storage _queuedAction
  ) private view returns (uint) {
    return PlayerLibrary.getElapsedTime(_skillEndTime, _queuedAction, speedMultiplier[_playerId]);
  }

  function _updateCombatStats(
    address _from,
    CombatStats memory _stats,
    Attire storage _attire,
    bool _add,
    uint _startTime
  ) private view returns (CombatStats memory) {
    return PlayerLibrary.updateCombatStats(_from, _stats, _attire, itemNFT, _add);
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

  function _updateSkillPoints(uint _playerId, Skill _skill, uint32 _pointsAccrued) private {
    skillPoints[_playerId][_skill] += _pointsAccrued;
    emit AddSkillPoints(_playerId, _skill, _pointsAccrued);
  }

  function _addPendingRandomReward(
    PendingRandomReward[] storage _pendingRandomRewards,
    ActionRewards memory _actionRewards,
    uint16 _actionId,
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
            queueId: _queueId,
            timestamp: uint40(_skillEndTime),
            elapsedTime: uint24(_elapsedTime)
          })
        );
        emit AddPendingRandomReward(_actionId, _skillEndTime, _elapsedTime);
      }
    }
  }

  function _handleLevelUpRewards(
    address _from,
    uint _playerId,
    uint oldOverallSkillPoints,
    uint newOverallSkillPoints
  ) private {
    /*
    // Level 99
    if (oldOverallSkillPoints < LEVEL_99_BOUNDARY && newOverallSkillPoints >= LEVEL_99_BOUNDARY) {
      // Mint rewards
      uint[] memory itemTokenIds = new uint[](1);
      itemTokenIds[0] = SAPPHIRE_AMULET;

      uint[] memory amounts = new uint[](1);
      amounts[0] = 1;

      itemNFT.mintBatch(_from, itemTokenIds, amounts);

      // Consume an XP boost immediately
      // TODO

      emit LevelUp(_playerId, itemTokenIds, amounts);
    } else if (oldOverallSkillPoints < LEVEL_90_BOUNDARY && newOverallSkillPoints >= LEVEL_90_BOUNDARY) {} else if (
      oldOverallSkillPoints < LEVEL_80_BOUNDARY && newOverallSkillPoints >= LEVEL_80_BOUNDARY
    ) {} else if (oldOverallSkillPoints < LEVEL_70_BOUNDARY && newOverallSkillPoints >= LEVEL_70_BOUNDARY) {} else if (
      oldOverallSkillPoints < LEVEL_60_BOUNDARY && newOverallSkillPoints >= LEVEL_60_BOUNDARY
    ) {} else if (oldOverallSkillPoints < LEVEL_50_BOUNDARY && newOverallSkillPoints >= LEVEL_50_BOUNDARY) {} else if (
      oldOverallSkillPoints < LEVEL_40_BOUNDARY && newOverallSkillPoints >= LEVEL_40_BOUNDARY
    ) {} else if (oldOverallSkillPoints < LEVEL_30_BOUNDARY && newOverallSkillPoints >= LEVEL_30_BOUNDARY) {} else if (
      oldOverallSkillPoints < LEVEL_20_BOUNDARY && newOverallSkillPoints >= LEVEL_20_BOUNDARY
    ) {} else if (oldOverallSkillPoints < LEVEL_10_BOUNDARY && newOverallSkillPoints >= LEVEL_10_BOUNDARY) {} else if (
      oldOverallSkillPoints < LEVEL_5_BOUNDARY && newOverallSkillPoints >= LEVEL_5_BOUNDARY
    ) {} */
  }
}
