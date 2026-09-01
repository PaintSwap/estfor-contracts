// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {IPetNFT as PetNFT} from "../../contracts/interfaces/IPetNFT.sol";
import {IPlayersBase as PlayersBase} from "../../contracts/interfaces/IPlayersBase.sol";
import {IPlayersLibrary as PlayersLibrary} from "../../contracts/interfaces/IPlayersLibrary.sol";
import {Skill, Attire, CombatStyle, CombatStats} from "../../contracts/globals/misc.sol";
import {PetSkin, PetEnhancementType, Pet} from "../../contracts/globals/pets.sol";
import {
    ActionInput,
    ActionInfo,
    ActionQueueStrategy,
    QueuedActionInput,
    GUAR_MUL,
    SPAWN_MUL
} from "../../contracts/globals/actions.sol";
import {ActionChoiceInput, EquipPosition, ItemInput} from "../../contracts/globals/players.sol";
import {GuaranteedReward, RandomReward} from "../../contracts/globals/rewards.sol";

contract PlayersPetsTest is FullGameStack {
    uint16 private constant ACTION_ID = 1;
    uint16 private constant CHOICE_ID = 1;
    uint16 private constant BRONZE_ARROW = 11_776;
    uint16 private constant COOKED_MINNUS = 11_008;
    uint16 private constant SHADOW_SCROLL = 12_032;
    uint16 private constant NATURE_SCROLL = 12_033;
    uint16 private constant PAPER = 65_496;
    uint16 private constant ANCIENT_SCROLL = 12_039;
    uint24 private constant PET_BASE_ID = 1;
    uint24 private constant ALCHEMY_PET_BASE_ID = 2_001;
    uint40 private constant PET_ID = 1;
    uint56 private constant LEVEL_FIVE_XP = 374;

    function setUp() public {
        deployFullGame();
        brush.mint(ALICE, 10 ether);
        vm.prank(ALICE);
        brush.approve(address(playerNFT), type(uint256).max);
    }

    function testQueuePetNotOwned() public {
        QueuedActionInput memory action = _setupCombat(PET_ID);
        _upgradePlayer();
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.PetNotOwned.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
    }

    function testCombatPetRequiresEvolvedPlayerThenAddsXP() public {
        _mintPet(_meleePet(0, 0, 100, 101));
        _setMeleeLevelFive();
        QueuedActionInput memory action = _setupCombat(PET_ID);
        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.PlayerNotUpgraded.selector);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
        _upgradePlayer();
        _start(action);
        vm.warp(block.timestamp + 72);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), LEVEL_FIVE_XP + 36);
    }

    function testCombatPetPartialActionConsumption() public {
        _prepareMeleePet(0, 0, 100, 101);
        QueuedActionInput memory action = _setupCombat(PET_ID);
        _start(action);
        vm.warp(block.timestamp + 62);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), LEVEL_FIVE_XP);
        vm.warp(block.timestamp + 10);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), LEVEL_FIVE_XP + 36);
    }

    function testTransferredPetNoLongerUsed() public {
        _prepareMeleePet(0, 0, 100, 101);
        QueuedActionInput memory action = _setupCombat(PET_ID);
        _start(action);
        Pet memory pet = petNFT.getPet(PET_ID);
        assertEq(pet.lastAssignmentTimestamp, vm.getBlockTimestamp());
        vm.warp(vm.getBlockTimestamp() + 1);
        vm.prank(ALICE);
        petNFT.safeTransferFrom(ALICE, address(this), PET_ID, 1, "");
        pet = petNFT.getPet(PET_ID);
        assertEq(pet.owner, address(this));
        assertEq(pet.lastAssignmentTimestamp, vm.getBlockTimestamp());
        vm.warp(vm.getBlockTimestamp() + 1);
        petNFT.safeTransferFrom(address(this), ALICE, PET_ID, 1, "");
        vm.warp(vm.getBlockTimestamp() + 72);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), LEVEL_FIVE_XP);
    }

    function testTransferredPetCanBeUsedForLaterQueuedAction() public {
        _prepareMeleePet(0, 0, 100, 101);
        QueuedActionInput memory action = _setupCombat(PET_ID);
        QueuedActionInput[] memory actions = new QueuedActionInput[](2);
        actions[0] = action;
        actions[1] = action;
        vm.prank(ALICE);
        players.startActions(playerId, actions, ActionQueueStrategy.OVERWRITE);
        vm.warp(vm.getBlockTimestamp() + 1);
        vm.prank(ALICE);
        petNFT.safeTransferFrom(ALICE, address(this), PET_ID, 1, "");
        vm.warp(vm.getBlockTimestamp() + 1);
        petNFT.safeTransferFrom(address(this), ALICE, PET_ID, 1, "");
        uint256 foodBalance = itemNFT.balanceOf(ALICE, COOKED_MINNUS);
        vm.prank(ALICE);
        itemNFT.burn(ALICE, COOKED_MINNUS, foodBalance);
        assertEq(players.getActionQueue(playerId).length, 2);
        vm.warp(vm.getBlockTimestamp() + action.timespan);
        _process();
        assertEq(players.getActionQueue(playerId).length, 1);
        itemNFT.mint(ALICE, COOKED_MINNUS, 20_000);
        vm.warp(vm.getBlockTimestamp() + 72);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), LEVEL_FIVE_XP + 36);
    }

    function testCombatPetStartActionsAdvanced() public {
        _prepareMeleePet(0, 0, 100, 101);
        QueuedActionInput memory action = _setupCombat(PET_ID);
        vm.prank(ALICE);
        players.startActionsAdvanced(playerId, _actions(action), 0, 1, 0, 0, ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + 72);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), LEVEL_FIVE_XP + 36);
    }

    function testCombatPetPercentageAndFixedBonus() public {
        _prepareMeleePet(2, 2, 60, 60);
        QueuedActionInput memory action = _setupCombat(PET_ID);
        _start(action);
        vm.warp(block.timestamp + 72);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.MELEE), LEVEL_FIVE_XP + 36);
    }

    function testAlchemyPetGivesXPBonus() public {
        _prepareAlchemyPet(5);
        QueuedActionInput memory action = _setupAlchemy(1_000, 1, PET_ID);
        _start(action);
        vm.warp(block.timestamp + 3_600);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), 3_780);
    }

    function testMismatchedMeleePetDoesNotBoostAlchemy() public {
        _mintPet(_meleePet(0, 0, 50, 51));
        _upgradePlayer();
        QueuedActionInput memory action = _setupAlchemy(1_000, 1, PET_ID);
        _start(action);
        vm.warp(block.timestamp + 3_600);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), 3_600);
    }

    function testAlchemyPetWithCombatReverts() public {
        _mintPet(_alchemyPet(50));
        _setMeleeLevelFive();
        _upgradePlayer();
        QueuedActionInput memory action = _setupCombat(PET_ID);
        _start(action);
        vm.warp(block.timestamp + 72);
        vm.prank(ALICE);
        vm.expectRevert(PlayersLibrary.SkillForPetNotHandledYet.selector);
        players.processActions(playerId);
    }

    function testTransferredAlchemyPetDoesNotBoostStartedAction() public {
        _prepareAlchemyPet(5);
        QueuedActionInput memory action = _setupAlchemy(1_000, 1, PET_ID);
        _start(action);
        vm.prank(ALICE);
        petNFT.safeTransferFrom(ALICE, address(this), PET_ID, 1, "");
        vm.warp(block.timestamp + 3_600);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), 3_600);
    }

    function testReturnedAlchemyPetBoostsOnlyLaterQueuedAction() public {
        _prepareAlchemyPet(5);
        QueuedActionInput memory action = _setupAlchemy(1_000, 1, PET_ID);
        QueuedActionInput[] memory actions = new QueuedActionInput[](2);
        actions[0] = action;
        actions[1] = action;
        uint256 startedAt = block.timestamp;
        vm.prank(ALICE);
        players.startActions(playerId, actions, ActionQueueStrategy.OVERWRITE);
        vm.warp(startedAt + 1);
        vm.prank(ALICE);
        petNFT.safeTransferFrom(ALICE, address(this), PET_ID, 1, "");
        vm.warp(startedAt + 2);
        petNFT.safeTransferFrom(address(this), ALICE, PET_ID, 1, "");
        vm.warp(startedAt + 2 + 3_600);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), 3_600);
        vm.warp(startedAt + 2 + 7_200);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), 7_380);
    }

    function testAlchemyPetStartActionsAdvanced() public {
        _prepareAlchemyPet(5);
        QueuedActionInput memory action = _setupAlchemy(1_000, 1, PET_ID);
        vm.prank(ALICE);
        players.startActionsAdvanced(playerId, _actions(action), 0, 1, 0, 0, ActionQueueStrategy.OVERWRITE);
        vm.warp(block.timestamp + 3_600);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), 3_780);
    }

    function testAlchemyPetPartialActionConsumption() public {
        _prepareAlchemyPet(5);
        QueuedActionInput memory action = _setupAlchemy(2_000, 2, PET_ID);
        _start(action);
        vm.warp(block.timestamp + 1_801);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), 1_890);
        vm.warp(block.timestamp + 1_800);
        _process();
        assertEq(players.getPlayerXP(playerId, Skill.ALCHEMY), 3_780);
    }

    function _prepareMeleePet(uint8 fixedMin, uint8 fixedMax, uint8 percentMin, uint8 percentMax) private {
        _mintPet(_meleePet(fixedMin, fixedMax, percentMin, percentMax));
        _setMeleeLevelFive();
        _upgradePlayer();
    }

    function _prepareAlchemyPet(uint8 percent) private {
        _mintPet(_alchemyPet(percent));
        _upgradePlayer();
    }

    function _upgradePlayer() private {
        vm.prank(ALICE);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
    }

    function _setMeleeLevelFive() private {
        players.modifyXP(ALICE, playerId, Skill.MELEE, _xpAtLevel(5), true);
    }

    function _mintPet(PetNFT.BasePetInput memory input) private {
        PetNFT.BasePetInput[] memory inputs = new PetNFT.BasePetInput[](1);
        inputs[0] = input;
        petNFT.addBasePets(inputs);
        vm.prank(ALICE);
        petNFT.mintBatch(ALICE, _uints(input.baseId), 0);
    }

    function _meleePet(uint8 fixedMin, uint8 fixedMax, uint8 percentMin, uint8 percentMax)
        private
        pure
        returns (PetNFT.BasePetInput memory input)
    {
        input.tier = 1;
        input.skin = PetSkin.DEFAULT;
        input.enhancementType = PetEnhancementType.MELEE;
        input.baseId = PET_BASE_ID;
        input.isTransferable = true;
        input.skillEnhancements = [Skill.MELEE, Skill.NONE];
        input.skillFixedMins = [fixedMin, uint8(0)];
        input.skillFixedMaxs = [fixedMax, uint8(0)];
        input.skillFixedIncrements = [uint8(1), 0];
        input.skillPercentageMins = [percentMin, uint8(0)];
        input.skillPercentageMaxs = [percentMax, uint8(0)];
        input.skillPercentageIncrements = [uint8(1), 0];
        input.skillMinLevels = [uint8(1), 0];
        input.fixedStarThreshold = 1;
        input.percentageStarThreshold = 1;
    }

    function _alchemyPet(uint8 percent) private pure returns (PetNFT.BasePetInput memory input) {
        input.tier = 1;
        input.skin = PetSkin.RIFT;
        input.enhancementType = PetEnhancementType.ALCHEMY;
        input.baseId = ALCHEMY_PET_BASE_ID;
        input.isTransferable = true;
        input.skillEnhancements = [Skill.ALCHEMY, Skill.NONE];
        input.skillPercentageMins = [percent, uint8(0)];
        input.skillPercentageMaxs = [percent, uint8(0)];
        input.skillPercentageIncrements = [uint8(1), 0];
        input.skillMinLevels = [uint8(1), 0];
        input.fixedStarThreshold = 1;
        input.percentageStarThreshold = 1;
    }

    function _setupCombat(uint40 petId) private returns (QueuedActionInput memory action) {
        GuaranteedReward[] memory rewards = new GuaranteedReward[](1);
        rewards[0] = GuaranteedReward(BRONZE_ARROW, uint16(GUAR_MUL));
        ActionInput[] memory inputs = new ActionInput[](1);
        inputs[0] = ActionInput({
            actionId: ACTION_ID,
            info: ActionInfo(
                uint8(Skill.COMBAT), true, 3_600, 0, uint24(100 * SPAWN_MUL), 2_048, 2_559, 100, 0, false, true, 0
            ),
            guaranteedRewards: rewards,
            randomRewards: new RandomReward[](0),
            combatStats: CombatStats(1, 0, 0, 36, 0, 0, 0)
        });
        worldActions.addActions(inputs);
        ActionChoiceInput memory choice;
        choice.skill = uint8(Skill.MELEE);
        choice.isAvailable = true;
        worldActions.addActionChoices(0, _uint16s(ACTION_ID), _choices(choice));
        ItemInput[] memory items = new ItemInput[](1);
        items[0].tokenId = COOKED_MINNUS;
        items[0].equipPosition = EquipPosition.FOOD;
        items[0].healthRestored = 12;
        items[0].isAvailable = true;
        itemNFT.addItems(items);
        itemNFT.mint(ALICE, COOKED_MINNUS, 20_000);
        action = QueuedActionInput(
            Attire(0, 0, 0, 0, 0, 0, 0, 0),
            ACTION_ID,
            COOKED_MINNUS,
            CHOICE_ID,
            0,
            0,
            3_600,
            uint8(CombatStyle.ATTACK),
            petId
        );
    }

    function _setupAlchemy(uint24 rate, uint8 outputAmount, uint40 petId)
        private
        returns (QueuedActionInput memory action)
    {
        ActionInput[] memory inputs = new ActionInput[](1);
        inputs[0] = ActionInput({
            actionId: ACTION_ID,
            info: ActionInfo(uint8(Skill.ALCHEMY), true, 0, 0, 0, 0, 0, 100, 0, false, true, 0),
            guaranteedRewards: new GuaranteedReward[](0),
            randomRewards: new RandomReward[](0),
            combatStats: CombatStats(0, 0, 0, 0, 0, 0, 0)
        });
        worldActions.addActions(inputs);
        ActionChoiceInput memory choice;
        choice.skill = uint8(Skill.ALCHEMY);
        choice.rate = rate;
        choice.xpPerHour = 3_600;
        choice.inputTokenIds = _uint16s(SHADOW_SCROLL, NATURE_SCROLL, PAPER);
        choice.inputAmounts = _uint24s(1, 1, 2);
        choice.outputTokenId = ANCIENT_SCROLL;
        choice.outputAmount = outputAmount;
        choice.successPercent = 100;
        choice.isAvailable = true;
        worldActions.addActionChoices(ACTION_ID, _uint16s(ACTION_ID), _choices(choice));
        uint16[] memory tokenIds = _uint16s(SHADOW_SCROLL, NATURE_SCROLL, PAPER, ANCIENT_SCROLL);
        ItemInput[] memory items = new ItemInput[](tokenIds.length);
        for (uint256 i; i < tokenIds.length; ++i) {
            items[i].tokenId = tokenIds[i];
            items[i].isAvailable = true;
        }
        itemNFT.addItems(items);
        itemNFT.mint(ALICE, SHADOW_SCROLL, 100);
        itemNFT.mint(ALICE, NATURE_SCROLL, 100);
        itemNFT.mint(ALICE, PAPER, 200);
        action = QueuedActionInput(Attire(0, 0, 0, 0, 0, 0, 0, 0), ACTION_ID, 0, CHOICE_ID, 0, 0, 3_600, 0, petId);
    }

    function _start(QueuedActionInput memory action) private {
        vm.prank(ALICE);
        players.startActions(playerId, _actions(action), ActionQueueStrategy.OVERWRITE);
    }

    function _process() private {
        vm.prank(ALICE);
        players.processActions(playerId);
    }

    function _actions(QueuedActionInput memory action) private pure returns (QueuedActionInput[] memory actions) {
        actions = new QueuedActionInput[](1);
        actions[0] = action;
    }

    function _choices(ActionChoiceInput memory choice) private pure returns (ActionChoiceInput[] memory choices) {
        choices = new ActionChoiceInput[](1);
        choices[0] = choice;
    }
}
