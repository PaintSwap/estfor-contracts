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
  event Equip(uint tokenId, uint16 itemTokenId);
  event Unequip(uint tokenId, uint16 itemTokenId);
  event SetEquipment(uint tokenId, uint16[] itemTokenIds);
  event ActionEquip(uint tokenId, uint16 itemTokenId, uint16 numEquipped);
  event ActionUnequip(uint tokenId, uint16 itemTokenId, uint16 numUnequipped);

  event AddSkillPoints(uint tokenId, Skill skill, uint32 points);

  event LevelUp(uint tokenId, uint[] itemTokenIdsRewarded, uint[] amountTokenIdsRewarded);

  event AddToActionQueue(uint tokenId, QueuedAction queuedAction);
  event SetActionQueue(uint tokenId, QueuedAction[] queuedActions);

  event EquipBoostVial(uint tokenId, PlayerPotionInfo playerPotionInfo);
  event UnequipBoostVial(uint tokenId);

  event SetActivePlayer(address account, uint tokenId);

  // This is only for viewing so doesn't need to be optimized
  struct PendingOutput {
    Equipment[] consumables;
    Equipment[] foodConsumed;
    ActionReward[] guaranteedRewards;
    ActionReward[] loot;
    bool died;
  }

  // TODO this could be packed better. As Combat stats are 8 bytes so could fit 4 of them
  struct ArmourAttributes {
    CombatStats helmet;
    CombatStats amulet;
    CombatStats chestplate;
    CombatStats tassets;
    CombatStats gauntlets;
    CombatStats boots;
    CombatStats reserved1;
    CombatStats reserved2;
  }

  error SkillsArrayZero();
  error NotOwner();
  error NotActive();
  error EquipSameItem();
  error NotEquipped();
  error ArgumentLengthMismatch();

  uint private constant MAX_LOOT_PER_ACTION = 5;
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

  mapping(uint => uint) speedMultiplier; // 0 or 1 is diabled, for testing only

  mapping(address => uint) activePlayer;

  struct PlayerPotionInfo {
    uint40 startTime;
    uint24 duration;
    uint16 val;
    uint16 tokenId; // Get the effect of it
    BoostType boostType;
  }
  mapping(uint => PlayerPotionInfo) public activePotions; // player id => potion info

  uint private queuedActionId; // Global queued action id
  World private world;

  mapping(uint => mapping(Skill => uint32)) public skillPoints;

  // This is kept separate in case we want to remove this being used and instead read attributes on demand.
  mapping(uint => ArmourAttributes) armourAttributes; // player id => attributes from armour

  mapping(uint => Player) public players;
  ItemNFT private itemNFT;
  PlayerNFT private playerNFT;
  PendingLoot[] private pendingLoot; // queue, will be sorted by timestamp

  modifier isOwnerOfPlayer(uint tokenId) {
    if (playerNFT.balanceOf(msg.sender, tokenId) != 1) {
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

    queuedActionId = 1; // Global queued action id
  }

  function _clearActionAttachments(uint _tokenId, QueuedAction[] memory remainingSkillQueue) private {
    // Everything equipped here needs unequipping

    bool isFinished = true;
    for (uint i = 0; i < remainingSkillQueue.length; ++i) {
      QueuedAction memory queuedAction = remainingSkillQueue[i];
      // Unequip left/right equipment
      _unequipFromFinishedAction(
        _tokenId,
        queuedAction.leftArmEquipmentTokenId,
        queuedAction.rightArmEquipmentTokenId,
        isFinished,
        0,
        remainingSkillQueue
      );

      // Unequip other consumables like food, arrows, etc
      _unequipActionConsumables(_tokenId, queuedAction);

      // Pop front, and move last to front  .
      uint remainingSkillQueueLength = remainingSkillQueue.length;
      if (remainingSkillQueueLength > 1) {
        remainingSkillQueue[0] = remainingSkillQueue[remainingSkillQueueLength - 1];
        assembly ("memory-safe") {
          mstore(remainingSkillQueue, sub(remainingSkillQueueLength, 1))
        }
      }
    }
  }

  // Consumes all the actions in the queue up to this time.
  // Unequips everything else from main equipment
  // Unequips all consumables from all the actions
  // Unequips the potion if it hasn't been consumed at all yet
  // Removes all the actions from the queue
  function _clearEverything(address _from, uint _tokenId) private {
    QueuedAction[] memory remainingSkillQueue = _consumeActions(_from, _tokenId);
    // Go through the remaining skill queue and unequip all the items
    _clearActionAttachments(_tokenId, remainingSkillQueue);
    // Can unequip potion if it hasn't been consumed at all yet
    //    if (activePotions[_tokenId].startTime < block.timestamp) {
    //      _unequipPotion(_from, _tokenId);
    //    }
    _clearMainEquipment(_tokenId);
    _clearActionQueue(_tokenId);
  }

  function clearEverything(uint _tokenId) external isOwnerOfPlayerAndActive(_tokenId) {
    _clearEverything(msg.sender, _tokenId);
  }

  function clearEverythingBeforeTokenTransfer(address _from, uint _tokenId) external onlyPlayerNFT {
    _clearEverything(_from, _tokenId);
  }

  function mintBatch(address _to, uint[] calldata _ids, uint256[] calldata _amounts) external onlyPlayerNFT {
    itemNFT.mintBatch(_to, _ids, _amounts);
  }

  function _clearMainEquipment(uint _tokenId) private {
    Player storage player = players[_tokenId];
    // Unequip each item one by one
    uint position = 0;
    bytes32 empty;
    do {
      _unequip(_tokenId, EquipPosition(position));
      assembly ("memory-safe") {
        // This trashes the combat bonus stats for each slot
        let slotPosition := add(player.slot, add(position, 1))
        sstore(slotPosition, empty)
      }

      unchecked {
        ++position;
      }
    } while (position < 8);

    assembly ("memory-safe") {
      // This trashes the combat bonuses for each slot
      let slotPosition := player.slot
      sstore(slotPosition, empty)
    }

    uint16[] memory itemTokenIds;
    emit SetEquipment(_tokenId, itemTokenIds);
    delete player.equipment;
  }

  /*
  function clearEquipment(uint _tokenId) external isOwnerOfPlayer(_tokenId) {
    address from = msg.sender;
    QueuedAction[] memory remainingSkillQueue = _consumeActions(from, _tokenId);
    _clearEquipment(from, _tokenId);
    _setActionQueue(_tokenId, remainingSkillQueue);
  } */

  function updatePlayerStats(Player storage _player, Item memory _item, bool _add) private {
    PlayerLibrary.updatePlayerStats(_player.totalStats, _item, _add);
  }

  function _unequipMainItem(uint _tokenId, uint16 _equippedTokenId) private {
    Player storage player = players[_tokenId];
    // Unequip current item and remove any stats given from the item
    Item memory item = itemNFT.getItem(_equippedTokenId);
    updatePlayerStats(player, item, false);
  }

  // Absolute setting of equipment
  function setEquipment(uint _tokenId, uint16[] calldata _itemTokenIds) external isOwnerOfPlayerAndActive(_tokenId) {
    Player storage player = players[_tokenId];
    address from = msg.sender;
    QueuedAction[] memory remainingSkillQueue = _consumeActions(from, _tokenId);

    // Unequip everything
    for (uint position; position < 8; ++position) {
      _unequip(_tokenId, EquipPosition(position));
    }

    // Equip necessary items
    bytes32 val;
    for (uint i; i < _itemTokenIds.length; ++i) {
      uint16 itemTokenId = _itemTokenIds[i];

      Item memory item = itemNFT.getItem(itemTokenId);
      EquipPosition position = item.equipPosition;
      require(item.exists);
      require(uint8(position) < 8);

      assembly ("memory-safe") {
        // Set the equipped item
        val := or(val, shl(mul(position, 16), itemTokenId))
      }

      uint256 balance = itemNFT.balanceOf(from, itemTokenId);
      require(balance >= 1);
      updatePlayerStats(player, item, true);
    }

    emit SetEquipment(_tokenId, _itemTokenIds);

    // Now set the slot once
    assembly ("memory-safe") {
      sstore(player.slot, val)
    }

    _setActionQueue(_tokenId, remainingSkillQueue);
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
    require(balance >= 1, "Do not have enough quantity to equip to action");
  }

  // Cannot be transferred while equipped.  Check if the NFT is being transferred and unequip from this user.
  // Replace old one
  function equip(uint _tokenId, uint16 _itemTokenId) external isOwnerOfPlayerAndActive(_tokenId) {
    Player storage player = players[_tokenId];
    address from = msg.sender;
    QueuedAction[] memory remainingSkillQueue = _consumeActions(from, _tokenId);
    Item memory item = itemNFT.getItem(_itemTokenId);
    EquipPosition position = item.equipPosition;
    require(item.exists);
    require(uint8(position) < 8);
    uint16 equippedTokenId = _getEquippedTokenId(position, player);

    assembly ("memory-safe") {
      let val := sload(player.slot)
      // Clear the byte position
      val := and(val, not(shl(mul(position, 16), 0xffff)))
      // Now set it
      val := or(val, shl(mul(position, 16), _itemTokenId))
      sstore(player.slot, val)
    }

    if (_itemTokenId == equippedTokenId && equippedTokenId != NONE) {
      revert EquipSameItem();
    }

    // Already something equipped there so unequip
    if (equippedTokenId != NONE) {
      _unequipMainItem(_tokenId, equippedTokenId);
      emit Unequip(_tokenId, equippedTokenId);
    }

    updatePlayerStats(player, item, true);
    uint256 balance = itemNFT.balanceOf(from, _itemTokenId);
    require(balance >= 1);
    emit Equip(_tokenId, _itemTokenId);
    // Continue last skill queue (if there's anything remaining)
    _setActionQueue(_tokenId, remainingSkillQueue);
  }

  function _unequip(uint _tokenId, EquipPosition _position) private returns (uint16 equippedItemTokenId) {
    Player storage player = players[_tokenId];
    equippedItemTokenId = _getEquippedTokenId(_position, player);
    if (equippedItemTokenId != NONE) {
      _unequipMainItem(_tokenId, equippedItemTokenId);
    }
  }

  function unequip(uint _tokenId, EquipPosition _position) external isOwnerOfPlayerAndActive(_tokenId) {
    address from = msg.sender;
    QueuedAction[] memory remainingSkillQueue = _consumeActions(from, _tokenId);
    uint16 equippedItemTokenId = _unequip(_tokenId, _position);
    require(equippedItemTokenId != NONE);
    emit Unequip(_tokenId, equippedItemTokenId);
    Player storage player = players[_tokenId];
    // Update the storage slot
    assembly ("memory-safe") {
      let val := sload(player.slot)
      // Clear the byte position
      val := and(val, not(shl(mul(_position, 8), 0xff)))
    }
    // Continue last skill queue (if there's anything remaining)
    _setActionQueue(_tokenId, remainingSkillQueue);
  }

  function _getEquipmentSlot(Player storage _player) private view returns (uint256 slot) {
    assembly ("memory-safe") {
      slot := sload(_player.slot)
    }
  }

  function _equipActionConsumable(uint _tokenId, uint16 _itemTokenId, uint16 _amount) private {
    if (_itemTokenId == NONE || _amount == 0) {
      return;
    }

    emit ActionEquip(_tokenId, _itemTokenId, _amount);
  }

  function _unequipActionConsumable(uint _tokenId, uint16 _itemTokenId, uint16 _amount) private {
    if (_itemTokenId == NONE || _amount == 0) {
      return;
    }
    emit ActionUnequip(_tokenId, _itemTokenId, _amount);
  }

  function _isCombat(Skill _skill) private pure returns (bool) {
    return _skill == Skill.ATTACK || _skill == Skill.DEFENCE || _skill == Skill.MAGIC || _skill == Skill.RANGED;
  }

  function consumePotion(
    uint _tokenId,
    uint16 _itemTokenId,
    uint40 _startTime
  ) external isOwnerOfPlayerAndActive(_tokenId) {
    //    require(_itemTokenId >= BOOST_VIAL_BASE && _itemTokenId <= BOOST_VIAL_MAX, "Not a boost vial");
    Item memory item = itemNFT.getItem(_itemTokenId);
    require(item.boostType != BoostType.NONE, "Not a potion");
    require(_startTime < block.timestamp + 7 days, "Start time too far in the future");
    if (_startTime < block.timestamp) {
      _startTime = uint40(block.timestamp);
    }

    // Burn it
    address from = msg.sender;
    itemNFT.burn(from, _itemTokenId, 1);

    // If there's an active potion which hasn't been consumed yet, then we can mint it back
    PlayerPotionInfo storage activePlayerVial = activePotions[_tokenId];
    if (activePlayerVial.tokenId != NONE) {
      itemNFT.mint(from, activePlayerVial.tokenId, 1);
    }

    activePlayerVial.startTime = _startTime;
    activePlayerVial.duration = item.boostDuration;
    activePlayerVial.val = item.boostValue;
    activePlayerVial.boostType = item.boostType;
    activePlayerVial.tokenId = _itemTokenId;

    // If there's an active potion which hasn't been consumed yet, then we can mint it
    emit EquipBoostVial(_tokenId, activePlayerVial);
  }

  function unequipBoostVial(uint _tokenId) external isOwnerOfPlayerAndActive(_tokenId) {
    require(activePotions[_tokenId].startTime <= block.timestamp, "Boost vial time already started");
    address from = msg.sender;
    itemNFT.mint(from, activePotions[_tokenId].tokenId, 1);
    emit UnequipBoostVial(_tokenId);
  }

  function _unequipActionConsumables(uint _tokenId, QueuedAction memory _queuedAction) private {
    _unequipActionConsumable(_tokenId, _queuedAction.regenerateId, _queuedAction.numRegenerate);

    if (_queuedAction.choiceId != NONE) {
      // Get all items for this
      ActionChoice memory actionChoice = world.getActionChoice(
        _isCombat(_queuedAction.skill) ? NONE : _queuedAction.actionId,
        _queuedAction.choiceId
      );

      _unequipActionConsumable(_tokenId, actionChoice.inputTokenId1, actionChoice.num1 * _queuedAction.num);
      _unequipActionConsumable(_tokenId, actionChoice.inputTokenId2, actionChoice.num2 * _queuedAction.num);
      _unequipActionConsumable(_tokenId, actionChoice.inputTokenId3, actionChoice.num3 * _queuedAction.num);
    }
    //    _unequipActionConsumable(_queuedAction.choiceId1, _queuedAction.num1);
    //    _unequipActionConsumable(_queuedAction.choiceId2, _queuedAction.num2);
  }

  /*
  function _removeQueueActionEquipment(uint _tokenId, QueuedAction memory _queuedAction) private {
    _unequipActionEquipment(_tokenId, _queuedAction.rightArmEquipmentTokenId, 1, ActionItemType.UNIQUE);
    _unequipActionEquipment(_tokenId, _queuedAction.leftArmEquipmentTokenId, 1, ActionItemType.UNIQUE);
  }
*/

  function _equipActionConsumables(uint _tokenId, QueuedAction memory _queuedAction) private {
    _equipActionConsumable(_tokenId, _queuedAction.regenerateId, _queuedAction.numRegenerate);

    if (_queuedAction.choiceId != NONE) {
      // Get all items for this
      ActionChoice memory actionChoice = world.getActionChoice(
        _isCombat(_queuedAction.skill) ? NONE : _queuedAction.actionId,
        _queuedAction.choiceId
      );

      _equipActionConsumable(_tokenId, actionChoice.inputTokenId1, actionChoice.num1 * _queuedAction.num);
      _equipActionConsumable(_tokenId, actionChoice.inputTokenId2, actionChoice.num2 * _queuedAction.num);
      _equipActionConsumable(_tokenId, actionChoice.inputTokenId3, actionChoice.num3 * _queuedAction.num);
    }
    //    _equipActionConsumable(_queuedAction.choiceId1, _queuedAction.num1);
    //    _equipActionConsumable(_queuedAction.choiceId2, _queuedAction.num2);
  }

  function _addToQueue(address _from, uint _tokenId, QueuedAction memory _queuedAction, uint _queuedActionId) private {
    Player storage _player = players[_tokenId];
    //    Skill skill = world.getSkill(_queuedAction.actionId); // Can be combat

    (uint16 itemTokenIdRangeMin, uint16 itemTokenIdRangeMax) = world.getPermissibleItemsForAction(
      _queuedAction.actionId
    );

    require(world.actionIsAvailable(_queuedAction.actionId), "Action is not available");

    // Left/right arm equipment
    bool leftArmExists = false;
    bool rightArmExists = false;
    for (uint i = 0; i < _player.actionQueue.length; ++i) {
      // If this is already equipped don't emit an event
      if (_player.actionQueue[i].leftArmEquipmentTokenId == _queuedAction.leftArmEquipmentTokenId) {
        leftArmExists = true;
      }
      if (_player.actionQueue[i].rightArmEquipmentTokenId != _queuedAction.rightArmEquipmentTokenId) {
        rightArmExists = true;
      }
    }
    if (!leftArmExists && _queuedAction.leftArmEquipmentTokenId != NONE) {
      _checkEquipActionEquipmentBalance(_from, _queuedAction.leftArmEquipmentTokenId);
    }
    if (!rightArmExists && _queuedAction.rightArmEquipmentTokenId != NONE) {
      _checkEquipActionEquipmentBalance(_from, _queuedAction.rightArmEquipmentTokenId);
    }

    _equipActionConsumables(_tokenId, _queuedAction);

    _queuedAction.startTime = uint40(block.timestamp);
    _player.actionQueue.push(_queuedAction);
    emit AddToActionQueue(_tokenId, _queuedAction);
  }

  function _clearActionQueue(uint _tokenId) private {
    QueuedAction[] memory queuedActions;
    _setActionQueue(_tokenId, queuedActions);
  }

  function startAction(
    uint _tokenId,
    QueuedAction calldata _queuedAction,
    bool _append
  ) external isOwnerOfPlayerAndActive(_tokenId) {
    Player storage player = players[_tokenId];
    address from = msg.sender;
    QueuedAction[] memory remainingSkillQueue = _consumeActions(from, _tokenId);

    require(_queuedAction.timespan <= MAX_TIME);
    if (_append) {
      uint totalTimeUsed;
      for (uint i = 0; i < remainingSkillQueue.length; ++i) {
        totalTimeUsed += remainingSkillQueue[i].timespan;
      }
      require(totalTimeUsed + _queuedAction.timespan <= MAX_TIME);
      player.actionQueue = remainingSkillQueue;
      emit SetActionQueue(_tokenId, player.actionQueue);
    } else {
      _clearActionQueue(_tokenId);
    }

    _addToQueue(from, _tokenId, _queuedAction, queuedActionId);
    ++queuedActionId;
  }

  function _setActionQueue(uint _tokenId, QueuedAction[] memory _queuedActions) private {
    Player storage player = players[_tokenId];
    player.actionQueue = _queuedActions;
    emit SetActionQueue(_tokenId, player.actionQueue);
  }

  function consumeActions(uint _tokenId) external isOwnerOfPlayerAndActive(_tokenId) {
    QueuedAction[] memory remainingSkillQueue = _consumeActions(msg.sender, _tokenId);
    _setActionQueue(_tokenId, remainingSkillQueue);
  }

  // Queue them up (Skill X for some amount of time, Skill Y for some amount of time, SKill Z for some amount of time)
  function multiskill(
    uint _tokenId,
    QueuedAction[] calldata _queuedActions
  ) external isOwnerOfPlayerAndActive(_tokenId) {
    if (_queuedActions.length == 0) {
      revert SkillsArrayZero();
    }

    require(_queuedActions.length <= 3);
    address from = msg.sender;
    _consumeActions(from, _tokenId);

    // Clear the action queue if something is in it
    Player storage player = players[_tokenId];
    if (player.actionQueue.length > 0) {
      _clearActionQueue(_tokenId);
    }

    uint256 i;
    uint totalTimespan;

    uint currentQueuedActionId = queuedActionId;
    do {
      QueuedAction calldata queuedAction = _queuedActions[i];
      _addToQueue(from, _tokenId, queuedAction, currentQueuedActionId);
      unchecked {
        ++i;
        ++currentQueuedActionId;
      }
      totalTimespan += queuedAction.timespan;
    } while (i < _queuedActions.length);

    require(totalTimespan <= MAX_TIME, "Total time is longer than max");
    queuedActionId = currentQueuedActionId;
  }

  // Get any changes that are pending and not on the blockchain yet.
  function pending(uint _tokenId) external view returns (PendingOutput memory pendingOutput) {
    QueuedAction[] storage actionQueue = players[_tokenId].actionQueue;

    pendingOutput.consumables = new Equipment[](actionQueue.length * 3);
    pendingOutput.foodConsumed = new Equipment[](actionQueue.length);
    pendingOutput.guaranteedRewards = new ActionReward[](actionQueue.length * 3);
    pendingOutput.loot = new ActionReward[](actionQueue.length * 3);

    uint consumableLength;
    uint foodConsumedLength;
    uint guaranteedRewardsLength;
    uint lootLength;
    for (uint i; i < actionQueue.length; ++i) {
      QueuedAction storage queuedAction = actionQueue[i];

      uint24 elapsedTime;
      uint40 skillEndTime = queuedAction.startTime + queuedAction.timespan;
      bool consumeAll = skillEndTime <= block.timestamp;
      if (consumeAll) {
        // Fully consume this skill
        elapsedTime = queuedAction.timespan;
      } else if (block.timestamp > queuedAction.startTime) {
        // partially consume
        elapsedTime = uint16(block.timestamp - queuedAction.startTime);
        skillEndTime = uint40(block.timestamp);
      } else {
        break;
      }
      /*
      // Create some items if necessary (smithing ores to bars for instance)
      uint16 modifiedElapsedTime = speedMultiplier[_tokenId] > 1
        ? elapsedTime * speedMultiplier[_tokenId]
        : elapsedTime;
      (uint16 numProduced, uint16 foodConsumed, bool died) = PlayerLibrary.processConsumablesView(
        queuedAction,
        modifiedElapsedTime,
        world
      );
      
      ActionChoice memory actionChoice = world.getActionChoice(
        _isCombat ? NONE : queuedAction.actionId,
        queuedAction.choiceId
      );

      if (actionChoice.itemTokenId1 > 0) {}
      if (actionChoice.itemTokenId2 > 0) {}
      if (actionChoice.itemTokenId3 > 0) {} */

      // TODO Will also need guaranteedRewards, find a way to re-factor all this stuff so it can be re-used in the actual queue consumption
    }
  }

  function getActionQueue(uint _tokenId) external view returns (QueuedAction[] memory) {
    return players[_tokenId].actionQueue;
  }

  function actionQueueLength(uint _tokenId) external view returns (uint256) {
    return players[_tokenId].actionQueue.length;
  }

  /*  function getLootBonusMultiplier(uint _tokenId) external view returns (uint256) {
    // The higher the level the higher the multiplier?
    return 2;
  } */

  function _handleLevelUpRewards(
    address _from,
    uint _tokenId,
    uint oldOverallSkillPoints,
    uint newOverallSkillPoints
  ) private {
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

      emit LevelUp(_tokenId, itemTokenIds, amounts);
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
    ) {}
  }

  /*
  function getLoot(uint actionId, uint seed) external view returns (uint[] memory tokenIds) {
    if (seed == 0) {
      return tokenIds;
    }

    tokenIds = new uint[](3); // max
    uint length;
    if (seed % 2 == 0) {
      tokenIds[0] = SAPPHIRE_AMULET;
    } else {
      tokenIds[0] = BRONZE_PICKAXE;
    }

    assembly ("memory-safe") {
      mstore(tokenIds, length)
    }
  } */

  function setSpeedMultiplier(uint _tokenId, uint16 multiplier) external {
    // Disable for production code
    speedMultiplier[_tokenId] = multiplier;
  }

  function _addRemainingSkill(
    QueuedAction[] memory remainingSkills,
    QueuedAction storage queuedAction,
    uint prevEndTime,
    uint16 foodConsumed,
    uint16 numConsumed,
    uint length
  ) private view {
    uint40 end = queuedAction.startTime + queuedAction.timespan;

    QueuedAction memory remainingAction = queuedAction;
    remainingAction.startTime = uint40(prevEndTime);
    remainingAction.timespan = uint16(end - prevEndTime);
    remainingAction.numRegenerate -= uint8(foodConsumed);
    remainingAction.num -= uint8(numConsumed);

    // Build a list of the skills queued that remain
    remainingSkills[length] = remainingAction;
  }

  function getURI(
    uint _tokenId,
    bytes32 _name,
    bytes32 _avatarName,
    string memory _avatarDescription,
    string memory imageURI
  ) external view returns (string memory) {
    Player storage player = players[_tokenId];
    return
      PlayerLibrary.uri(_name, skillPoints[_tokenId], player.totalStats, _avatarName, _avatarDescription, imageURI);
  }

  function _getElapsedTime(
    uint _tokenId,
    uint _skillEndTime,
    QueuedAction storage _queuedAction
  ) private view returns (uint elapsedTime) {
    bool consumeAll = _skillEndTime <= block.timestamp;
    if (consumeAll) {
      // Fully consume this skill
      elapsedTime = _queuedAction.timespan;
    } else if (block.timestamp > _queuedAction.startTime) {
      // partially consume
      elapsedTime = block.timestamp - _queuedAction.startTime;
      uint modifiedElapsedTime = speedMultiplier[_tokenId] > 1
        ? uint(elapsedTime) * speedMultiplier[_tokenId]
        : elapsedTime;
      // Up to timespan
      if (modifiedElapsedTime > _queuedAction.timespan) {
        elapsedTime = _queuedAction.timespan;
      }
    }
  }

  function _unequipActionEquipment(
    uint _tokenId,
    uint16 _itemTokenId,
    bool _isFinished,
    uint _offset,
    QueuedAction[] memory _actionQueue
  ) private {
    if (_itemTokenId != NONE && _isFinished) {
      // Check that it is not equipped in a later action, if so don't unequip
      bool usedLater = false;
      for (uint j = _offset + 1; j < _actionQueue.length; ++j) {
        QueuedAction memory _queuedAction = _actionQueue[j];
        if (
          _itemTokenId == _queuedAction.leftArmEquipmentTokenId ||
          _itemTokenId == _queuedAction.rightArmEquipmentTokenId
        ) {
          usedLater = true;
          break;
        }
      }

      if (!usedLater) {
        emit ActionUnequip(_tokenId, _itemTokenId, 1);
      }
    }
  }

  function _unequipFromFinishedAction(
    uint _tokenId,
    uint16 _leftArmEquipmentTokenId,
    uint16 _rightArmEquipmentTokenId,
    bool _isFinished,
    uint _offset,
    QueuedAction[] memory _actionQueue
  ) private {
    // Fully consumed this action so unequip w.e we had equiped as long as
    _unequipActionEquipment(_tokenId, _leftArmEquipmentTokenId, _isFinished, _offset, _actionQueue);
    _unequipActionEquipment(_tokenId, _rightArmEquipmentTokenId, _isFinished, _offset, _actionQueue);
  }

  function _updateSkillPoints(uint _tokenId, Skill _skill, uint32 _pointsAccrued) private {
    skillPoints[_tokenId][_skill] += _pointsAccrued;
    emit AddSkillPoints(_tokenId, _skill, _pointsAccrued);
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
    // All equipment and actions can be made for this player
    activePlayer[from] = _playerId;
    emit SetActivePlayer(from, _playerId);
  }

  function _consumeActions(address _from, uint _tokenId) private returns (QueuedAction[] memory remainingSkills) {
    Player storage player = players[_tokenId];
    if (player.actionQueue.length == 0) {
      // No actions remaining
      return remainingSkills;
    }

    // TODO: Check they have the equipment available
    uint previousSkillPoints = player.totalSkillPoints;
    uint32 allpointsAccrued;

    remainingSkills = new QueuedAction[](player.actionQueue.length); // Max
    uint length;
    uint nextStartTime = block.timestamp;
    for (uint i = 0; i < player.actionQueue.length; ++i) {
      QueuedAction storage queuedAction = player.actionQueue[i];
      uint32 pointsAccrued;
      uint skillEndTime = queuedAction.startTime +
        (
          speedMultiplier[_tokenId] > 1
            ? uint(queuedAction.timespan) / speedMultiplier[_tokenId]
            : queuedAction.timespan
        );

      uint elapsedTime = _getElapsedTime(_tokenId, skillEndTime, queuedAction);
      if (elapsedTime == 0) {
        // Haven't touched this action yet so add it all
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, 0, 0, length);
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
        bool consumeAll = skillEndTime <= block.timestamp;
        (foodConsumed, numConsumed, elapsedTime, died) = PlayerLibrary.processConsumables(
          _from,
          _tokenId,
          queuedAction,
          elapsedTime,
          world,
          itemNFT,
          player.totalStats,
          consumeAll,
          actionChoice
        );
      }

      if (!died) {
        uint16 xpPerHour = world.getXPPerHour(
          queuedAction.actionId,
          _isCombat(queuedAction.skill) ? NONE : queuedAction.choiceId
        );
        pointsAccrued = uint32((elapsedTime * xpPerHour) / 3600);
      }

      if (elapsedTime < queuedAction.timespan) {
        // Add the remainder if this action is not fully consumed
        _addRemainingSkill(remainingSkills, queuedAction, nextStartTime, foodConsumed, numConsumed, length);
        nextStartTime += elapsedTime;
        length = i + 1;
      }

      if (pointsAccrued > 0) {
        _updateSkillPoints(_tokenId, queuedAction.skill, pointsAccrued);

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

      _unequipFromFinishedAction(
        _tokenId,
        queuedAction.leftArmEquipmentTokenId,
        queuedAction.rightArmEquipmentTokenId,
        elapsedTime == queuedAction.timespan,
        i,
        player.actionQueue
      );
    }

    if (allpointsAccrued > 0) {
      // Check if they have levelled up
      _handleLevelUpRewards(_from, _tokenId, previousSkillPoints, previousSkillPoints + allpointsAccrued);
    }

    assembly ("memory-safe") {
      mstore(remainingSkills, length)
    }
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
