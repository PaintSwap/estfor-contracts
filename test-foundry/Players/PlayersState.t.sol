// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {FullGameStack} from "../utils/FullGameStack.sol";
import {Players} from "../interfaces/Players.sol";
import {PlayersBase} from "../interfaces/PlayersBase.sol";
import {PlayersImplMisc1} from "../interfaces/PlayersImplMisc1.sol";
import {Quests} from "../interfaces/Quests.sol";
import {
    Player,
    AvatarInfo,
    ItemInput,
    EquipPosition,
    PendingQueuedActionState,
    ActionChoiceInput,
    PackedXP
} from "../../contracts/globals/players.sol";
import {Skill, CombatStyle, BoostType} from "../../contracts/globals/misc.sol";
import {
    ActionInput,
    ActionQueueStrategy,
    QueuedAction,
    QueuedActionInput,
    GUAR_MUL,
    RATE_MUL
} from "../../contracts/globals/actions.sol";
import {GuaranteedReward} from "../../contracts/globals/rewards.sol";
import {QuestInput, QUEST_PURSE_STRINGS} from "../../contracts/globals/quests.sol";
import {
    NONE,
    BRONZE_AXE,
    XP_BOOST,
    COMBAT_BOOST,
    SKILL_BOOST,
    GATHERING_BOOST
} from "../../contracts/globals/items.sol";

