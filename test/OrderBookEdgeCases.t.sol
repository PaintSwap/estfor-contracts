// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {IOrderBook} from "../contracts/Bazaar/interfaces/IOrderBook.sol";
import {IReentrancyGuard} from "../contracts/interfaces/IReentrancyGuard.sol";
import {BokkyPooBahsRedBlackTreeLibrary} from "../contracts/Bazaar/BokkyPooBahsRedBlackTreeLibrary.sol";
import {TestMaliciousReentrancy} from "../contracts/test/TestMaliciousReentrancy.sol";

// Edge-case and regression coverage migrated from test/OrderBook.ts.
contract OrderBookEdgeCasesTest is EstforTest {
  uint256 private constant PRICE = 100;
  uint24 private constant QUANTITY = 10;

  function setUp() public {
    _deployOrderBookStack();
  }

  function _order(
    IOrderBook.OrderSide side,
    uint256 price,
    uint24 quantity
  ) private pure returns (IOrderBook.LimitOrder[] memory orders) {
    orders = new IOrderBook.LimitOrder[](1);
    orders[0] = IOrderBook.LimitOrder(side, ORDERBOOK_TOKEN_ID, price, quantity);
  }

  function _orders(
    IOrderBook.OrderSide side,
    uint256 price,
    uint24 quantity,
    uint256 length
  ) private pure returns (IOrderBook.LimitOrder[] memory orders) {
    orders = new IOrderBook.LimitOrder[](length);
    for (uint256 i; i < length; ++i) {
      orders[i] = IOrderBook.LimitOrder(side, ORDERBOOK_TOKEN_ID, price, quantity);
    }
  }

  function _cancel(
    IOrderBook.OrderSide side,
    uint256 price
  ) private pure returns (IOrderBook.CancelOrder[] memory orders) {
    orders = new IOrderBook.CancelOrder[](1);
    orders[0] = IOrderBook.CancelOrder(side, ORDERBOOK_TOKEN_ID, price);
  }

  function _cancels(
    IOrderBook.OrderSide side,
    uint256 price,
    uint256 length
  ) private pure returns (IOrderBook.CancelOrder[] memory orders) {
    orders = new IOrderBook.CancelOrder[](length);
    for (uint256 i; i < length; ++i) {
      orders[i] = IOrderBook.CancelOrder(side, ORDERBOOK_TOKEN_ID, price);
    }
  }

  function _range(uint256 first, uint256 length) private pure returns (uint256[] memory values) {
    values = new uint256[](length);
    for (uint256 i; i < length; ++i) {
      values[i] = first + i;
    }
  }

  function _tokenInfo(uint128 tick, uint128 minQuantity) private pure returns (IOrderBook.TokenIdInfo[] memory infos) {
    infos = new IOrderBook.TokenIdInfo[](1);
    infos[0] = IOrderBook.TokenIdInfo(tick, minQuantity);
  }

  function testMarketAndLimitOrdersRevertAfterMaximumMatches() public {
    erc1155.mintSpecificId(address(this), ORDERBOOK_TOKEN_ID, 1000);
    for (uint256 offset; offset < 6; ++offset) {
      orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE + offset, 1, ORDERBOOK_MAX_ORDERS_PER_PRICE));
    }

    vm.expectRevert(IOrderBook.TooManyOrdersHit.selector);
    orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, 500, PRICE * 500));

    vm.expectRevert(IOrderBook.TooManyOrdersHit.selector);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 500));
  }

  function testCancellationDeletesSegmentsAtBeginningMiddleAndEnd() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, QUANTITY, 16));
    orderBook.cancelOrders(_range(9, 4), _cancels(IOrderBook.OrderSide.Buy, PRICE, 4));
    orderBook.cancelOrders(_range(1, 4), _cancels(IOrderBook.OrderSide.Buy, PRICE, 4));
    orderBook.cancelOrders(_range(13, 4), _cancels(IOrderBook.OrderSide.Buy, PRICE, 4));

    IOrderBook.Order[] memory remaining = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Buy,
      ORDERBOOK_TOKEN_ID,
      PRICE
    );
    assertEq(remaining.length, 4);
    for (uint256 i; i < remaining.length; ++i) {
      assertEq(remaining[i].id, i + 5);
    }
  }

  function testCancellationWithinTombstonedSegmentPreservesOffsets() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, QUANTITY, 8));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, QUANTITY * 4));
    orderBook.cancelOrders(_uints(6), _cancel(IOrderBook.OrderSide.Buy, PRICE));
    orderBook.cancelOrders(_uints(5), _cancel(IOrderBook.OrderSide.Buy, PRICE));
    orderBook.cancelOrders(_uints(8), _cancel(IOrderBook.OrderSide.Buy, PRICE));

    assertEq(orderBook.getNode(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE).tombstoneOffset, 1);
    IOrderBook.Order[] memory remaining = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Buy,
      ORDERBOOK_TOKEN_ID,
      PRICE
    );
    assertEq(remaining.length, 1);
    assertEq(remaining[0].id, 7);

    orderBook.cancelOrders(_uints(7), _cancel(IOrderBook.OrderSide.Buy, PRICE));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE));
  }

  function testCancellationAtEndOfTombstonedSegment() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, QUANTITY, 8));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, QUANTITY * 4));
    orderBook.cancelOrders(_uints(8), _cancel(IOrderBook.OrderSide.Buy, PRICE));

    assertEq(orderBook.getNode(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE).tombstoneOffset, 1);
    IOrderBook.Order[] memory remaining = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Buy,
      ORDERBOOK_TOKEN_ID,
      PRICE
    );
    assertEq(remaining.length, 3);
    assertEq(remaining[0].id, 5);
    assertEq(remaining[2].id, 7);
  }

  function testCancellationAfterLeadingConsumptionMaintainsPriceLevel() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, QUANTITY, 5));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, QUANTITY * 3));

    vm.expectRevert(abi.encodeWithSelector(IOrderBook.OrderNotFound.selector, 1, PRICE));
    orderBook.cancelOrders(_uints(1), _cancel(IOrderBook.OrderSide.Buy, PRICE));

    orderBook.cancelOrders(_uints(4), _cancel(IOrderBook.OrderSide.Buy, PRICE));
    assertTrue(orderBook.nodeExists(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE));
    orderBook.cancelOrders(_uints(5), _cancel(IOrderBook.OrderSide.Buy, PRICE));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE));
  }

  function testCancellingRemovedOrderRevertsWhilePriceLevelExists() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, QUANTITY, 2));
    orderBook.cancelOrders(_uints(2), _cancel(IOrderBook.OrderSide.Buy, PRICE));

    vm.expectRevert(abi.encodeWithSelector(IOrderBook.OrderNotFound.selector, 2, PRICE));
    orderBook.cancelOrders(_uints(2), _cancel(IOrderBook.OrderSide.Buy, PRICE));
    IOrderBook.Order[] memory remaining = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Buy,
      ORDERBOOK_TOKEN_ID,
      PRICE
    );
    assertEq(remaining.length, 1);
    assertEq(remaining[0].id, 1);
    assertEq(remaining[0].quantity, QUANTITY);
  }

  function testCancellationRefundDoesNotOverflowPackedOrderWidths() public {
    uint256 price = 1700 ether;
    uint24 quantity = 10;
    uint256 extra = price * quantity;
    brush.mint(address(this), extra);
    brush.approve(address(orderBook), type(uint256).max);
    uint256 before = brush.balanceOf(address(this));

    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, price, quantity));
    orderBook.cancelOrders(_uints(1), _cancel(IOrderBook.OrderSide.Buy, price));

    assertEq(brush.balanceOf(address(this)), before);
    assertEq(brush.balanceOf(address(orderBook)), 0);
  }

  function testPartialConsumptionTracksOrdersOnBothSides() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE, QUANTITY, 3));
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 14));

    IOrderBook.Order[] memory asks = orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE);
    assertEq(asks.length, 2);
    assertEq(asks[0].id, 2);
    assertEq(asks[0].quantity, 6);
    assertEq(asks[1].id, 3);
    assertEq(asks[1].quantity, QUANTITY);
    assertEq(orderBook.getNode(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE).tombstoneOffset, 0);
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 17));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE));
    IOrderBook.Order[] memory remainingBid = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Buy,
      ORDERBOOK_TOKEN_ID,
      PRICE
    );
    assertEq(remainingBid.length, 1);
    assertEq(remainingBid[0].quantity, 1);
    vm.prank(ALICE);
    orderBook.cancelOrders(_uints(4), _cancel(IOrderBook.OrderSide.Buy, PRICE));

    uint256 buyPrice = PRICE - 1;
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, buyPrice, QUANTITY, 3));
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, buyPrice, 14));

    IOrderBook.Order[] memory bids = orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, buyPrice);
    assertEq(bids.length, 2);
    assertEq(bids[0].quantity, 6);
    assertEq(bids[1].quantity, QUANTITY);
    assertEq(orderBook.getNode(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, buyPrice).tombstoneOffset, 0);
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, buyPrice, 17));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, buyPrice));
    IOrderBook.Order[] memory remainingAsk = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Sell,
      ORDERBOOK_TOKEN_ID,
      buyPrice
    );
    assertEq(remainingAsk.length, 1);
    assertEq(remainingAsk[0].quantity, 1);
  }

  function testFullAndPartialSegmentConsumptionUpdatesTombstonesAndBalances() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE, QUANTITY, 5));
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 44));

    IOrderBook.Order[] memory remaining = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Sell,
      ORDERBOOK_TOKEN_ID,
      PRICE
    );
    assertEq(remaining.length, 1);
    assertEq(remaining[0].id, 5);
    assertEq(remaining[0].quantity, 6);
    assertEq(orderBook.getNode(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE).tombstoneOffset, 1);
    assertEq(erc1155.balanceOf(address(orderBook), ORDERBOOK_TOKEN_ID), 6);
    assertEq(erc1155.balanceOf(ALICE, ORDERBOOK_TOKEN_ID), ORDERBOOK_INITIAL_QUANTITY + 44);
  }

  function testFullSegmentConsumptionRemovesPriceAndClaimsAllProceeds() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE, QUANTITY, 4));
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 40));

    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE));
    uint256 before = brush.balanceOf(address(this));
    orderBook.claimTokens(_range(1, 4));
    uint256 cost = PRICE * 40;
    uint256 fees = ((cost * 3) / 1000) * 2;
    assertEq(brush.balanceOf(address(this)), before + cost - fees);
  }

  function testPriceCapacityHandlesBoundsCompressionAndSpareSegments() public {
    uint256 maxPrice = type(uint72).max;
    erc1155.mintSpecificId(address(this), ORDERBOOK_TOKEN_ID, 1000);
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, maxPrice, 1, ORDERBOOK_MAX_ORDERS_PER_PRICE));
    vm.expectRevert(
      abi.encodeWithSignature("SafeCastOverflowedUintDowncast(uint8,uint256)", uint8(72), uint256(type(uint72).max) + 1)
    );
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, maxPrice, 1));

    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, 1, 1, ORDERBOOK_MAX_ORDERS_PER_PRICE));
    vm.expectRevert(BokkyPooBahsRedBlackTreeLibrary.KeyCannotBeZero.selector);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, 1, 1));

    uint256 tokenId = ORDERBOOK_TOKEN_ID + 1;
    uint128 tick = 1 ether;
    uint256 compressedPrice = 4_722_333 ether;
    orderBook.setTokenIdInfos(_uints(tokenId), _tokenInfo(tick, 1));
    erc1155.mintSpecificId(address(this), tokenId, 101);
    IOrderBook.LimitOrder[] memory compressed = new IOrderBook.LimitOrder[](ORDERBOOK_MAX_ORDERS_PER_PRICE);
    for (uint256 i; i < compressed.length; ++i) {
      compressed[i] = IOrderBook.LimitOrder(IOrderBook.OrderSide.Sell, tokenId, compressedPrice, 1);
    }
    orderBook.limitOrders(compressed);
    IOrderBook.LimitOrder[] memory one = new IOrderBook.LimitOrder[](1);
    one[0] = IOrderBook.LimitOrder(IOrderBook.OrderSide.Sell, tokenId, compressedPrice, 1);
    orderBook.limitOrders(one);
    assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, tokenId, compressedPrice).length, 100);
    IOrderBook.Order[] memory compressedSpill = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Sell,
      tokenId,
      compressedPrice + tick
    );
    assertEq(compressedSpill.length, 1);
    assertEq(compressedSpill[0].maker, address(this));
    assertEq(compressedSpill[0].quantity, 1);
  }

  function testPriceCapacitySearchesTicksAndUsesAvailableLastSegment() public {
    erc1155.mintSpecificId(address(this), ORDERBOOK_TOKEN_ID, 1000);
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE, 1, ORDERBOOK_MAX_ORDERS_PER_PRICE));
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE + 1, 1, ORDERBOOK_MAX_ORDERS_PER_PRICE));

    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 1));
    IOrderBook.Order[] memory spilled = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Sell,
      ORDERBOOK_TOKEN_ID,
      PRICE + 2
    );
    assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE).length, 100);
    assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 1).length, 100);
    assertEq(spilled.length, 1);
    assertEq(spilled[0].maker, address(this));
    assertEq(spilled[0].quantity, 1);

    orderBook.cancelOrders(_uints(198), _cancel(IOrderBook.OrderSide.Sell, PRICE + 1));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 1));
    assertEq(
      orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 1).length,
      ORDERBOOK_MAX_ORDERS_PER_PRICE
    );
  }

  function testBuyCapacityUsesExistingPriceLevelWithSpareSegment() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, 1, ORDERBOOK_MAX_ORDERS_PER_PRICE));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE - 1, 1));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 1));
    assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE).length, 100);
    assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE - 1).length, 2);
  }

  function testChangingMinimumQuantityPreservesExistingOrders() public {
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 1));
    orderBook.setTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID), _tokenInfo(ORDERBOOK_TICK, 2));

    vm.expectEmit(true, true, false, true);
    emit IOrderBook.FailedToAddToBook(address(this), IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE, 1);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 1));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 2));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 1));

    IOrderBook.Order[] memory remaining = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Buy,
      ORDERBOOK_TOKEN_ID,
      PRICE
    );
    assertEq(remaining.length, 1);
    assertEq(remaining[0].quantity, 2);
  }

  function testStressCancellationAndMatchingAcrossFiveHundredOrders() public {
    for (uint256 offset; offset < 5; ++offset) {
      vm.prank(ALICE);
      orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE + offset, 1, ORDERBOOK_MAX_ORDERS_PER_PRICE));
    }
    vm.prank(ALICE);
    orderBook.cancelOrders(_uints(1), _cancel(IOrderBook.OrderSide.Buy, PRICE));
    erc1155.mintSpecificId(address(this), ORDERBOOK_TOKEN_ID, 500);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 500));
    for (uint256 offset; offset < 5; ++offset) {
      assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE + offset));
    }
    IOrderBook.Order[] memory remainder = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Sell,
      ORDERBOOK_TOKEN_ID,
      PRICE
    );
    assertEq(remainder.length, 1);
    assertEq(remainder[0].maker, address(this));
    assertEq(remainder[0].quantity, 1);
  }

  function testClaimFunctionsEnforceTheirOwnMaximum() public {
    uint256[] memory tooMany = new uint256[](201);
    vm.expectRevert(IOrderBook.ClaimingTooManyOrders.selector);
    orderBook.claimTokens(tooMany);
    vm.expectRevert(IOrderBook.ClaimingTooManyOrders.selector);
    orderBook.claimNFTs(tooMany);

    uint256[] memory tokenIds = new uint256[](100);
    uint256[] memory nftIds = new uint256[](101);
    vm.expectRevert(IOrderBook.ClaimingTooManyOrders.selector);
    orderBook.claimAll(tokenIds, nftIds);
  }

  function testClaimTokensProcessesMaximumRealClaims() public {
    orderBook.setFees(address(0), 0, 0);
    erc1155.mintSpecificId(address(this), ORDERBOOK_TOKEN_ID, 100);
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE, 1, 100));
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE + 1, 1, 100));
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE + 1, 200));

    uint256 before = brush.balanceOf(address(this));
    orderBook.claimTokens(_range(1, 200));
    assertEq(brush.balanceOf(address(this)), before + PRICE * 100 + (PRICE + 1) * 100);
    vm.expectRevert(IOrderBook.NothingToClaim.selector);
    orderBook.claimTokens(_range(1, 200));
  }

  function testClaimNFTsProcessesMaximumRealClaims() public {
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, 1, 100));
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE - 1, 1, 100));
    erc1155.mintSpecificId(ALICE, ORDERBOOK_TOKEN_ID, 100);
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE - 1, 200));

    uint256 before = erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID);
    orderBook.claimNFTs(_range(1, 200));
    assertEq(erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID), before + 200);
    vm.expectRevert(IOrderBook.NothingToClaim.selector);
    orderBook.claimNFTs(_range(1, 200));
  }

  function testClaimAllProcessesMaximumSplitAcrossRealTokenAndNFTClaims() public {
    orderBook.setFees(address(0), 0, 0);
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE - 1, 1, 100));
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE - 1, 100));
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE + 1, 1, 100));
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE + 1, 100));

    uint256 brushBefore = brush.balanceOf(address(this));
    uint256 nftBefore = erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID);
    orderBook.claimAll(_range(101, 100), _range(1, 100));
    assertEq(brush.balanceOf(address(this)), brushBefore + (PRICE + 1) * 100);
    assertEq(erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID), nftBefore + 100);
  }

  function testClaimTokensAggregatesMultipleOrders() public {
    orderBook.setFees(address(0), 0, 0);
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE, QUANTITY, 6));
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 41));

    uint40[] memory firstFive = new uint40[](5);
    for (uint40 i; i < 5; ++i) {
      firstFive[i] = i + 1;
    }
    assertEq(orderBook.tokensClaimable(firstFive), PRICE * 41);
    uint256 before = brush.balanceOf(address(this));
    orderBook.claimTokens(_range(1, 5));
    assertEq(brush.balanceOf(address(this)), before + PRICE * 41);
    assertEq(orderBook.tokensClaimable(firstFive), 0);
  }

  function testClaimAllSupportsEachSideIndependently() public {
    orderBook.setFees(address(0), 0, 0);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 100));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 101));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 20));

    orderBook.claimAll(_uints(1), new uint256[](0));
    orderBook.claimAll(new uint256[](0), _uints(2));
    assertEq(erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID), ORDERBOOK_INITIAL_QUANTITY - 19);
    assertEq(brush.balanceOf(address(this)), ORDERBOOK_INITIAL_COINS);
  }

  function testManyOrdersAcrossLevelsPreserveTreesAndReusedTombstones() public {
    erc1155.mintSpecificId(address(this), ORDERBOOK_TOKEN_ID, 200);
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE + 2, QUANTITY, 5));
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE + 4, QUANTITY, 8));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE + 5, QUANTITY));
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE + 8, QUANTITY, 9));
    orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, QUANTITY, 5));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE - 1, QUANTITY));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE - 2, QUANTITY));

    orderBook.cancelOrders(_uints(16), _cancel(IOrderBook.OrderSide.Sell, PRICE + 8));
    assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 8).length, 8);

    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE + 3, 51));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 2));
    IOrderBook.Order[] memory highBid = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Buy,
      ORDERBOOK_TOKEN_ID,
      PRICE + 3
    );
    assertEq(highBid.length, 1);
    assertEq(highBid[0].quantity, 1);

    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 46));
    assertEq(orderBook.getNode(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE).tombstoneOffset, 1);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE + 3, 4));
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE - 1, 12));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE + 3));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE));

    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, QUANTITY));
    IOrderBook.Order[] memory reusedBid = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Buy,
      ORDERBOOK_TOKEN_ID,
      PRICE
    );
    assertEq(orderBook.getNode(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE).tombstoneOffset, 1);
    assertEq(reusedBid.length, 1);
    assertEq(reusedBid[0].quantity, QUANTITY);

    orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE + 8, 95));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 4));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 5));
    IOrderBook.Order[] memory remainingHighAsks = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Sell,
      ORDERBOOK_TOKEN_ID,
      PRICE + 8
    );
    assertEq(remainingHighAsks.length, 8);
    assertEq(remainingHighAsks[0].id, 15);
    assertEq(remainingHighAsks[0].quantity, 5);
    for (uint256 i = 1; i < remainingHighAsks.length; ++i) {
      assertEq(remainingHighAsks[i].quantity, QUANTITY);
    }

    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE + 4, QUANTITY));
    assertEq(orderBook.getNode(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 4).tombstoneOffset, 2);
    IOrderBook.Order[] memory reusedAsk = orderBook.allOrdersAtPrice(
      IOrderBook.OrderSide.Sell,
      ORDERBOOK_TOKEN_ID,
      PRICE + 4
    );
    assertEq(reusedAsk.length, 1);
    uint256 reusedOrderId = reusedAsk[0].id;
    orderBook.cancelOrders(_uints(reusedOrderId), _cancel(IOrderBook.OrderSide.Sell, PRICE + 4));
    assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 4));

    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE + 4, QUANTITY + 1));
    assertEq(orderBook.getNode(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 4).tombstoneOffset, 2);
    reusedAsk = orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 4);
    assertEq(reusedAsk.length, 1);
    assertEq(reusedAsk[0].quantity, QUANTITY + 1);
  }

  function testERC1155CallbacksCannotReenterEveryTransferringEntryPoint() public {
    TestMaliciousReentrancy attacker = new TestMaliciousReentrancy(address(orderBook));
    IOrderBook attackerBook = IOrderBook(address(attacker));
    brush.mint(address(attacker), 1 ether);
    vm.prank(address(attacker));
    brush.approve(address(orderBook), type(uint256).max);
    erc1155.safeTransferFrom(address(this), address(attacker), ORDERBOOK_TOKEN_ID, 20, "");
    vm.prank(address(attacker));
    erc1155.setApprovalForAll(address(orderBook), true);

    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 10));
    vm.expectRevert(IReentrancyGuard.ReentrancyGuardReentrantCall.selector);
    attackerBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 1));
    vm.expectRevert(IReentrancyGuard.ReentrancyGuardReentrantCall.selector);
    attackerBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 1, PRICE));

    attackerBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE + 1, 1));
    vm.expectRevert(IReentrancyGuard.ReentrancyGuardReentrantCall.selector);
    attackerBook.cancelOrders(_uints(2), _cancel(IOrderBook.OrderSide.Sell, PRICE + 1));
    vm.expectRevert(IReentrancyGuard.ReentrancyGuardReentrantCall.selector);
    attackerBook.cancelAndMakeLimitOrders(
      _uints(2),
      _cancel(IOrderBook.OrderSide.Sell, PRICE + 1),
      _order(IOrderBook.OrderSide.Sell, PRICE + 2, 1)
    );

    attackerBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE - 1, 2));
    vm.prank(ALICE);
    orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE - 1, 1));
    vm.expectRevert(IReentrancyGuard.ReentrancyGuardReentrantCall.selector);
    attackerBook.claimNFTs(_uints(3));
    vm.expectRevert(IReentrancyGuard.ReentrancyGuardReentrantCall.selector);
    attackerBook.claimAll(new uint256[](0), _uints(3));
  }
}
