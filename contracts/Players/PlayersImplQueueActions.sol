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
    QueuedActionInputV2[] memory _queuedActions,
    uint16 _boostItemTokenId,
    uint40 _boostStartTime,
    uint _questId,
    uint _donationAmount,
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

    U256 queueId = nextQueueId.asU256();
    U256 queuedActionsLength = _queuedActions.length.asU256();

    if (remainingQueuedActions.length != 0 || _queuedActions.length != 0) {
      player.currentActionStartTime = uint40(block.timestamp);
    } else {
      player.currentActionStartTime = 0;
    }

    uint startTimeNewActions = block.timestamp - totalTimespan;
    for (U256 iter; iter != queuedActionsLength; iter = iter.inc()) {
      uint i = iter.asUint256();

      if (totalTimespan.add(_queuedActions[i].timespan) > MAX_TIME_) {
        // Must be the last one which will exceed the max time
        if (iter != queuedActionsLength.dec()) {
          revert ActionTimespanExceedsMaxTime();
        }

        uint remainder;
        // Allow to queue the excess for any running action up to 1 hour
        if (remainingQueuedActions.length > 0) {
          remainder = remainingQueuedActions[0].timespan % 1 hours;
        } else {
          remainder = _queuedActions[0].timespan % 1 hours;
        }
        _queuedActions[i].timespan = uint24(MAX_TIME_.add(remainder).sub(totalTimespan));
      }

      _addToQueue(from, _playerId, _queuedActions[i], queueId.asUint64(), uint40(startTimeNewActions));

      queueId = queueId.inc();
      totalTimespan += _queuedActions[i].timespan;
      startTimeNewActions += _queuedActions[i].timespan;
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

    assert(totalTimespan < MAX_TIME_ + 1 hours); // Should never happen
    nextQueueId = queueId.asUint64();

    if (_questId != 0) {
      quests.activateQuest(from, _playerId, _questId);
    }

    if (_boostItemTokenId != NONE) {
      _consumeBoost(from, _playerId, _boostItemTokenId, _boostStartTime);
    }

    if (_donationAmount != 0) {
      _donate(from, _playerId, _donationAmount);
    }
  }

  function _consumeBoost(address _from, uint _playerId, uint16 _itemTokenId, uint40 _startTime) private {
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
    itemNFT.burn(_from, _itemTokenId, 1);

    // If there's an active potion which hasn't been consumed yet, then we can mint it back
    PlayerBoostInfo storage playerBoost = activeBoosts_[_playerId];
    if (playerBoost.itemTokenId != NONE && playerBoost.startTime > block.timestamp) {
      itemNFT.mint(_from, playerBoost.itemTokenId, 1);
    }

    playerBoost.startTime = _startTime;
    playerBoost.duration = item.boostDuration;
    playerBoost.value = item.boostValue;
    playerBoost.boostType = item.boostType;
    playerBoost.itemTokenId = _itemTokenId;

    emit ConsumeBoostVial(
      _from,
      _playerId,
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
    address _from,
    uint _playerId,
    QueuedActionInputV2 memory _queuedAction,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _pendingQuestState
  ) public view returns (bool setAttire) {
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

    uint16 actionId = _queuedAction.actionId;
    ActionInfo memory actionInfo = world.getActionInfo(actionId);
    if (!actionInfo.isAvailable) {
      revert ActionNotAvailable();
    }

    if (
      actionInfo.minXP > 0 &&
      _getRealXP(actionInfo.skill, xp_[_playerId], _pendingQueuedActionProcessed, _pendingQuestState) < actionInfo.minXP
    ) {
      revert ActionMinimumXPNotReached();
    }

    bool isCombat = actionInfo.skill == Skill.COMBAT;

    // Check the actionChoice is valid
    ActionChoice memory actionChoice;
    if (actionInfo.actionChoiceRequired) {
      if (_queuedAction.choiceId == NONE) {
        revert ActionChoiceIdRequired();
      }
      actionChoice = world.getActionChoice(isCombat ? NONE : _queuedAction.actionId, _queuedAction.choiceId);

      if (
        _getRealXP(actionChoice.skill, xp_[_playerId], _pendingQueuedActionProcessed, _pendingQuestState) <
        actionChoice.minXP
      ) {
        revert ActionChoiceMinimumXPNotReached();
      }

      if (
        actionChoice.minSkill2 != Skill.NONE &&
        _getRealXP(actionChoice.minSkill2, xp_[_playerId], _pendingQueuedActionProcessed, _pendingQuestState) <
        actionChoice.minXP2
      ) {
        revert ActionChoiceMinimumXPNotReached();
      }

      if (
        actionChoice.minSkill3 != Skill.NONE &&
        _getRealXP(actionChoice.minSkill3, xp_[_playerId], _pendingQueuedActionProcessed, _pendingQuestState) <
        actionChoice.minXP3
      ) {
        revert ActionChoiceMinimumXPNotReached();
      }

      if (actionChoice.skill == Skill.NONE) {
        revert InvalidSkill();
      }

      // Timespan should be exact for the rate when travelling (e.g if it takes 2 hours, 2 hours should be queued)
      if (actionInfo.skill == Skill.TRAVELING) {
        if (_queuedAction.timespan != (RATE_MUL * 3600) / actionChoice.rate) {
          revert InvalidTravellingTimespan();
        }
      }

      bool actionChoiceFullModeOnly = uint8(actionChoice.packedData >> IS_FULL_MODE_BIT) & 1 == 1;
      if (actionChoiceFullModeOnly && !_isPlayerFullMode(_playerId)) {
        revert PlayerNotUpgraded();
      }
    } else if (_queuedAction.choiceId != NONE) {
      revert ActionChoiceIdNotRequired();
    } else {
      // Check if the action requires full mode. Done here as don't want to check if both action and actionChoice are full mode only
      if (actionInfo.isFullModeOnly && !_isPlayerFullMode(_playerId)) {
        revert PlayerNotUpgraded();
      }
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
      _checkAttire(_from, _playerId, attire, _pendingQueuedActionProcessed, _pendingQuestState);
      setAttire = true;
    }

    _checkHandEquipments(
      _from,
      _playerId,
      [_queuedAction.leftHandEquipmentTokenId, _queuedAction.rightHandEquipmentTokenId],
      actionInfo.handItemTokenIdRangeMin,
      actionInfo.handItemTokenIdRangeMax,
      isCombat,
      actionChoice,
      _pendingQueuedActionProcessed,
      _pendingQuestState
    );

    _checkFood(_playerId, _queuedAction, _pendingQueuedActionProcessed, _pendingQuestState);

    _checkPet(_from, _queuedAction.petId);
  }

  // Add any new xp gained from previous actions now completed that haven't been pushed to the blockchain yet. For instance
  function _getRealXP(
    Skill _skill,
    PackedXP storage _packedXP,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _questState
  ) private view returns (uint xp) {
    xp = PlayersLibrary.readXP(_skill, _packedXP);
    // Add any pending XP from queued actions
    for (uint i; i < _pendingQueuedActionProcessed.skills.length; ++i) {
      if (_pendingQueuedActionProcessed.skills[i] == _skill) {
        xp += _pendingQueuedActionProcessed.xpGainedSkills[i];
      }
    }

    // Add any pending XP from quests
    for (uint i; i < _questState.skills.length; ++i) {
      if (_questState.skills[i] == _skill) {
        xp += _questState.xpGainedSkills[i];
      }
    }
  }

  function _addToQueue(
    address _from,
    uint _playerId,
    QueuedActionInputV2 memory _queuedAction,
    uint64 _queueId,
    uint40 _startTime
  ) private {
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed; // Empty
    QuestState memory pendingQuestState; // Empty
    bool setAttire = checkAddToQueue(_from, _playerId, _queuedAction, pendingQueuedActionProcessed, pendingQuestState);
    if (setAttire) {
      attire_[_playerId][_queueId] = _queuedAction.attire;
    }

    QueuedAction storage queuedAction = players_[_playerId].actionQueue.push();
    queuedAction.isValid = true;
    queuedAction.timespan = _queuedAction.timespan;
    queuedAction.queueId = _queueId;
    queuedAction.actionId = _queuedAction.actionId;
    queuedAction.regenerateId = _queuedAction.regenerateId;
    queuedAction.choiceId = _queuedAction.choiceId;
    queuedAction.rightHandEquipmentTokenId = _queuedAction.rightHandEquipmentTokenId;
    queuedAction.leftHandEquipmentTokenId = _queuedAction.leftHandEquipmentTokenId;
    queuedAction.combatStyle = _queuedAction.combatStyle;

    // Only set variables in the second storage slot if it's necessary
    if (_queuedAction.petId != 0) {
      queuedAction.hasPet = true;
      queuedAction.petId = _queuedAction.petId;
      petNFT.assignPet(_from, _queuedAction.petId, _startTime);
    }
  }

  function _checkFood(
    uint _playerId,
    QueuedActionInputV2 memory _queuedAction,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _questState
  ) private view {
    if (_queuedAction.regenerateId != NONE) {
      (Skill skill, uint32 minXP, , ) = itemNFT.getEquipPositionAndMinRequirement(_queuedAction.regenerateId);
      if (_getRealXP(skill, xp_[_playerId], _pendingQueuedActionProcessed, _questState) < minXP) {
        revert ConsumableMinimumXPNotReached();
      }
    }
  }

  function _checkPet(address _from, uint _petId) private view {
    if (_petId != 0 && petNFT.balanceOf(_from, _petId) == 0) {
      revert PetNotOwned();
    }
  }

  function _checkEquipPosition(Attire memory _attire) private view {
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
  function _checkAttire(
    address _from,
    uint _playerId,
    Attire memory _attire,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _questState
  ) private view {
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
      (Skill[] memory skills, uint32[] memory minXPs, bool[] memory isItemFullModeOnly) = itemNFT.getMinRequirements(
        itemTokenIds
      );
      U256 iter = balances.length.asU256();
      bool isPlayerUpgraded = _isPlayerFullMode(_playerId);

      while (iter.neq(0)) {
        iter = iter.dec();
        uint i = iter.asUint256();
        if (_getRealXP(skills[i], xp_[_playerId], _pendingQueuedActionProcessed, _questState) < minXPs[i]) {
          revert AttireMinimumXPNotReached();
        }
        if (balances[i] == 0) {
          revert NoItemBalance(itemTokenIds[i]);
        }
        if (!isPlayerUpgraded && isItemFullModeOnly[i]) {
          revert PlayerNotUpgraded();
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
    bool _isCombat,
    ActionChoice memory _actionChoice,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _questState
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

        if (
          _actionChoice.handItemTokenIdRangeMin != NONE &&
          (equippedItemTokenId < _actionChoice.handItemTokenIdRangeMin ||
            equippedItemTokenId > _actionChoice.handItemTokenIdRangeMax)
        ) {
          revert InvalidHandEquipment(equippedItemTokenId);
        }

        uint256 balance = itemNFT.balanceOf(_from, equippedItemTokenId);
        if (balance == 0) {
          revert NoItemBalance(equippedItemTokenId);
        }
        (Skill skill, uint32 minXP, EquipPosition equipPosition, bool isItemFullModeOnly) = itemNFT
          .getEquipPositionAndMinRequirement(equippedItemTokenId);
        if (_getRealXP(skill, xp_[_playerId], _pendingQueuedActionProcessed, _questState) < minXP) {
          revert ItemMinimumXPNotReached();
        }
        if (isItemFullModeOnly && !_isPlayerFullMode(_playerId)) {
          revert PlayerNotUpgraded();
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
        // Only combat actions can have no equipment unless the actionChoice specifies that it requires it
        // e.g smithing doesn't require anything equipped
        if (
          ((!_isCombat && _handItemTokenIdRangeMin != NONE) || _actionChoice.handItemTokenIdRangeMin != NONE) &&
          isRightHand
        ) {
          revert IncorrectEquippedItem();
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
  // Mints the boost vial if it hasn't been consumed at all yet, otherwise removese any active ones
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
    // Remove any active boost
    PlayerBoostInfo storage activeBoost = activeBoosts_[_playerId];
    if (activeBoost.boostType != BoostType.NONE) {
      _clearPlayerMainBoost(_playerId);
      if (activeBoost.startTime > block.timestamp) {
        // Mint it if it hasn't been consumed yet
        itemNFT.mint(_from, activeBoost.itemTokenId, 1);
      }
    }
  }

  function validateActionsImpl(
    address owner,
    uint _playerId,
    QueuedActionInputV2[] memory _queuedActions
  ) external view returns (bool[] memory successes, bytes[] memory reasons) {
    PendingQueuedActionState memory pendingQueuedActionState = _pendingQueuedActionState(owner, _playerId);
    successes = new bool[](_queuedActions.length);
    reasons = new bytes[](_queuedActions.length);

    for (uint i; i < _queuedActions.length; ++i) {
      try
        this.checkAddToQueue(
          owner,
          _playerId,
          _queuedActions[i],
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
