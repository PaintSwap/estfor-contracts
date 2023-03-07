// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./PlayersImplBase.sol";

contract PlayersImplQueueActions is PlayersUpgradeableImplDummyBase, PlayersBase {
  constructor() {
    _checkStartSlot();
  }

  error NoItemBalance(uint16 itemTokenId);

  function startActions(
    uint _playerId,
    QueuedAction[] memory _queuedActions,
    uint16 _boostItemTokenId,
    ActionQueueStatus _queueStatus
  ) external {
    if (_queuedActions.length == 0) {
      revert SkillsArrayZero();
    }

    address from = msg.sender;
    uint totalTimespan;
    QueuedAction[] memory remainingSkills = _processActions(from, _playerId);

    if (_boostItemTokenId != NONE) {
      consumeBoost(_playerId, _boostItemTokenId, uint40(block.timestamp));
    }

    Player storage player = players[_playerId];
    if (_queueStatus == ActionQueueStatus.NONE) {
      if (player.actionQueue.length > 0) {
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

      for (uint i; i < remainingSkills.length; ++i) {
        totalTimespan += remainingSkills[i].timespan;
      }
    }

    uint prevEndTime = block.timestamp + totalTimespan;

    uint256 i;
    uint64 queueId = latestQueueId;
    do {
      QueuedAction memory queuedAction = _queuedActions[i];

      if (totalTimespan + queuedAction.timespan > MAX_TIME) {
        // Must be the last one which will exceed the max time
        if (i != _queuedActions.length - 1) {
          revert ActionTimespanExceedsMaxTime();
        }
        // Shorten it so that it does not extend beyond the max time
        queuedAction.timespan = uint24(MAX_TIME - totalTimespan);
      }

      _addToQueue(from, _playerId, queuedAction, queueId, prevEndTime);
      unchecked {
        ++i;
        ++queueId;
      }
      totalTimespan += queuedAction.timespan;
      prevEndTime += queuedAction.timespan;
    } while (i < _queuedActions.length);

    emit SetActionQueue(_playerId, player.actionQueue);

    assert(totalTimespan <= MAX_TIME); // Should never happen
    latestQueueId = queueId;
  }

  function consumeBoost(uint _playerId, uint16 _itemTokenId, uint40 _startTime) public {
    PlayerBoostInfo storage playerBoost = activeBoosts[_playerId];

    Item memory item = itemNFT.getItem(_itemTokenId);
    require(item.boostType != BoostType.NONE); // , "Not a boost vial");
    require(_startTime < block.timestamp + 7 days); // , "Start time too far in the future");
    if (_startTime < block.timestamp) {
      _startTime = uint40(block.timestamp);
    }

    // Burn it
    address from = msg.sender;
    itemNFT.burn(from, _itemTokenId, 1);

    // If there's an active potion which hasn't been consumed yet, then we can mint it back
    if (playerBoost.itemTokenId != NONE) {
      itemNFT.mint(from, playerBoost.itemTokenId, 1);
    }

    playerBoost.startTime = _startTime;
    playerBoost.duration = item.boostDuration;
    playerBoost.val = item.boostValue;
    playerBoost.boostType = item.boostType;
    playerBoost.itemTokenId = _itemTokenId;

    emit ConsumeBoostVial(_playerId, playerBoost);
  }

  function _addToQueue(
    address _from,
    uint _playerId,
    QueuedAction memory _queuedAction,
    uint128 _queueId,
    uint _startTime
  ) private {
    Player storage _player = players[_playerId];

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
      require(itemNFT.getItem(_queuedAction.regenerateId).equipPosition == EquipPosition.FOOD);
    }

    uint16 actionId = _queuedAction.actionId;

    (
      uint16 handItemTokenIdRangeMin,
      uint16 handItemTokenIdRangeMax,
      bool actionChoiceRequired,
      Skill skill,
      bool actionAvailable
    ) = world.getPermissibleItemsForAction(actionId);

    if (!actionAvailable) {
      revert ActionNotAvailable();
    }

    bool isCombat = skill == Skill.COMBAT;

    // Check the actionChoice is valid
    if (actionChoiceRequired) {
      require(_queuedAction.choiceId != NONE);
      ActionChoice memory actionChoice = world.getActionChoice(
        isCombat ? NONE : _queuedAction.actionId,
        _queuedAction.choiceId
      );

      require(actionChoice.skill != Skill.NONE);
    }

    // Check combatStyle is only selected if queuedAction is combat
    if (isCombat) {
      require(_queuedAction.combatStyle != CombatStyle.NONE);
    } else {
      require(_queuedAction.combatStyle == CombatStyle.NONE);
    }

    _checkHandEquipment(
      _from,
      _queuedAction.rightHandEquipmentTokenId,
      handItemTokenIdRangeMin,
      handItemTokenIdRangeMax,
      isCombat,
      true
    );
    _checkHandEquipment(
      _from,
      _queuedAction.leftHandEquipmentTokenId,
      handItemTokenIdRangeMin,
      handItemTokenIdRangeMax,
      isCombat,
      false
    );

    _checkActionConsumables(_from, _queuedAction);

    _queuedAction.startTime = uint40(_startTime);
    _queuedAction.attire.queueId = _queueId;
    _queuedAction.isValid = true;
    _player.actionQueue.push(_queuedAction);

    _checkAttire(_from, _player.actionQueue[_player.actionQueue.length - 1].attire);
  }

  function _checkActionConsumables(address _from, QueuedAction memory _queuedAction) private view {
    // Check they have this to equip. Indexer can check actionChoices
    if (_queuedAction.regenerateId != NONE && itemNFT.balanceOf(_from, _queuedAction.regenerateId) == 0) {
      revert NoItemBalance(_queuedAction.regenerateId);
    }

    if (_queuedAction.choiceId != NONE) {
      // Get all items for this
      ActionChoice memory actionChoice = world.getActionChoice(
        _isCombatStyle(_queuedAction.combatStyle) ? NONE : _queuedAction.actionId,
        _queuedAction.choiceId
      );

      uint16[] memory items = new uint16[](3);
      uint itemLength;
      if (actionChoice.inputTokenId1 != NONE) {
        items[itemLength] = actionChoice.inputTokenId1;
        ++itemLength;
      }
      if (actionChoice.inputTokenId2 != NONE) {
        items[itemLength] = actionChoice.inputTokenId2;
        ++itemLength;
      }
      if (actionChoice.inputTokenId3 != NONE) {
        items[itemLength] = actionChoice.inputTokenId3;
        ++itemLength;
      }
      assembly ("memory-safe") {
        mstore(items, itemLength)
      }
      if (itemLength > 0) {
        uint256[] memory balances = itemNFT.balanceOfs(_from, items);
        for (uint i; i < balances.length; ++i) {
          if (balances[i] == 0) {
            revert NoItemBalance(items[i]);
          }
        }
      }
    }
    //     if (_queuedAction.choiceId1 != NONE) {
    //     if (_queuedAction.choiceId2 != NONE) {
  }

  // Checks they have sufficient balance to equip the items
  function _checkAttire(address _from, Attire storage _attire) private view {
    // Check the user has these items
    bool skipNeck = false;
    (uint16[] memory itemTokenIds, uint[] memory balances) = _getAttireWithBalance(_from, _attire, skipNeck);
    if (itemTokenIds.length > 0) {
      uint256[] memory balances = itemNFT.balanceOfs(_from, itemTokenIds);
      for (uint i; i < balances.length; ++i) {
        if (balances[i] == 0) {
          revert NoItemBalance(itemTokenIds[i]);
        }
      }
    }
  }

  function _isMainEquipped(uint _playerId, uint _itemTokenId) private view returns (bool) {
    EquipPosition position = _getMainEquipPosition(_itemTokenId);
    Player storage player = players[_playerId];
    uint equippedTokenId = _getEquippedTokenId(position, player);
    return equippedTokenId == _itemTokenId;
  }

  function _getMainEquipPosition(uint _itemTokenId) private pure returns (EquipPosition) {
    if (_itemTokenId >= MAX_MAIN_EQUIPMENT_ID) {
      return EquipPosition.NONE;
    }

    return EquipPosition(_itemTokenId / 65536);
  }

  function _getEquippedTokenId(
    EquipPosition _position,
    Player storage _player
  ) private view returns (uint16 equippedTokenId) {
    assembly ("memory-safe") {
      let val := sload(_player.slot)
      equippedTokenId := shr(mul(_position, 16), val)
    }
  }

  function _checkHandEquipment(
    address _from,
    uint16 _equippedItemTokenId,
    uint16 _handItemTokenIdRangeMin,
    uint16 _handItemTokenIdRangeMax,
    bool _isCombat,
    bool _isRightHand
  ) private view {
    if (_equippedItemTokenId != NONE) {
      if (_equippedItemTokenId < _handItemTokenIdRangeMin || _equippedItemTokenId > _handItemTokenIdRangeMax) {
        revert InvalidArmEquipment(_equippedItemTokenId);
      }

      uint256 balance = itemNFT.balanceOf(_from, _equippedItemTokenId);
      if (balance == 0) {
        revert DoNotHaveEnoughQuantityToEquipToAction();
      }
    } else {
      // Only combat actions can have no equipment if they have a choice
      // e.g smithing doesn't require anything equipped
      require(_isCombat || _handItemTokenIdRangeMin == NONE || !_isRightHand);
    }
  }
}
