// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {EquipPosition, ItemInput} from "../contracts/globals/players.sol";
import {IOrderBook} from "../contracts/Bazaar/interfaces/IOrderBook.sol";

contract EstforTestStacksTest is EstforTest {
    function testShopStackDeploysAFunctionalItemNFTAndShop() public {
        _deployShopStack(address(this));

        assertEq(shop.owner(), address(this));
        assertEq(itemNFT.owner(), address(this));
        assertTrue(adminAccess.isAdmin(address(this)));
        assertTrue(adminAccess.isPromotionalAdmin(ALICE));

        ItemInput[] memory items = new ItemInput[](1);
        items[0].tokenId = 1;
        items[0].equipPosition = EquipPosition.LEFT_HAND;
        items[0].isAvailable = true;
        itemNFT.addItems(items);
        assertTrue(itemNFT.getItem(1).packedData != bytes1(0));
        assertEq(uint8(itemNFT.getItem(1).equipPosition), uint8(EquipPosition.LEFT_HAND));
    }

    function testOrderBookStackSupportsLimitOrders() public {
        _deployOrderBookStack();

        IOrderBook.TokenIdInfo memory info = orderBook.getTokenIdInfo(ORDERBOOK_TOKEN_ID);
        assertEq(info.tick, ORDERBOOK_TICK);
        assertEq(info.minQuantity, ORDERBOOK_MIN_QUANTITY);

        IOrderBook.LimitOrder[] memory orders = new IOrderBook.LimitOrder[](1);
        orders[0] = IOrderBook.LimitOrder({
            side: IOrderBook.OrderSide.Buy,
            tokenId: ORDERBOOK_TOKEN_ID,
            price: 2 ether,
            quantity: 10
        });
        orderBook.limitOrders(orders);
        assertEq(orderBook.getHighestBid(ORDERBOOK_TOKEN_ID), 2 ether);
    }

    function testSessionStackWiresRegistryAndModule() public {
        _deploySessionStack();

        assertEq(usageBasedSessionModule.owner(), address(this));
        assertEq(gameSubsidisationRegistry.owner(), address(this));

        gameSubsidisationRegistry.setGroupLimit(1, 5);
        assertEq(gameSubsidisationRegistry.groupDailyLimits(1), 5);
    }
}
