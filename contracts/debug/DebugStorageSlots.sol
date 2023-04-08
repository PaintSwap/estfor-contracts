// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DebugStorageSlots {
  struct Item {
    EquipPosition equipPosition;
    bool exists;
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
    Skill skill1; // This is related to skillDiff1 (here to keep packing constant as this replaces an old field)
    uint8 skillDiff1;
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
    NONE,
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
    BOOST_VIAL
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
    uint40 startTime;
    uint24 elapsedTime;
    uint64 queueId;
    // Boosts active at the time this was generated
    BoostType boostType;
    uint16 boostValue; // Varies, could be the % increase
    uint24 boostedTime; // How long the effect of the boost vial last
    // Full equipment at the time this was generated
    uint8 fullAttireBonusRewardsPercent;
  }
  struct Equipment {
    uint16 itemTokenId;
    uint24 amount;
  }

  struct ActionRewards {
    uint16 guaranteedRewardTokenId1;
    uint16 guaranteedRewardRate1; // Num per hour, base 10 (1 decimal). Max 6553.5 per hour
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
    uint24 xpPerHour;
    uint16 inputTokenId1;
    uint8 num1;
    uint16 inputTokenId2;
    uint8 num2;
    uint16 inputTokenId3;
    uint8 num3;
    uint16 outputTokenId;
    uint8 outputNum;
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
    uint64 queueId;
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
    uint40 startTime; // When the queued action started
    bool isValid; // If we still have the item, TODO: Not used yet
    uint64 queueId; // id of this queued action
  }

  struct ActionInfo {
    Skill skill;
    bool isAvailable;
    bool isDynamic;
    bool actionChoiceRequired; // If true, then the user must choose an action choice
    uint24 xpPerHour;
    uint16 numSpawned; // Mostly for combat, capped respawn rate for xp/drops
    uint32 minXP;
    uint16 handItemTokenIdRangeMin; // Inclusive
    uint16 handItemTokenIdRangeMax; // Inclusive
    uint8 successPercent; // 0-100
  }

  struct Attire {
    uint16 head;
    uint16 neck;
    uint16 body;
    uint16 arms;
    uint16 legs;
    uint16 feet;
    uint16 ring;
    uint16 reserved1;
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
    uint128 totalXP;
    Skill skillBoosted1;
    Skill skillBoosted2;
    // TODO: Can be up to 7
    QueuedAction[] actionQueue;
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

  struct Quest {
    uint16 dependentQuestId; // The quest that must be completed before this one can be started
    uint16 actionId; // action to do
    uint16 actionNum; // how many (up to 65535)
    uint16 actionId1; // another action to do
    uint16 actionNum1; // how many (up to 65535)
    uint16 actionChoiceId; // actionChoice to perform
    uint16 actionChoiceNum; // how many to do (base number), (up to 65535)
    Skill skillReward; // The skill to reward XP to
    uint16 skillXPGained; // The amount of XP to give (up to 65535)
    uint16 rewardItemTokenId; // Reward an item
    uint16 rewardAmount; // amount of the reward (up to 65535)
    uint16 rewardItemTokenId1; // Reward another item
    uint16 rewardAmount1; // amount of the reward (up to 65535)
    uint16 burnItemTokenId; // Burn an item
    uint16 burnAmount; // amount of the burn (up to 65535)
    uint24 questId; // Unique id for this quest
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
  PlayerBoostInfo playerBoostInfo;
  XPThresholdReward xpThresholdReward;
  Quest quest;
}
