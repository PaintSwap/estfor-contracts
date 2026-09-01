// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";

import {FullGameStack} from "./utils/FullGameStack.sol";
import {IWishingWell} from "../contracts/interfaces/IWishingWell.sol";
import {IClans as Clans} from "../contracts/interfaces/IClans.sol";
import {IPlayersImplMisc1 as IPlayersMisc1DelegateView} from "../contracts/interfaces/IPlayersImplMisc1.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {IActivityPoints} from "../contracts/ActivityPoints/interfaces/IActivityPoints.sol";
import {Skill, Attire, CombatStats, BoostType} from "../contracts/globals/misc.sol";
import {ActionInput, ActionInfo, ActionQueueStrategy, QueuedActionInput} from "../contracts/globals/actions.sol";
import {
    EquipPosition,
    ItemInput,
    LotteryWinnerInfo,
    ExtendedBoostInfo,
    StandardBoostInfo
} from "../contracts/globals/players.sol";
import {GuaranteedReward, RandomReward} from "../contracts/globals/rewards.sol";
import {
    BRONZE_AXE,
    LUCKY_POTION,
    LUCK_OF_THE_DRAW,
    PRAY_TO_THE_BEARDIE,
    PRAY_TO_THE_BEARDIE_2,
    PRAY_TO_THE_BEARDIE_3,
    CLAN_BOOSTER,
    CLAN_BOOSTER_2,
    CLAN_BOOSTER_3
} from "../contracts/globals/items.sol";

