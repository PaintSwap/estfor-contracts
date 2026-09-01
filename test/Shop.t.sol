// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IOwnable} from "../contracts/interfaces/IOwnable.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {EstforTest} from "./utils/EstforTest.sol";
import {Shop as ShopContract} from "../contracts/Shop.sol";
import {ShopV1 as Shop} from "../contracts/old/ShopV1.sol";
import {ActivityPoints} from "../contracts/ActivityPoints/ActivityPoints.sol";
import {MockBankFactory} from "../contracts/test/MockBankFactory.sol";
import {MockUSDCToken} from "../contracts/test/external/MockUSDCToken.sol";
import {EquipPosition, ItemInput} from "../contracts/globals/players.sol";
import {BRONZE_SWORD, COMBAT_BASE, MISC_BASE, SCROLL_BASE} from "../contracts/globals/items.sol";

contract ShopTest is EstforTest {
  uint16 private constant SHIELD_BASE = COMBAT_BASE + 150;
  uint16 private constant BRONZE_SHIELD = SHIELD_BASE;
  uint16 private constant RAW_MINNUS = 10_752;
  uint16 private constant SAPPHIRE_AMULET = 257;
  uint16 private constant TITANIUM_ARMOR = 518;
  uint16 private constant ORICHALCUM_ARMOR = 519;
  uint16 private constant BARRAGE_SCROLL = SCROLL_BASE + 5;
  uint16 private constant ACTIVITY_TICKET = MISC_BASE - 70;
  uint16 private constant SONIC_GEM_TICKET = MISC_BASE - 69;

  MockUSDCToken private usdc;
  ActivityPoints private activityPoints;

  function setUp() public {
    _deployShopStack(address(new MockBankFactory()));

    ItemInput[] memory items = new ItemInput[](4);
    items[0] = _item(BRONZE_SHIELD, EquipPosition.LEFT_HAND);
    items[1] = _item(BRONZE_SWORD, EquipPosition.RIGHT_HAND);
    items[2] = _item(RAW_MINNUS, EquipPosition.FOOD);
    items[3] = _item(SAPPHIRE_AMULET, EquipPosition.NECK);
    itemNFT.addItems(items);

    activityPoints = ActivityPoints(
      _deployUUPS(
        address(new ActivityPoints()),
        abi.encodeCall(ActivityPoints.initialize, (address(itemNFT), ACTIVITY_TICKET, SONIC_GEM_TICKET))
      )
    );
    activityPoints.addCallers(_addresses(address(shop)));
    shop.setActivityPoints(address(activityPoints));
    shop.setItemNFT(itemNFT);
    itemNFT.setApproved(_addresses(address(shop), address(activityPoints)), true);

    treasury.setSpenders(_addresses(address(shop)), true);
    treasury.setFundAllocationPercentages(_addresses(address(shop)), _uints(100));
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.SetBrushDistributionPercentages(25, 50, 25);
    shop.setBrushDistributionPercentages(25, 50, 25);

    usdc = new MockUSDCToken();
    usdc.mint(BOB, 10_000_000);
    shop.setSupporterPackToken(address(usdc));
    brush.mint(DEV, 1000 ether);
    vm.prank(DEV);
    brush.approve(address(shop), type(uint256).max);
  }

  function _item(uint16 tokenId, EquipPosition position) private pure returns (ItemInput memory input) {
    input.tokenId = tokenId;
    input.equipPosition = position;
    input.isAvailable = true;
    input.isTransferable = true;
  }

  function _shopItem(uint16 tokenId, uint128 price) private pure returns (Shop.ShopItem memory) {
    return Shop.ShopItem({tokenId: tokenId, price: price});
  }

  function _addBuyable(uint16 tokenId, uint128 price) private {
    Shop.ShopItem[] memory items = new Shop.ShopItem[](1);
    items[0] = _shopItem(tokenId, price);
    shop.addBuyableItems(items);
  }

  function _mintSellItems(uint256 shields, uint256 amulets) private {
    itemNFT.mint(ALICE, BRONZE_SHIELD, shields);
    if (amulets != 0) itemNFT.mint(ALICE, SAPPHIRE_AMULET, amulets);
  }

  function _pack(uint16 remaining, uint32 startTimestamp) private pure returns (Shop.SupporterPack memory pack) {
    pack.price = 3;
    pack.itemTokenIds = _uint16s(BRONZE_SHIELD, BRONZE_SWORD);
    pack.itemQuantities = _uint16s(1, 2);
    pack.amountRemaining = remaining;
    pack.startTimestamp = startTimestamp;
    pack.brushToGive = 2 ether;
  }

  function _setPack(Shop.SupporterPack memory pack) private {
    uint24[] memory ids = new uint24[](1);
    ids[0] = 1;
    Shop.SupporterPack[] memory packs = new Shop.SupporterPack[](1);
    packs[0] = pack;
    shop.setSupporterPacks(ids, packs);
  }

  function _warpToPromotion() private {
    uint256 week = block.timestamp / 1 weeks;
    uint256 targetWeek = week + ((2 + 3 - (week % 3)) % 3);
    uint256 target = targetWeek * 1 weeks;
    if (target <= block.timestamp || (target / 1 days) % 7 >= 4) target += 3 weeks;
    vm.warp(target);
    assertTrue(shop.isPromotionRunning());
  }

  function testSetUpShop() public {
    _addBuyable(BRONZE_SHIELD, 500);
    assertEq(shop.shopItems(BRONZE_SHIELD), 500);
    Shop.ShopItem[] memory items = new Shop.ShopItem[](1);
    items[0] = _shopItem(BRONZE_SHIELD, 400);
    vm.expectRevert(Shop.ShopItemAlreadyExists.selector);
    shop.addBuyableItems(items);
    shop.editItems(items);
    assertEq(shop.shopItems(BRONZE_SHIELD), 400);
    items = new Shop.ShopItem[](3);
    items[0] = _shopItem(BRONZE_SHIELD, 200);
    items[1] = _shopItem(RAW_MINNUS, 400);
    items[2] = _shopItem(BRONZE_SWORD, 10);
    vm.expectRevert(Shop.ShopItemAlreadyExists.selector);
    shop.addBuyableItems(items);
    assertEq(shop.shopItems(9999), 0);
  }

  function testSetUpShopBatch() public {
    Shop.ShopItem[] memory items = new Shop.ShopItem[](2);
    items[0] = _shopItem(BRONZE_SHIELD, 500);
    items[1] = _shopItem(RAW_MINNUS, 300);
    shop.addBuyableItems(items);
    assertEq(shop.shopItems(BRONZE_SHIELD), 500);
    assertEq(shop.shopItems(RAW_MINNUS), 300);
    vm.expectRevert(Shop.ShopItemAlreadyExists.selector);
    shop.addBuyableItems(items);
    Shop.ShopItem[] memory edits = new Shop.ShopItem[](3);
    edits[0] = _shopItem(BRONZE_SHIELD, 200);
    edits[1] = _shopItem(RAW_MINNUS, 400);
    edits[2] = _shopItem(BRONZE_SWORD, 10);
    vm.expectRevert(Shop.ShopItemDoesNotExist.selector);
    shop.editItems(edits);
    _addBuyable(BRONZE_SWORD, 20);
    edits[0].price = 300;
    shop.editItems(edits);
    assertEq(shop.shopItems(BRONZE_SHIELD), 300);
    assertEq(shop.shopItems(RAW_MINNUS), 400);
    assertEq(shop.shopItems(BRONZE_SWORD), 10);
  }

  function testSetUpShopWithItemsWhichDoNotExist() public {
    Shop.ShopItem[] memory items = new Shop.ShopItem[](1);
    items[0] = _shopItem(TITANIUM_ARMOR, 500);
    vm.expectRevert(Shop.ItemDoesNotExist.selector);
    shop.addBuyableItems(items);
    vm.expectRevert(Shop.ItemDoesNotExist.selector);
    shop.addBuyableItems(items);
  }

  function testSetUpShopWithZeroPricesIsNotAllowed() public {
    Shop.ShopItem[] memory items = new Shop.ShopItem[](1);
    items[0] = _shopItem(BRONZE_SHIELD, 0);
    vm.expectRevert(Shop.PriceCannotBeZero.selector);
    shop.addBuyableItems(items);
    vm.expectRevert(Shop.PriceCannotBeZero.selector);
    shop.addBuyableItems(items);
  }

  function testSetUpShopPromotionOver99NotAllowed() public {
    vm.expectRevert(Shop.PromotionDiscountOver99.selector);
    shop.setPromotionDiscountPercentage(100);
    vm.expectRevert(Shop.PromotionDiscountOver99.selector);
    shop.setPromotionDiscountPercentage(150);
  }

  function testBuy() public {
    _addBuyable(BRONZE_SHIELD, 500);
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(shop), 0, 250));
    shop.buy(ALICE, BRONZE_SHIELD, 2);
    brush.mint(ALICE, 1000);
    vm.startPrank(ALICE);
    brush.approve(address(shop), 1000);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.Buy(ALICE, ALICE, BRONZE_SHIELD, 2, 500);
    shop.buy(ALICE, BRONZE_SHIELD, 2);
    vm.stopPrank();
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_SHIELD), 2);
  }

  function testBuyWithPromotion() public {
    _addBuyable(BRONZE_SHIELD, 500);
    shop.setPromotionDiscountPercentage(20);
    _warpToPromotion();
    brush.mint(ALICE, 800);
    vm.startPrank(ALICE);
    brush.approve(address(shop), 800);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.Buy(ALICE, ALICE, BRONZE_SHIELD, 2, 400);
    shop.buy(ALICE, BRONZE_SHIELD, 2);
    vm.stopPrank();
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_SHIELD), 2);
  }

  function testBuyOnDayNotRunningPromotion() public {
    _addBuyable(BRONZE_SHIELD, 500);
    shop.setPromotionDiscountPercentage(20);
    vm.warp(3 weeks);
    assertFalse(shop.isPromotionRunning());
    brush.mint(ALICE, 1000);
    vm.startPrank(ALICE);
    brush.approve(address(shop), 1000);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.Buy(ALICE, ALICE, BRONZE_SHIELD, 2, 500);
    shop.buy(ALICE, BRONZE_SHIELD, 2);
    vm.stopPrank();
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_SHIELD), 2);
  }

  function testBuyBatch() public {
    _testBuyBatch(false);
  }

  function testBuyBatchWithPromotion() public {
    _testBuyBatch(true);
  }

  function _testBuyBatch(bool promotion) private {
    _addBuyable(BRONZE_SHIELD, 500);
    _addBuyable(SAPPHIRE_AMULET, 200);
    uint256 funds = 900;
    uint256[] memory prices = _uints(500, 200);
    if (promotion) {
      shop.setPromotionDiscountPercentage(50);
      _warpToPromotion();
      funds = 450;
      prices = _uints(250, 100);
    }
    brush.mint(ALICE, funds);
    vm.startPrank(ALICE);
    brush.approve(address(shop), funds);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.BuyBatch(ALICE, ALICE, _uints(BRONZE_SHIELD, SAPPHIRE_AMULET), _uints(1, 2), prices);
    shop.buyBatch(ALICE, _uints(BRONZE_SHIELD, SAPPHIRE_AMULET), _uints(1, 2));
    vm.stopPrank();
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_SHIELD), 1);
    assertEq(itemNFT.balanceOf(ALICE, SAPPHIRE_AMULET), 2);
  }

  function testGift() public {
    _addBuyable(BRONZE_SHIELD, 500);
    brush.mint(ALICE, 1000);
    vm.startPrank(ALICE);
    brush.approve(address(shop), 1000);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.Buy(ALICE, BOB, BRONZE_SHIELD, 2, 500);
    shop.buy(BOB, BRONZE_SHIELD, 2);
    vm.stopPrank();
    assertEq(itemNFT.balanceOf(BOB, BRONZE_SHIELD), 2);
  }

  function testGiftBatch() public {
    _addBuyable(BRONZE_SHIELD, 500);
    _addBuyable(SAPPHIRE_AMULET, 200);
    brush.mint(ALICE, 900);
    vm.startPrank(ALICE);
    brush.approve(address(shop), 900);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.BuyBatch(ALICE, BOB, _uints(BRONZE_SHIELD, SAPPHIRE_AMULET), _uints(1, 2), _uints(500, 200));
    shop.buyBatch(BOB, _uints(BRONZE_SHIELD, SAPPHIRE_AMULET), _uints(1, 2));
    vm.stopPrank();
    assertEq(itemNFT.balanceOf(BOB, BRONZE_SHIELD), 1);
    assertEq(itemNFT.balanceOf(BOB, SAPPHIRE_AMULET), 2);
  }

  function testSell() public {
    _mintSellItems(1000, 500);
    assertEq(itemNFT.totalSupply(), 2);
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), 0);
    brush.mint(address(treasury), 10_000);
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), 5);
    uint256[] memory prices = shop.liquidatePrices(_uint16s(BRONZE_SHIELD, SAPPHIRE_AMULET));
    assertEq(prices, _uints(5, 10));
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    vm.prank(ALICE);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.Sell(ALICE, BRONZE_SHIELD, 1, 5);
    shop.sell(BRONZE_SHIELD, 1, 5);
    assertEq(itemNFT.totalSupply(BRONZE_SHIELD), 999);
    assertEq(brush.balanceOf(ALICE), 5);
  }

  function testSellBatch() public {
    _mintSellItems(1000, 500);
    brush.mint(address(treasury), 10_000);
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    vm.prank(ALICE);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.SellBatch(ALICE, _uints(BRONZE_SHIELD, SAPPHIRE_AMULET), _uints(1, 2), _uints(5, 10));
    shop.sellBatch(_uints(BRONZE_SHIELD, SAPPHIRE_AMULET), _uints(1, 2), 25);
    assertEq(itemNFT.totalSupply(BRONZE_SHIELD), 999);
    assertEq(itemNFT.totalSupply(SAPPHIRE_AMULET), 498);
    assertEq(brush.balanceOf(ALICE), 25);
  }

  function testSellSlippage() public {
    _mintSellItems(1000, 500);
    brush.mint(address(treasury), 10_000);
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(Shop.MinExpectedBrushNotReached.selector, 25, 26));
    shop.sellBatch(_uints(BRONZE_SHIELD, SAPPHIRE_AMULET), _uints(1, 2), 26);
    uint256 expectedTotal = 25;
    uint256 minExpected = (expectedTotal * 9900) / 10_000;
    assertEq(minExpected, 24);
    vm.prank(ALICE);
    shop.sellBatch(_uints(BRONZE_SHIELD, SAPPHIRE_AMULET), _uints(1, 2), minExpected);
    assertEq(brush.balanceOf(ALICE), expectedTotal);
  }

  function testCannotSellForMoreThanBuyPrice() public {
    _mintSellItems(1000, 0);
    _addBuyable(BRONZE_SHIELD, 1);
    brush.mint(address(treasury), 1 ether);
    assertGt(shop.liquidatePrice(BRONZE_SHIELD), 1);
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(Shop.LiquidatePriceIsHigherThanShop.selector, BRONZE_SHIELD));
    shop.sell(BRONZE_SHIELD, 1, 0);
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(Shop.LiquidatePriceIsHigherThanShop.selector, BRONZE_SHIELD));
    shop.sellBatch(_uints(BRONZE_SHIELD), _uints(1), 0);
  }

  function testCannotSellWithinCutoff() public {
    _mintSellItems(1000, 0);
    brush.mint(address(treasury), 1 ether);
    vm.prank(ALICE);
    vm.expectRevert(Shop.SellingTooQuicklyAfterItemIntroduction.selector);
    shop.sellBatch(_uints(BRONZE_SHIELD), _uints(1), 0);
  }

  function testExceedSellingAllocation() public {
    itemNFT.mint(ALICE, BRONZE_SHIELD, 1000);
    itemNFT.mint(ALICE, BARRAGE_SCROLL, 1000);
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    brush.mint(address(treasury), 1 ether);
    assertEq(shop.tokenInfos(BRONZE_SHIELD).allocationRemaining, 0);
    vm.prank(ALICE);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.NewAllocation(BRONZE_SHIELD, 0.5 ether);
    shop.sell(BRONZE_SHIELD, 1, 0);
    assertEq(shop.tokenInfos(BRONZE_SHIELD).allocationRemaining, 0.5 ether - 0.5 ether / 1000);
    assertEq(shop.tokenInfos(BARRAGE_SCROLL).allocationRemaining, 0);
    uint256 tokenPrice = shop.liquidatePrice(BRONZE_SHIELD);
    vm.prank(ALICE);
    shop.sell(BRONZE_SHIELD, 997, 0);
    uint256 allocationRemaining = tokenPrice * 2;
    assertEq(shop.tokenInfos(BRONZE_SHIELD).allocationRemaining, allocationRemaining);
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), 0);
    vm.prank(ALICE);
    shop.sell(BRONZE_SHIELD, 1, 0);
    assertEq(shop.tokenInfos(BRONZE_SHIELD).allocationRemaining, allocationRemaining);
    itemNFT.mint(ALICE, BRONZE_SHIELD, 500);
    vm.prank(ALICE);
    vm.expectRevert(
      abi.encodeWithSelector(
        Shop.NotEnoughAllocationRemaining.selector,
        BRONZE_SHIELD,
        tokenPrice * 3,
        allocationRemaining
      )
    );
    shop.sell(BRONZE_SHIELD, 3, 0);
  }

  function testAllocationResetsAfterMidnightUTC() public {
    itemNFT.mint(ALICE, BRONZE_SHIELD, 1000);
    itemNFT.mint(ALICE, BARRAGE_SCROLL, 1000);
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    brush.mint(address(treasury), 1 ether);
    vm.prank(ALICE);
    shop.sell(BRONZE_SHIELD, 1, 0);
    Shop.TokenInfo memory info = shop.tokenInfos(BRONZE_SHIELD);
    assertEq(info.allocationRemaining, 0.5 ether - 0.5 ether / 1000);
    assertEq(info.checkpointTimestamp, (block.timestamp / 1 days) * 1 days);
    uint256 nextCheckpoint = uint256(info.checkpointTimestamp) + 1 days;
    vm.warp(nextCheckpoint);
    vm.prank(ALICE);
    shop.sell(BRONZE_SHIELD, 1, 0);
    info = shop.tokenInfos(BRONZE_SHIELD);
    assertEq(info.checkpointTimestamp, nextCheckpoint);
    assertEq(info.allocationRemaining, 499249749749749750);
  }

  function testPriceConstantThroughDay() public {
    itemNFT.mint(ALICE, BRONZE_SHIELD, 2000);
    itemNFT.mint(ALICE, BARRAGE_SCROLL, 2000);
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    brush.mint(address(treasury), 1 ether);
    vm.prank(ALICE);
    shop.sell(BRONZE_SHIELD, 1, 0);
    uint256 price = 0.5 ether / 2000;
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), price);
    vm.prank(ALICE);
    shop.sell(BRONZE_SHIELD, 500, 0);
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), price);
    vm.warp(block.timestamp + 1 days);
    uint256 newPrice = 291777851901267;
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), newPrice);
    vm.prank(ALICE);
    shop.sell(BRONZE_SHIELD, 300, 0);
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), newPrice);
  }

  function testRemoveShopItem() public {
    _addBuyable(BRONZE_SHIELD, 500);
    shop.removeItems(_uint16s(BRONZE_SHIELD));
    assertEq(shop.shopItems(BRONZE_SHIELD), 0);
    vm.expectRevert(Shop.ShopItemDoesNotExist.selector);
    shop.removeItems(_uint16s(BRONZE_SHIELD));
  }

  function testGetShopItemStates() public {
    _addBuyable(BRONZE_SHIELD, 500);
    shop.addUnsellableItems(_uint16s(BRONZE_SHIELD));

    ShopContract.ShopItemState[] memory states = shop.getShopItemStates(BRONZE_SHIELD, BRONZE_SHIELD + 1);
    assertEq(states.length, 1);
    assertEq(states[0].tokenId, BRONZE_SHIELD);
    assertEq(states[0].price, 500);
    assertTrue(states[0].unsellable);

    assertEq(shop.getShopItemStates(BRONZE_SHIELD + 1, BRONZE_SHIELD + 2).length, 0);
    uint256 maxStateReadLength = shop.MAX_STATE_READ_LENGTH();
    vm.expectRevert(ShopContract.InvalidStateReadRange.selector);
    shop.getShopItemStates(0, maxStateReadLength + 1);
    vm.expectRevert(ShopContract.InvalidStateReadRange.selector);
    shop.getShopItemStates(type(uint16).max, uint256(type(uint16).max) + 2);
  }

  function testUnsellableCannotAddItemWhichDoesNotExist() public {
    vm.expectRevert(Shop.ItemDoesNotExist.selector);
    shop.addUnsellableItems(_uint16s(ORICHALCUM_ARMOR));
    ItemInput[] memory items = new ItemInput[](1);
    items[0] = _item(ORICHALCUM_ARMOR, EquipPosition.BODY);
    itemNFT.addItems(items);
    shop.addUnsellableItems(_uint16s(ORICHALCUM_ARMOR));
  }

  function testUnsellableCannotAddAlreadyUnsellable() public {
    shop.addUnsellableItems(_uint16s(BRONZE_SHIELD));
    vm.expectRevert(Shop.AlreadyUnsellable.selector);
    shop.addUnsellableItems(_uint16s(BRONZE_SHIELD));
  }

  function testUnsellableCannotRemoveAlreadySellable() public {
    vm.expectRevert(Shop.AlreadySellable.selector);
    shop.removeUnsellableItems(_uint16s(BRONZE_SHIELD));
  }

  function testUnsellableCannotBeSold() public {
    _mintSellItems(1000, 500);
    brush.mint(address(treasury), 10_000);
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    shop.addUnsellableItems(_uint16s(BRONZE_SHIELD));
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(Shop.ItemNotSellable.selector, BRONZE_SHIELD));
    shop.sell(BRONZE_SHIELD, 1, 10_000);
  }

  function testUnsellableDoesNotAffectLiquidationPrice() public {
    _mintSellItems(1000, 500);
    brush.mint(address(treasury), 10_000);
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), 5);
    assertEq(shop.liquidatePrices(_uint16s(BRONZE_SHIELD, SAPPHIRE_AMULET)), _uints(5, 10));
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    shop.addUnsellableItems(_uint16s(SAPPHIRE_AMULET));
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), 10);
    assertEq(shop.liquidatePrices(_uint16s(BRONZE_SHIELD, SAPPHIRE_AMULET)), _uints(10, 0));
  }

  function testUnsellableDoesNotAffectTotalAllocation() public {
    _mintSellItems(1000, 1000);
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    brush.mint(address(treasury), 1 ether);
    shop.addUnsellableItems(_uint16s(SAPPHIRE_AMULET));
    vm.prank(ALICE);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.NewAllocation(BRONZE_SHIELD, 1 ether);
    shop.sell(BRONZE_SHIELD, 1, 0);
    assertEq(shop.tokenInfos(BRONZE_SHIELD).allocationRemaining, 1 ether - 1 ether / 1000);
  }

  function testUnsellableGreaterThanTotalSupplyDoesNotRevert() public {
    shop.addUnsellableItems(_uint16s(BRONZE_SWORD, RAW_MINNUS, SAPPHIRE_AMULET));
    itemNFT.mint(ALICE, BRONZE_SHIELD, 500);
    itemNFT.mint(ALICE, BRONZE_SWORD, 500);
    vm.warp(block.timestamp + SELLING_CUTOFF_DURATION);
    brush.mint(address(treasury), 1 ether);
    assertEq(itemNFT.totalSupply(), 2);
    uint256 price = 0.5 ether / 500;
    assertEq(shop.liquidatePrice(BRONZE_SHIELD), price);
    vm.prank(ALICE);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.NewAllocation(BRONZE_SHIELD, 0.5 ether);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.Sell(ALICE, BRONZE_SHIELD, 1, price);
    shop.sell(BRONZE_SHIELD, 1, price);
  }

  function testNonOwnerCannotSetSupporterPackToken() public {
    vm.prank(BOB);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, BOB));
    shop.setSupporterPackToken(address(usdc));
  }

  function testNonOwnerCannotSetSupporterPacks() public {
    uint24[] memory ids = new uint24[](1);
    ids[0] = 1;
    Shop.SupporterPack[] memory packs = new Shop.SupporterPack[](1);
    packs[0] = _pack(10, uint32(block.timestamp));
    vm.prank(BOB);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, BOB));
    shop.setSupporterPacks(ids, packs);
  }

  function testOwnerCannotSetLengthMismatchedSupporterPacks() public {
    uint24[] memory ids = new uint24[](2);
    Shop.SupporterPack[] memory packs = new Shop.SupporterPack[](1);
    packs[0] = _pack(10, uint32(block.timestamp));
    vm.expectRevert(Shop.LengthMismatch.selector);
    shop.setSupporterPacks(ids, packs);
  }

  function testOwnerCanSetSupporterPacks() public {
    uint24[] memory ids = new uint24[](1);
    ids[0] = 1;
    Shop.SupporterPack[] memory packs = new Shop.SupporterPack[](1);
    packs[0] = _pack(10, uint32(block.timestamp));
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.SetSupporterPacks(ids, packs);
    shop.setSupporterPacks(ids, packs);
  }

  function testCanBuySupporterPack() public {
    _setPack(_pack(10, uint32(block.timestamp)));
    vm.startPrank(BOB);
    usdc.approve(address(shop), 10);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.BuySupporterPack(BOB, BOB, 1, 3, 1);
    shop.buySupporterPack(1, BOB, 1);
    vm.stopPrank();
    assertEq(itemNFT.balanceOf(BOB, BRONZE_SHIELD), 1);
    assertEq(itemNFT.balanceOf(BOB, BRONZE_SWORD), 2);
    assertEq(brush.balanceOf(BOB), 2 ether);
    assertEq(usdc.balanceOf(DEV), 3);
  }

  function testCanBuyMultipleSupporterPacks() public {
    _setPack(_pack(10, uint32(block.timestamp)));
    vm.startPrank(BOB);
    usdc.approve(address(shop), 10);
    vm.expectEmit(false, false, false, true, address(shop));
    emit Shop.BuySupporterPack(BOB, BOB, 1, 9, 3);
    shop.buySupporterPack(1, BOB, 3);
    vm.stopPrank();
    assertEq(itemNFT.balanceOf(BOB, BRONZE_SHIELD), 3);
    assertEq(itemNFT.balanceOf(BOB, BRONZE_SWORD), 6);
    assertEq(brush.balanceOf(BOB), 6 ether);
    assertEq(usdc.balanceOf(DEV), 9);
  }

  function testRevertWhenNoPacksRemaining() public {
    _setPack(_pack(1, uint32(block.timestamp)));
    vm.startPrank(BOB);
    usdc.approve(address(shop), 10);
    shop.buySupporterPack(1, BOB, 1);
    vm.expectRevert(abi.encodeWithSelector(Shop.SupporterPackInsufficientRemaining.selector, 1, 0));
    shop.buySupporterPack(1, BOB, 1);
    vm.stopPrank();
  }

  function testRevertWhenNoPackCurrentlyRunning() public {
    uint32 start = uint32(block.timestamp + 1 days);
    _setPack(_pack(1, start));
    vm.startPrank(BOB);
    usdc.approve(address(shop), 10);
    vm.expectRevert(abi.encodeWithSelector(Shop.SupporterPackNotStarted.selector, start, block.timestamp));
    shop.buySupporterPack(1, BOB, 1);
    vm.stopPrank();
  }
}
