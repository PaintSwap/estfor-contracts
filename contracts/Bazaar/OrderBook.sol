// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {BokkyPooBahsRedBlackTreeLibrary} from "./BokkyPooBahsRedBlackTreeLibrary.sol";

import {IBrushToken} from "../interfaces/external/IBrushToken.sol";
import {IOrderBook} from "./interfaces/IOrderBook.sol";

/// @notice This efficient ERC1155 order book is an upgradeable UUPS proxy contract. It has functions for bulk placing
///         limit orders, cancelling limit orders, and claiming NFTs and tokens from filled or partially filled orders.
///         It suppports ERC2981 royalties, and optional dev & burn fees on successful trades.
contract OrderBook is UUPSUpgradeable, OwnableUpgradeable, ERC1155Holder, IOrderBook {
  using BokkyPooBahsRedBlackTreeLibrary for BokkyPooBahsRedBlackTreeLibrary.Tree;
  using BokkyPooBahsRedBlackTreeLibrary for BokkyPooBahsRedBlackTreeLibrary.Node;
  using SafeERC20 for IBrushToken;

  // constants
  uint16 private constant MAX_ORDERS_HIT = 500;
  uint8 private constant NUM_ORDERS_PER_SEGMENT = 4;

  uint256 private constant MAX_ORDER_ID = 1_099_511_627_776;

  uint256 private constant MAX_CLAIMABLE_ORDERS = 200;

  // slot_0
  IERC1155 private _nft;

  // slot_1
  IBrushToken private _coin;

  // slot_2
  address private _devAddr;
  uint16 private _devFee;
  uint8 private _burntFee;
  uint16 private _royaltyFee;
  uint16 private _maxOrdersPerPrice;
  uint40 private _nextOrderId;

  // slot_3
  address private _royaltyRecipient;

  // mappings
  mapping(uint256 tokenId => TokenIdInfo tokenIdInfo) private _tokenIdInfos;
  mapping(uint256 tokenId => BokkyPooBahsRedBlackTreeLibrary.Tree) private _asks;
  mapping(uint256 tokenId => BokkyPooBahsRedBlackTreeLibrary.Tree) private _bids;
  // token id => price => ask(quantity (uint24), id (uint40)) x 4
  mapping(uint256 tokenId => mapping(uint256 price => bytes32[] segments)) private _asksAtPrice;
  // token id => price => bid(quantity (uint24), id (uint40)) x 4
  mapping(uint256 tokenId => mapping(uint256 price => bytes32[] segments)) private _bidsAtPrice;
  ClaimableTokenInfo[MAX_ORDER_ID] private _tokenClaimables;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /// @notice Initialize the contract as part of the proxy contract deployment
  /// @param nft Address of the nft
  /// @param token The quote token
  /// @param devAddr The address to receive trade fees
  /// @param devFee The fee to send to the dev address (max 10%)
  /// @param burntFee The fee to burn (max 2.55%)
  /// @param maxOrdersPerPrice The maximum number of orders allowed at each price level
  function initialize(
    IERC1155 nft,
    address token,
    address devAddr,
    uint16 devFee,
    uint8 burntFee,
    uint16 maxOrdersPerPrice
  ) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();

    setFees(devAddr, devFee, burntFee);
    // nft must be an ERC1155 via ERC165
    require(nft.supportsInterface(type(IERC1155).interfaceId), NotERC1155());

    _nft = nft;
    _coin = IBrushToken(token);
    updateRoyaltyFee();

    // The max orders spans segments, so num segments = maxOrdersPrice / NUM_ORDERS_PER_SEGMENT
    setMaxOrdersPerPrice(maxOrdersPerPrice);
    _nextOrderId = 1;
  }

  /// @notice Place market order
  /// @param order market order to be placed
  function marketOrder(MarketOrder calldata order) external override {
    // Must fufill the order and be below the total cost (or above depending on the side)
    uint256 coinsToUs;
    uint256 coinsFromUs;
    address sender = _msgSender();

    uint256[] memory orderIdsPool = new uint256[](MAX_ORDERS_HIT);
    uint256[] memory quantitiesPool = new uint256[](MAX_ORDERS_HIT);

    uint256 cost = _makeMarketOrder(order, orderIdsPool, quantitiesPool);
    bool isBuy = order.side == OrderSide.Buy;
    (uint256 royalty, uint256 dev, uint256 burn) = _calcFees(cost);
    if (isBuy) {
      require(cost <= order.totalCost, TotalCostConditionNotMet());

      coinsToUs = cost;
    } else {
      require(cost >= order.totalCost, TotalCostConditionNotMet());

      // Transfer tokens to the seller if any have sold
      uint256 fees = royalty + dev + burn;
      coinsFromUs = cost - fees;
    }

    if (coinsToUs != 0) {
      _coin.safeTransferFrom(sender, address(this), coinsToUs);
    }

    if (coinsFromUs != 0) {
      _coin.safeTransfer(sender, coinsFromUs);
    }

    if (!isBuy) {
      // Selling, transfer all NFTs to us
      _safeTransferNFTsToUs(sender, order.tokenId, order.quantity);
    } else {
      // Buying transfer the NFTs to the taker
      _safeTransferNFTsFromUs(sender, order.tokenId, order.quantity);
    }

    _sendFees(royalty, dev, burn);
  }

  /// @notice Place multiple limit orders in the order book
  /// @param orders Array of limit orders to be placed
  function limitOrders(LimitOrder[] calldata orders) public override {
    uint256 royalty;
    uint256 dev;
    uint256 burn;
    uint256 coinsToUs;
    uint256 coinsFromUs;
    uint256 nftsToUs;
    uint256[] memory nftIdsToUs = new uint256[](orders.length);
    uint256[] memory nftAmountsToUs = new uint256[](orders.length);
    uint256 lengthFromUs;
    uint256[] memory nftIdsFromUs = new uint256[](orders.length);
    uint256[] memory nftAmountsFromUs = new uint256[](orders.length);
    address sender = _msgSender();

    // Reuse this array in all the orders
    uint256[] memory orderIdsPool = new uint256[](MAX_ORDERS_HIT);
    uint256[] memory quantitiesPool = new uint256[](MAX_ORDERS_HIT);

    // read the next order ID so we can increment in memory
    uint40 currentOrderId = _nextOrderId;
    for (uint256 i = 0; i < orders.length; ++i) {
      LimitOrder calldata limitOrder = orders[i];
      (uint24 quantityAddedToBook, uint24 failedQuantity, uint256 cost) = _makeLimitOrder(
        currentOrderId,
        limitOrder,
        orderIdsPool,
        quantitiesPool
      );
      if (quantityAddedToBook != 0) {
        ++currentOrderId;
      }

      uint256 feesOrder;
      if (cost != 0) {
        (uint256 royaltyOrder, uint256 devOrder, uint256 burnOrder) = _calcFees(cost);
        royalty += royaltyOrder;
        dev += devOrder;
        burn += burnOrder;
        feesOrder = royaltyOrder + devOrder + burnOrder;
      }

      if (limitOrder.side == OrderSide.Buy) {
        coinsToUs += cost + uint256(limitOrder.price) * quantityAddedToBook;
        if (cost != 0) {
          // Transfer the NFTs taken from the order book straight to the taker
          nftIdsFromUs[lengthFromUs] = limitOrder.tokenId;
          nftAmountsFromUs[lengthFromUs] = uint256(limitOrder.quantity) - quantityAddedToBook;
          ++lengthFromUs;
        }
      } else {
        // Selling, transfer all NFTs to us
        uint256 amount = limitOrder.quantity - failedQuantity;
        if (amount != 0) {
          nftIdsToUs[nftsToUs] = limitOrder.tokenId;
          nftAmountsToUs[nftsToUs] = amount;
          ++nftsToUs;
        }

        // Transfer tokens to the seller if any have sold
        coinsFromUs += cost - feesOrder;
      }
    }

    // update the state if any orders were added to the book
    if (currentOrderId != _nextOrderId) {
      _nextOrderId = currentOrderId;
    }

    if (coinsToUs != 0) {
      _coin.safeTransferFrom(sender, address(this), coinsToUs);
    }

    if (coinsFromUs != 0) {
      _coin.safeTransfer(sender, coinsFromUs);
    }

    if (nftsToUs != 0) {
      assembly ("memory-safe") {
        mstore(nftIdsToUs, nftsToUs)
        mstore(nftAmountsToUs, nftsToUs)
      }
      _safeBatchTransferNFTsToUs(sender, nftIdsToUs, nftAmountsToUs);
    }

    if (lengthFromUs != 0) {
      assembly ("memory-safe") {
        mstore(nftIdsFromUs, lengthFromUs)
        mstore(nftAmountsFromUs, lengthFromUs)
      }
      _safeBatchTransferNFTsFromUs(sender, nftIdsFromUs, nftAmountsFromUs);
    }

    _sendFees(royalty, dev, burn);
  }

  /// @notice Cancel multiple orders in the order book
  /// @param orderIds Array of order IDs to be cancelled
  /// @param orders Information about the orders so that they can be found in the order book
  function cancelOrders(uint256[] calldata orderIds, CancelOrder[] calldata orders) public override {
    require(orderIds.length == orders.length, LengthMismatch());

    address sender = _msgSender();

    uint256 coinsFromUs = 0;
    uint256 nftsFromUs = 0;
    uint256 numberOfOrders = orderIds.length;
    uint256[] memory nftIdsFromUs = new uint256[](numberOfOrders);
    uint256[] memory nftAmountsFromUs = new uint256[](numberOfOrders);
    for (uint256 i = 0; i < numberOfOrders; ++i) {
      CancelOrder calldata cancelOrder = orders[i];
      (OrderSide side, uint256 tokenId, uint72 price) = (cancelOrder.side, cancelOrder.tokenId, cancelOrder.price);

      if (side == OrderSide.Buy) {
        uint256 quantity = _cancelOrdersSide(orderIds[i], price, _bidsAtPrice[tokenId][price], _bids[tokenId]);
        // Send the remaining token back to them
        coinsFromUs += quantity * price;
      } else {
        uint256 quantity = _cancelOrdersSide(orderIds[i], price, _asksAtPrice[tokenId][price], _asks[tokenId]);
        // Send the remaining NFTs back to them
        nftIdsFromUs[nftsFromUs] = tokenId;
        nftAmountsFromUs[nftsFromUs] = quantity;
        ++nftsFromUs;
      }
    }

    emit OrdersCancelled(sender, orderIds);

    // Transfer tokens if there are any to send
    if (coinsFromUs != 0) {
      _coin.safeTransfer(sender, coinsFromUs);
    }

    // Send the NFTs
    if (nftsFromUs != 0) {
      // shrink the size
      assembly ("memory-safe") {
        mstore(nftIdsFromUs, nftsFromUs)
        mstore(nftAmountsFromUs, nftsFromUs)
      }
      _safeBatchTransferNFTsFromUs(sender, nftIdsFromUs, nftAmountsFromUs);
    }
  }

  /// @notice Cancel multiple orders and place multiple limit orders in the order book. Can be used to replace orders
  /// @param orderIds Array of order IDs to be cancelled
  /// @param orders Information about the orders so that they can be found in the order book
  /// @param newOrders Array of limit orders to be placed
  function cancelAndMakeLimitOrders(
    uint256[] calldata orderIds,
    CancelOrder[] calldata orders,
    LimitOrder[] calldata newOrders
  ) external override {
    cancelOrders(orderIds, orders);
    limitOrders(newOrders);
  }

  /// @notice Claim tokens associated with filled or partially filled orders.
  ///         Must be the maker of these orders.
  /// @param orderIds Array of order IDs from which to claim NFTs
  function claimTokens(uint256[] calldata orderIds) public override {
    require(orderIds.length <= MAX_CLAIMABLE_ORDERS, ClaimingTooManyOrders());
    uint256 amount;
    for (uint256 i = 0; i < orderIds.length; ++i) {
      uint40 orderId = SafeCast.toUint40(orderIds[i]);
      ClaimableTokenInfo storage claimableTokenInfo = _tokenClaimables[orderId];
      uint256 claimableAmount = claimableTokenInfo.amount;
      require(claimableAmount != 0, NothingToClaim());
      require(claimableTokenInfo.maker == _msgSender(), NotMaker());

      claimableTokenInfo.amount = 0;
      amount += claimableAmount;
    }

    require(amount != 0, NothingToClaim());
    _coin.safeTransfer(_msgSender(), amount);
    emit ClaimedTokens(_msgSender(), orderIds, amount);
  }

  /// @notice Claim NFTs associated with filled or partially filled orders
  ///         Must be the maker of these orders.
  /// @param orderIds Array of order IDs from which to claim NFTs
  function claimNFTs(uint256[] calldata orderIds) public override {
    require(orderIds.length <= MAX_CLAIMABLE_ORDERS, ClaimingTooManyOrders());
    require(orderIds.length != 0, NothingToClaim());

    uint256[] memory nftAmountsFromUs = new uint256[](orderIds.length);
    uint256[] memory tokenIds = new uint256[](orderIds.length);
    for (uint256 i = 0; i < tokenIds.length; ++i) {
      uint40 orderId = SafeCast.toUint40(orderIds[i]);
      ClaimableTokenInfo storage claimableTokenInfo = _tokenClaimables[orderId];
      uint256 tokenId = claimableTokenInfo.tokenId;
      tokenIds[i] = tokenId;
      uint256 claimableAmount = claimableTokenInfo.amount;
      require(claimableAmount != 0, NothingToClaim());
      require(_tokenClaimables[orderId].maker == _msgSender(), NotMaker());

      nftAmountsFromUs[i] = claimableAmount;
      _tokenClaimables[orderId].amount = 0;
    }

    _safeBatchTransferNFTsFromUs(_msgSender(), tokenIds, nftAmountsFromUs);
    emit ClaimedNFTs(_msgSender(), orderIds, tokenIds, nftAmountsFromUs);
  }

  /// @notice Convience function to claim both tokens and nfts in filled or partially filled orders.
  ///         Must be the maker of these orders.
  /// @param coinOrderIds Array of order IDs from which to claim tokens
  /// @param nftOrderIds Array of order IDs from which to claim NFTs
  function claimAll(uint256[] calldata coinOrderIds, uint256[] calldata nftOrderIds) external override {
    require(coinOrderIds.length != 0 || nftOrderIds.length != 0, NothingToClaim());
    require(coinOrderIds.length + nftOrderIds.length <= MAX_CLAIMABLE_ORDERS, ClaimingTooManyOrders());

    if (coinOrderIds.length != 0) {
      claimTokens(coinOrderIds);
    }

    if (nftOrderIds.length != 0) {
      claimNFTs(nftOrderIds);
    }
  }

  /// @notice When the _nft royalty changes this updates the fee and recipient. Assumes all token ids have the same royalty
  function updateRoyaltyFee() public {
    if (_nft.supportsInterface(type(IERC2981).interfaceId)) {
      (address royaltyRecipient, uint256 royaltyFee) = IERC2981(address(_nft)).royaltyInfo(1, 10000);
      _royaltyRecipient = royaltyRecipient;
      _royaltyFee = uint16(royaltyFee);
    } else {
      _royaltyRecipient = address(0);
      _royaltyFee = 0;
    }
  }

  /// @notice Get the amount of tokens claimable for these orders
  /// @param orderIds The order IDs of which to find the claimable tokens for
  function tokensClaimable(uint40[] calldata orderIds) external view override returns (uint256 amount) {
    for (uint256 i = 0; i < orderIds.length; ++i) {
      ClaimableTokenInfo storage claimableTokenInfo = _tokenClaimables[orderIds[i]];
      if (claimableTokenInfo.tokenId == 0) {
        amount += claimableTokenInfo.amount;
      }
    }
  }

  /// @notice Get the amount of NFTs claimable for these orders
  /// @param orderIds The order IDs to get the claimable NFTs for
  function nftsClaimable(uint40[] calldata orderIds) external view override returns (uint256[] memory amounts) {
    amounts = new uint256[](orderIds.length);
    for (uint256 i = 0; i < orderIds.length; ++i) {
      ClaimableTokenInfo storage claimableTokenInfo = _tokenClaimables[orderIds[i]];
      if (claimableTokenInfo.tokenId != 0) {
        amounts[i] = claimableTokenInfo.amount;
      }
    }
  }

  /// @notice Get the token ID info for a specific token ID
  /// @param tokenId The token ID to get the info for
  function getTokenIdInfo(uint256 tokenId) external view override returns (TokenIdInfo memory) {
    return _tokenIdInfos[tokenId];
  }

  function getClaimableTokenInfo(uint40 orderId) external view override returns (ClaimableTokenInfo memory) {
    return _tokenClaimables[orderId];
  }

  /// @notice Get the highest bid for a specific token ID
  /// @param tokenId The token ID to get the highest bid for
  function getHighestBid(uint256 tokenId) public view override returns (uint72) {
    return _bids[tokenId].last();
  }

  /// @notice Get the lowest ask for a specific token ID
  /// @param tokenId The token ID to get the lowest ask for
  function getLowestAsk(uint256 tokenId) public view override returns (uint72) {
    return _asks[tokenId].first();
  }

  /// @notice Get the order book entry for a specific order ID
  /// @param side The side of the order book to get the order from
  /// @param tokenId The token ID to get the order for
  /// @param price The price level to get the order for
  function getNode(
    OrderSide side,
    uint256 tokenId,
    uint72 price
  ) external view override returns (BokkyPooBahsRedBlackTreeLibrary.Node memory) {
    if (side == OrderSide.Buy) {
      return _bids[tokenId].getNode(price);
    } else {
      return _asks[tokenId].getNode(price);
    }
  }

  /// @notice Check if the node exists
  /// @param side The side of the order book to get the order from
  /// @param tokenId The token ID to get the order for
  /// @param price The price level to get the order for
  function nodeExists(OrderSide side, uint256 tokenId, uint72 price) external view override returns (bool) {
    if (side == OrderSide.Buy) {
      return _bids[tokenId].exists(price);
    } else {
      return _asks[tokenId].exists(price);
    }
  }

  /// @notice Get all orders at a specific price level
  /// @param side The side of the order book to get orders from
  /// @param tokenId The token ID to get orders for
  /// @param price The price level to get orders for
  function allOrdersAtPrice(
    OrderSide side,
    uint256 tokenId,
    uint72 price
  ) external view override returns (Order[] memory) {
    if (side == OrderSide.Buy) {
      return _allOrdersAtPriceSide(_bidsAtPrice[tokenId][price], _bids[tokenId], price);
    } else {
      return _allOrdersAtPriceSide(_asksAtPrice[tokenId][price], _asks[tokenId], price);
    }
  }

  function _takeFromOrderBookSide(
    uint256 tokenId,
    uint72 price,
    uint24 quantity,
    uint256[] memory orderIdsPool,
    uint256[] memory quantitiesPool,
    OrderSide side, // which side are you taking from
    mapping(uint256 tokenId => mapping(uint256 price => bytes32[] segments)) storage segmentsAtPrice,
    mapping(uint256 tokenId => BokkyPooBahsRedBlackTreeLibrary.Tree) storage tree
  ) private returns (uint24 quantityRemaining, uint256 cost) {
    quantityRemaining = quantity;

    // reset the size
    assembly ("memory-safe") {
      mstore(orderIdsPool, MAX_ORDERS_HIT)
      mstore(quantitiesPool, MAX_ORDERS_HIT)
    }

    bool isTakingFromBuy = side == OrderSide.Buy;
    uint256 numberOfOrders;
    while (quantityRemaining != 0) {
      uint72 bestPrice = isTakingFromBuy ? getHighestBid(tokenId) : getLowestAsk(tokenId);
      if (bestPrice == 0 || (isTakingFromBuy ? bestPrice < price : bestPrice > price)) {
        // No more orders left
        break;
      }

      // Loop through all at this order
      uint256 numSegmentsFullyConsumed = 0;
      bytes32[] storage segments = segmentsAtPrice[tokenId][bestPrice];
      BokkyPooBahsRedBlackTreeLibrary.Node storage node = tree[tokenId].getNode(bestPrice);

      bool eatIntoLastOrder;
      uint256 numOrdersWithinLastSegmentFullyConsumed;
      bytes32 segment;
      uint256 lastSegment;
      for (uint256 i = node.tombstoneOffset; i < segments.length && quantityRemaining != 0; ++i) {
        lastSegment = i;
        segment = segments[i];
        uint256 numOrdersWithinSegmentConsumed;
        bool wholeSegmentConsumed;
        for (uint256 offset; offset < NUM_ORDERS_PER_SEGMENT && quantityRemaining != 0; ++offset) {
          uint256 remainingSegment = uint256(segment >> (offset * 64));
          uint40 orderId = uint40(remainingSegment);
          if (orderId == 0) {
            // Check if there are any order left in this segment
            if (remainingSegment != 0) {
              // Skip this order in the segment as it's been deleted
              ++numOrdersWithinLastSegmentFullyConsumed;
              continue;
            } else {
              break;
            }
          }
          uint24 quantityL3 = uint24(uint256(segment >> (offset * 64 + 40)));
          uint256 quantityNFTClaimable = 0;
          if (quantityRemaining >= quantityL3) {
            // Consume this whole order
            quantityRemaining -= quantityL3;
            // Is the last one in the segment being fully consumed?
            wholeSegmentConsumed = offset == NUM_ORDERS_PER_SEGMENT - 1;
            ++numOrdersWithinSegmentConsumed;
            quantityNFTClaimable = quantityL3;
          } else {
            // Eat into the order
            segment = bytes32(
              (uint256(segment) & ~(uint256(0xffffff) << (offset * 64 + 40))) |
                (uint256(quantityL3 - quantityRemaining) << (offset * 64 + 40))
            );
            quantityNFTClaimable = quantityRemaining;
            quantityRemaining = 0;
            eatIntoLastOrder = true;
          }
          uint256 tradeCost = quantityNFTClaimable * bestPrice;
          cost += tradeCost;

          ClaimableTokenInfo storage claimableTokenInfo = _tokenClaimables[orderId];
          if (isTakingFromBuy) {
            claimableTokenInfo.amount += uint80(quantityNFTClaimable);
          } else {
            uint256 fees = _calcFee(tradeCost);
            claimableTokenInfo.amount += uint80(tradeCost - fees);
          }

          orderIdsPool[numberOfOrders] = orderId;
          quantitiesPool[numberOfOrders] = quantityNFTClaimable;
          ++numberOfOrders;

          require(numberOfOrders < MAX_ORDERS_HIT, TooManyOrdersHit());
        }

        if (wholeSegmentConsumed) {
          ++numSegmentsFullyConsumed;
          numOrdersWithinLastSegmentFullyConsumed = 0;
        } else {
          numOrdersWithinLastSegmentFullyConsumed += numOrdersWithinSegmentConsumed;
          if (eatIntoLastOrder) {
            break;
          }
        }
      }

      if (numSegmentsFullyConsumed != 0) {
        uint256 tombstoneOffset = node.tombstoneOffset;
        tree[tokenId].edit(bestPrice, uint32(numSegmentsFullyConsumed));

        // Consumed all orders at this price level, so remove it from the tree
        if (numSegmentsFullyConsumed == segments.length - tombstoneOffset) {
          tree[tokenId].remove(bestPrice); // TODO: A ranged delete would be nice
        }
      }

      if (eatIntoLastOrder || numOrdersWithinLastSegmentFullyConsumed != 0) {
        // This segment wasn't completely filled before
        if (numOrdersWithinLastSegmentFullyConsumed != 0) {
          for (uint256 i; i < numOrdersWithinLastSegmentFullyConsumed; ++i) {
            segment &= _clearOrderMask(i);
          }
        }
        if (uint256(segment) == 0) {
          // All orders in the segment are consumed, delete from tree
          tree[tokenId].remove(bestPrice);
        }

        segments[lastSegment] = segment;

        if (eatIntoLastOrder) {
          break;
        }
      }
    }
    if (numberOfOrders != 0) {
      assembly ("memory-safe") {
        mstore(orderIdsPool, numberOfOrders)
        mstore(quantitiesPool, numberOfOrders)
      }

      emit OrdersMatched(_msgSender(), orderIdsPool, quantitiesPool);
    }
  }

  function _takeFromOrderBook(
    OrderSide side,
    uint256 tokenId,
    uint72 price,
    uint24 quantity,
    uint256[] memory orderIdsPool,
    uint256[] memory quantitiesPool
  ) private returns (uint24 quantityRemaining, uint256 cost) {
    // Take as much as possible from the order book
    if (side == OrderSide.Buy) {
      (quantityRemaining, cost) = _takeFromOrderBookSide(
        tokenId,
        price,
        quantity,
        orderIdsPool,
        quantitiesPool,
        OrderSide.Sell,
        _asksAtPrice,
        _asks
      );
    } else {
      (quantityRemaining, cost) = _takeFromOrderBookSide(
        tokenId,
        price,
        quantity,
        orderIdsPool,
        quantitiesPool,
        OrderSide.Buy,
        _bidsAtPrice,
        _bids
      );
    }
  }

  function _allOrdersAtPriceSide(
    bytes32[] storage segments,
    BokkyPooBahsRedBlackTreeLibrary.Tree storage tree,
    uint72 price
  ) private view returns (Order[] memory orders) {
    if (!tree.exists(price)) {
      return orders;
    }
    BokkyPooBahsRedBlackTreeLibrary.Node storage node = tree.getNode(price);
    uint256 tombstoneOffset = node.tombstoneOffset;

    uint256 numInSegmentDeleted;
    {
      uint256 segment = uint256(segments[tombstoneOffset]);
      for (uint256 offset; offset < NUM_ORDERS_PER_SEGMENT; ++offset) {
        uint256 remainingSegment = uint64(segment >> (offset * 64));
        uint64 order = uint64(remainingSegment);
        if (order == 0) {
          ++numInSegmentDeleted;
        } else {
          break;
        }
      }
    }

    orders = new Order[]((segments.length - tombstoneOffset) * NUM_ORDERS_PER_SEGMENT - numInSegmentDeleted);
    uint256 numberOfEntries;
    for (uint256 i = numInSegmentDeleted; i < orders.length + numInSegmentDeleted; ++i) {
      uint256 segment = uint256(segments[i / NUM_ORDERS_PER_SEGMENT + tombstoneOffset]);
      uint256 offset = i % NUM_ORDERS_PER_SEGMENT;
      uint40 id = uint40(segment >> (offset * 64));
      if (id != 0) {
        uint24 quantity = uint24(segment >> (offset * 64 + 40));
        orders[numberOfEntries] = Order(_tokenClaimables[id].maker, quantity, id);
        ++numberOfEntries;
      }
    }

    assembly ("memory-safe") {
      mstore(orders, numberOfEntries)
    }
  }

  function _cancelOrdersSide(
    uint256 orderId,
    uint72 price,
    bytes32[] storage segments,
    BokkyPooBahsRedBlackTreeLibrary.Tree storage tree
  ) private returns (uint24 quantity) {
    // Loop through all of them until we hit ours.
    if (!tree.exists(price)) {
      revert OrderNotFoundInTree(orderId, price);
    }

    BokkyPooBahsRedBlackTreeLibrary.Node storage node = tree.getNode(price);
    uint256 tombstoneOffset = node.tombstoneOffset;

    (uint256 index, uint256 offset) = _find(segments, tombstoneOffset, segments.length, orderId);
    if (index == type(uint).max) {
      revert OrderNotFound(orderId, price);
    }
    quantity = uint24(uint256(segments[index]) >> (offset * 64 + 40));
    _cancelOrder(segments, price, index, offset, tombstoneOffset, tree);
  }

  function _makeMarketOrder(
    MarketOrder calldata order,
    uint256[] memory orderIdsPool,
    uint256[] memory quantitiesPool
  ) private returns (uint256 cost) {
    require(order.quantity != 0, NoQuantity());

    uint128 tick = _tokenIdInfos[order.tokenId].tick;

    require(tick != 0, TokenDoesntExist(order.tokenId));

    uint24 quantityRemaining;
    uint72 price = order.side == OrderSide.Buy ? type(uint72).max : 0;
    (quantityRemaining, cost) = _takeFromOrderBook(
      order.side,
      order.tokenId,
      price,
      order.quantity,
      orderIdsPool,
      quantitiesPool
    );

    require(quantityRemaining == 0, FailedToTakeFromBook(_msgSender(), order.side, order.tokenId, quantityRemaining));
  }

  function _makeLimitOrder(
    uint40 newOrderId,
    LimitOrder calldata limitOrder,
    uint256[] memory orderIdsPool,
    uint256[] memory quantitiesPool
  ) private returns (uint24 quantityAddedToBook, uint24 failedQuantity, uint256 cost) {
    require(limitOrder.quantity != 0, NoQuantity());
    require(limitOrder.price != 0, PriceZero());

    uint128 tick = _tokenIdInfos[limitOrder.tokenId].tick;

    require(tick != 0, TokenDoesntExist(limitOrder.tokenId));
    require(limitOrder.price % tick == 0, PriceNotMultipleOfTick(tick));

    uint24 quantityRemaining;
    (quantityRemaining, cost) = _takeFromOrderBook(
      limitOrder.side,
      limitOrder.tokenId,
      limitOrder.price,
      limitOrder.quantity,
      orderIdsPool,
      quantitiesPool
    );

    // Add the rest to the order book if has the minimum required, in order to keep order books healthy
    if (quantityRemaining >= _tokenIdInfos[limitOrder.tokenId].minQuantity) {
      quantityAddedToBook = quantityRemaining;
      _addToBook(newOrderId, tick, limitOrder.side, limitOrder.tokenId, limitOrder.price, quantityAddedToBook);
    } else if (quantityRemaining != 0) {
      failedQuantity = quantityRemaining;
      emit FailedToAddToBook(_msgSender(), limitOrder.side, limitOrder.tokenId, limitOrder.price, failedQuantity);
    }
  }

  function _addToBookSide(
    mapping(uint256 price => bytes32[]) storage segmentsPriceMap,
    BokkyPooBahsRedBlackTreeLibrary.Tree storage tree,
    uint72 price,
    uint256 orderId,
    uint256 quantity,
    int128 tick // -1 for buy, +1 for sell
  ) private returns (uint72) {
    // Add to the bids section
    if (!tree.exists(price)) {
      tree.insert(price);
    } else {
      uint256 tombstoneOffset = tree.getNode(price).tombstoneOffset;
      // Check if this would go over the max number of orders allowed at this price level
      bool lastSegmentFilled = uint256(
        segmentsPriceMap[price][segmentsPriceMap[price].length - 1] >> ((NUM_ORDERS_PER_SEGMENT - 1) * 64)
      ) != 0;

      // Check if last segment is full
      if (
        (segmentsPriceMap[price].length - tombstoneOffset) * NUM_ORDERS_PER_SEGMENT >= _maxOrdersPerPrice &&
        lastSegmentFilled
      ) {
        // Loop until we find a suitable place to put this
        while (true) {
          price = SafeCast.toUint72(uint128(int128(uint128(price)) + tick));
          if (!tree.exists(price)) {
            tree.insert(price);
            break;
          } else if (
            (segmentsPriceMap[price].length - tombstoneOffset) * NUM_ORDERS_PER_SEGMENT < _maxOrdersPerPrice ||
            uint256(
              segmentsPriceMap[price][segmentsPriceMap[price].length - 1] >> ((NUM_ORDERS_PER_SEGMENT - 1) * 64)
            ) ==
            0
          ) {
            // There are segments available at this price level or the last segment is not filled yet
            break;
          }
        }
      }
    }

    // Read last one. Decide if we can add to the existing segment or if we need to add a new segment
    bytes32[] storage segments = segmentsPriceMap[price];
    bool pushToEnd = true;
    if (segments.length != 0) {
      bytes32 lastSegment = segments[segments.length - 1];
      // Are there are free entries in this segment
      for (uint256 offset = 0; offset < NUM_ORDERS_PER_SEGMENT; ++offset) {
        uint256 remainingSegment = uint256(lastSegment >> (offset * 64));
        if (remainingSegment == 0) {
          // Found free entry one, so add to an existing segment
          bytes32 newSegment = lastSegment |
            (bytes32(orderId) << (offset * 64)) |
            (bytes32(quantity) << (offset * 64 + 40));
          segments[segments.length - 1] = newSegment;
          pushToEnd = false;
          break;
        }
      }
    }

    if (pushToEnd) {
      bytes32 segment = bytes32(orderId) | (bytes32(quantity) << 40);
      segments.push(segment);
    }

    return price;
  }

  function _addToBook(
    uint40 newOrderId,
    uint128 tick,
    OrderSide side,
    uint256 tokenId,
    uint72 price,
    uint24 quantity
  ) private {
    _tokenClaimables[newOrderId] = ClaimableTokenInfo({
      maker: _msgSender(),
      tokenId: uint16(OrderSide.Buy == side ? tokenId : 0),
      amount: 0
    });

    // Price can update if the price level is at capacity
    if (side == OrderSide.Buy) {
      price = _addToBookSide(_bidsAtPrice[tokenId], _bids[tokenId], price, newOrderId, quantity, -int128(tick));
    } else {
      price = _addToBookSide(_asksAtPrice[tokenId], _asks[tokenId], price, newOrderId, quantity, int128(tick));
    }
    emit AddedToBook(_msgSender(), side, newOrderId, tokenId, price, quantity);
  }

  function _calcFee(uint256 cost) private view returns (uint256 fees) {
    (uint256 royalty, uint256 dev, uint256 burn) = _calcFees(cost);
    fees = royalty + dev + burn;
  }

  function _calcFees(uint256 cost) private view returns (uint256 royalty, uint256 dev, uint256 burn) {
    royalty = (cost * _royaltyFee) / 10000;
    dev = (cost * _devFee) / 10000;
    burn = (cost * _burntFee) / 10000;
  }

  function _sendFees(uint256 royalty, uint256 dev, uint256 burn) private {
    if (royalty != 0) {
      _coin.safeTransfer(_royaltyRecipient, royalty);
    }

    if (dev != 0) {
      _coin.safeTransfer(_devAddr, dev);
    }

    if (burn != 0) {
      _coin.burn(burn);
    }
  }

  function _find(
    bytes32[] storage segments,
    uint256 begin,
    uint256 end,
    uint256 value
  ) private view returns (uint256 mid, uint256 offset) {
    while (begin < end) {
      mid = begin + (end - begin) / 2;
      uint256 segment = uint256(segments[mid]);
      offset = 0;

      for (uint256 i = 0; i < NUM_ORDERS_PER_SEGMENT; ++i) {
        uint40 id = uint40(segment >> (offset * 8));
        if (id == value) {
          return (mid, i); // Return the index where the ID is found
        } else if (id < value) {
          offset = offset + 8; // Move to the next segment
        } else {
          break; // Break if the searched value is smaller, as it's a binary search
        }
      }

      if (offset == NUM_ORDERS_PER_SEGMENT * 8) {
        begin = mid + 1;
      } else {
        end = mid;
      }
    }

    return (type(uint).max, type(uint).max); // ID not found in any segment of the segment data
  }

  function _cancelOrder(
    bytes32[] storage segments,
    uint72 price,
    uint256 index,
    uint256 offset,
    uint256 tombstoneOffset,
    BokkyPooBahsRedBlackTreeLibrary.Tree storage tree
  ) private {
    bytes32 segment = segments[index];
    uint40 orderId = uint40(uint256(segment) >> (offset * 64));

    require(_tokenClaimables[orderId].maker == _msgSender(), NotMaker());

    bool isFinalSegment = index == segments.length - 1;
    bool isOnlyOrderInSegment = (segment & ~(bytes32(uint(0xffffffffffffffff)) << (offset * 64))) == 0;
    if (isFinalSegment && isOnlyOrderInSegment) {
      // If there is only one order in this final segment then remove the segment
      segments.pop();
      // There are no other segments so remove the price level
      if (segments.length == tombstoneOffset) {
        tree.remove(price);
      }
    } else {
      uint256 flattenedIndexToRemove = index * NUM_ORDERS_PER_SEGMENT + offset;

      // Although this is called next, it also acts as the "last" used later
      uint256 nextSegmentIndex = flattenedIndexToRemove / NUM_ORDERS_PER_SEGMENT;
      uint256 nextOffsetIndex = flattenedIndexToRemove % NUM_ORDERS_PER_SEGMENT;
      // Shift orders cross-segments.
      // This does all except the last order
      // TODO: For offset 0, 1, 2 we can shift the whole elements of the segment in 1 go.
      uint256 totalOrders = segments.length * NUM_ORDERS_PER_SEGMENT - 1;
      for (uint256 i = flattenedIndexToRemove; i < totalOrders; ++i) {
        nextSegmentIndex = (i + 1) / NUM_ORDERS_PER_SEGMENT;
        nextOffsetIndex = (i + 1) % NUM_ORDERS_PER_SEGMENT;

        bytes32 currentOrNextSegment = segments[nextSegmentIndex];

        uint256 currentSegmentIndex = i / NUM_ORDERS_PER_SEGMENT;
        uint256 currentOffsetIndex = i % NUM_ORDERS_PER_SEGMENT;

        bytes32 currentSegment = segments[currentSegmentIndex];
        uint256 nextOrder = uint64(uint256(currentOrNextSegment >> (nextOffsetIndex * 64)));
        if (nextOrder == 0) {
          // There are no more orders left, reset back to the currently iterated order as the last
          nextSegmentIndex = currentSegmentIndex;
          nextOffsetIndex = currentOffsetIndex;
          break;
        }

        // Clear the current order and set it with the shifted order
        currentSegment &= _clearOrderMask(currentOffsetIndex);
        currentSegment |= bytes32(nextOrder) << (currentOffsetIndex * 64);
        segments[currentSegmentIndex] = currentSegment;
      }
      // Only pop if the next offset is 0 which means there is only 1 order left in that segment (at the start)
      if (nextOffsetIndex == 0) {
        segments.pop();
      } else {
        // Clear the last element
        bytes32 lastElement = segments[nextSegmentIndex];
        lastElement &= _clearOrderMask(nextOffsetIndex);
        segments[nextSegmentIndex] = lastElement;
      }
    }
  }

  function _clearOrderMask(uint256 offsetIndex) private pure returns (bytes32) {
    return ~(bytes32(uint256(0xffffffffffffffff)) << (offsetIndex * 64));
  }

  function _safeBatchTransferNFTsToUs(address from, uint256[] memory tokenIds, uint256[] memory amounts) private {
    _nft.safeBatchTransferFrom(from, address(this), tokenIds, amounts, "");
  }

  function _safeBatchTransferNFTsFromUs(address to, uint256[] memory tokenIds, uint256[] memory amounts) private {
    _nft.safeBatchTransferFrom(address(this), to, tokenIds, amounts, "");
  }

  function _safeTransferNFTsToUs(address from, uint256 tokenId, uint256 amount) private {
    _nft.safeTransferFrom(from, address(this), tokenId, amount, "");
  }

  function _safeTransferNFTsFromUs(address to, uint256 tokenId, uint256 amount) private {
    _nft.safeTransferFrom(address(this), to, tokenId, amount, "");
  }

  /// @notice Set the maximum amount of orders allowed at a specific price level
  /// @param maxOrdersPerPrice The new maximum amount of orders allowed at a specific price level
  function setMaxOrdersPerPrice(uint16 maxOrdersPerPrice) public payable onlyOwner {
    require(maxOrdersPerPrice % NUM_ORDERS_PER_SEGMENT == 0, MaxOrdersNotMultipleOfOrdersInSegment());
    _maxOrdersPerPrice = maxOrdersPerPrice;
    emit SetMaxOrdersPerPriceLevel(maxOrdersPerPrice);
  }

  /// @notice Set constraints like minimum quantity of an order that is allowed to be
  ///         placed and the minimum of specific tokenIds in this nft collection.
  /// @param tokenIds Array of token IDs for which to set TokenInfo
  /// @param tokenIdInfos Array of TokenInfo to be set
  function setTokenIdInfos(
    uint256[] calldata tokenIds,
    TokenIdInfo[] calldata tokenIdInfos
  ) external payable onlyOwner {
    require(tokenIds.length == tokenIdInfos.length, LengthMismatch());

    for (uint256 i = 0; i < tokenIds.length; ++i) {
      // Cannot change tick once set
      uint256 existingTick = _tokenIdInfos[tokenIds[i]].tick;
      uint256 newTick = tokenIdInfos[i].tick;

      require(!(existingTick != 0 && newTick != 0 && existingTick != newTick), TickCannotBeChanged());
      _tokenIdInfos[tokenIds[i]] = tokenIdInfos[i];
    }

    emit SetTokenIdInfos(tokenIds, tokenIdInfos);
  }

  /// @notice Set the fees for the contract
  /// @param devAddr The address to receive trade fees
  /// @param devFee The fee to send to the dev address (max 10%)
  /// @param burntFee The fee to burn (max 2%)
  function setFees(address devAddr, uint16 devFee, uint8 burntFee) public onlyOwner {
    if (devFee != 0) {
      require(devAddr != address(0), ZeroAddress());
      require(devFee <= 1000, DevFeeTooHigh());
    } else {
      require(devAddr == address(0), DevFeeNotSet());
    }
    _devFee = devFee; // 30 = 0.3% fee
    _devAddr = devAddr;
    _burntFee = burntFee;
    emit SetFees(devAddr, devFee, burntFee);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
