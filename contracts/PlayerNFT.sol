// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./interfaces/ItemStat.sol";
import "./interfaces/IBrushToken.sol";
import "./World.sol";
import "./enums.sol";
import "./ItemNFT.sol";
import "./Users.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

// Each NFT represents a player
contract PlayerNFT is ERC1155, Multicall, Ownable {
  event NewPlayer(uint tokenId);

  event AddInventory(uint tokenId, uint amount);
  event RemoveInventory(uint tokenId, uint amount);
  event RemoveAllInventory(uint tokenId);
  event Unequip(uint tokenId, uint bonusRemoved);
  event Equip(uint tokenId, uint bonusAdded);
  event RemoveAllEquipment(uint tokenId);
  event AddSkillPoints(Skill action, uint points);

  struct SkillInfo {
    uint actionId;
    uint40 startTime;
    uint40 timespan;
  }

  IBrushToken immutable brush;
  World immutable world;
  string private constant baseURI = "ipfs://";

  struct Player {
    Equipped equipment; // Keep this first
    uint256 dummy; // TODO: Needed?
    // Attributes
    uint16 health;
    // These are extra from the items equipped
    uint8 attackBonus;
    uint8 defenceBonus;
    uint8 version; // This is used in case we want to do some migration of old characters, like halt them at level 30 from gaining XP
    SkillInfo[] actionQueue;
    uint256 slotsUsed;
    mapping(Skill => uint256) skillPoints;
    uint totalSkillPoints;
    EnumerableMap.UintToUintMap inventoryItems;
    bytes32 name;
  }

  uint32 public constant MAX_TIME = 1 days;

  struct EquipmentBonus {
    Attribute attribute;
    uint8 bonus;
  }

  // Equipment (leave at the bottom to allow for further ones)
  struct Equipped {
    uint8 head; // tokenId for the head
    uint8 necklace;
    uint8 body;
    uint8 rightArm;
    uint8 leftArm;
    uint8 legs;
    uint8 boots;
    uint8 auxilary; // Fishing rod, axe etc
    // These are stored in case individual items are changed later, but also prevents having to read them loads
    EquipmentBonus headBonus; // atk // Maximum 3, first byte is a mask of the attribute, next 3 are 0-255 the increase they provide.
    EquipmentBonus necklaceBonus; // atk
    EquipmentBonus bodyBonus; // defence
    EquipmentBonus rightArmBonus; //atk
    EquipmentBonus leftArmBonus; // atk
    EquipmentBonus legsBonus; // defence
    EquipmentBonus specialSlotBonus;
  }

  using EnumerableMap for EnumerableMap.UintToUintMap;

  uint256 public constant MAX_SLOTS = 16; //
  uint256 public constant MAX_WEIGHT_PER_SLOT = 12000; // Each slot weighs MAX_WEIGHT / MAX_ITEMS, single item slots weigh that amount.

  mapping(uint => uint) private tokenIdToAvatar; // tokenId => avatar id?
  mapping(uint => Player) private players; // tokenId => player too?
  uint public latestPlayerId = 1;
  ItemNFT public itemNFT;
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
    string name;
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

  event LevelUp(address _from, uint _tokenId, uint[] _itemTokenIdsRewarded, uint[] _amountTokenIdsRewarded);

  struct PendingLoot {
    uint actionId;
    uint40 timestamp;
  }

  PendingLoot[] private pendingLoot; // queue, will be sorted by timestamp

  constructor(
    IBrushToken _brush,
    ItemNFT _itemNFT,
    World _world,
    Users _users
  ) ERC1155("") {
    brush = _brush;
    itemNFT = _itemNFT;
    world = _world;
    users = _users;
  }

  function _mintStartingItems() private {
    // Give the player some starting items
    uint[] memory itemNFTs = new uint[](2);
    itemNFTs[0] = uint(Items.BRONZE_PICKAXE);
    itemNFTs[1] = uint(Items.SHIELD);
    uint[] memory quantities = new uint[](2);
    quantities[0] = 1;
    quantities[1] = 1;
    itemNFT.mintBatch(msg.sender, itemNFTs, quantities);
  }

  // Costs nothing to mint, only gas
  function mintPlayer(uint _avatarId, bytes32 _name) external {
    uint currentPlayerId = latestPlayerId;
    _mint(msg.sender, currentPlayerId, 1, "");

    Player storage player = players[currentPlayerId];
    player.name = _name;

    _mintStartingItems();

    if (bytes(avatars[_avatarId].name).length == 0) {
      revert AvatarNotExists();
    }
    tokenIdToAvatar[currentPlayerId] = _avatarId;
    ++latestPlayerId;
    emit NewPlayer(currentPlayerId);
  }

  function uri(uint256 _tokenId) public view virtual override returns (string memory) {
    require(_exists(_tokenId));

    Player storage player = players[_tokenId];

    AvatarInfo storage avatarInfo = avatars[tokenIdToAvatar[_tokenId]];

    // Show all the player stats, return metadata json
    bytes memory imageURI = abi.encodePacked(baseURI, avatarInfo.imageURI);

    string memory attributes = string(
      abi.encodePacked(
        '{"trait_type":"Player name","value":"',
        player.name,
        '{"trait_type":"Attack","value":"',
        player.skillPoints[Skill.PAINT],
        '"}, {"trait_type":"Defence","value":"',
        player.skillPoints[Skill.DEFENCE],
        '"}, {"trait_type":"Max health","value":"',
        player.health,
        '"}'
      )
    );

    string memory json = Base64.encode(
      bytes(
        string(
          abi.encodePacked(
            '{"name": "',
            avatarInfo.name,
            '", "description": "',
            avatarInfo.description,
            '", attributes":[',
            attributes,
            ', "image": "',
            imageURI,
            '"}'
          )
        )
      )
    );

    // Base64
    string memory output = string(abi.encodePacked("data:application/json;base64,", json));

    // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
    return output;
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
      _clearEverything(from, players[tokenId], tokenId);
      unchecked {
        ++i;
      }
    } while (i < ids.length);
  }

  // The player has a certain number of slots, each item has a different weight,
  // Some slots can contain multiple of the same item (e.g arrows)
  function addToInventory(
    uint256 _tokenId,
    uint256 _itemTokenId,
    uint256 _amount
  ) external isOwnerOfPlayer(_tokenId) {
    Player storage player = players[_tokenId];

    SkillInfo[] memory remainingSkillQueue = _consumeSkills(msg.sender, player, _tokenId);

    ItemStat memory stats = itemNFT.getItemStats(_itemTokenId);
    uint256 weight = stats.weight;

    (bool success, uint existingAmount) = player.inventoryItems.tryGet(_itemTokenId);
    uint256 remainder = (existingAmount * weight) % MAX_WEIGHT_PER_SLOT;

    // Update number of slots used in the inventory
    uint256 numFullSlotsNeeded = (_amount * weight) / MAX_WEIGHT_PER_SLOT;
    if (remainder == 0 && (player.slotsUsed + numFullSlotsNeeded <= MAX_SLOTS)) {
      // No existing slots used
      player.slotsUsed = numFullSlotsNeeded;
    } else {
      // Fill existing slot and add new slots if needed
      require(
        ((player.slotsUsed + numFullSlotsNeeded + 1) <= MAX_SLOTS) &&
          ((existingAmount + remainder) * weight) <= MAX_WEIGHT_PER_SLOT
      );
      player.slotsUsed = numFullSlotsNeeded + 1;
    }

    // Update the inventory
    player.inventoryItems.set(_itemTokenId, existingAmount + _amount);
    users.addInventory(msg.sender, _itemTokenId, _amount); // This will check they have enough balance to do so
    emit AddInventory(_itemTokenId, _amount);
    if (remainingSkillQueue.length > 0) {
      player.actionQueue = remainingSkillQueue;
    }
  }

  function removeFromInventory(uint256 _tokenId, uint256 _amount) external isOwnerOfPlayer(_tokenId) {
    Player storage player = players[_tokenId];

    // Check that they have the item in their inventory
    uint numInventory = player.inventoryItems.get(_tokenId);
    require(numInventory >= _amount);

    SkillInfo[] memory remainingSkillQueue = _consumeSkills(msg.sender, player, _tokenId);

    ItemStat memory stats = itemNFT.getItemStats(_tokenId);
    uint256 weight = stats.weight;

    uint256 numFullSlotsUsed = (_amount * weight) / MAX_WEIGHT_PER_SLOT;
    player.slotsUsed -= numFullSlotsUsed;

    unchecked {
      player.inventoryItems.set(_tokenId, numInventory - _amount);
    }
    users.removeInventory(msg.sender, _tokenId, _amount);
    emit RemoveInventory(_tokenId, _amount);
    if (remainingSkillQueue.length > 0) {
      player.actionQueue = remainingSkillQueue;
    }
  }

  function _clearEverything(
    address _from,
    Player storage _player,
    uint _tokenId
  ) private {
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(_from, _player, _tokenId);
    _clearInventory(_from, _player, _tokenId);
    _clearEquipment(_from, _player, _tokenId);

    // Continue last skill queue (if there's anything remaining)
    if (remainingSkillQueue.length > 0) {
      _player.actionQueue = remainingSkillQueue;
    }
  }

  function clearEverything(uint _tokenId) public isOwnerOfPlayer(_tokenId) {
    _clearEverything(msg.sender, players[_tokenId], _tokenId);
  }

  function _clearInventory(
    address _from,
    Player storage _player,
    uint _tokenId
  ) private {
    uint length = _player.inventoryItems.length();

    for (uint i = 0; i < length; i++) {
      (uint itemTokenId, uint amount) = _player.inventoryItems.at(i);
      _player.inventoryItems.remove(itemTokenId);
      users.removeInventory(_from, itemTokenId, amount);
    }
    emit RemoveAllInventory(_tokenId);
    _player.slotsUsed = 0;
  }

  function clearInventory(uint _tokenId) external isOwnerOfPlayer(_tokenId) {
    Player storage player = players[_tokenId];
    address from = msg.sender;
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(from, player, _tokenId);
    _clearInventory(from, player, _tokenId);
    // Continue last skill queue (if there's anything remaining)
    if (remainingSkillQueue.length > 0) {
      player.actionQueue = remainingSkillQueue;
    }
  }

  function _clearEquipment(
    address _from,
    Player storage _player,
    uint _tokenId
  ) private {
    bytes32 equippedSlot;
    assembly {
      equippedSlot := sload(_player.slot)
    }

    // Unequip each item one by one
    uint i = 0;
    do {
      uint8 equipmentTokenId = uint8(uint256(equippedSlot) >> (i * 8));
      if (equipmentTokenId > 0) {
        users.unequip(_from, equipmentTokenId);
      }

      unchecked {
        ++i;
      }
    } while (i < 8);

    emit RemoveAllEquipment(_tokenId);
    delete _player.equipment;
  }

  function clearEquipment(uint _tokenId) external isOwnerOfPlayer(_tokenId) {
    Player storage player = players[_tokenId];
    address from = msg.sender;
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(from, player, _tokenId);
    _clearEquipment(from, player, _tokenId);
    // Continue last skill queue (if there's anything remaining)
    if (remainingSkillQueue.length > 0) {
      player.actionQueue = remainingSkillQueue;
    }
  }

  // Cannot be transferred while equipped.  Check if the NFT is being transferred and unequip from this user.
  // Replace old one
  function equip(uint _tokenId, uint256 _itemTokenId) external isOwnerOfPlayer(_tokenId) {
    Player storage player = players[_tokenId];

    SkillInfo[] memory remainingSkillQueue = _consumeSkills(msg.sender, player, _tokenId);

    ItemStat memory stats = itemNFT.getItemStats(_itemTokenId);
    require(stats.attribute != Attribute.NONE);

    uint8 bonus = stats.bonus;

    EquipPosition position = stats.equipPosition;

    uint8 equippedTokenId;
    /// @solidity memory-safe-assembly
    assembly {
      let val := sload(player.slot)
      equippedTokenId := shr(mul(position, 8), val)

      // Clear the byte position
      val := and(val, not(shl(mul(position, 8), 0xff)))
      // Now set it
      val := or(val, shl(mul(position, 8), _itemTokenId))
      sstore(player.slot, val)
    }

    if (_itemTokenId == equippedTokenId) {
      revert EquipSameItem();
    }

    if (equippedTokenId > 0) {
      // Unequip current item and remove bonus
      EquipmentBonus memory existingBonus;
      /// @solidity memory-safe-assembly
      assembly {
        let val := sload(player.slot)
        existingBonus := shr(mul(add(8, mul(position, 2)), 8), val)
      }

      bonus -= existingBonus.bonus;

      users.unequip(msg.sender, equippedTokenId);
      emit Unequip(equippedTokenId, existingBonus.bonus);
    }

    if (stats.attribute == Attribute.ATTACK) {
      player.attackBonus += bonus;
    } else if (stats.attribute == Attribute.DEFENCE) {
      player.defenceBonus += bonus;
    }

    // This will check the user has enough balance inside
    users.equip(msg.sender, _itemTokenId);
    emit Equip(_itemTokenId, stats.bonus);
    // Continue last skill queue (if there's anything remaining)
    if (remainingSkillQueue.length > 0) {
      player.actionQueue = remainingSkillQueue;
    }
  }

  function unequip(uint _tokenId, uint8 _position) external isOwnerOfPlayer(_tokenId) {
    // This requires checking that we have it equipped
    Player storage player = players[_tokenId];
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(msg.sender, player, _tokenId);
    uint8 equipped;
    /// @solidity memory-safe-assembly
    assembly {
      let val := sload(player.slot)
      equipped := shr(mul(_position, 8), val)
    }
    if (equipped == 0) {
      revert NotEquipped();
    }

    users.unequip(msg.sender, equipped);
    // Continue last skill queue (if there's anything remaining)
    if (remainingSkillQueue.length > 0) {
      player.actionQueue = remainingSkillQueue;
    }
  }

  //    function equipMany(uint256 _tokenIds) external {
  // TODO:
  //    }

  function _getEquipmentSlot(Player storage _player) private view returns (uint256 slot) {
    assembly {
      slot := sload(_player.slot)
    }
  }

  function startAction(
    uint _actionId,
    uint40 _timespan,
    uint _tokenId,
    bool _append
  ) external isOwnerOfPlayer(_tokenId) {
    Player storage player = players[_tokenId];
    SkillInfo[] memory remainingSkillQueue = _consumeSkills(msg.sender, player, _tokenId);

    require(_timespan <= MAX_TIME);
    if (_append) {
      uint totalTimeUsed;
      for (uint i = 0; i < remainingSkillQueue.length; ++i) {
        totalTimeUsed += remainingSkillQueue[i].timespan;
      }
      require(totalTimeUsed + _timespan <= MAX_TIME);
      player.actionQueue = remainingSkillQueue;
    }

    (
      Skill skill,
      uint8 baseXPPerHour,
      uint32 minSkillPoints,
      uint8 itemPosition,
      uint8 itemTokenIdRangeMin,
      uint8 itemTokenIdRangeMax
    ) = world.actions(_actionId);

    // Equipment just check left and right arm, needed?
    uint256 itemSlot = _getEquipmentSlot(player);
    uint8 itemTokenId = uint8(itemSlot >> (itemPosition * 8));
    require(itemTokenId >= itemTokenIdRangeMin && itemTokenId < itemTokenIdRangeMax);
    require(world.availableActions(_actionId));
    player.actionQueue.push(SkillInfo({actionId: _actionId, startTime: uint40(block.timestamp), timespan: _timespan}));
  }

  //    mapping(uint, claimable);
  /*  function claimables() external isOwnerOfPlayer {}

  function die() private {
    // Lose 1 minor equipment and all of your inventory.
  }

  function randomEvent() private {
    //
  } */

  function consumeSkills(uint _tokenId) external isOwnerOfPlayer(_tokenId) {
    _consumeSkills(msg.sender, players[_tokenId], _tokenId);
  }

  // Queue them up (Skill X for some amount of time, Skill Y for some amount of time, SKill Z for some amount of time)
  function multiskill(
    uint _tokenId,
    uint[] calldata actionIds,
    uint40[] calldata timespans
  ) external isOwnerOfPlayer(_tokenId) {
    if (actionIds.length != timespans.length) {
      revert ArgumentLengthMismatch();
    }

    if (actionIds.length == 0) {
      revert SkillsArrayZero();
    }

    require(actionIds.length <= 3);

    Player storage player = players[_tokenId];
    _consumeSkills(msg.sender, player, _tokenId);

    // Clear the action queue if something is in it
    if (players[_tokenId].actionQueue.length > 0) {
      delete players[_tokenId].actionQueue;
    }

    uint256 i;
    uint totalTimespan;
    uint40 prevEndTime = uint40(block.timestamp);
    do {
      // Map skill to function
      //      if (skills[i] == Skill.PAINT) {} else if (skills[i] == Skill.DEFENCE) {} else {
      // ....
      //      }

      players[_tokenId].actionQueue.push(
        SkillInfo({actionId: actionIds[i], startTime: prevEndTime, timespan: timespans[i]})
      );

      unchecked {
        ++i;
      }
      totalTimespan += timespans[i];
      prevEndTime += timespans[i];
    } while (i < actionIds.length);

    require(totalTimespan <= MAX_TIME);
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
      itemTokenIds[0] = uint16(Items.SHIELD);

      uint[] memory amounts = new uint[](1);
      amounts[0] = 1;

      itemNFT.mintBatch(_from, itemTokenIds, amounts);

      // Consume an XP boost immediately
      // TODO

      emit LevelUp(_from, _tokenId, itemTokenIds, amounts);
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
      tokenIds[0] = uint(Items.SHIELD);
    } else {
      tokenIds[0] = uint(Items.BRONZE_PICKAXE);
    }

    assembly {
      mstore(tokenIds, length)
    }
  }

  function _consumeSkills(
    address _from,
    Player storage _player,
    uint _tokenId
  ) private returns (SkillInfo[] memory remainingSkills) {
    uint queueLength = _player.actionQueue.length;
    if (queueLength == 0) {
      // No actions remaining
      return remainingSkills;
    }

    // TODO: Check they have the equipment/inventory available
    uint previousSkillPoints = _player.totalSkillPoints;
    uint allPointsAccured;

    remainingSkills = new SkillInfo[](queueLength); // Max
    uint length = 0;
    for (uint i = 0; i < queueLength; ++i) {
      SkillInfo storage skillInfo = _player.actionQueue[i];
      uint pointsAccured;
      uint40 skillEndTime = skillInfo.startTime + skillInfo.timespan;
      if (skillEndTime <= block.timestamp) {
        // Fully consume this skill
        pointsAccured = MAX_TIME;
      } else {
        // partially consume
        uint40 elapsedTime = uint40(block.timestamp - skillInfo.startTime);
        skillEndTime = uint40(block.timestamp);
        pointsAccured = elapsedTime; // TODO: This should be based on something else
        uint40 end = skillInfo.startTime + skillInfo.timespan;
        /*        if (_discardRestOfQueue) {
          _player.skillPoints[skillInfo.skill] += pointsAccured; // Update this later, just base it on time elapsed
          emit AddSkillPoints(skillInfo.skill, pointsAccured);
          length = 0;
          break;
        } */
        // Build a list of the skills queued that remain
        remainingSkills[length] = SkillInfo({
          actionId: skillInfo.actionId,
          startTime: uint40(block.timestamp),
          timespan: uint40(end - block.timestamp)
        });
        length = i + 1;
      }

      if (pointsAccured > 0) {
        Skill skill = world.getSkill(skillInfo.actionId);
        _player.skillPoints[skill] += pointsAccured; // Update this later, just base it on time elapsed
        emit AddSkillPoints(skill, pointsAccured);

        // What about loot, this gets pushed into the next day if there's no seed
        uint seed = world.getSeed(skillEndTime);
        if (seed == 0) {
          // There's no seed for this yet, so add it to the loot queue. (They can force)
          pendingLoot.push(PendingLoot({actionId: skillInfo.actionId, timestamp: skillEndTime}));
        } else {
          // Mint loot (TODO Update this later)
          uint tokenId = seed ^ ((skillInfo.actionId % 10) + 1);
          uint amount = seed ^ ((skillInfo.actionId % 2) + 1);
          itemNFT.mint(_from, tokenId, amount);
        }

        allPointsAccured += pointsAccured;
      }
    }

    if (allPointsAccured > 0) {
      // Check if they have levelled up
      _handleLevelUpRewards(_from, _tokenId, previousSkillPoints, previousSkillPoints + allPointsAccured);
    }

    if (remainingSkills.length == 0) {
      delete _player.actionQueue;
    }

    assembly {
      mstore(remainingSkills, length)
    }
  }

  function inventoryAmount(uint _tokenId) external view returns (uint) {
    //    (bool success, uint amount) = inventoryItems.tryGet(_tokenId);
    //    return amount;
  }

  function addAvatar(uint avatarId, AvatarInfo calldata avatarInfo) external onlyOwner {
    avatars[avatarId] = avatarInfo;
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
}
