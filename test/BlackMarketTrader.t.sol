// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {stdError} from "forge-std/StdError.sol";

import {FullGameStack} from "./utils/FullGameStack.sol";
import {IOwnable} from "../contracts/interfaces/IOwnable.sol";
import {BlackMarketTrader} from "../contracts/Events/BlackMarketTrader.sol";
import {ItemInput} from "../contracts/globals/players.sol";
import {WOODCUTTING_BASE} from "../contracts/globals/items.sol";

contract BlackMarketTraderTest is FullGameStack {
  uint256 private constant EVENT_ID = 1;
  uint16 private constant BRONZE_AXE = WOODCUTTING_BASE;
  uint16 private constant IRON_AXE = WOODCUTTING_BASE + 1;
  uint16 private constant MITHRIL_AXE = WOODCUTTING_BASE + 2;
  uint16 private constant BAR_BASE = 10_240;
  uint16 private constant BRONZE_BAR = BAR_BASE;
  uint16 private constant IRON_BAR = BAR_BASE + 1;

  function setUp() public {
    deployFullGame();
    vm.deal(address(this), 100 ether);
    vm.deal(ALICE, 100 ether);
  }

  function testAddShopItems() public {
    _addItems(_ids(BRONZE_AXE));
    BlackMarketTrader.ShopItem[] memory items = _shopItems(_item(BRONZE_AXE, 1, 100, 10, true));
    vm.expectEmit(true, false, false, true, address(blackMarketTrader));
    emit BlackMarketTrader.AddShopItems(items, EVENT_ID);
    blackMarketTrader.addShopItems(items, EVENT_ID);
    vm.expectRevert(BlackMarketTrader.ShopItemAlreadyExists.selector);
    blackMarketTrader.addShopItems(items, EVENT_ID);
  }

  function testEditShopItems() public {
    _addItems(_ids(BRONZE_AXE));
    _addShop(BRONZE_AXE, 1, 100, 10, EVENT_ID);
    BlackMarketTrader.ShopItem[] memory edited = _shopItems(_item(BRONZE_AXE, 1, 200, 20, true));
    vm.expectEmit(true, false, false, true, address(blackMarketTrader));
    emit BlackMarketTrader.EditShopItems(edited, EVENT_ID);
    blackMarketTrader.editShopItems(edited, EVENT_ID);
  }

  function testRemoveShopItems() public {
    _addItems(_ids(BRONZE_AXE));
    _addShop(BRONZE_AXE, 1, 100, 10, EVENT_ID);
    uint16[] memory ids = _ids(BRONZE_AXE);
    vm.expectEmit(true, false, false, true, address(blackMarketTrader));
    emit BlackMarketTrader.RemoveShopItems(ids, EVENT_ID);
    blackMarketTrader.removeShopItems(ids, EVENT_ID);
    vm.expectRevert(BlackMarketTrader.ShopItemDoesNotExist.selector);
    blackMarketTrader.removeShopItems(ids, EVENT_ID);
    vm.expectRevert(BlackMarketTrader.ShopItemDoesNotExist.selector);
    blackMarketTrader.editShopItems(_shopItems(_item(BRONZE_AXE, 1, 100, 10, true)), EVENT_ID);
  }

  function testPriceCannotBeZero() public {
    _addItems(_ids(BRONZE_AXE));
    vm.expectRevert(BlackMarketTrader.PriceCannotBeZero.selector);
    blackMarketTrader.addShopItems(_shopItems(_item(BRONZE_AXE, 1, 0, 10, true)), EVENT_ID);
  }

  function testItemDoesNotExist() public {
    vm.expectRevert(BlackMarketTrader.ItemDoesNotExist.selector);
    blackMarketTrader.addShopItems(_shopItems(_item(BRONZE_AXE, 1, 100, 10, true)), EVENT_ID);
  }

  function testOnlyOwnerCanAddEditRemoveItems() public {
    _addItems(_ids(BRONZE_AXE));
    BlackMarketTrader.ShopItem[] memory items = _shopItems(_item(BRONZE_AXE, 1, 100, 10, true));
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    vm.prank(ALICE);
    blackMarketTrader.addShopItems(items, EVENT_ID);
    blackMarketTrader.addShopItems(items, EVENT_ID);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    vm.prank(ALICE);
    blackMarketTrader.editShopItems(items, EVENT_ID);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    vm.prank(ALICE);
    blackMarketTrader.removeShopItems(_ids(BRONZE_AXE), EVENT_ID);
  }

  function testRequestCost() public view {
    assertGt(blackMarketTrader.requestCost(1), 0);
  }

  function testShopTimingsAndBuyFailures() public {
    _standardShop();
    uint256 week0 = (block.timestamp / 1 weeks / 3 + 1) * 3;
    vm.warp(week0 * 1 weeks);
    _expectBuyRevert(BlackMarketTrader.ShopClosed.selector, BRONZE_AXE);
    uint256 week1 = week0 + 1;
    vm.warp(week1 * 1 weeks);
    _expectBuyRevert(BlackMarketTrader.ShopAvailabilityNotDetermined.selector, BRONZE_AXE);
    vm.warp(week1 * 1 weeks + 4 days);
    _expectBuyRevert(BlackMarketTrader.ShopClosed.selector, BRONZE_AXE);
    vm.warp((week1 + 1) * 1 weeks);
    _expectBuyRevert(BlackMarketTrader.ShopClosed.selector, BRONZE_AXE);
  }

  function testInitialiseShopItemsAndVRFFulfillment() public {
    _addItems(_ids(BRONZE_AXE, BRONZE_BAR));
    _addShop(BRONZE_AXE, 1, 100, 10, EVENT_ID);
    _openDay(0);
    uint256 cost = blackMarketTrader.requestCost(1);
    vm.expectRevert(BlackMarketTrader.NoItemsInShop.selector);
    blackMarketTrader.initialiseShopItemsForEvent{value: cost}(2);
    uint256 requestId = _initialise(EVENT_ID, 1);
    mockVRF.fulfillSeeded(requestId, address(blackMarketTrader), 3);
  }

  function testBuyItemsAndStockManagement() public {
    _standardShop();
    itemNFT.mint(ALICE, BRONZE_BAR, 1000);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    _buy(ALICE, BRONZE_AXE, 1);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 2);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 900);
    _expectBuyRevert(BlackMarketTrader.ItemStockInsufficient.selector, BRONZE_AXE, 10);
    _buy(ALICE, BRONZE_AXE, 9);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 11);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 0);
  }

  function testDailyResetsAndMultipleGlobalEventIds() public {
    _addItems(_ids(BRONZE_AXE, IRON_AXE, BRONZE_BAR));
    _addShop(BRONZE_AXE, 1, 100, 10, 1);
    _addShop(IRON_AXE, 1, 200, 5, 2);
    blackMarketTrader.setAcceptedItemId(1, BRONZE_BAR);
    blackMarketTrader.setAcceptedItemId(2, BRONZE_BAR);
    _openDay(0);
    _fulfill(1, 1, 0);
    _fulfill(2, 1, 1);
    vm.warp(block.timestamp + 1 days);
    _expectBuyRevert(BlackMarketTrader.ShopAvailabilityNotDetermined.selector, BRONZE_AXE, 1, 1);
    _expectBuyRevert(BlackMarketTrader.ShopAvailabilityNotDetermined.selector, IRON_AXE, 1, 2);
  }

  function testItemsChangeEachDayAndApproximatelyOneThirdAreActive() public {
    uint16[] memory ids = _sequentialIds(1000, 60);
    _addItems(_append(ids, BRONZE_BAR));
    blackMarketTrader.addShopItems(_manyShopItems(ids), EVENT_ID);
    blackMarketTrader.setAcceptedItemId(EVENT_ID, BRONZE_BAR);
    _openDay(0);
    _fulfill(EVENT_ID, 4, 123);
    bool[] memory day1 = _active(ids);
    uint256 count1 = _count(day1);
    assertGe(count1, 10);
    assertLe(count1, 30);
    vm.warp(block.timestamp + 1 days);
    _fulfill(EVENT_ID, 4, 456);
    bool[] memory day2 = _active(ids);
    uint256 count2 = _count(day2);
    assertGe(count2, 10);
    assertLe(count2, 30);
    assertNotEq(keccak256(abi.encode(day1)), keccak256(abi.encode(day2)));
  }

  function testStockIsResetEachDay() public {
    _standardShopWith(1, 10, 10);
    itemNFT.mint(ALICE, BRONZE_BAR, 1000);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    _buy(ALICE, BRONZE_AXE, 1);
    _buy(ALICE, BRONZE_AXE, 5);
    vm.warp(block.timestamp + 1 days);
    _fulfill(EVENT_ID, 1, 1);
    _buy(ALICE, BRONZE_AXE, 1);
    _buy(ALICE, BRONZE_AXE, 9);
  }

  function testSetAcceptedItemIdValidationsAndEvents() public {
    _addItems(_ids(BRONZE_BAR));
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    vm.prank(ALICE);
    blackMarketTrader.setAcceptedItemId(EVENT_ID, BRONZE_BAR);
    vm.expectRevert(BlackMarketTrader.ItemDoesNotExist.selector);
    blackMarketTrader.setAcceptedItemId(EVENT_ID, IRON_BAR);
    vm.expectEmit(true, false, false, true, address(blackMarketTrader));
    emit BlackMarketTrader.AcceptedItemIdSet(EVENT_ID, BRONZE_BAR);
    blackMarketTrader.setAcceptedItemId(EVENT_ID, BRONZE_BAR);
  }

  function testAlreadyInitialisedTodayAfterFulfillment() public {
    _addItems(_ids(BRONZE_AXE));
    _addShop(BRONZE_AXE, 1, 100, 10, EVENT_ID);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    uint256 cost = blackMarketTrader.requestCost(1);
    vm.expectRevert(BlackMarketTrader.AlreadyInitialisedToday.selector);
    blackMarketTrader.initialiseShopItemsForEvent{value: cost}(EVENT_ID);
  }

  function testAlreadyInitialisedTodayBeforeFulfillment() public {
    _addItems(_ids(BRONZE_AXE));
    _addShop(BRONZE_AXE, 1, 100, 10, EVENT_ID);
    _openDay(0);
    _initialise(EVENT_ID, 1);
    uint256 cost = blackMarketTrader.requestCost(1);
    vm.expectRevert(BlackMarketTrader.AlreadyInitialisedToday.selector);
    blackMarketTrader.initialiseShopItemsForEvent{value: cost}(EVENT_ID);
  }

  function testAmountPerPurchaseMultipliesItemsReceived() public {
    _standardShopWith(5, 10, 100);
    itemNFT.mint(ALICE, BRONZE_BAR, 1000);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    uint256 beforeItems = itemNFT.balanceOf(ALICE, BRONZE_AXE);
    _buy(ALICE, BRONZE_AXE, 3);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), beforeItems + 15);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 970);
  }

  function testAmountPerPurchaseEqualsStockAndBuyEntireStock() public {
    _standardShopWith(10, 5, 10);
    itemNFT.mint(ALICE, BRONZE_BAR, 1000);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    uint256 beforeItems = itemNFT.balanceOf(ALICE, BRONZE_AXE);
    _buy(ALICE, BRONZE_AXE, 10);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), beforeItems + 100);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 950);
    _expectBuyRevert(BlackMarketTrader.ItemStockInsufficient.selector, BRONZE_AXE);
  }

  function testInfiniteStockAllowsUnlimitedBuying() public {
    _standardShopWith(1, 10, 0);
    itemNFT.mint(ALICE, BRONZE_BAR, 100000);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    _buy(ALICE, BRONZE_AXE, 100);
    _buy(ALICE, BRONZE_AXE, 500);
    _buy(ALICE, BRONZE_AXE, 1000);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 1601);
  }

  function testBuyEventIsEmittedWithCorrectParameters() public {
    _standardShopWith(1, 50, 100);
    itemNFT.mint(ALICE, BRONZE_BAR, 10000);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    vm.expectEmit(true, true, true, true, address(blackMarketTrader));
    emit BlackMarketTrader.Buy(ALICE, BOB, EVENT_ID, BRONZE_AXE, 5, 50, 1);
    vm.prank(ALICE);
    blackMarketTrader.buy(BOB, EVENT_ID, BRONZE_AXE, 5);
  }

  function testBuyToDifferentAddress() public {
    _standardShopWith(1, 10, 100);
    itemNFT.mint(ALICE, BRONZE_BAR, 1000);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    vm.prank(ALICE);
    blackMarketTrader.buy(BOB, EVENT_ID, BRONZE_AXE, 5);
    assertEq(itemNFT.balanceOf(BOB, BRONZE_AXE), 5);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_BAR), 950);
  }

  function testAcceptedItemNotSet() public {
    _addItems(_ids(BRONZE_AXE));
    _addShop(BRONZE_AXE, 1, 10, 10, EVENT_ID);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    _expectBuyRevert(BlackMarketTrader.AcceptedItemNotSet.selector, BRONZE_AXE);
  }

  function testInsufficientPaymentTokensReverts() public {
    _standardShop();
    itemNFT.mint(ALICE, BRONZE_BAR, 50);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    vm.expectRevert(stdError.arithmeticError);
    vm.prank(ALICE);
    blackMarketTrader.buy(ALICE, EVENT_ID, BRONZE_AXE, 1);
  }

  function testEditShopItemsWithZeroPriceReverts() public {
    _addItems(_ids(BRONZE_AXE));
    _addShop(BRONZE_AXE, 1, 100, 10, EVENT_ID);
    vm.expectRevert(BlackMarketTrader.PriceCannotBeZero.selector);
    blackMarketTrader.editShopItems(_shopItems(_item(BRONZE_AXE, 1, 0, 20, true)), EVENT_ID);
  }

  function testAddEditRemoveMultipleItemsInBatch() public {
    uint16[] memory ids = _ids(BRONZE_AXE, IRON_AXE, MITHRIL_AXE);
    _addItems(ids);
    BlackMarketTrader.ShopItem[] memory items = new BlackMarketTrader.ShopItem[](3);
    for (uint256 i; i < 3; ++i) {
      items[i] = _item(ids[i], 1, uint128((i + 1) * 100), uint16((i + 1) * 10), true);
    }
    vm.expectEmit(true, false, false, true, address(blackMarketTrader));
    emit BlackMarketTrader.AddShopItems(items, EVENT_ID);
    blackMarketTrader.addShopItems(items, EVENT_ID);
    BlackMarketTrader.ShopItem[] memory edited = new BlackMarketTrader.ShopItem[](2);
    edited[0] = _item(BRONZE_AXE, 1, 150, 15, true);
    edited[1] = _item(IRON_AXE, 1, 250, 25, true);
    vm.expectEmit(true, false, false, true, address(blackMarketTrader));
    emit BlackMarketTrader.EditShopItems(edited, EVENT_ID);
    blackMarketTrader.editShopItems(edited, EVENT_ID);
    uint16[] memory removed = _ids(BRONZE_AXE, IRON_AXE);
    vm.expectEmit(true, false, false, true, address(blackMarketTrader));
    emit BlackMarketTrader.RemoveShopItems(removed, EVENT_ID);
    blackMarketTrader.removeShopItems(removed, EVENT_ID);
  }

  function testShopActiveItemsUpdatedEvent() public {
    uint16[] memory ids = _ids(BRONZE_AXE, IRON_AXE, MITHRIL_AXE);
    _addItems(ids);
    blackMarketTrader.addShopItems(_manyShopItems(ids), EVENT_ID);
    _openDay(0);
    uint256 requestId = _initialise(EVENT_ID, 1);
    vm.expectEmit(true, false, false, false, address(blackMarketTrader));
    emit BlackMarketTrader.ShopActiveItemsUpdated(new uint16[](0), EVENT_ID);
    mockVRF.fulfillSeeded(requestId, address(blackMarketTrader), 0);
  }

  function testBuyInactiveItemReverts() public {
    _addItems(_ids(BRONZE_AXE, IRON_AXE, BRONZE_BAR));
    _addShop(BRONZE_AXE, 1, 10, 10, EVENT_ID);
    _addShop(IRON_AXE, 1, 10, 10, EVENT_ID);
    blackMarketTrader.setAcceptedItemId(EVENT_ID, BRONZE_BAR);
    itemNFT.mint(ALICE, BRONZE_BAR, 1000);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 1);
    _expectBuyRevert(BlackMarketTrader.ItemCannotBeBought.selector, IRON_AXE);
  }

  function testBuyNonExistentShopItemReverts() public {
    _addItems(_ids(BRONZE_AXE, IRON_AXE, BRONZE_BAR));
    _addShop(BRONZE_AXE, 1, 10, 10, EVENT_ID);
    blackMarketTrader.setAcceptedItemId(EVENT_ID, BRONZE_BAR);
    _openDay(0);
    _fulfill(EVENT_ID, 1, 0);
    _expectBuyRevert(BlackMarketTrader.ItemCannotBeBought.selector, IRON_AXE);
  }

  function testRequestCostVariesWithNumberOfActions() public view {
    uint256 one = blackMarketTrader.requestCost(1);
    uint256 two = blackMarketTrader.requestCost(2);
    assertGt(two, one);
    assertGt(blackMarketTrader.requestCost(10), two);
  }

  function testInitialiseCanBeCalledByAnyone() public {
    _addItems(_ids(BRONZE_AXE));
    _addShop(BRONZE_AXE, 1, 100, 10, EVENT_ID);
    _openDay(0);
    vm.expectEmit(false, false, false, false, address(blackMarketTrader));
    emit BlackMarketTrader.RequestSent(0, 0, 0);
    vm.prank(ALICE);
    blackMarketTrader.initialiseShopItemsForEvent{value: blackMarketTrader.requestCost(1)}(EVENT_ID);
  }

  function testShopBoundaryTimesExactlyAtTransitions() public {
    _standardShop();
    itemNFT.mint(ALICE, BRONZE_BAR, 10000);
    _openDay(3);
    _fulfill(EVENT_ID, 1, 0);
    _buy(ALICE, BRONZE_AXE, 1);
    vm.warp((block.timestamp / 1 weeks) * 1 weeks + 4 days);
    _expectBuyRevert(BlackMarketTrader.ShopClosed.selector, BRONZE_AXE);
  }

  function testWeekZeroToWeekOneTransition() public {
    _standardShop();
    itemNFT.mint(ALICE, BRONZE_BAR, 10000);
    uint256 week0 = (block.timestamp / 1 weeks / 3 + 1) * 3;
    vm.warp(week0 * 1 weeks);
    _expectBuyRevert(BlackMarketTrader.ShopClosed.selector, BRONZE_AXE);
    vm.warp((week0 + 1) * 1 weeks);
    _fulfill(EVENT_ID, 1, 0);
    _buy(ALICE, BRONZE_AXE, 1);
    vm.warp((week0 + 2) * 1 weeks);
    _expectBuyRevert(BlackMarketTrader.ShopClosed.selector, BRONZE_AXE);
  }

  function testMultipleRandomWordsNeededForManyItems() public {
    _assertRequestWords(2000, 33, 3, true);
  }

  function testExactly16ItemsNeedsOneRandomWord() public {
    _assertRequestWords(3000, 16, 1, false);
  }

  function test17ItemsNeedsTwoRandomWords() public {
    _assertRequestWords(4000, 17, 2, false);
  }

  function _standardShop() private {
    _standardShopWith(1, 100, 10);
  }

  function _standardShopWith(uint16 amount, uint128 price, uint16 stock) private {
    _addItems(_ids(BRONZE_AXE, BRONZE_BAR));
    _addShop(BRONZE_AXE, amount, price, stock, EVENT_ID);
    blackMarketTrader.setAcceptedItemId(EVENT_ID, BRONZE_BAR);
  }

  function _addShop(uint16 id, uint16 amount, uint128 price, uint16 stock, uint256 eventId) private {
    blackMarketTrader.addShopItems(_shopItems(_item(id, amount, price, stock, true)), eventId);
  }

  function _item(
    uint16 id,
    uint16 amount,
    uint128 price,
    uint16 stock,
    bool active
  ) private pure returns (BlackMarketTrader.ShopItem memory) {
    return BlackMarketTrader.ShopItem(price, id, amount, stock, stock, active);
  }

  function _shopItems(
    BlackMarketTrader.ShopItem memory item
  ) private pure returns (BlackMarketTrader.ShopItem[] memory items) {
    items = new BlackMarketTrader.ShopItem[](1);
    items[0] = item;
  }

  function _manyShopItems(uint16[] memory ids) private pure returns (BlackMarketTrader.ShopItem[] memory items) {
    items = new BlackMarketTrader.ShopItem[](ids.length);
    for (uint256 i; i < ids.length; ++i) {
      items[i] = _item(ids[i], 1, 10, 10, false);
    }
  }

  function _addItems(uint16[] memory ids) private {
    ItemInput[] memory items = new ItemInput[](ids.length);
    for (uint256 i; i < ids.length; ++i) {
      items[i].tokenId = ids[i];
      items[i].isAvailable = true;
    }
    itemNFT.addItems(items);
  }

  function _openDay(uint256 day) private {
    uint256 week1 = (block.timestamp / 1 weeks / 3 + 1) * 3 + 1;
    vm.warp(week1 * 1 weeks + day * 1 days);
  }

  function _initialise(uint256 eventId, uint256 words) private returns (uint256 requestId) {
    vm.recordLogs();
    blackMarketTrader.initialiseShopItemsForEvent{value: blackMarketTrader.requestCost(words)}(eventId);
    Vm.Log[] memory logs = vm.getRecordedLogs();
    bytes32 topic = keccak256("RequestSent(uint256,uint256,uint256)");
    for (uint256 i; i < logs.length; ++i) {
      if (logs[i].emitter == address(blackMarketTrader) && logs[i].topics[0] == topic) {
        (requestId, , ) = abi.decode(logs[i].data, (uint256, uint256, uint256));
      }
    }
    assertGt(requestId, 0);
  }

  function _fulfill(uint256 eventId, uint256 words, uint256 seed) private {
    mockVRF.fulfillSeeded(_initialise(eventId, words), address(blackMarketTrader), seed);
  }

  function _buy(address buyer, uint16 id, uint16 quantity) private {
    vm.prank(buyer);
    blackMarketTrader.buy(buyer, EVENT_ID, id, quantity);
  }

  function _expectBuyRevert(bytes4 error, uint16 id) private {
    _expectBuyRevert(error, id, 1, EVENT_ID);
  }

  function _expectBuyRevert(bytes4 error, uint16 id, uint16 quantity) private {
    _expectBuyRevert(error, id, quantity, EVENT_ID);
  }

  function _expectBuyRevert(bytes4 error, uint16 id, uint16 quantity, uint256 eventId) private {
    vm.expectRevert(error);
    vm.prank(ALICE);
    blackMarketTrader.buy(ALICE, eventId, id, quantity);
  }

  function _active(uint16[] memory ids) private returns (bool[] memory active) {
    active = new bool[](ids.length);
    for (uint256 i; i < ids.length; ++i) {
      vm.prank(ALICE);
      try blackMarketTrader.buy(ALICE, EVENT_ID, ids[i], 1) {
        active[i] = true;
      } catch (bytes memory reason) {
        active[i] = _selector(reason) != BlackMarketTrader.ItemCannotBeBought.selector;
      }
    }
  }

  function _selector(bytes memory reason) private pure returns (bytes4 result) {
    if (reason.length >= 4) {
      assembly ("memory-safe") {
        result := mload(add(reason, 32))
      }
    }
  }

  function _count(bool[] memory values) private pure returns (uint256 count) {
    for (uint256 i; i < values.length; ++i) {
      if (values[i]) ++count;
    }
  }

  function _sequentialIds(uint16 first, uint256 length) private pure returns (uint16[] memory ids) {
    ids = new uint16[](length);
    for (uint256 i; i < length; ++i) {
      ids[i] = first + uint16(i);
    }
  }

  function _append(uint16[] memory values, uint16 value) private pure returns (uint16[] memory result) {
    result = new uint16[](values.length + 1);
    for (uint256 i; i < values.length; ++i) {
      result[i] = values[i];
    }
    result[values.length] = value;
  }

  function _assertRequestWords(uint16 first, uint256 length, uint256 words, bool fulfill) private {
    uint16[] memory ids = _sequentialIds(first, length);
    _addItems(ids);
    blackMarketTrader.addShopItems(_manyShopItems(ids), EVENT_ID);
    _openDay(0);
    vm.expectEmit(false, false, false, true, address(blackMarketTrader));
    emit BlackMarketTrader.RequestSent(1, EVENT_ID, words);
    uint256 requestId = _initialise(EVENT_ID, words);
    if (fulfill) mockVRF.fulfillSeeded(requestId, address(blackMarketTrader), 999);
  }

  function _ids(uint16 a) private pure returns (uint16[] memory ids) {
    ids = new uint16[](1);
    ids[0] = a;
  }

  function _ids(uint16 a, uint16 b) private pure returns (uint16[] memory ids) {
    ids = new uint16[](2);
    ids[0] = a;
    ids[1] = b;
  }

  function _ids(uint16 a, uint16 b, uint16 c) private pure returns (uint16[] memory ids) {
    ids = new uint16[](3);
    ids[0] = a;
    ids[1] = b;
    ids[2] = c;
  }
}
