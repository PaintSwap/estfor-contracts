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

contract Players is OwnableUpgradeable, UUPSUpgradeable, Multicall {
  event ActionUnequip(uint playerId, uint queueId, uint16 itemTokenId, uint amount); // Used in PlayerLibrary for  Should match the event in Players

  event ClearAll(uint playerId);
  event ActionFinished(uint playerId, uint queueId);

  event AddSkillPoints(uint playerId, Skill skill, uint32 points);

  event LevelUp(uint playerId, uint[] itemTokenIdsRewarded, uint[] amountTokenIdsRewarded);

  event AddToActionQueue(uint playerId, QueuedAction queuedAction); // This includes everything
  event SetActionQueue(uint playerId, QueuedAction[] queuedActions);

  event ConsumeBoostVial(uint playerId, PlayerBoostInfo playerBoostInfo);
  event UnconsumeBoostVial(uint playerId);

  event SetActivePlayer(address account, uint playerId);

  event RemoveQueuedAction(uint playerId, uint queueId);

  // TODO this could be packed better. As Combat stats are 8 bytes so could fit 4 of them
  struct AttireAttributes {
    CombatStats helmet;
    CombatStats amulet;
    CombatStats chestplate;
    CombatStats tassets;
    CombatStats gauntlets;
    CombatStats boots;
    CombatStats ring;
    CombatStats reserved1;
  }

  error SkillsArrayZero();
  error NotOwner();
  error NotActive();
  error EquipSameItem();
  error NotEquipped();
  error ArgumentLengthMismatch();

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

  uint constant MAX_MAIN_EQUIPMENT_ID = 256 * 8;

  mapping(uint => uint) speedMultiplier; // 0 or 1 is diabled, for testing only

  mapping(address => uint) activePlayer;

  mapping(uint => PlayerBoostInfo) public activeBoosts; // player id => boost info

  uint private queueId; // Global queued action id
  World private world;

  mapping(uint => mapping(Skill => uint32)) public skillPoints;

  mapping(uint => Player) public players;
  ItemNFT private itemNFT;
  PlayerNFT private playerNFT;
  PendingLoot[] private pendingLoot; // queue, will be sorted by timestamp

  struct EquipmentDiff {
    uint16 itemTokenId;
    int128 change;
  }

  mapping(uint => EquipmentDiff[]) public actionEquipmentItemTokenIds; // QueuedActionId. Should only hold it for actions/actionChoices that are applicable

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
    require(msg.sender == address(playerNFT));
    _;
  }

  modifier onlyItemNFT() {
    require(msg.sender == address(itemNFT));
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

    return EquipPosition(_itemTokenId / 256);
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

  function _updatePlayerStats(
    address _from,
    CombatStats memory _stats,
    Attire storage _attire,
    bool _add,
    uint _startTime
  ) private view {
    PlayerLibrary.updateCombatStats(_from, _stats, _attire, itemNFT, _add);
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

  function _checkEquipActionEquipmentBalance(address _from, uint16 _itemTokenId) private view {
    uint256 balance = itemNFT.balanceOf(_from, _itemTokenId);
    require(balance >= 1); // , "Do not have enough quantity to equip to action");
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
    PlayerBoostInfo storage playerBoost = activeBoosts[_playerId];
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

  function consumeBoost(
    uint _playerId,
    uint16 _itemTokenId,
    uint40 _startTime
  ) external isOwnerOfPlayerAndActive(_playerId) {
    _consumeBoost(_playerId, _itemTokenId, _startTime);
  }

  function unequipBoostVial(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    require(activeBoosts[_playerId].boostType != BoostType.NONE); // , "No active boost");
    require(activeBoosts[_playerId].startTime <= block.timestamp); // "Boost time already started");
    address from = msg.sender;
    itemNFT.mint(from, activeBoosts[_playerId].itemTokenId, 1);
    emit UnconsumeBoostVial(_playerId);
  }

  // Checks they have sufficient balance to equip the items
  function _checkAttire(address _from, Attire memory _attire) private view {
    // Check the user has these items
    //    uint raw = _getEquipmentRawVal(_attire);
    //    if (raw > 0) {
    if (_attire.helmet != NONE) {
      require(itemNFT.balanceOf(_from, _attire.helmet) > 0);
    }
    if (_attire.amulet != NONE) {
      require(itemNFT.balanceOf(_from, _attire.amulet) > 0);
    }
    if (_attire.chestplate != NONE) {
      require(itemNFT.balanceOf(_from, _attire.chestplate) > 0);
    }
    if (_attire.gauntlets != NONE) {
      require(itemNFT.balanceOf(_from, _attire.gauntlets) > 0);
    }
    if (_attire.tassets != NONE) {
      require(itemNFT.balanceOf(_from, _attire.tassets) > 0);
    }
    if (_attire.boots != NONE) {
      require(itemNFT.balanceOf(_from, _attire.boots) > 0);
    }
    //    }
  }

  function _checkActionConsumables(address _from, QueuedAction memory _queuedAction) private view {
    // Check they have this to equip. Indexer can check actionChoices
    if (_queuedAction.regenerateId != NONE) {
      require(itemNFT.balanceOf(_from, _queuedAction.regenerateId) > 0);
    }

    if (_queuedAction.choiceId != NONE) {
      // Get all items for this
      ActionChoice memory actionChoice = world.getActionChoice(
        _isCombat(_queuedAction.skill) ? NONE : _queuedAction.actionId,
        _queuedAction.choiceId
      );

      // TODO: Can be balance of batch
      if (actionChoice.inputTokenId1 != NONE) {
        require(itemNFT.balanceOf(_from, actionChoice.inputTokenId1) > 0);
      }
      if (actionChoice.inputTokenId2 != NONE) {
        require(itemNFT.balanceOf(_from, actionChoice.inputTokenId2) > 0);
      }
      if (actionChoice.inputTokenId3 != NONE) {
        require(itemNFT.balanceOf(_from, actionChoice.inputTokenId3) > 0);
      }
    }
    //     if (_queuedAction.choiceId1 != NONE) {
    //     if (_queuedAction.choiceId2 != NONE) {
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

    require(_queuedAction.attire.ring == NONE);
    require(_queuedAction.attire.reserved1 == NONE);

    (uint16 itemTokenIdRangeMin, uint16 itemTokenIdRangeMax) = world.getPermissibleItemsForAction(
      _queuedAction.actionId
    );

    require(world.actionIsAvailable(_queuedAction.actionId)); // , "Action is not available");

    // TODO: Check if it requires an action choice and that a valid one was specified

    if (_queuedAction.leftArmEquipmentTokenId != NONE) {
      require(
        _queuedAction.leftArmEquipmentTokenId >= itemTokenIdRangeMin &&
          _queuedAction.leftArmEquipmentTokenId <= itemTokenIdRangeMax
      );
      //        "Invalid item"
      _checkEquipActionEquipmentBalance(_from, _queuedAction.leftArmEquipmentTokenId);
    }
    if (_queuedAction.rightArmEquipmentTokenId != NONE) {
      require(
        _queuedAction.rightArmEquipmentTokenId >= itemTokenIdRangeMin &&
          _queuedAction.rightArmEquipmentTokenId <= itemTokenIdRangeMax
      );
      //        "Invalid item"
      _checkEquipActionEquipmentBalance(_from, _queuedAction.rightArmEquipmentTokenId);
    }

    _checkAttire(_from, _queuedAction.attire);
    _checkActionConsumables(_from, _queuedAction);

    _queuedAction.startTime = uint40(_startTime);
    _queuedAction.attire.queueId = _queueId;
    _player.actionQueue.push(_queuedAction);
    emit AddToActionQueue(_playerId, _queuedAction);
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
    bool _append
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
    if (!_append) {
      if (player.actionQueue.length > 0) {
        _clearActionQueue(_playerId);
      }
      require(_queuedActions.length <= 3); // , "Queueing too many");
    } else {
      // Keep remaining actions
      require(remainingSkills.length + _queuedActions.length <= 3); // , "Queueing too many (some already exist)");
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
      _addToQueue(from, _playerId, queuedAction, uint64(currentQueuedActionId), prevEndTime);
      unchecked {
        ++i;
        ++currentQueuedActionId;
      }
      totalTimespan += queuedAction.timespan;
      prevEndTime += queuedAction.timespan;
    } while (i < _queuedActions.length);

    require(totalTimespan <= MAX_TIME); // , "Total time is longer than max");
    queueId = currentQueuedActionId;
  }

  function startAction(
    uint _playerId,
    QueuedAction calldata _queuedAction,
    bool _append
  ) external isOwnerOfPlayerAndActive(_playerId) {
    QueuedAction[] memory queuedActions = new QueuedAction[](1);
    queuedActions[0] = _queuedAction;
    _startActions(_playerId, queuedActions, NONE, _append);
  }

  // Queue them up (Skill X for some amount of time, Skill Y for some amount of time, SKill Z for some amount of time)
  function startActions(
    uint _playerId,
    QueuedAction[] calldata _queuedActions,
    uint16 _boostItemTokenId,
    bool _append
  ) external isOwnerOfPlayerAndActive(_playerId) {
    _startActions(_playerId, _queuedActions, _boostItemTokenId, _append);
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
        require(elapsedTime == 0);
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
        activeBoosts[_playerId]
      );
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

  function _addPendingLoot(
    PendingLoot[] storage _pendingLoot,
    ActionReward[] memory _randomRewards,
    uint _actionId,
    uint _elapsedTime,
    uint _skillEndTime
  ) private {
    if (_randomRewards.length > 0) {
      bool hasSeed = world.hasSeed(_skillEndTime);
      if (!hasSeed) {
        // There's no seed for this yet, so add it to the loot queue. (TODO: They can force add it later)
        _pendingLoot.push(
          PendingLoot({actionId: _actionId, timestamp: uint40(_skillEndTime), elapsedTime: uint16(_elapsedTime)})
        );
      }
    }
  }

  function setActivePlayer(uint _playerId) external isOwnerOfPlayer(_playerId) {
    address from = msg.sender;
    uint existingActivePlayer = activePlayer[from];
    if (existingActivePlayer > 0) {
      // If there is an existing active player, unequip all items
      _clearEverything(from, existingActivePlayer);
    }
    // All attire and actions can be made for this player
    activePlayer[from] = _playerId;
    emit SetActivePlayer(from, _playerId);
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

      CombatStats memory combatStats = player.totalStats;

      // This will only ones that they have a balance for at this time. This will check balances
      _updatePlayerStats(_from, combatStats, queuedAction.attire, true, queuedAction.startTime);

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

      // Create some items if necessary (smithing ores to bars for instance)
      uint16 foodConsumed;
      uint16 numConsumed;
      bool died;

      ActionChoice memory actionChoice;
      bool isCombat = _isCombat(queuedAction.skill);

      if (queuedAction.choiceId != 0 || isCombat) {
        actionChoice = world.getActionChoice(isCombat ? 0 : queuedAction.actionId, queuedAction.choiceId);

        // This also unequips.
        (foodConsumed, numConsumed, elapsedTime, died) = PlayerLibrary.processConsumables(
          _from,
          _playerId,
          queuedAction,
          elapsedTime,
          world,
          itemNFT,
          player.totalStats,
          actionChoice
        );
      }

      if (!died) {
        bool _isCombatSkill = _isCombat(queuedAction.skill);
        uint16 xpPerHour = world.getXPPerHour(queuedAction.actionId, _isCombatSkill ? NONE : queuedAction.choiceId);
        pointsAccrued = uint32((elapsedTime * xpPerHour) / 3600);
        pointsAccrued += _extraXPFromBoost(_playerId, _isCombatSkill, queuedAction.startTime, elapsedTime, xpPerHour);
      }

      if (elapsedTime < queuedAction.timespan) {
        // Add the remainder if this action is not fully consumed
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, length);
        nextStartTime += elapsedTime;
        length = i + 1;
      }

      if (pointsAccrued > 0) {
        _updateSkillPoints(_playerId, queuedAction.skill, pointsAccrued);

        (ActionReward[] memory guaranteedRewards, ActionReward[] memory randomRewards) = world.getActionRewards(
          queuedAction.actionId
        );
        (uint[] memory newIds, uint[] memory newAmounts) = PlayerLibrary.getRewards(
          _from,
          uint40(queuedAction.startTime + elapsedTime),
          elapsedTime,
          world,
          guaranteedRewards,
          randomRewards
        );

        _addPendingLoot(pendingLoot, randomRewards, queuedAction.actionId, elapsedTime, skillEndTime);

        // This loot might be needed for a future task so mint now rather than later
        // But this could be improved
        itemNFT.mintBatch(_from, newIds, newAmounts);
        allpointsAccrued += pointsAccrued;
      }

      emit ActionFinished(_playerId, queuedAction.attire.queueId); // Action finished
    }

    if (allpointsAccrued > 0) {
      // Check if they have levelled up
      _handleLevelUpRewards(_from, _playerId, previousSkillPoints, previousSkillPoints + allpointsAccrued);
    }

    assembly ("memory-safe") {
      mstore(remainingSkills, length)
    }
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
