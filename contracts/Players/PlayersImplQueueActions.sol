// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PlayersImplBase} from "./PlayersImplBase.sol";
import {PlayersBase} from "./PlayersBase.sol";

import {World} from "../World.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";

import {PlayersLibrary} from "./PlayersLibrary.sol";
import {SkillLibrary} from "../libraries/SkillLibrary.sol";
import {CombatStyleLibrary} from "../libraries/CombatStyleLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplQueueActions is PlayersImplBase, PlayersBase {
  using SkillLibrary for uint8;
  using SkillLibrary for Skill;
  using CombatStyleLibrary for uint8;

  constructor() {
    _checkStartSlot();
  }

  function startActions(
    uint256 playerId,
    QueuedActionInput[] memory queuedActionInputs,
    uint16 boostItemTokenId,
    uint40 boostStartTime,
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStatus queueStatus
  ) external {
    address from = msg.sender;
    uint256 totalTimespan;
    (
      QueuedAction[] memory remainingQueuedActions,
      PendingQueuedActionData memory currentActionProcessed
    ) = _processActions(from, playerId);

    Player storage player = _players[playerId];
    if (queueStatus == ActionQueueStatus.NONE) {
      if (player.actionQueue.length != 0) {
        // Clear action queue
        delete player.actionQueue;
      }
      // Don't care about remaining actions
      assembly ("memory-safe") {
        mstore(remainingQueuedActions, 0)
      }

      require(queuedActionInputs.length <= 3, TooManyActionsQueued());
    } else {
      if (queueStatus == ActionQueueStatus.KEEP_LAST_IN_PROGRESS && remainingQueuedActions.length > 1) {
        // Only want one
        assembly ("memory-safe") {
          mstore(remainingQueuedActions, 1)
        }
      }

      // Keep remaining actions
      require(remainingQueuedActions.length + queuedActionInputs.length <= 3, TooManyActionsQueuedSomeAlreadyExist());
      player.actionQueue = remainingQueuedActions;
      uint256 j = remainingQueuedActions.length;
      while (j != 0) {
        j--;
        totalTimespan += remainingQueuedActions[j].timespan;
      }
    }

    if (
      (queueStatus == ActionQueueStatus.KEEP_LAST_IN_PROGRESS || queueStatus == ActionQueueStatus.APPEND) &&
      remainingQueuedActions.length != 0
    ) {
      _setPrevPlayerState(player, currentActionProcessed);
    } else {
      _clearCurrentActionProcessed(playerId);
    }

    uint256 queueId = _nextQueueId;
    uint256 queuedActionsLength = queuedActionInputs.length;

    if (remainingQueuedActions.length != 0 || queuedActionInputs.length != 0) {
      player.currentActionStartTime = uint40(block.timestamp);
    } else {
      player.currentActionStartTime = 0;
    }

    uint256 totalLength = remainingQueuedActions.length + queuedActionInputs.length;
    QueuedAction[] memory queuedActions = new QueuedAction[](totalLength);

    QueuedActionExtra[] memory queuedActionsExtra = new QueuedActionExtra[](totalLength);

    for (uint256 i; i != remainingQueuedActions.length; ++i) {
      queuedActions[i] = remainingQueuedActions[i];
      queuedActionsExtra[i] = _queuedActionsExtra[i];
    }

    uint256 startTimeNewActions = block.timestamp - totalTimespan;
    for (uint256 iter; iter != queuedActionsLength; iter++) {
      if (totalTimespan + queuedActionInputs[iter].timespan > MAX_TIME_) {
        // Must be the last one which will exceed the max time
        require(iter == queuedActionsLength - 1, ActionTimespanExceedsMaxTime());

        uint256 remainder;
        // Allow to queue the excess for any running action up to 1 hour
        if (remainingQueuedActions.length != 0) {
          remainder = remainingQueuedActions[0].timespan % 1 hours;
        } else {
          remainder = queuedActionInputs[0].timespan % 1 hours;
        }
        queuedActionInputs[iter].timespan = uint24(MAX_TIME_ + remainder - totalTimespan);
      }

      (QueuedAction memory queuedAction, QueuedActionExtra memory queuedActionExtra) = _addToQueue(
        from,
        playerId,
        queuedActionInputs[iter],
        uint64(queueId),
        uint40(startTimeNewActions)
      );
      queuedActions[remainingQueuedActions.length + iter] = queuedAction;
      _queuedActionsExtra[remainingQueuedActions.length + iter] = queuedActionExtra;

      queueId++;
      totalTimespan += queuedActionInputs[iter].timespan;
      startTimeNewActions += queuedActionInputs[iter].timespan;
    }

    // Create an array from remainingAttire and queuedActions passed in
    uint256 length = remainingQueuedActions.length + queuedActionInputs.length;
    Attire[] memory attire = new Attire[](length);
    for (uint256 i = 0; i < remainingQueuedActions.length; ++i) {
      attire[i] = _attire[playerId][remainingQueuedActions[i].queueId];
    }
    for (uint256 i = 0; i < queuedActionInputs.length; ++i) {
      attire[i + remainingQueuedActions.length] = queuedActionInputs[i].attire;
    }

    emit SetActionQueue(from, playerId, queuedActions, attire, player.currentActionStartTime, queuedActionsExtra);

    assert(totalTimespan < MAX_TIME_ + 1 hours); // Should never happen
    _nextQueueId = uint56(queueId);

    if (questId != 0) {
      _quests.activateQuest(from, playerId, questId);
    }

    if (boostItemTokenId != NONE) {
      _consumeBoost(from, playerId, boostItemTokenId, boostStartTime);
    }

    if (donationAmount != 0) {
      _donate(from, playerId, donationAmount);
    }
  }

  function _consumeBoost(address from, uint256 playerId, uint16 itemTokenId, uint40 startTime) private {
    Item memory item = _itemNFT.getItem(itemTokenId);
    require(item.equipPosition == EquipPosition.BOOST_VIAL, NotABoostVial());
    require(startTime < block.timestamp + 7 days, StartTimeTooFarInTheFuture());
    if (startTime < block.timestamp) {
      startTime = uint40(block.timestamp);
    }

    // Burn it
    _itemNFT.burn(from, itemTokenId, 1);

    // If there's an active potion which hasn't been consumed yet, then we can mint it back
    PlayerBoostInfo storage playerBoost = _activeBoosts[playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime > block.timestamp) {
      _itemNFT.mint(from, playerBoost.itemTokenId, 1);
    }

    playerBoost.startTime = startTime;
    playerBoost.duration = item.boostDuration;
    playerBoost.value = item.boostValue;
    playerBoost.boostType = item.boostType;
    playerBoost.itemTokenId = itemTokenId;

    emit ConsumeBoostVial(
      from,
      playerId,
      BoostInfo({
        startTime: startTime,
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
    if (queuedActionInput.attire.reserved1 != NONE) {
      require(false, UnsupportedAttire());
    }
    if (queuedActionInput.regenerateId != NONE) {
      require(
        _itemNFT.getItem(queuedActionInput.regenerateId).equipPosition == EquipPosition.FOOD,
        UnsupportedRegenerateItem()
      );
    }

    uint16 actionId = queuedActionInput.actionId;
    ActionInfo memory actionInfo = _world.getActionInfo(actionId);
    require(actionInfo.isAvailable, ActionNotAvailable());

    require(
      actionInfo.minXP == 0 ||
        _getRealXP(actionInfo.skill._asSkill(), _playerXP[playerId], pendingQueuedActionProcessed, pendingQuestState) >=
        actionInfo.minXP,
      ActionMinimumXPNotReached()
    );

    bool isCombat = actionInfo.skill._isSkillCombat();
    bool isPlayerUpgraded = _isPlayerFullMode(playerId);

    // Check the actionChoice is valid
    ActionChoice memory actionChoice;
    if (actionInfo.actionChoiceRequired) {
      require(queuedActionInput.choiceId != NONE, ActionChoiceIdRequired());
      actionChoice = _world.getActionChoice(isCombat ? NONE : queuedActionInput.actionId, queuedActionInput.choiceId);

      require(
        _getRealXP(
          actionChoice.skill._asSkill(),
          _playerXP[playerId],
          pendingQueuedActionProcessed,
          pendingQuestState
        ) >= actionChoice.minXP,
        ActionChoiceMinimumXPNotReached()
      );

      require(
        actionChoice.minSkill2._asSkill() == Skill.NONE ||
          _getRealXP(
            actionChoice.minSkill2._asSkill(),
            _playerXP[playerId],
            pendingQueuedActionProcessed,
            pendingQuestState
          ) >=
          actionChoice.minXP2,
        ActionChoiceMinimumXPNotReached()
      );

      require(
        actionChoice.minSkill3._asSkill() == Skill.NONE ||
          _getRealXP(
            actionChoice.minSkill3._asSkill(),
            _playerXP[playerId],
            pendingQueuedActionProcessed,
            pendingQuestState
          ) >=
          actionChoice.minXP3,
        ActionChoiceMinimumXPNotReached()
      );

      require(actionChoice.skill._asSkill() != Skill.NONE, InvalidSkill());

      // Timespan should be exact for the rate when travelling (e.g if it takes 2 hours, 2 hours should be queued)
      if (actionInfo.skill._asSkill() == Skill.TRAVELING) {
        require(queuedActionInput.timespan == (RATE_MUL * 3600) / actionChoice.rate, InvalidTravellingTimespan());
      }

      bool actionChoiceFullModeOnly = uint8(actionChoice.packedData >> IS_FULL_MODE_BIT) & 1 == 1;
      require(!actionChoiceFullModeOnly || isPlayerUpgraded, PlayerNotUpgraded());
    } else if (queuedActionInput.choiceId != NONE) {
      require(false, ActionChoiceIdNotRequired());
    }

    require(!(actionInfo.isFullModeOnly && !isPlayerUpgraded), PlayerNotUpgraded());

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
      _checkAttire(from, playerId, isPlayerUpgraded, attire, pendingQueuedActionProcessed, pendingQuestState);
      setAttire = true;
    }

    _checkHandEquipments(
      from,
      playerId,
      isPlayerUpgraded,
      [queuedActionInput.leftHandEquipmentTokenId, queuedActionInput.rightHandEquipmentTokenId],
      actionInfo.handItemTokenIdRangeMin,
      actionInfo.handItemTokenIdRangeMax,
      isCombat,
      actionChoice,
      pendingQueuedActionProcessed,
      pendingQuestState
    );

    _checkFood(playerId, isPlayerUpgraded, queuedActionInput, pendingQueuedActionProcessed, pendingQuestState);

    _checkPet(from, isPlayerUpgraded, queuedActionInput.petId);
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
  ) private returns (QueuedAction memory queuedAction, QueuedActionExtra memory queuedActionExtra) {
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

    bytes1 packed = bytes1(uint8(1)); // isValid
    // Only set variables in the second storage slot if it's necessary
    if (queuedActionInput.petId != 0) {
      packed |= bytes1(uint8(1 << HAS_PET_BIT));
      queuedActionExtra.petId = queuedActionInput.petId;
      _queuedActionsExtra[queueId] = queuedActionExtra;
      _petNFT.assignPet(from, playerId, queuedActionInput.petId, startTime);
    }
    queuedAction.packed = packed;
    _players[playerId].actionQueue.push(queuedAction);
  }

  function _checkFood(
    uint256 playerId,
    bool isPlayerUpgraded,
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
      require(!isFoodFullModeOnly || isPlayerUpgraded, PlayerNotUpgraded());
    }
  }

  function _checkPet(address from, bool isPlayerUpgraded, uint256 _petId) private view {
    if (_petId != 0) {
      // All pets are upgrade only
      require(isPlayerUpgraded, PlayerNotUpgraded());
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
      for (uint256 iter; iter < attireLength; iter++) {
        require(expectedEquipPositions[iter] == equipPositions[iter], InvalidEquipPosition());
      }
    }
  }

  // Checks they have sufficient balance to equip the items, and minimum skill points
  function _checkAttire(
    address from,
    uint256 playerId,
    bool isPlayerUpgraded,
    Attire memory attire,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    QuestState memory questState
  ) private view {
    // Check the user has these items
    _checkEquipPosition(attire);

    bool skipNonFullAttire;
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates;
    (uint16[] memory itemTokenIds, uint256[] memory balances) = PlayersLibrary.getAttireWithBalance(
      from,
      attire,
      address(_itemNFT),
      skipNonFullAttire,
      pendingQueuedActionEquipmentStates
    );
    if (itemTokenIds.length != 0) {
      (Skill[] memory skills, uint32[] memory minXPs, bool[] memory isItemFullModeOnly) = _itemNFT.getMinRequirements(
        itemTokenIds
      );
      uint256 iter = balances.length;
      while (iter != 0) {
        iter--;
        require(
          _getRealXP(skills[iter], _playerXP[playerId], pendingQueuedActionProcessed, questState) >= minXPs[iter],
          AttireMinimumXPNotReached()
        );
        require(balances[iter] != 0, NoItemBalance(itemTokenIds[iter]));
        require(isPlayerUpgraded || !isItemFullModeOnly[iter], PlayerNotUpgraded());
      }
    }
  }

  function _checkHandEquipments(
    address from,
    uint256 playerId,
    bool isPlayerUpgraded,
    uint16[2] memory equippedItemTokenIds, // left, right
    uint16 handItemTokenIdRangeMin,
    uint16 handItemTokenIdRangeMax,
    bool isCombat,
    ActionChoice memory actionChoice,
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed,
    QuestState memory questState
  ) private view {
    uint256 iter = equippedItemTokenIds.length;
    bool twoHanded;
    while (iter != 0) {
      iter--;
      bool isRightHand = iter == 1;
      uint16 equippedItemTokenId = equippedItemTokenIds[iter];
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
        require(!isItemFullModeOnly || isPlayerUpgraded, PlayerNotUpgraded());

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
    QueuedActionExtra[] memory queuedActionsExtra;
    Attire[] memory attire;
    uint256 startTime = 0;
    _setActionQueue(from, playerId, queuedActions, queuedActionsExtra, attire, startTime);
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
  // Mints the boost vial if it hasn't been consumed at all yet, otherwise removese any active ones
  // Removes all the actions from the queue
  function clearEverything(address from, uint256 playerId, bool processTheActions) public {
    if (processTheActions) {
      _processActions(from, playerId);
    }
    // Ensure player info is cleared
    _clearCurrentActionProcessed(playerId);
    Player storage player = _players[playerId];
    player.currentActionStartTime = 0;

    emit ClearAll(from, playerId);
    _clearActionQueue(from, playerId);
    // Remove any active boost
    PlayerBoostInfo storage activeBoost = _activeBoosts[playerId];
    if (activeBoost.boostType != BoostType.NONE) {
      _clearPlayerMainBoost(playerId);
      if (activeBoost.startTime > block.timestamp) {
        // Mint it if it hasn't been consumed yet
        _itemNFT.mint(from, activeBoost.itemTokenId, 1);
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
