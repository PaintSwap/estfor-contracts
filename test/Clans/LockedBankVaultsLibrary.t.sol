// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "../utils/EstforTest.sol";
import {ILockedBankVaultsLibrary} from "../../contracts/interfaces/ILockedBankVaultsLibrary.sol";

contract LockedBankVaultsLibraryTest is EstforTest {
  ILockedBankVaultsLibrary private lockedBankVaultsLibrary;

  function setUp() public {
    lockedBankVaultsLibrary = ILockedBankVaultsLibrary(
      _deployArtifact("contracts/Clans/LockedBankVaultsLibrary.sol:LockedBankVaultsLibrary:via-ir")
    );
  }

  function testGetNewMMRsSimple() public view {
    _assertMMRs(32, 32, 500, 500, true, 516, 484);
  }

  function testGetNewMMRsExtremes() public view {
    _assertMMRs(32, 32, 1, 1, false, 0, 17);
    _assertMMRs(32, 32, 1, 1, true, 17, 0);
    _assertMMRs(32, 32, 0, 1, true, 16, 0);
    _assertMMRs(32, 32, 0, 0, true, 16, 0);
    _assertMMRs(32, 32, 0, 0, false, 0, 16);
    _assertMMRs(32, 32, 65_000, 65_000, true, 65_016, 64_984);
  }

  function testGetNewMMRsVariousChecks() public view {
    _assertMMRs(32, 32, 600, 500, true, 611, 489);
    _assertMMRs(32, 32, 600, 500, false, 580, 520);
    _assertMMRs(32, 32, 1_200, 500, true, 1_200, 500);
    _assertMMRs(32, 32, 1_200, 500, false, 1_169, 531);
    _assertMMRs(32, 32, 1_300, 500, true, 1_300, 500);
    _assertMMRs(32, 32, 1_300, 500, false, 1_269, 531);
    _assertMMRs(32, 32, 1_500, 500, true, 1_500, 500);
    _assertMMRs(32, 32, 1_500, 500, false, 1_469, 531);
    _assertMMRs(32, 32, 1_000, 1_500, true, 1_030, 1_470);
    _assertMMRs(32, 32, 1_000, 1_500, false, 999, 1_501);
  }

  function testGetNewMMRsSmallKValues() public view {
    _assertMMRs(3, 3, 500, 498, true, 501, 497);
    _assertMMRs(3, 3, 500, 498, false, 499, 499);
  }

  function testIsWithinRangeReturnsTrueWhenDefenderIsWithinRange() public view {
    assertTrue(_isWithin(_standardMMRs(), 2, 4, 2));
  }

  function testIsWithinRangeReturnsFalseWhenDefenderIsOutOfRange() public view {
    assertFalse(_isWithin(_standardMMRs(), 2, 5, 2));
  }

  function testIsWithinRangeHandlesBeginningOfArray() public view {
    assertFalse(_isWithin(_standardMMRs(), 0, 2, 1));
  }

  function testIsWithinRangeHandlesEndOfArray() public view {
    assertFalse(_isWithin(_standardMMRs(), 5, 3, 1));
  }

  function testIsWithinRangeIncludesSameMMRAtEdge() public view {
    assertTrue(_isWithin(_mmrs(1_000, 1_100, 1_200, 1_300, 1_300, 1_400, 1_500), 2, 4, 1));
  }

  function testIsWithinRangeIncludesMultipleSameMMRsAtEdge() public view {
    uint16[] memory mmrs = _mmrs(1_000, 1_100, 1_200, 1_300, 1_300, 1_300, 1_300, 1_400, 1_500);
    assertTrue(_isWithin(mmrs, 2, 6, 1));
    assertFalse(_isWithin(mmrs, 2, 7, 1));
  }

  function testIsWithinRangeIncludesSameMMRAtEdgeInReverse() public view {
    assertTrue(_isWithin(_mmrs(1_000, 1_100, 1_200, 1_200, 1_300, 1_400, 1_500), 4, 2, 1));
  }

  function testIsWithinRangeExcludesDifferentMMROutsideRange() public view {
    assertFalse(_isWithin(_standardMMRs(), 2, 4, 1));
  }

  function testIsWithinRangeIncludesSameMMRAtBeginningOfRange() public view {
    uint16[] memory mmrs = _mmrs(500, 500, 500, 600, 700, 800, 800, 900, 1_000, 1_000);
    assertTrue(_isWithin(mmrs, 0, 3, 1));
    assertTrue(_isWithin(mmrs, 1, 3, 1));
    assertTrue(_isWithin(mmrs, 2, 3, 1));
    assertFalse(_isWithin(mmrs, 2, 4, 1));
    assertTrue(_isWithin(mmrs, 5, 6, 1));
    assertTrue(_isWithin(mmrs, 5, 7, 1));
    assertFalse(_isWithin(mmrs, 5, 8, 1));
    assertTrue(_isWithin(mmrs, 6, 5, 1));
    assertTrue(_isWithin(mmrs, 6, 4, 1));
    assertFalse(_isWithin(mmrs, 6, 3, 1));
    assertTrue(_isWithin(mmrs, 9, 8, 1));
    assertTrue(_isWithin(mmrs, 9, 7, 1));
    assertFalse(_isWithin(mmrs, 9, 6, 1));
    assertTrue(_isWithin(mmrs, 8, 9, 1));
    assertTrue(_isWithin(mmrs, 8, 7, 1));
    assertFalse(_isWithin(mmrs, 8, 6, 1));
  }

  function testIsWithinRangeIncludesSameMMRAtBeginningOfRangeExtremes() public view {
    uint16[] memory mmrs = _mmrs(400, 500, 500, 500, 500, 500, 600);
    assertTrue(_isWithin(mmrs, 1, 5, 3));
    assertTrue(_isWithin(mmrs, 5, 0, 3));
    assertFalse(_isWithin(mmrs, 6, 0, 3));
    assertTrue(_isWithin(mmrs, 6, 1, 3));
  }

  function _assertMMRs(
    uint256 kA,
    uint256 kD,
    uint16 attackingMMR,
    uint16 defendingMMR,
    bool attackersWon,
    uint16 expectedAttackerMMR,
    uint16 expectedDefenderMMR
  ) private view {
    (uint16 attackerMMR, uint16 defenderMMR) = lockedBankVaultsLibrary.getNewMMRs(
      kA,
      kD,
      attackingMMR,
      defendingMMR,
      attackersWon
    );
    assertEq(attackerMMR, expectedAttackerMMR);
    assertEq(defenderMMR, expectedDefenderMMR);
  }

  function _isWithin(
    uint16[] memory mmrs,
    uint256 clanId,
    uint256 defendingClanId,
    uint256 distance
  ) private view returns (bool) {
    uint32[] memory clanIds = new uint32[](mmrs.length);
    for (uint32 i; i < mmrs.length; ++i) {
      clanIds[i] = i;
    }
    return lockedBankVaultsLibrary.isWithinRange(clanIds, mmrs, clanId, defendingClanId, distance);
  }

  function _standardMMRs() private pure returns (uint16[] memory) {
    return _mmrs(1_000, 1_100, 1_200, 1_300, 1_400, 1_500);
  }

  function _mmrs(
    uint16 a,
    uint16 b,
    uint16 c,
    uint16 d,
    uint16 e,
    uint16 f
  ) private pure returns (uint16[] memory values) {
    values = new uint16[](6);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
  }

  function _mmrs(
    uint16 a,
    uint16 b,
    uint16 c,
    uint16 d,
    uint16 e,
    uint16 f,
    uint16 g
  ) private pure returns (uint16[] memory values) {
    values = new uint16[](7);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
    values[6] = g;
  }

  function _mmrs(
    uint16 a,
    uint16 b,
    uint16 c,
    uint16 d,
    uint16 e,
    uint16 f,
    uint16 g,
    uint16 h,
    uint16 i
  ) private pure returns (uint16[] memory values) {
    values = new uint16[](9);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
    values[6] = g;
    values[7] = h;
    values[8] = i;
  }

  function _mmrs(
    uint16 a,
    uint16 b,
    uint16 c,
    uint16 d,
    uint16 e,
    uint16 f,
    uint16 g,
    uint16 h,
    uint16 i,
    uint16 j
  ) private pure returns (uint16[] memory values) {
    values = new uint16[](10);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
    values[6] = g;
    values[7] = h;
    values[8] = i;
    values[9] = j;
  }
}
