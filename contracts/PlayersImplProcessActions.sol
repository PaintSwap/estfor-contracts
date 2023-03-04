// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./PlayersImplBase.sol";

import {PlayerLibrary} from "./PlayerLibrary.sol";

contract PlayersImplProcessActions is PlayersImplBase {
  function processActions(address _from, uint _playerId) external returns (QueuedAction[] memory remainingSkills) {
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
      CombatStats memory combatStats = _updateCombatStats(_from, player.combatStats, queuedAction.attire);

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

        (xpElapsedTime, combatElapsedTime, died) = _processConsumables(
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
          _cacheCombatStats(
            players[_playerId],
            skillPoints[_playerId][Skill.HEALTH],
            skill,
            skillPoints[_playerId][skill]
          );
        }
        _updateSkillPoints(_playerId, skill, pointsAccrued);

        (uint[] memory newIds, uint[] memory newAmounts) = _getRewards(
          uint40(queuedAction.startTime + xpElapsedTime),
          xpElapsedTime,
          queuedAction.actionId
        );

        ActionRewards memory actionRewards = world.getActionRewards(queuedAction.actionId);
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

    _claimRandomRewards(_playerId);

    assembly ("memory-safe") {
      mstore(remainingSkills, length)
    }
  }

  function _processConsumables(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _elapsedTime,
    World _world,
    ItemNFT _itemNFT,
    CombatStats memory _combatStats,
    ActionChoice memory _actionChoice
  ) private returns (uint xpElapsedTime, uint combatElapsedTime, bool died) {
    // This is based on the damage done from battling
    (bool isCombat, CombatStats memory enemyCombatStats) = _world.getCombatStats(_queuedAction.actionId);
    uint16 numConsumed;
    (xpElapsedTime, combatElapsedTime, numConsumed) = PlayerLibrary.getAdjustedElapsedTimes(
      _from,
      _itemNFT,
      _world,
      _elapsedTime,
      _actionChoice,
      _queuedAction,
      _combatStats,
      enemyCombatStats
    );
    if (isCombat) {
      (died) = _processFoodConsumed(
        _from,
        _playerId,
        _queuedAction,
        combatElapsedTime,
        _itemNFT,
        _combatStats,
        enemyCombatStats
      );
    }

    if (numConsumed > 0) {
      _processInputConsumables(_from, _playerId, _actionChoice, numConsumed, _itemNFT, _queuedAction.attire.queueId);
    }

    if (_actionChoice.outputTokenId != 0) {
      _itemNFT.mint(_from, _actionChoice.outputTokenId, numConsumed);
      emit Reward(_from, _playerId, _queuedAction.attire.queueId, _actionChoice.outputTokenId, numConsumed);
    }
  }

  function _processInputConsumables(
    address _from,
    uint _playerId,
    ActionChoice memory _actionChoice,
    uint16 _numConsumed,
    ItemNFT _itemNFT,
    uint128 _queueId
  ) private {
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _actionChoice.inputTokenId1,
      _numConsumed * _actionChoice.num1,
      _queueId
    );
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _actionChoice.inputTokenId2,
      _numConsumed * _actionChoice.num2,
      _queueId
    );
    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _actionChoice.inputTokenId3,
      _numConsumed * _actionChoice.num3,
      _queueId
    );
  }

  function _processConsumable(
    address _from,
    uint _playerId,
    ItemNFT _itemNFT,
    uint16 _itemTokenId,
    uint16 _numConsumed,
    uint128 _queueId
  ) private {
    if (_itemTokenId == 0) {
      return;
    }
    // Balance should be checked beforehand
    emit Consume(_from, _playerId, _queueId, _itemTokenId, _numConsumed);
    _itemNFT.burn(_from, _itemTokenId, _numConsumed);
  }

  function _processFoodConsumed(
    address _from,
    uint _playerId,
    QueuedAction storage _queuedAction,
    uint _combatElapsedTime,
    ItemNFT _itemNFT,
    CombatStats memory _combatStats,
    CombatStats memory _enemyCombatStats
  ) private returns (bool died) {
    uint16 foodConsumed;
    // Figure out how much food should be used
    (foodConsumed, died) = PlayerLibrary.foodConsumedView(
      _from,
      _queuedAction,
      _combatElapsedTime,
      _itemNFT,
      _combatStats,
      _enemyCombatStats
    );

    _processConsumable(
      _from,
      _playerId,
      _itemNFT,
      _queuedAction.regenerateId,
      foodConsumed,
      _queuedAction.attire.queueId
    );
  }

  function _cacheCombatStats(
    Player storage _player,
    uint32 _healthSkillPoints,
    Skill _skill,
    uint32 _skillPoints
  ) private {
    {
      int16 level = int16(_findLevel(_healthSkillPoints));
      _player.combatStats.health = level;
    }

    int16 level = int16(_findLevel(_skillPoints));
    if (_skill == Skill.ATTACK) {
      _player.combatStats.attack = level;
    } else if (_skill == Skill.MAGIC) {
      _player.combatStats.magic = level;
    }
    /* else if (_skill == Skill.RANGED) {
            _player.combatStats.attack = level;
          } */
    else if (_skill == Skill.DEFENCE) {
      _player.combatStats.defence = level;
    }
  }

  // Index not level, add one after (check for > max)
  function _findLevel(uint256 xp) private pure returns (uint16) {
    uint256 low = 0;
    uint256 high = 100;

    while (low < high) {
      uint256 mid = _average(low, high);

      // Note that mid will always be strictly less than high (i.e. it will be a valid array index)
      // Math.average rounds down (it does integer division with truncation).
      if (_getXP(mid) > xp) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    if (low > 0) {
      return uint16(low);
    } else {
      return 1;
    }
  }

  function _average(uint256 a, uint256 b) private pure returns (uint256) {
    // (a + b) / 2 can overflow.
    return (a & b) + (a ^ b) / 2;
  }

  function _getXP(uint256 _index) private pure returns (uint24) {
    uint256 index = _index * 3;
    return uint24(arr[index] | (bytes3(arr[index + 1]) >> 8) | (bytes3(arr[index + 2]) >> 16));
  }

  function _claimRandomRewards(uint _playerId) public isOwnerOfPlayerAndActive(_playerId) {
    (bool success, ) = implRewards.delegatecall(abi.encodeWithSignature("claimRandomRewards(uint256)", _playerId));
    require(success);
  }

  function _getRewards(
    uint40 _skillEndTime,
    uint _elapsedTime,
    uint16 _actionId
  ) private returns (uint[] memory newIds, uint[] memory newAmounts) {
    (bool success, bytes memory data) = implRewards.delegatecall(
      abi.encodeWithSignature("getRewards(uint40,uint256,uint16)", _skillEndTime, _elapsedTime, _actionId)
    );
    require(success);
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
