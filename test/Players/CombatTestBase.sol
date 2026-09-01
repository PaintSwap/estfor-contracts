// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {Skill, CombatStyle, CombatStats} from "../../contracts/globals/misc.sol";
import {
    ActionInput,
    ActionInfo,
    ActionQueueStrategy,
    QueuedActionInput,
    GUAR_MUL,
    RATE_MUL,
    SPAWN_MUL
} from "../../contracts/globals/actions.sol";
import {
    ActionChoiceInput,
    AvatarInfo,
    EquipPosition,
    ItemInput,
    PendingQueuedActionState
} from "../../contracts/globals/players.sol";
import {GuaranteedReward, RandomReward} from "../../contracts/globals/rewards.sol";
import {NONE, BRONZE_SWORD, TOTEM_STAFF, BASIC_BOW, SHADOW_SCROLL} from "../../contracts/globals/items.sol";

abstract contract CombatTestBase is FullGameStack {
    uint16 internal constant BRONZE_HELMET = 1;
    uint16 internal constant BRONZE_SHIELD = 2_198;
    uint16 internal constant COMBAT_MAX = 2_559;
    uint16 internal constant GODLY_BOW = 2_154;
    uint16 internal constant INFUSED_GODLY_BOW = 2_155;
    uint16 internal constant GODLY_BOW_4 = 2_159;
    uint16 internal constant GODLY_BOW_5 = 2_160;
    uint16 internal constant COOKED_MINNUS = 11_008;
    uint16 internal constant BRONZE_ARROW = 11_776;
    uint16 internal constant IRON_ARROW = 11_777;
    uint16 internal constant NATURE_SCROLL = 12_033;
    uint16 internal constant AIR_SCROLL = 12_036;
    uint16 internal constant POISON = 65_525;

    uint16 internal constant COMBAT_ACTION = 1;
    uint16 internal constant MELEE_CHOICE = 1;
    uint16 internal constant MAGIC_CHOICE = 2;
    uint16 internal constant RANGED_CHOICE = 3;
    uint256 internal constant START_XP = 374;

    function setUp() public virtual {
        deployFullGame();
    }

    function _setupMelee() internal returns (QueuedActionInput memory queuedAction, uint256 rate, uint256 numSpawned) {
        rate = GUAR_MUL;
        numSpawned = 10 * SPAWN_MUL;
        _addCombatAction(
            COMBAT_ACTION, uint24(numSpawned), CombatStats(1, 0, 0, 20, 0, 0, 0), BRONZE_ARROW, uint16(rate), true
        );

        ActionChoiceInput memory choice = _defaultChoice(Skill.MELEE);
        worldActions.addActionChoices(NONE, _uint16s(MELEE_CHOICE), _choices(choice));

        ItemInput[] memory items = new ItemInput[](4);
        items[0] = _item(BRONZE_SWORD, EquipPosition.RIGHT_HAND);
        items[0].combatStats = CombatStats(5, 0, 0, 0, 0, 0, 0);
        items[1] = _item(BRONZE_HELMET, EquipPosition.HEAD);
        items[1].combatStats = CombatStats(1, 0, 0, 1, 4, 0, 1);
        items[2] = _item(BRONZE_ARROW, EquipPosition.QUIVER);
        items[3] = _food(COOKED_MINNUS, 12);
        itemNFT.addItems(items);
        itemNFT.mintBatch(ALICE, _uints(BRONZE_SWORD, BRONZE_HELMET, COOKED_MINNUS), _uints(1, 1, 255));

        queuedAction = _combatQueue(COMBAT_ACTION, MELEE_CHOICE, COOKED_MINNUS, BRONZE_SWORD);
        queuedAction.attire.head = BRONZE_HELMET;
    }

    function _setupMagic() internal returns (QueuedActionInput memory queuedAction, uint256 rate, uint256 numSpawned) {
        rate = GUAR_MUL;
        numSpawned = 10 * SPAWN_MUL;
        _addCombatAction(
            COMBAT_ACTION, uint24(numSpawned), CombatStats(3, 0, 0, 5, 0, 0, 0), BRONZE_ARROW, uint16(rate), false
        );

        ActionChoiceInput memory choice =
            _inputChoice(Skill.MAGIC, uint24(RATE_MUL), SHADOW_SCROLL, 1, AIR_SCROLL, 2, Skill.MAGIC, 2);
        worldActions.addActionChoices(NONE, _uint16s(MAGIC_CHOICE), _choices(choice));

        ItemInput[] memory items = new ItemInput[](6);
        items[0] = _item(AIR_SCROLL, EquipPosition.MAGIC_BAG);
        items[1] = _item(SHADOW_SCROLL, EquipPosition.MAGIC_BAG);
        items[2] = _item(TOTEM_STAFF, EquipPosition.BOTH_HANDS);
        items[3] = _item(BRONZE_SHIELD, EquipPosition.LEFT_HAND);
        items[4] = _item(BRONZE_ARROW, EquipPosition.QUIVER);
        items[5] = _food(COOKED_MINNUS, 12);
        itemNFT.addItems(items);
        itemNFT.mintBatch(
            ALICE,
            _uints5(TOTEM_STAFF, BRONZE_SHIELD, COOKED_MINNUS, AIR_SCROLL, SHADOW_SCROLL),
            _uints5(1, 1, 1000, 200, 100)
        );

        queuedAction = _combatQueue(COMBAT_ACTION, MAGIC_CHOICE, COOKED_MINNUS, TOTEM_STAFF);
    }

    function _setupRanged()
        internal
        returns (QueuedActionInput memory queuedAction, uint256 rangedPlayerId, uint256 rate, uint256 numSpawned)
    {
        AvatarInfo[] memory avatars = new AvatarInfo[](1);
        avatars[0] = AvatarInfo("Ranged", "Ranged", "ranged.png", [Skill.RANGED, Skill.NONE]);
        playerNFT.setAvatars(_uints(2), avatars);
        rangedPlayerId = _createPlayer(ALICE, 2, "Ranged player", true);

        rate = GUAR_MUL;
        numSpawned = 10 * SPAWN_MUL;
        _addCombatAction(
            COMBAT_ACTION, uint24(numSpawned), CombatStats(3, 0, 0, 5, 0, 0, 0), NATURE_SCROLL, uint16(rate), false
        );

        ActionChoiceInput memory choice =
            _singleInputChoice(Skill.RANGED, uint24(RATE_MUL), BRONZE_ARROW, 1, Skill.RANGED, 2, BASIC_BOW, BASIC_BOW);
        worldActions.addActionChoices(NONE, _uint16s(RANGED_CHOICE), _choices(choice));

        ItemInput[] memory items = new ItemInput[](6);
        items[0] = _item(BRONZE_ARROW, EquipPosition.QUIVER);
        items[1] = _item(IRON_ARROW, EquipPosition.QUIVER);
        items[2] = _item(BASIC_BOW, EquipPosition.BOTH_HANDS);
        items[3] = _item(BRONZE_SHIELD, EquipPosition.LEFT_HAND);
        items[4] = _item(NATURE_SCROLL, EquipPosition.QUIVER);
        items[5] = _food(COOKED_MINNUS, 12);
        itemNFT.addItems(items);
        itemNFT.mintBatch(
            ALICE, _uints(BRONZE_SHIELD, COOKED_MINNUS, BRONZE_ARROW, IRON_ARROW), _uints(1, 1000, 200, 100)
        );

        queuedAction = _combatQueue(COMBAT_ACTION, RANGED_CHOICE, COOKED_MINNUS, BASIC_BOW);
    }

    function _addCombatAction(
        uint16 actionId,
        uint24 numSpawned,
        CombatStats memory stats,
        uint16 rewardTokenId,
        uint16 rewardRate,
        bool withRandomReward
    ) internal {
        ActionInput memory action;
        action.actionId = actionId;
        action.info = _actionInfo(Skill.COMBAT, 3600, true);
        action.info.numSpawned = numSpawned;
        action.combatStats = stats;
        if (rewardTokenId != NONE) {
            action.guaranteedRewards = new GuaranteedReward[](1);
            action.guaranteedRewards[0] = GuaranteedReward(rewardTokenId, rewardRate);
        }
        if (withRandomReward) {
            action.randomRewards = new RandomReward[](1);
            action.randomRewards[0] = RandomReward(POISON, 32_767, 1);
        }
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0] = action;
        worldActions.addActions(actions);
    }

    function _editCombatAction(uint16 actionId, uint24 numSpawned, CombatStats memory stats, uint16 rewardTokenId)
        internal
    {
        ActionInput memory action;
        action.actionId = actionId;
        action.info = _actionInfo(Skill.COMBAT, 3600, true);
        action.info.numSpawned = numSpawned;
        action.combatStats = stats;
        if (rewardTokenId != NONE) {
            action.guaranteedRewards = new GuaranteedReward[](1);
            action.guaranteedRewards[0] = GuaranteedReward(rewardTokenId, uint16(GUAR_MUL));
        }
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0] = action;
        worldActions.editActions(actions);
    }

    function _start(uint256 id, QueuedActionInput memory action) internal {
        vm.prank(ALICE);
        players.startActions(id, _actions(action), ActionQueueStrategy.OVERWRITE);
    }

    function _process(uint256 id) internal {
        vm.prank(ALICE);
        players.processActions(id);
    }

    function _pending(uint256 id) internal view returns (PendingQueuedActionState memory) {
        return players.getPendingQueuedActionState(ALICE, id);
    }

    function _assertWithinOne(uint256 actual, uint256 expected) internal pure {
        assertTrue(actual == expected || actual + 1 == expected || actual == expected + 1);
    }

    function _actionInfo(Skill skill, uint24 xpPerHour, bool choiceRequired)
        internal
        pure
        returns (ActionInfo memory info)
    {
        info.skill = uint8(skill);
        info.actionChoiceRequired = choiceRequired;
        info.xpPerHour = xpPerHour;
        info.handItemTokenIdRangeMin = NONE;
        info.handItemTokenIdRangeMax = COMBAT_MAX;
        info.successPercent = 100;
        info.isAvailable = true;
    }

    function _defaultChoice(Skill skill) internal pure returns (ActionChoiceInput memory choice) {
        choice.skill = uint8(skill);
        choice.successPercent = 100;
        choice.isAvailable = true;
    }

    function _inputChoice(
        Skill skill,
        uint24 rate,
        uint16 input1,
        uint24 amount1,
        uint16 input2,
        uint24 amount2,
        Skill requiredSkill,
        int16 skillDiff
    ) internal pure returns (ActionChoiceInput memory choice) {
        choice = _defaultChoice(skill);
        choice.rate = rate;
        choice.inputTokenIds = _uint16Array(input1, input2);
        choice.inputAmounts = new uint24[](2);
        choice.inputAmounts[0] = amount1;
        choice.inputAmounts[1] = amount2;
        choice.skills = new uint8[](1);
        choice.skills[0] = uint8(requiredSkill);
        choice.skillMinXPs = new uint32[](1);
        choice.skillDiffs = new int16[](1);
        choice.skillDiffs[0] = skillDiff;
    }

    function _singleInputChoice(
        Skill skill,
        uint24 rate,
        uint16 input,
        uint24 amount,
        Skill requiredSkill,
        int16 skillDiff,
        uint16 handMin,
        uint16 handMax
    ) internal pure returns (ActionChoiceInput memory choice) {
        choice = _defaultChoice(skill);
        choice.rate = rate;
        choice.inputTokenIds = _uint16s(input);
        choice.inputAmounts = _uint24s(amount);
        choice.skills = new uint8[](1);
        choice.skills[0] = uint8(requiredSkill);
        choice.skillMinXPs = new uint32[](1);
        choice.skillDiffs = new int16[](1);
        choice.skillDiffs[0] = skillDiff;
        choice.handItemTokenIdRangeMin = handMin;
        choice.handItemTokenIdRangeMax = handMax;
    }

    function _item(uint16 tokenId, EquipPosition position) internal pure returns (ItemInput memory item) {
        item.tokenId = tokenId;
        item.equipPosition = position;
        item.isTransferable = true;
        item.isAvailable = true;
        item.metadataURI = "test.json";
        item.name = "Test";
    }

    function _food(uint16 tokenId, uint16 healthRestored) internal pure returns (ItemInput memory item) {
        item = _item(tokenId, EquipPosition.FOOD);
        item.healthRestored = healthRestored;
    }

    function _combatQueue(uint16 actionId, uint16 choiceId, uint16 food, uint16 hand)
        internal
        pure
        returns (QueuedActionInput memory action)
    {
        action.actionId = actionId;
        action.choiceId = choiceId;
        action.regenerateId = food;
        action.rightHandEquipmentTokenId = hand;
        action.timespan = 3600;
        action.combatStyle = uint8(CombatStyle.ATTACK);
    }

    function _choices(ActionChoiceInput memory choice) internal pure returns (ActionChoiceInput[] memory choices) {
        choices = new ActionChoiceInput[](1);
        choices[0] = choice;
    }

    function _actions(QueuedActionInput memory action) internal pure returns (QueuedActionInput[] memory actions) {
        actions = new QueuedActionInput[](1);
        actions[0] = action;
    }

    function _uint16Array(uint16 a, uint16 b) internal pure returns (uint16[] memory values) {
        values = new uint16[](2);
        values[0] = a;
        values[1] = b;
    }

    function _uints(uint256 a, uint256 b, uint256 c, uint256 d) internal pure returns (uint256[] memory values) {
        values = new uint256[](4);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
    }

    function _uints5(uint256 a, uint256 b, uint256 c, uint256 d, uint256 e)
        internal
        pure
        returns (uint256[] memory values)
    {
        values = new uint256[](5);
        values[0] = a;
        values[1] = b;
        values[2] = c;
        values[3] = d;
        values[4] = e;
    }
}
