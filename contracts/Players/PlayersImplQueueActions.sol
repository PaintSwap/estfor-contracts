// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UnsafeU256, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeU256.sol";
import {PlayersUpgradeableImplDummyBase, PlayersBase} from "./PlayersImplBase.sol";

/* solhint-disable no-global-import */
import "../globals/players.sol";
import "../globals/items.sol";
import "../globals/actions.sol";

/* solhint-enable no-global-import */

contract PlayersImplQueueActions is PlayersUpgradeableImplDummyBase, PlayersBase {
  using UnsafeU256 for U256;

  constructor() {
    _checkStartSlot();
  }

  function startActions(
    uint _playerId,
    QueuedActionInput[] calldata _queuedActions,
    uint16 _boostItemTokenId,
    uint40 _boostStartTime,
    ActionQueueStatus _queueStatus
  ) external {
    address from = msg.sender;
    uint totalTimespan;
    QueuedAction[] memory remainingSkills = _processActions(from, _playerId);

    Player storage player = players_[_playerId];
    if (_queueStatus == ActionQueueStatus.NONE) {
      if (player.actionQueue.length != 0) {
        // Clear action queue
        QueuedAction[] memory queuedActions;
        player.actionQueue = queuedActions;
      }
      if (_queuedActions.length > 3) {
        revert TooManyActionsQueued();
      }
    } else {
      if (_queueStatus == ActionQueueStatus.KEEP_LAST_IN_PROGRESS && remainingSkills.length > 1) {
        // Only want one
        assembly ("memory-safe") {
          mstore(remainingSkills, 1)
        }
      }

      // Keep remaining actions
      if (remainingSkills.length + _queuedActions.length > 3) {
        revert TooManyActionsQueuedSomeAlreadyExist();
      }
      player.actionQueue = remainingSkills;
      U256 j = U256.wrap(remainingSkills.length);
      while (j.neq(0)) {
        j = j.dec();
        totalTimespan += remainingSkills[j.asUint256()].timespan;
      }
    }

    uint prevEndTime = block.timestamp + totalTimespan;

    U256 iter;
    U256 queueId = U256.wrap(nextQueueId);
    U256 queuedActionsLength = U256.wrap(_queuedActions.length);

    while (iter.neq(_queuedActions.length)) {
      uint i = iter.asUint256();

      QueuedAction memory queuedAction;
      queuedAction.attire = _queuedActions[i].attire;
      queuedAction.actionId = _queuedActions[i].actionId;
      queuedAction.regenerateId = _queuedActions[i].regenerateId;
      queuedAction.choiceId = _queuedActions[i].choiceId;
      queuedAction.choiceId1 = _queuedActions[i].choiceId1;
      queuedAction.choiceId2 = _queuedActions[i].choiceId2;
      queuedAction.rightHandEquipmentTokenId = _queuedActions[i].rightHandEquipmentTokenId;
      queuedAction.leftHandEquipmentTokenId = _queuedActions[i].leftHandEquipmentTokenId;
      queuedAction.timespan = _queuedActions[i].timespan;
      queuedAction.combatStyle = _queuedActions[i].combatStyle;
      queuedAction.isValid = true;
      // startTime filled in later

      if (totalTimespan + queuedAction.timespan > MAX_TIME_) {
        // Must be the last one which will exceed the max time
        if (iter != queuedActionsLength.dec()) {
          revert ActionTimespanExceedsMaxTime();
        }
        // Shorten it so that it does not extend beyond the max time
        queuedAction.timespan = uint24(MAX_TIME_ - totalTimespan);
      }

      _addToQueue(from, _playerId, queuedAction, queueId.asUint64(), prevEndTime);
      iter = iter.inc();
      queueId = queueId.inc();
      totalTimespan += queuedAction.timespan;
      prevEndTime += queuedAction.timespan;
    }

    emit SetActionQueue(from, _playerId, player.actionQueue);

    assert(totalTimespan <= MAX_TIME_); // Should never happen
    nextQueueId = queueId.asUint64();

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
    playerBoost.val = item.boostValue;
    playerBoost.boostType = item.boostType;
    playerBoost.itemTokenId = _itemTokenId;

    emit ConsumeBoostVial(_from, _playerId, playerBoost);
  }

  function _checkAddToQueue(QueuedAction memory _queuedAction) private view {
    if (_queuedAction.attire.ring != NONE) {
      revert UnsupportedAttire();
    }
    if (_queuedAction.attire.reserved1 != NONE) {
      revert UnsupportedAttire();
    }
    if (_queuedAction.choiceId1 != NONE) {
      revert UnsupportedAttire();
    }
    if (_queuedAction.choiceId2 != NONE) {
      revert UnsupportedAttire();
    }

    if (_queuedAction.regenerateId != NONE) {
      if (itemNFT.getItem(_queuedAction.regenerateId).equipPosition != EquipPosition.FOOD) {
        revert UnsupportedRegenerateItem();
      }
    }
  }

  function _addToQueue(
    address _from,
    uint _playerId,
    QueuedAction memory _queuedAction,
    uint64 _queueId,
    uint _startTime
  ) private {
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
    if (!isCombat && xp_[_playerId][skill] < actionMinXP) {
      revert ActionMinimumXPNotReached();
    }

    // Check the actionChoice is valid
    ActionChoice memory actionChoice;
    if (actionChoiceRequired) {
      if (_queuedAction.choiceId == NONE) {
        revert ActionChoiceIdRequired();
      }
      actionChoice = world.getActionChoice(isCombat ? NONE : _queuedAction.actionId, _queuedAction.choiceId);

      if (xp_[_playerId][actionChoice.skill] < actionChoice.minXP) {
        revert ActionChoiceMinimumXPNotReached();
      }

      if (actionChoice.skill == Skill.NONE) {
        revert InvalidSkill();
      }
    }

    {
      // Check combatStyle is only selected if queuedAction is combat
      bool combatStyleSelected = _queuedAction.combatStyle != CombatStyle.NONE;
      if (isCombat != combatStyleSelected) {
        revert InvalidCombatStyle();
      }
    }

    _checkHandEquipments(
      _from,
      _playerId,
      [_queuedAction.leftHandEquipmentTokenId, _queuedAction.rightHandEquipmentTokenId],
      handItemTokenIdRangeMin,
      handItemTokenIdRangeMax,
      isCombat
    );

    _checkActionConsumables(_from, _playerId, _queuedAction, actionChoice);

    _queuedAction.startTime = uint40(_startTime);
    _queuedAction.queueId = _queueId;
    _queuedAction.isValid = true;
    _player.actionQueue.push(_queuedAction);

    _checkAttire(_from, _playerId, _player.actionQueue[_player.actionQueue.length - 1].attire);
  }

  function _checkActionConsumables(
    address _from,
    uint _playerId,
    QueuedAction memory _queuedAction,
    ActionChoice memory actionChoice
  ) private view {
    if (_queuedAction.choiceId != NONE) {
      // Get all items for this
      uint16[] memory itemTokenIds = new uint16[](4);
      uint itemLength;

      if (_queuedAction.regenerateId != NONE) {
        itemTokenIds[itemLength++] = _queuedAction.regenerateId;
        (Skill skill, uint32 minXP) = itemNFT.getMinRequirement(itemTokenIds[itemLength - 1]);
        if (xp_[_playerId][skill] < minXP) {
          revert ConsumableMinimumXPNotReached();
        }
      }
      if (actionChoice.inputTokenId1 != NONE) {
        itemTokenIds[itemLength++] = actionChoice.inputTokenId1;
      }
      if (actionChoice.inputTokenId2 != NONE) {
        itemTokenIds[itemLength++] = actionChoice.inputTokenId2;
      }
      if (actionChoice.inputTokenId3 != NONE) {
        itemTokenIds[itemLength++] = actionChoice.inputTokenId3;
      }
      assembly ("memory-safe") {
        mstore(itemTokenIds, itemLength)
      }
      /* Not checking item balances for now. It's possible a previous action consumes them all (like food) and
      // will cause errors trying to queue it up. Probably should check but meh
      if (itemLength != 0) {
        uint256[] memory balances = itemNFT.balanceOfs(_from, itemTokenIds);

        U256 iter = U256.wrap(balances.length);
        while (iter.neq(0)) {
          iter = iter.dec();
          uint i = iter.asUint256();
          if (balances[i] == 0) {
            revert NoItemBalance(itemTokenIds[i]);
          }
        }
      } */
    }
    //     if (_queuedAction.choiceId1 != NONE) {
    //     if (_queuedAction.choiceId2 != NONE) {
  }

  function _checkEquipPosition(Attire storage _attire) private view {
    uint attireLength;
    uint16[] memory itemTokenIds = new uint16[](6);
    EquipPosition[] memory expectedEquipPositions = new EquipPosition[](6);
    if (_attire.head != NONE) {
      itemTokenIds[attireLength] = _attire.head;
      expectedEquipPositions[attireLength++] = EquipPosition.HEAD;
    }
    if (_attire.neck != NONE) {
      itemTokenIds[attireLength] = _attire.neck;
      expectedEquipPositions[attireLength++] = EquipPosition.NECK;
    }
    if (_attire.body != NONE) {
      itemTokenIds[attireLength] = _attire.body;
      expectedEquipPositions[attireLength++] = EquipPosition.BODY;
    }
    if (_attire.arms != NONE) {
      itemTokenIds[attireLength] = _attire.arms;
      expectedEquipPositions[attireLength++] = EquipPosition.ARMS;
    }
    if (_attire.legs != NONE) {
      itemTokenIds[attireLength] = _attire.legs;
      expectedEquipPositions[attireLength++] = EquipPosition.LEGS;
    }
    if (_attire.feet != NONE) {
      itemTokenIds[attireLength] = _attire.feet;
      expectedEquipPositions[attireLength++] = EquipPosition.FEET;
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      EquipPosition[] memory equipPositions = itemNFT.getEquipPositions(itemTokenIds);
      for (uint i = 0; i < attireLength; ++i) {
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
    (uint16[] memory itemTokenIds, uint[] memory balances) = _getAttireWithBalance(_from, _attire, skipNeck);
    if (itemTokenIds.length != 0) {
      (Skill[] memory skills, uint32[] memory minXPs) = itemNFT.getMinRequirements(itemTokenIds);
      U256 iter = U256.wrap(balances.length);
      while (iter.neq(0)) {
        iter = iter.dec();
        uint i = iter.asUint256();
        if (xp_[_playerId][skills[i]] < minXPs[i]) {
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
    U256 iter = U256.wrap(_equippedItemTokenIds.length);
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
        (Skill skill, uint32 minXP) = itemNFT.getMinRequirement(equippedItemTokenId);
        if (xp_[_playerId][skill] < minXP) {
          revert ItemMinimumXPNotReached();
        }
        EquipPosition equipPosition = itemNFT.getEquipPosition(equippedItemTokenId);
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
          revert IncorrectEquippedItem();
        }
      }
    }
  }

  function _clearActionQueue(address _from, uint _playerId) private {
    QueuedAction[] memory queuedActions;
    _setActionQueue(_from, _playerId, queuedActions);
  }

  // Consumes all the actions in the queue up to this time.
  // Unequips everything which is just emitting an event
  // Mints the boost vial if it hasn't been consumed at all yet
  // Removes all the actions from the queue
  function clearEverything(address _from, uint _playerId) public {
    _processActions(_from, _playerId);
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
      clearEverything(_from, existingActivePlayerId);
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
