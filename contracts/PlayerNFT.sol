// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./interfaces/ItemStat.sol";
import "./interfaces/IBrushToken.sol";
import "./World.sol";
import "./enums.sol";
import "./ItemNFT.sol";
import "./Users.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import {PlayerNFTLibrary} from "./PlayerNFTLibrary.sol";

// Each NFT represents a player
contract PlayerNFT is ERC1155, Multicall, Ownable {
  event NewPlayer(uint tokenId, uint avatarId, bytes32 name);
  event EditPlayer(uint tokenId, bytes32 newName);

  event Equip(uint tokenId, uint16 itemTokenId, Stats statChanges, uint amount);
  event Unequip(uint tokenId, uint16 itemTokenId, Stats statChanges, uint amount);
  event RemoveAllEquipment(uint tokenId);
  event AddSkillPoints(uint tokenId, Skill skill, uint32 points);

  event LevelUp(uint tokenId, uint[] itemTokenIdsRewarded, uint[] amountTokenIdsRewarded);

  // A queued action
  struct SkillInfo {
    uint16 actionId;
    Skill actionType;
    uint40 startTime;
    uint16 timespan;
    uint16 itemEquipped; // Sword, Bow, staff, fishing rod
  }

  struct MeleeInfo {
    uint16 otherItem; // Shield, or nothing if 2 handed, token id
    uint16 food;
    uint16 numFood;
  }

  struct RangedInfo {
    uint16 arrows; // item token id
    uint8 numEquipped; // Number of arrows, number of lobsters etc..
    uint16 food; // item token id
    uint16 numFood;
  }

  struct MagicInfo {
    // All the different runes used
    uint8 numAirRunes;
    uint16 food; // item token id
    uint16 numFood;
  }

  IBrushToken immutable brush;
  World immutable world;
  string private constant baseURI = "ipfs://";

  struct Player {
    Armour equipment; // Keep this first
    // These are stored in case individual items are changed later, but also prevents having to read them loads
    // Base attributes
    Stats totalStats;
    SkillInfo[] actionQueue;
    uint240 totalSkillPoints;
    uint8 version; // This is used in case we want to do some migration of old characters, like halt them at level 30 from gaining XP
    bytes32 name;
  }

  uint queuedActionId = 1; // Global queued action id
  mapping(uint => MeleeInfo) meleeQueuedActions; // queued action id => melee info
  mapping(uint => RangedInfo) rangedQueuedActions; // queued action id => ranged info
  mapping(uint => MagicInfo) magicQueuedActions; // queued action id => magic info

  mapping(uint => mapping(Skill => uint32)) public skillPoints; // player id => skill => point

  // This is kept separate in case we want to remove this being used and instead read attributes on demand.
  mapping(uint => ArmourAttributes) armourAttributes; // player id => attributes from armour

  uint32 public constant MAX_TIME = 1 days;

  // Equipment (leave at the bottom to allow for further ones)
  struct Armour {
    uint8 helmet; // tokenId for the head (1 - 255)
    uint8 amulet; // tokenId for the neck (256 - 511) (256 * i -> 256 * (i + 1))
    uint8 chestplate;
    uint8 gauntlets;
    uint8 tassets;
    uint8 boots;
    uint8 reserved1;
    uint8 reserved2;
  }

  struct ArmourAttributes {
    Stats helmet;
    Stats amulet;
    Stats chestplate;
    Stats tassets;
    Stats gauntlets;
    Stats boots;
    Stats reserved1;
    Stats reserved2;
  }

  using EnumerableMap for EnumerableMap.UintToUintMap;

  mapping(uint => uint) private tokenIdToAvatar; // tokenId => avatar id?
  mapping(uint => Player) public players;
  uint private latestPlayerId = 1;
  ItemNFT private itemNFT;
  Users private users;

  mapping(uint => AvatarInfo) private avatars; // avatar id => avatarInfo

  error SkillsArrayZero();
  error NotOwner();
  error AvatarNotExists();
  error EquipSameItem();
  error NotEquipped();
  error ArgumentLengthMismatch();

  modifier isOwnerOfPlayer(uint tokenId) {
    if (balanceOf(msg.sender, tokenId) != 1) {
      revert NotOwner();
    }
    _;
  }

  struct AvatarInfo {
    bytes32 name;
    string description;
    string imageURI;
  }

  uint constant LEVEL_5_BOUNDARY = 500;
  uint constant LEVEL_10_BOUNDARY = 10000;
  uint constant LEVEL_15_BOUNDARY = 15000;
  uint constant LEVEL_20_BOUNDARY = 20000;
  uint constant LEVEL_30_BOUNDARY = 30000;
  uint constant LEVEL_40_BOUNDARY = 400000;
  uint constant LEVEL_50_BOUNDARY = 5000000;
  uint constant LEVEL_60_BOUNDARY = 6000000;
  uint constant LEVEL_70_BOUNDARY = 7000000;
  uint constant LEVEL_80_BOUNDARY = 80000000;
  uint constant LEVEL_90_BOUNDARY = 900000000;
  uint constant LEVEL_99_BOUNDARY = 999999999;

  PendingLoot[] private pendingLoot; // queue, will be sorted by timestamp

  constructor(IBrushToken _brush, ItemNFT _itemNFT, World _world, Users _users) ERC1155("") {
    brush = _brush;
    itemNFT = _itemNFT;
    world = _world;
    users = _users;
  }

  function _mintStartingItems() private {
    // Give the player some starting items
    (uint[] memory itemNFTs, uint[] memory quantities) = PlayerNFTLibrary.getInitialStartingItems();
    itemNFT.mintBatch(msg.sender, itemNFTs, quantities);
  }

  // Costs nothing to mint, only gas
  function mintPlayer(uint _avatarId, bytes32 _name) external {
    uint currentPlayerId = latestPlayerId;
    emit NewPlayer(currentPlayerId, _avatarId, _name);

    _mint(msg.sender, currentPlayerId, 1, "");

    Player storage player = players[currentPlayerId];
    player.name = _name;

    _mintStartingItems();

    if (bytes(avatars[_avatarId].description).length == 0) {
      revert AvatarNotExists();
    }
    tokenIdToAvatar[currentPlayerId] = _avatarId;
    ++latestPlayerId;
  }

  function uri(uint256 _tokenId) public view virtual override returns (string memory) {
    require(_exists(_tokenId));
    Player storage player = players[_tokenId];
    AvatarInfo storage avatarInfo = avatars[tokenIdToAvatar[_tokenId]];
    bytes memory imageURI = abi.encodePacked(baseURI, avatarInfo.imageURI);
    return
      PlayerNFTLibrary.uri(
        player.name,
        skillPoints[_tokenId],
        player.totalStats,
        avatarInfo.name,
        avatarInfo.description,
        imageURI
      );
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual override {
    if (from == address(0) || amounts.length == 0 || from == to) {
      return;
    }
    uint i = 0;
    do {
      // Get player and consume any actions & unequip all items before transferring the whole player
      uint tokenId = ids[i];
      _clearEverything(from, tokenId);
      unchecked {
        ++i;
      }
    } while (i < ids.length);
  }

  function _clearEverything(address _from, uint _tokenId) private {
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(_from, _tokenId);
    _clearEquipment(_from, _tokenId);

    // Continue last skill queue (if there's anything remaining)
    if (remainingSkillQueue.length > 0) {
      players[_tokenId].actionQueue = remainingSkillQueue;
    }
  }

  function clearEverything(uint _tokenId) public isOwnerOfPlayer(_tokenId) {
    _clearEverything(msg.sender, _tokenId);
  }

  function _clearEquipment(address _from, uint _tokenId) private {
    Player storage player = players[_tokenId];
    // Unequip each item one by one
    uint position = 0;
    bytes32 empty;
    do {
      _unequip(_from, _tokenId, EquipPosition(position));
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

    emit RemoveAllEquipment(_tokenId);
    delete player.equipment;
  }

  function clearEquipment(uint _tokenId) external isOwnerOfPlayer(_tokenId) {
    address from = msg.sender;
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(from, _tokenId);
    _clearEquipment(from, _tokenId);
    // Continue last skill queue (if there's anything remaining)
    if (remainingSkillQueue.length > 0) {
      players[_tokenId].actionQueue = remainingSkillQueue;
    }
  }

  function updatePlayerStats(Player storage _player, Stats memory _stats, bool _add) private {
    PlayerNFTLibrary.updatePlayerStats(_player.totalStats, _stats, _add);
  }

  function _unequipMainItem(address _from, uint _tokenId, uint16 _equippedTokenId) private {
    Player storage player = players[_tokenId];

    // Unequip current item and remove any stats given from the item
    ItemStat memory itemStats = itemNFT.getItemStats(_equippedTokenId);
    updatePlayerStats(player, itemStats.stats, false);
    users.unequip(_from, _equippedTokenId);
    emit Unequip(_tokenId, _equippedTokenId, itemStats.stats, 1);
  }

  // Absolute setting of equipment
  function setEquipment(uint _tokenId, uint16[] calldata _itemTokenIds) external isOwnerOfPlayer(_tokenId) {
    Player storage player = players[_tokenId];
    address from = msg.sender;
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(from, _tokenId);

    // Unequip everything
    for (uint position; position < 8; ++position) {
      _unequip(from, _tokenId, EquipPosition(position));
    }

    // Equip necessary items
    bytes32 val;
    for (uint i; i < _itemTokenIds.length; ++i) {
      uint16 itemTokenId = _itemTokenIds[i];

      ItemStat memory itemStats = itemNFT.getItemStats(itemTokenId);
      EquipPosition position = itemStats.equipPosition;
      require(itemStats.exists);
      require(uint8(position) < 8);
      uint8 relativeItem = uint8(itemTokenId - (256 * uint8(position))); // Between 0 -> 256

      assembly ("memory-safe") {
        // Set the equipped item
        val := or(val, shl(mul(position, 8), relativeItem))
      }

      Stats memory stats = itemStats.stats;
      // This will check the user has enough balance inside
      // TODO: Bulk add all these
      updatePlayerStats(player, stats, true);
      users.equip(from, itemTokenId);
      emit Equip(_tokenId, itemTokenId, stats, 1);
    }

    // Now set the slot once
    assembly ("memory-safe") {
      sstore(player.slot, val)
    }

    if (remainingSkillQueue.length > 0) {
      player.actionQueue = remainingSkillQueue;
    }
  }

  function _getRelativeEquippedTokenId(
    EquipPosition _position,
    Player storage _player
  ) private view returns (uint8 relativeEquippedTokenId) {
    assembly ("memory-safe") {
      let val := sload(_player.slot)
      relativeEquippedTokenId := shr(mul(_position, 8), val)
    }
  }

  // Cannot be transferred while equipped.  Check if the NFT is being transferred and unequip from this user.
  // Replace old one
  function equip(uint _tokenId, uint16 _itemTokenId) external isOwnerOfPlayer(_tokenId) {
    Player storage player = players[_tokenId];

    SkillInfo[] memory remainingSkillQueue = _consumeSkills(msg.sender, _tokenId);
    ItemStat memory itemStats = itemNFT.getItemStats(_itemTokenId);
    EquipPosition position = itemStats.equipPosition;
    require(itemStats.exists);
    require(uint8(position) < 8);
    uint8 relativeEquippedTokenId = _getRelativeEquippedTokenId(position, player);

    uint8 relativeItem = uint8(_itemTokenId - (256 * uint8(position))); // Between 0 -> 256
    assembly ("memory-safe") {
      let val := sload(player.slot)
      // Clear the byte position
      val := and(val, not(shl(mul(position, 8), 0xff)))
      // Now set it
      val := or(val, shl(mul(position, 8), relativeItem))
      sstore(player.slot, val)
    }

    uint16 equippedTokenId = relativeEquippedTokenId + (256 * uint8(position));
    if (_itemTokenId == equippedTokenId && relativeEquippedTokenId != NONE) {
      revert EquipSameItem();
    }

    // Already something equipped there so unequip
    if (relativeEquippedTokenId != NONE) {
      _unequipMainItem(msg.sender, _tokenId, equippedTokenId);
    }

    Stats memory stats = itemStats.stats;
    // This will check the user has enough balance inside
    updatePlayerStats(player, stats, true);
    users.equip(msg.sender, _itemTokenId);
    emit Equip(_tokenId, _itemTokenId, stats, 1);
    // Continue last skill queue (if there's anything remaining)
    if (remainingSkillQueue.length > 0) {
      player.actionQueue = remainingSkillQueue;
    }
  }

  function _unequip(address _from, uint _tokenId, EquipPosition _position) private {
    Player storage player = players[_tokenId];
    uint8 relativeEquippedItemTokenId = _getRelativeEquippedTokenId(_position, player);
    uint16 equippedItemTokenId = relativeEquippedItemTokenId + (256 * uint8(_position));
    if (relativeEquippedItemTokenId != NONE) {
      _unequipMainItem(_from, _tokenId, equippedItemTokenId);
    }
  }

  function unequip(uint _tokenId, EquipPosition _position) external isOwnerOfPlayer(_tokenId) {
    address from = msg.sender;
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(from, _tokenId);
    _unequip(from, _tokenId, _position);
    Player storage player = players[_tokenId];
    // Update the storage slot
    assembly ("memory-safe") {
      let val := sload(player.slot)
      // Clear the byte position
      val := and(val, not(shl(mul(_position, 8), 0xff)))
    }
    // Continue last skill queue (if there's anything remaining)
    if (remainingSkillQueue.length > 0) {
      player.actionQueue = remainingSkillQueue;
    }
  }

  function _getEquipmentSlot(Player storage _player) private view returns (uint256 slot) {
    assembly ("memory-safe") {
      slot := sload(_player.slot)
    }
  }

  struct Equipment {
    uint16 itemTokenId;
    uint8 numToEquip;
  }

  struct QueuedAction {
    uint16 actionId;
    Skill skill; // attack, defence, strength, magic, ranged, woodcutting, needs to match actionId skill
    uint16 timespan;
    Equipment[] extraEquipment; // Order should be arrows/magic last
  }

  function _addToQueue(uint _tokenId, QueuedAction calldata _queuedAction, uint _queuedActionId) private {
    Player storage _player = players[_tokenId];
    Skill skill = world.getSkill(_queuedAction.actionId); // Can be combat
    require(world.availableActions(_queuedAction.actionId));
    // Extra equipment should contain an item to equip
    uint16 itemEquipped;
    uint16 otherItemEquipped;
    Equipment memory food; // item token id
    for (uint i; i < _queuedAction.extraEquipment.length; ++i) {
      Equipment calldata equipment = _queuedAction.extraEquipment[i];

      ItemStat memory itemStats = itemNFT.getItemStats(equipment.itemTokenId);
      require(itemStats.exists);
      if (itemStats.equipPosition == EquipPosition.RIGHT_ARM) {
        itemEquipped = equipment.itemTokenId;
      } else if (itemStats.equipPosition == EquipPosition.LEFT_ARM) {
        // Shield
        otherItemEquipped = equipment.itemTokenId;
      } else if (itemStats.equipPosition == EquipPosition.FOOD) {
        food = equipment;
      } else if (itemStats.equipPosition == EquipPosition.ARROW_SATCHEL) {
        rangedQueuedActions[_queuedActionId] = RangedInfo({
          arrows: equipment.itemTokenId,
          numEquipped: equipment.numToEquip,
          food: food.itemTokenId,
          numFood: food.numToEquip
        });
      }
      users.equip(msg.sender, equipment.itemTokenId);
      emit Equip(_tokenId, equipment.itemTokenId, itemStats.stats, equipment.numToEquip);
    }

    require(itemEquipped > 0);

    if (_queuedAction.skill == Skill.ATTACK || _queuedAction.skill == Skill.DEFENCE) {
      meleeQueuedActions[_queuedActionId] = MeleeInfo({
        otherItem: otherItemEquipped,
        food: food.itemTokenId,
        numFood: food.numToEquip
      });
    }

    // Compare skill with queuedAction to make sure it is appropriate
    if (skill == Skill.COMBAT) {
      require(
        _queuedAction.skill == Skill.ATTACK ||
          _queuedAction.skill == Skill.DEFENCE ||
          _queuedAction.skill == Skill.MAGIC ||
          _queuedAction.skill == Skill.RANGED
      );
    } else {
      require(skill == _queuedAction.skill);
    }

    _player.actionQueue.push(
      SkillInfo({
        actionId: _queuedAction.actionId,
        startTime: uint40(block.timestamp),
        timespan: _queuedAction.timespan,
        itemEquipped: itemEquipped,
        actionType: _queuedAction.skill
      })
    );
  }

  function startAction(
    QueuedAction calldata _queuedAction,
    uint _tokenId,
    bool _append
  ) external isOwnerOfPlayer(_tokenId) {
    Player storage player = players[_tokenId];
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(msg.sender, _tokenId);

    require(_queuedAction.timespan <= MAX_TIME);
    if (_append) {
      uint totalTimeUsed;
      for (uint i = 0; i < remainingSkillQueue.length; ++i) {
        totalTimeUsed += remainingSkillQueue[i].timespan;
      }
      require(totalTimeUsed + _queuedAction.timespan <= MAX_TIME);
      player.actionQueue = remainingSkillQueue;
    }

    _addToQueue(_tokenId, _queuedAction, queuedActionId);
    ++queuedActionId;
  }

  function consumeSkills(uint _tokenId) external isOwnerOfPlayer(_tokenId) {
    _consumeSkills(msg.sender, _tokenId);
  }

  // Queue them up (Skill X for some amount of time, Skill Y for some amount of time, SKill Z for some amount of time)
  function multiskill(uint _tokenId, QueuedAction[] calldata _queuedActions) external isOwnerOfPlayer(_tokenId) {
    if (_queuedActions.length == 0) {
      revert SkillsArrayZero();
    }

    require(_queuedActions.length <= 3);

    _consumeSkills(msg.sender, _tokenId);

    // Clear the action queue if something is in it
    Player storage player = players[_tokenId];
    if (player.actionQueue.length > 0) {
      delete player.actionQueue;
    }

    uint256 i;
    uint totalTimespan;

    uint currentQueuedActionId = queuedActionId;
    do {
      QueuedAction calldata queuedAction = _queuedActions[i];
      _addToQueue(_tokenId, queuedAction, currentQueuedActionId);
      unchecked {
        ++i;
        ++currentQueuedActionId;
      }
      totalTimespan += queuedAction.timespan;
    } while (i < _queuedActions.length);

    require(totalTimespan <= MAX_TIME);
    queuedActionId = currentQueuedActionId;
  }

  //    function view() external {
  // Get up to date stats that may still be pending and not on the blockchain yet.
  //        actionQueue
  //    }

  function getActionQueue(uint _tokenId) external view returns (SkillInfo[] memory) {
    return players[_tokenId].actionQueue;
  }

  function actionQueueLength(uint _tokenId) external view returns (uint256) {
    return players[_tokenId].actionQueue.length;
  }

  function getLootBonusMultiplier(uint _tokenId) external view returns (uint256) {
    // The higher the level the higher the multiplier?
    return 2;
  }

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
  }

  uint private constant MAX_LOOT_PER_ACTION = 5;

  function _consumeSkills(address _from, uint _tokenId) private returns (SkillInfo[] memory remainingSkills) {
    Player storage player = players[_tokenId];
    uint queueLength = player.actionQueue.length;
    if (queueLength == 0) {
      // No actions remaining
      return remainingSkills;
    }

    // TODO: Check they have the equipment available
    uint previousSkillPoints = player.totalSkillPoints;
    uint32 allPointsAccured;

    remainingSkills = new SkillInfo[](queueLength); // Max
    uint length;
    uint lootLength;
    // ids & amounts which will be used to batch mint once later
    uint[] memory ids = new uint[](MAX_LOOT_PER_ACTION * queueLength);
    uint[] memory amounts = new uint[](MAX_LOOT_PER_ACTION * queueLength);
    for (uint i = 0; i < queueLength; ++i) {
      SkillInfo storage skillInfo = player.actionQueue[i];
      uint32 pointsAccured;
      uint40 skillEndTime = skillInfo.startTime + skillInfo.timespan;
      uint16 actionId = skillInfo.actionId;
      uint16 elapsedTime;
      if (skillEndTime <= block.timestamp) {
        // Fully consume this skill
        pointsAccured = skillInfo.timespan;
        elapsedTime = skillInfo.timespan;
      } else {
        // partially consume
        elapsedTime = uint16(block.timestamp - skillInfo.startTime);
        skillEndTime = uint40(block.timestamp);
        pointsAccured = elapsedTime; // TODO: This should be based on something else
        uint40 end = skillInfo.startTime + skillInfo.timespan;
        //        if (_discardRestOfQueue) {
        //    _skillPoints[_tokenId][skillInfo.skill] += pointsAccured; // Update this later, just base it on time elapsed
        //   emit AddSkillPoints(skillInfo.skill, pointsAccured);
        //    length = 0;
        //    break;
        //  }

        // Build a list of the skills queued that remain
        remainingSkills[length] = SkillInfo({
          actionId: actionId,
          startTime: uint40(block.timestamp),
          timespan: uint16(end - block.timestamp),
          itemEquipped: skillInfo.itemEquipped,
          actionType: skillInfo.actionType
        });

        length = i + 1;
      }

      if (pointsAccured > 0) {
        Skill skill = world.getSkill(actionId);
        skillPoints[_tokenId][skill] += pointsAccured; // Update this later, just base it on time elapsed
        emit AddSkillPoints(_tokenId, skill, pointsAccured);

        // Should just do the new ones
        (uint[] memory newIds, uint[] memory newAmounts) = PlayerNFTLibrary.getLoot(
          _from,
          actionId,
          skillEndTime,
          elapsedTime,
          world,
          pendingLoot
        );
        for (uint j = 0; j < newIds.length; ++j) {
          ids[lootLength + j] = newIds[j];
          amounts[lootLength + j] = newAmounts[j];
        }
        lootLength += newIds.length;

        allPointsAccured += pointsAccured;
      }

      if (elapsedTime == skillInfo.timespan) {
        // Fully consume this skill so unequip w.e we had equiped
        // TODO: This would also remove it if you had same action queued up later though
        ItemStat memory itemStats = itemNFT.getItemStats(skillInfo.itemEquipped); // Sword, Bow, staff, fishing rod
        users.unequip(_from, skillInfo.itemEquipped);
        emit Unequip(_tokenId, skillInfo.itemEquipped, itemStats.stats, 1);
      }
    }

    assembly ("memory-safe") {
      mstore(ids, lootLength)
      mstore(amounts, lootLength)
    }

    // Mint all items
    itemNFT.mintBatch(_from, ids, amounts);

    if (allPointsAccured > 0) {
      // Check if they have levelled up
      _handleLevelUpRewards(_from, _tokenId, previousSkillPoints, previousSkillPoints + allPointsAccured);
    }

    if (remainingSkills.length == 0) {
      delete player.actionQueue;
    }

    assembly ("memory-safe") {
      mstore(remainingSkills, length)
    }
  }

  function editName(uint _playerId, bytes32 _newName) external isOwnerOfPlayer(_playerId) {
    uint brushCost = 5000;
    // Pay
    brush.transferFrom(msg.sender, address(this), brushCost);
    // Burn half, the rest goes into the pool
    brush.burn(brushCost / 2);

    players[_playerId].name = _newName;
    emit EditPlayer(_playerId, _newName);
  }

  function inventoryAmount(uint _tokenId) external view returns (uint) {
    //    (bool success, uint amount) = inventoryItem.tryGet(_tokenId);
    //    return amount;
  }

  /**
   * @dev Returns whether `tokenId` exists.
   *
   * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
   *
   */
  function _exists(uint256 tokenId) private view returns (bool) {
    return tokenIdToAvatar[tokenId] != 0;
  }

  function setAvatar(uint avatarId, AvatarInfo calldata _avatarInfo) external onlyOwner {
    avatars[avatarId] = _avatarInfo;
  }

  function setAvatars(uint _startAvatarId, AvatarInfo[] calldata _avatarInfos) external onlyOwner {
    for (uint i; i < _avatarInfos.length; ++i) {
      avatars[_startAvatarId + i] = _avatarInfos[i];
    }
  }
}
