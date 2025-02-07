// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PlayersBase} from "./PlayersBase.sol";

import {RandomnessBeacon} from "../RandomnessBeacon.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {PlayersLibrary} from "./PlayersLibrary.sol";
import {SkillLibrary} from "../libraries/SkillLibrary.sol";
import {CombatStyleLibrary} from "../libraries/CombatStyleLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplQueueActions is PlayersBase {
  using SkillLibrary for uint8;
  using SkillLibrary for Skill;
  using CombatStyleLibrary for uint8;

  function startActions(
    uint256 playerId,
    QueuedActionInput[] memory queuedActionInputs,
    uint16 boostItemTokenId,
    uint8 boostStartReverseIndex,
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStrategy queueStrategy
  ) external {
    address from = msg.sender;

    Player storage player = _players[playerId];
    uint256 previousActionQueueLength = player.actionQueue.length;
    uint256 totalTimespan;
    (
      QueuedAction[] memory remainingQueuedActions,
      PendingQueuedActionData memory currentActionProcessed
    ) = _processActions(from, playerId);

    uint remainingQueuedActionsLength = remainingQueuedActions.length;

    if (queueStrategy == ActionQueueStrategy.OVERWRITE) {
      if (player.actionQueue.length != 0) {
        // Clear action queue
        delete player.actionQueue;
      }
      // Don't care about remaining actions
      assembly ("memory-safe") {
        mstore(remainingQueuedActions, 0)
      }

      require(queuedActionInputs.length <= MAX_QUEUEABLE_ACTIONS, TooManyActionsQueued());
    } else {
      if (queueStrategy == ActionQueueStrategy.KEEP_LAST_IN_PROGRESS && remainingQueuedActions.length > 1) {
        // Only want one
        assembly ("memory-safe") {
          mstore(remainingQueuedActions, 1)
        }
      }

      // Keep remaining actions
      require(
        remainingQueuedActions.length + queuedActionInputs.length <= MAX_QUEUEABLE_ACTIONS,
        TooManyActionsQueuedSomeAlreadyExist()
      );
      player.actionQueue = remainingQueuedActions;
      for (uint256 i; i < remainingQueuedActions.length; ++i) {
        totalTimespan += remainingQueuedActions[i].timespan;
      }
    }

    if (
      (queueStrategy == ActionQueueStrategy.KEEP_LAST_IN_PROGRESS || queueStrategy == ActionQueueStrategy.APPEND) &&
      remainingQueuedActions.length != 0
    ) {
      _setPrevPlayerState(player, currentActionProcessed);
    } else {
      _clearCurrentActionProcessed(playerId);
    }

    uint256 queueId = _nextQueueId;
    uint256 queuedActionsLength = queuedActionInputs.length;

    if (remainingQueuedActions.length != 0 || queuedActionInputs.length != 0) {
      player.currentActionStartTimestamp = uint40(block.timestamp);
    } else {
      player.currentActionStartTimestamp = 0;
    }

    uint256 totalLength = remainingQueuedActions.length + queuedActionInputs.length;
    QueuedAction[] memory queuedActions = new QueuedAction[](totalLength);

    for (uint256 i; i != remainingQueuedActions.length; ++i) {
      queuedActions[i] = remainingQueuedActions[i];
    }

    uint256 veryStartTime = block.timestamp - totalTimespan;
    uint256 startTimeNewActions = veryStartTime;
    for (uint256 i; i != queuedActionsLength; ++i) {
      if (totalTimespan + queuedActionInputs[i].timespan > MAX_TIME) {
        // Must be the last one which will exceed the max time
        require(i == queuedActionsLength - 1, ActionTimespanExceedsMaxTime());

        uint256 remainder;
        // Allow to queue the excess for any running action up to 1 hour
        if (remainingQueuedActions.length != 0) {
          remainder = remainingQueuedActions[0].timespan % 1 hours;
        } else {
          remainder = queuedActionInputs[0].timespan % 1 hours;
        }
        queuedActionInputs[i].timespan = uint24(MAX_TIME + remainder - totalTimespan);
      }

      QueuedAction memory queuedAction = _addToQueue(
        from,
        playerId,
        queuedActionInputs[i],
        uint64(queueId),
        uint40(startTimeNewActions)
      );
      queuedActions[remainingQueuedActions.length + i] = queuedAction;

      ++queueId;
      totalTimespan += queuedActionInputs[i].timespan;
      startTimeNewActions += queuedActionInputs[i].timespan;
    }

    // Create an array from remainingAttire and queuedActions passed in
    Attire[] memory attire = new Attire[](totalLength);
    for (uint256 i = 0; i < remainingQueuedActions.length; ++i) {
      attire[i] = _attire[playerId][remainingQueuedActions[i].queueId];
    }
    for (uint256 i = 0; i < queuedActionInputs.length; ++i) {
      attire[i + remainingQueuedActions.length] = queuedActionInputs[i].attire;
    }

    uint256 numActionsFinished = previousActionQueueLength > remainingQueuedActionsLength
      ? previousActionQueueLength - remainingQueuedActionsLength
      : 0;

    setInitialCheckpoints(from, playerId, numActionsFinished, queuedActions, attire);
    emit SetActionQueue(from, playerId, queuedActions, attire, player.currentActionStartTimestamp);

    //    assert(totalTimespan < MAX_TIME + 1 hours); // Should never happen (TODO: Can uncomment when we have more bytecode available)
    _nextQueueId = uint64(queueId);

    if (questId != 0) {
      _quests.activateQuest(from, playerId, questId);
    }

    if (boostItemTokenId != NONE) {
      uint40 boostStartTimestamp;
      if (boostStartReverseIndex >= (queuedActions.length - 1)) {
        boostStartTimestamp = uint40(block.timestamp);
      } else {
        boostStartTimestamp = uint40(player.currentActionStartTimestamp);
        assert(player.currentActionStartTimestamp != 0);
        uint256 bounds = queuedActions.length - boostStartReverseIndex - 1;
        for (uint256 i = 0; i < bounds; ++i) {
          boostStartTimestamp += queuedActions[i].timespan;
        }
      }
      _consumeBoost(from, playerId, boostItemTokenId, boostStartTimestamp);
    }

    if (donationAmount != 0) {
      _donate(from, playerId, donationAmount);
    }
  }

  function _consumeBoost(address from, uint256 playerId, uint16 itemTokenId, uint40 boostStartTimestamp) private {
    Item memory item = _itemNFT.getItem(itemTokenId);
    require(item.equipPosition == EquipPosition.BOOST_VIAL, NotABoostVial());

    ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];

    if (playerBoost.itemTokenId != NONE) {
      // If there's an active boost which hasn't been consumed yet, then we can mint it back
      if (playerBoost.startTime > block.timestamp) {
        _itemNFT.mint(from, playerBoost.itemTokenId, 1);
        if (playerBoost.lastItemTokenId != NONE) {
          Item memory lastItem = _itemNFT.getItem(playerBoost.lastItemTokenId);
          uint40 lastFullEndTimestamp = playerBoost.lastStartTime + lastItem.boostDuration;
          // Update last boost to either extend or cut it back, to ensure it lasts sufficiently long and also has no overlaps
          bool isOverlapping = lastFullEndTimestamp > boostStartTimestamp;
          playerBoost.lastDuration = uint24(
            Math.min(
              lastItem.boostDuration,
              isOverlapping
                ? (boostStartTimestamp - playerBoost.lastStartTime)
                : (lastFullEndTimestamp - playerBoost.lastStartTime)
            )
          );
          emit UpdateLastBoost(
            playerId,
            BoostInfo({
              startTime: playerBoost.lastStartTime,
              duration: playerBoost.lastDuration,
              value: playerBoost.lastValue,
              boostType: playerBoost.lastBoostType,
              itemTokenId: playerBoost.lastItemTokenId
            })
          );
        }
      } else {
        uint40 currentBoostEndTimestamp = playerBoost.startTime + playerBoost.duration;

        // Timestamp either goes to the full extend of the boost, or up to the timestamp of the next boost
        uint40 timestamp = uint40(Math.min(boostStartTimestamp, currentBoostEndTimestamp));
        _setLastBoost(playerId, playerBoost, uint24(timestamp - playerBoost.startTime));
      }
    }

    // Burn it after in case we minted same one again
    _itemNFT.burn(from, itemTokenId, 1);

    playerBoost.startTime = boostStartTimestamp;
    playerBoost.duration = item.boostDuration;
    playerBoost.value = item.boostValue;
    playerBoost.boostType = item.boostType;
    playerBoost.itemTokenId = itemTokenId;

    emit ConsumeBoostVial(
      from,
      playerId,
      BoostInfo({
        startTime: boostStartTimestamp,
        duration: item.boostDuration,
        value: item.boostValue,
        boostType: item.boostType,
        itemTokenId: itemTokenId
      })
    );
  }

  function checkAddToQueue(
    address from,
    uint256 playerId,
    QueuedActionInput memory queuedActionInput,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    QuestState memory pendingQuestState
  ) public view returns (bool setAttire) {
    require(queuedActionInput.attire.reserved1 == NONE, UnsupportedAttire(queuedActionInput.attire.reserved1));
    if (queuedActionInput.regenerateId != NONE) {
      require(
        _itemNFT.getItem(queuedActionInput.regenerateId).equipPosition == EquipPosition.FOOD,
        UnsupportedRegenerateItem()
      );
    }

    uint16 actionId = queuedActionInput.actionId;
    ActionInfo memory actionInfo = _worldActions.getActionInfo(actionId);
    require(actionInfo.isAvailable, ActionNotAvailable());

    require(
      actionInfo.minXP == 0 ||
        _getRealXP(actionInfo.skill._asSkill(), _playerXP[playerId], pendingQueuedActionProcessed, pendingQuestState) >=
        actionInfo.minXP,
      ActionMinimumXPNotReached()
    );

    bool isCombat = actionInfo.skill._isSkillCombat();
    bool isPlayerEvolved = _isEvolved(playerId);

    // Check the actionChoice is valid
    ActionChoice memory actionChoice;
    if (actionInfo.actionChoiceRequired) {
      require(queuedActionInput.choiceId != NONE, ActionChoiceIdRequired());
      actionChoice = _worldActions.getActionChoice(
        isCombat ? NONE : queuedActionInput.actionId,
        queuedActionInput.choiceId
      );

      require(
        actionChoice.skill1._asSkill() == Skill.NONE ||
          _getRealXP(
            actionChoice.skill1._asSkill(),
            _playerXP[playerId],
            pendingQueuedActionProcessed,
            pendingQuestState
          ) >=
          actionChoice.skillMinXP1,
        ActionChoiceMinimumXPNotReached()
      );

      require(
        actionChoice.skill2._asSkill() == Skill.NONE ||
          _getRealXP(
            actionChoice.skill2._asSkill(),
            _playerXP[playerId],
            pendingQueuedActionProcessed,
            pendingQuestState
          ) >=
          actionChoice.skillMinXP2,
        ActionChoiceMinimumXPNotReached()
      );

      require(
        actionChoice.skill3._asSkill() == Skill.NONE ||
          _getRealXP(
            actionChoice.skill3._asSkill(),
            _playerXP[playerId],
            pendingQueuedActionProcessed,
            pendingQuestState
          ) >=
          actionChoice.skillMinXP3,
        ActionChoiceMinimumXPNotReached()
      );

      require(actionChoice.skill._asSkill() != Skill.NONE, InvalidSkill());

      // Timespan should be exact for the rate when travelling (e.g if it takes 2 hours, 2 hours should be queued)
      // TODO: travelling not supported yet
      /*      if (actionInfo.skill._asSkill() == Skill.TRAVELING) {
        require(queuedActionInput.timespan == (RATE_MUL * 3600) / actionChoice.rate, InvalidTravellingTimespan());
      } */

      bool actionChoiceFullModeOnly = uint8(actionChoice.packedData >> IS_FULL_MODE_BIT) & 1 == 1;
      require(!actionChoiceFullModeOnly || isPlayerEvolved, PlayerNotUpgraded());
      bool actionChoiceIsAvailable = uint8(actionChoice.packedData >> IS_AVAILABLE_BIT) & 1 == 1;
      require(actionChoiceIsAvailable, ActionChoiceNotAvailable());

      // Check whether the quest is completed
      if (actionChoice.questPrerequisiteId != 0) {
        require(_quests.isQuestCompleted(playerId, actionChoice.questPrerequisiteId), DependentQuestNotCompleted());
      }
    } else {
      require(queuedActionInput.choiceId == NONE, ActionChoiceIdNotRequired());
    }

    require(!actionInfo.isFullModeOnly || isPlayerEvolved, PlayerNotUpgraded());
    require(actionInfo.isAvailable, ActionNotAvailable());
    require(queuedActionInput.timespan != 0, EmptyTimespan());
    // Check combatStyle is only selected if queuedAction is combat
    require(isCombat == queuedActionInput.combatStyle._isCombatStyle(), InvalidCombatStyle());

    Attire memory attire = queuedActionInput.attire;
    if (
      attire.head != NONE ||
      attire.neck != NONE ||
      attire.body != NONE ||
      attire.arms != NONE ||
      attire.legs != NONE ||
      attire.feet != NONE ||
      attire.ring != NONE
    ) {
      _checkAttire(from, playerId, isPlayerEvolved, attire, pendingQueuedActionProcessed, pendingQuestState);
      setAttire = true;
    }

    // Check whether the quest is completed
    if (actionInfo.questPrerequisiteId != 0) {
      require(_quests.isQuestCompleted(playerId, actionInfo.questPrerequisiteId), DependentQuestNotCompleted());
    }

    _checkHandEquipments(
      from,
      playerId,
      isPlayerEvolved,
      [queuedActionInput.rightHandEquipmentTokenId, queuedActionInput.leftHandEquipmentTokenId], // Must be in order of right -> left
      actionInfo.handItemTokenIdRangeMin,
      actionInfo.handItemTokenIdRangeMax,
      isCombat,
      actionChoice,
      pendingQueuedActionProcessed,
      pendingQuestState
    );

    _checkFood(playerId, isPlayerEvolved, queuedActionInput, pendingQueuedActionProcessed, pendingQuestState);

    _checkPet(from, isPlayerEvolved, queuedActionInput.petId);
  }

  // Add any new xp gained from previous actions now completed that haven't been pushed to the blockchain yet. For instance
  function _getRealXP(
    Skill skill,
    PackedXP storage packedXP,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    QuestState memory questState
  ) private view returns (uint256 xp) {
    xp = PlayersLibrary.readXP(skill, packedXP);
    // Add any pending XP from queued actions
    for (uint256 i; i < pendingQueuedActionProcessed.skills.length; ++i) {
      if (pendingQueuedActionProcessed.skills[i] == skill) {
        xp += pendingQueuedActionProcessed.xpGainedSkills[i];
      }
    }

    // Add any pending XP from quests
    for (uint256 i; i < questState.skills.length; ++i) {
      if (questState.skills[i] == skill) {
        xp += questState.xpGainedSkills[i];
      }
    }
  }

  function _addToQueue(
    address from,
    uint256 playerId,
    QueuedActionInput memory queuedActionInput,
    uint64 queueId,
    uint40 startTime
  ) private returns (QueuedAction memory queuedAction) {
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed; // Empty
    QuestState memory pendingQuestState; // Empty

    bool setAttire = checkAddToQueue(
      from,
      playerId,
      queuedActionInput,
      pendingQueuedActionProcessed,
      pendingQuestState
    );
    if (setAttire) {
      _attire[playerId][queueId] = queuedActionInput.attire;
    }

    queuedAction.timespan = queuedActionInput.timespan;
    queuedAction.queueId = queueId;
    queuedAction.actionId = queuedActionInput.actionId;
    queuedAction.regenerateId = queuedActionInput.regenerateId;
    queuedAction.choiceId = queuedActionInput.choiceId;
    queuedAction.rightHandEquipmentTokenId = queuedActionInput.rightHandEquipmentTokenId;
    queuedAction.leftHandEquipmentTokenId = queuedActionInput.leftHandEquipmentTokenId;
    queuedAction.combatStyle = queuedActionInput.combatStyle;

    bytes1 packed = bytes1(uint8(0x1)); // isValid
    // Only set variables in the second storage slot if it's necessary
    if (queuedActionInput.petId != 0) {
      packed |= bytes1(uint8(1 << HAS_PET_BIT));
      queuedAction.petId = queuedActionInput.petId;
      _petNFT.assignPet(from, playerId, queuedActionInput.petId, startTime);
    }
    queuedAction.packed = packed;
    _players[playerId].actionQueue.push(queuedAction);
  }

  function _checkFood(
    uint256 playerId,
    bool isPlayerEvolved,
    QueuedActionInput memory queuedActionInput,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    QuestState memory questState
  ) private view {
    if (queuedActionInput.regenerateId != NONE) {
      (Skill skill, uint32 minXP, , bool isFoodFullModeOnly) = _itemNFT.getEquipPositionAndMinRequirement(
        queuedActionInput.regenerateId
      );
      require(
        _getRealXP(skill, _playerXP[playerId], pendingQueuedActionProcessed, questState) >= minXP,
        ConsumableMinimumXPNotReached()
      );
      // TODO: Untested
      require(!isFoodFullModeOnly || isPlayerEvolved, PlayerNotUpgraded());
    }
  }

  function _checkPet(address from, bool isPlayerEvolved, uint256 _petId) private view {
    if (_petId != 0) {
      // All pets are upgrade only
      require(isPlayerEvolved, PlayerNotUpgraded());
      require(_petNFT.balanceOf(from, _petId) != 0, PetNotOwned());
    }
  }

  function _checkEquipPosition(Attire memory attire) private view {
    uint256 attireLength;
    uint16[] memory itemTokenIds = new uint16[](7);
    EquipPosition[] memory expectedEquipPositions = new EquipPosition[](7);
    if (attire.head != NONE) {
      itemTokenIds[attireLength] = attire.head;
      expectedEquipPositions[attireLength] = EquipPosition.HEAD;
      attireLength++;
    }
    if (attire.neck != NONE) {
      itemTokenIds[attireLength] = attire.neck;
      expectedEquipPositions[attireLength] = EquipPosition.NECK;
      attireLength++;
    }
    if (attire.body != NONE) {
      itemTokenIds[attireLength] = attire.body;
      expectedEquipPositions[attireLength] = EquipPosition.BODY;
      attireLength++;
    }
    if (attire.arms != NONE) {
      itemTokenIds[attireLength] = attire.arms;
      expectedEquipPositions[attireLength] = EquipPosition.ARMS;
      attireLength++;
    }
    if (attire.legs != NONE) {
      itemTokenIds[attireLength] = attire.legs;
      expectedEquipPositions[attireLength] = EquipPosition.LEGS;
      attireLength++;
    }
    if (attire.feet != NONE) {
      itemTokenIds[attireLength] = attire.feet;
      expectedEquipPositions[attireLength] = EquipPosition.FEET;
      attireLength++;
    }
    if (attire.ring != NONE) {
      itemTokenIds[attireLength] = attire.ring;
      expectedEquipPositions[attireLength] = EquipPosition.RING;
      attireLength++;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      EquipPosition[] memory equipPositions = _itemNFT.getEquipPositions(itemTokenIds);
      for (uint256 i; i < attireLength; ++i) {
        require(expectedEquipPositions[i] == equipPositions[i], InvalidEquipPosition());
      }
    }
  }

  // Checks they have sufficient balance to equip the items, and minimum skill points
  function _checkAttire(
    address from,
    uint256 playerId,
    bool isPlayerEvolved,
    Attire memory attire,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    QuestState memory questState
  ) private view {
    // Check the user has these items
    _checkEquipPosition(attire);

    bool skipNonFullAttire;
    (uint16[] memory itemTokenIds, uint256[] memory balances) = PlayersLibrary.getAttireWithCurrentBalance(
      from,
      attire,
      address(_itemNFT),
      skipNonFullAttire
    );
    if (itemTokenIds.length != 0) {
      (Skill[] memory skills, uint32[] memory minXPs, bool[] memory isItemFullModeOnly) = _itemNFT.getMinRequirements(
        itemTokenIds
      );
      for (uint256 i = 0; i < balances.length; ++i) {
        require(
          _getRealXP(skills[i], _playerXP[playerId], pendingQueuedActionProcessed, questState) >= minXPs[i],
          AttireMinimumXPNotReached()
        );
        require(balances[i] != 0, NoItemBalance(itemTokenIds[i]));
        require(isPlayerEvolved || !isItemFullModeOnly[i], PlayerNotUpgraded());
      }
    }
  }

  function _checkHandEquipments(
    address from,
    uint256 playerId,
    bool isPlayerEvolved,
    uint16[2] memory equippedItemTokenIds, // [right, left]
    uint16 handItemTokenIdRangeMin,
    uint16 handItemTokenIdRangeMax,
    bool isCombat,
    ActionChoice memory actionChoice,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    QuestState memory questState
  ) private view {
    bool twoHanded;
    for (uint256 i = 0; i < equippedItemTokenIds.length; ++i) {
      bool isRightHand = i == 0;
      uint16 equippedItemTokenId = equippedItemTokenIds[i];
      if (equippedItemTokenId != NONE) {
        require(
          handItemTokenIdRangeMin == NONE ||
            (equippedItemTokenId >= handItemTokenIdRangeMin && equippedItemTokenId <= handItemTokenIdRangeMax),
          InvalidHandEquipment(equippedItemTokenId)
        );

        require(
          actionChoice.handItemTokenIdRangeMin == NONE ||
            (equippedItemTokenId >= actionChoice.handItemTokenIdRangeMin &&
              equippedItemTokenId <= actionChoice.handItemTokenIdRangeMax),
          InvalidHandEquipment(equippedItemTokenId)
        );

        uint256 balance = _itemNFT.balanceOf(from, equippedItemTokenId);
        require(balance != 0, NoItemBalance(equippedItemTokenId));

        (Skill skill, uint32 minXP, EquipPosition equipPosition, bool isItemFullModeOnly) = _itemNFT
          .getEquipPositionAndMinRequirement(equippedItemTokenId);
        require(
          _getRealXP(skill, _playerXP[playerId], pendingQueuedActionProcessed, questState) >= minXP,
          ItemMinimumXPNotReached()
        );
        require(!isItemFullModeOnly || isPlayerEvolved, PlayerNotUpgraded());

        if (isRightHand) {
          require(
            equipPosition == EquipPosition.RIGHT_HAND || equipPosition == EquipPosition.BOTH_HANDS,
            IncorrectRightHandEquipment(equippedItemTokenId)
          );
          twoHanded = equipPosition == EquipPosition.BOTH_HANDS;
        } else {
          // left hand, if we've equipped a 2 handed weapon, we can't equip anything else
          require(!twoHanded, CannotEquipTwoHandedAndOtherEquipment());
          require(equipPosition == EquipPosition.LEFT_HAND, IncorrectLeftHandEquipment(equippedItemTokenId));
        }
      } else {
        // Only combat actions can have no equipment unless the actionChoice specifies that it requires it
        // e.g smithing doesn't require anything equipped
        require(
          !((!isCombat && handItemTokenIdRangeMin != NONE) || actionChoice.handItemTokenIdRangeMin != NONE) ||
            !isRightHand,
          IncorrectEquippedItem()
        );
      }
    }
  }

  function _clearActionQueue(address from, uint256 playerId) private {
    QueuedAction[] memory queuedActions;
    Attire[] memory attire;
    uint256 startTime = 0;
    _setActionQueue(from, playerId, queuedActions, attire, startTime);
  }

  function _clearCurrentActionProcessed(uint256 playerId) private {
    Player storage player = _players[playerId];
    player.currentActionProcessedSkill1 = Skill.NONE;
    player.currentActionProcessedXPGained1 = 0;
    player.currentActionProcessedSkill2 = Skill.NONE;
    player.currentActionProcessedXPGained2 = 0;
    player.currentActionProcessedSkill3 = Skill.NONE;
    player.currentActionProcessedXPGained3 = 0;
    player.currentActionProcessedFoodConsumed = 0;
    player.currentActionProcessedBaseInputItemsConsumedNum = 0;
  }

  // Consumes all the actions in the queue up to this time.
  // Mints the boost vial if it hasn't been consumed at all yet and removes any active ones
  // Removes all the actions from the queue
  function clearEverything(address from, uint256 playerId, bool processTheActions) external {
    if (processTheActions) {
      _processActions(from, playerId);
    }
    // Ensure player info is cleared
    _clearCurrentActionProcessed(playerId);
    Player storage player = _players[playerId];
    player.currentActionStartTimestamp = 0;

    emit ClearAll(from, playerId);
    _clearActionQueue(from, playerId);
    // Remove any active boost
    ExtendedBoostInfo storage playerBoost = _activeBoosts[playerId];

    if (playerBoost.extraBoostType != BoostType.NONE) {
      _clearPlayerExtraBoost(playerId);
      _clearPlayerLastExtraBoost(playerId);
    }

    if (playerBoost.boostType != BoostType.NONE) {
      uint256 startTime = playerBoost.startTime;
      uint16 itemTokenId = playerBoost.itemTokenId;
      _clearPlayerMainBoost(from, playerId);
      if (playerBoost.lastItemTokenId != NONE) {
        _clearPlayerLastBoost(playerId);
      }
      if (startTime > block.timestamp) {
        // Mint it if it hasn't been consumed yet, don't worry about
        _itemNFT.mint(from, itemTokenId, 1);
      }
    }
  }

  function setInitialCheckpoints(
    address from,
    uint256 playerId,
    uint256 numActionsFinished,
    QueuedAction[] memory queuedActions,
    Attire[] memory attire
  ) public {
    uint256 checkpoint = _players[playerId].currentActionStartTimestamp;
    if (queuedActions.length > 0) {
      checkpoint -= queuedActions[0].prevProcessedTime;
    }
    if (checkpoint == 0) {
      checkpoint = block.timestamp;
    }
    _activePlayerInfos[from].checkpoint = uint40(checkpoint);

    if (numActionsFinished > 0) {
      for (uint256 i; i < MAX_QUEUEABLE_ACTIONS; ++i) {
        if (i + numActionsFinished < MAX_QUEUEABLE_ACTIONS) {
          // Shift the checkpoint left
          _checkpointEquipments[playerId][i] = _checkpointEquipments[playerId][i + numActionsFinished];
        } else {
          delete _checkpointEquipments[playerId][i];
        }
      }
    }

    for (uint256 i; i < MAX_QUEUEABLE_ACTIONS; ++i) {
      if (i < queuedActions.length) {
        if (queuedActions[i].prevProcessedTime == 0) {
          // Set the checkpoints
          uint16[10] memory itemTokenIds; // attire for 8 elements and then left + right hand equipment
          itemTokenIds[0] = attire[i].head;
          itemTokenIds[1] = attire[i].neck;
          itemTokenIds[2] = attire[i].body;
          itemTokenIds[3] = attire[i].arms;
          itemTokenIds[4] = attire[i].legs;
          itemTokenIds[5] = attire[i].feet;
          itemTokenIds[6] = attire[i].ring;
          //          itemTokenIds[7] = attire[i].reserved1;
          itemTokenIds[8] = queuedActions[i].leftHandEquipmentTokenId;
          itemTokenIds[9] = queuedActions[i].rightHandEquipmentTokenId;

          uint256[] memory balances = _itemNFT.balanceOfs10(from, itemTokenIds);
          // Only store up to 16 bits for storage efficiency
          uint16[10] memory cappedBalances;
          for (uint256 j = 0; j < cappedBalances.length; ++j) {
            cappedBalances[j] = balances[j] > type(uint16).max ? type(uint16).max : uint16(balances[j]);
          }
          _checkpointEquipments[playerId][i].itemTokenIds = itemTokenIds;
          _checkpointEquipments[playerId][i].balances = cappedBalances;
        }

        if (i == 0) {
          _activePlayerInfos[from].timespan = queuedActions[i].timespan + queuedActions[i].prevProcessedTime;
        } else if (i == 1) {
          _activePlayerInfos[from].timespan1 = queuedActions[i].timespan + queuedActions[i].prevProcessedTime;
        } else if (i == 2) {
          _activePlayerInfos[from].timespan2 = queuedActions[i].timespan + queuedActions[i].prevProcessedTime;
        } else {
          assert(false);
        }
      }
    }
  }

  function validateActionsImpl(
    address owner,
    uint256 playerId,
    QueuedActionInput[] memory queuedActionInputs
  ) external view returns (bool[] memory successes, bytes[] memory reasons) {
    PendingQueuedActionState memory pendingQueuedActionState = _pendingQueuedActionState(owner, playerId);
    successes = new bool[](queuedActionInputs.length);
    reasons = new bytes[](queuedActionInputs.length);

    for (uint256 i; i < queuedActionInputs.length; ++i) {
      try
        this.checkAddToQueue(
          owner,
          playerId,
          queuedActionInputs[i],
          pendingQueuedActionState.processedData,
          pendingQueuedActionState.quests
        )
      {
        successes[i] = true;
      } catch (bytes memory _reason) {
        reasons[i] = _reason;
      }
    }
  }
}
