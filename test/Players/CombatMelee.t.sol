// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CombatTestBase} from "./CombatTestBase.sol";
import {Skill, CombatStyle, CombatStats, BoostType} from "../../contracts/globals/misc.sol";
import {ActionInput, ActionQueueStrategy, QueuedActionInput, GUAR_MUL, SPAWN_MUL} from "../../contracts/globals/actions.sol";
import {EquipPosition, ItemInput, PendingQueuedActionState, Player} from "../../contracts/globals/players.sol";
import {QuestInput} from "../../contracts/globals/quests.sol";
import {GuaranteedReward, RandomReward} from "../../contracts/globals/rewards.sol";
import {IPlayersBase as PlayersBase} from "../../contracts/interfaces/IPlayersBase.sol";
import {ItemNFT} from "../../contracts/ItemNFT.sol";
import {IQuests as Quests} from "../../contracts/interfaces/IQuests.sol";
import {IPlayersImplMisc1 as IPlayersMisc1DelegateView} from "../../contracts/interfaces/IPlayersImplMisc1.sol";
import {NONE, BRONZE_SWORD, XP_BOOST, LUCK_OF_THE_DRAW} from "../../contracts/globals/items.sol";

contract CombatMeleeTest is CombatTestBase {
  uint16 private constant ACTION_COMBAT_NATUOW = 2000;
  uint16 private constant ACTION_COMBAT_GROG_TOAD = 2001;
  uint16 private constant COOKED_BLEKK = 11009;
  uint16 private constant NATUOW_HIDE = 65533;
  uint16 private constant NATUOW_LEATHER = 65532;
  uint16 private constant SMALL_BONE = 65531;
  uint16 private constant FLIXORA = 65486;
  uint16 private constant QUEST_SUPPLY_RUN = 3;
  uint8 private constant BOOST_START_NOW = 2;

  function testAttack() public {
    (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMelee();
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 hours);
    _process(playerId);
    _assertWithinOne(players.getPlayerXP(playerId, Skill.MELEE), 3600);
    _assertWithinOne(players.getPlayerXP(playerId, Skill.HEALTH), 1200);
    assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 0);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), (3600 * rate * spawned) / (3600 * GUAR_MUL * SPAWN_MUL));
    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 254);
    assertEq(itemNFT.balanceOf(ALICE, NONE), 0);
  }

  function testInProgressCombatUpdatesMany() public {
    (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMelee();
    _start(playerId, action);
    uint256 loops = action.timespan / 240;
    for (uint256 i; i < loops; ++i) {
      vm.warp(vm.getBlockTimestamp() + (i == loops - 1 ? 120 : 240)); // deterministic intervals
      _process(playerId);
    }
    uint256 partialHealthXP = players.getPlayerXP(playerId, Skill.HEALTH);
    assertGt(partialHealthXP, 0);
    assertGt(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
    assertLt(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 255);
    vm.warp(vm.getBlockTimestamp() + action.timespan);
    _process(playerId);
    assertEq(players.getPlayerXP(playerId, Skill.MELEE), action.timespan);
    _assertWithinOne(players.getPlayerXP(playerId, Skill.HEALTH), action.timespan / 3);
    assertTrue(partialHealthXP + 1 < action.timespan / 3);
    assertEq(
      itemNFT.balanceOf(ALICE, BRONZE_ARROW),
      (action.timespan * rate * spawned) / (3600 * GUAR_MUL * SPAWN_MUL)
    );
    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 254);
  }

  function testNoDefenceEquipment() public {
    (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMelee();
    action.attire.head = NONE;
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 hours);
    _process(playerId);
    _assertWithinOne(players.getPlayerXP(playerId, Skill.MELEE), 3600);
    _assertWithinOne(players.getPlayerXP(playerId, Skill.HEALTH), 1200);
    assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 0);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), (3600 * rate * spawned) / (3600 * GUAR_MUL * SPAWN_MUL));
    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 253);
  }

  function testDontKillAnything() public {
    (QueuedActionInput memory action, , ) = _setupMelee();
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 10);
    _process(playerId);
    assertEq(players.getPlayerXP(playerId, Skill.MELEE), 0);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0);
    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 255);
  }

  function testMeleeDefence() public {
    (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMelee();
    action.combatStyle = uint8(CombatStyle.DEFENCE);
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 hours);
    _process(playerId);
    _assertWithinOne(players.getPlayerXP(playerId, Skill.DEFENCE), 3600);
    assertEq(players.getPlayerXP(playerId, Skill.MELEE), 0);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), (3600 * rate * spawned) / (3600 * GUAR_MUL * SPAWN_MUL));
    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 254);
  }

  function testEquipShield() public {
    (QueuedActionInput memory action, uint256 rate, uint256 spawned) = _setupMelee();
    action.rightHandEquipmentTokenId = BRONZE_SHIELD;
    itemNFT.mint(ALICE, BRONZE_SHIELD, 1);
    vm.expectRevert(abi.encodeWithSelector(ItemNFT.ItemDoesNotExist.selector, BRONZE_SHIELD));
    _start(playerId, action);
    itemNFT.addItems(_items(_item(BRONZE_SHIELD, EquipPosition.LEFT_HAND)));
    vm.expectRevert(abi.encodeWithSelector(PlayersBase.IncorrectRightHandEquipment.selector, BRONZE_SHIELD));
    _start(playerId, action);
    action.rightHandEquipmentTokenId = BRONZE_SWORD;
    action.leftHandEquipmentTokenId = BRONZE_SHIELD;
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 hours);
    _process(playerId);
    _assertWithinOne(players.getPlayerXP(playerId, Skill.MELEE), 3600);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), (3600 * rate * spawned) / (3600 * GUAR_MUL * SPAWN_MUL));
    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 254);
  }

  function testFightPowerfulBoss() public {
    (QueuedActionInput memory action, , ) = _setupMelee();
    _addCombatAction(2, uint24(10 * SPAWN_MUL), CombatStats(80, 80, 80, 1200, 80, 80, 80), NONE, 0, false);
    action.actionId = 2;
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 hours + 1);
    PendingQueuedActionState memory state = _pending(playerId);
    assertEq(state.equipmentStates[0].consumedItemTokenIds.length, 1);
    assertEq(state.equipmentStates[0].consumedItemTokenIds[0], COOKED_MINNUS);
    assertEq(state.equipmentStates[0].consumedAmounts[0], 255);
    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 255);
    _process(playerId);
    assertEq(players.getPlayerXP(playerId, Skill.MELEE), 0);
    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 0);
  }

  function testMultiHourRespawnCanKillAll() public {
    (QueuedActionInput memory action, , ) = _setupMelee();
    _addCombatAction(2, uint24(SPAWN_MUL / 2), CombatStats(10, 0, 0, 70, 10, 0, 0), NONE, 0, false);
    action.actionId = 2;
    action.timespan = 7200;
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 hours + 1);
    PendingQueuedActionState memory state = _pending(playerId);
    assertEq(state.equipmentStates[0].consumedItemTokenIds.length, 1);
    assertEq(state.equipmentStates[0].consumedAmounts[0], 14);
    assertEq(state.actionMetadatas[0].xpGained, 0);
    _process(playerId);
    vm.warp(vm.getBlockTimestamp() + 1 hours + 1);
    state = _pending(playerId);
    assertEq(state.equipmentStates[0].consumedItemTokenIds.length, 0);
    assertEq(state.actionMetadatas[0].xpGained, 9600);
  }

  function testMultiHourRespawnCannotKill() public {
    (QueuedActionInput memory action, , ) = _setupMelee();
    _addCombatAction(2, uint24(SPAWN_MUL / 2), CombatStats(1, 0, 0, 32000, 80, 0, 0), NONE, 0, false);
    action.actionId = 2;
    action.timespan = 7200;
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 hours + 1);
    PendingQueuedActionState memory state = _pending(playerId);
    assertEq(state.equipmentStates[0].consumedItemTokenIds.length, 1);
    assertEq(state.equipmentStates[0].consumedAmounts[0], 5);
    assertEq(state.actionMetadatas[0].xpGained, 0);
    _process(playerId);
    vm.warp(vm.getBlockTimestamp() + 1 hours + 1);
    state = _pending(playerId);
    assertEq(state.equipmentStates[0].consumedAmounts[0], 5);
    assertEq(state.actionMetadatas[0].xpGained, 0);
  }

  function testUseTooMuchFood() public {
    _testFoodCap(false, false);
  }

  function testHealthShouldGiveHealingEffects() public {
    _testFoodCap(true, false);
  }

  function testUseTooMuchFoodSplitOverSameAction() public {
    _testFoodCap(false, true);
  }

  function testTakeIntoAccountDefenceQuestXPReward() public {
    (QueuedActionInput memory natuow, QueuedActionInput memory grog) = _setupNatuowAndGrog();
    _start(playerId, natuow);
    vm.warp(vm.getBlockTimestamp() + 5518);
    _process(playerId);
    vm.warp(vm.getBlockTimestamp() + 27869);
    _activateAnyXPBoost();
    vm.warp(vm.getBlockTimestamp() + 240);

    _addSupplyRunQuests(1);
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_SUPPLY_RUN);
    vm.prank(ALICE);
    players.startActions(playerId, _actions(grog), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
    vm.warp(vm.getBlockTimestamp() + 41700);
    _process(playerId);

    assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 250);
    _assertProcessedPlayer(1145, 381);
    _process(playerId);
  }

  function testCurrentActionProcessedSkillForAll123() public {
    (QueuedActionInput memory natuow, QueuedActionInput memory grog) = _setupNatuowAndGrog();
    _start(playerId, natuow);
    vm.warp(vm.getBlockTimestamp() + 5518);
    _process(playerId);
    vm.warp(vm.getBlockTimestamp() + 27869);
    _activateAnyXPBoost();
    vm.warp(vm.getBlockTimestamp() + 240);

    _addSupplyRunQuests(5);
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_SUPPLY_RUN);
    vm.prank(ALICE);
    players.startActions(playerId, _actions(grog), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
    for (uint16 i = 1; i < 5; ++i) {
      vm.warp(vm.getBlockTimestamp() + 8000);
      vm.prank(ALICE);
      players.activateQuest(playerId, QUEST_SUPPLY_RUN + i);
    }
    vm.warp(vm.getBlockTimestamp() + 9700);
    _process(playerId);

    assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 250);
    assertEq(players.getPlayerXP(playerId, Skill.MAGIC), START_XP + 250);
    assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 250);
    assertEq(players.getPlayerXP(playerId, Skill.MELEE), 1145 + 250);
    assertEq(players.getPlayerXP(playerId, Skill.HEALTH), 381 + 250);
    _assertProcessedPlayer(1145 + 250, 381 + 250);
    _process(playerId);
  }

  function testClearEverything() public {
    (QueuedActionInput memory natuow, ) = _setupNatuowAndGrog();
    ItemInput[] memory boostItems = new ItemInput[](2);
    boostItems[0] = _boostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.NON_COMBAT_XP, 50);
    boostItems[1] = _boostItem(LUCK_OF_THE_DRAW, EquipPosition.EXTRA_BOOST_VIAL, BoostType.ANY_XP, 5);
    itemNFT.addItems(boostItems);
    itemNFT.mint(ALICE, XP_BOOST, 1);
    brush.mint(ALICE, 100_000 ether);
    uint256 raffleCost = wishingWell.getRaffleEntryCost();
    vm.startPrank(ALICE);
    brush.approve(address(wishingWell), 100_000 ether);
    players.startActionsAdvanced(
      playerId,
      _actions(natuow),
      XP_BOOST,
      BOOST_START_NOW,
      0,
      raffleCost,
      ActionQueueStrategy.OVERWRITE
    );
    vm.stopPrank();
    vm.warp(vm.getBlockTimestamp() + 73318);
    _process(playerId);
    players.modifyXP(ALICE, playerId, Skill.DEFENCE, 250, true);
    vm.warp(vm.getBlockTimestamp() + 240);
    assertTrue(uint8(players.getActiveBoost(playerId).boostType) != 0);
    assertTrue(uint8(players.getActiveBoost(playerId).extraBoostType) != 0);

    _createPlayer(ALICE, 1, "Replacement", true);
    assertEq(players.getActionQueue(playerId).length, 0);
    assertEq(uint8(players.getActiveBoost(playerId).boostType), 0);
    assertEq(uint8(players.getActiveBoost(playerId).extraBoostType), 0);
  }

  function testCheckRandomRewards() public {
    (QueuedActionInput memory action, , uint256 spawned) = _setupMelee();
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 hours);
    PendingQueuedActionState memory state = _pending(playerId);
    assertEq(state.actionMetadatas.length, 1);
    assertEq(state.actionMetadatas[0].xpGained, 4800);
    assertEq(state.actionMetadatas[0].rolls, spawned / SPAWN_MUL);
    _process(playerId);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillSeeded(200_000_000);
    _requestAndFulfillSeeded(300_000_000);
    _process(playerId);
    assertGe(itemNFT.balanceOf(ALICE, POISON), 2);
    assertLe(itemNFT.balanceOf(ALICE, POISON), 8);
  }

  function testRandomRewardsFinishAfterMidnightBeforeOracle() public {
    (QueuedActionInput memory action, , uint256 spawned) = _setupMelee();
    _requestAndFulfill();
    vm.warp(((block.timestamp / 1 days) + 1) * 1 days + 1);
    _requestAndFulfill();
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    PendingQueuedActionState memory state = _pending(playerId);
    assertEq(state.actionMetadatas.length, 1);
    assertEq(state.actionMetadatas[0].rolls, spawned / SPAWN_MUL);
    _process(playerId);
    _requestAndFulfill();
    vm.expectRevert();
    randomnessBeacon.requestRandomWords();
    state = _pending(playerId);
    assertGt(state.numPastRandomRewardInstancesToRemove, 0);
  }

  function testRandomRewardsProcessAfterWaitingAnotherDay() public {
    (QueuedActionInput memory action, , uint256 spawned) = _setupMelee();
    _start(playerId, action);
    vm.warp(vm.getBlockTimestamp() + 1 hours);
    PendingQueuedActionState memory state = _pending(playerId);
    assertEq(state.actionMetadatas[0].xpGained, 4800);
    assertEq(state.actionMetadatas[0].rolls, spawned / SPAWN_MUL);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfill();
    _requestAndFulfill();
    _process(playerId);
    assertEq(itemNFT.balanceOf(ALICE, POISON), 0);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillSeeded(100_000_000_000);
    vm.warp(vm.getBlockTimestamp() + 1);
    state = _pending(playerId);
    assertEq(state.producedPastRandomRewards.length, 1);
    _process(playerId);
    assertGt(itemNFT.balanceOf(ALICE, POISON), 0);
    assertLt(itemNFT.balanceOf(ALICE, POISON), spawned / SPAWN_MUL);
  }

  function testRandomRewardsInProgressUpdatesMany() public {
    (QueuedActionInput memory action, , uint256 spawned) = _setupMelee();
    _start(playerId, action);
    for (uint256 i; i < action.timespan / 240; ++i) {
      vm.warp(vm.getBlockTimestamp() + 120); // deterministic 50% interval, within the original 0..80% range
      _process(playerId);
    }
    _requestAndFulfill();
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfill();
    _process(playerId);
    vm.warp(vm.getBlockTimestamp() + 1 days);
    _requestAndFulfillSeeded(10_000_000);
    vm.warp(vm.getBlockTimestamp() + 1);
    PendingQueuedActionState memory state = _pending(playerId);
    assertEq(state.producedPastRandomRewards.length, 1);
    _process(playerId);
    uint256 balance = itemNFT.balanceOf(ALICE, POISON);
    uint256 midpoint = spawned / (SPAWN_MUL * 2);
    assertGe(balance, midpoint - 3);
    assertLe(balance, midpoint + 3);
  }

  function _setupNatuowAndGrog() private returns (QueuedActionInput memory natuow, QueuedActionInput memory grog) {
    ActionInput[] memory combatActions = new ActionInput[](2);
    combatActions[0] = _productionCombatAction(ACTION_COMBAT_NATUOW, 100, CombatStats(1, 0, 0, 20, 0, 0, 0), true);
    combatActions[1] = _productionCombatAction(ACTION_COMBAT_GROG_TOAD, 120, CombatStats(3, 0, 0, 50, 3, 0, 0), false);
    worldActions.addActions(combatActions);
    worldActions.addActionChoices(NONE, _uint16s(MELEE_CHOICE), _choices(_defaultChoice(Skill.MELEE)));

    ItemInput[] memory items = new ItemInput[](2);
    items[0] = _item(BRONZE_SWORD, EquipPosition.RIGHT_HAND);
    items[0].combatStats = CombatStats(5, 0, 0, 0, 0, 0, 0);
    items[1] = _food(COOKED_BLEKK, 2);
    itemNFT.addItems(items);
    itemNFT.mintBatch(ALICE, _uints(BRONZE_SWORD, COOKED_BLEKK), _uints(1, 10_000));

    natuow = _combatQueue(ACTION_COMBAT_NATUOW, MELEE_CHOICE, COOKED_BLEKK, BRONZE_SWORD);
    natuow.timespan = 86400;
    grog = _combatQueue(ACTION_COMBAT_GROG_TOAD, MELEE_CHOICE, COOKED_BLEKK, BRONZE_SWORD);
    grog.timespan = 32400;
    grog.combatStyle = uint8(CombatStyle.DEFENCE);
  }

  function _productionCombatAction(
    uint16 actionId,
    uint24 xpPerHour,
    CombatStats memory stats,
    bool isNatuow
  ) private pure returns (ActionInput memory action) {
    action.actionId = actionId;
    action.info = _actionInfo(Skill.COMBAT, xpPerHour, true);
    action.info.handItemTokenIdRangeMin = 2048;
    action.info.numSpawned = uint24(100 * SPAWN_MUL);
    action.combatStats = stats;
    action.guaranteedRewards = new GuaranteedReward[](isNatuow ? 2 : 1);
    action.guaranteedRewards[0] = GuaranteedReward(SMALL_BONE, 10);
    if (isNatuow) {
      action.guaranteedRewards[1] = GuaranteedReward(NATUOW_HIDE, 10);
    } else {
      action.randomRewards = new RandomReward[](2);
      action.randomRewards[0] = RandomReward(POISON, 6640, 1);
      action.randomRewards[1] = RandomReward(FLIXORA, 1200, 1);
    }
  }

  function _activateAnyXPBoost() private {
    itemNFT.addItems(_items(_boostItem(XP_BOOST, EquipPosition.BOOST_VIAL, BoostType.ANY_XP, 10)));
    itemNFT.mint(ALICE, XP_BOOST, 1);
    vm.warp(vm.getBlockTimestamp() + 120);
    vm.prank(ALICE);
    players.startActionsAdvanced(
      playerId,
      new QueuedActionInput[](0),
      XP_BOOST,
      BOOST_START_NOW,
      0,
      0,
      ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
    );
  }

  function _boostItem(
    uint16 tokenId,
    EquipPosition position,
    BoostType boostType,
    uint16 value
  ) private pure returns (ItemInput memory item) {
    item = _item(tokenId, position);
    item.boostType = boostType;
    item.boostValue = value;
    item.boostDuration = 86400;
    item.isTransferable = false;
  }

  function _addSupplyRunQuests(uint256 count) private {
    QuestInput[] memory questInputs = new QuestInput[](count);
    Skill[5] memory rewards = [Skill.DEFENCE, Skill.MELEE, Skill.MAGIC, Skill.WOODCUTTING, Skill.HEALTH];
    for (uint16 i; i < count; ++i) {
      QuestInput memory quest;
      quest.questId = QUEST_SUPPLY_RUN + i;
      quest.actionId1 = ACTION_COMBAT_NATUOW;
      quest.actionNum1 = 5;
      quest.skillReward = rewards[i];
      quest.skillXPGained = 250;
      quest.rewardItemTokenId1 = NATUOW_LEATHER;
      quest.rewardAmount1 = 100;
      quest.burnItemTokenId = NATUOW_HIDE;
      quest.burnAmount = 5;
      questInputs[i] = quest;
    }
    Quests.MinimumRequirement[3][] memory requirements = new Quests.MinimumRequirement[3][](count);
    quests.addQuests(questInputs, requirements);
  }

  function _assertProcessedPlayer(uint24 meleeXP, uint24 healthXP) private view {
    Player memory player = IPlayersMisc1DelegateView(address(players)).getPlayer(playerId);
    assertEq(uint8(player.currentActionProcessedSkill1), uint8(Skill.MELEE));
    assertEq(player.currentActionProcessedXPGained1, meleeXP);
    assertEq(uint8(player.currentActionProcessedSkill2), uint8(Skill.HEALTH));
    assertEq(player.currentActionProcessedXPGained2, healthXP);
    assertEq(uint8(player.currentActionProcessedSkill3), uint8(Skill.DEFENCE));
    assertEq(player.currentActionProcessedXPGained3, 250);
    assertEq(player.currentActionProcessedFoodConsumed, 1257);
    assertEq(player.currentActionProcessedBaseInputItemsConsumedNum, 0);
  }

  function _testFoodCap(bool healing, bool split) private {
    (QueuedActionInput memory action, , ) = _setupMelee();
    if (healing) players.setAlphaCombatParams(1, 1, 8);
    _addCombatAction(
      2,
      uint24(100 * SPAWN_MUL),
      CombatStats(15000, 0, 0, 5, 0, 0, 0),
      BRONZE_ARROW,
      uint16(GUAR_MUL),
      false
    );
    action.actionId = 2;
    itemNFT.mint(ALICE, COOKED_MINNUS, 70_000);
    uint256 initialFood = itemNFT.balanceOf(ALICE, COOKED_MINNUS);
    _start(playerId, action);
    if (split) {
      uint256 previous = initialFood;
      for (uint256 i; i < 36; ++i) {
        vm.warp(vm.getBlockTimestamp() + action.timespan / 36);
        _process(playerId);
        uint256 current = itemNFT.balanceOf(ALICE, COOKED_MINNUS);
        assertTrue(previous > current || current == initialFood - type(uint16).max);
        previous = current;
      }
    } else {
      vm.warp(vm.getBlockTimestamp() + action.timespan);
      _process(playerId);
    }
    assertEq(players.getPlayerXP(playerId, Skill.MELEE), healing ? 2520 : 2484);
    if (!healing) assertEq(players.getPlayerXP(playerId, Skill.DEFENCE), 0);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), healing ? 70 : 69);
    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), initialFood - type(uint16).max);
  }

  function _requestAndFulfill() private {
    _mineNextBlock();
    uint256 requestId = randomnessBeacon.requestRandomWords();
    _mineNextBlock();
    mockVRF.fulfill(requestId, address(randomnessBeacon));
  }

  function _requestAndFulfillSeeded(uint256 seed) private {
    _mineNextBlock();
    uint256 requestId = randomnessBeacon.requestRandomWords();
    _mineNextBlock();
    mockVRF.fulfillSeeded(requestId, address(randomnessBeacon), seed);
  }

  function _mineNextBlock() private {
    vm.warp(vm.getBlockTimestamp() + 1);
    vm.roll(block.number + 1);
  }

  function _items(ItemInput memory item) private pure returns (ItemInput[] memory items) {
    items = new ItemInput[](1);
    items[0] = item;
  }
}
