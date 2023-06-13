// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {PlayersImplBase} from "./PlayersImplBase.sol";
import {PlayersBase} from "./PlayersBase.sol";

import {World} from "../World.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {AdminAccess} from "../AdminAccess.sol";

import {PlayersLibrary} from "./PlayersLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

contract PlayersImplQueueActions is PlayersImplBase, PlayersBase {
  using UnsafeMath for U256;
  using UnsafeMath for uint16;
  using UnsafeMath for uint32;
  using UnsafeMath for uint64;
  using UnsafeMath for uint256;

  constructor() {
    _checkStartSlot();
  }

  function startActions(
    uint _playerId,
    QueuedActionInput[] memory _queuedActions,
    uint16 _boostItemTokenId,
    uint40 _boostStartTime,
    uint _questId,
    ActionQueueStatus _queueStatus
  ) external {
    address from = msg.sender;
    uint totalTimespan;
    (
      QueuedAction[] memory remainingQueuedActions,
      PendingQueuedActionData memory currentActionProcessed
    ) = _processActions(from, _playerId);

    Player storage player = players_[_playerId];
    if (_queueStatus == ActionQueueStatus.NONE) {
      if (player.actionQueue.length != 0) {
        // Clear action queue
        QueuedAction[] memory queuedActions;
        player.actionQueue = queuedActions;
      }
      // Don't care about remaining actions
      assembly ("memory-safe") {
        mstore(remainingQueuedActions, 0)
      }

      if (_queuedActions.length > 3) {
        revert TooManyActionsQueued();
      }
    } else {
      if (_queueStatus == ActionQueueStatus.KEEP_LAST_IN_PROGRESS && remainingQueuedActions.length > 1) {
        // Only want one
        assembly ("memory-safe") {
          mstore(remainingQueuedActions, 1)
        }
      }

      // Keep remaining actions
      if (remainingQueuedActions.length + _queuedActions.length > 3) {
        revert TooManyActionsQueuedSomeAlreadyExist();
      }
      player.actionQueue = remainingQueuedActions;
      U256 j = remainingQueuedActions.length.asU256();
      while (j.neq(0)) {
        j = j.dec();
        totalTimespan += remainingQueuedActions[j.asUint256()].timespan;
      }
    }

    if (
      (_queueStatus == ActionQueueStatus.KEEP_LAST_IN_PROGRESS || _queueStatus == ActionQueueStatus.APPEND) &&
      remainingQueuedActions.length != 0
    ) {
      _setPrevPlayerState(player, currentActionProcessed);
    } else {
      _clearCurrentActionProcessed(_playerId);
    }

    uint prevEndTime = block.timestamp.add(totalTimespan);

    U256 queueId = nextQueueId.asU256();
    U256 queuedActionsLength = _queuedActions.length.asU256();

    if (remainingQueuedActions.length != 0 || _queuedActions.length != 0) {
      player.currentActionStartTime = uint40(block.timestamp);
    } else {
      player.currentActionStartTime = 0;
    }

    for (U256 iter; iter != queuedActionsLength; iter = iter.inc()) {
      uint i = iter.asUint256();

      if (totalTimespan.add(_queuedActions[i].timespan) > MAX_TIME_) {
        // Must be the last one which will exceed the max time
        if (iter != queuedActionsLength.dec()) {
          revert ActionTimespanExceedsMaxTime();
        }
        // Shorten it so that it does not extend beyond the max time
        _queuedActions[i].timespan = uint24(MAX_TIME_.sub(totalTimespan));
      }

      _addToQueue(from, _playerId, _queuedActions[i], queueId.asUint64());

      queueId = queueId.inc();
      totalTimespan += _queuedActions[i].timespan;
      prevEndTime += _queuedActions[i].timespan;
    }

    // Create an array from remainingAttire and queuedActions passed in
    uint length = remainingQueuedActions.length + _queuedActions.length;
    Attire[] memory attire = new Attire[](length);
    for (uint i = 0; i < remainingQueuedActions.length; ++i) {
      attire[i] = attire_[_playerId][remainingQueuedActions[i].queueId];
    }
    for (uint i = 0; i < _queuedActions.length; ++i) {
      attire[i + remainingQueuedActions.length] = _queuedActions[i].attire;
    }

    emit SetActionQueue(from, _playerId, player.actionQueue, attire, player.currentActionStartTime);

    assert(totalTimespan <= MAX_TIME_); // Should never happen
    nextQueueId = queueId.asUint64();

    if (_questId != 0) {
      quests.activateQuest(_playerId, _questId);
    }

    if (_boostItemTokenId != NONE) {
      consumeBoost(from, _playerId, _boostItemTokenId, _boostStartTime);
    }
  }

  function consumeBoost(address _from, uint _playerId, uint16 _itemTokenId, uint40 _startTime) public {
    Item memory item = itemNFT.getItem(_itemTokenId);
    if (item.equipPosition != EquipPosition.BOOST_VIAL) {
      revert NotABoostVial();
    }
    if (_startTime >= block.timestamp + 7 days) {
      revert StartTimeTooFarInTheFuture();
    }
    if (_startTime < block.timestamp) {
      _startTime = uint40(block.timestamp);
    }

    // Burn it
    address from = msg.sender;
    itemNFT.burn(from, _itemTokenId, 1);

    // If there's an active potion which hasn't been consumed yet, then we can mint it back
    PlayerBoostInfo storage playerBoost = activeBoosts_[_playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime > block.timestamp) {
      itemNFT.mint(from, playerBoost.itemTokenId, 1);
    }

    playerBoost.startTime = _startTime;
    playerBoost.duration = item.boostDuration;
    playerBoost.value = item.boostValue;
    playerBoost.boostType = item.boostType;
    playerBoost.itemTokenId = _itemTokenId;

    emit ConsumeBoostVial(_from, _playerId, playerBoost);
  }

  function _checkAddToQueue(QueuedActionInput memory _queuedAction) private view {
    if (_queuedAction.attire.ring != NONE) {
      revert UnsupportedAttire();
    }
    if (_queuedAction.attire.reserved1 != NONE) {
      revert UnsupportedAttire();
    }
    if (_queuedAction.regenerateId != NONE) {
      if (itemNFT.getItem(_queuedAction.regenerateId).equipPosition != EquipPosition.FOOD) {
        revert UnsupportedRegenerateItem();
      }
    }
  }

  function _addToQueue(address _from, uint _playerId, QueuedActionInput memory _queuedAction, uint64 _queueId) private {
    _checkAddToQueue(_queuedAction);
    Player storage _player = players_[_playerId];

    uint16 actionId = _queuedAction.actionId;

    (
      uint16 handItemTokenIdRangeMin,
      uint16 handItemTokenIdRangeMax,
      bool actionChoiceRequired,
      Skill skill,
      uint32 actionMinXP,
      bool actionAvailable
    ) = world.getPermissibleItemsForAction(actionId);

    if (!actionAvailable) {
      revert ActionNotAvailable();
    }

    bool isCombat = skill == Skill.COMBAT;
    if (!isCombat && PlayersLibrary.readXP(skill, xp_[_playerId]) < actionMinXP) {
      revert ActionMinimumXPNotReached();
    }

    // Check the actionChoice is valid
    ActionChoice memory actionChoice;
    if (actionChoiceRequired) {
      if (_queuedAction.choiceId == NONE) {
        revert ActionChoiceIdRequired();
      }
      actionChoice = world.getActionChoice(isCombat ? NONE : _queuedAction.actionId, _queuedAction.choiceId);

      if (PlayersLibrary.readXP(actionChoice.skill, xp_[_playerId]) < actionChoice.minXP) {
        revert ActionChoiceMinimumXPNotReached();
      }

      if (actionChoice.skill == Skill.NONE) {
        revert InvalidSkill();
      }
    } else if (_queuedAction.choiceId != NONE) {
      revert ActionChoiceIdNotRequired();
    }

    if (_queuedAction.timespan == 0) {
      revert EmptyTimespan();
    }

    {
      // Check combatStyle is only selected if queuedAction is combat
      bool combatStyleSelected = _queuedAction.combatStyle != CombatStyle.NONE;
      if (isCombat != combatStyleSelected) {
        revert InvalidCombatStyle();
      }
    }

    Attire memory attire = _queuedAction.attire;
    if (
      attire.head != NONE ||
      attire.neck != NONE ||
      attire.body != NONE ||
      attire.arms != NONE ||
      attire.legs != NONE ||
      attire.feet != NONE ||
      attire.ring != NONE
    ) {
      attire_[_playerId][_queueId] = _queuedAction.attire;
      _checkAttire(_from, _playerId, attire_[_playerId][_queueId]);
    }

    QueuedAction memory queuedAction;
    queuedAction.isValid = true;
    queuedAction.timespan = _queuedAction.timespan;
    queuedAction.queueId = _queueId;
    queuedAction.actionId = _queuedAction.actionId;
    queuedAction.regenerateId = _queuedAction.regenerateId;
    queuedAction.choiceId = _queuedAction.choiceId;
    queuedAction.rightHandEquipmentTokenId = _queuedAction.rightHandEquipmentTokenId;
    queuedAction.leftHandEquipmentTokenId = _queuedAction.leftHandEquipmentTokenId;
    queuedAction.combatStyle = _queuedAction.combatStyle;
    _player.actionQueue.push(queuedAction);

    _checkHandEquipments(
      _from,
      _playerId,
      [_queuedAction.leftHandEquipmentTokenId, _queuedAction.rightHandEquipmentTokenId],
      handItemTokenIdRangeMin,
      handItemTokenIdRangeMax,
      isCombat
    );

    _checkActionConsumables(_playerId, _queuedAction, actionChoice);
  }

  function _checkActionConsumables(
    uint _playerId,
    QueuedActionInput memory _queuedAction,
    ActionChoice memory actionChoice
  ) private view {
    if (_queuedAction.choiceId != NONE) {
      // Get all items for this
      uint16[] memory itemTokenIds = new uint16[](4);
      uint itemLength;

      if (_queuedAction.regenerateId != NONE) {
        itemTokenIds[itemLength] = _queuedAction.regenerateId;
        itemLength = itemLength.inc();
        (Skill skill, uint32 minXP, ) = itemNFT.getEquipPositionAndMinRequirement(itemTokenIds[itemLength.dec()]);
        if (PlayersLibrary.readXP(skill, xp_[_playerId]) < minXP) {
          revert ConsumableMinimumXPNotReached();
        }
      }
      if (actionChoice.inputTokenId1 != NONE) {
        itemTokenIds[itemLength] = actionChoice.inputTokenId1;
        itemLength = itemLength.inc();
      }
      if (actionChoice.inputTokenId2 != NONE) {
        itemTokenIds[itemLength] = actionChoice.inputTokenId2;
        itemLength = itemLength.inc();
      }
      if (actionChoice.inputTokenId3 != NONE) {
        itemTokenIds[itemLength] = actionChoice.inputTokenId3;
        itemLength = itemLength.inc();
      }
      assembly ("memory-safe") {
        mstore(itemTokenIds, itemLength)
      }
    }
  }

  function _checkEquipPosition(Attire storage _attire) private view {
    uint attireLength;
    uint16[] memory itemTokenIds = new uint16[](6);
    EquipPosition[] memory expectedEquipPositions = new EquipPosition[](6);
    if (_attire.head != NONE) {
      itemTokenIds[attireLength] = _attire.head;
      expectedEquipPositions[attireLength] = EquipPosition.HEAD;
      attireLength = attireLength.inc();
    }
    if (_attire.neck != NONE) {
      itemTokenIds[attireLength] = _attire.neck;
      expectedEquipPositions[attireLength] = EquipPosition.NECK;
      attireLength = attireLength.inc();
    }
    if (_attire.body != NONE) {
      itemTokenIds[attireLength] = _attire.body;
      expectedEquipPositions[attireLength] = EquipPosition.BODY;
      attireLength = attireLength.inc();
    }
    if (_attire.arms != NONE) {
      itemTokenIds[attireLength] = _attire.arms;
      expectedEquipPositions[attireLength] = EquipPosition.ARMS;
      attireLength = attireLength.inc();
    }
    if (_attire.legs != NONE) {
      itemTokenIds[attireLength] = _attire.legs;
      expectedEquipPositions[attireLength] = EquipPosition.LEGS;
      attireLength = attireLength.inc();
    }
    if (_attire.feet != NONE) {
      itemTokenIds[attireLength] = _attire.feet;
      expectedEquipPositions[attireLength] = EquipPosition.FEET;
      attireLength = attireLength.inc();
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      EquipPosition[] memory equipPositions = itemNFT.getEquipPositions(itemTokenIds);
      U256 bounds = attireLength.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint i = iter.asUint256();
        if (expectedEquipPositions[i] != equipPositions[i]) {
          revert InvalidEquipPosition();
        }
      }
    }
  }

  // Checks they have sufficient balance to equip the items, and minimum skill points
  function _checkAttire(address _from, uint _playerId, Attire storage _attire) private view {
    // Check the user has these items
    _checkEquipPosition(_attire);

    bool skipNeck;
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates;
    (uint16[] memory itemTokenIds, uint[] memory balances) = PlayersLibrary.getAttireWithBalance(
      _from,
      _attire,
      itemNFT,
      skipNeck,
      pendingQueuedActionEquipmentStates
    );
    if (itemTokenIds.length != 0) {
      (Skill[] memory skills, uint32[] memory minXPs) = itemNFT.getMinRequirements(itemTokenIds);
      U256 iter = balances.length.asU256();
      while (iter.neq(0)) {
        iter = iter.dec();
        uint i = iter.asUint256();
        if (PlayersLibrary.readXP(skills[i], xp_[_playerId]) < minXPs[i]) {
          revert AttireMinimumXPNotReached();
        }
        if (balances[i] == 0) {
          revert NoItemBalance(itemTokenIds[i]);
        }
      }
    }
  }

  function _checkHandEquipments(
    address _from,
    uint _playerId,
    uint16[2] memory _equippedItemTokenIds, // left, right
    uint16 _handItemTokenIdRangeMin,
    uint16 _handItemTokenIdRangeMax,
    bool _isCombat
  ) private view {
    U256 iter = _equippedItemTokenIds.length.asU256();
    bool twoHanded;
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      bool isRightHand = i == 1;
      uint16 equippedItemTokenId = _equippedItemTokenIds[i];
      if (equippedItemTokenId != NONE) {
        if (
          _handItemTokenIdRangeMin != NONE &&
          (equippedItemTokenId < _handItemTokenIdRangeMin || equippedItemTokenId > _handItemTokenIdRangeMax)
        ) {
          revert InvalidHandEquipment(equippedItemTokenId);
        }

        uint256 balance = itemNFT.balanceOf(_from, equippedItemTokenId);
        if (balance == 0) {
          revert DoNotHaveEnoughQuantityToEquipToAction();
        }
        (Skill skill, uint32 minXP, EquipPosition equipPosition) = itemNFT.getEquipPositionAndMinRequirement(
          equippedItemTokenId
        );
        if (PlayersLibrary.readXP(skill, xp_[_playerId]) < minXP) {
          revert ItemMinimumXPNotReached();
        }
        if (isRightHand) {
          if (equipPosition != EquipPosition.RIGHT_HAND && equipPosition != EquipPosition.BOTH_HANDS) {
            revert IncorrectRightHandEquipment(equippedItemTokenId);
          }
          twoHanded = equipPosition == EquipPosition.BOTH_HANDS;
        } else {
          // left hand, if we've equipped a 2 handed weapon, we can't equip anything else
          if (twoHanded) {
            revert CannotEquipTwoHandedAndOtherEquipment();
          }
          if (equipPosition != EquipPosition.LEFT_HAND) {
            revert IncorrectLeftHandEquipment(equippedItemTokenId);
          }
        }
      } else {
        // Only combat actions can have no equipment
        // e.g smithing doesn't require anything equipped
        if (!_isCombat && _handItemTokenIdRangeMin != NONE && isRightHand) {
          revert IncorrectEquippedItem(equippedItemTokenId);
        }
      }
    }
  }

  function _clearActionQueue(address _from, uint _playerId) private {
    QueuedAction[] memory queuedActions;
    Attire[] memory attire;
    uint startTime = 0;
    _setActionQueue(_from, _playerId, queuedActions, attire, startTime);
  }

  function _clearCurrentActionProcessed(uint _playerId) private {
    Player storage player = players_[_playerId];
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
  // Unequips everything which is just emitting an event
  // Mints the boost vial if it hasn't been consumed at all yet
  // Removes all the actions from the queue
  function clearEverything(address _from, uint _playerId, bool _processTheActions) public {
    if (_processTheActions) {
      _processActions(_from, _playerId);
    }
    // Ensure player info is cleared
    _clearCurrentActionProcessed(_playerId);
    Player storage player = players_[_playerId];
    player.currentActionStartTime = 0;

    emit ClearAll(_from, _playerId);
    _clearActionQueue(_from, _playerId);
    // Can re-mint boost if it hasn't been consumed at all yet
    PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
    if (activeBoost.boostType != BoostType.NONE && activeBoost.startTime > block.timestamp) {
      uint itemTokenId = activeBoost.itemTokenId;
      delete activeBoosts_[_playerId];
      itemNFT.mint(_from, itemTokenId, 1);
    }
  }

  function setActivePlayer(address _from, uint _playerId) external {
    uint existingActivePlayerId = activePlayer_[_from];
    // All attire and actions can be made for this player
    activePlayer_[_from] = _playerId;
    if (existingActivePlayerId == _playerId) {
      revert PlayerAlreadyActive();
    }
    if (existingActivePlayerId != 0) {
      // If there is an existing active player, unequip all items
      clearEverything(_from, existingActivePlayerId, true);
    }
    emit SetActivePlayer(_from, existingActivePlayerId, _playerId);
  }

  function unequipBoostVial(uint _playerId) external {
    if (activeBoosts_[_playerId].boostType == BoostType.NONE) {
      revert NoActiveBoost();
    }
    if (activeBoosts_[_playerId].startTime > block.timestamp) {
      revert BoostTimeAlreadyStarted();
    }
    address from = msg.sender;
    itemNFT.mint(from, activeBoosts_[_playerId].itemTokenId, 1);
    emit UnconsumeBoostVial(from, _playerId);
  }
}
