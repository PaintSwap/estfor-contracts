// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// This file just contains various definitions to be run with sol2uml to test that storage slots are packed as expected
contract DebugStorageSlots {
  struct Item {
    EquipPosition equipPosition;
    // Can it be transferred?
    bool isTransferable;
    // Food
    uint16 healthRestored;
    // Boost vial
    BoostType boostType;
    uint16 boostValue; // Varies, could be the % increase
    uint24 boostDuration; // How long the effect of the boost last
    // Combat stats
    int16 melee;
    int16 magic;
    int16 range;
    int16 meleeDefence;
    int16 magicDefence;
    int16 rangeDefence;
    int16 health;
    // Minimum requirements in this skill to use this item (can be NONE)
    Skill skill;
    uint32 minXP;
    // Noncombat skill
    Skill skill1;
    int16 skillDiff1;
  }

  enum BoostType {
    NONE,
    ANY_XP,
    COMBAT_XP,
    NON_COMBAT_XP,
    GATHERING,
    ABSENCE
  }

  enum CombatStyle {
    NONE,
    ATTACK,
    DEFENCE
  }

  enum Skill {
    NONE,
    COMBAT, // This is a helper which incorporates all combat skills, attack <-> magic, defence, health etc
    MELEE,
    RANGE,
    MAGIC,
    DEFENCE,
    HEALTH,
    MINING,
    WOODCUTTING,
    FISHING,
    SMITHING,
    THIEVING,
    CRAFTING,
    COOKING,
    FIREMAKING
  }

  enum EquipPosition {
    NONE, // Used as a sentinel value
    HEAD,
    NECK,
    BODY,
    ARMS,
    LEGS,
    FEET,
    SPARE1,
    SPARE2,
    LEFT_HAND,
    RIGHT_HAND,
    BOTH_HANDS,
    ARROW_SATCHEL,
    MAGIC_BAG,
    FOOD,
    AUX, // wood, seeds  etc..
    BOOST_VIAL,
    NO_POSITION
  }

  // Loot
  struct GuaranteedReward {
    uint16 itemTokenId;
    uint24 rate; // num per hour, base 100 (2 decimals) or percentage chance
  }
  struct RandomReward {
    uint16 itemTokenId;
    uint16 chance; // out of 65535
    uint8 amount; // out of 255
  }

  struct PendingRandomReward {
    uint16 actionId;
    uint16 choiceId;
    uint40 timestamp;
    uint24 elapsedTime;
    uint128 queueId;
  }
  struct Equipment {
    uint16 itemTokenId;
    uint24 amount;
  }

  struct ActionRewards {
    uint16 guaranteedRewardTokenId1;
    uint16 guaranteedRewardRate1; // Num per hour, base 10 (1 decimal). Max 6533.5 per hour
    uint16 guaranteedRewardTokenId2;
    uint16 guaranteedRewardRate2;
    uint16 guaranteedRewardTokenId3;
    uint16 guaranteedRewardRate3;
    // Random chance rewards
    uint16 randomRewardTokenId1;
    uint16 randomRewardChance1; // out of 65335
    uint8 randomRewardAmount1; // out of 255
    uint16 randomRewardTokenId2;
    uint16 randomRewardChance2;
    uint8 randomRewardAmount2;
    uint16 randomRewardTokenId3;
    uint16 randomRewardChance3;
    uint8 randomRewardAmount3;
    uint16 randomRewardTokenId4;
    uint16 randomRewardChance4;
    uint8 randomRewardAmount4;
    // No more room!
  }

  // This is effectively a ratio to produce 1 of outputTokenId.
  // Fixed based available actions that can be undertaken for an action
  struct ActionChoice {
    Skill skill;
    uint32 minXP;
    uint32 diff;
    uint32 rate; // rate of output produced per hour (base 10) 1 decimal
    uint16 xpPerHour;
    uint16 inputTokenId1;
    uint8 num1;
    uint16 inputTokenId2;
    uint8 num2;
    uint16 inputTokenId3;
    uint8 num3;
    uint16 outputTokenId; // Always num of 1
    uint8 outputNum; // Not used yet
    uint8 successPercent; // 0-100
  }

  // The user chooses these
  struct QueuedActionInput {
    // Keep this first
    Attire attire;
    uint16 actionId;
    uint16 regenerateId; // Food (combat), maybe something for non-combat later
    uint16 choiceId; // Melee/Arrow/Magic (combat), logs, ore (non-combat)
    uint16 choiceId1; // Reserved (TBD)
    uint16 choiceId2; // Reserved (TBD)
    uint16 rightHandEquipmentTokenId; // Axe/Sword/bow, can be empty
    uint16 leftHandEquipmentTokenId; // Shield, can be empty
    uint24 timespan; // How long to queue the action for
    CombatStyle combatStyle; // specific style of combat,  can also be used
    Skill skill; // Skill from the action, so will be Skill.COMBAT for combat actions for instance
    //  bool reusePrev; // If true, then the previous queued action attire is reused?
    // 8 bytes left
  }

  struct QueuedAction {
    // Keep this first
    Attire attire;
    uint16 actionId;
    uint16 regenerateId; // Food (combat), maybe something for non-combat later
    uint16 choiceId; // Melee/Arrow/Magic (combat), logs, ore (non-combat)
    uint16 choiceId1; // Reserved (TBD)
    uint16 choiceId2; // Reserved (TBD)
    uint16 rightHandEquipmentTokenId; // Axe/Sword/bow, can be empty
    uint16 leftHandEquipmentTokenId; // Shield, can be empty
    uint24 timespan; // How long to queue the action for
    CombatStyle combatStyle; // specific style of combat,  can also be used
    uint40 startTime; // Filled in by the function
    bool isValid; // If we still have the item, TODO: Not used yet
    Skill skill; // Skill from the action, so will be Skill.COMBAT for combat actions for instance
    //  bool reusePrev; // If true, then the previous queued action attire is reused?
    // 9 bytes left
  }

  struct ActionInfo {
    Skill skill;
    bool isAvailable;
    bool isDynamic;
    bool actionChoiceRequired; // If true, then the user must choose an action choice
    uint16 xpPerHour;
    uint16 numSpawn; // Mostly for combat, capped respawn rate for xp/drops
    uint32 minXP;
    uint16 handItemTokenIdRangeMin; // Inclusive
    uint16 handItemTokenIdRangeMax; // Inclusive
    uint8 successPercent; // 0-100
  }

  // Equipment (leave at the bottom to allow for further ones)
  struct Attire {
    uint16 head; // tokenId for the head (1 - 255)
    uint16 neck; // tokenId for the neck (256 - 511) (256 * i -> 256 * (i + 1))
    uint16 body;
    uint16 arms;
    uint16 legs;
    uint16 feet;
    uint16 ring;
    uint16 reserved1;
    uint128 queueId; // Just here for packing purposes
  }

  struct CombatStats {
    // From skill points
    int16 melee;
    int16 magic;
    int16 range;
    int16 health;
    // These include equipment
    int16 meleeDefence;
    int16 magicDefence;
    int16 rangeDefence;
  }

  struct Player {
    // Combat levels, (Cached from skill points so this doesn't need to be calculated every combat)
    int16 melee;
    int16 magic;
    int16 range;
    int16 defence;
    int16 health;
    uint8 version; // This is used in case we want to do some migration of old characters, like halt them at level 30 from gaining XP
    uint160 totalXP;
    // TODO: Can be up to 7
    QueuedAction[] actionQueue;
  }

  // This is only for viewing so doesn't need to be optimized
  struct PendingOutput {
    Equipment[] consumed;
    Equipment[] produced;
    Equipment[] producedPastRandomRewards;
    Equipment[] producedXPRewards;
    uint32 xpGained;
    bool died;
  }

  struct PlayerBoostInfo {
    uint40 startTime;
    uint24 duration;
    uint16 val;
    uint16 itemTokenId; // Get the effect of it
    BoostType boostType;
  }

  struct XPThresholdReward {
    uint32 xpThreshold;
    Equipment[] equipments;
  }

  struct PendingFlags {
    bool includeLoot; // Guaranteed loot from actions, and random loot if claiming quite late
    bool includePastRandomRewards; // This is random loot from previous actions
    bool includeXPRewards; // Passing any xp thresholds gives you extra rewards
  }

  Item item;
  GuaranteedReward guaranteeedReward;
  RandomReward randomReward;
  PendingRandomReward pendingRandomReward;
  Equipment equipment;
  ActionRewards actionRewards;
  ActionChoice actionChoice;
  QueuedAction queuedAction;
  ActionInfo actionInfo;
  Attire attire;
  CombatStats combatStats;
  Player player;
  PendingOutput pendingOutput;
  PlayerBoostInfo playerBoostInfo;
  XPThresholdReward xpThresholdReward;
  PendingFlags pendingFlags;
}
