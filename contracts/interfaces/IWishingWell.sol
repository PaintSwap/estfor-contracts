// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../globals/actions.sol";
import "../globals/clans.sol";
import "../globals/items.sol";
import "../globals/misc.sol";
import "../globals/pets.sol";
import "../globals/players.sol";
import "../globals/promotions.sol";
import "../globals/quests.sol";
import "../globals/rewards.sol";
import {IPlayers} from "./IPlayers.sol";
import {IBrushToken} from "./external/IBrushToken.sol";
import {IActivityPoints, IActivityPointsCaller} from "../ActivityPoints/interfaces/IActivityPoints.sol";
import {IOracleCB} from "./IOracleCB.sol";

interface IWishingWell is IOracleCB, IActivityPointsCaller {
    struct ClanInfo {
        uint40 totalDonated;
        uint40 lastThreshold;
        uint16 nextReward;
    }
    function claimedLotteryWinnings(uint256 lotteryId) external;
    function donate(address from_, uint256 playerId, uint256 amount)
        external
        returns (uint16 itemTokenId, uint16 globalItemTokenId, uint256 clanId, uint16 clanItemTokenId);
    function getClanDonationInfo(uint256 clanId) external view returns (IWishingWell.ClanInfo memory);
    function getClanTotalDonated(uint256 clanId) external view returns (uint256);
    function getLastLotteryId() external view returns (uint256);
    function getLastUnclaimedWinner(uint256 index) external view returns (uint256);
    function getNextClanThreshold(uint256 clanId) external view returns (uint256);
    function getNextGlobalThreshold() external view returns (uint256);
    function getRaffleEntryCost() external view returns (uint256);
    function getTotalDonated() external view returns (uint256);
    function getUnclaimedLotteryWinnings(uint256 playerId) external view returns (LotteryWinnerInfo memory winner);
    function getWinner(uint256 lotteryId) external view returns (LotteryWinnerInfo memory);
    function hasClaimedReward(uint256 lotteryId) external view returns (bool);
    function hasPlayerEntered(uint256 lotteryId, uint256 playerId) external view returns (bool);
    function initialize(
        IBrushToken brush,
        address playerNFT,
        address treasury,
        address randomnessBeacon,
        address clans,
        uint256 raffleEntryCost,
        uint256 globalThresholdIncrement,
        uint256 clanThresholdIncrement,
        IActivityPoints activityPoints
    ) external;
    function newOracleRandomWords(uint256 randomWord) external;
    function setActivityPoints(address activityPoints) external;
    function setClanDonationThresholdIncrement(uint256 clanThresholdIncrement) external;
    function setGlobalDonationThresholdIncrement(uint256 globalThresholdIncrement) external;
    function setNextLotteryWinnerRewardItemTokenId(uint16 donationRewardItemTokenId) external;
    function setPlayers(IPlayers players) external;
    function setRaffleEntryCost(uint256 raffleEntryCost) external;
    event ClaimedLotteryWinnings(uint256 lotteryId, uint256 raffleId, uint256 itemTokenId, uint256 amount);
    event ClanDonationThreshold(uint256 thresholdIncrement, uint16 rewardItemTokenId);
    event Donate(address from_, uint256 playerId, uint256 amount, uint256 lotteryId, uint256 raffleId);
    event DonateToClan(address from_, uint256 playerId, uint256 amount, uint256 clanId, uint256 clanXPGained);
    event GlobalDonationThreshold(uint256 thresholdIncrement);
    event LastClanDonationThreshold(uint256 clanId, uint256 lastThreshold, uint16 rewardItemTokenId);
    event LastGlobalDonationThreshold(uint256 lastThreshold, uint16 rewardItemTokenId);
    event SetRaffleEntryCost(uint256 brushAmount);
    event WinnerAndNewLottery(uint256 lotteryId, uint256 raffleId, uint16 rewardItemTokenId, uint256 rewardAmount);
    error MinimumOneBrush();
    error NoDecimalsAllowed(uint256 invalidAmount);
    error NotEnoughBrush();
    error NotOwnerOfPlayer();
    error NotPlayers();
    error OnlyRandomnessBeacon();
    error OracleNotCalledYet();
}
