// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {QueuedAction} from "./actions.sol";

// 4 bytes for each level. 0x00000000 is the first level, 0x00000054 is the second, etc.
bytes constant XP_BYTES = hex"0000000000000054000000AE0000010E00000176000001E60000025E000002DE00000368000003FD0000049B00000546000005FC000006C000000792000008730000096400000A6600000B7B00000CA400000DE100000F36000010A200001229000013CB0000158B0000176B0000196E00001B9400001DE20000205A000022FF000025D5000028DD00002C1E00002F99000033540000375200003B9A000040300000451900004A5C00004FFF0000560900005C810000637000006ADD000072D100007B570000847900008E42000098BE0000A3F90000B0020000BCE70000CAB80000D9860000E9630000FA6200010C990001201D0001350600014B6F0001637300017D2E000198C10001B64E0001D5F80001F7E600021C430002433B00026CFD000299BE0002C9B30002FD180003342B00036F320003AE730003F23D00043AE3000488BE0004DC2F0005359B000595700005FC2400066A360006E02D00075E990007E6160008774C000912EB0009B9B4000A6C74000B2C06000BF956000CD561000DC134000EBDF3000FCCD40010EF24";

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
  uint40 queuedActionStartTime; // The start time of the first queued action
  // For combat this will be attack, defence, magic or ranged, as well as health
  Skill queuedActionAlreadyProcessedSkill; // The skill that the queued action has already gained XP in
  uint24 queuedActionAlreadyProcessedXPGained; // The amount of XP that the queued action has already gained
  Skill queuedActionAlreadyProcessedSkill1;
  uint24 queuedActionAlreadyProcessedXPGained1;
  Skill skillBoosted1;
  Skill skillBoosted2;
  uint112 totalXP;
  uint8 version; // This is used in case we want to do some migration of old characters, like halt them at level 30 from gaining XP. Not used currently
  // TODO: Can be up to 7
  QueuedAction[] actionQueue;
  string name;
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

struct Equipment {
  uint16 itemTokenId;
  uint24 amount;
}

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

struct PlayerBoostInfo {
  uint40 startTime;
  uint24 duration;
  uint16 val;
  uint16 itemTokenId; // Get the effect of it
  BoostType boostType;
}

// This is effectively a ratio to produce 1 of outputTokenId.
// Fixed based available actions that can be undertaken for an action
struct ActionChoice {
  Skill skill;
  uint32 minXP;
  uint16 diff; //
  uint24 rate; // Rate of output produced per hour (base 1000) 3 decimals
  uint24 xpPerHour;
  uint16 inputTokenId1;
  uint8 inputAmount1;
  uint16 inputTokenId2;
  uint8 inputAmount2;
  uint16 inputTokenId3;
  uint8 inputAmount3;
  uint16 outputTokenId;
  uint8 outputAmount;
  uint8 successPercent; // 0-100
}

enum Skill {
  NONE,
  COMBAT, // This is a helper which incorporates all combat skills, attack <-> magic, defence, health etc
  MELEE,
  RANGE,
  MAGIC,
  DEFENCE,
  HEALTH,
  RESERVED_COMBAT,
  MINING,
  WOODCUTTING,
  FISHING,
  SMITHING,
  THIEVING,
  CRAFTING,
  COOKING,
  FIREMAKING
}

// Must be in the same order as Skill
struct PackedXP {
  uint40 melee;
  uint40 range;
  uint40 magic;
  uint40 defence;
  uint40 health;
  uint40 reservedCombat;
  // Next slot
  uint40 mining;
  uint40 woodcutting;
  uint40 fishing;
  uint40 smithing;
  uint40 thieving;
  uint40 crafting;
  // Next slot
  uint40 cooking;
  uint40 firemaking;
}

struct AvatarInfo {
  string name;
  string description;
  string imageURI;
  Skill[2] startSkills; // Can be NONE
}

struct PastRandomRewardInfo {
  uint16 actionId;
  uint64 queueId;
  uint16 itemTokenId;
  uint24 amount;
  uint numRemoved;
}

struct PendingQueuedActionEquipmentState {
  uint[] consumedItemTokenIds;
  uint[] consumedAmounts;
  uint[] producedItemTokenIds;
  uint[] producedAmounts;
}

struct PendingQueuedActionMetadata {
  uint32 xpGained; // total xp gained
  uint32 rolls;
  bool died;
  uint16 actionId;
  uint64 queueId;
  uint24 elapsedTime;
  uint24 xpElapsedTime;
}

struct PendingQueuedActionXPGained {
  // The amount of XP that the queued action has already gained
  // XP gained during this session
  Skill[] skills;
  uint32[] xpGainedSkills;
  Skill alreadyProcessedSkill;
  uint24 alreadyProcessedXPGained;
  Skill alreadyProcessedSkill1;
  uint24 alreadyProcessedXPGained1;
}