contract WishingWellTest is FullGameStack {
    uint256 private constant TOTAL_BRUSH = 100_000 ether;
    uint16 private constant WOODCUTTING_ACTION = 1;
    uint16 private constant LOG = 10_496;
    bytes32 private constant INITIALIZABLE_STORAGE = 0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00;

    uint256 private raffleEntryCost;

    function setUp() public {
        deployFullGame();
        _fulfillNextRandomWords();

        brush.mint(ALICE, TOTAL_BRUSH);
        vm.prank(ALICE);
        brush.approve(address(wishingWell), TOTAL_BRUSH);
        _addBoostItems();
        raffleEntryCost = wishingWell.getRaffleEntryCost();
    }

    function testOnlyPlayersContractCanCallDonate() public {
        vm.prank(ALICE);
        vm.expectRevert(IWishingWell.NotPlayers.selector);
        wishingWell.donate(ALICE, 0, 100);
    }

    function testDonateWithoutUsingAPlayer() public {
        vm.prank(ALICE);
        players.donate(0, 1 ether);
        assertEq(brush.balanceOf(ALICE), TOTAL_BRUSH - 1 ether);
        assertEq(brush.balanceOf(address(treasury)), 1 ether);
    }

    function testDonateWithPlayer() public {
        vm.prank(ALICE);
        players.donate(playerId, 1 ether);
        assertEq(brush.balanceOf(ALICE), TOTAL_BRUSH - 1 ether);
        assertEq(brush.balanceOf(address(treasury)), 1 ether);

        vm.prank(ALICE);
        vm.expectRevert(IWishingWell.NotOwnerOfPlayer.selector);
        players.donate(playerId + 1, 1 ether);
    }

    function testInitializationParams() public {
        IWishingWell implementation = IWishingWell(_deployArtifact("contracts/WishingWell.sol:WishingWell"));
        vm.store(address(implementation), INITIALIZABLE_STORAGE, bytes32(0));
        vm.expectEmit(address(implementation));
        emit IWishingWell.ClanDonationThreshold(250 ether, CLAN_BOOSTER);
        implementation.initialize(
            IBrushToken(address(brush)),
            address(playerNFT),
            address(treasury),
            address(randomnessBeacon),
            address(clans),
            5 ether,
            1000 ether,
            250 ether,
            IActivityPoints(address(activityPoints))
        );
    }

    function testClaimLotteryWinnings() public {
        uint256 lotteryId = wishingWell.getLastLotteryId();
        assertEq(lotteryId, 1);
        _donate(ALICE, playerId, raffleEntryCost);
        _nextDayAndFulfill();

        assertTrue(wishingWell.hasPlayerEntered(lotteryId, playerId));
        assertFalse(wishingWell.hasClaimedReward(lotteryId));
        LotteryWinnerInfo memory winner = wishingWell.getWinner(lotteryId);
        assertEq(winner.lotteryId, lotteryId);
        assertEq(winner.raffleId, 1);
        assertEq(winner.itemTokenId, LUCKY_POTION);
        assertEq(winner.amount, 1);
        assertTrue(winner.instantConsume);
        assertEq(winner.playerId, playerId);

        vm.expectEmit(address(wishingWell));
        emit IWishingWell.ClaimedLotteryWinnings(lotteryId, 1, LUCKY_POTION, 1);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertTrue(wishingWell.hasClaimedReward(lotteryId));
        assertEq(wishingWell.getLastLotteryId(), 2);

        vm.recordLogs();
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(_countLogs(address(wishingWell), IWishingWell.ClaimedLotteryWinnings.selector), 0);
    }

    function testMinimumOfOneBrushCanBeDonated() public {
        assertEq(wishingWell.getLastLotteryId(), 1);
        vm.prank(ALICE);
        vm.expectRevert(IWishingWell.MinimumOneBrush.selector);
        players.donate(playerId, 0.1 ether);
    }

    function testDecimalsOfBrushDoNotCount() public {
        uint256 beforeBalance = brush.balanceOf(ALICE);
        _createClan();
        assertEq(wishingWell.getLastLotteryId(), 1);

        vm.expectEmit(address(wishingWell));
        emit IWishingWell.DonateToClan(ALICE, playerId, 1 ether, 1, 0);
        vm.expectEmit(address(wishingWell));
        emit IWishingWell.Donate(ALICE, playerId, 1 ether, 0, 0);
        _donate(ALICE, playerId, 1.1 ether);
        assertEq(brush.balanceOf(ALICE), beforeBalance - 1.1 ether);
        assertEq(wishingWell.getTotalDonated(), 1 ether);
        assertEq(wishingWell.getClanTotalDonated(1), 1 ether);

        vm.expectEmit(address(wishingWell));
        emit IWishingWell.DonateToClan(ALICE, playerId, 1 ether, 1, 0);
        vm.expectEmit(address(wishingWell));
        emit IWishingWell.Donate(ALICE, playerId, 1 ether, 0, 0);
        _donate(ALICE, playerId, 1.99 ether);
        assertEq(wishingWell.getTotalDonated(), 2 ether);
        assertEq(wishingWell.getClanTotalDonated(1), 2 ether);
    }

    function testReachMinimumToGetATicket() public {
        uint256 lotteryId = wishingWell.getLastLotteryId();
        vm.expectEmit(address(wishingWell));
        emit IWishingWell.Donate(ALICE, playerId, 1 ether, 0, 0);
        _donate(ALICE, playerId, 1 ether);
        assertFalse(wishingWell.hasPlayerEntered(lotteryId, playerId));
        _donate(ALICE, playerId, raffleEntryCost - 1);
        assertFalse(wishingWell.hasPlayerEntered(lotteryId, playerId));

        vm.expectEmit(address(wishingWell));
        emit IWishingWell.Donate(ALICE, playerId, raffleEntryCost, lotteryId, 1);
        _donate(ALICE, playerId, raffleEntryCost);
        assertTrue(wishingWell.hasPlayerEntered(lotteryId, playerId));
    }

    function testCannotDonateUntilPreviousDayOracleIsCalled() public {
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _donate(ALICE, playerId, raffleEntryCost);
        _fulfillNextRandomWords();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        assertEq(wishingWell.getLastLotteryId(), 2);
        vm.prank(ALICE);
        vm.expectRevert(IWishingWell.OracleNotCalledYet.selector);
        players.donate(playerId, raffleEntryCost);
        _fulfillNextRandomWords();
        _donate(ALICE, playerId, raffleEntryCost);
    }

    function testCannotEnterRaffleWithPlayerMoreThanOnceADay() public {
        uint256 lotteryId = wishingWell.getLastLotteryId();
        vm.expectEmit(address(wishingWell));
        emit IWishingWell.Donate(ALICE, playerId, raffleEntryCost, 1, 1);
        _donate(ALICE, playerId, raffleEntryCost);
        assertTrue(wishingWell.hasPlayerEntered(lotteryId, playerId));
        vm.expectEmit(address(wishingWell));
        emit IWishingWell.Donate(ALICE, playerId, raffleEntryCost, 0, 0);
        _donate(ALICE, playerId, raffleEntryCost);
    }

    function testGlobalThresholdRewards() public {
        uint256 nextThreshold = wishingWell.getNextGlobalThreshold();
        assertGt(nextThreshold, 0);
        _donate(ALICE, 0, nextThreshold - 2 ether);
        _donate(ALICE, playerId, 1 ether);

        vm.expectEmit(address(wishingWell));
        emit IWishingWell.LastGlobalDonationThreshold(1000 ether, PRAY_TO_THE_BEARDIE_2);
        _donate(ALICE, 0, 1 ether);
        assertEq(wishingWell.getNextGlobalThreshold(), 2000 ether);

        vm.expectEmit(address(wishingWell));
        emit IWishingWell.LastGlobalDonationThreshold(2000 ether, PRAY_TO_THE_BEARDIE_3);
        _donate(ALICE, 0, 1500 ether);
        assertEq(wishingWell.getNextGlobalThreshold(), 3000 ether);
        _donate(ALICE, 0, 499 ether);

        vm.expectEmit(address(wishingWell));
        emit IWishingWell.LastGlobalDonationThreshold(3000 ether, PRAY_TO_THE_BEARDIE);
        _donate(ALICE, 0, 1 ether);
        vm.expectEmit(address(wishingWell));
        emit IWishingWell.LastGlobalDonationThreshold(6000 ether, PRAY_TO_THE_BEARDIE_2);
        _donate(ALICE, 0, 3500 ether);
        assertEq(wishingWell.getTotalDonated(), 6500 ether);
        assertEq(wishingWell.getNextGlobalThreshold(), 7000 ether);
    }

    function testClanBoostRotation() public {
        _createClan();
        wishingWell.setClanDonationThresholdIncrement(raffleEntryCost);

        _expectClanThreshold(raffleEntryCost, CLAN_BOOSTER_2);
        _donate(ALICE, playerId, raffleEntryCost);
        assertEq(players.getActiveBoost(playerId).extraItemTokenId, LUCK_OF_THE_DRAW);
        assertEq(_clanBoost().itemTokenId, CLAN_BOOSTER);

        _expectClanThreshold(raffleEntryCost * 2, CLAN_BOOSTER_3);
        _donate(ALICE, playerId, raffleEntryCost);
        assertEq(players.getActiveBoost(playerId).extraItemTokenId, LUCK_OF_THE_DRAW);
        assertEq(_clanBoost().itemTokenId, CLAN_BOOSTER_2);

        _expectClanThreshold(raffleEntryCost * 3, CLAN_BOOSTER);
        _donate(ALICE, playerId, raffleEntryCost);
        assertEq(_clanBoost().itemTokenId, CLAN_BOOSTER_3);

        _expectClanThreshold(raffleEntryCost * 10, CLAN_BOOSTER_2);
        _donate(ALICE, playerId, raffleEntryCost * 7 + 1 ether);
        assertEq(_clanBoost().itemTokenId, CLAN_BOOSTER);
        assertEq(wishingWell.getClanTotalDonated(1), raffleEntryCost * 10 + 1 ether);
        assertEq(wishingWell.getNextClanThreshold(1), raffleEntryCost * 11);
    }

    function testClaimingPreviousClaimsWorksUpToTwoOtherLotteriesAgo() public {
        _donate(ALICE, playerId, raffleEntryCost);
        uint256 lotteryId = wishingWell.getLastLotteryId();
        brush.mint(address(this), TOTAL_BRUSH);
        brush.approve(address(wishingWell), TOTAL_BRUSH);
        for (uint256 i; i < 2; ++i) {
            _nextDayAndFulfill();
            uint256 interimPlayerId =
                _createPlayer(address(this), 1, string.concat("my name ser", vm.toString(i)), false);
            players.donate(interimPlayerId, raffleEntryCost);
        }
        _nextDayAndFulfill();
        assertFalse(wishingWell.hasClaimedReward(lotteryId));
        vm.prank(ALICE);
        players.processActions(playerId);
        assertFalse(wishingWell.hasClaimedReward(lotteryId));

        _donate(ALICE, playerId, raffleEntryCost);
        lotteryId = wishingWell.getLastLotteryId();
        _nextDayAndFulfill();
        uint256 otherId = _createPlayer(address(this), 1, "should work now", false);
        players.donate(otherId, raffleEntryCost);
        _nextDayAndFulfill();
        vm.prank(ALICE);
        players.processActions(playerId);
        assertTrue(wishingWell.hasClaimedReward(lotteryId));
        assertEq(wishingWell.getLastUnclaimedWinner(2), 0);

        _donate(ALICE, playerId, raffleEntryCost);
        lotteryId = wishingWell.getLastLotteryId();
        _nextDayAndFulfill();
        assertEq(wishingWell.getLastUnclaimedWinner(2), playerId);
        assertEq(wishingWell.getLastUnclaimedWinner(3), lotteryId);
        uint256 newPlayerId = _createPlayer(address(this), 1, "cheesy", true);
        players.donate(newPlayerId, raffleEntryCost);
        _nextDayAndFulfill();
        assertEq(wishingWell.getLastUnclaimedWinner(0), playerId);
        assertEq(wishingWell.getLastUnclaimedWinner(1), lotteryId);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertEq(wishingWell.getLastUnclaimedWinner(0), newPlayerId);
        assertEq(wishingWell.getLastUnclaimedWinner(1), lotteryId + 1);
        assertEq(wishingWell.getLastUnclaimedWinner(2), 0);
        assertEq(wishingWell.getLastUnclaimedWinner(3), 0);
    }

    function testMultipleUnclaimedWinsAreClaimedAfterEachOther() public {
        _donate(ALICE, playerId, raffleEntryCost);
        uint256 lotteryId = wishingWell.getLastLotteryId();
        _nextDayAndFulfill();
        _donate(ALICE, playerId, raffleEntryCost);
        _nextDayAndFulfill();
        assertEq(wishingWell.getLastUnclaimedWinner(0), playerId);
        assertEq(wishingWell.getLastUnclaimedWinner(1), lotteryId);
        assertEq(wishingWell.getLastUnclaimedWinner(2), playerId);
        assertEq(wishingWell.getLastUnclaimedWinner(3), lotteryId + 1);

        vm.prank(ALICE);
        players.processActions(playerId);
        assertTrue(wishingWell.hasClaimedReward(lotteryId));
        assertEq(wishingWell.getLastUnclaimedWinner(1), lotteryId + 1);
        assertEq(wishingWell.getLastUnclaimedWinner(2), 0);
        vm.prank(ALICE);
        players.processActions(playerId);
        assertTrue(wishingWell.hasClaimedReward(lotteryId + 1));
        for (uint256 i; i < 4; ++i) {
            assertEq(wishingWell.getLastUnclaimedWinner(i), 0);
        }
    }

    function testGetExtraXPBoostAsPartOfQueueingDonation() public {
        QueuedActionInput[] memory actions = _basicWoodcuttingActions();
        vm.prank(ALICE);
        players.startActionsAdvanced(playerId, actions, 0, 0, 0, raffleEntryCost, ActionQueueStrategy.OVERWRITE);
        ExtendedBoostInfo memory boost = players.getActiveBoost(playerId);
        assertEq(uint8(boost.extraBoostType), uint8(BoostType.ANY_XP));
        assertEq(boost.extraValue, 5);
    }

    function testQueueingDonationDoesNotOverrideLotteryWinnings() public {
        QueuedActionInput[] memory actions = _basicWoodcuttingActions();
        uint256 lotteryId = wishingWell.getLastLotteryId();
        _donate(ALICE, playerId, raffleEntryCost);
        _nextDayAndFulfill();
        assertEq(wishingWell.getWinner(lotteryId).lotteryId, lotteryId);

        vm.expectEmit(address(wishingWell));
        emit IWishingWell.ClaimedLotteryWinnings(lotteryId, 1, LUCKY_POTION, 1);
        vm.prank(ALICE);
        players.startActionsAdvanced(playerId, actions, 0, 0, 0, raffleEntryCost, ActionQueueStrategy.OVERWRITE);
        assertTrue(wishingWell.hasClaimedReward(lotteryId));
        assertEq(wishingWell.getLastLotteryId(), 2);
        assertEq(players.getActiveBoost(playerId).extraItemTokenId, LUCKY_POTION);
    }

    function testFullAmountIsAddedToClanTotalDonations() public {
        _createClan();
        _donate(ALICE, playerId, raffleEntryCost * 2);
        assertEq(wishingWell.getClanTotalDonated(1), raffleEntryCost * 2);
    }

    function testSetGlobalDonationThresholdIncrement() public {
        _donate(ALICE, playerId, raffleEntryCost * 2);
        wishingWell.setGlobalDonationThresholdIncrement(raffleEntryCost * 3);
        assertEq(wishingWell.getNextGlobalThreshold(), raffleEntryCost * 3);
        _donate(ALICE, playerId, raffleEntryCost);
        wishingWell.setGlobalDonationThresholdIncrement(raffleEntryCost * 2);
        assertEq(wishingWell.getNextGlobalThreshold(), raffleEntryCost * 5);
    }

    function _donate(address account, uint256 id, uint256 amount) private {
        vm.prank(account);
        players.donate(id, amount);
    }

    function _fulfillNextRandomWords() private {
        randomnessBeacon.requestRandomWords();
        uint256 index = randomnessBeacon.NUM_DAYS_RANDOM_WORDS_INITIALIZED();
        while (true) {
            try randomnessBeacon.requestIds(index) returns (uint256 requestId) {
                if (randomnessBeacon.getRandomWords(requestId) == 0) {
                    mockVRF.fulfill(requestId, address(randomnessBeacon));
                    return;
                }
                ++index;
            } catch {
                revert("pending request not found");
            }
        }
    }

    function _nextDayAndFulfill() private {
        vm.warp(vm.getBlockTimestamp() + 1 days);
        _fulfillNextRandomWords();
    }

    function _createClan() private {
        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(1, 3, 3, 16, 0, 0);
        clans.addTiers(tiers);
        vm.prank(ALICE);
        clans.createClan(playerId, "Clan name", "discord", "telegram", "twitter", 1, 1);
    }

    function _expectClanThreshold(uint256 threshold, uint16 nextReward) private {
        vm.expectEmit(address(wishingWell));
        emit IWishingWell.LastClanDonationThreshold(1, threshold, nextReward);
    }

    function _clanBoost() private view returns (StandardBoostInfo memory) {
        return IPlayersMisc1DelegateView(address(players)).getClanBoost(1);
    }

    function _addBoostItems() private {
        ItemInput[] memory items = new ItemInput[](8);
        uint16[8] memory ids = [
            LUCKY_POTION,
            LUCK_OF_THE_DRAW,
            PRAY_TO_THE_BEARDIE,
            PRAY_TO_THE_BEARDIE_2,
            PRAY_TO_THE_BEARDIE_3,
            CLAN_BOOSTER,
            CLAN_BOOSTER_2,
            CLAN_BOOSTER_3
        ];
        for (uint256 i; i < items.length; ++i) {
            items[i].tokenId = ids[i];
            items[i].equipPosition = i < 2
                ? EquipPosition.EXTRA_BOOST_VIAL
                : i < 5 ? EquipPosition.GLOBAL_BOOST_VIAL : EquipPosition.CLAN_BOOST_VIAL;
            items[i].boostType =
                i == 3 || i == 6 ? BoostType.COMBAT_XP : i == 4 || i == 7 ? BoostType.NON_COMBAT_XP : BoostType.ANY_XP;
            items[i].boostValue = i == 1 ? 5 : 10;
            items[i].boostDuration = 3600;
            items[i].isAvailable = true;
        }
        itemNFT.addItems(items);
    }

    function _basicWoodcuttingActions() private returns (QueuedActionInput[] memory queuedActions) {
        GuaranteedReward[] memory rewards = new GuaranteedReward[](1);
        rewards[0] = GuaranteedReward(LOG, 1000);
        ActionInput[] memory actions = new ActionInput[](1);
        actions[0] = ActionInput(
            WOODCUTTING_ACTION,
            ActionInfo(uint8(Skill.WOODCUTTING), false, 3600, 0, 0, BRONZE_AXE, 3071, 100, 0, false, true, 0),
            rewards,
            new RandomReward[](0),
            CombatStats(0, 0, 0, 0, 0, 0, 0)
        );
        worldActions.addActions(actions);
        ItemInput[] memory items = new ItemInput[](1);
        items[0].tokenId = BRONZE_AXE;
        items[0].equipPosition = EquipPosition.RIGHT_HAND;
        items[0].isAvailable = true;
        itemNFT.addItems(items);
        queuedActions = new QueuedActionInput[](1);
        queuedActions[0] =
            QueuedActionInput(Attire(0, 0, 0, 0, 0, 0, 0, 0), WOODCUTTING_ACTION, 0, 0, BRONZE_AXE, 0, 3600, 0, 0);
    }

    function _countLogs(address emitter, bytes32 topic) private view returns (uint256 count) {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == emitter && logs[i].topics[0] == topic) ++count;
        }
    }
}
