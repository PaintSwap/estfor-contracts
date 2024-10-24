// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

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
  using UnsafeMath for U256;
  using UnsafeMath for uint16;
  using UnsafeMath for uint32;
  using UnsafeMath for uint56;
  using UnsafeMath for uint64;
  using UnsafeMath for uint256;
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
      U256 j = remainingQueuedActions.length.asU256();
      while (j.neq(0)) {
        j = j.dec();
        totalTimespan += remainingQueuedActions[j.asUint256()].timespan;
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

    U256 queueId = _nextQueueId.asU256();
    U256 queuedActionsLength = queuedActionInputs.length.asU256();

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
    for (U256 iter; iter != queuedActionsLength; iter = iter.inc()) {
      uint256 i = iter.asUint256();

      if (totalTimespan.add(queuedActionInputs[i].timespan) > MAX_TIME_) {
        // Must be the last one which will exceed the max time
        require(iter == queuedActionsLength.dec(), ActionTimespanExceedsMaxTime());

        uint256 remainder;
        // Allow to queue the excess for any running action up to 1 hour
        if (remainingQueuedActions.length != 0) {
          remainder = remainingQueuedActions[0].timespan % 1 hours;
        } else {
          remainder = queuedActionInputs[0].timespan % 1 hours;
        }
        queuedActionInputs[i].timespan = uint24(MAX_TIME_.add(remainder).sub(totalTimespan));
      }

      (QueuedAction memory queuedAction, QueuedActionExtra memory queuedActionExtra) = _addToQueue(
        from,
        playerId,
        queuedActionInputs[i],
        queueId.asUint64(),
        uint40(startTimeNewActions)
      );
      queuedActions[remainingQueuedActions.length.add(i)] = queuedAction;
      _queuedActionsExtra[remainingQueuedActions.length.add(i)] = queuedActionExtra;

      queueId = queueId.inc();
      totalTimespan += queuedActionInputs[i].timespan;
      startTimeNewActions += queuedActionInputs[i].timespan;
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
    _nextQueueId = queueId.asUint56();

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

  function _consumeBoost(address from, uint256 playerId, uint16 _itemTokenId, uint40 _startTime) private {
    Item memory item = _itemNFT.getItem(_itemTokenId);
    require(item.equipPosition == EquipPosition.BOOST_VIAL, NotABoostVial());
    require(_startTime < block.timestamp + 7 days, StartTimeTooFarInTheFuture());
    if (_startTime < block.timestamp) {
      _startTime = uint40(block.timestamp);
    }

    // Burn it
    _itemNFT.burn(from, _itemTokenId, 1);

    // If there's an active potion which hasn't been consumed yet, then we can mint it back
    PlayerBoostInfo storage playerBoost = _activeBoosts[playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime > block.timestamp) {
      _itemNFT.mint(from, playerBoost.itemTokenId, 1);
    }

    playerBoost.startTime = _startTime;
    playerBoost.duration = item.boostDuration;
    playerBoost.value = item.boostValue;
    playerBoost.boostType = item.boostType;
    playerBoost.itemTokenId = _itemTokenId;

    emit ConsumeBoostVial(
      from,
      playerId,
      BoostInfo({
        startTime: _startTime,
        duration: item.boostDuration,
        value: item.boostValue,
        boostType: item.boostType,
        itemTokenId: _itemTokenId
      })
    );
  }

  function checkAddToQueue(
    address from,
    uint256 playerId,
    QueuedActionInput memory _queuedActionInput,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _pendingQuestState
  ) public view returns (bool setAttire) {
    if (_queuedActionInput.attire.reserved1 != NONE) {
      require(false, UnsupportedAttire());
    }
    if (_queuedActionInput.regenerateId != NONE) {
      require(
        _itemNFT.getItem(_queuedActionInput.regenerateId).equipPosition == EquipPosition.FOOD,
        UnsupportedRegenerateItem()
      );
    }

    uint16 actionId = _queuedActionInput.actionId;
    ActionInfo memory actionInfo = _world.getActionInfo(actionId);
    require(actionInfo.isAvailable, ActionNotAvailable());

    require(
      actionInfo.minXP == 0 ||
        _getRealXP(
          actionInfo.skill.asSkill(),
          _playerXP[playerId],
          _pendingQueuedActionProcessed,
          _pendingQuestState
        ) >=
        actionInfo.minXP,
      ActionMinimumXPNotReached()
    );

    bool isCombat = actionInfo.skill.asSkill().isCombat();
    bool isPlayerUpgraded = _isPlayerFullMode(playerId);

    // Check the actionChoice is valid
    ActionChoice memory actionChoice;
    if (actionInfo.actionChoiceRequired) {
      require(_queuedActionInput.choiceId != NONE, ActionChoiceIdRequired());
      actionChoice = _world.getActionChoice(isCombat ? NONE : _queuedActionInput.actionId, _queuedActionInput.choiceId);

      require(
        _getRealXP(
          actionChoice.skill.asSkill(),
          _playerXP[playerId],
          _pendingQueuedActionProcessed,
          _pendingQuestState
        ) >= actionChoice.minXP,
        ActionChoiceMinimumXPNotReached()
      );

      require(
        actionChoice.minSkill2.asSkill() == Skill.NONE ||
          _getRealXP(
            actionChoice.minSkill2.asSkill(),
            _playerXP[playerId],
            _pendingQueuedActionProcessed,
            _pendingQuestState
          ) >=
          actionChoice.minXP2,
        ActionChoiceMinimumXPNotReached()
      );

      require(
        actionChoice.minSkill3.asSkill() == Skill.NONE ||
          _getRealXP(
            actionChoice.minSkill3.asSkill(),
            _playerXP[playerId],
            _pendingQueuedActionProcessed,
            _pendingQuestState
          ) >=
          actionChoice.minXP3,
        ActionChoiceMinimumXPNotReached()
      );

      require(actionChoice.skill.asSkill() != Skill.NONE, InvalidSkill());

      // Timespan should be exact for the rate when travelling (e.g if it takes 2 hours, 2 hours should be queued)
      if (actionInfo.skill.asSkill() == Skill.TRAVELING) {
        require(_queuedActionInput.timespan == (RATE_MUL * 3600) / actionChoice.rate, InvalidTravellingTimespan());
      }

      bool actionChoiceFullModeOnly = uint8(actionChoice.packedData >> IS_FULL_MODE_BIT) & 1 == 1;
      require(!actionChoiceFullModeOnly || isPlayerUpgraded, PlayerNotUpgraded());
    } else if (_queuedActionInput.choiceId != NONE) {
      require(false, ActionChoiceIdNotRequired());
    }

    require(!(actionInfo.isFullModeOnly && !isPlayerUpgraded), PlayerNotUpgraded());

    require(_queuedActionInput.timespan != 0, EmptyTimespan());

    // Check combatStyle is only selected if queuedAction is combat
    require(isCombat == _queuedActionInput.combatStyle.isNotCombatStyle(CombatStyle.NONE), InvalidCombatStyle());

    Attire memory attire = _queuedActionInput.attire;
    if (
      attire.head != NONE ||
      attire.neck != NONE ||
      attire.body != NONE ||
      attire.arms != NONE ||
      attire.legs != NONE ||
      attire.feet != NONE ||
      attire.ring != NONE
    ) {
      _checkAttire(from, playerId, isPlayerUpgraded, attire, _pendingQueuedActionProcessed, _pendingQuestState);
      setAttire = true;
    }

    _checkHandEquipments(
      from,
      playerId,
      isPlayerUpgraded,
      [_queuedActionInput.leftHandEquipmentTokenId, _queuedActionInput.rightHandEquipmentTokenId],
      actionInfo.handItemTokenIdRangeMin,
      actionInfo.handItemTokenIdRangeMax,
      isCombat,
      actionChoice,
      _pendingQueuedActionProcessed,
      _pendingQuestState
    );

    _checkFood(playerId, isPlayerUpgraded, _queuedActionInput, _pendingQueuedActionProcessed, _pendingQuestState);

    _checkPet(from, isPlayerUpgraded, _queuedActionInput.petId);
  }

  // Add any new xp gained from previous actions now completed that haven't been pushed to the blockchain yet. For instance
  function _getRealXP(
    Skill _skill,
    PackedXP storage _packedXP,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _questState
  ) private view returns (uint256 xp) {
    xp = PlayersLibrary.readXP(_skill, _packedXP);
    // Add any pending XP from queued actions
    for (uint256 i; i < _pendingQueuedActionProcessed.skills.length; ++i) {
      if (_pendingQueuedActionProcessed.skills[i] == _skill) {
        xp += _pendingQueuedActionProcessed.xpGainedSkills[i];
      }
    }

    // Add any pending XP from quests
    for (uint256 i; i < _questState.skills.length; ++i) {
      if (_questState.skills[i] == _skill) {
        xp += _questState.xpGainedSkills[i];
      }
    }
  }

  function _addToQueue(
    address from,
    uint256 playerId,
    QueuedActionInput memory _queuedActionInput,
    uint64 _queueId,
    uint40 _startTime
  ) private returns (QueuedAction memory queuedAction, QueuedActionExtra memory queuedActionExtra) {
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed; // Empty
    QuestState memory pendingQuestState; // Empty
    bool setAttire = checkAddToQueue(
      from,
      playerId,
      _queuedActionInput,
      pendingQueuedActionProcessed,
      pendingQuestState
    );
    if (setAttire) {
      _attire[playerId][_queueId] = _queuedActionInput.attire;
    }

    queuedAction.timespan = _queuedActionInput.timespan;
    queuedAction.queueId = _queueId;
    queuedAction.actionId = _queuedActionInput.actionId;
    queuedAction.regenerateId = _queuedActionInput.regenerateId;
    queuedAction.choiceId = _queuedActionInput.choiceId;
    queuedAction.rightHandEquipmentTokenId = _queuedActionInput.rightHandEquipmentTokenId;
    queuedAction.leftHandEquipmentTokenId = _queuedActionInput.leftHandEquipmentTokenId;
    queuedAction.combatStyle = _queuedActionInput.combatStyle;

    bytes1 packed = bytes1(uint8(1)); // isValid
    // Only set variables in the second storage slot if it's necessary
    if (_queuedActionInput.petId != 0) {
      packed |= bytes1(uint8(1 << HAS_PET_BIT));
      queuedActionExtra.petId = _queuedActionInput.petId;
      _queuedActionsExtra[_queueId] = queuedActionExtra;
      _petNFT.assignPet(from, playerId, _queuedActionInput.petId, _startTime);
    }
    queuedAction.packed = packed;
    _players[playerId].actionQueue.push(queuedAction);
  }

  function _checkFood(
    uint256 playerId,
    bool _isPlayerUpgraded,
    QueuedActionInput memory _queuedActionInput,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _questState
  ) private view {
    if (_queuedActionInput.regenerateId != NONE) {
      (Skill skill, uint32 minXP, , bool isFoodFullModeOnly) = _itemNFT.getEquipPositionAndMinRequirement(
        _queuedActionInput.regenerateId
      );
      require(
        _getRealXP(skill, _playerXP[playerId], _pendingQueuedActionProcessed, _questState) >= minXP,
        ConsumableMinimumXPNotReached()
      );
      // TODO: Untested
      require(!isFoodFullModeOnly || _isPlayerUpgraded, PlayerNotUpgraded());
    }
  }

  function _checkPet(address from, bool _isPlayerUpgraded, uint256 _petId) private view {
    if (_petId != 0) {
      // All pets are upgrade only
      require(_isPlayerUpgraded, PlayerNotUpgraded());
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
      attireLength = attireLength.inc();
    }
    if (attire.neck != NONE) {
      itemTokenIds[attireLength] = attire.neck;
      expectedEquipPositions[attireLength] = EquipPosition.NECK;
      attireLength = attireLength.inc();
    }
    if (attire.body != NONE) {
      itemTokenIds[attireLength] = attire.body;
      expectedEquipPositions[attireLength] = EquipPosition.BODY;
      attireLength = attireLength.inc();
    }
    if (attire.arms != NONE) {
      itemTokenIds[attireLength] = attire.arms;
      expectedEquipPositions[attireLength] = EquipPosition.ARMS;
      attireLength = attireLength.inc();
    }
    if (attire.legs != NONE) {
      itemTokenIds[attireLength] = attire.legs;
      expectedEquipPositions[attireLength] = EquipPosition.LEGS;
      attireLength = attireLength.inc();
    }
    if (attire.feet != NONE) {
      itemTokenIds[attireLength] = attire.feet;
      expectedEquipPositions[attireLength] = EquipPosition.FEET;
      attireLength = attireLength.inc();
    }
    if (attire.ring != NONE) {
      itemTokenIds[attireLength] = attire.ring;
      expectedEquipPositions[attireLength] = EquipPosition.RING;
      attireLength = attireLength.inc();
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      EquipPosition[] memory equipPositions = _itemNFT.getEquipPositions(itemTokenIds);
      U256 bounds = attireLength.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        require(expectedEquipPositions[i] == equipPositions[i], InvalidEquipPosition());
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
      U256 iter = balances.length.asU256();

      while (iter.neq(0)) {
        iter = iter.dec();
        uint256 i = iter.asUint256();
        require(
          _getRealXP(skills[i], _playerXP[playerId], pendingQueuedActionProcessed, questState) >= minXPs[i],
          AttireMinimumXPNotReached()
        );
        require(balances[i] != 0, NoItemBalance(itemTokenIds[i]));
        require(isPlayerUpgraded || !isItemFullModeOnly[i], PlayerNotUpgraded());
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
    U256 iter = equippedItemTokenIds.length.asU256();
    bool twoHanded;
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      bool isRightHand = i == 1;
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
  function clearEverything(address from, uint256 playerId, bool _processTheActions) public {
    if (_processTheActions) {
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