// Migrated from test/Players/Players.ts ("currentAction in-progress actions" through EOF).
contract PlayersStateTest is FullGameStack {
    uint16 private constant LOG = 10_496;
    uint16 private constant RAW_MINNUS = 10_752;
    uint16 private constant COOKED_MINNUS = 11_008;
    uint16 private constant MITHRIL_BAR = 10_242;
    uint16 private constant MITHRIL_ORE = 11_526;
    uint16 private constant COAL_ORE = 11_524;
    uint16 private constant SAPPHIRE = 11_523;
    uint16 private constant BRONZE_HELMET = 1;
    uint16 private constant ORICHALCUM_AXE = 2_822;
    uint16 private constant ACTION_WOODCUTTING = 1;
    uint16 private constant ACTION_FISHING = 1_500;
    uint16 private constant WOODCUTTING_MAX = 3_071;
    uint256 private constant START_XP = 374;
    uint256 private constant MAX_XP = type(uint32).max;

    function setUp() public {
        deployFullGame();
    }

    function testCurrentActionTracksPartiallyProcessedAction() public {
        (QueuedActionInput memory action, uint256 rate) = _setupWoodcutting();
        _start(_actions(action, action));
        uint256 elapsed = (action.timespan * 10) / rate;
        vm.warp(block.timestamp + elapsed);
        _process();
        Player memory p = PlayersImplMisc1(address(players)).getPlayer(playerId);
        assertEq(p.currentActionStartTimestamp, block.timestamp);
        assertEq(uint8(p.currentActionProcessedSkill1), uint8(Skill.WOODCUTTING));
        assertEq(p.currentActionProcessedXPGained1, elapsed);
        assertEq(uint8(p.currentActionProcessedSkill2), uint8(Skill.NONE));
        assertEq(p.currentActionProcessedXPGained2, 0);
        assertEq(p.currentActionProcessedFoodConsumed, 0);
        assertEq(p.currentActionProcessedBaseInputItemsConsumedNum, 0);
    }

    function testXPIsCappedAtUint32Max() public {
        ActionInput memory input = _woodcuttingInput(16_000_000, uint16(100 * GUAR_MUL));
        _addAction(input);
        ItemInput memory axe = _item(ORICHALCUM_AXE, EquipPosition.RIGHT_HAND);
        axe.skill = Skill.WOODCUTTING;
        axe.minXP = 322_394_334;
        _addItem(axe);
        players.modifyXP(ALICE, playerId, Skill.WOODCUTTING, uint56(MAX_XP - 1_000_000), true);
        itemNFT.mint(ALICE, ORICHALCUM_AXE, 1);
        QueuedActionInput memory action = _queued(ACTION_WOODCUTTING, 1 days);
        action.rightHandEquipmentTokenId = ORICHALCUM_AXE;
        _start(_actions(action));
        vm.warp(block.timestamp + 1 days);
        _start(_actions(action));
        assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), MAX_XP);
        _process();
        assertEq(players.getLevel(playerId, Skill.WOODCUTTING), 140);
    }

    function testCannotSetAlreadyActivePlayer() public {
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.PlayerAlreadyActive.selector);
        players.setActivePlayer(playerId);
    }

    function testTransferActivePlayerClearsActivePlayer() public {
        assertEq(players.getActivePlayer(ALICE), playerId);
        vm.prank(ALICE);
        playerNFT.safeTransferFrom(ALICE, address(this), playerId, 1, "");
        assertEq(players.getActivePlayer(ALICE), 0);
    }

    function testTransferNonActivePlayerLeavesActivePlayerUnchanged() public {
        uint256 other = _createPlayer(ALICE, 1, "New name", false);
        vm.prank(ALICE);
        playerNFT.safeTransferFrom(ALICE, address(this), other, 1, "");
        assertEq(players.getActivePlayer(ALICE), playerId);
    }

    function testTransferPlayerRemovesActiveBoost() public {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        ItemInput memory boost = _item(XP_BOOST, EquipPosition.BOOST_VIAL);
        boost.boostType = BoostType.NON_COMBAT_XP;
        boost.boostValue = 50;
        boost.boostDuration = 1 days;
        boost.isTransferable = false;
        _addItem(boost);
        itemNFT.mint(ALICE, XP_BOOST, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(playerId, _actions(action), XP_BOOST, 2, 0, 0, ActionQueueStrategy.OVERWRITE);
        assertTrue(uint8(players.getActiveBoost(playerId).boostType) != 0);
        vm.prank(ALICE);
        playerNFT.safeTransferFrom(ALICE, address(this), playerId, 1, "");
        assertEq(uint8(players.getActiveBoost(playerId).boostType), 0);
    }

    function testGamePauseRestrictsPlayersButOnlyOwnerCanPause() public {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        players.pauseGame(true);
        players.pauseGame(true);
        vm.prank(ALICE);
        vm.expectRevert(Players.GameIsPaused.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
        players.pauseGame(false);
        _start(_actions(action));
        players.pauseGame(true);
        vm.prank(ALICE);
        vm.expectRevert(Players.GameIsPaused.selector);
        players.processActions(playerId);
        players.pauseGame(false);
        _process();
    }

    function testZeroActionTimespanReverts() public {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        action.timespan = 0;
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.EmptyTimespan.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
    }

    function testChoiceIdOnChoiceLessActionReverts() public {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        action.choiceId = 1;
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ActionChoiceIdNotRequired.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
    }

    function testQueuedTimespanAboveUint16DoesNotOverflow() public {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        action.timespan = 1 days;
        _start(_actions(action));
        vm.warp(block.timestamp + 5);
        _process();
        QueuedAction[] memory queue = players.getActionQueue(playerId);
        assertGt(queue[0].timespan, action.timespan - 10);
    }

    function testAvatarSingleStartSkillBaseXPBoost() public {
        _assertAvatarBoost(Skill.NONE, false, 110, START_XP);
    }

    function testAvatarTwoStartSkillsBaseXPBoost() public {
        _assertAvatarBoost(Skill.THIEVING, false, 105, START_XP / 2);
    }

    function testUpgradedAvatarSingleStartSkillBaseXPBoost() public {
        _assertAvatarBoost(Skill.NONE, true, 120, START_XP);
    }

    function testUpgradedAvatarTwoStartSkillsBaseXPBoost() public {
        _assertAvatarBoost(Skill.THIEVING, true, 110, START_XP / 2);
    }

    function testPackedMaxLevelXPBits() public {
        uint56 xp = _xpAtLevel(140);
        players.modifyXP(ALICE, playerId, Skill.MELEE, xp, true);
        players.modifyXP(ALICE, playerId, Skill.MAGIC, xp, true);
        PackedXP memory packed = PlayersImplMisc1(address(players)).getPackedXP(playerId);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 0) & 3, 1);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 2) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 4) & 3, 1);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 6) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 8) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 10) & 3, 0);
        assertEq(uint16(packed.packedDataIsMaxed1), 0);
        assertEq(uint16(packed.packedDataIsMaxed2), 0);

        players.modifyXP(ALICE, playerId, Skill.CRAFTING, xp - 1, true);
        packed = PlayersImplMisc1(address(players)).getPackedXP(playerId);
        assertEq((uint256(uint16(packed.packedDataIsMaxed1)) >> 10) & 3, 0);
        players.modifyXP(ALICE, playerId, Skill.CRAFTING, xp, true);
        packed = PlayersImplMisc1(address(players)).getPackedXP(playerId);
        assertEq((uint256(uint16(packed.packedDataIsMaxed1)) >> 10) & 3, 1);

        players.modifyXP(ALICE, playerId, Skill.SMITHING, xp, true);
        players.modifyXP(ALICE, playerId, Skill.WOODCUTTING, xp, true);
        players.modifyXP(ALICE, playerId, Skill.FORGING, xp, true);
        packed = PlayersImplMisc1(address(players)).getPackedXP(playerId);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 0) & 3, 1);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 2) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 4) & 3, 1);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 6) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 8) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed)) >> 10) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed1)) >> 0) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed1)) >> 2) & 3, 1);
        assertEq((uint256(uint16(packed.packedDataIsMaxed1)) >> 4) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed1)) >> 6) & 3, 1);
        assertEq((uint256(uint16(packed.packedDataIsMaxed1)) >> 8) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed1)) >> 10) & 3, 1);
        assertEq((uint256(uint16(packed.packedDataIsMaxed2)) >> 0) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed2)) >> 2) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed2)) >> 4) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed2)) >> 6) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed2)) >> 8) & 3, 0);
        assertEq((uint256(uint16(packed.packedDataIsMaxed2)) >> 10) & 3, 1);
    }

    function testQueueOverMaxRejectsMiddleOverflowAndTrimsFinalAction() public {
        (QueuedActionInput memory base,) = _setupWoodcutting();
        QueuedActionInput memory long = _queued(ACTION_WOODCUTTING, 23 hours);
        long.rightHandEquipmentTokenId = BRONZE_AXE;
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.EmptyTimespan.selector);
        players.startActions(playerId, _actions(base, long, base), ActionQueueStrategy.OVERWRITE);

        base.timespan = 2 hours;
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ActionTimespanExceedsMaxTime.selector);
        players.startActions(playerId, _actions(base, long, base), ActionQueueStrategy.OVERWRITE);

        _start(_actions(base, base, long));
        QueuedAction[] memory queue = players.getActionQueue(playerId);
        assertEq(queue.length, 3);
        assertEq(queue[2].timespan, 20 hours);
    }

    function testQueueRemainderIsPreservedWithKeepLastInProgress() public {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        action.timespan = 1600;
        QueuedActionInput memory full = _queued(ACTION_WOODCUTTING, 1 days);
        full.rightHandEquipmentTokenId = BRONZE_AXE;
        _start(_actions(action, full));
        QueuedAction[] memory queue = players.getActionQueue(playerId);
        assertEq(queue.length, 2);
        assertEq(queue[0].timespan, 1600);
        assertEq(queue[1].timespan, 1 days);

        // Hardhat mined the queue transaction one second after the preceding timestamp.
        vm.warp(block.timestamp + 23 hours);
        vm.prank(ALICE);
        players.startActions(playerId, _actions(full), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        queue = players.getActionQueue(playerId);
        assertEq(queue.length, 2);
        assertEq(queue[0].timespan, 1600 + 1 hours);
        assertEq(queue[1].timespan, 23 hours);
    }

    function testSingleOversizedQueuedActionIsTrimmedToOneDay() public {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        action.timespan = 25 hours;
        _start(_actions(action));
        assertEq(players.getActionQueue(playerId)[0].timespan, 1 days);
    }

    function testTransferBoostInventoryLocksPlayerForEachBoostType() public {
        uint16[4] memory boosts = [COMBAT_BOOST, XP_BOOST, SKILL_BOOST, GATHERING_BOOST];
        for (uint256 i; i < boosts.length; ++i) {
            vm.prank(ALICE);
            playerNFT.safeTransferFrom(ALICE, address(this), playerId, 1, "");
            players.setActivePlayer(playerId);
            itemNFT.mint(ALICE, boosts[i], 1);
            playerNFT.safeTransferFrom(address(this), ALICE, playerId, 1, "");
            vm.prank(ALICE);
            vm.expectRevert(Players.PlayerLocked.selector);
            players.setActivePlayer(playerId);
            vm.prank(ALICE);
            itemNFT.burn(ALICE, boosts[i], 1);
        }
        vm.prank(ALICE);
        playerNFT.safeTransferFrom(ALICE, address(this), playerId, 1, "");
        playerNFT.safeTransferFrom(address(this), ALICE, playerId, 1, "");
        vm.prank(ALICE);
        players.setActivePlayer(playerId);
    }

    function testTransferBoostInventoryLockExpiresAfterOneDay() public {
        itemNFT.mint(address(this), COMBAT_BOOST, 1);
        vm.prank(ALICE);
        playerNFT.safeTransferFrom(ALICE, address(this), playerId, 1, "");
        vm.expectRevert(Players.PlayerLocked.selector);
        players.setActivePlayer(playerId);
        vm.warp(block.timestamp + 1 days);
        players.setActivePlayer(playerId);
    }

    function testFullModeOnlyRightHandItemRequiresUpgradeFirstBehavior() public {
        _assertFullModeHandItem();
    }

    function testFullModeOnlyAttireRequiresUpgrade() public {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        ItemInput memory helmet = _item(BRONZE_HELMET, EquipPosition.HEAD);
        helmet.isFullModeOnly = true;
        _addItem(helmet);
        itemNFT.mint(ALICE, BRONZE_HELMET, 1);
        action.attire.head = BRONZE_HELMET;
        _expectPlayerNotUpgraded(action);
        _upgradePlayer();
        _start(_actions(action));
    }

    function testFullModeOnlyRightHandItemRequiresUpgradeDuplicateBehavior() public {
        _assertFullModeHandItem();
    }

    function testFullModeChoiceOnStandardActionRequiresUpgrade() public {
        _assertFullModeChoice(false, true);
    }

    function testFullModeChoiceOnFullModeActionRequiresUpgrade() public {
        _assertFullModeChoice(true, true);
    }

    function testStandardChoiceOnFullModeActionRequiresUpgrade() public {
        _assertFullModeChoice(true, false);
    }

    function testFullModeActionRequiresUpgrade() public {
        ActionInput memory input = _woodcuttingInput(3600, uint16(100 * GUAR_MUL));
        input.actionId = ACTION_FISHING;
        input.info.skill = uint8(Skill.FISHING);
        input.info.isFullModeOnly = true;
        input.info.handItemTokenIdRangeMin = 0;
        input.info.handItemTokenIdRangeMax = 0;
        input.guaranteedRewards[0].itemTokenId = RAW_MINNUS;
        _addAction(input);
        QueuedActionInput memory action = _queued(ACTION_FISHING, 3600);
        _expectPlayerNotUpgraded(action);
        _upgradePlayer();
        _start(_actions(action));
    }

    function testActionChoiceSupportsInputAmountsAbove255() public {
        QueuedActionInput memory action = _setupProcessingChoice(true, false, 100 * RATE_MUL);
        uint256 start = 1_000_000;
        itemNFT.mintBatch(ALICE, _uints(MITHRIL_ORE, COAL_ORE, SAPPHIRE), _uints(start, start, start));
        _upgradePlayer();
        _start(_actions(action));
        vm.warp(block.timestamp + 3600);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.SMITHING), 3600);
        assertEq(itemNFT.balanceOf(ALICE, MITHRIL_BAR), 100);
        assertEq(itemNFT.balanceOf(ALICE, MITHRIL_ORE), start - 100);
        assertEq(itemNFT.balanceOf(ALICE, COAL_ORE), start - 25_600);
        assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE), start - 653_500);
    }

    function testUnavailableActionStillLootsAlreadyQueuedWork() public {
        (QueuedActionInput memory action, uint256 rate) = _setupWoodcutting();
        _start(_actions(action));
        ActionInput memory edited = _woodcuttingInput(3600, uint16(rate));
        edited.info.isAvailable = false;
        _editAction(edited);
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ActionNotAvailable.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
        QueuedActionInput memory fishing = _setupFishing();
        vm.prank(ALICE);
        players.startActions(playerId, _actions(fishing), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        vm.warp(block.timestamp + action.timespan);
        _process();
        assertEq(itemNFT.balanceOf(ALICE, LOG), (action.timespan * rate) / (3600 * GUAR_MUL));
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ActionNotAvailable.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
    }

    function testUnavailableActionChoiceStillLootsAlreadyQueuedWork() public {
        QueuedActionInput memory action = _setupCooking();
        _start(_actions(action));
        ActionChoiceInput memory choice = _cookingChoice();
        choice.isAvailable = false;
        worldActions.editActionChoices(action.actionId, _uint16s(action.choiceId), _choices(choice));
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ActionChoiceNotAvailable.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
        QueuedActionInput memory fishing = _setupFishing();
        vm.prank(ALICE);
        players.startActions(playerId, _actions(fishing), ActionQueueStrategy.KEEP_LAST_IN_PROGRESS);
        vm.warp(block.timestamp + action.timespan);
        _process();
        assertGt(itemNFT.balanceOf(ALICE, COOKED_MINNUS), 0);
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.ActionChoiceNotAvailable.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
    }

    function testActionQuestPrerequisiteMustBeCompleted() public {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        ActionInput memory edited = _woodcuttingInput(3600, uint16(100 * GUAR_MUL));
        edited.info.questPrerequisiteId = uint16(QUEST_PURSE_STRINGS);
        _editAction(edited);
        _addPurseStrings();
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.DependentQuestNotCompleted.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
        _completePurseStrings();
        _start(_actions(action));
    }

    function testActionChoiceQuestPrerequisiteMustBeCompleted() public {
        QueuedActionInput memory action = _setupCooking();
        ActionChoiceInput memory choice = _cookingChoice();
        choice.questPrerequisiteId = uint16(QUEST_PURSE_STRINGS);
        worldActions.editActionChoices(action.actionId, _uint16s(action.choiceId), _choices(choice));
        _addPurseStrings();
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.DependentQuestNotCompleted.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
        _completePurseStrings();
        _start(_actions(action));
    }

    // TODO: Migrate the intentionally skipped Travelling scenario once travelling is enabled/stable.

    function _assertAvatarBoost(Skill secondSkill, bool upgraded, uint256 percent, uint256 startXP) private {
        AvatarInfo[] memory infos = new AvatarInfo[](1);
        infos[0] = AvatarInfo(
            "Name",
            "Description",
            "image",
            [secondSkill == Skill.NONE ? Skill.WOODCUTTING : secondSkill, Skill.WOODCUTTING]
        );
        if (secondSkill == Skill.NONE) infos[0].startSkills = [Skill.WOODCUTTING, Skill.NONE];
        playerNFT.setAvatars(_uints(2), infos);
        uint256 id = _createPlayer(ALICE, 2, string.concat("Avatar ", vm.toString(percent)), true);
        (QueuedActionInput memory action,) = _setupWoodcutting();
        vm.prank(ALICE);
        players.startActions(id, _actions(action), ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + action.timespan);
        if (upgraded) {
            _fundUpgrade();
            vm.prank(ALICE);
            playerNFT.editPlayer(id, string.concat("Avatar ", vm.toString(percent)), "", "", "", true);
        }
        PendingQueuedActionState memory state = players.getPendingQueuedActionState(ALICE, id);
        assertEq(state.actionMetadatas[0].xpGained, action.timespan * percent / 100);
        vm.prank(ALICE);
        players.processActions(id);
        assertEq(players.getPlayerXP(id, Skill.WOODCUTTING), startXP + action.timespan * percent / 100);
    }

    function _assertFullModeHandItem() private {
        (QueuedActionInput memory action,) = _setupWoodcutting();
        ItemInput memory axe = _item(BRONZE_AXE, EquipPosition.RIGHT_HAND);
        axe.isFullModeOnly = true;
        _editItem(axe);
        _expectPlayerNotUpgraded(action);
        _upgradePlayer();
        _start(_actions(action));
    }

    function _assertFullModeChoice(bool fullAction, bool fullChoice) private {
        QueuedActionInput memory action = _setupCooking(fullChoice, fullAction);
        _expectPlayerNotUpgraded(action);
        _upgradePlayer();
        _start(_actions(action));
    }

    function _expectPlayerNotUpgraded(QueuedActionInput memory action) private {
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.PlayerNotUpgraded.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
    }

    function _upgradePlayer() private {
        _fundUpgrade();
        vm.prank(ALICE);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
    }

    function _fundUpgrade() private {
        brush.mint(ALICE, 1 ether);
        vm.prank(ALICE);
        brush.approve(address(playerNFT), 1 ether);
    }

    function _setupWoodcutting() private returns (QueuedActionInput memory action, uint256 rate) {
        rate = 100 * GUAR_MUL;
        _addAction(_woodcuttingInput(3600, uint16(rate)));
        _addItem(_item(BRONZE_AXE, EquipPosition.RIGHT_HAND));
        itemNFT.mint(ALICE, BRONZE_AXE, 1);
        action = _queued(ACTION_WOODCUTTING, 3600);
        action.rightHandEquipmentTokenId = BRONZE_AXE;
    }

    function _woodcuttingInput(uint24 xpPerHour, uint16 rate) private pure returns (ActionInput memory input) {
        input.actionId = ACTION_WOODCUTTING;
        input.info.skill = uint8(Skill.WOODCUTTING);
        input.info.xpPerHour = xpPerHour;
        input.info.handItemTokenIdRangeMin = BRONZE_AXE;
        input.info.handItemTokenIdRangeMax = WOODCUTTING_MAX;
        input.info.successPercent = 100;
        input.info.isAvailable = true;
        input.guaranteedRewards = new GuaranteedReward[](1);
        input.guaranteedRewards[0] = GuaranteedReward(LOG, rate);
    }

    function _setupFishing() private returns (QueuedActionInput memory action) {
        ActionInput memory input = _woodcuttingInput(3600, uint16(100 * GUAR_MUL));
        input.actionId = ACTION_FISHING;
        input.info.skill = uint8(Skill.FISHING);
        input.info.handItemTokenIdRangeMin = 0;
        input.info.handItemTokenIdRangeMax = 0;
        input.guaranteedRewards[0].itemTokenId = RAW_MINNUS;
        _addAction(input);
        action = _queued(ACTION_FISHING, 3600);
    }

    function _setupCooking() private returns (QueuedActionInput memory action) {
        return _setupCooking(false, false);
    }

    function _setupCooking(bool fullChoice, bool fullAction) private returns (QueuedActionInput memory action) {
        ActionInput memory input;
        input.actionId = 2;
        input.info.skill = uint8(Skill.COOKING);
        input.info.actionChoiceRequired = true;
        input.info.successPercent = 100;
        input.info.isAvailable = true;
        input.info.isFullModeOnly = fullAction;
        _addAction(input);
        ActionChoiceInput memory choice = _cookingChoice();
        choice.isFullModeOnly = fullChoice;
        worldActions.addActionChoices(2, _uint16s(1), _choices(choice));
        _addItem(_item(RAW_MINNUS, EquipPosition.AUX));
        ItemInput memory cooked = _item(COOKED_MINNUS, EquipPosition.FOOD);
        cooked.healthRestored = 1;
        _addItem(cooked);
        itemNFT.mint(ALICE, RAW_MINNUS, 1000);
        action = _queued(2, 3600);
        action.choiceId = 1;
    }

    function _setupProcessingChoice(bool fullChoice, bool fullAction, uint256 rate)
        private
        returns (QueuedActionInput memory action)
    {
        ActionInput memory input;
        input.actionId = 2;
        input.info.skill = uint8(Skill.SMITHING);
        input.info.actionChoiceRequired = true;
        input.info.successPercent = 100;
        input.info.isAvailable = true;
        input.info.isFullModeOnly = fullAction;
        _addAction(input);
        ActionChoiceInput memory choice;
        choice.skill = uint8(Skill.SMITHING);
        choice.xpPerHour = 3600;
        choice.rate = uint24(rate);
        choice.inputTokenIds = _uint16s(MITHRIL_ORE, COAL_ORE, SAPPHIRE);
        choice.inputAmounts = _uint24s(1, 256, 6535);
        choice.outputTokenId = MITHRIL_BAR;
        choice.outputAmount = 1;
        choice.successPercent = 100;
        choice.isAvailable = true;
        choice.isFullModeOnly = fullChoice;
        worldActions.addActionChoices(2, _uint16s(1), _choices(choice));
        _addItem(_item(MITHRIL_ORE, EquipPosition.AUX));
        _addItem(_item(COAL_ORE, EquipPosition.AUX));
        _addItem(_item(SAPPHIRE, EquipPosition.AUX));
        action = _queued(2, 3600);
        action.choiceId = 1;
    }

    function _cookingChoice() private pure returns (ActionChoiceInput memory choice) {
        choice.skill = uint8(Skill.COOKING);
        choice.xpPerHour = 3600;
        choice.rate = uint24(100 * RATE_MUL);
        choice.inputTokenIds = _uint16s(RAW_MINNUS);
        choice.inputAmounts = _uint24s(1);
        choice.outputTokenId = COOKED_MINNUS;
        choice.outputAmount = 1;
        choice.successPercent = 100;
        choice.isAvailable = true;
    }

    function _addPurseStrings() private {
        QuestInput[] memory qs = new QuestInput[](1);
        qs[0].questId = uint16(QUEST_PURSE_STRINGS);
        qs[0].skillReward = Skill.HEALTH;
        qs[0].skillXPGained = 100;
        Quests.MinimumRequirement[3][] memory requirements = new Quests.MinimumRequirement[3][](1);
        quests.addQuests(qs, requirements);
    }

    function _completePurseStrings() private {
        vm.prank(ALICE);
        players.activateQuest(playerId, QUEST_PURSE_STRINGS);
        vm.deal(ALICE, 1);
        vm.prank(ALICE);
        players.buyBrushQuest{value: 1}(ALICE, playerId, 0, true);
    }

    function _queued(uint16 id, uint24 timespan) private pure returns (QueuedActionInput memory q) {
        q.actionId = id;
        q.timespan = timespan;
        q.combatStyle = uint8(CombatStyle.NONE);
    }

    function _item(uint16 id, EquipPosition pos) private pure returns (ItemInput memory item) {
        item.tokenId = id;
        item.equipPosition = pos;
        item.isTransferable = true;
        item.isAvailable = true;
        item.name = "TEST";
        item.metadataURI = "test.json";
    }

    function _addAction(ActionInput memory input) private {
        ActionInput[] memory inputs = new ActionInput[](1);
        inputs[0] = input;
        worldActions.addActions(inputs);
    }

    function _editAction(ActionInput memory input) private {
        ActionInput[] memory inputs = new ActionInput[](1);
        inputs[0] = input;
        worldActions.editActions(inputs);
    }

    function _addItem(ItemInput memory item) private {
        ItemInput[] memory items = new ItemInput[](1);
        items[0] = item;
        itemNFT.addItems(items);
    }

    function _editItem(ItemInput memory item) private {
        ItemInput[] memory items = new ItemInput[](1);
        items[0] = item;
        itemNFT.editItems(items);
    }

    function _start(QueuedActionInput[] memory inputs) private {
        vm.prank(ALICE);
        players.startActions(playerId, inputs, ActionQueueStrategy.OVERWRITE);
    }

    function _process() private {
        vm.prank(ALICE);
        players.processActions(playerId);
    }

    function _choices(ActionChoiceInput memory choice) private pure returns (ActionChoiceInput[] memory choices) {
        choices = new ActionChoiceInput[](1);
        choices[0] = choice;
    }

    function _actions(QueuedActionInput memory a) private pure returns (QueuedActionInput[] memory x) {
        x = new QueuedActionInput[](1);
        x[0] = a;
    }

    function _actions(QueuedActionInput memory a, QueuedActionInput memory b)
        private
        pure
        returns (QueuedActionInput[] memory x)
    {
        x = new QueuedActionInput[](2);
        x[0] = a;
        x[1] = b;
    }

    function _actions(QueuedActionInput memory a, QueuedActionInput memory b, QueuedActionInput memory c)
        private
        pure
        returns (QueuedActionInput[] memory x)
    {
        x = new QueuedActionInput[](3);
        x[0] = a;
        x[1] = b;
        x[2] = c;
    }
}
