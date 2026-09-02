// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "../utils/EstforTest.sol";
import {IPlayersLibrary as PlayersLibrary} from "../../contracts/interfaces/IPlayersLibrary.sol";
import {MAX_LEVEL} from "../../contracts/globals/players.sol";

contract PlayersLibraryTest is EstforTest {
  PlayersLibrary private playersLibrary;

  function setUp() public {
    playersLibrary = PlayersLibrary(_deployArtifact("contracts/Players/PlayersLibrary.sol:PlayersLibrary:via-ir"));
  }

  function testGetLevel() public view {
    assertEq(playersLibrary.getLevel(0), 1);
    assertEq(playersLibrary.getLevel(1_035_475), 98);
    assertEq(playersLibrary.getLevel(1_035_476), 99);
    assertEq(playersLibrary.getLevel(1_035_477), 99);
    assertEq(playersLibrary.getLevel(1_109_796), 100);
    assertEq(playersLibrary.getLevel(17_750_997 - 1), MAX_LEVEL - 1);
    assertEq(playersLibrary.getLevel(17_750_997), MAX_LEVEL);
    assertEq(playersLibrary.getLevel(17_750_997 + 1), MAX_LEVEL);
  }

  function testGetBoostedTime() public view {
    assertEq(playersLibrary.getBoostedTime(0, 10, 0, 10), 10);
    assertEq(playersLibrary.getBoostedTime(10, 10, 0, 10), 0);
    assertEq(playersLibrary.getBoostedTime(10, 10, 0, 10), 0);
    assertEq(playersLibrary.getBoostedTime(0, 10, 10, 10), 0);
    assertEq(playersLibrary.getBoostedTime(0, 10, 11, 10), 0);
    assertEq(playersLibrary.getBoostedTime(10, 10, 5, 11), 6);
    assertEq(playersLibrary.getBoostedTime(10, 10, 5, 20), 10);
    assertEq(playersLibrary.getBoostedTime(10, 10, 5, 15), 10);
    assertEq(playersLibrary.getBoostedTime(0, 10, 10, 10), 0);
    assertEq(playersLibrary.getBoostedTime(0, 10, 5, 1), 1);
    assertEq(playersLibrary.getBoostedTime(0, 10, 6, 11), 4);
    assertEq(playersLibrary.getBoostedTime(0, 10, 4, 6), 6);
    assertEq(playersLibrary.getBoostedTime(0, 10, 0, 1), 1);
    assertEq(playersLibrary.getBoostedTime(0, 10, 0, 11), 10);
  }

  function testDmg() public view {
    uint8 alphaCombat = 1;
    uint8 betaCombat = 1;
    uint256 elapsedTime = 60;

    assertEq(playersLibrary.dmg(10, 0, alphaCombat, betaCombat, elapsedTime), 30);
    assertEq(playersLibrary.dmg(10, 5, alphaCombat, betaCombat, elapsedTime), 25);
    assertEq(playersLibrary.dmg(10, 10, alphaCombat, betaCombat, elapsedTime), 20);
    assertEq(playersLibrary.dmg(10, 15, alphaCombat, betaCombat, elapsedTime), 15);
    assertEq(playersLibrary.dmg(10, 20, alphaCombat, betaCombat, elapsedTime), 10);
    assertEq(playersLibrary.dmg(10, 25, alphaCombat, betaCombat, elapsedTime), 5);
    assertEq(playersLibrary.dmg(10, 28, alphaCombat, betaCombat, elapsedTime), 2);
    assertEq(playersLibrary.dmg(10, 29, alphaCombat, betaCombat, elapsedTime), 1);
    assertEq(playersLibrary.dmg(10, 30, alphaCombat, betaCombat, elapsedTime), 1);
    assertEq(playersLibrary.dmg(10, 31, alphaCombat, betaCombat, elapsedTime), 1);
    assertEq(playersLibrary.dmg(10, 100, alphaCombat, betaCombat, elapsedTime), 1);
    assertEq(playersLibrary.dmg(20, 10, alphaCombat, betaCombat, elapsedTime), 50);
    assertEq(playersLibrary.dmg(10, -5, alphaCombat, betaCombat, elapsedTime), 35);
    assertEq(playersLibrary.dmg(10, -10, alphaCombat, betaCombat, elapsedTime), 40);
    assertEq(playersLibrary.dmg(10, -15, alphaCombat, betaCombat, elapsedTime), 40);
    assertEq(playersLibrary.dmg(10, -100, alphaCombat, betaCombat, elapsedTime), 40);
    assertEq(playersLibrary.dmg(0, -10, alphaCombat, betaCombat, elapsedTime), 0);
    assertEq(playersLibrary.dmg(0, 0, alphaCombat, betaCombat, elapsedTime), 0);
    assertEq(playersLibrary.dmg(0, 10, alphaCombat, betaCombat, elapsedTime), 0);
  }
}
