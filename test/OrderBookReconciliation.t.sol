// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {EstforTest} from "./utils/EstforTest.sol";
import {IOrderBook} from "../contracts/Bazaar/interfaces/IOrderBook.sol";
import {IOwnable} from "../contracts/interfaces/IOwnable.sol";
import {IUUPSUpgradeable} from "../contracts/interfaces/IUUPSUpgradeable.sol";

contract OrderBookReconciliationTest is EstforTest {
  function setUp() public {
    _deployOrderBookStack();
  }

  function _set(uint256 tokenId, uint128 tick, uint128 minimum) private {
    IOrderBook.TokenIdInfo[] memory infos = new IOrderBook.TokenIdInfo[](1);
    infos[0] = IOrderBook.TokenIdInfo(tick, minimum);
    orderBook.setTokenIdInfos(_uints(tokenId), infos);
  }

  function _place(IOrderBook.OrderSide side, uint24 quantity) private {
    IOrderBook.LimitOrder[] memory orders = new IOrderBook.LimitOrder[](1);
    orders[0] = IOrderBook.LimitOrder(side, ORDERBOOK_TOKEN_ID, 100, quantity);
    orderBook.limitOrders(orders);
  }

  function _cancel(IOrderBook.OrderSide side, uint256 id) private {
    IOrderBook.CancelOrder[] memory orders = new IOrderBook.CancelOrder[](1);
    orders[0] = IOrderBook.CancelOrder(side, ORDERBOOK_TOKEN_ID, 100);
    orderBook.cancelOrders(_uints(id), orders);
  }

  function _legacy() private {
    orderBook = IOrderBook(
      _deployUUPS(
        _deployArtifact("contracts/old/OrderBookV2.sol:OrderBookV2:via-ir"),
        abi.encodeCall(
          IOrderBook.initialize,
          (IERC1155(address(erc1155)), address(brush), DEV, uint16(30), uint8(30), ORDERBOOK_MAX_ORDERS_PER_PRICE)
        )
      )
    );
    brush.approve(address(orderBook), type(uint256).max);
    erc1155.setApprovalForAll(address(orderBook), true);
  }

  function _upgrade() private {
    IUUPSUpgradeable(address(orderBook)).upgradeToAndCall(
      _deployArtifact("contracts/Bazaar/OrderBook.sol:OrderBook:via-ir"),
      ""
    );
  }

  function testDiscoveryIncludesZeroAndFullWidthKeysAndRemovedEntries() public {
    _set(0, 0, 12);
    _set(type(uint256).max, 50, 3);
    _set(type(uint256).max, 50, 4);
    orderBook.registerTokenIds(_uints(type(uint256).max));
    orderBook.removeTokenIdInfos(_uints(type(uint256).max));
    (uint256 count, bool complete) = orderBook.getTokenIdDiscoveryState();
    assertEq(count, 3);
    assertTrue(complete);
    uint256[] memory ids = orderBook.getKnownTokenIds(0, count);
    assertEq(ids[0], ORDERBOOK_TOKEN_ID);
    assertEq(ids[1], 0);
    assertEq(ids[2], type(uint256).max);
    assertEq(orderBook.getKnownTokenIds(1, 2), _uints(0));
    assertEq(orderBook.getKnownTokenIds(count, count).length, 0);
    assertEq(orderBook.getTokenIdInfo(type(uint256).max).tick, 0);
    assertEq(orderBook.getImmutableTick(type(uint256).max), 50);
  }

  function testPaginationBoundsAndLimit() public {
    uint256[] memory ids = new uint256[](1025);
    for (uint256 i; i < ids.length; ++i) ids[i] = 1000 + i;
    orderBook.registerTokenIds(ids);
    assertEq(orderBook.getKnownTokenIds(1, 1025).length, 1024);
    vm.expectRevert(IOrderBook.InvalidTokenIdRange.selector);
    orderBook.getKnownTokenIds(0, 1025);
    vm.expectRevert(IOrderBook.InvalidTokenIdRange.selector);
    orderBook.getKnownTokenIds(0, 1027);
    vm.expectRevert(IOrderBook.InvalidTokenIdRange.selector);
    orderBook.getKnownTokenIds(2, 1);
  }

  function testRemovalAndZeroSetterCannotResetImmutableTick() public {
    orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
    assertEq(orderBook.getTokenIdInfo(ORDERBOOK_TOKEN_ID).minQuantity, 0);
    vm.expectRevert(IOrderBook.TickCannotBeChanged.selector);
    _set(ORDERBOOK_TOKEN_ID, 2, 1);
    _set(ORDERBOOK_TOKEN_ID, 1, 7);
    _set(ORDERBOOK_TOKEN_ID, 0, 9);
    vm.expectRevert(IOrderBook.TickCannotBeChanged.selector);
    _set(ORDERBOOK_TOKEN_ID, 2, 1);
    _set(ORDERBOOK_TOKEN_ID, 1, 1);
    _place(IOrderBook.OrderSide.Buy, 1);
    _cancel(IOrderBook.OrderSide.Buy, 1);
  }

  function testRemovalBlocksBothSidesAndCancellationStillReturnsEscrow() public {
    for (uint256 i; i < 2; ++i) {
      IOrderBook.OrderSide side = IOrderBook.OrderSide(i);
      uint256 coinBefore = brush.balanceOf(address(this));
      uint256 nftBefore = erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID);
      _place(side, 10);
      vm.expectRevert(abi.encodeWithSelector(IOrderBook.TokenHasOpenOrders.selector, ORDERBOOK_TOKEN_ID));
      orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
      vm.expectRevert(abi.encodeWithSelector(IOrderBook.TokenHasOpenOrders.selector, ORDERBOOK_TOKEN_ID));
      _set(ORDERBOOK_TOKEN_ID, 0, 0);
      _set(ORDERBOOK_TOKEN_ID, 1, 2);
      _cancel(side, i + 1);
      assertEq(brush.balanceOf(address(this)), coinBefore);
      assertEq(erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID), nftBefore);
      orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
      _set(ORDERBOOK_TOKEN_ID, 1, 1);
    }
  }

  function testFilledBidNFTClaimSurvivesRemovalAndReaddition() public {
    _place(IOrderBook.OrderSide.Buy, 10);
    vm.prank(ALICE);
    orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, 10, 0));
    uint256 escrow = erc1155.balanceOf(address(orderBook), ORDERBOOK_TOKEN_ID);
    assertEq(escrow, 10);
    orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
    assertEq(erc1155.balanceOf(address(orderBook), ORDERBOOK_TOKEN_ID), escrow);
    _set(ORDERBOOK_TOKEN_ID, 1, 1);
    _place(IOrderBook.OrderSide.Buy, 5);
    orderBook.claimNFTs(_uints(1));
    assertEq(erc1155.balanceOf(address(orderBook), ORDERBOOK_TOKEN_ID), 0);
    _cancel(IOrderBook.OrderSide.Buy, 2);
  }

  function testPartiallyFilledAskMustCancelRemainderButCoinClaimSurvivesRemoval() public {
    _place(IOrderBook.OrderSide.Sell, 10);
    vm.prank(ALICE);
    orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 4, 400));
    vm.expectRevert(abi.encodeWithSelector(IOrderBook.TokenHasOpenOrders.selector, ORDERBOOK_TOKEN_ID));
    orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
    _cancel(IOrderBook.OrderSide.Sell, 1);
    uint256 claim = orderBook.getClaimableTokenInfo(1).amount;
    uint256 escrow = brush.balanceOf(address(orderBook));
    orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
    assertEq(brush.balanceOf(address(orderBook)), escrow);
    uint256 before = brush.balanceOf(address(this));
    orderBook.claimTokens(_uints(1));
    assertEq(brush.balanceOf(address(this)), before + claim);
    assertEq(brush.balanceOf(address(orderBook)), escrow - claim);
  }

  function testLegacyDiscoveryRemainsIncompleteAfterRegistrationAndWrites() public {
    _legacy();
    _set(type(uint256).max, 19, 4);
    _set(0, 0, 23);
    _set(ORDERBOOK_TOKEN_ID, 1, 1);
    _place(IOrderBook.OrderSide.Buy, 10);
    _upgrade();
    (uint256 count, bool complete) = orderBook.getTokenIdDiscoveryState();
    assertEq(count, 0);
    assertFalse(complete);
    assertEq(orderBook.getImmutableTick(type(uint256).max), 19);
    orderBook.registerTokenIds(_uints(type(uint256).max));
    orderBook.registerTokenIds(_uints(0));
    orderBook.registerTokenIds(_uints(0));
    vm.expectRevert(abi.encodeWithSelector(IOrderBook.TokenHasOpenOrders.selector, ORDERBOOK_TOKEN_ID));
    orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
    _cancel(IOrderBook.OrderSide.Buy, 1);
    orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
    orderBook.removeTokenIdInfos(_uints(type(uint256).max));
    vm.expectRevert(IOrderBook.TickCannotBeChanged.selector);
    _set(type(uint256).max, 20, 4);
    (count, complete) = orderBook.getTokenIdDiscoveryState();
    assertEq(count, 3);
    assertFalse(complete);
    assertEq(orderBook.getTokenIdInfo(0).minQuantity, 23);
  }

  function testLegacyZeroTickWithLiveOrdersFailsClosed() public {
    _legacy();
    _set(ORDERBOOK_TOKEN_ID, 1, 1);
    _place(IOrderBook.OrderSide.Buy, 10);
    _set(ORDERBOOK_TOKEN_ID, 0, 0);
    _upgrade();
    vm.expectRevert(abi.encodeWithSelector(IOrderBook.TokenHasOpenOrders.selector, ORDERBOOK_TOKEN_ID));
    _set(ORDERBOOK_TOKEN_ID, 2, 1);
    vm.expectRevert(abi.encodeWithSelector(IOrderBook.TokenHasOpenOrders.selector, ORDERBOOK_TOKEN_ID));
    orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
    assertEq(orderBook.getHighestBid(ORDERBOOK_TOKEN_ID), 100);
    assertEq(brush.balanceOf(address(orderBook)), 1000);
  }

  function testOwnerOnlyAndBatchRollback() public {
    vm.startPrank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    orderBook.registerTokenIds(_uints(123));
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
    vm.stopPrank();
    _set(123, 2, 3);
    _place(IOrderBook.OrderSide.Buy, 10);
    uint256[] memory ids = new uint256[](2);
    ids[0] = 123;
    ids[1] = ORDERBOOK_TOKEN_ID;
    vm.expectRevert(abi.encodeWithSelector(IOrderBook.TokenHasOpenOrders.selector, ORDERBOOK_TOKEN_ID));
    orderBook.removeTokenIdInfos(ids);
    assertEq(orderBook.getTokenIdInfo(123).tick, 2);
  }

  function testConsumedSegmentsAndClaimsRemainValidAcrossRemoval() public {
    for (uint256 i; i < 8; ++i) _place(IOrderBook.OrderSide.Buy, 1);
    vm.prank(ALICE);
    orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, 8, 0));
    orderBook.removeTokenIdInfos(_uints(ORDERBOOK_TOKEN_ID));
    vm.expectRevert(abi.encodeWithSelector(IOrderBook.TokenDoesntExist.selector, ORDERBOOK_TOKEN_ID));
    _place(IOrderBook.OrderSide.Buy, 1);
    orderBook.claimNFTs(_uints(1));
    _set(ORDERBOOK_TOKEN_ID, 1, 1);
    _place(IOrderBook.OrderSide.Buy, 2);
    IOrderBook.Order[] memory orders = orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 100);
    assertEq(orders.length, 1);
    assertEq(orders[0].id, 9);
    assertEq(orders[0].quantity, 2);
    _cancel(IOrderBook.OrderSide.Buy, 9);
    for (uint256 i = 2; i <= 8; ++i) orderBook.claimNFTs(_uints(i));
    assertEq(erc1155.balanceOf(address(orderBook), ORDERBOOK_TOKEN_ID), 0);
    assertEq(brush.balanceOf(address(orderBook)), 0);
  }

  function testFuzzImmutableTickSurvivesRepeatedRemoval(uint256 tokenId, uint128 tick, uint128 minimum) public {
    vm.assume(tokenId != ORDERBOOK_TOKEN_ID && tick != 0);
    _set(tokenId, tick, minimum);
    orderBook.removeTokenIdInfos(_uints(tokenId));
    orderBook.removeTokenIdInfos(_uints(tokenId));
    uint128 otherTick = tick == type(uint128).max ? tick - 1 : tick + 1;
    vm.expectRevert(IOrderBook.TickCannotBeChanged.selector);
    _set(tokenId, otherTick, minimum);
    _set(tokenId, tick, minimum);
    assertEq(orderBook.getTokenIdInfo(tokenId).tick, tick);
    assertEq(orderBook.getTokenIdInfo(tokenId).minQuantity, minimum);
    (uint256 count, bool complete) = orderBook.getTokenIdDiscoveryState();
    assertEq(count, 2);
    assertTrue(complete);
  }
}
