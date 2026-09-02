// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {DailyRewardsScheduler} from "../contracts/DailyRewardsScheduler.sol";
import {RandomnessBeacon} from "../contracts/RandomnessBeacon.sol";
import {Equipment} from "../contracts/globals/misc.sol";
import {IOracleCB} from "../contracts/interfaces/IOracleCB.sol";
import {MockOracleCB} from "../contracts/test/MockOracleCB.sol";

contract DailyRewardsSchedulerTest is EstforTest {
  uint256 private constant TIER = 1;
  DailyRewardsScheduler private scheduler;

  function setUp() public {
    _deployBeaconStack();

    DailyRewardsScheduler schedulerImplementation = new DailyRewardsScheduler();
    scheduler = DailyRewardsScheduler(
      _deployUUPS(
        address(schedulerImplementation),
        abi.encodeCall(schedulerImplementation.initialize, (address(randomnessBeacon)))
      )
    );

    _initializeBeaconRandomWords(new MockOracleCB(), IOracleCB(address(scheduler)));
    _setRewardPools();
  }

  function testNewRandomRewardsRotateAcrossWeeks() public {
    uint256 playerId = 1;
    _warpToNextMonday();
    bytes32 initialRewards = _rewardHash(playerId);

    _requestAllAvailableWords();
    bytes32 firstWeekRewards = _rewardHash(playerId);
    assertNotEq(firstWeekRewards, initialRewards);

    vm.warp(block.timestamp + 1 weeks);
    _requestAllAvailableWords();
    assertNotEq(_rewardHash(playerId), firstWeekRewards);
  }

  function testTieredRandomRewardsDifferByPlayerId() public {
    _warpToNextMonday();
    _requestAllAvailableWords();

    bytes32 playerOneRewards = _rewardHash(1);
    bytes32 playerTwoRewards = _rewardHash(2);
    bytes32 playerThreeRewards = _rewardHash(3);
    assertNotEq(playerOneRewards, playerTwoRewards);
    assertNotEq(playerOneRewards, playerThreeRewards);
    assertNotEq(playerTwoRewards, playerThreeRewards);
  }

  function _setRewardPools() private {
    Equipment[] memory daily = new Equipment[](8);
    Equipment[] memory weekly = new Equipment[](8);
    for (uint16 i; i < 8; ++i) {
      daily[i] = Equipment({itemTokenId: uint16(100 + i), amount: uint24(10 + (i * 10))});
      weekly[i] = Equipment({itemTokenId: uint16(200 + i), amount: uint24(1 + i)});
    }
    scheduler.setDailyRewardPool(TIER, daily);
    scheduler.setWeeklyRewardPool(TIER, weekly);
  }

  function _warpToNextMonday() private {
    uint256 oneWeek = 1 weeks;
    uint256 nextMonday = ((block.timestamp - 4 days) / oneWeek) * oneWeek + oneWeek + 4 days + 1;
    vm.warp(nextMonday);
  }

  function _requestAllAvailableWords() private {
    for (uint256 i; i < 8; ++i) {
      try randomnessBeacon.requestRandomWords() returns (uint256 requestId) {
        mockVRF.fulfill(requestId, address(randomnessBeacon));
      } catch (bytes memory reason) {
        assertEq(bytes4(reason), RandomnessBeacon.CanOnlyRequestAfterTheNextCheckpoint.selector);
        return;
      }
    }
    fail("expected requests to reach the next checkpoint");
  }

  function _rewardHash(uint256 playerId) private view returns (bytes32) {
    Equipment[8] memory rewards = scheduler.getActiveDailyAndWeeklyRewards(TIER, playerId);
    return keccak256(abi.encode(rewards));
  }
}
