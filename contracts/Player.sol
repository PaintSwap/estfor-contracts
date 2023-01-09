import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "./interfaces/ItemStat.sol";

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IPaintScapeNFT {
  function balanceOf(address account, uint256 id) external view returns (uint256);

  function balanceOfBatch(address[] memory accounts, uint256[] memory ids) external view returns (uint256[] memory);

  function equip(uint256 _tokenId, address _from) external;

  function unequip(uint256 _tokenId, address _from) external;

  function getItemStats(uint256 _tokenId) external view returns (ItemStat memory);
}

// TODO: Power-ups (2x Skill, burn BUCKET)
// TODO: Daily challenge, or weekly challenge, random
// TODO: There is a set amount of gold that can be minted each day. The more players there are, the effective amount of gold decreases.

contract Player {
  event AddInventory(uint tokenId, uint amount);
  event RemoveInventory(uint tokenId, uint amount);
  event Unequip(uint tokenId, uint bonusRemoved);
  event Equip(uint tokenId, uint bonusAdded);
  event AddSkillPoints(Skill action, uint points);

  enum Skill {
    NONE,
    PAINT,
    DEFENCE,
    FISH,
    COOK
  }

  struct SkillInfo {
    Skill skill;
    uint40 endTime;
  }

  //    error SkillsArrayZero();
  //    error SkillExecutionTooClose(string skill, uint40 minTime);

  // Attributes
  uint16 public health;
  // These are extra from the items equipped
  uint8 public attackBonus;
  uint8 public defenceBonus;

  mapping(Skill => uint256) public skillPoints;

  uint32 public constant MAX_TIME = 1 days;
  bool public immutable sex; // male = true

  uint256 public id; // tokenId from NFT
  SkillInfo[] private actionQueue;
  // Or current action?
  // Just work off current action;
  Skill public currentAction;
  uint40 public currentActionUntil;

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
    uint8 dummy;
    uint8 dummy1; // To keep it aligned
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
  EnumerableMap.UintToUintMap private inventoryItems;

  function inventoryAmount(uint _tokenId) external view returns (uint) {
    (bool success, uint amount) = inventoryItems.tryGet(_tokenId);
    return amount;
  }

  uint256 public slotsUsed = 0;
  uint256 public constant MAX_SLOTS = 16; //
  uint256 public constant MAX_WEIGHT_PER_SLOT = 12000; // Each slot weighs MAX_WEIGHT / MAX_ITEMS, single item slots weigh that amount.

  Equipped public equipment;
  IPaintScapeNFT private nft;

  constructor(
    address _nft,
    uint _id,
    bool _sex
  ) {
    nft = IPaintScapeNFT(_nft);
    sex = _sex;
    id = _id;
  }

  modifier isOwnerOfPlayer() {
    require(nft.balanceOf(msg.sender, id) == 1, "Not the owner of this player");
    _;
  }

  // The player has a certain number of slots, each item has a different weight,
  // Some slots can contain multiple of the same item (e.g arrows)
  function addToInventory(uint256 _tokenId, uint256 _amount) external isOwnerOfPlayer {
    _consumeLastSkill();

    ItemStat memory stats = nft.getItemStats(_tokenId);
    uint256 weight = stats.weight;

    (bool success, uint existingAmount) = inventoryItems.tryGet(_tokenId);
    uint256 remainder = (existingAmount * weight) % MAX_WEIGHT_PER_SLOT;

    // Update number of slots used in the inventory
    uint256 numFullSlotsNeeded = (_amount * weight) / MAX_WEIGHT_PER_SLOT;
    if (remainder == 0 && (slotsUsed + numFullSlotsNeeded <= MAX_SLOTS)) {
      // No existing slots used
      slotsUsed = numFullSlotsNeeded;
    } else {
      // Fill existing slot and add new slots if needed
      require(
        ((slotsUsed + numFullSlotsNeeded + 1) <= MAX_SLOTS) &&
          ((existingAmount + remainder) * weight) <= MAX_WEIGHT_PER_SLOT
      );
      slotsUsed = numFullSlotsNeeded + 1;
    }

    // Update the inventory
    inventoryItems.set(_tokenId, existingAmount + _amount);

    emit AddInventory(_tokenId, _amount);
  }

  function removeFromInventory(uint256 _tokenId, uint256 _amount) external isOwnerOfPlayer {
    // Check that they have the item in their inventory
    uint numInventory = inventoryItems.get(_tokenId);
    require(numInventory >= _amount);

    _consumeLastSkill();

    ItemStat memory stats = nft.getItemStats(_tokenId);
    uint256 weight = stats.weight;

    uint256 numFullSlotsUsed = (_amount * weight) / MAX_WEIGHT_PER_SLOT;
    slotsUsed -= numFullSlotsUsed;

    unchecked {
      inventoryItems.set(_tokenId, numInventory - _amount);
    }
    emit RemoveInventory(_tokenId, _amount);
  }

  // Cannot be transferred while equipped.  Check if the NFT is being transferred and unequip from this user.
  // Replace old one
  function equip(uint256 _tokenId) external isOwnerOfPlayer {
    _consumeLastSkill();

    // Add bonus
    ItemStat memory stats = nft.getItemStats(_tokenId);
    require(stats.attribute != Attribute.NONE);

    uint8 bonus = stats.bonus;

    EquipPosition position = stats.equipPosition;

    // Unequip anything that is already there.
    uint8 equipped;
    /// @solidity memory-safe-assembly
    assembly {
      let val := sload(equipment.slot)
      equipped := shr(mul(position, 8), val)

      // Clear the byte position
      val := and(val, not(shl(mul(position, 8), 0xff)))
      // Now set it
      val := or(val, shl(mul(position, 8), _tokenId))
      sstore(equipment.slot, val)
    }

    require(_tokenId != equipped, "Equipping same item");

    if (equipped > 0) {
      // Unequip current item and remove bonus
      EquipmentBonus memory existingBonus;
      /// @solidity memory-safe-assembly
      assembly {
        let val := sload(equipment.slot)
        existingBonus := shr(mul(add(8, mul(position, 2)), 8), val)
      }

      bonus -= existingBonus.bonus;

      nft.unequip(equipped, msg.sender);
      emit Unequip(equipped, existingBonus.bonus);
    }

    if (stats.attribute == Attribute.ATTACK) {
      attackBonus += bonus;
    } else if (stats.attribute == Attribute.DEFENCE) {
      defenceBonus += bonus;
    }

    // This will check the user has enough balance inside
    nft.equip(_tokenId, msg.sender);
    emit Equip(_tokenId, stats.bonus);
  }

  function unequip(uint8 _position) external isOwnerOfPlayer {
    // This requires checking that we have it equipped

    uint8 equipped;
    /// @solidity memory-safe-assembly
    assembly {
      let val := sload(equipment.slot)
      equipped := shr(mul(_position, 8), val)
    }
    require(equipped > 0, "Equipping same item");

    nft.unequip(equipped, msg.sender);
  }

  //    function equipMany(uint256 _tokenIds) external {
  // TODO:
  //    }

  // Don't use random component until skill levels are reached
  function paint() public isOwnerOfPlayer {
    _consumeLastSkill();

    // Earn gold ERC20
    currentAction = Skill.PAINT;
    currentActionUntil = uint40(block.timestamp + MAX_TIME);
  }

  //    mapping(uint, claimable);
  function claimables() external isOwnerOfPlayer {}

  function die() private {
    // Lose 1 minor equipment and all of your inventory.
  }

  function randomEvent() private {
    //
  }

  function defence() external isOwnerOfPlayer {
    if (currentAction != Skill.NONE) {
      // How far along are we
      uint40 elapsedTime = uint40(
        block.timestamp > currentActionUntil ? MAX_TIME : MAX_TIME - (currentActionUntil - block.timestamp)
      );

      // Consume enough food (you can die!)
      // Not enough food die()
      _consumeLastSkill();
    }

    currentAction = Skill.DEFENCE;
    currentActionUntil = uint40(block.timestamp + MAX_TIME);
  }

  function consumeLastSkill() external isOwnerOfPlayer {
    _consumeLastSkill();
  }

  // Queue them up (Skill X for some amount of time, Skill Y for some amount of time, SKill Z for some amount of time)
  function multiskill(Skill[] calldata skills) external isOwnerOfPlayer {
    _consumeLastSkill();

    //        if (skills.length == 0) {
    //            revert SkillsArrayZero();
    //        }

    uint256 i;
    do {
      // Map skill to function
      if (skills[i] == Skill.PAINT) {
        paint();
      } else {
        // ....
      }

      unchecked {
        ++i;
      }
    } while (i < skills.length);
  }

  //    function view() external {
  // Get up to date stats that may still be pending and not on the blockchain yet.
  //        actionQueue
  //    }

  function getActionQueue() external view returns (SkillInfo[] memory) {
    return actionQueue;
  }

  function actionQueueLength() external view returns (uint256) {
    return actionQueue.length;
  }

  // When an action is performed any existing active action should conclude.
  // This needs to be called before doing any other action so that they can't
  // try and game the system by for instance adding cooked meat to their inventory
  // while doing defence.
  function _consumeLastSkill() private {
    if (currentAction != Skill.NONE) {
      // How far along are we
      uint40 elapsedTime = uint40(
        block.timestamp > currentActionUntil ? MAX_TIME : MAX_TIME - (currentActionUntil - block.timestamp)
      );

      // Work out how much progress they should get
      skillPoints[currentAction] += elapsedTime; // Update this later, just base it on time elapsed
      emit AddSkillPoints(currentAction, elapsedTime);
      currentAction = Skill.NONE;
    }
  }
}
