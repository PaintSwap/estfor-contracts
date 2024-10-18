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
    QueuedActionInputV2[] memory _queuedActionInputs,
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

      if (_queuedActionInputs.length > 3) {
        revert TooManyActionsQueued();
      }
    } else {
      if (queueStatus == ActionQueueStatus.KEEP_LAST_IN_PROGRESS && remainingQueuedActions.length > 1) {
        // Only want one
        assembly ("memory-safe") {
          mstore(remainingQueuedActions, 1)
        }
      }

      // Keep remaining actions
      if (remainingQueuedActions.length + _queuedActionInputs.length > 3) {
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
      (queueStatus == ActionQueueStatus.KEEP_LAST_IN_PROGRESS || queueStatus == ActionQueueStatus.APPEND) &&
      remainingQueuedActions.length != 0
    ) {
      _setPrevPlayerState(player, currentActionProcessed);
    } else {
      _clearCurrentActionProcessed(playerId);
    }

    U256 queueId = nextQueueId.asU256();
    U256 queuedActionsLength = _queuedActionInputs.length.asU256();

    if (remainingQueuedActions.length != 0 || _queuedActionInputs.length != 0) {
      player.currentActionStartTime = uint40(block.timestamp);
    } else {
      player.currentActionStartTime = 0;
    }

    uint256 totalLength = remainingQueuedActions.length + _queuedActionInputs.length;
    QueuedAction[] memory queuedActions = new QueuedAction[](totalLength);

    QueuedActionExtra[] memory _queuedActionsExtra = new QueuedActionExtra[](totalLength);

    for (uint256 i; i != remainingQueuedActions.length; ++i) {
      queuedActions[i] = remainingQueuedActions[i];
      _queuedActionsExtra[i] = queuedActionsExtra[i];
    }

    uint256 startTimeNewActions = block.timestamp - totalTimespan;
    for (U256 iter; iter != queuedActionsLength; iter = iter.inc()) {
      uint256 i = iter.asUint256();

      if (totalTimespan.add(_queuedActionInputs[i].timespan) > MAX_TIME_) {
        // Must be the last one which will exceed the max time
        if (iter != queuedActionsLength.dec()) {
          revert ActionTimespanExceedsMaxTime();
        }

        uint256 remainder;
        // Allow to queue the excess for any running action up to 1 hour
        if (remainingQueuedActions.length != 0) {
          remainder = remainingQueuedActions[0].timespan % 1 hours;
        } else {
          remainder = _queuedActionInputs[0].timespan % 1 hours;
        }
        _queuedActionInputs[i].timespan = uint24(MAX_TIME_.add(remainder).sub(totalTimespan));
      }

      (QueuedAction memory queuedAction, QueuedActionExtra memory queuedActionExtra) = _addToQueue(
        from,
        playerId,
        _queuedActionInputs[i],
        queueId.asUint64(),
        uint40(startTimeNewActions)
      );
      queuedActions[remainingQueuedActions.length.add(i)] = queuedAction;
      _queuedActionsExtra[remainingQueuedActions.length.add(i)] = queuedActionExtra;

      queueId = queueId.inc();
      totalTimespan += _queuedActionInputs[i].timespan;
      startTimeNewActions += _queuedActionInputs[i].timespan;
    }

    // Create an array from remainingAttire and queuedActions passed in
    uint256 length = remainingQueuedActions.length + _queuedActionInputs.length;
    Attire[] memory attire = new Attire[](length);
    for (uint256 i = 0; i < remainingQueuedActions.length; ++i) {
      attire[i] = attire_[playerId][remainingQueuedActions[i].queueId];
    }
    for (uint256 i = 0; i < _queuedActionInputs.length; ++i) {
      attire[i + remainingQueuedActions.length] = _queuedActionInputs[i].attire;
    }

    emit SetActionQueueV2(from, playerId, queuedActions, attire, player.currentActionStartTime, _queuedActionsExtra);

    assert(totalTimespan < MAX_TIME_ + 1 hours); // Should never happen
    nextQueueId = queueId.asUint56();

    if (questId != 0) {
      quests.activateQuest(from, playerId, questId);
    }

    if (boostItemTokenId != NONE) {
      _consumeBoost(from, playerId, boostItemTokenId, boostStartTime);
    }

    if (donationAmount != 0) {
      _donate(from, playerId, donationAmount);
    }
  }

  function _consumeBoost(address _from, uint256 playerId, uint16 _itemTokenId, uint40 _startTime) private {
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
    PlayerBoostInfo storage playerBoost = _activeBoosts[playerId];
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
    address _from,
    uint256 playerId,
    QueuedActionInputV2 memory _queuedActionInput,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _pendingQuestState
  ) public view returns (bool setAttire) {
    if (_queuedActionInput.attire.reserved1 != NONE) {
      revert UnsupportedAttire();
    }
    if (_queuedActionInput.regenerateId != NONE) {
      if (itemNFT.getItem(_queuedActionInput.regenerateId).equipPosition != EquipPosition.FOOD) {
        revert UnsupportedRegenerateItem();
      }
    }

    uint16 actionId = _queuedActionInput.actionId;
    ActionInfo memory actionInfo = world.getActionInfo(actionId);
    if (!actionInfo.isAvailable) {
      revert ActionNotAvailable();
    }

    if (
      actionInfo.minXP != 0 &&
      _getRealXP(actionInfo.skill.asSkill(), _playerXP[playerId], _pendingQueuedActionProcessed, _pendingQuestState) <
      actionInfo.minXP
    ) {
      revert ActionMinimumXPNotReached();
    }

    bool isCombat = actionInfo.skill.asSkill().isCombat();
    bool isPlayerUpgraded = _isPlayerFullMode(playerId);

    // Check the actionChoice is valid
    ActionChoice memory actionChoice;
    if (actionInfo.actionChoiceRequired) {
      if (_queuedActionInput.choiceId == NONE) {
        revert ActionChoiceIdRequired();
      }
      actionChoice = world.getActionChoice(isCombat ? NONE : _queuedActionInput.actionId, _queuedActionInput.choiceId);

      if (
        _getRealXP(
          actionChoice.skill.asSkill(),
          _playerXP[playerId],
          _pendingQueuedActionProcessed,
          _pendingQuestState
        ) < actionChoice.minXP
      ) {
        revert ActionChoiceMinimumXPNotReached();
      }

      if (
        actionChoice.minSkill2.asSkill() != Skill.NONE &&
        _getRealXP(
          actionChoice.minSkill2.asSkill(),
          _playerXP[playerId],
          _pendingQueuedActionProcessed,
          _pendingQuestState
        ) <
        actionChoice.minXP2
      ) {
        revert ActionChoiceMinimumXPNotReached();
      }

      if (
        actionChoice.minSkill3.asSkill() != Skill.NONE &&
        _getRealXP(
          actionChoice.minSkill3.asSkill(),
          _playerXP[playerId],
          _pendingQueuedActionProcessed,
          _pendingQuestState
        ) <
        actionChoice.minXP3
      ) {
        revert ActionChoiceMinimumXPNotReached();
      }

      if (actionChoice.skill.asSkill() == Skill.NONE) {
        revert InvalidSkill();
      }

      // Timespan should be exact for the rate when travelling (e.g if it takes 2 hours, 2 hours should be queued)
      if (actionInfo.skill.asSkill() == Skill.TRAVELING) {
        if (_queuedActionInput.timespan != (RATE_MUL * 3600) / actionChoice.rate) {
          revert InvalidTravellingTimespan();
        }
      }

      bool actionChoiceFullModeOnly = uint8(actionChoice.packedData >> IS_FULL_MODE_BIT) & 1 == 1;
      if (actionChoiceFullModeOnly && !isPlayerUpgraded) {
        revert PlayerNotUpgraded();
      }
    } else if (_queuedActionInput.choiceId != NONE) {
      revert ActionChoiceIdNotRequired();
    }

    if (actionInfo.isFullModeOnly && !isPlayerUpgraded) {
      revert PlayerNotUpgraded();
    }

    if (_queuedActionInput.timespan == 0) {
      revert EmptyTimespan();
    }

    {
      // Check combatStyle is only selected if queuedAction is combat
      bool combatStyleSelected = _queuedActionInput.combatStyle.isNotCombatStyle(CombatStyle.NONE);
      if (isCombat != combatStyleSelected) {
        revert InvalidCombatStyle();
      }
    }

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
      _checkAttire(_from, playerId, isPlayerUpgraded, attire, _pendingQueuedActionProcessed, _pendingQuestState);
      setAttire = true;
    }

    _checkHandEquipments(
      _from,
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

    _checkPet(_from, isPlayerUpgraded, _queuedActionInput.petId);
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
    address _from,
    uint256 playerId,
    QueuedActionInputV2 memory _queuedActionInput,
    uint64 _queueId,
    uint40 _startTime
  ) private returns (QueuedAction memory queuedAction, QueuedActionExtra memory queuedActionExtra) {
    PendingQueuedActionProcessed memory pendingQueuedActionProcessed; // Empty
    QuestState memory pendingQuestState; // Empty
    bool setAttire = checkAddToQueue(
      _from,
      playerId,
      _queuedActionInput,
      pendingQueuedActionProcessed,
      pendingQuestState
    );
    if (setAttire) {
      attire_[playerId][_queueId] = _queuedActionInput.attire;
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
      queuedActionsExtra[_queueId] = queuedActionExtra;
      petNFT.assignPet(_from, playerId, _queuedActionInput.petId, _startTime);
    }
    queuedAction.packed = packed;
    _players[playerId].actionQueue.push(queuedAction);
  }

  function _checkFood(
    uint256 playerId,
    bool _isPlayerUpgraded,
    QueuedActionInputV2 memory _queuedActionInput,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _questState
  ) private view {
    if (_queuedActionInput.regenerateId != NONE) {
      (Skill skill, uint32 minXP, , bool isFoodFullModeOnly) = itemNFT.getEquipPositionAndMinRequirement(
        _queuedActionInput.regenerateId
      );
      if (_getRealXP(skill, _playerXP[playerId], _pendingQueuedActionProcessed, _questState) < minXP) {
        revert ConsumableMinimumXPNotReached();
      }
      // TODO: Untested
      if (isFoodFullModeOnly && !_isPlayerUpgraded) {
        revert PlayerNotUpgraded();
      }
    }
  }

  function _checkPet(address _from, bool _isPlayerUpgraded, uint256 _petId) private view {
    if (_petId != 0) {
      // All pets are upgrade only
      if (!_isPlayerUpgraded) {
        revert PlayerNotUpgraded();
      }

      if (petNFT.balanceOf(_from, _petId) == 0) {
        revert PetNotOwned();
      }
    }
  }

  function _checkEquipPosition(Attire memory _attire) private view {
    uint256 attireLength;
    uint16[] memory itemTokenIds = new uint16[](7);
    EquipPosition[] memory expectedEquipPositions = new EquipPosition[](7);
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
    if (_attire.ring != NONE) {
      itemTokenIds[attireLength] = _attire.ring;
      expectedEquipPositions[attireLength] = EquipPosition.RING;
      attireLength = attireLength.inc();
    }

    assembly ("memory-safe") {
      mstore(itemTokenIds, attireLength)
    }

    if (attireLength != 0) {
      EquipPosition[] memory equipPositions = itemNFT.getEquipPositions(itemTokenIds);
      U256 bounds = attireLength.asU256();
      for (U256 iter; iter < bounds; iter = iter.inc()) {
        uint256 i = iter.asUint256();
        if (expectedEquipPositions[i] != equipPositions[i]) {
          revert InvalidEquipPosition();
        }
      }
    }
  }

  // Checks they have sufficient balance to equip the items, and minimum skill points
  function _checkAttire(
    address _from,
    uint256 playerId,
    bool _isPlayerUpgraded,
    Attire memory _attire,
    PendingQueuedActionProcessed memory _pendingQueuedActionProcessed,
    QuestState memory _questState
  ) private view {
    // Check the user has these items
    _checkEquipPosition(_attire);

    bool skipNonFullAttire;
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates;
    (uint16[] memory itemTokenIds, uint256[] memory balances) = PlayersLibrary.getAttireWithBalance(
      _from,
      _attire,
      address(itemNFT),
      skipNonFullAttire,
      pendingQueuedActionEquipmentStates
    );
    if (itemTokenIds.length != 0) {
      (Skill[] memory skills, uint32[] memory minXPs, bool[] memory isItemFullModeOnly) = itemNFT.getMinRequirements(
        itemTokenIds
      );
      U256 iter = balances.length.asU256();

      while (iter.neq(0)) {
        iter = iter.dec();
        uint256 i = iter.asUint256();
        if (_getRealXP(skills[i], _playerXP[playerId], _pendingQueuedActionProcessed, _questState) < minXPs[i]) {
          revert AttireMinimumXPNotReached();
        }
        if (balances[i] == 0) {
          revert NoItemBalance(itemTokenIds[i]);
        }
        if (!_isPlayerUpgraded && isItemFullModeOnly[i]) {
          revert PlayerNotUpgraded();
        }
      }
    }
  }

  function _checkHandEquipments(
    address _from,
    uint256 playerId,
    bool _isPlayerUpgraded,
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
      uint256 i = iter.asUint256();
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
        if (_getRealXP(skill, _playerXP[playerId], _pendingQueuedActionProcessed, _questState) < minXP) {
          revert ItemMinimumXPNotReached();
        }
        if (isItemFullModeOnly && !_isPlayerUpgraded) {
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

  function _clearActionQueue(address _from, uint256 playerId) private {
    QueuedAction[] memory queuedActions;
    QueuedActionExtra[] memory _queuedActionsExtra;
    Attire[] memory attire;
    uint256 startTime = 0;
    _setActionQueue(_from, playerId, queuedActions, _queuedActionsExtra, attire, startTime);
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
  function clearEverything(address _from, uint256 playerId, bool _processTheActions) public {
    if (_processTheActions) {
      _processActions(_from, playerId);
    }
    // Ensure player info is cleared
    _clearCurrentActionProcessed(playerId);
    Player storage player = _players[playerId];
    player.currentActionStartTime = 0;

    emit ClearAll(_from, playerId);
    _clearActionQueue(_from, playerId);
    // Remove any active boost
    PlayerBoostInfo storage activeBoost = _activeBoosts[playerId];
    if (activeBoost.boostType != BoostType.NONE) {
      _clearPlayerMainBoost(playerId);
      if (activeBoost.startTime > block.timestamp) {
        // Mint it if it hasn't been consumed yet
        itemNFT.mint(_from, activeBoost.itemTokenId, 1);
      }
    }
  }

  function validateActionsImpl(
    address owner,
    uint256 playerId,
    QueuedActionInputV2[] memory queuedActionInputs
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
