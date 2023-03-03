// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./World.sol";
import "./types.sol";
import "./items.sol";
import "./ItemNFT.sol";
import "./PlayerNFT.sol";

import {PlayerLibrary} from "./PlayerLibrary.sol";

contract Players is
  OwnableUpgradeable,
  UUPSUpgradeable //, Multicall {
{
  event ActionUnequip(uint playerId, uint queueId, uint16 itemTokenId, uint amount);

  event ClearAll(uint playerId);

  event AddSkillPoints(uint playerId, Skill skill, uint32 points);

  event LevelUp(uint playerId, uint[] itemTokenIdsRewarded, uint[] amountTokenIdsRewarded);

  event SetActionQueue(uint playerId, QueuedAction[] queuedActions);

  event ConsumeBoostVial(uint playerId, PlayerBoostInfo playerBoostInfo);
  event UnconsumeBoostVial(uint playerId);

  event SetActivePlayer(address account, uint oldPlayerId, uint newPlayerId);

  event RemoveQueuedAction(uint playerId, uint queueId);

  event AddPendingRandomReward(uint playerId, uint timestamp, uint elapsed);

  // For logging
  event Died(address from, uint playerId, uint queueId);
  event Rewards(address from, uint playerId, uint queueId, uint[] itemTokenIds, uint[] amounts);
  event Reward(address from, uint playerId, uint queueId, uint itemTokenId, uint amount); // Used in PlayerLibrary too
  event Consume(address from, uint playerId, uint queueId, uint itemTokenId, uint amount); // Used in PlayerLibrary too
  event ActionFinished(address from, uint playerId, uint queueId);
  event ActionPartiallyFinished(address from, uint playerId, uint queueId, uint elapsedTime);

  error SkillsArrayZero();
  error NotOwner();
  error NotActive();
  error EquipSameItem();
  error NotEquipped();
  error ArgumentLengthMismatch();
  error NotPlayerNFT();
  error NotItemNFT();
  error ActionNotAvailable();
  error UnsupportedAttire();
  error InvalidArmEquipment(uint16 itemTokenId);
  error DoNotHaveEnoughQuantityToEquipToAction();
  error NoActiveBoost();
  error BoostTimeAlreadyStarted();
  error TooManyActionsQueued();
  error TooManyActionsQueuedSomeAlreadyExist();
  error ActionTimespanExceedsMaxTime();

  uint32 public constant MAX_TIME = 1 days;
  uint constant LEVEL_5_BOUNDARY = 374;
  uint constant LEVEL_10_BOUNDARY = 1021;
  uint constant LEVEL_15_BOUNDARY = 1938;
  uint constant LEVEL_20_BOUNDARY = 3236;
  uint constant LEVEL_30_BOUNDARY = 7650;
  uint constant LEVEL_40_BOUNDARY = 16432;
  uint constant LEVEL_50_BOUNDARY = 33913;
  uint constant LEVEL_60_BOUNDARY = 68761;
  uint constant LEVEL_70_BOUNDARY = 138307;
  uint constant LEVEL_80_BOUNDARY = 277219;
  uint constant LEVEL_90_BOUNDARY = 554828;
  uint constant LEVEL_99_BOUNDARY = 1035476;

  uint constant MAX_MAIN_EQUIPMENT_ID = 65536 * 8;

  mapping(uint => uint) speedMultiplier; // 0 or 1 is diabled, for testing only

  mapping(address => uint) activePlayer;

  mapping(uint => PlayerBoostInfo) public activeBoosts; // player id => boost info

  uint private queueId; // Global queued action id
  World private world;

  mapping(uint => mapping(Skill => uint32)) public skillPoints;

  mapping(uint => Player) public players;
  ItemNFT private itemNFT;
  PlayerNFT private playerNFT;
  mapping(uint => PendingRandomReward[]) private pendingRandomRewards; // queue, will be sorted by timestamp

  struct EquipmentDiff {
    uint16 itemTokenId;
    int128 change;
  }

  mapping(uint => EquipmentDiff[]) public actionEquipmentItemTokenIds; // QueuedActionId. Should only hold it for actions/actionChoices that are applicable

  enum ActionQueueStatus {
    NONE,
    APPEND,
    KEEP_LAST_IN_PROGRESS
  }

  modifier isOwnerOfPlayer(uint playerId) {
    if (playerNFT.balanceOf(msg.sender, playerId) != 1) {
      revert NotOwner();
    }
    _;
  }

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (playerNFT.balanceOf(msg.sender, _playerId) != 1) {
      revert NotOwner();
    }
    if (activePlayer[msg.sender] != _playerId) {
      revert NotActive();
    }
    _;
  }

  modifier onlyPlayerNFT() {
    if (msg.sender != address(playerNFT)) {
      revert NotPlayerNFT();
    }
    _;
  }

  modifier onlyItemNFT() {
    if (msg.sender != address(itemNFT)) {
      revert NotItemNFT();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(ItemNFT _itemNFT, PlayerNFT _playerNFT, World _world) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();

    itemNFT = _itemNFT;
    playerNFT = _playerNFT;
    world = _world;

    queueId = 1; // Global queued action id
  }

  // Consumes all the actions in the queue up to this time.
  // Unequips everything which is just emitting an event
  // Mints the boost vial if it hasn't been consumed at all yet
  // Removes all the actions from the queue
  function _clearEverything(address _from, uint _playerId) private {
    _consumeActions(_from, _playerId);
    emit ClearAll(_playerId);
    // Can re-mint boost if it hasn't been consumed at all yet
    if (activeBoosts[_playerId].boostType != BoostType.NONE && activeBoosts[_playerId].startTime < block.timestamp) {
      itemNFT.mint(_from, activeBoosts[_playerId].itemTokenId, 1);
      delete activeBoosts[_playerId];
    }
    _clearActionQueue(_playerId);
  }

  function clearEverything(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    _clearEverything(msg.sender, _playerId);
  }

  function clearEverythingBeforeTokenTransfer(address _from, uint _playerId) external onlyPlayerNFT {
    _clearEverything(_from, _playerId);
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

  // If an item is transferred from a player, we need to unequip it from main attire for an action,
  // because it could affect stats.
  function itemBeforeTokenTransfer(
    address _from,
    uint[] calldata _itemTokenIds,
    uint[] calldata _amounts
  ) external onlyItemNFT {
    uint playerId = activePlayer[_from];
    if (playerId == 0) {
      return;
    }
    /*
    // Check if any of these are equipped, if no unequip if they don't have sufficient balance
    QueuedAction[] memory remainingSkillQueue = _consumeActions(_from, playerId);

    for (uint i = 0; i < _itemTokenIds.length; ++i) {
      uint itemTokenId = _itemTokenIds[i];
      uint amount = _amounts[i];
      if (itemTokenId < MAX_MAIN_EQUIPMENT_ID) {
        // Only have 1 and it's equipped so unequip it.
//        if (itemNFT.balanceOf(_from, itemTokenId) == 1 && _isMainEquipped(playerId, itemTokenId)) {
//          _unequip(playerId, _getMainEquipPosition(itemTokenId));
//        }
      } else {
        // Not main attire. This is potentially equipped in an action, need to check all the queued actions and action choices
        Player storage player = players[_playerId];
        player.actionQueue = _queuedActions;

        for (uint i = 0; i < player.actionQueue.length; ++i) {
          QueuedAction storage queuedAction = player.actionQueue[i];

          // Left/right arm

          // Food

          // Consumables

          if (_queuedAction.choiceId != NONE) {
            // Get all items for this
            ActionChoice memory actionChoice = world.getActionChoice(
              _isCombat(_queuedAction.skill) ? NONE : _queuedAction.actionId,
              _queuedAction.choiceId
            );

            _equipActionConsumable(_playerId, actionChoice.inputTokenId1, actionChoice.num1 * _queuedAction.num);
            _equipActionConsumable(_playerId, actionChoice.inputTokenId2, actionChoice.num2 * _queuedAction.num);
            _equipActionConsumable(_playerId, actionChoice.inputTokenId3, actionChoice.num3 * _queuedAction.num);
          }

          queuedAction.choiceId;

          //        player.actionQueue = remainingSkillQueue;
          //        actionEquipmentItemTokenIds
        }
      }
    }

    // Any of these remaining actions requiring this and don't have appropriate outputs?
    _setActionQueue(playerId, remainingSkillQueue); */
  }

  function mintBatch(address _to, uint[] calldata _ids, uint256[] calldata _amounts) external onlyPlayerNFT {
    itemNFT.mintBatch(_to, _ids, _amounts);
  }

  function _updateCombatStats(
    address _from,
    CombatStats memory _stats,
    Attire storage _attire,
    bool _add,
    uint _startTime
  ) private view returns (CombatStats memory) {
    return PlayerLibrary.updateCombatStats(_from, _stats, _attire, itemNFT, _add);
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

  function _checkEquipActionEquipment(
    address _from,
    uint16 _itemTokenId,
    uint16 _itemTokenIdRangeMin,
    uint16 _itemTokenIdRangeMax
  ) private view {
    if (_itemTokenId != NONE) {
      if (_itemTokenId < _itemTokenIdRangeMin || _itemTokenId > _itemTokenIdRangeMax) {
        revert InvalidArmEquipment(_itemTokenId);
      }

      uint256 balance = itemNFT.balanceOf(_from, _itemTokenId);
      if (balance == 0) {
        revert DoNotHaveEnoughQuantityToEquipToAction();
      }
    }
  }

  // This doesn't work as memory structs take up 1 element per slot, so we can't just do a mload
  /*  function _getEquipmentRawVal(Attire memory _attire) private view returns (uint256 raw) {
    assembly ("memory-safe") {
      raw := mload(_attire)
    }
  } */

  function _isCombat(Skill _skill) private pure returns (bool) {
    return _skill == Skill.ATTACK || _skill == Skill.DEFENCE || _skill == Skill.MAGIC || _skill == Skill.RANGED;
  }

  function _consumeBoost(uint _playerId, uint16 _itemTokenId, uint40 _startTime) private {
    PlayerBoostInfo storage playerBoost = activeBoosts[_playerId];
    PlayerLibrary.consumeBoost(_itemTokenId, itemNFT, _startTime, playerBoost);
    emit ConsumeBoostVial(_playerId, playerBoost);
  }

  function consumeBoost(
    uint _playerId,
    uint16 _itemTokenId,
    uint40 _startTime
  ) external isOwnerOfPlayerAndActive(_playerId) {
    _consumeBoost(_playerId, _itemTokenId, _startTime);
  }

  function unequipBoostVial(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    if (activeBoosts[_playerId].boostType == BoostType.NONE) {
      revert NoActiveBoost();
    }
    if (activeBoosts[_playerId].startTime > block.timestamp) {
      revert BoostTimeAlreadyStarted();
    }
    address from = msg.sender;
    itemNFT.mint(from, activeBoosts[_playerId].itemTokenId, 1);
    emit UnconsumeBoostVial(_playerId);
  }

  // Checks they have sufficient balance to equip the items
  function _checkAttire(address _from, Attire memory _attire) private view {
    PlayerLibrary.checkAttire(_from, _attire, itemNFT);
  }

  function _checkActionConsumables(address _from, QueuedAction memory _queuedAction) private view {
    PlayerLibrary.checkActionConsumables(_from, _queuedAction, itemNFT, world);
  }

  function _addToQueue(
    address _from,
    uint _playerId,
    QueuedAction memory _queuedAction,
    uint64 _queueId,
    uint _startTime
  ) private {
    Player storage _player = players[_playerId];
    //    Skill skill = world.getSkill(_queuedAction.actionId); // Can be combat

    if (_queuedAction.attire.ring != NONE) {
      revert UnsupportedAttire();
    }
    if (_queuedAction.attire.reserved1 != NONE) {
      revert UnsupportedAttire();
    }

    (uint16 itemTokenIdRangeMin, uint16 itemTokenIdRangeMax) = world.getPermissibleItemsForAction(
      _queuedAction.actionId
    );

    if (!world.actionIsAvailable(_queuedAction.actionId)) {
      revert ActionNotAvailable();
    }

    // TODO: Check if it requires an action choice and that a valid one was specified
    _checkEquipActionEquipment(_from, _queuedAction.leftArmEquipmentTokenId, itemTokenIdRangeMin, itemTokenIdRangeMax);
    _checkEquipActionEquipment(_from, _queuedAction.rightArmEquipmentTokenId, itemTokenIdRangeMin, itemTokenIdRangeMax);

    _checkAttire(_from, _queuedAction.attire);
    _checkActionConsumables(_from, _queuedAction);

    _queuedAction.startTime = uint40(_startTime);
    _queuedAction.attire.queueId = _queueId;
    _player.actionQueue.push(_queuedAction);
  }

  function _clearActionQueue(uint _playerId) private {
    QueuedAction[] memory queuedActions;
    _setActionQueue(_playerId, queuedActions);
  }

  function _setActionQueue(uint _playerId, QueuedAction[] memory _queuedActions) private {
    Player storage player = players[_playerId];
    player.actionQueue = _queuedActions;
    emit SetActionQueue(_playerId, player.actionQueue);
  }

  function consumeActions(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    QueuedAction[] memory remainingSkillQueue = _consumeActions(msg.sender, _playerId);
    _setActionQueue(_playerId, remainingSkillQueue);
  }

  function _startActions(
    uint _playerId,
    QueuedAction[] memory _queuedActions,
    uint16 _boostItemTokenId,
    ActionQueueStatus _queueStatus
  ) private {
    if (_queuedActions.length == 0) {
      revert SkillsArrayZero();
    }

    address from = msg.sender;
    uint totalTimespan;
    QueuedAction[] memory remainingSkills = _consumeActions(from, _playerId);

    if (_boostItemTokenId != NONE) {
      _consumeBoost(_playerId, _boostItemTokenId, uint40(block.timestamp));
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

      for (uint i = 0; i < remainingSkills.length; ++i) {
        totalTimespan += remainingSkills[i].timespan;
      }
    }

    uint prevEndTime = block.timestamp + totalTimespan;

    uint256 i;
    uint currentQueuedActionId = queueId;
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

      _addToQueue(from, _playerId, queuedAction, uint64(currentQueuedActionId), prevEndTime);
      unchecked {
        ++i;
        ++currentQueuedActionId;
      }
      totalTimespan += queuedAction.timespan;
      prevEndTime += queuedAction.timespan;
    } while (i < _queuedActions.length);

    emit SetActionQueue(_playerId, player.actionQueue);

    assert(totalTimespan <= MAX_TIME); // Should never happen
    queueId = currentQueuedActionId;
  }

  function startAction(
    uint _playerId,
    QueuedAction calldata _queuedAction,
    ActionQueueStatus _queueStatus
  ) external isOwnerOfPlayerAndActive(_playerId) {
    QueuedAction[] memory queuedActions = new QueuedAction[](1);
    queuedActions[0] = _queuedAction;
    _startActions(_playerId, queuedActions, NONE, _queueStatus);
  }

  // Queue them up (Skill X for some amount of time, Skill Y for some amount of time, SKill Z for some amount of time)
  function startActions(
    uint _playerId,
    QueuedAction[] calldata _queuedActions,
    uint16 _boostItemTokenId,
    ActionQueueStatus _queueStatus
  ) external isOwnerOfPlayerAndActive(_playerId) {
    _startActions(_playerId, _queuedActions, _boostItemTokenId, _queueStatus);
  }

  /*
  function removeQueuedAction(uint _playerId, uint _queueId) external isOwnerOfPlayer(_playerId) {
    // If the action is in progress, it can't be removed (allow later)
    QueuedAction[] storage actionQueue = players[_playerId].actionQueue;
    for (uint i; i < actionQueue.length; ++i) {
      QueuedAction storage queuedAction = actionQueue[i];
      if (queuedAction.attire.queueId == _queueId) {
        uint skillEndTime = queuedAction.startTime +
          (
            speedMultiplier[_playerId] > 1
              ? uint(queuedAction.timespan) / speedMultiplier[_playerId]
              : queuedAction.timespan
          );

        uint elapsedTime = _getElapsedTime(_playerId, skillEndTime, queuedAction);
        require(elapsedTime == 0, "Elapsed time must be > 0");
        // Action hasn't started yet so allow it to be removed.
        for (uint j = i; j < actionQueue.length - 1; ++j) {
          actionQueue[j] = actionQueue[j + 1];
          // Shift start times
          actionQueue[j].startTime -= queuedAction.timespan;
        }
        actionQueue.pop();
        emit RemoveQueuedAction(_playerId, _queueId);
        return;
      }
    }
  } */

  // Get any changes that are pending and not on the blockchain yet.
  function pending(uint _playerId) external view returns (PendingOutput memory pendingOutput) {
    QueuedAction[] storage actionQueue = players[_playerId].actionQueue;
    return
      PlayerLibrary.pending(
        _playerId,
        actionQueue,
        players[_playerId],
        itemNFT,
        world,
        speedMultiplier[_playerId],
        activeBoosts[_playerId],
        pendingRandomRewards[_playerId]
      );
  }

  function getPendingRandomRewards(uint _playerId) external view returns (PendingRandomReward[] memory) {
    return pendingRandomRewards[_playerId];
  }

  function getActionQueue(uint _playerId) external view returns (QueuedAction[] memory) {
    return players[_playerId].actionQueue;
  }

  function actionQueueLength(uint _playerId) external view returns (uint256) {
    return players[_playerId].actionQueue.length;
  }

  /*  function getLootBonusMultiplier(uint  _playerId) external view returns (uint256) {
    // The higher the level the higher the multiplier?
    return 2;
  } */

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

  /*
  function getLoot(uint actionId, uint seed) external view returns (uint[] memory playerIds) {
    if (seed == 0) {
      return playerIds;
    }

    playerIds = new uint[](3); // max
    uint length;
    if (seed % 2 == 0) {
      playerIds[0] = SAPPHIRE_AMULET;
    } else {
      playerIds[0] = BRONZE_PICKAXE;
    }

    assembly ("memory-safe") {
      mstore(playerIds, length)
    }
  } */

  function setSpeedMultiplier(uint _playerId, uint16 multiplier) external {
    // Disable for production code
    speedMultiplier[_playerId] = multiplier;
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

  function getURI(
    uint _playerId,
    bytes32 _name,
    bytes32 _avatarName,
    string calldata _avatarDescription,
    string calldata imageURI
  ) external view returns (string memory) {
    Player storage player = players[_playerId];
    return
      PlayerLibrary.uri(_name, skillPoints[_playerId], player.totalStats, _avatarName, _avatarDescription, imageURI);
  }

  function _getElapsedTime(
    uint _playerId,
    uint _skillEndTime,
    QueuedAction storage _queuedAction
  ) private view returns (uint) {
    return PlayerLibrary.getElapsedTime(_skillEndTime, _queuedAction, speedMultiplier[_playerId]);
  }

  function _updateSkillPoints(uint _playerId, Skill _skill, uint32 _pointsAccrued) private {
    skillPoints[_playerId][_skill] += _pointsAccrued;
    emit AddSkillPoints(_playerId, _skill, _pointsAccrued);
  }

  //  uint count;
  error err(uint);

  function _addPendingRandomReward(
    PendingRandomReward[] storage _pendingRandomRewards,
    ActionRewards memory _actionRewards,
    uint _actionId,
    uint _queueId,
    uint _elapsedTime,
    uint _skillEndTime
  ) private {
    bool hasRandomRewards = _actionRewards.randomRewardTokenId1 != NONE; // A precheck as an optimization
    if (hasRandomRewards) {
      bool hasSeed = world.hasSeed(_skillEndTime);
      if (!hasSeed) {
        //        if (_pendingRandomRewards.length > 0) {
        //          revert err(99);
        //        }
        // There's no seed for this yet, so add it to the loot queue. (TODO: They can force add it later)
        _pendingRandomRewards.push(
          PendingRandomReward({
            actionId: uint64(_actionId),
            queueId: uint128(_queueId),
            timestamp: uint40(_skillEndTime),
            elapsedTime: uint24(_elapsedTime)
          })
        );
        emit AddPendingRandomReward(_actionId, _skillEndTime, _elapsedTime);

        //        if (count == 1) {
        //          revert err(8);
        //        }
      } /* else {
        if (count == 1) {
          revert err(2);
        }
      } */
    } /* else {
      if (count == 1) {
        revert err(9);
      }
    } */
    //    ++count;
  }

  // Callback after minting a player. If they aren't the active player then set it.
  function mintedPlayer(address _from, uint _playerId, bool makeActive) external onlyPlayerNFT {
    if (makeActive) {
      _setActivePlayer(_from, _playerId);
    }
  }

  function _setActivePlayer(address _from, uint _playerId) private {
    uint existingActivePlayer = activePlayer[_from];
    if (existingActivePlayer > 0) {
      // If there is an existing active player, unequip all items
      _clearEverything(_from, existingActivePlayer);
    }
    // All attire and actions can be made for this player
    activePlayer[_from] = _playerId;
    emit SetActivePlayer(_from, existingActivePlayer, _playerId);
  }

  function setActivePlayer(uint _playerId) external isOwnerOfPlayer(_playerId) {
    _setActivePlayer(msg.sender, _playerId);
  }

  function _extraXPFromBoost(
    uint _playerId,
    bool _isCombatSkill,
    uint _actionStartTime,
    uint _elapsedTime,
    uint16 _xpPerHour
  ) private view returns (uint32 boostPointsAccrued) {
    return
      PlayerLibrary.extraXPFromBoost(
        _isCombatSkill,
        _actionStartTime,
        _elapsedTime,
        _xpPerHour,
        activeBoosts[_playerId]
      );
  }

  function claimableRandomRewards(
    uint _playerId
  ) external view returns (uint[] memory ids, uint[] memory amounts, uint numRemoved) {
    return PlayerLibrary.claimableRandomRewards(msg.sender, world, pendingRandomRewards[_playerId]);
  }

  function claimRandomRewards(uint _playerId) public isOwnerOfPlayerAndActive(_playerId) {
    address from = msg.sender;
    (uint[] memory ids, uint[] memory amounts, uint numRemoved) = PlayerLibrary.claimableRandomRewards(
      from,
      world,
      pendingRandomRewards[_playerId]
    );

    if (numRemoved > 0) {
      // Shift the remaining rewards to the front of the array
      for (uint i; i < pendingRandomRewards[_playerId].length - numRemoved; ++i) {
        pendingRandomRewards[_playerId][i] = pendingRandomRewards[_playerId][i + numRemoved];
      }

      for (uint i; i < numRemoved; ++i) {
        pendingRandomRewards[_playerId].pop();
      }

      itemNFT.mintBatch(from, ids, amounts);
      //      emit Rewards(from, _playerId, _queueId, ids, amounts);
    }
  }

  function _consumeActions(address _from, uint _playerId) private returns (QueuedAction[] memory remainingSkills) {
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
      CombatStats memory combatStats = _updateCombatStats(
        _from,
        player.totalStats,
        queuedAction.attire,
        true,
        queuedAction.startTime
      );

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
      bool isCombat = _isCombat(queuedAction.skill);

      uint xpElapsedTime = elapsedTime;

      if (queuedAction.choiceId != 0) {
        // Includes combat
        // { || isCombat) {
        uint combatElapsedTime;
        actionChoice = world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);

        (xpElapsedTime, combatElapsedTime, died) = PlayerLibrary.processConsumables(
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
      uint _queueId = queuedAction.attire.queueId;
      if (!died) {
        bool _isCombatSkill = _isCombat(queuedAction.skill);
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
        _updateSkillPoints(_playerId, queuedAction.skill, pointsAccrued);

        if (_isCombat(queuedAction.skill)) {
          // Update health too with 33%
          _updateSkillPoints(_playerId, Skill.HEALTH, (pointsAccrued * 33) / 100);
        }

        ActionRewards memory actionRewards = world.getActionRewards(queuedAction.actionId);
        (uint[] memory newIds, uint[] memory newAmounts) = PlayerLibrary.getRewards(
          _from,
          uint40(queuedAction.startTime + xpElapsedTime),
          xpElapsedTime,
          world,
          actionRewards
        );

        _addPendingRandomReward(
          pendingRandomRewards[_playerId],
          actionRewards,
          queuedAction.actionId,
          _queueId,
          xpElapsedTime,
          skillEndTime
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

    claimRandomRewards(_playerId);

    assembly ("memory-safe") {
      mstore(remainingSkills, length)
    }
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
