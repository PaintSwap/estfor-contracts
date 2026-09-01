// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";

import {FullGameStack} from "./utils/FullGameStack.sol";
import {PVPBattleground} from "./interfaces/PVPBattleground.sol";
import {MockVRF} from "../contracts/test/MockVRF.sol";
import {BattleResultEnum} from "../contracts/globals/clans.sol";
import {Skill} from "../contracts/globals/misc.sol";

contract PVPBattlegroundTest is FullGameStack {
    uint256 private constant ATTACK_COOLDOWN = 3600;
    uint256 private constant UPGRADE_PLAYER_BRUSH_PRICE = 1 ether;
    bytes32 private constant BATTLE_RESULT_TOPIC =
        keccak256("BattleResult(uint256,uint256,uint256,uint256[],uint256[],uint8[],uint8[],bool,uint256[])");

    uint256 private defendingPlayerId;

    function setUp() public {
        deployFullGame();
        defendingPlayerId = _createPlayer(address(this), 1, "New name", true);
        vm.deal(ALICE, 100 ether);
    }

    function testBasicComparisonOfSkillLevel() public {
        Skill[] memory skills = _skills(Skill.FISHING);
        // randomWords[0] is the random word deciding dice rolls for the attacker,
        // randomWords[1] is the random word deciding dice rolls for the defender
        uint256[] memory randomWords = _words(1, 1);

        players.modifyXP(ALICE, playerId, skills[0], 1000, true);

        (,,, bool didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, randomWords, 0, 0
        );
        assertTrue(didAttackerWin);

        randomWords = _words(1, 0);
        (,,, didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, randomWords, 0, 0
        );
        assertTrue(didAttackerWin);

        randomWords = _words(0, 1);
        (,,, didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, randomWords, 0, 0
        );
        assertFalse(didAttackerWin);
    }

    function testEvolvedHeroGetsAnExtraRoll() public {
        Skill[] memory skills = _skills(Skill.FISHING);
        uint256[] memory randomWords = _words(3, 3);
        players.modifyXP(address(this), defendingPlayerId, skills[0], _xpAtLevel(20), true);

        (,,, bool didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, randomWords, 0, 0
        );
        assertFalse(didAttackerWin);

        brush.mint(ALICE, UPGRADE_PLAYER_BRUSH_PRICE);
        vm.startPrank(ALICE);
        brush.approve(address(playerNFT), UPGRADE_PLAYER_BRUSH_PRICE);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
        vm.stopPrank();

        (,,, didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, randomWords, 0, 0
        );
        assertTrue(didAttackerWin);
    }

    function testExtraRolls() public {
        Skill[] memory skills = _skills(Skill.FISHING);
        uint256[] memory randomWords = _words(3, 3);
        players.modifyXP(address(this), defendingPlayerId, skills[0], _xpAtLevel(20), true);

        (,,, bool didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, randomWords, 0, 0
        );
        assertFalse(didAttackerWin);

        (,,, didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, randomWords, 1, 0
        );
        assertTrue(didAttackerWin);
    }

    function testNonexistentPlayerIsAnAutomaticWinForTheOtherSide() public {
        Skill[] memory skills = _skills(Skill.FISHING);
        uint256[] memory randomWords = _words(1, 3);
        players.modifyXP(ALICE, playerId, skills[0], _xpAtLevel(20), true);

        (,,, bool didAttackerWin) =
            pvpBattleground.determineBattleOutcome(uint64(playerId), 0, skills, randomWords, 0, 0);
        assertTrue(didAttackerWin);

        players.modifyXP(address(this), defendingPlayerId, skills[0], _xpAtLevel(20), true);
        (,,, didAttackerWin) =
            pvpBattleground.determineBattleOutcome(0, uint64(defendingPlayerId), skills, randomWords, 0, 0);
        assertFalse(didAttackerWin);
    }

    function testTwoNonexistentPlayersIsAWinForTheAttacker() public view {
        (,,, bool didAttackerWin) =
            pvpBattleground.determineBattleOutcome(0, 0, _skills(Skill.FISHING), _words(1, 3), 0, 0);
        assertTrue(didAttackerWin);
    }

    function testDifferentSkills() public {
        Skill[] memory skills = _skills(Skill.FISHING, Skill.WOODCUTTING);
        uint256[] memory randomWords = _words(0x30003, 0x30003);
        players.modifyXP(address(this), defendingPlayerId, Skill.WOODCUTTING, _xpAtLevel(20), true);

        (BattleResultEnum[] memory results,,, bool didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, randomWords, 0, 0
        );
        assertEq(uint8(results[0]), uint8(BattleResultEnum.DRAW));
        assertEq(uint8(results[1]), uint8(BattleResultEnum.LOSE));
        assertFalse(didAttackerWin);

        players.modifyXP(ALICE, playerId, Skill.FISHING, _xpAtLevel(20), true);
        (results,,, didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, randomWords, 0, 0
        );
        assertEq(uint8(results[0]), uint8(BattleResultEnum.WIN));
        assertEq(uint8(results[1]), uint8(BattleResultEnum.LOSE));
        assertTrue(didAttackerWin);
    }

    function testDifferentRandomWordsYieldDifferentResults() public {
        Skill[] memory skills = _skills(Skill.FISHING);
        players.modifyXP(ALICE, playerId, skills[0], _xpAtLevel(60), true);
        players.modifyXP(address(this), defendingPlayerId, skills[0], _xpAtLevel(60), true);

        uint256 attackerWins;
        uint256 defenderWins;
        for (uint256 i; i < 50; ++i) {
            (,,, bool didAttackerWin) = pvpBattleground.determineBattleOutcome(
                uint64(playerId), uint64(defendingPlayerId), skills, _words(i, 1), 0, 0
            );
            if (didAttackerWin) {
                ++attackerWins;
            } else {
                ++defenderWins;
            }
        }

        assertGt(attackerWins, defenderWins + 10);
    }

    function testMoreThanEightRollsUsesMultipleBytes() public {
        Skill[] memory skills = _skills(Skill.FISHING);
        players.modifyXP(ALICE, playerId, skills[0], _xpAtLevel(40), true);
        players.modifyXP(address(this), defendingPlayerId, skills[0], _xpAtLevel(40), true);

        (,,, bool didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, _words(0x100, 0x001), 8, 8
        );
        assertTrue(didAttackerWin);

        (,,, didAttackerWin) = pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), skills, _words(0x100, 0x101), 8, 8
        );
        assertFalse(didAttackerWin);
    }

    function testRequiresAtLeastTwoRandomWords() public {
        uint256[] memory randomWords = new uint256[](1);
        vm.expectRevert(PVPBattleground.NotEnoughRandomWords.selector);
        pvpBattleground.determineBattleOutcome(
            uint64(playerId), uint64(defendingPlayerId), _skills(Skill.FISHING), randomWords, 0, 0
        );
    }

    function testCannotAttackOwnPlayer() public {
        uint256 attackCost = pvpBattleground.getAttackCost();
        vm.expectRevert(PVPBattleground.CannotAttackSelf.selector);
        vm.prank(ALICE);
        pvpBattleground.attackPlayer{value: attackCost}(playerId, playerId);
    }

    function testPlayerInfoIsSetAfterAttacking() public {
        _attack();

        PVPBattleground.PlayerInfo memory info = pvpBattleground.getPlayerInfo(playerId);
        assertEq(info.attackingCooldownTimestamp, block.timestamp + ATTACK_COOLDOWN);
        assertTrue(info.currentlyAttacking);

        mockVRF.fulfill(1, address(pvpBattleground));
        info = pvpBattleground.getPlayerInfo(playerId);
        assertFalse(info.currentlyAttacking);
    }

    function testCannotFulfillMoreThanOnce() public {
        _attack();
        mockVRF.fulfill(1, address(pvpBattleground));

        vm.expectRevert(PVPBattleground.RequestIdNotKnown.selector);
        mockVRF.fulfill(1, address(pvpBattleground));
    }

    function testAttackingHasACooldown() public {
        _attack();
        mockVRF.fulfill(1, address(pvpBattleground));

        uint256 attackCost = pvpBattleground.getAttackCost();
        uint256 cooldownTimestamp = pvpBattleground.getPlayerInfo(playerId).attackingCooldownTimestamp;
        vm.expectRevert(PVPBattleground.PlayerAttackingCooldown.selector);
        vm.prank(ALICE);
        pvpBattleground.attackPlayer{value: attackCost}(playerId, defendingPlayerId);

        vm.warp(cooldownTimestamp - 10);
        vm.expectRevert(PVPBattleground.PlayerAttackingCooldown.selector);
        vm.prank(ALICE);
        pvpBattleground.attackPlayer{value: attackCost}(playerId, defendingPlayerId);

        vm.warp(cooldownTimestamp);
        vm.prank(ALICE);
        pvpBattleground.attackPlayer{value: attackCost}(playerId, defendingPlayerId);
    }

    function testAttacksNeverUseTheSameSkillTwice() public {
        bool[20] memory seenSkills;
        for (uint256 i; i < 50; ++i) {
            _attack();
            Skill[] memory randomSkills = _fulfillAndGetRandomSkills(i + 1);
            assertEq(randomSkills.length, 8);

            bool[20] memory seenThisBattle;
            for (uint256 j; j < randomSkills.length; ++j) {
                uint256 skill = uint256(randomSkills[j]);
                assertFalse(seenThisBattle[skill]);
                seenThisBattle[skill] = true;
                seenSkills[skill] = true;
            }
            vm.warp(pvpBattleground.getPlayerInfo(playerId).attackingCooldownTimestamp);
        }

        Skill[] memory expectedSkills = _battleSkills();
        for (uint256 i; i < expectedSkills.length; ++i) {
            assertTrue(seenSkills[uint256(expectedSkills[i])]);
        }
    }

    function testCannotFulfillAnUnknownRequest() public {
        _attack();
        vm.expectRevert(PVPBattleground.RequestIdNotKnown.selector);
        mockVRF.fulfill(3, address(pvpBattleground));
    }

    function testMustPayTheRequestCost() public {
        uint256 attackCost = pvpBattleground.getAttackCost();
        vm.expectRevert(abi.encodeWithSelector(MockVRF.InsufficientGasPayment.selector, attackCost - 1, attackCost));
        vm.prank(ALICE);
        pvpBattleground.attackPlayer{value: attackCost - 1}(playerId, defendingPlayerId);
    }

    function _attack() private {
        uint256 attackCost = pvpBattleground.getAttackCost();
        vm.prank(ALICE);
        pvpBattleground.attackPlayer{value: attackCost}(playerId, defendingPlayerId);
    }

    function _fulfillAndGetRandomSkills(uint256 requestId) private returns (Skill[] memory randomSkills) {
        vm.recordLogs();
        mockVRF.fulfill(requestId, address(pvpBattleground));
        Vm.Log[] memory logs = vm.getRecordedLogs();

        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(pvpBattleground) && logs[i].topics[0] == BATTLE_RESULT_TOPIC) {
                (
                    uint256 loggedRequestId,
                    uint256 attackingPlayerId,
                    uint256 loggedDefendingPlayerId,
                    uint256[] memory attackingRolls,
                    uint256[] memory defendingRolls,
                    BattleResultEnum[] memory results,
                    Skill[] memory loggedRandomSkills,
                    bool didAttackersWin,
                    uint256[] memory randomWords
                ) = abi.decode(
                    logs[i].data,
                    (uint256, uint256, uint256, uint256[], uint256[], BattleResultEnum[], Skill[], bool, uint256[])
                );
                assertEq(loggedRequestId, requestId);
                assertEq(attackingPlayerId, playerId);
                assertEq(loggedDefendingPlayerId, defendingPlayerId);
                attackingRolls;
                defendingRolls;
                results;
                didAttackersWin;
                randomWords;
                return loggedRandomSkills;
            }
        }

        fail("BattleResult event not found");
    }

    function _skills(Skill a) private pure returns (Skill[] memory skills) {
        skills = new Skill[](1);
        skills[0] = a;
    }

    function _skills(Skill a, Skill b) private pure returns (Skill[] memory skills) {
        skills = new Skill[](2);
        skills[0] = a;
        skills[1] = b;
    }

    function _words(uint256 a, uint256 b) private pure returns (uint256[] memory words) {
        words = new uint256[](2);
        words[0] = a;
        words[1] = b;
    }
}
