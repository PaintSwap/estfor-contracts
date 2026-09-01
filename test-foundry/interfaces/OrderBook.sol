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
import {IOrderBook} from "../../contracts/Bazaar/interfaces/IOrderBook.sol";
import {BokkyPooBahsRedBlackTreeLibrary} from "../../contracts/Bazaar/BokkyPooBahsRedBlackTreeLibrary.sol";

interface OrderBook {
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function allOrdersAtPrice(IOrderBook.OrderSide side, uint256 tokenId, uint256 price)
        external
        view
        returns (IOrderBook.Order[] memory);
    function cancelAndMakeLimitOrders(
        uint256[] calldata orderIds,
        IOrderBook.CancelOrder[] calldata orders,
        IOrderBook.LimitOrder[] calldata newOrders
    ) external;
    function cancelOrders(uint256[] calldata orderIds, IOrderBook.CancelOrder[] calldata orders) external;
    function claimAll(uint256[] calldata coinOrderIds, uint256[] calldata nftOrderIds) external;
    function claimNFTs(uint256[] calldata orderIds) external;
    function claimTokens(uint256[] calldata orderIds) external;
    function getClaimableTokenInfo(uint40 orderId) external view returns (IOrderBook.ClaimableTokenInfo memory);
    function getHighestBid(uint256 tokenId) external view returns (uint72);
    function getLowestAsk(uint256 tokenId) external view returns (uint72);
    function getNode(IOrderBook.OrderSide side, uint256 tokenId, uint256 price)
        external
        view
        returns (BokkyPooBahsRedBlackTreeLibrary.Node memory);
    function getTokenIdInfo(uint256 tokenId) external view returns (IOrderBook.TokenIdInfo memory);
    function initialize(
        address nft,
        address token,
        address devAddr,
        uint16 devFee,
        uint8 burntFee,
        uint16 maxOrdersPerPrice
    ) external;
    function limitOrders(IOrderBook.LimitOrder[] calldata orders) external;
    function marketOrder(IOrderBook.MarketOrder calldata order) external;
    function nftsClaimable(uint40[] calldata orderIds) external view returns (uint256[] memory amounts);
    function nodeExists(IOrderBook.OrderSide side, uint256 tokenId, uint256 price) external view returns (bool);
    function onERC1155BatchReceived(
        address arg0,
        address arg1,
        uint256[] calldata arg2,
        uint256[] calldata arg3,
        bytes calldata arg4
    ) external returns (bytes4);
    function onERC1155Received(address arg0, address arg1, uint256 arg2, uint256 arg3, bytes calldata arg4)
        external
        returns (bytes4);
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function renounceOwnership() external;
    function setFees(address devAddr, uint16 devFee, uint8 burntFee) external;
    function setMaxOrdersPerPrice(uint16 maxOrdersPerPrice) external payable;
    function setTokenIdInfos(uint256[] calldata tokenIds, IOrderBook.TokenIdInfo[] calldata tokenIdInfos)
        external
        payable;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function tokensClaimable(uint40[] calldata orderIds) external view returns (uint256 amount);
    function transferOwnership(address newOwner) external;
    function updateRoyaltyFee() external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AddedToBook(
        address maker, IOrderBook.OrderSide side, uint256 orderId, uint256 tokenId, uint256 price, uint256 quantity
    );
    event ClaimedNFTs(address user, uint256[] orderIds, uint256[] tokenIds, uint256[] amounts);
    event ClaimedTokens(address user, uint256[] orderIds, uint256 amount);
    event FailedToAddToBook(address maker, IOrderBook.OrderSide side, uint256 tokenId, uint256 price, uint256 quantity);
    event Initialized(uint64 version);
    event OrdersCancelled(address maker, uint256[] orderIds);
    event OrdersMatched(address taker, uint256[] orderIds, uint256[] quantities);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SetFees(address devAddr, uint256 devFee, uint256 burntFee);
    event SetMaxOrdersPerPriceLevel(uint256 maxOrdesrsPerPrice);
    event SetTokenIdInfos(uint256[] tokenIds, IOrderBook.TokenIdInfo[] tokenInfos);
    event Upgraded(address indexed implementation);
    error AddressEmptyCode(address target);
    error ClaimableAmountTooHigh();
    error ClaimingTooManyOrders();
    error DevFeeNotSet();
    error DevFeeTooHigh();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error FailedToTakeFromBook(address taker, IOrderBook.OrderSide side, uint256 tokenId, uint256 quantityRemaining);
    error InvalidInitialization();
    error KeyCannotBeZero();
    error KeyDoesntExist();
    error LengthMismatch();
    error MaxOrdersNotMultipleOfOrdersInSegment();
    error NoQuantity();
    error NotERC1155();
    error NotInitializing();
    error NotMaker();
    error NothingToClaim();
    error OrderNotFound(uint256 orderId, uint256 price);
    error OrderNotFoundInTree(uint256 orderId, uint256 price);
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PriceNotMultipleOfTick(uint256 tick);
    error PriceZero();
    error ReentrancyGuardReentrantCall();
    error SafeCastOverflowedUintDowncast(uint8 bits, uint256 value);
    error SafeERC20FailedOperation(address token);
    error TickCannotBeChanged();
    error TokenDoesntExist(uint256 tokenId);
    error TooManyOrdersHit();
    error TotalCostConditionNotMet();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error ZeroAddress();
}