struct QuestState {
  uint[] consumedItemTokenIds;
  uint[] consumedAmounts;
  uint[] rewardItemTokenIds;
  uint[] rewardAmounts;
  PlayerQuest[] activeQuestInfo;
  uint[] actionIds;
  uint[] actionAmounts;
  uint[] choiceIds;
  uint[] choiceAmounts;
  uint[] questsCompleted;
  Skill[] skills; // Skills gained XP in
  uint32[] xpGainedSkills; // XP gained in these skills
}

struct PendingQueuedActionState {
  // These 2 are in sync. Separated to reduce gas/deployment costs as these are passed down many layers.
  PendingQueuedActionEquipmentState[] equipmentStates;
  PendingQueuedActionMetadata[] actionMetadatas;
  QueuedAction[] remainingSkills;
  PendingQueuedActionXPGained xpGained;
  PastRandomRewardInfo[] producedPastRandomRewards;
  uint[] xpRewardItemTokenIds;
  uint[] xpRewardAmounts;
  uint[] dailyRewardItemTokenIds;
  uint[] dailyRewardAmounts;
  bytes32 dailyRewardMask;
  QuestState quests;
}

interface IPlayersRewardsDelegate {
  function claimRandomRewards(uint _playerId, PendingQueuedActionXPGained memory _pendingQueuedActionXPGained) external;
}

// External view functions that are in other implementation files
interface IPlayersRewardsDelegateView {
  function pendingQueuedActionStateImpl(
    address _owner,
    uint _playerId
  ) external view returns (PendingQueuedActionState memory pendingQueuedActionState);
}

interface IPlayersProcessActionsDelegate {
  function processActions(address from, uint playerId) external;
}

interface IPlayersProcessActionsDelegateView {
  function completeProcessConsumablesView(
    address from,
    uint _playerId,
    QueuedAction memory queuedAction,
    ActionChoice memory actionChoice,
    CombatStats memory combatStats,
    uint elapsedTime,
    uint startTime,
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates,
    PendingQueuedActionXPGained memory _pendingQueuedActionXPGained
  )
    external
    view
    returns (
      Equipment[] memory consumedEquipments,
      Equipment memory producedEquipment,
      uint xpElapsedTime,
      uint prevXPElapsedTime,
      bool died,
      uint24 numConsumed
    );
}

interface IPlayersMiscDelegateView {
  function claimableXPThresholdRewardsImpl(
    uint oldTotalXP,
    uint newTotalXP
  ) external view returns (uint[] memory itemTokenIds, uint[] memory amounts);

  function dailyClaimedRewardsImpl(uint playerId) external view returns (bool[7] memory claimed);

  function dailyRewardsViewImpl(
    uint _playerId
  ) external view returns (uint[] memory itemTokenIds, uint[] memory amounts, bytes32 dailyRewardMask);

  function processConsumablesViewImpl(
    address from,
    uint playerId,
    QueuedAction memory queuedAction,
    uint queuedActionStartTime,
    uint elapsedTime,
    CombatStats memory combatStats,
    ActionChoice memory actionChoice,
    bool checkBalance,
    PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates,
    PendingQueuedActionXPGained memory pendingQueuedActionXPGained
  )
    external
    view
    returns (
      Equipment[] memory consumedEquipment,
      Equipment memory producedEquipment,
      uint xpElapsedTime,
      bool died,
      uint24 numConsumed
    );
}

interface IPlayersMiscDelegate {
  function handleDailyRewards(address from, uint playerId) external;
}

struct FullAttireBonusInput {
  Skill skill;
  uint8 bonusXPPercent;
  uint8 bonusRewardsPercent; // 3 = 3%
  uint16[5] itemTokenIds; // 0 = head, 1 = body, 2 arms, 3 body, 4 = feet
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
  uint16 questId; // Unique id for this quest
  bool requireActionsCompletedBeforeBurning; // If true, the player must complete the actions before the item can be burnt
}

struct PlayerQuest {
  uint32 questId;
  uint16 actionCompletedNum;
  uint16 actionCompletedNum1;
  uint16 actionChoiceCompletedNum;
  uint16 burnCompletedAmount;
  bool isFixed;
}

// Input only
struct NonCombatStats {
  Skill skill;
  uint8 diff;
}

// Contains everything you need to create an item
struct InputItem {
  CombatStats combatStats;
  NonCombatStats nonCombatStats;
  uint16 tokenId;
  EquipPosition equipPosition;
  // Can it be transferred?
  bool isTransferable;
  // Minimum requirements in this skill
  Skill skill;
  uint32 minXP;
  // Food
  uint16 healthRestored;
  // Boost
  BoostType boostType;
  uint16 boostValue; // Varies, could be the % increase
  uint24 boostDuration; // How long the effect of the boost vial last
  // uri
  string metadataURI;
  string name;
}

// 4 bytes for each threshold, starts at 500 xp in decimal
bytes constant xpRewardBytes = hex"00000000000001F4000003E8000009C40000138800002710000075300000C350000186A00001D4C0000493E0000557300007A120000927C0000B71B0";
