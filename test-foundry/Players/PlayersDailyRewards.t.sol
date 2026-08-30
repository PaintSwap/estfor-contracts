// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {Equipment, Skill, Attire, CombatStats} from "../../contracts/globals/misc.sol";
import {EquipPosition, ItemInput, PendingQueuedActionState} from "../../contracts/globals/players.sol";
import {ActionInput, ActionInfo, ActionQueueStrategy, QueuedActionInput} from "../../contracts/globals/actions.sol";
import {GuaranteedReward, RandomReward} from "../../contracts/globals/rewards.sol";
import {BRONZE_AXE} from "../../contracts/globals/items.sol";

contract PlayersDailyRewardsTest is FullGameStack {
    uint16 private constant ACTION_ID = 1;
    uint16 private constant ACTION_REWARD = 65_000;
    uint16 private constant BRONZE_ARROW = 1;
    uint256 private constant TIER = 1;

    function setUp() public {
        deployFullGame();
        players.setDailyRewardsEnabled(true);
        _setRewardPools();
        _setupWoodcutting();
    }

    function testDailyAndWeeklyRewardWhenStartingAnAction() public {
        _upgradePlayer();
        _moveToWeekdayAndSeed(5); // Tuesday
        Equipment[8] memory rewards = dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(TIER, playerId);
        uint256 weeklyBefore = itemNFT.balanceOf(ALICE, rewards[7].itemTokenId);

        uint256[5] memory beforeBalances;
        for (uint256 i = 1; i <= 5; ++i) {
            beforeBalances[i - 1] = itemNFT.balanceOf(ALICE, rewards[i].itemTokenId);
        }
        for (uint256 i; i < 5; ++i) {
            _start(playerId);
            if (i != 4) _nextDayWithRandomness();
        }
        for (uint256 i = 1; i <= 5; ++i) {
            assertEq(
                itemNFT.balanceOf(ALICE, rewards[i].itemTokenId),
                beforeBalances[i - 1] + _sum(rewards, 1, 6, rewards[i].itemTokenId)
            );
        }
        _assertClaims([false, true, true, true, true, true, false]);
        assertEq(itemNFT.balanceOf(ALICE, rewards[7].itemTokenId), weeklyBefore);

        _nextDayWithRandomness();
        PendingQueuedActionState memory pending = players.getPendingQueuedActionState(ALICE, playerId);
        assertEq(pending.dailyRewardItemTokenIds.length, 1);
        assertEq(pending.dailyRewardItemTokenIds[0], rewards[6].itemTokenId);
        uint256 sundayBefore = itemNFT.balanceOf(ALICE, rewards[6].itemTokenId);
        _start(playerId);
        assertEq(itemNFT.balanceOf(ALICE, rewards[6].itemTokenId), sundayBefore + rewards[6].amount);
        assertEq(itemNFT.balanceOf(ALICE, rewards[7].itemTokenId), weeklyBefore);
        _assertClaims([false, true, true, true, true, true, true]);

        _nextDayWithRandomness();
        _assertClaims([false, false, false, false, false, false, false]);
        rewards = dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(TIER, playerId);
        uint256[7] memory nextBefore;
        for (uint256 i; i < 7; ++i) {
            nextBefore[i] = itemNFT.balanceOf(ALICE, rewards[i].itemTokenId);
        }
        uint256 nextWeeklyBefore = itemNFT.balanceOf(ALICE, rewards[7].itemTokenId);
        for (uint256 i; i < 7; ++i) {
            _start(playerId);
            if (i != 6) _nextDayWithRandomness();
        }
        _assertClaims([true, true, true, true, true, true, true]);
        for (uint256 i; i < 7; ++i) {
            assertEq(
                itemNFT.balanceOf(ALICE, rewards[i].itemTokenId),
                nextBefore[i] + _sum(rewards, 0, 7, rewards[i].itemTokenId)
            );
        }
        assertEq(itemNFT.balanceOf(ALICE, rewards[7].itemTokenId), nextWeeklyBefore + rewards[7].amount);
    }

    function testOnlyOneClaimPerHeroPerDay() public {
        _upgradePlayer();
        _moveToWeekdayAndSeed(4);
        Equipment[8] memory rewards = dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(TIER, playerId);
        uint256 beforeBalance = itemNFT.balanceOf(ALICE, rewards[0].itemTokenId);
        _start(playerId);
        assertEq(itemNFT.balanceOf(ALICE, rewards[0].itemTokenId), beforeBalance + rewards[0].amount);
        _start(playerId);
        assertEq(itemNFT.balanceOf(ALICE, rewards[0].itemTokenId), beforeBalance + rewards[0].amount);
    }

    function testOnlyOneClaimPerWalletPerDay() public {
        _upgradePlayer();
        _moveToWeekdayAndSeed(4);
        Equipment[8] memory rewards = dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(TIER, playerId);
        uint256 beforeBalance = itemNFT.balanceOf(ALICE, rewards[0].itemTokenId);
        _start(playerId);
        assertEq(itemNFT.balanceOf(ALICE, rewards[0].itemTokenId), beforeBalance + rewards[0].amount);

        uint256 secondPlayerId = _createPlayer(ALICE, 1, "alice1", true);
        rewards = dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(TIER, secondPlayerId);
        beforeBalance = itemNFT.balanceOf(ALICE, rewards[0].itemTokenId);
        _start(secondPlayerId);
        assertEq(itemNFT.balanceOf(ALICE, rewards[0].itemTokenId), beforeBalance);
    }

    function testDailyRewardsNotGivenWhenMakingANewHero() public {
        Equipment[] memory pool = new Equipment[](1);
        pool[0] = Equipment(BRONZE_ARROW, 10);
        dailyRewardsScheduler.setDailyRewardPool(TIER, pool);
        _upgradePlayer();
        _requestAndFulfill();
        _createPlayer(ALICE, 1, "name1", true);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 10);
        _createPlayer(ALICE, 1, "name2", true);
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_ARROW), 10);
    }

    function testUpdateOnProcessActions() public {
        _moveToWeekdayAndSeed(4);
        _start(playerId);
        _assertClaims([true, false, false, false, false, false, false]);
        vm.warp(block.timestamp + 1 days);
        vm.prank(ALICE);
        players.processActions(playerId);
        _assertClaims([true, true, false, false, false, false, false]);
    }

    function testCanOnlyGetMondaysRewardIfOracleHasBeenCalled() public {
        _upgradePlayer();
        uint256 requests = _moveToWeekdayWithoutFinalSeed(4);
        Equipment[8] memory rewards = dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(TIER, playerId);
        uint256 beforeBalance = itemNFT.balanceOf(ALICE, rewards[0].itemTokenId);
        _start(playerId);
        assertEq(itemNFT.balanceOf(ALICE, rewards[0].itemTokenId), beforeBalance);
        assertGt(requests, 0);
        _requestAndFulfill();
        vm.prank(ALICE);
        players.processActions(playerId);
        rewards = dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(TIER, playerId);
        assertEq(itemNFT.balanceOf(ALICE, rewards[0].itemTokenId), beforeBalance + rewards[0].amount);
    }

    function testClanTierBonusRewardUpgrades() public {
        _moveToWeekdayAndSeed(4);
        Equipment[8] memory rewards = dailyRewardsScheduler.getActiveDailyAndWeeklyRewards(TIER, playerId);
        uint256[8] memory beforeBalances;
        for (uint256 i; i < 8; ++i) {
            beforeBalances[i] = itemNFT.balanceOf(ALICE, rewards[i].itemTokenId);
        }
        for (uint256 i; i < 7; ++i) {
            _start(playerId);
            if (i != 6) _nextDayWithRandomness();
        }
        _assertClaims([true, true, true, true, true, true, true]);
        for (uint256 i; i < 7; ++i) {
            assertEq(
                itemNFT.balanceOf(ALICE, rewards[i].itemTokenId),
                beforeBalances[i] + _unevolvedSum(rewards, 0, 7, rewards[i].itemTokenId)
            );
        }
        assertEq(itemNFT.balanceOf(ALICE, rewards[7].itemTokenId), beforeBalances[7] + _unevolved(rewards[7].amount));
    }

    function _setupWoodcutting() private {
        GuaranteedReward[] memory guaranteed = new GuaranteedReward[](1);
        guaranteed[0] = GuaranteedReward(ACTION_REWARD, 1_000);
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0] = ActionInput(
            ACTION_ID,
            ActionInfo(uint8(Skill.WOODCUTTING), false, 3_600, 0, 0, BRONZE_AXE, 3_071, 100, 0, false, true, 0),
            guaranteed,
            new RandomReward[](0),
            CombatStats(0, 0, 0, 0, 0, 0, 0)
        );
        worldActions.addActions(actions);
        ItemInput[] memory items = new ItemInput[](1);
        items[0].tokenId = BRONZE_AXE;
        items[0].equipPosition = EquipPosition.RIGHT_HAND;
        items[0].isAvailable = true;
        itemNFT.addItems(items);
    }

    function _setRewardPools() private {
        Equipment[] memory daily = new Equipment[](8);
        Equipment[] memory weekly = new Equipment[](8);
        for (uint16 i; i < 8; ++i) {
            daily[i] = Equipment(uint16(50_000 + i), uint24(10 + i * 10));
            weekly[i] = Equipment(uint16(50_100 + i), uint24(10 + i * 10));
        }
        for (uint256 tier = 1; tier <= 6; ++tier) {
            dailyRewardsScheduler.setDailyRewardPool(tier, daily);
            dailyRewardsScheduler.setWeeklyRewardPool(tier, weekly);
        }
    }

    function _start(uint256 id) private {
        QueuedActionInput[] memory queued = new QueuedActionInput[](1);
        queued[0] = QueuedActionInput(Attire(0, 0, 0, 0, 0, 0, 0, 0), ACTION_ID, 0, 0, BRONZE_AXE, 0, 1 days, 0, 0);
        vm.prank(ALICE);
        players.startActions(id, queued, ActionQueueStrategy.OVERWRITE);
    }

    function _upgradePlayer() private {
        brush.mint(ALICE, 2 ether);
        vm.startPrank(ALICE);
        brush.approve(address(playerNFT), type(uint256).max);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "", "", true);
        vm.stopPrank();
    }

    function _moveToWeekdayAndSeed(uint256 weekdayOffset) private {
        _moveToWeekdayWithoutFinalSeed(weekdayOffset);
        _requestAndFulfill();
    }

    function _moveToWeekdayWithoutFinalSeed(uint256 weekdayOffset) private returns (uint256 requests) {
        uint256 start = block.timestamp;
        _requestAndFulfill();
        uint256 target = ((start - 4 days) / 1 weeks) * 1 weeks + 1 weeks + weekdayOffset * 1 days;
        requests = (target - start) / 1 days;
        for (uint256 i = 1; i < requests; ++i) {
            vm.warp(start + i * 1 days);
            _requestAndFulfill();
        }
        vm.warp(target);
    }

    function _nextDayWithRandomness() private {
        vm.warp(block.timestamp + 1 days);
        _requestAndFulfill();
    }

    function _requestAndFulfill() private {
        uint256 requestId = randomnessBeacon.requestRandomWords();
        mockVRF.fulfill(requestId, address(randomnessBeacon));
    }

    function _assertClaims(bool[7] memory expected) private view {
        bool[7] memory actual = players.dailyClaimedRewards(playerId);
        for (uint256 i; i < 7; ++i) {
            assertEq(actual[i], expected[i]);
        }
    }

    function _sum(Equipment[8] memory rewards, uint256 from, uint256 to, uint16 tokenId)
        private
        pure
        returns (uint256 total)
    {
        for (uint256 i = from; i < to; ++i) {
            if (rewards[i].itemTokenId == tokenId) total += rewards[i].amount;
        }
    }

    function _unevolved(uint256 amount) private pure returns (uint256) {
        return amount / 10 > 0 ? amount / 10 : 1;
    }

    function _unevolvedSum(Equipment[8] memory rewards, uint256 from, uint256 to, uint16 tokenId)
        private
        pure
        returns (uint256 total)
    {
        for (uint256 i = from; i < to; ++i) {
            if (rewards[i].itemTokenId == tokenId) total += _unevolved(rewards[i].amount);
        }
    }
}
