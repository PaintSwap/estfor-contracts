// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ClanBattleLibrary} from "../contracts/Clans/ClanBattleLibrary.sol";
import {Skill} from "../contracts/globals/misc.sol";
import {BattleResultEnum} from "../contracts/globals/clans.sol";

contract ClanBattlePlayersStub {
  mapping(uint256 playerId => mapping(Skill skill => uint256 xp)) private _xp;
  mapping(uint256 playerId => uint256 timestamp) private _lastActive;

  function setXP(uint256 playerId, Skill skill, uint256 xp) external {
    _xp[playerId][skill] = xp;
  }

  function setLastActiveTimestamp(uint256 playerId, uint256 timestamp) external {
    _lastActive[playerId] = timestamp;
  }

  function getPlayerXP(uint256 playerId, Skill skill) external view returns (uint256) {
    return _xp[playerId][skill];
  }

  function getLastActiveTimestamp(uint256 playerId) external view returns (uint256) {
    return _lastActive[playerId];
  }
}

contract ClanBattleLibraryTest is Test {
  uint256 private constant XP_LEVEL_2 = 84;
  uint256 private constant XP_LEVEL_3 = 174;
  uint256 private constant XP_LEVEL_4 = 270;
  uint256 private constant XP_LEVEL_5 = 374;
  uint256 private constant XP_LEVEL_6 = 486;
  uint256 private constant XP_LEVEL_20 = 3_236;
  uint256 private constant XP_LEVEL_40 = 16_432;
  uint256 private constant XP_LEVEL_60 = 68_761;
  uint256 private constant XP_LEVEL_99 = 1_035_476;

  ClanBattlePlayersStub private players;

  function setUp() public {
    vm.warp(30 days);
    players = new ClanBattlePlayersStub();
    for (uint256 i = 1; i <= 40; ++i) {
      players.setLastActiveTimestamp(i, block.timestamp);
    }
  }

  function _members(uint256 length, uint64 playerId) private pure returns (uint64[] memory result) {
    result = new uint64[](length);
    for (uint256 i; i < length; ++i) {
      result[i] = playerId;
    }
  }

  function _skills(uint256 length, Skill skill) private pure returns (uint8[] memory result) {
    result = new uint8[](length);
    for (uint256 i; i < length; ++i) {
      result[i] = uint8(skill);
    }
  }

  function _words(
    uint256 a0,
    uint256 a1,
    uint256 a2,
    uint256 b0,
    uint256 b1,
    uint256 b2
  ) private pure returns (uint256[] memory result) {
    result = new uint256[](6);
    result[0] = a0;
    result[1] = a1;
    result[2] = a2;
    result[3] = b0;
    result[4] = b1;
    result[5] = b2;
  }

  function _battle(
    uint64[] memory a,
    uint64[] memory b,
    uint8[] memory skills,
    uint256[] memory words,
    uint256 extraA,
    uint256 extraB
  )
    private
    view
    returns (
      uint8[] memory results,
      uint256[] memory rollsA,
      uint256[] memory rollsB,
      bool didAWin,
      uint64[] memory shuffledA,
      uint64[] memory shuffledB
    )
  {
    return ClanBattleLibrary.determineBattleOutcome(address(players), a, b, skills, words, extraA, extraB);
  }

  function testBasicComparisonOfSkillLevel() public view {
    uint64[] memory members = _members(1, 1);
    uint8[] memory skills = _skills(1, Skill.FISHING);
    (, , , bool won, , ) = _battle(members, members, skills, _words(0, 1, 0, 0, 1, 0), 0, 0);
    assertTrue(won);
    (, , , won, , ) = _battle(members, members, skills, _words(0, 1, 0, 0, 0, 0), 0, 0);
    assertTrue(won);
    (, , , won, , ) = _battle(members, members, skills, _words(0, 0, 0, 0, 1, 0), 0, 0);
    assertFalse(won);
  }

  function testExtraRollsWork() public {
    players.setXP(2, Skill.FISHING, XP_LEVEL_20);
    uint8[] memory skills = _skills(1, Skill.FISHING);
    (, , , bool won, , ) = _battle(_members(1, 1), _members(1, 2), skills, _words(0, 3, 0, 0, 3, 0), 0, 0);
    assertFalse(won);
    (, , , won, , ) = _battle(_members(1, 1), _members(1, 2), skills, _words(0, 3, 0, 0, 3, 0), 1, 0);
    assertTrue(won);
  }

  function testMismatchedPlayerCounts() public view {
    uint8[] memory skills = _skills(1, Skill.FISHING);
    uint64[] memory empty = new uint64[](0);
    (uint8[] memory results, , , bool won, , ) = _battle(_members(1, 1), empty, skills, _words(0, 1, 0, 0, 3, 0), 0, 0);
    assertTrue(won);
    assertEq(results[0], uint8(BattleResultEnum.WIN));
    (results, , , won, , ) = _battle(empty, _members(1, 1), skills, _words(0, 1, 0, 0, 3, 0), 0, 0);
    assertFalse(won);
    assertEq(results[0], uint8(BattleResultEnum.LOSE));
  }

  function testMismatchedCountsWithInactivePlayers() public {
    uint8[] memory skills = _skills(1, Skill.FISHING);
    uint64[] memory empty = new uint64[](0);
    (uint8[] memory results, , , bool won, , ) = _battle(_members(1, 1), empty, skills, _words(0, 1, 0, 0, 3, 0), 0, 0);
    assertTrue(won);
    assertEq(results[0], uint8(BattleResultEnum.WIN));
    vm.warp(block.timestamp + 15 days);
    players.setLastActiveTimestamp(2, block.timestamp);
    (results, , , won, , ) = _battle(_members(1, 2), _members(2, 1), skills, _words(0, 1, 0, 0, 3, 0), 0, 0);
    assertTrue(won);
    assertEq(results[0], uint8(BattleResultEnum.WIN));
  }

  function testZeroPlayerIdsAutomaticallyLose() public view {
    uint8[] memory skills = _skills(1, Skill.FISHING);
    (, , , bool won, , ) = _battle(_members(1, 1), _members(1, 0), skills, _words(0, 1, 0, 0, 3, 0), 0, 0);
    assertTrue(won);
    (, , , won, , ) = _battle(_members(1, 0), _members(1, 1), skills, _words(0, 1, 0, 0, 3, 0), 0, 0);
    assertFalse(won);
  }

  function testMultipleClanMembers() public {
    players.setXP(1, Skill.FISHING, XP_LEVEL_20);
    players.setXP(2, Skill.FISHING, XP_LEVEL_40);
    uint8[] memory skills = _skills(2, Skill.FISHING);
    (, , , bool won, , ) = _battle(_members(2, 1), _members(2, 1), skills, _words(0, 3, 0, 0, 1, 0), 0, 0);
    assertTrue(won);
    uint64[] memory mixed = _members(2, 1);
    mixed[1] = 2;
    (, , , won, , ) = _battle(mixed, _members(2, 1), skills, _words(0, 3, 0, 0, 1, 0), 0, 0);
    assertTrue(won);
    (, , , won, , ) = _battle(_members(2, 1), mixed, skills, _words(0, 1, 0, 0, 3, 0), 0, 0);
    assertFalse(won);
  }

  function testInactivePlayersRollZeroes() public {
    players.setXP(1, Skill.FISHING, XP_LEVEL_20);
    uint8[] memory skills = _skills(2, Skill.FISHING);
    (, , , bool won, , ) = _battle(_members(2, 1), _members(2, 1), skills, _words(0, 3, 0, 0, 1, 0), 0, 0);
    assertTrue(won);
    players.setXP(2, Skill.FISHING, XP_LEVEL_40);
    uint64[] memory mixed = _members(2, 1);
    mixed[0] = 2;
    (, , , won, , ) = _battle(_members(2, 1), mixed, skills, _words(0, 3, 0, 0, 3, 0), 0, 0);
    assertTrue(won);
    vm.warp(block.timestamp + 15 days);
    players.setXP(3, Skill.FISHING, XP_LEVEL_40);
    players.setLastActiveTimestamp(3, block.timestamp);
    mixed[0] = 3;
    (, , , won, , ) = _battle(_members(2, 1), mixed, skills, _words(0, 3, 0, 0, 3, 0), 0, 0);
    assertFalse(won);
  }

  function testMultipleMembersWithDifferentSkills() public {
    players.setXP(2, Skill.WOODCUTTING, XP_LEVEL_20);
    uint8[] memory skills = new uint8[](2);
    skills[0] = uint8(Skill.FISHING);
    skills[1] = uint8(Skill.WOODCUTTING);
    uint256 dice = 0x30003;
    (uint8[] memory results, , , bool won, , ) = _battle(
      _members(2, 1),
      _members(2, 2),
      skills,
      _words(0, dice, 0, 0, dice, 0),
      0,
      0
    );
    assertEq(results[0], uint8(BattleResultEnum.DRAW));
    assertEq(results[1], uint8(BattleResultEnum.LOSE));
    assertFalse(won);
    players.setXP(1, Skill.FISHING, XP_LEVEL_20);
    (results, , , won, , ) = _battle(_members(2, 1), _members(2, 2), skills, _words(0, dice, 0, 0, dice, 0), 0, 0);
    assertEq(results[0], uint8(BattleResultEnum.WIN));
    assertEq(results[1], uint8(BattleResultEnum.LOSE));
    assertTrue(won);
  }

  function testDifferentRandomWordsYieldDifferentResults() public {
    players.setXP(1, Skill.FISHING, XP_LEVEL_60);
    uint256 winsA;
    uint256 winsB;
    for (uint256 i; i < 50; ++i) {
      (, , , bool won, , ) = _battle(
        _members(2, 1),
        _members(2, 1),
        _skills(2, Skill.FISHING),
        _words(0, i, 0, 0, 1, 0),
        0,
        0
      );
      if (won) ++winsA;
      else ++winsB;
    }
    assertGt(winsA, winsB + 10);
  }

  function testShufflingOrderChangesOutcome() public {
    uint256[4] memory xpA = [XP_LEVEL_99, XP_LEVEL_5, XP_LEVEL_3, XP_LEVEL_3];
    uint256[4] memory xpB = [XP_LEVEL_6, XP_LEVEL_6, XP_LEVEL_4, XP_LEVEL_2];
    uint64[] memory a = new uint64[](4);
    uint64[] memory b = new uint64[](4);
    for (uint256 i; i < 4; ++i) {
      a[i] = uint64(i + 1);
      b[i] = uint64(i + 5);
      players.setXP(i + 1, Skill.FISHING, xpA[i]);
      players.setXP(i + 5, Skill.FISHING, xpB[i]);
    }
    (, , , bool initial, , ) = _battle(a, b, _skills(4, Skill.FISHING), _words(0, 1, 0, 0, 1, 0), 0, 0);
    bool changed;
    for (uint256 i = 1; i < 100; ++i) {
      (, , , bool won, , ) = _battle(a, b, _skills(4, Skill.FISHING), _words(0, i, 0, 0, 1, 0), 0, 0);
      if (won != initial) {
        changed = true;
        break;
      }
    }
    assertTrue(changed);
  }

  function testMoreThanEightRollsUsesMultipleBytes() public {
    players.setXP(1, Skill.FISHING, XP_LEVEL_40);
    uint8[] memory skills = _skills(1, Skill.FISHING);
    (, , , bool won, , ) = _battle(_members(1, 1), _members(1, 1), skills, _words(0, 0x100, 0, 0, 1, 0), 8, 8);
    assertTrue(won);
    (, , , won, , ) = _battle(_members(1, 1), _members(1, 1), skills, _words(0, 0x100, 0, 0, 0x101, 0), 8, 8);
    assertFalse(won);
  }

  function testMoreThanSixteenPlayersUsesMultipleWords() public view {
    uint256 alternating = 0x0001000100010001000100010001000100010001000100010001000100010000;
    uint256 alternatingB = 0x0001000100010001000100010001000100010001000100010001000100010001;
    (, , , bool won, , ) = _battle(
      _members(17, 1),
      _members(17, 1),
      _skills(17, Skill.FISHING),
      _words(0, alternating, 1, 0, alternatingB, 0),
      0,
      0
    );
    assertTrue(won);
    (, , , won, , ) = _battle(
      _members(17, 1),
      _members(17, 1),
      _skills(17, Skill.FISHING),
      _words(0, alternating, 1, 0, alternatingB, 1),
      0,
      0
    );
    assertFalse(won);
  }

  function testRequiresAtLeastSixRandomWords() public {
    uint256[] memory words = new uint256[](5);
    words[2] = 1;
    vm.expectRevert(ClanBattleLibrary.NotEnoughRandomWords.selector);
    ClanBattleLibrary.determineBattleOutcome(
      address(players),
      _members(17, 1),
      _members(17, 1),
      _skills(17, Skill.FISHING),
      words,
      0,
      0
    );
  }

  function testRejectsTooManyAttackersOrDefenders() public {
    vm.expectRevert(ClanBattleLibrary.TooManyAttackers.selector);
    ClanBattleLibrary.determineBattleOutcome(
      address(players),
      _members(33, 1),
      _members(1, 1),
      _skills(33, Skill.FISHING),
      _words(0, 0, 1, 0, 0, 1),
      0,
      0
    );
    vm.expectRevert(ClanBattleLibrary.TooManyDefenders.selector);
    ClanBattleLibrary.determineBattleOutcome(
      address(players),
      _members(1, 1),
      _members(33, 1),
      _skills(33, Skill.FISHING),
      _words(0, 0, 1, 0, 0, 1),
      0,
      0
    );
  }

  function testShufflingWorksAndReturnsShuffledArrays() public {
    players.setXP(1, Skill.FISHING, XP_LEVEL_40);
    uint64[] memory members = new uint64[](2);
    members[0] = 1;
    members[1] = 2;
    uint8[] memory skills = new uint8[](2);
    skills[0] = uint8(Skill.FISHING);
    skills[1] = uint8(Skill.WOODCUTTING);
    (uint8[] memory results, , , bool won, uint64[] memory shuffledA, uint64[] memory shuffledB) = _battle(
      members,
      members,
      skills,
      _words(0, 5, 0, 0, 5, 0),
      0,
      0
    );
    assertEq(results[0], uint8(BattleResultEnum.DRAW));
    assertEq(results[1], uint8(BattleResultEnum.DRAW));
    assertTrue(won);
    assertEq(keccak256(abi.encode(shuffledA)), keccak256(abi.encode(members)));
    assertEq(keccak256(abi.encode(shuffledB)), keccak256(abi.encode(members)));
    (results, , , won, shuffledA, shuffledB) = _battle(members, members, skills, _words(1, 5, 0, 0, 5, 0), 0, 0);
    assertEq(results[0], uint8(BattleResultEnum.LOSE));
    assertEq(results[1], uint8(BattleResultEnum.DRAW));
    assertFalse(won);
    assertNotEq(keccak256(abi.encode(shuffledA)), keccak256(abi.encode(members)));
    assertEq(keccak256(abi.encode(shuffledB)), keccak256(abi.encode(members)));
    (results, , , won, shuffledA, shuffledB) = _battle(members, members, skills, _words(0, 5, 0, 1, 5, 0), 0, 0);
    assertEq(results[0], uint8(BattleResultEnum.WIN));
    assertEq(results[1], uint8(BattleResultEnum.DRAW));
    assertTrue(won);
    assertEq(keccak256(abi.encode(shuffledA)), keccak256(abi.encode(members)));
    assertNotEq(keccak256(abi.encode(shuffledB)), keccak256(abi.encode(members)));
  }
}
