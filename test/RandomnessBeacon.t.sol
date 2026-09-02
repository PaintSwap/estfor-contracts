// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {stdError} from "forge-std/StdError.sol";
import {RandomnessBeacon} from "../contracts/RandomnessBeacon.sol";
import {IOracleCB} from "../contracts/interfaces/IOracleCB.sol";
import {MockOracleCB} from "../contracts/test/MockOracleCB.sol";

contract RandomnessBeaconTest is EstforTest {
  function setUp() public {
    _deployBeaconStack();
    vm.roll(6);

    MockOracleCB oracle = new MockOracleCB();
    _initializeBeaconRandomWords(oracle, IOracleCB(address(oracle)));
  }

  function testRequestingRandomWords() public {
    uint256 updateTime = randomnessBeacon.MIN_RANDOM_WORDS_UPDATE_TIME();
    uint256 startOffset = randomnessBeacon.NUM_DAYS_RANDOM_WORDS_INITIALIZED();

    randomnessBeacon.requestRandomWords();
    uint256 requestId = randomnessBeacon.requestIds(startOffset);
    assertGe(requestId, 1);
    assertEq(randomnessBeacon.getRandomWords(requestId), 0);

    mockVRF.fulfill(requestId, address(randomnessBeacon));
    assertNotEq(randomnessBeacon.getRandomWords(requestId), 0);
    mockVRF.fulfill(requestId, address(randomnessBeacon));

    vm.expectPartialRevert(RandomnessBeacon.CanOnlyRequestAfterTheNextCheckpoint.selector);
    randomnessBeacon.requestRandomWords();

    vm.warp(block.timestamp + updateTime);
    randomnessBeacon.requestRandomWords();
    requestId = randomnessBeacon.requestIds(startOffset + 1);
    mockVRF.fulfill(requestId, address(randomnessBeacon));

    vm.warp(block.timestamp + (updateTime * 2));
    randomnessBeacon.requestRandomWords();
    requestId = randomnessBeacon.requestIds(startOffset + 2);
    mockVRF.fulfill(requestId, address(randomnessBeacon));
    randomnessBeacon.requestRandomWords();
    requestId = randomnessBeacon.requestIds(startOffset + 3);
    mockVRF.fulfill(requestId, address(randomnessBeacon));

    vm.expectPartialRevert(RandomnessBeacon.CanOnlyRequestAfterTheNextCheckpoint.selector);
    randomnessBeacon.requestRandomWords();
    vm.expectRevert(stdError.indexOOBError);
    randomnessBeacon.requestIds(startOffset + 4);
  }

  function testGetRandomWord() public {
    // Keep the queried timestamp fixed while the test advances block time.
    uint256 currentTimestamp = 20 weeks;
    uint256 updateTime = randomnessBeacon.MIN_RANDOM_WORDS_UPDATE_TIME();
    uint256 initializedDays = randomnessBeacon.NUM_DAYS_RANDOM_WORDS_INITIALIZED();
    assertFalse(randomnessBeacon.hasRandomWord(currentTimestamp));

    vm.warp(block.timestamp + updateTime);
    randomnessBeacon.requestRandomWords();
    vm.expectRevert(stdError.indexOOBError);
    randomnessBeacon.requestIds(initializedDays + 1);
    uint256 requestId = randomnessBeacon.requestIds(initializedDays);
    mockVRF.fulfill(requestId, address(randomnessBeacon));
    assertFalse(randomnessBeacon.hasRandomWord(currentTimestamp));

    randomnessBeacon.requestRandomWords();
    requestId = randomnessBeacon.requestIds(initializedDays + 1);
    mockVRF.fulfill(requestId, address(randomnessBeacon));
    assertTrue(randomnessBeacon.hasRandomWord(currentTimestamp));
    assertNotEq(randomnessBeacon.getRandomWord(currentTimestamp), 0);

    vm.expectRevert(RandomnessBeacon.NoValidRandomWord.selector);
    randomnessBeacon.getRandomWord(currentTimestamp - (updateTime * 6));
    vm.expectRevert(RandomnessBeacon.NoValidRandomWord.selector);
    randomnessBeacon.getRandomWord(currentTimestamp + updateTime);
  }

  function testGetMultipleWords() public {
    uint256 currentTimestamp = 20 weeks;
    uint256 updateTime = randomnessBeacon.MIN_RANDOM_WORDS_UPDATE_TIME();
    uint256 initializedDays = randomnessBeacon.NUM_DAYS_RANDOM_WORDS_INITIALIZED();
    vm.expectRevert(RandomnessBeacon.NoValidRandomWord.selector);
    randomnessBeacon.getMultipleWords(currentTimestamp);

    vm.warp(block.timestamp + updateTime);
    randomnessBeacon.requestRandomWords();
    uint256 requestId = randomnessBeacon.requestIds(initializedDays);
    mockVRF.fulfill(requestId, address(randomnessBeacon));
    vm.expectRevert(RandomnessBeacon.NoValidRandomWord.selector);
    randomnessBeacon.getMultipleWords(currentTimestamp);

    randomnessBeacon.requestRandomWords();
    requestId = randomnessBeacon.requestIds(initializedDays + 1);
    mockVRF.fulfill(requestId, address(randomnessBeacon));

    uint256[4] memory words = randomnessBeacon.getMultipleWords(currentTimestamp);
    for (uint256 i; i < words.length; ++i) {
      assertNotEq(words[i], 0);
    }
  }
}
