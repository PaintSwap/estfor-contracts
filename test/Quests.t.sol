// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IOwnable} from "../contracts/interfaces/IOwnable.sol";

import {FullGameStack} from "./utils/FullGameStack.sol";
import {IQuests} from "../contracts/interfaces/IQuests.sol";
import {QUEST_PURSE_STRINGS} from "../contracts/globals/quests.sol";
import {QuestInput, Quest, PlayerQuest} from "../contracts/globals/quests.sol";
import {ActionInput, ActionInfo, ActionQueueStrategy, QueuedActionInput} from "../contracts/globals/actions.sol";
import {ActionChoiceInput, ItemInput, EquipPosition, PendingQueuedActionState} from "../contracts/globals/players.sol";
import {GuaranteedReward, RandomReward, XPThresholdReward} from "../contracts/globals/rewards.sol";
import {Skill, CombatStyle, CombatStats, Equipment} from "../contracts/globals/misc.sol";
import {IPlayersImplMisc1 as IPlayersMisc1DelegateView} from "../contracts/interfaces/IPlayersImplMisc1.sol";
import {NONE, SKILL_BOOST} from "../contracts/globals/items.sol";

contract QuestsTest is FullGameStack {
  // Item token ids (mirror @paintswap/estfor-definitions/constants)
  uint16 internal constant BRONZE_SWORD = 2048; // COMBAT_BASE
  uint16 internal constant BRONZE_HELMET = 1; // HEAD_BASE
  uint16 internal constant NET_STICK = 3072; // FISHING_BASE
  uint16 internal constant MAGIC_FIRE_STARTER = 3328; // FIRE_BASE
  uint16 internal constant BRONZE_AXE = 2816; // WOODCUTTING_BASE
  uint16 internal constant LOG = 10_496;
  uint16 internal constant OAK_LOG = 10_497;
  uint16 internal constant RAW_MINNUS = 10_752;
  uint16 internal constant COOKED_MINNUS = 11_008;
  uint16 internal constant BRONZE_BAR = 10_240;
  uint16 internal constant RUBY = 11_527;
  uint16 internal constant EMERALD = 11_525;
  uint16 internal constant BRONZE_ARROW = 11_776;
  uint16 internal constant BRONZE_ARROW_HEAD = 65_493;
  uint16 internal constant ARROW_SHAFT = 65_494;
  uint16 internal constant FEATHER = 65_515;
  uint16 internal constant POISON = 65_525;
  uint16 internal constant NATUOW_LEATHER = 65_532;
  uint16 internal constant NATUOW_HIDE = 65_533;

  // Quest ids
  uint16 internal constant QUEST_SUPPLY_RUN = 3;
  uint16 internal constant QUEST_HIDDEN_BOUNTY = 4;
  uint16 internal constant QUEST_ALMS_POOR = 6;
  uint16 internal constant QUEST_TWO_BIRDS = 8;
  uint16 internal constant QUEST_TOWN_COOKOUT = 10;
  uint16 internal constant QUEST_SO_FLETCH = 17;

  // Action ids
  uint16 internal constant ACTION_WOODCUTTING_LOG = 1;
  uint16 internal constant ACTION_FISHING_MINNUS = 1500;
  uint16 internal constant ACTION_FIREMAKING_ITEM = 1000;
  uint16 internal constant ACTION_THIEVING_MAN = 2501;
  uint16 internal constant ACTION_COMBAT_NATUOW = 2000;

  uint256 internal constant GUAR_MUL = 10;
  uint256 internal constant RATE_MUL = 1000;
  uint256 internal constant SPAWN_MUL = 1000;
  uint256 internal constant START_XP = 374;
  uint256 internal constant NO_DONATION_AMOUNT = 0;
  // 90%, used for actions/actionChoices which can have a failure rate like thieving/cooking
  uint256 internal constant MAX_SUCCESS_PERCENT_CHANCE = 90;

  uint256 internal rateFiremaking;
  QueuedActionInput internal firemakingQueuedAction;
  QuestInput internal firemakingQuest;
  QuestInput internal firemakingQuestLog;

  function setUp() public {
    deployFullGame();
    vm.deal(address(this), 1000 ether);
    vm.deal(ALICE, 1000 ether);
    _setupBasicFiremaking(0);
    firemakingQuest = QuestInput({
      dependentQuestId: 0,
      actionId1: 0,
      actionNum1: 0,
      actionId2: 0,
      actionNum2: 0,
      actionChoiceId: 1,
      actionChoiceNum: 100,
      skillReward: Skill.NONE,
      skillXPGained: 0,
      rewardItemTokenId1: OAK_LOG,
      rewardAmount1: 5,
      rewardItemTokenId2: NONE,
      rewardAmount2: 0,
      burnItemTokenId: NONE,
      burnAmount: 0,
      questId: 1,
      isFullModeOnly: false,
      worldLocation: 0
    });
    firemakingQuestLog = QuestInput({
      dependentQuestId: 0,
      actionId1: 0,
      actionNum1: 0,
      actionId2: 0,
      actionNum2: 0,
      actionChoiceId: 1,
      actionChoiceNum: 100,
      skillReward: Skill.NONE,
      skillXPGained: 0,
      rewardItemTokenId1: LOG,
      rewardAmount1: 10,
      rewardItemTokenId2: NONE,
      rewardAmount2: 0,
      burnItemTokenId: NONE,
      burnAmount: 0,
      questId: 2,
      isFullModeOnly: false,
      worldLocation: 0
    });
  }

  function testShouldAddAQuestCorrectly() public {
    _addQuests(_quests(firemakingQuest));
    Quest memory quest = quests.allFixedQuests(1);
    assertEq(quest.rewardItemTokenId1, firemakingQuest.rewardItemTokenId1);
    assertEq(quest.rewardAmount1, firemakingQuest.rewardAmount1);
  }

  function testShouldFailToAddSameQuestTwice() public {
    _addQuests(_quests(firemakingQuest));
    vm.expectRevert(IQuests.QuestWithIdAlreadyExists.selector);
    _addQuests(_quests(firemakingQuest));
  }

  function testShouldFailToAddAQuestForNonOwner() public {
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    _addQuests(_quests(firemakingQuest));
  }

  function testShouldAddMultipleQuestsCorrectly() public {
    QuestInput[] memory questsToAdd = _quests(firemakingQuest, firemakingQuestLog);
    quests.addQuests(questsToAdd, _minRequirements(2));
    assertEq(quests.allFixedQuests(1).rewardItemTokenId1, firemakingQuest.rewardItemTokenId1);
    assertEq(quests.allFixedQuests(2).rewardItemTokenId1, firemakingQuestLog.rewardItemTokenId1);
  }

  function testShouldFailToAddSameQuestTwiceUsingBatch() public {
    QuestInput[] memory questsToAdd = _quests(firemakingQuest, firemakingQuest);
    vm.expectRevert(IQuests.QuestWithIdAlreadyExists.selector);
    quests.addQuests(questsToAdd, _minRequirements(2));
  }

  function testShouldFailToAddMultipleQuestsForNonOwner() public {
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    _addQuests(_quests(firemakingQuest));
  }

  function testShouldRemoveAQuestCorrectly() public {
    _addQuests(_quests(firemakingQuest));
    vm.expectEmit(true, true, true, true, address(quests));
    emit IQuests.RemoveQuest(1);
    quests.removeQuest(1);
    vm.expectRevert(IQuests.QuestDoesntExist.selector);
    quests.removeQuest(2);
  }

  function testShouldFailToRemoveAQuestForNonOwner() public {
    _addQuests(_quests(firemakingQuest));
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    quests.removeQuest(1);
  }

  function testShouldFailToRemoveANonExistingQuest() public {
    vm.expectRevert(IQuests.QuestDoesntExist.selector);
    quests.removeQuest(2);
  }

  function testShouldEditAQuestCorrectly() public {
    _addQuests(_quests(firemakingQuest));
    firemakingQuest.actionChoiceNum = 23;
    quests.editQuests(_quests(firemakingQuest), _minRequirements(1));
    assertEq(quests.allFixedQuests(1).actionChoiceNum, 23);
  }

  function testShouldFailToEditAQuestForNonOwner() public {
    _addQuests(_quests(firemakingQuest));
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    quests.editQuests(_quests(firemakingQuest), _minRequirements(1));
  }

  function testShouldFailToEditANonExistingQuest() public {
    _addQuests(_quests(firemakingQuest));
    firemakingQuest.questId = 100;
    firemakingQuest.actionChoiceNum = 23;
    vm.expectRevert(IQuests.QuestDoesntExist.selector);
    quests.editQuests(_quests(firemakingQuest), _minRequirements(1));
  }

  function testLoweringAmountsWhereAmountCompletedIsAlreadyAboveShouldNotCauseUnderflowsActionNum1() public {
    (QueuedActionInput memory queuedActionWoodcutting, uint256 rate, ) = _setupBasicWoodcutting(100 * GUAR_MUL);
    QuestInput memory quest = _defaultQuest(1);
    quest.actionId1 = ACTION_WOODCUTTING_LOG;
    quest.actionNum1 = uint16(rate / GUAR_MUL);
    _addQuests(_quests(quest));
    vm.prank(ALICE);
    players.activateQuest(playerId, 1);

    vm.startPrank(ALICE);
    players.startActions(playerId, _queuedActions(queuedActionWoodcutting), ActionQueueStrategy.OVERWRITE);
    vm.stopPrank();
    vm.warp(vm.getBlockTimestamp() + 1800);
    vm.prank(ALICE);
    players.processActions(playerId);

    quest.actionNum1 = uint16(rate / (GUAR_MUL * 4));
    quests.editQuests(_quests(quest), _minRequirements(1));
    vm.warp(vm.getBlockTimestamp() + 1800); // Finish
    PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.questsCompleted.length, 1);

    vm.prank(ALICE);
    players.processActions(playerId);
  }

  function testQuestNotActivated() public {
    _addQuests(_quests(_purseStringsQuest()));
    vm.prank(ALICE);
    vm.expectRevert(IQuests.InvalidActiveQuest.selector);
    players.buyBrushQuest{value: 10}(ALICE, playerId, 0, true);
  }

  function testTryingToBuyWithNoFTM() public {
    _addQuests(_quests(_purseStringsQuest()));
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_PURSE_STRINGS);
    vm.prank(ALICE);
    vm.expectRevert(IQuests.InvalidFTMAmount.selector);
    players.buyBrushQuest{value: 0}(ALICE, playerId, 0, true);
  }

  function testQuestCompleted() public {
    QuestInput memory quest = _purseStringsQuest();
    _addQuests(_quests(quest));
    assertTrue(quest.questId != 0);
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_PURSE_STRINGS);
    assertEq(quests.activeQuests(playerId).questId, QUEST_PURSE_STRINGS);
    uint256 balanceBefore = brush.balanceOf(ALICE);
    vm.prank(ALICE);
    players.buyBrushQuest{value: 10}(ALICE, playerId, 0, true);
    assertEq(brush.balanceOf(ALICE), balanceBefore + 1);

    // Check it's completed and no longer considered active
    assertTrue(quests.isQuestCompleted(playerId, QUEST_PURSE_STRINGS));
    assertEq(quests.activeQuests(playerId).questId, 0);

    // Check the rewards are as expected
    assertEq(quest.rewardItemTokenId1, 0);
    assertTrue(quest.skillXPGained != 0);
    assertEq(players.getPlayerXP(playerId, quest.skillReward), quest.skillXPGained);
  }

  function testCheckThatQuestIsNotCompletedAfterAnAction() public {
    _addQuests(_quests(_purseStringsQuest()));
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_PURSE_STRINGS);
    // Check that this is not marked as completed automatically
    (QueuedActionInput memory queuedAction, , ) = _setupBasicWoodcutting(100 * GUAR_MUL);
    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);
    vm.warp(vm.getBlockTimestamp() + queuedAction.timespan + 2);
    PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.questsCompleted.length, 0);
  }

  function testBuyingBrushUseExactEth() public {
    _addQuests(_quests(_purseStringsQuest()));
    uint256 balanceBefore = brush.balanceOf(ALICE);
    vm.prank(ALICE);
    quests.buyBrush{value: 10}(ALICE, 0, true);
    assertEq(brush.balanceOf(ALICE), balanceBefore + 1);
  }

  function testBuyingBrushUseExactBrushOutput() public {
    _addQuests(_quests(_purseStringsQuest()));
    uint256 balanceBefore = brush.balanceOf(ALICE);
    vm.prank(ALICE);
    quests.buyBrush{value: 10}(ALICE, 1, false);
    assertEq(brush.balanceOf(ALICE), balanceBefore + 1);
  }

  function testSellingBrushUseExactBrush() public {
    _addQuests(_quests(_purseStringsQuest()));
    uint256 balanceBefore = brush.balanceOf(ALICE);
    vm.prank(ALICE);
    quests.buyBrush{value: 10}(ALICE, 0, true);
    uint256 balanceAfter = brush.balanceOf(ALICE);
    vm.prank(ALICE);
    brush.approve(address(quests), balanceAfter);
    assertEq(balanceAfter, balanceBefore + 1);
    vm.prank(ALICE);
    quests.sellBrush(ALICE, balanceAfter, 0, false);
    assertEq(brush.balanceOf(ALICE), 0);
  }

  function testSellingBrushUseExactEthOutput() public {
    _addQuests(_quests(_purseStringsQuest()));
    uint256 balanceBefore = brush.balanceOf(ALICE);
    vm.prank(ALICE);
    quests.buyBrush{value: 10}(ALICE, 0, true);
    uint256 balanceAfter = brush.balanceOf(ALICE);
    vm.prank(ALICE);
    brush.approve(address(quests), balanceAfter);
    assertEq(balanceAfter, balanceBefore + 1);
    vm.prank(ALICE);
    quests.sellBrush(ALICE, balanceAfter, 1, true);
    assertEq(brush.balanceOf(ALICE), 0);
  }

  function test1MinimumRequirement() public {
    QuestInput memory quest = _purseStringsQuest();
    IQuests.MinimumRequirement[3][] memory reqs = new IQuests.MinimumRequirement[3][](1);
    reqs[0][0] = IQuests.MinimumRequirement(Skill.HEALTH, 3000);
    quests.addQuests(_quests(quest), reqs);
    vm.prank(ALICE);
    vm.expectRevert(IQuests.InvalidMinimumRequirement.selector);
    players.activateQuest(playerId, QUEST_PURSE_STRINGS);

    vm.prank(ALICE);
    players.modifyXP(ALICE, playerId, Skill.HEALTH, 2999, true);
    vm.prank(ALICE);
    vm.expectRevert(IQuests.InvalidMinimumRequirement.selector);
    players.activateQuest(playerId, QUEST_PURSE_STRINGS);
    vm.prank(ALICE);
    players.modifyXP(ALICE, playerId, Skill.HEALTH, 3000, true);
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_PURSE_STRINGS);
  }

  function testCookedFoodGivingAwayQuest() public {
    (QueuedActionInput memory queuedAction, uint256 rate, uint16 choiceId) = _setupBasicCooking(100, 1);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);

    // Activate a quest
    QuestInput memory quest = _almsPoorQuest();
    quest.actionChoiceId = choiceId;
    quest.actionChoiceNum = 5;
    quest.burnItemTokenId = COOKED_MINNUS;
    quest.burnAmount = 5;
    _addQuests(_quests(quest));
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_ALMS_POOR);
    vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
    vm.prank(ALICE);
    players.processActions(playerId);

    // Check it's completed
    assertTrue(quests.isQuestCompleted(playerId, QUEST_ALMS_POOR));
    assertEq(
      itemNFT.balanceOf(ALICE, COOKED_MINNUS),
      (queuedAction.timespan * rate) / (3600 * RATE_MUL) - quest.actionChoiceNum
    );
    assertEq(itemNFT.balanceOf(ALICE, RAW_MINNUS), 1000 - (queuedAction.timespan * rate) / (3600 * RATE_MUL));
  }

  function testCookedFoodGivingAwayQuestCheckBurnCanHappenBeforeQuestCompleted() public {
    (QueuedActionInput memory queuedAction, uint256 rate, uint16 choiceId) = _setupBasicCooking(100, 1);
    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);

    // Activate a quest
    QuestInput memory quest = _almsPoorQuest();
    quest.actionChoiceId = choiceId;
    quest.actionChoiceNum = 5;
    quest.burnItemTokenId = COOKED_MINNUS;
    quest.burnAmount = 5;
    _addQuests(_quests(quest));
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_ALMS_POOR);
    // Process immediately
    uint256 initialMintNum = 10;
    vm.prank(ALICE);
    itemNFT.mintBatch(ALICE, _uints(COOKED_MINNUS), _uints(initialMintNum));
    PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.rewardItemTokenIds.length, 0);
    assertEq(state.quests.consumedItemTokenIds.length, 0);
    vm.prank(ALICE);
    players.processActions(playerId);

    // Should not be completed, but the cooked items can be burned
    assertFalse(quests.isQuestCompleted(playerId, QUEST_ALMS_POOR));

    assertEq(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 10);
    assertEq(itemNFT.balanceOf(ALICE, RAW_MINNUS), 1000);

    // rate is 100 an hour. So 1 would be done in 36 seconds
    vm.warp(vm.getBlockTimestamp() + 36);
    state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.rewardItemTokenIds.length, 0);
    assertEq(state.quests.consumedItemTokenIds.length, 1);
    assertEq(state.quests.consumedItemTokenIds[0], COOKED_MINNUS);
    assertEq(state.quests.consumedAmounts[0], 1);
    // Finish it
    vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
    state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.rewardItemTokenIds.length, 1);
    assertEq(state.quests.rewardItemTokenIds.length, state.quests.rewardAmounts.length);
    assertEq(state.quests.rewardItemTokenIds[0], SKILL_BOOST);
    assertEq(state.quests.rewardAmounts[0], 3);
    assertEq(state.quests.consumedItemTokenIds.length, 1);
    assertEq(state.quests.consumedAmounts.length, 1);
    assertEq(state.quests.consumedItemTokenIds[0], COOKED_MINNUS);
    assertEq(state.quests.consumedAmounts[0], 5);
    vm.prank(ALICE);
    players.processActions(playerId);
    assertTrue(quests.isQuestCompleted(playerId, QUEST_ALMS_POOR));
    assertEq(
      itemNFT.balanceOf(ALICE, COOKED_MINNUS),
      ((queuedAction.timespan * rate) / (3600 * RATE_MUL) - quest.actionChoiceNum) + initialMintNum
    );
    assertEq(itemNFT.balanceOf(ALICE, RAW_MINNUS), 1000 - (queuedAction.timespan * rate) / (3600 * RATE_MUL));
  }

  function testCookedFoodGivingAwayQuestCheckCombatConsumingTheCookedFoodBeforeQuestCompleted() public {
    (QueuedActionInput memory queuedActionCooking, , uint16 choiceId) = _setupBasicCooking(100, 1);
    queuedActionCooking.timespan = 100;

    // Combat action that consumes cooked food (regenerate)
    (QueuedActionInput memory queuedActionMelee, ) = _addCombatAction(
      2,
      100 * SPAWN_MUL,
      CombatStats(100, 0, 0, 1000, 0, 0, 0),
      2,
      COOKED_MINNUS
    );

    vm.startPrank(ALICE);
    players.startActions(
      playerId,
      _queuedActions(queuedActionCooking, queuedActionMelee),
      ActionQueueStrategy.OVERWRITE
    );
    vm.stopPrank();

    // Activate a quest
    QuestInput memory quest = _almsPoorQuest();
    quest.actionChoiceId = choiceId;
    quest.actionChoiceNum = 5;
    quest.burnItemTokenId = COOKED_MINNUS;
    quest.burnAmount = 5;
    _addQuests(_quests(quest));
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_ALMS_POOR);

    // rate is 100 an hour. So 1 would be done in 36 seconds
    vm.warp(vm.getBlockTimestamp() + queuedActionCooking.timespan + queuedActionMelee.timespan);
    PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
    // Check died in the second one
    assertEq(state.equipmentStates.length, 2);
    assertEq(state.actionMetadatas.length, 2);
    assertTrue(state.actionMetadatas[1].died);
    assertEq(state.equipmentStates[0].consumedAmounts.length, 1);
    assertEq(state.equipmentStates[0].consumedAmounts[0], 2);
    assertEq(state.quests.rewardItemTokenIds.length, 0); // Quest not completed
    assertEq(state.quests.consumedItemTokenIds.length, 0); // No fish consumed as all used up in combat
    vm.prank(ALICE);
    players.processActions(playerId);
    assertFalse(quests.isQuestCompleted(playerId, QUEST_ALMS_POOR));

    // Queue more cooking
    queuedActionCooking.timespan = 3600;
    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedActionCooking), ActionQueueStrategy.OVERWRITE);
    vm.warp(vm.getBlockTimestamp() + queuedActionCooking.timespan);
    vm.prank(ALICE);
    players.processActions(playerId);
    assertTrue(quests.isQuestCompleted(playerId, QUEST_ALMS_POOR));
  }

  function testThievingQuest() public {
    // Thieving action
    ActionInput[] memory actions = new ActionInput[](1);
    actions[0].actionId = 2;
    actions[0].info = _actionInfo(Skill.THIEVING, 2, 0, false, NONE, NONE);
    worldActions.addActions(actions);

    uint256 numHours = 24;
    QueuedActionInput memory queuedAction = _queuedAction(2, 0, 0, uint24(3600 * numHours), CombatStyle.NONE);

    // Activate a quest
    QuestInput memory quest1 = _hiddenBountyQuest();
    QuestInput memory quest = quest1;
    quest.actionId1 = 2;
    _addQuests(_quests(quest));
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_HIDDEN_BOUNTY);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);
    vm.warp(vm.getBlockTimestamp() + (quest1.actionNum1 / 2) * 3600);
    PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.rewardItemTokenIds.length, 0);
    assertEq(state.quests.activeQuestInfo.length, 1);
    assertEq(state.quests.activeQuestInfo[0].actionCompletedNum1, quest1.actionNum1 / 2);
    vm.prank(ALICE);
    players.processActions(playerId);
    vm.warp(vm.getBlockTimestamp() + (quest1.actionNum1 / 2) * 3600);
    state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.rewardItemTokenIds.length, 2);
    assertEq(state.quests.rewardItemTokenIds.length, state.quests.rewardAmounts.length);
    assertEq(state.quests.rewardItemTokenIds[0], RUBY);
    assertEq(state.quests.rewardAmounts[0], 1);
    assertEq(state.quests.rewardItemTokenIds[1], EMERALD);
    assertEq(state.quests.rewardAmounts[1], 1);
    assertEq(state.quests.skills.length, 1);
    assertEq(state.quests.xpGainedSkills.length, 1);
    assertEq(uint8(state.quests.skills[0]), uint8(quest1.skillReward));
    assertEq(state.quests.xpGainedSkills[0], quest1.skillXPGained);
    vm.prank(ALICE);
    players.processActions(playerId);
    assertTrue(quests.isQuestCompleted(playerId, QUEST_HIDDEN_BOUNTY));
    assertEq(itemNFT.balanceOf(ALICE, RUBY), 1);
    assertEq(itemNFT.balanceOf(ALICE, EMERALD), 1);
  }

  function testMonstersKilled() public {
    (QueuedActionInput memory queuedAction, uint256 rate, uint256 numSpawned) = _setupBasicMeleeCombat();

    // Activate a quest
    QuestInput memory quest1 = _supplyRunQuest();
    QuestInput memory quest = quest1;
    quest.actionId1 = queuedAction.actionId;
    quest.actionNum1 = 5;
    quest.burnItemTokenId = BRONZE_ARROW;
    quest.burnAmount = 5;
    _addQuests(_quests(quest));
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_SUPPLY_RUN);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);

    // Kill 1
    uint256 time = (3600 * SPAWN_MUL) / numSpawned;
    vm.warp(vm.getBlockTimestamp() + time);
    PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.rewardItemTokenIds.length, 0);
    assertEq(state.quests.consumedItemTokenIds.length, 1); // Burn 1 of them
    assertEq(state.quests.consumedItemTokenIds[0], BRONZE_ARROW);
    assertEq(state.quests.consumedAmounts[0], 1);
    assertEq(state.quests.activeQuestInfo.length, 1);
    assertEq(state.quests.activeQuestInfo[0].actionCompletedNum1, 1);

    vm.prank(ALICE);
    players.processActions(playerId);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 0); // All are burned

    // Kill the rest
    vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
    state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.equipmentStates[0].producedItemTokenIds.length, 1);
    assertEq(state.equipmentStates[0].producedAmounts.length, 1);
    assertEq(state.equipmentStates[0].producedAmounts[0], 9);
    assertEq(state.quests.consumedItemTokenIds.length, 1);
    assertEq(state.quests.consumedItemTokenIds[0], BRONZE_ARROW);
    assertEq(state.quests.consumedAmounts[0], 4);
    assertEq(state.quests.rewardItemTokenIds.length, 1);
    assertEq(state.quests.rewardItemTokenIds[0], NATUOW_LEATHER);
    assertEq(state.quests.rewardAmounts.length, 1);
    assertEq(state.quests.rewardAmounts[0], 100);
    assertEq(state.quests.skills.length, 1);
    assertEq(state.quests.xpGainedSkills.length, 1);
    assertEq(uint8(state.quests.skills[0]), uint8(quest1.skillReward));
    assertEq(state.quests.xpGainedSkills[0], quest1.skillXPGained);
    vm.prank(ALICE);
    players.processActions(playerId);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), (rate * numSpawned) / (10 * SPAWN_MUL) - 5);
  }

  function testFishingQuestWhereFishGetBurntAndThereIsCookingInBetween() public {
    (QueuedActionInput memory queuedActionFishing, uint256 rateFishing, ) = _setupBasicFishing();
    (QueuedActionInput memory queuedActionCooking, , ) = _setupBasicCooking(100, 1);

    QuestInput memory quest1 = _townCookoutQuest();
    QuestInput memory quest = quest1;
    quest.actionId1 = queuedActionFishing.actionId;
    quest.actionNum1 = uint16((rateFishing * 2) / GUAR_MUL);
    quest.burnItemTokenId = RAW_MINNUS;
    quest.burnAmount = uint16((rateFishing * 2) / GUAR_MUL);

    _addQuests(_quests(quest));
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_TOWN_COOKOUT);

    vm.startPrank(ALICE);
    itemNFT.burn(ALICE, RAW_MINNUS, itemNFT.balanceOf(ALICE, RAW_MINNUS));
    players.startActions(
      playerId,
      _queuedActions(queuedActionFishing, queuedActionCooking, queuedActionFishing),
      ActionQueueStrategy.OVERWRITE
    );
    vm.stopPrank();
    vm.warp(vm.getBlockTimestamp() + 24 * 3600);
    vm.prank(ALICE);
    players.processActions(playerId);

    // Check quest progress
    PlayerQuest memory activeQuest = quests.activeQuests(playerId);
    assertEq(activeQuest.actionCompletedNum1, rateFishing / GUAR_MUL);
    assertEq(activeQuest.burnCompletedAmount, rateFishing / GUAR_MUL);
  }

  function testDependentQuest() public {
    (QueuedActionInput memory queuedAction, , ) = _setupBasicMeleeCombat();

    // Activate a quest
    QuestInput memory quest = _supplyRunQuest();
    quest.actionId1 = queuedAction.actionId;
    quest.actionNum1 = 5;
    quest.burnItemTokenId = BRONZE_ARROW;
    quest.burnAmount = 5;

    QuestInput memory anotherQuest = _supplyRunQuest();
    anotherQuest.actionId1 = queuedAction.actionId;
    anotherQuest.actionNum1 = 5;
    anotherQuest.burnItemTokenId = BRONZE_ARROW;
    anotherQuest.burnAmount = 5;
    anotherQuest.questId = QUEST_TWO_BIRDS;
    anotherQuest.dependentQuestId = QUEST_SUPPLY_RUN;
    quests.addQuests(_quests(quest, anotherQuest), _minRequirements(2));

    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IQuests.DependentQuestNotCompleted.selector, QUEST_SUPPLY_RUN));
    players.activateQuest(playerId, QUEST_TWO_BIRDS);

    // Complete it
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_SUPPLY_RUN);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);
    vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
    vm.prank(ALICE);
    players.processActions(playerId);

    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_TWO_BIRDS);
  }

  function testActionChoiceQuest() public {
    _addQuests(_quests(firemakingQuest));
    vm.prank(ALICE);
    players.activateQuest(playerId, 1);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(firemakingQueuedAction), ActionQueueStrategy.OVERWRITE);
    vm.warp(vm.getBlockTimestamp() + 1);

    PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.rewardItemTokenIds.length, 0);

    uint256 timeNeeded = ((rateFiremaking / RATE_MUL) * 3600) / firemakingQuest.actionChoiceNum;

    // Set time to just before, should still not have quest rewards
    vm.warp(vm.getBlockTimestamp() + timeNeeded - 3);
    state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.rewardItemTokenIds.length, 0);
    // Amount burnt should be over
    vm.warp(vm.getBlockTimestamp() + 3);
    state = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(state.quests.rewardItemTokenIds.length, 1);
    assertEq(state.quests.rewardAmounts[0], firemakingQuest.rewardAmount1);
    assertEq(state.quests.rewardItemTokenIds[0], firemakingQuest.rewardItemTokenId1);
    assertEq(state.xpRewardItemTokenIds.length, 0);
    assertEq(state.xpRewardAmounts.length, 0);

    vm.prank(ALICE);
    players.processActions(playerId);

    assertEq(itemNFT.balanceOf(ALICE, firemakingQuest.rewardItemTokenId1), firemakingQuest.rewardAmount1);
    assertTrue(firemakingQuest.rewardAmount1 > 0); // sanity check
  }

  function testXPGained() public {
    (QueuedActionInput memory queuedAction, , uint16 choiceId) = _setupBasicCooking(100, 1);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);

    // Activate a quest
    QuestInput memory quest = _almsPoorQuest();
    quest.actionChoiceId = choiceId;
    quest.actionChoiceNum = 5;
    quest.burnItemTokenId = COOKED_MINNUS;
    quest.burnAmount = 5;
    quest.skillReward = Skill.WOODCUTTING;
    quest.skillXPGained = 10_000;
    _addQuests(_quests(quest));
    vm.prank(ALICE);
    players.activateQuest(playerId, QUEST_ALMS_POOR);
    vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);

    // Check XP threshold rewards are given
    Equipment[] memory rewards = new Equipment[](1);
    rewards[0] = Equipment(BRONZE_BAR, 3);
    XPThresholdReward[] memory xpThresholdRewards = new XPThresholdReward[](1);
    xpThresholdRewards[0] = XPThresholdReward({xpThreshold: 10_000, rewards: rewards});
    players.addXPThresholdRewards(xpThresholdRewards);

    vm.prank(ALICE);
    players.processActions(playerId);
    uint256 cookingXP = players.getPlayerXP(playerId, Skill.COOKING);
    assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 10_000);
    assertEq(_playersView().getPlayer(playerId).totalXP, START_XP + cookingXP + 10_000);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 3);
  }

  function testShouldActivateAQuestForPlayerCorrectly() public {
    _addQuests(_quests(firemakingQuestLog));
    vm.prank(ALICE);
    players.activateQuest(playerId, 2);
    assertEq(quests.activeQuests(playerId).questId, 2);
  }

  function testShouldFailToActivateAQuestForNonOwnerOfPlayer() public {
    _addQuests(_quests(firemakingQuestLog));
    vm.expectRevert(IQuests.NotOwnerOfPlayerAndActive.selector);
    players.activateQuest(playerId, 2);
  }

  function testShouldFailToActivateANonExistingQuest() public {
    _addQuests(_quests(firemakingQuestLog));
    vm.prank(ALICE);
    vm.expectRevert(IQuests.QuestDoesntExist.selector);
    players.activateQuest(playerId, 3);
  }

  function testShouldFailToReactivateACompletedQuest() public {
    _addQuests(_quests(firemakingQuest));
    vm.prank(ALICE);
    players.activateQuest(playerId, firemakingQuest.questId);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(firemakingQueuedAction), ActionQueueStrategy.OVERWRITE);
    uint256 timeNeeded = ((rateFiremaking / 10) * 3600) / firemakingQuest.actionChoiceNum;

    vm.warp(vm.getBlockTimestamp() + timeNeeded);
    vm.prank(ALICE);
    players.processActions(playerId);

    assertEq(itemNFT.balanceOf(ALICE, firemakingQuest.rewardItemTokenId1), firemakingQuest.rewardAmount1);

    // Check it's completed
    assertTrue(quests.isQuestCompleted(playerId, firemakingQuest.questId));
    assertEq(quests.activeQuests(playerId).questId, 0);
    // Check it can't be activated again
    vm.prank(ALICE);
    vm.expectRevert(IQuests.QuestCompletedAlready.selector);
    players.activateQuest(playerId, firemakingQuest.questId);
  }

  function testReactivatedQuestWhichWasDeactivatedShouldContinueAtTheSamePlace() public {
    _addQuests(_quests(firemakingQuest));
    vm.prank(ALICE);
    players.activateQuest(playerId, firemakingQuest.questId);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(firemakingQueuedAction), ActionQueueStrategy.OVERWRITE);
    uint256 timeNeeded = ((rateFiremaking / RATE_MUL) * 3600) / firemakingQuest.actionChoiceNum;

    // Set time to just before, should still not have quest rewards
    vm.warp(vm.getBlockTimestamp() + timeNeeded - 10);
    // Deactivate it, should auto process
    vm.prank(ALICE);
    players.deactivateQuest(playerId);

    assertEq(itemNFT.balanceOf(ALICE, LOG), 5000 - ((rateFiremaking * 3600) / ((timeNeeded - 10) * RATE_MUL)) + 1);

    assertEq(itemNFT.balanceOf(ALICE, firemakingQuest.rewardItemTokenId1), 0);

    // Check it's not completed
    assertFalse(quests.isQuestCompleted(playerId, firemakingQuest.questId));
    assertEq(quests.activeQuests(playerId).questId, 0);

    // Re-activate it
    vm.prank(ALICE);
    players.activateQuest(playerId, firemakingQuest.questId);
    vm.warp(vm.getBlockTimestamp() + 10);
    vm.prank(ALICE);
    players.processActions(playerId);
    assertEq(itemNFT.balanceOf(ALICE, LOG), 5000 - ((rateFiremaking * 3600) / (timeNeeded * RATE_MUL)));

    assertTrue(quests.isQuestCompleted(playerId, firemakingQuest.questId));
    assertEq(itemNFT.balanceOf(ALICE, firemakingQuest.rewardItemTokenId1), firemakingQuest.rewardAmount1);
    assertEq(quests.activeQuests(playerId).questId, 0);
  }

  function testReactivatedQuestWhichHasProgressInAnotherQuestShouldContinueAtTheSamePlaceOnceReactivated() public {
    QueuedActionInput memory queuedAction = firemakingQueuedAction;
    queuedAction.timespan = 3636;

    quests.addQuests(_quests(firemakingQuest, firemakingQuestLog), _minRequirements(2));
    vm.prank(ALICE);
    players.activateQuest(playerId, firemakingQuest.questId);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);
    uint256 timeNeeded = ((rateFiremaking / RATE_MUL) * 3600) / firemakingQuest.actionChoiceNum;

    // Set time to just before, should still not have quest rewards
    vm.warp(vm.getBlockTimestamp() + timeNeeded - 10);
    // Activate another quest should auto process current quest
    vm.prank(ALICE);
    players.activateQuest(playerId, firemakingQuestLog.questId);
    assertEq(itemNFT.balanceOf(ALICE, LOG), 5000 - ((rateFiremaking * 3600) / ((timeNeeded - 10) * RATE_MUL)) + 1);

    assertEq(itemNFT.balanceOf(ALICE, firemakingQuest.rewardItemTokenId1), 0);

    // Check it's not completed
    assertFalse(quests.isQuestCompleted(playerId, firemakingQuest.questId));
    assertEq(quests.activeQuests(playerId).questId, firemakingQuestLog.questId);

    vm.warp(vm.getBlockTimestamp() + 10);
    // Activate the other quest and finish it
    vm.prank(ALICE);
    players.activateQuest(playerId, firemakingQuest.questId);
    assertEq(itemNFT.balanceOf(ALICE, LOG), 5000 - ((rateFiremaking * 3600) / ((timeNeeded - 10) * RATE_MUL)));
    assertFalse(quests.isQuestCompleted(playerId, firemakingQuest.questId));
    vm.warp(vm.getBlockTimestamp() + 36);
    vm.prank(ALICE);
    players.processActions(playerId);
    assertEq(itemNFT.balanceOf(ALICE, LOG), 5000 - ((rateFiremaking * 3600) / (timeNeeded * RATE_MUL)) - 1);

    assertTrue(quests.isQuestCompleted(playerId, firemakingQuest.questId));
    assertEq(itemNFT.balanceOf(ALICE, firemakingQuest.rewardItemTokenId1), firemakingQuest.rewardAmount1);
    assertEq(quests.activeQuests(playerId).questId, 0);
  }

  function testActivateQuestThroughStartActionsAdvanced() public {
    _addQuests(_quests(firemakingQuest));
    assertEq(quests.activeQuests(playerId).questId, 0);
    vm.prank(ALICE);
    players.startActionsAdvanced(
      playerId,
      _queuedActions(firemakingQueuedAction),
      NONE,
      0,
      firemakingQuest.questId,
      NO_DONATION_AMOUNT,
      ActionQueueStrategy.OVERWRITE
    );
    assertEq(quests.activeQuests(playerId).questId, firemakingQuest.questId);
  }

  function testCanOnlyStartAFullModeQuestIfHeroIsEvolved() public {
    (QueuedActionInput memory queuedAction, , uint16 choiceId) = _setupBasicFletching(1 * RATE_MUL, 1);

    vm.prank(ALICE);
    players.startActions(playerId, _queuedActions(queuedAction), ActionQueueStrategy.OVERWRITE);
    vm.prank(ALICE);
    itemNFT.mintBatch(ALICE, _uints(BRONZE_ARROW_HEAD, ARROW_SHAFT, FEATHER), _uints(1000, 1000, 1000));

    // Activate a quest
    QuestInput memory quest = _soFletchQuest();
    quest.actionChoiceId = choiceId;
    quest.actionChoiceNum = 1;
    quest.skillReward = Skill.ALCHEMY;
    _addQuests(_quests(quest));

    vm.prank(ALICE);
    vm.expectRevert(IQuests.CannotStartFullModeQuest.selector);
    players.activateQuest(playerId, QUEST_SO_FLETCH);

    // Upgrade the player
    brush.mint(ALICE, 1 ether);
    vm.startPrank(ALICE);
    brush.approve(address(playerNFT), 1 ether);
    playerNFT.editPlayer(playerId, playerNFT.getName(playerId), "", "", "", true);
    players.activateQuest(playerId, QUEST_SO_FLETCH);
    vm.stopPrank();

    // Complete the quest
    vm.warp(vm.getBlockTimestamp() + queuedAction.timespan);
    vm.prank(ALICE);
    players.processActions(playerId);
    assertEq(players.getPlayerXP(playerId, quest.skillReward), quest.skillXPGained);
  }

  function _setupBasicFiremaking(uint24 minXP) private {
    rateFiremaking = 100 * RATE_MUL; // per hour

    ActionInput[] memory actions = new ActionInput[](1);
    actions[0].actionId = ACTION_FIREMAKING_ITEM;
    actions[0].info = _actionInfo(Skill.FIREMAKING, 0, 0, true, MAGIC_FIRE_STARTER, 3583);
    worldActions.addActions(actions);

    // Logs go in, nothing comes out
    ActionChoiceInput[] memory choices = new ActionChoiceInput[](1);
    choices[0] = _defaultActionChoice();
    choices[0].skill = uint8(Skill.FIREMAKING);
    choices[0].xpPerHour = 3600;
    choices[0].rate = uint24(rateFiremaking);
    choices[0].inputTokenIds = _uint16s(LOG);
    choices[0].inputAmounts = _uint24s(1);
    if (minXP > 0) {
      choices[0].skills = new uint8[](1);
      choices[0].skills[0] = uint8(Skill.FIREMAKING);
      choices[0].skillMinXPs = new uint32[](1);
      choices[0].skillMinXPs[0] = minXP;
      choices[0].skillDiffs = new int16[](1);
    }
    worldActions.addActionChoices(ACTION_FIREMAKING_ITEM, _uint16s(1), choices);

    firemakingQueuedAction = _queuedAction(ACTION_FIREMAKING_ITEM, 1, 0, 3600, CombatStyle.NONE);
    firemakingQueuedAction.rightHandEquipmentTokenId = MAGIC_FIRE_STARTER;

    ItemInput[] memory items = new ItemInput[](2);
    items[0] = _defaultItem(MAGIC_FIRE_STARTER, EquipPosition.RIGHT_HAND);
    items[1] = _defaultItem(LOG, EquipPosition.AUX);
    itemNFT.addItems(items);

    itemNFT.mint(ALICE, LOG, 5000);
  }

  function _setupBasicWoodcutting(
    uint256 rate
  ) private returns (QueuedActionInput memory queuedAction, uint256, uint16) {
    ActionInput[] memory actions = new ActionInput[](1);
    actions[0].actionId = ACTION_WOODCUTTING_LOG;
    actions[0].info = _actionInfo(Skill.WOODCUTTING, 3600, 0, false, BRONZE_AXE, 3071);
    actions[0].guaranteedRewards = new GuaranteedReward[](1);
    actions[0].guaranteedRewards[0] = GuaranteedReward(LOG, uint16(rate));
    worldActions.addActions(actions);

    ItemInput[] memory items = new ItemInput[](1);
    items[0] = _defaultItem(BRONZE_AXE, EquipPosition.RIGHT_HAND);
    itemNFT.addItems(items);

    queuedAction = _queuedAction(ACTION_WOODCUTTING_LOG, 0, 0, 3600, CombatStyle.NONE);
    queuedAction.rightHandEquipmentTokenId = BRONZE_AXE;
    return (queuedAction, rate, 0);
  }

  function _setupBasicFishing() private returns (QueuedActionInput memory queuedAction, uint256 rate, uint16) {
    rate = 100 * GUAR_MUL; // per hour
    ActionInput[] memory actions = new ActionInput[](1);
    actions[0].actionId = ACTION_FISHING_MINNUS;
    actions[0].info = _actionInfo(Skill.FISHING, 3600, 0, false, NET_STICK, 3327);
    actions[0].guaranteedRewards = new GuaranteedReward[](1);
    actions[0].guaranteedRewards[0] = GuaranteedReward(RAW_MINNUS, uint16(rate));
    worldActions.addActions(actions);

    ItemInput[] memory items = new ItemInput[](1);
    items[0] = _defaultItem(NET_STICK, EquipPosition.RIGHT_HAND);
    itemNFT.addItems(items);

    queuedAction = _queuedAction(ACTION_FISHING_MINNUS, 0, 0, 3600, CombatStyle.NONE);
    queuedAction.rightHandEquipmentTokenId = NET_STICK;
    return (queuedAction, rate, 0);
  }

  function _setupBasicCooking(
    uint8 successPercent,
    uint256 minLevel
  ) private returns (QueuedActionInput memory queuedAction, uint256 rate, uint16 choiceId) {
    rate = 100 * RATE_MUL; // per hour

    ActionInput[] memory actions = new ActionInput[](1);
    actions[0].actionId = 1;
    actions[0].info = _actionInfo(Skill.COOKING, 0, 0, true, NONE, NONE);
    worldActions.addActions(actions);

    // Food goes in, cooked food comes out
    ActionChoiceInput[] memory choices = new ActionChoiceInput[](1);
    choices[0] = _defaultActionChoice();
    choices[0].skill = uint8(Skill.COOKING);
    choices[0].xpPerHour = 3600;
    choices[0].rate = uint24(rate);
    choices[0].inputTokenIds = _uint16s(RAW_MINNUS);
    choices[0].inputAmounts = _uint24s(1);
    choices[0].outputTokenId = COOKED_MINNUS;
    choices[0].outputAmount = 1;
    choices[0].successPercent = successPercent;
    if (minLevel > 1) {
      choices[0].skills = new uint8[](1);
      choices[0].skills[0] = uint8(Skill.COOKING);
      choices[0].skillMinXPs = new uint32[](1);
      choices[0].skillMinXPs[0] = uint32(_xpAtLevel(minLevel));
      choices[0].skillDiffs = new int16[](1);
    }
    worldActions.addActionChoices(1, _uint16s(1), choices);
    choiceId = 1;

    queuedAction = _queuedAction(1, choiceId, 0, 3600, CombatStyle.NONE);

    ItemInput[] memory items = new ItemInput[](2);
    items[0] = _defaultItem(RAW_MINNUS, EquipPosition.AUX);
    items[1] = _defaultItem(COOKED_MINNUS, EquipPosition.FOOD);
    items[1].healthRestored = 1;
    itemNFT.addItems(items);

    itemNFT.mint(ALICE, RAW_MINNUS, 1000);
    return (queuedAction, rate, choiceId);
  }

  function _setupBasicFletching(
    uint256 rate,
    uint256 outputAmount
  ) private returns (QueuedActionInput memory queuedAction, uint256, uint16 choiceId) {
    ActionInput[] memory actions = new ActionInput[](1);
    actions[0].actionId = 1;
    actions[0].info = _actionInfo(Skill.FLETCHING, 0, 0, true, NONE, NONE);
    worldActions.addActions(actions);

    // Create Bronze arrows
    ActionChoiceInput[] memory choices = new ActionChoiceInput[](1);
    choices[0] = _defaultActionChoice();
    choices[0].skill = uint8(Skill.FLETCHING);
    choices[0].xpPerHour = 3600;
    choices[0].rate = uint24(rate);
    choices[0].inputTokenIds = _uint16s(BRONZE_ARROW_HEAD, ARROW_SHAFT, FEATHER);
    choices[0].inputAmounts = _uint24s(1, 1, 2);
    choices[0].outputTokenId = BRONZE_ARROW;
    choices[0].outputAmount = uint8(outputAmount);
    worldActions.addActionChoices(1, _uint16s(1), choices);
    choiceId = 1;

    queuedAction = _queuedAction(1, choiceId, 0, 3600, CombatStyle.NONE);

    ItemInput[] memory items = new ItemInput[](4);
    items[0] = _defaultItem(BRONZE_ARROW_HEAD, EquipPosition.NONE);
    items[1] = _defaultItem(ARROW_SHAFT, EquipPosition.NONE);
    items[2] = _defaultItem(FEATHER, EquipPosition.NONE);
    items[3] = _defaultItem(BRONZE_ARROW, EquipPosition.NONE);
    itemNFT.addItems(items);
    return (queuedAction, rate, choiceId);
  }

  function _setupBasicMeleeCombat()
    private
    returns (QueuedActionInput memory queuedAction, uint256 rate, uint256 numSpawned)
  {
    CombatStats memory monsterCombatStats = CombatStats(1, 0, 0, 20, 0, 0, 0);

    rate = 1 * GUAR_MUL; // per kill
    numSpawned = 10 * SPAWN_MUL;
    ActionInput[] memory actions = new ActionInput[](1);
    actions[0].actionId = 10;
    actions[0].info = _actionInfo(Skill.COMBAT, 3600, 0, true, 2048, 2559);
    actions[0].info.numSpawned = uint24(numSpawned);
    actions[0].guaranteedRewards = new GuaranteedReward[](1);
    actions[0].guaranteedRewards[0] = GuaranteedReward(BRONZE_ARROW, uint16(rate));
    actions[0].randomRewards = new RandomReward[](1);
    actions[0].randomRewards[0] = RandomReward(POISON, 32_767, 1); // ~50% chance
    actions[0].combatStats = monsterCombatStats;
    worldActions.addActions(actions);

    ActionChoiceInput[] memory choices = new ActionChoiceInput[](1);
    choices[0] = _defaultActionChoice();
    choices[0].skill = uint8(Skill.MELEE);
    worldActions.addActionChoices(NONE, _uint16s(1), choices);
    uint16 choiceId = 1;

    itemNFT.mint(ALICE, BRONZE_SWORD, 1);
    itemNFT.mint(ALICE, BRONZE_HELMET, 1);
    itemNFT.mint(ALICE, COOKED_MINNUS, 255);

    queuedAction = _queuedAction(10, choiceId, COOKED_MINNUS, 3600, CombatStyle.ATTACK);
    queuedAction.rightHandEquipmentTokenId = BRONZE_SWORD;
    queuedAction.attire.head = BRONZE_HELMET;

    ItemInput[] memory items = new ItemInput[](4);
    items[0] = _defaultItem(BRONZE_SWORD, EquipPosition.RIGHT_HAND);
    items[0].combatStats = CombatStats(5, 0, 0, 0, 0, 0, 0);
    items[1] = _defaultItem(BRONZE_HELMET, EquipPosition.HEAD);
    items[1].combatStats = CombatStats(1, 0, 0, 1, 4, 0, 1);
    items[2] = _defaultItem(BRONZE_ARROW, EquipPosition.QUIVER);
    items[3] = _defaultItem(COOKED_MINNUS, EquipPosition.FOOD);
    items[3].healthRestored = 12;
    itemNFT.addItems(items);
  }

  // Adds a combat action (used in the cooked food combat test) and a melee choice
  function _addCombatAction(
    uint16 actionId,
    uint256 numSpawned,
    CombatStats memory combatStats,
    uint16 choiceId,
    uint16 regenerateId
  ) private returns (QueuedActionInput memory queuedAction, uint16) {
    ActionInput[] memory actions = new ActionInput[](1);
    actions[0].actionId = actionId;
    actions[0].info = _actionInfo(Skill.COMBAT, 3600, 0, true, 2048, 2559);
    actions[0].info.numSpawned = uint24(numSpawned);
    actions[0].combatStats = combatStats;
    worldActions.addActions(actions);

    ActionChoiceInput[] memory choices = new ActionChoiceInput[](1);
    choices[0] = _defaultActionChoice();
    choices[0].skill = uint8(Skill.MELEE);
    worldActions.addActionChoices(NONE, _uint16s(choiceId), choices);

    queuedAction = _queuedAction(actionId, choiceId, regenerateId, 3600, CombatStyle.ATTACK);
    return (queuedAction, choiceId);
  }

  function _defaultQuest(uint16 questId) private pure returns (QuestInput memory q) {
    q.questId = questId;
  }

  function _purseStringsQuest() private pure returns (QuestInput memory q) {
    q.questId = uint16(QUEST_PURSE_STRINGS);
    q.skillReward = Skill.HEALTH;
    q.skillXPGained = 100;
  }

  function _supplyRunQuest() private pure returns (QuestInput memory q) {
    q.questId = QUEST_SUPPLY_RUN;
    q.actionId1 = ACTION_COMBAT_NATUOW;
    q.actionNum1 = 500;
    q.skillReward = Skill.DEFENCE;
    q.skillXPGained = 250;
    q.rewardItemTokenId1 = NATUOW_LEATHER;
    q.rewardAmount1 = 100;
    q.burnItemTokenId = NATUOW_HIDE;
    q.burnAmount = 500;
  }

  function _hiddenBountyQuest() private pure returns (QuestInput memory q) {
    q.questId = QUEST_HIDDEN_BOUNTY;
    q.actionId1 = ACTION_THIEVING_MAN;
    q.actionNum1 = 10;
    q.skillReward = Skill.THIEVING;
    q.skillXPGained = 250;
    q.rewardItemTokenId1 = RUBY;
    q.rewardAmount1 = 1;
    q.rewardItemTokenId2 = EMERALD;
    q.rewardAmount2 = 1;
  }

  function _almsPoorQuest() private pure returns (QuestInput memory q) {
    q.questId = QUEST_ALMS_POOR;
    q.actionChoiceId = 1002; // ACTIONCHOICE_COOKING_BLEKK
    q.actionChoiceNum = 500;
    q.rewardItemTokenId1 = SKILL_BOOST;
    q.rewardAmount1 = 3;
    q.burnItemTokenId = COOKED_MINNUS;
    q.burnAmount = 500;
  }

  function _townCookoutQuest() private pure returns (QuestInput memory q) {
    q.questId = QUEST_TOWN_COOKOUT;
    q.actionId1 = 1502; // ACTION_FISHING_SKRIMP
    q.actionNum1 = 5000;
    q.skillReward = Skill.FISHING;
    q.skillXPGained = 2250;
    q.burnItemTokenId = 10_754; // RAW_SKRIMP
    q.burnAmount = 5000;
  }

  function _soFletchQuest() private pure returns (QuestInput memory q) {
    q.questId = QUEST_SO_FLETCH;
    q.actionChoiceId = 1420; // ACTIONCHOICE_FLETCHING_ARROW_SHAFT_FROM_LOG
    q.actionChoiceNum = 9600;
    q.skillReward = Skill.FLETCHING;
    q.skillXPGained = 250;
    q.isFullModeOnly = true;
  }

  function _actionInfo(
    Skill skill,
    uint24 xpPerHour,
    uint32 minXP,
    bool actionChoiceRequired,
    uint16 handItemTokenIdRangeMin,
    uint16 handItemTokenIdRangeMax
  ) private pure returns (ActionInfo memory info) {
    info = ActionInfo({
      skill: uint8(skill),
      actionChoiceRequired: actionChoiceRequired,
      xpPerHour: xpPerHour,
      minXP: minXP,
      numSpawned: 0,
      handItemTokenIdRangeMin: handItemTokenIdRangeMin,
      handItemTokenIdRangeMax: handItemTokenIdRangeMax,
      successPercent: 100,
      worldLocation: 0,
      isFullModeOnly: false,
      isAvailable: true,
      questPrerequisiteId: 0
    });
  }

  function _defaultActionChoice() private pure returns (ActionChoiceInput memory c) {
    c.successPercent = 100;
    c.isAvailable = true;
  }

  function _defaultItem(uint16 tokenId, EquipPosition equipPosition) private pure returns (ItemInput memory item) {
    item.tokenId = tokenId;
    item.equipPosition = equipPosition;
    item.isTransferable = true;
    item.isAvailable = true;
    item.metadataURI = "TEST.json";
    item.name = "TEST";
  }

  function _queuedAction(
    uint16 actionId,
    uint16 choiceId,
    uint16 regenerateId,
    uint24 timespan,
    CombatStyle combatStyle
  ) private pure returns (QueuedActionInput memory q) {
    q.actionId = actionId;
    q.choiceId = choiceId;
    q.regenerateId = regenerateId;
    q.timespan = timespan;
    q.combatStyle = uint8(combatStyle);
  }

  function _addQuests(QuestInput[] memory questsToAdd) private {
    quests.addQuests(questsToAdd, _minRequirements(questsToAdd.length));
  }

  function _quests(QuestInput memory a) private pure returns (QuestInput[] memory out) {
    out = new QuestInput[](1);
    out[0] = a;
  }

  function _quests(QuestInput memory a, QuestInput memory b) private pure returns (QuestInput[] memory out) {
    out = new QuestInput[](2);
    out[0] = a;
    out[1] = b;
  }

  function _minRequirements(uint256 count) private pure returns (IQuests.MinimumRequirement[3][] memory reqs) {
    reqs = new IQuests.MinimumRequirement[3][](count);
  }

  function _queuedActions(QueuedActionInput memory a) private pure returns (QueuedActionInput[] memory out) {
    out = new QueuedActionInput[](1);
    out[0] = a;
  }

  function _queuedActions(
    QueuedActionInput memory a,
    QueuedActionInput memory b
  ) private pure returns (QueuedActionInput[] memory out) {
    out = new QueuedActionInput[](2);
    out[0] = a;
    out[1] = b;
  }

  function _queuedActions(
    QueuedActionInput memory a,
    QueuedActionInput memory b,
    QueuedActionInput memory c
  ) private pure returns (QueuedActionInput[] memory out) {
    out = new QueuedActionInput[](3);
    out[0] = a;
    out[1] = b;
    out[2] = c;
  }

  function _playersView() private view returns (IPlayersMisc1DelegateView) {
    return IPlayersMisc1DelegateView(address(players));
  }
}
