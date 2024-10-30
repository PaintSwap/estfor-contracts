// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {BokkyPooBahsRedBlackTreeLibrary} from "../BokkyPooBahsRedBlackTreeLibrary.sol";

interface IOrderBook is IERC1155Receiver {
  enum OrderSide {
    Buy,
    Sell
  }

  struct TokenIdInfo {
    uint128 tick;
    uint128 minQuantity;
  }

  struct LimitOrder {
    OrderSide side;
    uint256 tokenId;
    uint72 price;
    uint24 quantity;
  }

  struct MarketOrder {
    OrderSide side;
    uint256 tokenId;
    uint24 quantity;
    uint256 totalCost;
  }

  struct CancelOrder {
    OrderSide side;
    uint256 tokenId;
    uint72 price;
  }

  struct ClaimableTokenInfo {
    address maker;
    uint80 amount;
    uint16 tokenId;
  }

  // A helper type for a view function to return orders
  struct Order {
    address maker;
    uint24 quantity;
    uint40 id;
  }

  event AddedToBook(address maker, OrderSide side, uint256 orderId, uint256 tokenId, uint256 price, uint256 quantity);
  event OrdersMatched(address taker, uint256[] orderIds, uint256[] quantities);
  event OrdersCancelled(address maker, uint256[] orderIds);
  event FailedToAddToBook(address maker, OrderSide side, uint256 tokenId, uint256 price, uint256 quantity);
  event ClaimedTokens(address user, uint256[] orderIds, uint256 amount);
  event ClaimedNFTs(address user, uint256[] orderIds, uint256[] tokenIds, uint256[] amounts);
  event SetTokenIdInfos(uint256[] tokenIds, TokenIdInfo[] tokenInfos);
  event SetMaxOrdersPerPriceLevel(uint256 maxOrdesrsPerPrice);
  event SetFees(address devAddr, uint256 devFee, uint256 burntFee);

  error ZeroAddress();
  error DevFeeNotSet();
  error DevFeeTooHigh();
  error NotERC1155();
  error NoQuantity();
  error OrderNotFound(uint256 orderId, uint256 price);
  error OrderNotFoundInTree(uint256 orderId, uint256 price);
  error PriceNotMultipleOfTick(uint256 tick);
  error TokenDoesntExist(uint256 tokenId);
  error PriceZero();
  error LengthMismatch();
  error NotMaker();
  error NothingToClaim();
  error TooManyOrdersHit();
  error MaxOrdersNotMultipleOfOrdersInSegment();
  error TickCannotBeChanged();
  error ClaimingTooManyOrders();
  error FailedToTakeFromBook(address taker, OrderSide side, uint256 tokenId, uint256 quantityRemaining);
  error TotalCostConditionNotMet();

  function marketOrder(MarketOrder calldata order) external;

  function limitOrders(LimitOrder[] calldata orders) external;

  function cancelOrders(uint256[] calldata orderIds, CancelOrder[] calldata cancelClaimableTokenInfos) external;

  function cancelAndMakeLimitOrders(
    uint256[] calldata orderIds,
    CancelOrder[] calldata orders,
    LimitOrder[] calldata newOrders
  ) external;

  function claimTokens(uint256[] calldata _orderIds) external;

  function claimNFTs(uint256[] calldata orderIds) external;

  function claimAll(uint256[] calldata coinOrderIds, uint256[] calldata nftOrderIds) external;

  function tokensClaimable(uint40[] calldata orderIds) external view returns (uint256 amount);

  function nftsClaimable(uint40[] calldata orderIds) external view returns (uint256[] memory amounts);

  function getHighestBid(uint256 tokenId) external view returns (uint72);

  function getLowestAsk(uint256 tokenId) external view returns (uint72);

  function getNode(
    OrderSide side,
    uint256 tokenId,
    uint72 price
  ) external view returns (BokkyPooBahsRedBlackTreeLibrary.Node memory);

  function nodeExists(OrderSide side, uint256 tokenId, uint72 price) external view returns (bool);

  function getTokenIdInfo(uint256 tokenId) external view returns (TokenIdInfo memory);

  function getClaimableTokenInfo(uint40 _orderId) external view returns (ClaimableTokenInfo memory);

  function allOrdersAtPrice(
    OrderSide side,
    uint256 tokenId,
    uint72 price
  ) external view returns (Order[] memory orderBookEntries);
}
