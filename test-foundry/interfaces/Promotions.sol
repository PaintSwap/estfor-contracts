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

interface Promotions {
    function FINAL_PROMOTION_DAY_INDEX() external view returns (uint256);
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function addPromotions(PromotionInfoInput[] calldata promotionInfoInput) external;
    function adminMintPromotionalPack(address to, uint256 playerId, string calldata redeemCode, Promotion promotion)
        external;
    function editPromotions(PromotionInfoInput[] calldata promotionInfoInputs) external;
    function getActivePromotion(uint256 promotionId) external view returns (PromotionInfo memory);
    function getMultidayPlayerPromotionsCompleted(uint256 playerId, Promotion promotion, uint256 day)
        external
        view
        returns (uint8);
    function hasClaimedAny(uint256 playerId, Promotion promotion) external view returns (bool);
    function hasCompletedPromotion(uint256 playerId, Promotion promotion) external view returns (bool);
    function initialize(
        address players,
        address randomnessBeacon,
        address dailyRewardsScheduler,
        address itemNFT,
        address playerNFT,
        address quests,
        address brush,
        address treasury,
        address dev,
        address adminAccess,
        bool isBeta
    ) external;
    function mintPromotion(uint256 playerId, Promotion promotion) external;
    function mintPromotionView(uint256 playerId, Promotion promotion, uint256 timestamp)
        external
        view
        returns (
            uint256[] memory itemTokenIds,
            uint256[] memory amounts,
            uint256[] memory daysToSet,
            PromotionMintStatus promotionMintStatus
        );
    function mintPromotionViewNow(uint256 playerId, Promotion promotion)
        external
        view
        returns (
            uint256[] memory itemTokenIds,
            uint256[] memory amounts,
            uint256[] memory daysToSet,
            PromotionMintStatus promotionMintStatus
        );
    function mintStarterPromotionalPack(address to, uint256 playerId, string calldata redeemCode) external;
    function owner() external view returns (address);
    function payMissedPromotionDays(uint256 playerId, Promotion promotion, uint256[] calldata missedDays) external;
    function proxiableUUID() external view returns (bytes32);
    function removePromotions(Promotion[] calldata promotions) external;
    function renounceOwnership() external;
    function setBrushDistributionPercentages(
        uint8 brushBurntPercentage,
        uint8 brushTreasuryPercentage,
        uint8 brushDevPercentage
    ) external;
    function setDevAddress(address dev) external;
    function testClearPlayerPromotions(uint256 playerId, Promotion[] calldata promotions) external;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AddPromotions(PromotionInfoInput[] promotionInfos);
    event ClearPlayerPromotions(uint256 playerId, Promotion[] promotions);
    event EditPromotions(PromotionInfoInput[] promotionInfos);
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PromotionRedeemed(
        address indexed to,
        uint256 playerId,
        Promotion promotion,
        string redeemCode,
        uint256[] itemTokenIds,
        uint256[] amounts,
        uint256[] daysRedeemed,
        uint256 tokenCost
    );
    event RemovePromotions(Promotion[] promotions);
    event SetBrushDistributionPercentages(
        uint256 brushBurntPercentage, uint256 brushTreasuryPercentage, uint256 brushDevPercentage
    );
    event Upgraded(address indexed implementation);
    error AddressEmptyCode(address target);
    error CannotPayForToday();
    error DaysArrayNotSortedOrDuplicates();
    error DependentQuestNotCompleted();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidBrushCost();
    error InvalidInitialization();
    error InvalidPromotion();
    error InvalidRedeemCode();
    error MintingOutsideAvailableDate();
    error MustBeAdminOnlyPromotion();
    error NotAdminAndBeta();
    error NotEnoughBrush();
    error NotInitializing();
    error NotOwnerOfPlayer();
    error NotOwnerOfPlayerAndActive();
    error NotPromotionalAdmin();
    error OracleNotCalled();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PercentNotTotal100();
    error PlayerDoesNotQualify();
    error PlayerNotEvolved();
    error PlayerNotHitEnoughClaims();
    error PromotionAlreadyClaimed();
    error PromotionFinished();
    error PromotionNotAdded();
    error PromotionNotSet();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
}
