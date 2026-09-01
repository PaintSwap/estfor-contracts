// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../contracts/globals/actions.sol";
import "../../contracts/globals/clans.sol";
import "../../contracts/globals/items.sol";
import "../../contracts/globals/misc.sol";
import "../../contracts/globals/pets.sol";
import "../../contracts/globals/players.sol";
import "../../contracts/globals/promotions.sol";
import "../../contracts/globals/quests.sol";
import "../../contracts/globals/rewards.sol";

interface WishingWell {
    struct ClanInfo {
        uint40 totalDonated;
        uint40 lastThreshold;
        uint16 nextReward;
    }
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function claimedLotteryWinnings(uint256 lotteryId) external;
    function donate(address from_, uint256 playerId, uint256 amount)
        external
        returns (uint16 itemTokenId, uint16 globalItemTokenId, uint256 clanId, uint16 clanItemTokenId);
    function getClanDonationInfo(uint256 clanId) external view returns (WishingWell.ClanInfo memory);
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
        address brush,
        address playerNFT,
        address treasury,
        address randomnessBeacon,
        address clans,
        uint256 raffleEntryCost,
        uint256 globalThresholdIncrement,
        uint256 clanThresholdIncrement,
        address activityPoints
    ) external;
    function newOracleRandomWords(uint256 randomWord) external;
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function renounceOwnership() external;
    function setActivityPoints(address activityPoints) external;
    function setClanDonationThresholdIncrement(uint256 clanThresholdIncrement) external;
    function setGlobalDonationThresholdIncrement(uint256 globalThresholdIncrement) external;
    function setNextLotteryWinnerRewardItemTokenId(uint16 donationRewardItemTokenId) external;
    function setPlayers(address players) external;
    function setRaffleEntryCost(uint256 raffleEntryCost) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event ClaimedLotteryWinnings(uint256 lotteryId, uint256 raffleId, uint256 itemTokenId, uint256 amount);
    event ClanDonationThreshold(uint256 thresholdIncrement, uint16 rewardItemTokenId);
    event Donate(address from_, uint256 playerId, uint256 amount, uint256 lotteryId, uint256 raffleId);
    event DonateToClan(address from_, uint256 playerId, uint256 amount, uint256 clanId, uint256 clanXPGained);
    event GlobalDonationThreshold(uint256 thresholdIncrement);
    event Initialized(uint64 version);
    event LastClanDonationThreshold(uint256 clanId, uint256 lastThreshold, uint16 rewardItemTokenId);
    event LastGlobalDonationThreshold(uint256 lastThreshold, uint16 rewardItemTokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SetRaffleEntryCost(uint256 brushAmount);
    event Upgraded(address indexed implementation);
    event WinnerAndNewLottery(uint256 lotteryId, uint256 raffleId, uint16 rewardItemTokenId, uint256 rewardAmount);
    error AddressEmptyCode(address target);
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidInitialization();
    error MinimumOneBrush();
    error NoDecimalsAllowed(uint256 invalidAmount);
    error NotEnoughBrush();
    error NotInitializing();
    error NotOwnerOfPlayer();
    error NotPlayers();
    error OnlyRandomnessBeacon();
    error OracleNotCalledYet();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
}
