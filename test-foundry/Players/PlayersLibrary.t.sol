// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {PlayersLibrary} from "../../contracts/Players/PlayersLibrary.sol";
import {MAX_LEVEL} from "../../contracts/globals/players.sol";

contract PlayersLibraryTest is Test {
    function testGetLevel() public pure {
        assertEq(PlayersLibrary.getLevel(0), 1);
        assertEq(PlayersLibrary.getLevel(1_035_475), 98);
        assertEq(PlayersLibrary.getLevel(1_035_476), 99);
        assertEq(PlayersLibrary.getLevel(1_035_477), 99);
        assertEq(PlayersLibrary.getLevel(1_109_796), 100);
        assertEq(PlayersLibrary.getLevel(17_750_997 - 1), MAX_LEVEL - 1);
        assertEq(PlayersLibrary.getLevel(17_750_997), MAX_LEVEL);
        assertEq(PlayersLibrary.getLevel(17_750_997 + 1), MAX_LEVEL);
    }

    function testGetBoostedTime() public pure {
        assertEq(PlayersLibrary.getBoostedTime(0, 10, 0, 10), 10);
        assertEq(PlayersLibrary.getBoostedTime(10, 10, 0, 10), 0);
        assertEq(PlayersLibrary.getBoostedTime(10, 10, 0, 10), 0);
        assertEq(PlayersLibrary.getBoostedTime(0, 10, 10, 10), 0);
        assertEq(PlayersLibrary.getBoostedTime(0, 10, 11, 10), 0);
        assertEq(PlayersLibrary.getBoostedTime(10, 10, 5, 11), 6);
        assertEq(PlayersLibrary.getBoostedTime(10, 10, 5, 20), 10);
        assertEq(PlayersLibrary.getBoostedTime(10, 10, 5, 15), 10);
        assertEq(PlayersLibrary.getBoostedTime(0, 10, 10, 10), 0);
        assertEq(PlayersLibrary.getBoostedTime(0, 10, 5, 1), 1);
        assertEq(PlayersLibrary.getBoostedTime(0, 10, 6, 11), 4);
        assertEq(PlayersLibrary.getBoostedTime(0, 10, 4, 6), 6);
        assertEq(PlayersLibrary.getBoostedTime(0, 10, 0, 1), 1);
        assertEq(PlayersLibrary.getBoostedTime(0, 10, 0, 11), 10);
    }

    function testDmg() public pure {
        uint8 alphaCombat = 1;
        uint8 betaCombat = 1;
        uint256 elapsedTime = 60;

        assertEq(PlayersLibrary.dmg(10, 0, alphaCombat, betaCombat, elapsedTime), 30);
        assertEq(PlayersLibrary.dmg(10, 5, alphaCombat, betaCombat, elapsedTime), 25);
        assertEq(PlayersLibrary.dmg(10, 10, alphaCombat, betaCombat, elapsedTime), 20);
        assertEq(PlayersLibrary.dmg(10, 15, alphaCombat, betaCombat, elapsedTime), 15);
        assertEq(PlayersLibrary.dmg(10, 20, alphaCombat, betaCombat, elapsedTime), 10);
        assertEq(PlayersLibrary.dmg(10, 25, alphaCombat, betaCombat, elapsedTime), 5);
        assertEq(PlayersLibrary.dmg(10, 28, alphaCombat, betaCombat, elapsedTime), 2);
        assertEq(PlayersLibrary.dmg(10, 29, alphaCombat, betaCombat, elapsedTime), 1);
        assertEq(PlayersLibrary.dmg(10, 30, alphaCombat, betaCombat, elapsedTime), 1);
        assertEq(PlayersLibrary.dmg(10, 31, alphaCombat, betaCombat, elapsedTime), 1);
        assertEq(PlayersLibrary.dmg(10, 100, alphaCombat, betaCombat, elapsedTime), 1);
        assertEq(PlayersLibrary.dmg(20, 10, alphaCombat, betaCombat, elapsedTime), 50);
        assertEq(PlayersLibrary.dmg(10, -5, alphaCombat, betaCombat, elapsedTime), 35);
        assertEq(PlayersLibrary.dmg(10, -10, alphaCombat, betaCombat, elapsedTime), 40);
        assertEq(PlayersLibrary.dmg(10, -15, alphaCombat, betaCombat, elapsedTime), 40);
        assertEq(PlayersLibrary.dmg(10, -100, alphaCombat, betaCombat, elapsedTime), 40);
        assertEq(PlayersLibrary.dmg(0, -10, alphaCombat, betaCombat, elapsedTime), 0);
        assertEq(PlayersLibrary.dmg(0, 0, alphaCombat, betaCombat, elapsedTime), 0);
        assertEq(PlayersLibrary.dmg(0, 10, alphaCombat, betaCombat, elapsedTime), 0);
    }
}
