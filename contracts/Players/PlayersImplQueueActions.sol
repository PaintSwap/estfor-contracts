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

  function startActions(
    uint _playerId,
    QueuedActionInput[] calldata _queuedActions,
    uint16 _boostItemTokenId,
    ActionQueueStatus _queueStatus
  ) external {
    address from = msg.sender;
    uint totalTimespan;
    QueuedAction[] memory remainingSkills = _processActions(from, _playerId);

    if (_boostItemTokenId != NONE) {
      consumeBoost(from, _playerId, _boostItemTokenId, uint40(block.timestamp));
    }

    Player storage player = players[_playerId];
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
      queuedAction.skill = _queuedActions[i].skill;
      queuedAction.isValid = true;
      // startTime filled in later

      if (totalTimespan + queuedAction.timespan > MAX_TIME) {
        // Must be the last one which will exceed the max time
        if (iter != queuedActionsLength.dec()) {
          revert ActionTimespanExceedsMaxTime();
        }
        // Shorten it so that it does not extend beyond the max time
        queuedAction.timespan = uint24(MAX_TIME - totalTimespan);
      }

      _addToQueue(from, _playerId, queuedAction, queueId.asUint64(), prevEndTime);
      iter = iter.inc();
      queueId = queueId.inc();
      totalTimespan += queuedAction.timespan;
      prevEndTime += queuedAction.timespan;
    }

    emit SetActionQueue(from, _playerId, player.actionQueue);

    assert(totalTimespan <= MAX_TIME); // Should never happen
    nextQueueId = queueId.asUint64();

    _handleDailyRewards(from, _playerId);
  }

  function consumeBoost(address _from, uint _playerId, uint16 _itemTokenId, uint40 _startTime) public {
    PlayerBoostInfo storage playerBoost = activeBoosts[_playerId];

    Item memory item = itemNFT.getItem(_itemTokenId);
    if (item.boostType == BoostType.NONE) {
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
    if (playerBoost.itemTokenId != NONE) {
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
    Player storage _player = players[_playerId];

    uint16 actionId = _queuedAction.actionId;

    (
      uint16 handItemTokenIdRangeMin,
      uint16 handItemTokenIdRangeMax,
      bool actionChoiceRequired,
      Skill skill,
      uint32 actionMinXP,
      bool actionAvailable
    ) = world.getPermissibleItemsForAction(actionId);

    if (_queuedAction.skill != skill) {
      revert InvalidSkill();
    }

    if (!actionAvailable) {
      revert ActionNotAvailable();
    }

    bool isCombat = skill == Skill.COMBAT;
    if (!isCombat && xp[_playerId][skill] < actionMinXP) {
      revert ActionMinimumXPNotReached();
    }

    // Check the actionChoice is valid
    ActionChoice memory actionChoice;
    if (actionChoiceRequired) {
      if (_queuedAction.choiceId == NONE) {
        revert ActionChoiceIdRequired();
      }
      actionChoice = world.getActionChoice(isCombat ? NONE : _queuedAction.actionId, _queuedAction.choiceId);

      if (xp[_playerId][actionChoice.skill] < actionChoice.minXP) {
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
    _queuedAction.attire.queueId = _queueId;
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
        if (xp[_playerId][skill] < minXP) {
          revert ConsumeableMinimumXPNotReached();
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
      }
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
        if (xp[_playerId][skills[i]] < minXPs[i]) {
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
          revert InvalidArmEquipment(equippedItemTokenId);
        }

        uint256 balance = itemNFT.balanceOf(_from, equippedItemTokenId);
        if (balance == 0) {
          revert DoNotHaveEnoughQuantityToEquipToAction();
        }
        (Skill skill, uint32 minXP) = itemNFT.getMinRequirement(equippedItemTokenId);
        if (xp[_playerId][skill] < minXP) {
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
}
