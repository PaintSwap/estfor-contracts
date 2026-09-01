// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {
    ReentrancyGuardTransientUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardTransientUpgradeable.sol";

import {EstforTest} from "./utils/EstforTest.sol";
import {OrderBook} from "./interfaces/OrderBook.sol";
import {IOrderBook} from "../contracts/Bazaar/interfaces/IOrderBook.sol";
import {TestERC721} from "../contracts/test/TestERC721.sol";
import {TestERC1155NoRoyalty} from "../contracts/test/TestERC1155NoRoyalty.sol";
import {TestERC20Reentrancy} from "../contracts/test/TestERC20Reentrancy.sol";
import {TestMaliciousReentrancy} from "../contracts/test/TestMaliciousReentrancy.sol";

// Migrated from test/OrderBook.ts.
contract OrderBookTest is EstforTest {
    uint256 private constant PRICE = 100;
    uint24 private constant QUANTITY = 10;

    function setUp() public {
        _deployOrderBookStack();
    }

    function _order(IOrderBook.OrderSide side, uint256 price, uint24 quantity)
        private
        pure
        returns (IOrderBook.LimitOrder[] memory orders)
    {
        orders = new IOrderBook.LimitOrder[](1);
        orders[0] = IOrderBook.LimitOrder({side: side, tokenId: ORDERBOOK_TOKEN_ID, price: price, quantity: quantity});
    }

    function _orders(IOrderBook.OrderSide side, uint256 price, uint24 quantity, uint256 length)
        private
        pure
        returns (IOrderBook.LimitOrder[] memory orders)
    {
        orders = new IOrderBook.LimitOrder[](length);
        for (uint256 i; i < length; ++i) {
            orders[i] =
                IOrderBook.LimitOrder({side: side, tokenId: ORDERBOOK_TOKEN_ID, price: price, quantity: quantity});
        }
    }

    function _cancel(IOrderBook.OrderSide side, uint256 price)
        private
        pure
        returns (IOrderBook.CancelOrder[] memory orders)
    {
        orders = new IOrderBook.CancelOrder[](1);
        orders[0] = IOrderBook.CancelOrder({side: side, tokenId: ORDERBOOK_TOKEN_ID, price: price});
    }

    function _ids40(uint40 a) private pure returns (uint40[] memory values) {
        values = new uint40[](1);
        values[0] = a;
    }

    function _tokenInfo(uint128 tick, uint128 minQuantity)
        private
        pure
        returns (IOrderBook.TokenIdInfo[] memory infos)
    {
        infos = new IOrderBook.TokenIdInfo[](1);
        infos[0] = IOrderBook.TokenIdInfo({tick: tick, minQuantity: minQuantity});
    }

    function _deploy(uint16 devFee, uint8 burntFee, address dev) private returns (OrderBook deployed) {
        OrderBook implementation = _deployOrderBookImplementation();
        deployed = OrderBook(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        OrderBook.initialize,
                        (address(erc1155), address(brush), dev, devFee, burntFee, ORDERBOOK_MAX_ORDERS_PER_PRICE)
                    )
                )
            )
        );
    }

    function testInitializationConstraintsAndViews() public {
        vm.expectRevert(IOrderBook.DevFeeNotSet.selector);
        _deploy(0, 30, DEV);
        vm.expectRevert(IOrderBook.ZeroAddress.selector);
        _deploy(30, 30, address(0));
        vm.expectRevert(IOrderBook.DevFeeTooHigh.selector);
        _deploy(10_000, 30, DEV);
        _deploy(0, 30, address(0));

        TestERC721 erc721 = new TestERC721();
        OrderBook implementation = _deployOrderBookImplementation();
        vm.expectRevert(IOrderBook.NotERC1155.selector);
        new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                OrderBook.initialize,
                (address(erc721), address(brush), DEV, uint16(30), uint8(30), ORDERBOOK_MAX_ORDERS_PER_PRICE)
            )
        );

        IOrderBook.TokenIdInfo memory info = orderBook.getTokenIdInfo(ORDERBOOK_TOKEN_ID);
        assertEq(info.tick, ORDERBOOK_TICK);
        assertEq(info.minQuantity, ORDERBOOK_MIN_QUANTITY);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, QUANTITY));
        IOrderBook.ClaimableTokenInfo memory claimable = orderBook.getClaimableTokenInfo(1);
        assertEq(claimable.maker, address(this));
        assertEq(claimable.amount, 0);
    }

    function testAddsBuyAndSellAndReturnsPriceLevels() public {
        IOrderBook.LimitOrder[] memory orders = new IOrderBook.LimitOrder[](2);
        orders[0] = _order(IOrderBook.OrderSide.Buy, PRICE, QUANTITY)[0];
        orders[1] = _order(IOrderBook.OrderSide.Sell, PRICE + 1, QUANTITY)[0];
        vm.expectEmit(true, true, true, true);
        emit IOrderBook.AddedToBook(address(this), IOrderBook.OrderSide.Buy, 1, ORDERBOOK_TOKEN_ID, PRICE, QUANTITY);
        orderBook.limitOrders(orders);
        assertEq(orderBook.getHighestBid(ORDERBOOK_TOKEN_ID), PRICE);
        assertEq(orderBook.getLowestAsk(ORDERBOOK_TOKEN_ID), PRICE + 1);
        IOrderBook.Order[] memory asks =
            orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 1);
        assertEq(asks.length, 1);
        assertEq(asks[0].maker, address(this));
        assertEq(asks[0].quantity, QUANTITY);
        assertEq(asks[0].id, 2);
    }

    function testMarketBuyCostMatchingBalancesAndExhaustion() public {
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 100));
        vm.startPrank(ALICE);
        vm.expectRevert(IOrderBook.TotalCostConditionNotMet.selector);
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 10, PRICE * 10 - 1));
        vm.expectEmit(true, false, false, true);
        emit IOrderBook.OrdersMatched(ALICE, _uints(1), _uints(10));
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 10, PRICE * 10));
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 90, PRICE * 100));
        assertEq(erc1155.balanceOf(ALICE, ORDERBOOK_TOKEN_ID), ORDERBOOK_INITIAL_QUANTITY + 100);
        vm.expectRevert(
            abi.encodeWithSelector(
                IOrderBook.FailedToTakeFromBook.selector, ALICE, IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 1
            )
        );
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 1, PRICE));
        vm.stopPrank();
    }

    function testMarketSellCostMatchingBalancesAndExactSegmentOrder() public {
        orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, QUANTITY, 2));
        vm.startPrank(ALICE);
        vm.expectRevert(IOrderBook.TotalCostConditionNotMet.selector);
        orderBook.marketOrder(
            IOrderBook.MarketOrder(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, QUANTITY, PRICE * QUANTITY + 1)
        );
        vm.expectEmit(true, false, false, true);
        emit IOrderBook.OrdersMatched(ALICE, _uints(1), _uints(QUANTITY));
        orderBook.marketOrder(
            IOrderBook.MarketOrder(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, QUANTITY, PRICE * QUANTITY)
        );
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, QUANTITY, 0));
        assertEq(erc1155.balanceOf(ALICE, ORDERBOOK_TOKEN_ID), ORDERBOOK_INITIAL_QUANTITY - 20);
        vm.expectRevert(
            abi.encodeWithSelector(
                IOrderBook.FailedToTakeFromBook.selector, ALICE, IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, 1
            )
        );
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, 1, 0));
        vm.stopPrank();
    }

    function testLimitOrdersMatchBothSidesAndLeaveRemainder() public {
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, QUANTITY));
        vm.prank(ALICE);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 15));
        assertEq(erc1155.balanceOf(ALICE, ORDERBOOK_TOKEN_ID), ORDERBOOK_INITIAL_QUANTITY + QUANTITY);
        IOrderBook.Order[] memory bids = orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE);
        assertEq(bids.length, 1);
        assertEq(bids[0].quantity, 5);

        vm.prank(ALICE);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 5));
        assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE).length, 0);
    }

    function testInvalidMarketAndLimitOrders() public {
        vm.expectRevert(IOrderBook.NoQuantity.selector);
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 0, 0));
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.TokenDoesntExist.selector, ORDERBOOK_TOKEN_ID + 1));
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID + 1, 1, 0));
        vm.expectRevert(IOrderBook.NoQuantity.selector);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 0));
        vm.expectRevert(IOrderBook.PriceZero.selector);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, 0, 1));
    }

    function testCancelBuyAndSellRefundsAndDefensiveErrors() public {
        uint256 coinsBefore = brush.balanceOf(address(this));
        uint256 nftsBefore = erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID);
        IOrderBook.LimitOrder[] memory orders = new IOrderBook.LimitOrder[](2);
        orders[0] = _order(IOrderBook.OrderSide.Buy, PRICE, QUANTITY)[0];
        orders[1] = _order(IOrderBook.OrderSide.Sell, PRICE + 1, QUANTITY)[0];
        orderBook.limitOrders(orders);
        orderBook.cancelOrders(_uints(1), _cancel(IOrderBook.OrderSide.Buy, PRICE));
        orderBook.cancelOrders(_uints(2), _cancel(IOrderBook.OrderSide.Sell, PRICE + 1));
        assertEq(brush.balanceOf(address(this)), coinsBefore);
        assertEq(erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID), nftsBefore);
        assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE));
        assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 1));
        vm.expectRevert(IOrderBook.LengthMismatch.selector);
        orderBook.cancelOrders(_uints(1), new IOrderBook.CancelOrder[](0));
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.OrderNotFoundInTree.selector, 1, PRICE));
        orderBook.cancelOrders(_uints(1), _cancel(IOrderBook.OrderSide.Buy, PRICE));
    }

    function testCancellationRequiresMakerAndHandlesBulkAndPartialSegments() public {
        orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE, 1, 8));
        vm.prank(ALICE);
        vm.expectRevert(IOrderBook.NotMaker.selector);
        orderBook.cancelOrders(_uints(1), _cancel(IOrderBook.OrderSide.Sell, PRICE));

        uint256[] memory ids = _uints(1, 4, 8);
        IOrderBook.CancelOrder[] memory cancels = new IOrderBook.CancelOrder[](3);
        for (uint256 i; i < cancels.length; ++i) {
            cancels[i] = _cancel(IOrderBook.OrderSide.Sell, PRICE)[0];
        }
        orderBook.cancelOrders(ids, cancels);
        IOrderBook.Order[] memory remaining =
            orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE);
        assertEq(remaining.length, 5);
        assertEq(remaining[0].id, 2);
        assertEq(remaining[4].id, 7);
    }

    function testPriceCapacityMovesOrdersByTickOnBothSides() public {
        erc1155.mintSpecificId(address(this), ORDERBOOK_TOKEN_ID, 1000);
        orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE, 1, ORDERBOOK_MAX_ORDERS_PER_PRICE));
        vm.prank(ALICE);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 1));
        assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE).length, 100);
        assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, PRICE + 1).length, 1);

        orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, 50, 1, ORDERBOOK_MAX_ORDERS_PER_PRICE));
        vm.prank(ALICE);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, 50, 1));
        assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, 49).length, 1);
    }

    function testTokenConfigurationConstraintsAndMinimumQuantity() public {
        uint256 tokenId = ORDERBOOK_TOKEN_ID + 1;
        orderBook.setTokenIdInfos(_uints(tokenId), _tokenInfo(10, 20));
        erc1155.mintSpecificId(address(this), tokenId, 100);
        IOrderBook.LimitOrder[] memory orders = new IOrderBook.LimitOrder[](1);
        orders[0] = IOrderBook.LimitOrder(IOrderBook.OrderSide.Sell, tokenId, 101, 20);
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.PriceNotMultipleOfTick.selector, 10));
        orderBook.limitOrders(orders);
        orders[0].price = 100;
        orders[0].quantity = 19;
        orderBook.limitOrders(orders);
        assertEq(erc1155.balanceOf(address(orderBook), tokenId), 0);
        orders[0].quantity = 20;
        orderBook.limitOrders(orders);
        assertEq(erc1155.balanceOf(address(orderBook), tokenId), 20);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        orderBook.setTokenIdInfos(_uints(tokenId), _tokenInfo(10, 1));
        vm.expectRevert(IOrderBook.LengthMismatch.selector);
        orderBook.setTokenIdInfos(_uints(tokenId), new IOrderBook.TokenIdInfo[](0));
        vm.expectRevert(IOrderBook.TickCannotBeChanged.selector);
        orderBook.setTokenIdInfos(_uints(tokenId), _tokenInfo(11, 20));
        orderBook.setTokenIdInfos(_uints(tokenId), _tokenInfo(0, 20));
        orderBook.setTokenIdInfos(_uints(tokenId), _tokenInfo(10, 20));
    }

    function testMaxOrdersConfiguration() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        orderBook.setMaxOrdersPerPrice(100);
        vm.expectRevert(IOrderBook.MaxOrdersNotMultipleOfOrdersInSegment.selector);
        orderBook.setMaxOrdersPerPrice(101);
        orderBook.setMaxOrdersPerPrice(104);
    }

    function testMarketBuyDistributesRoyaltyDevAndBurnFees() public {
        erc1155.setRoyaltyFee(1000);
        orderBook.updateRoyaltyFee();
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 100));

        uint256 cost = PRICE * QUANTITY;
        uint256 aliceBefore = brush.balanceOf(ALICE);
        vm.prank(ALICE);
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, QUANTITY, cost));

        assertEq(brush.balanceOf(ALICE), aliceBefore - cost);
        assertEq(brush.balanceOf(ROYALTY_RECIPIENT), cost / 10);
        assertEq(brush.balanceOf(DEV), (cost * 3) / 1000);
        assertEq(brush.amountBurnt(), (cost * 3) / 1000);
        assertEq(brush.balanceOf(address(orderBook)), cost - (cost / 10) - ((cost * 6) / 1000));
    }

    function testMarketSellDistributesRoyaltyDevAndBurnFees() public {
        erc1155.setRoyaltyFee(1000);
        orderBook.updateRoyaltyFee();
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 100));

        uint256 cost = PRICE * QUANTITY;
        uint256 aliceBefore = brush.balanceOf(ALICE);
        vm.prank(ALICE);
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, QUANTITY, 0));

        assertEq(brush.balanceOf(ALICE), aliceBefore + cost - (cost / 10) - ((cost * 6) / 1000));
        assertEq(brush.balanceOf(ROYALTY_RECIPIENT), cost / 10);
        assertEq(brush.balanceOf(DEV), (cost * 3) / 1000);
        assertEq(brush.amountBurnt(), (cost * 3) / 1000);
    }

    function testFeeConfigurationRequiresOwner() public {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        orderBook.setFees(address(0), 0, 0);

        vm.expectEmit(false, false, false, true, address(orderBook));
        emit IOrderBook.SetFees(address(0), 0, 0);
        orderBook.setFees(address(0), 0, 0);
    }

    function testRoyaltyUpdateSupportsERC1155WithoutERC2981() public {
        TestERC1155NoRoyalty nft = new TestERC1155NoRoyalty();
        OrderBook implementation = _deployOrderBookImplementation();
        OrderBook withoutRoyalty = OrderBook(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        OrderBook.initialize,
                        (address(nft), address(brush), address(0), uint16(0), uint8(0), ORDERBOOK_MAX_ORDERS_PER_PRICE)
                    )
                )
            )
        );
        withoutRoyalty.updateRoyaltyFee();
    }

    function testClaimsTokensFeesSnapshotsAndDefensiveConstraints() public {
        erc1155.setRoyaltyFee(1000);
        orderBook.updateRoyaltyFee();
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, QUANTITY));
        vm.prank(ALICE);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, QUANTITY));
        uint256 expected = PRICE * QUANTITY - 106;
        assertEq(orderBook.tokensClaimable(_ids40(1)), expected);
        orderBook.setFees(DEV, 1000, 246);
        uint256 before = brush.balanceOf(address(this));
        orderBook.claimTokens(_uints(1));
        assertEq(brush.balanceOf(address(this)), before + expected);
        assertEq(orderBook.tokensClaimable(_ids40(1)), 0);
        vm.expectRevert(IOrderBook.NothingToClaim.selector);
        orderBook.claimTokens(_uints(1));
        vm.expectRevert(IOrderBook.NothingToClaim.selector);
        orderBook.claimTokens(new uint256[](0));
    }

    function testClaimsNFTsMultipleAndMakerConstraint() public {
        orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, QUANTITY, 5));
        vm.prank(ALICE);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 42));
        uint40[] memory ids40 = new uint40[](5);
        uint256[] memory ids = new uint256[](5);
        for (uint256 i; i < 5; ++i) {
            ids40[i] = uint40(i + 1);
            ids[i] = i + 1;
        }
        uint256[] memory amounts = orderBook.nftsClaimable(ids40);
        assertEq(amounts[0], 10);
        assertEq(amounts[3], 10);
        assertEq(amounts[4], 2);
        vm.prank(ALICE);
        vm.expectRevert(IOrderBook.NotMaker.selector);
        orderBook.claimNFTs(ids);
        uint256 before = erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID);
        orderBook.claimNFTs(ids);
        assertEq(erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID), before + 42);
        vm.expectRevert(IOrderBook.NothingToClaim.selector);
        orderBook.claimNFTs(_uints(1));
    }

    function testClaimAllSupportsBothAndEitherSideAndLimits() public {
        orderBook.setFees(address(0), 0, 0);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 100));
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 101));
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, 20));
        orderBook.claimAll(_uints(1), _uints(2));
        assertEq(erc1155.balanceOf(address(this), ORDERBOOK_TOKEN_ID), ORDERBOOK_INITIAL_QUANTITY - 19);
        assertEq(brush.balanceOf(address(this)), ORDERBOOK_INITIAL_COINS);
        vm.expectRevert(IOrderBook.NothingToClaim.selector);
        orderBook.claimAll(new uint256[](0), new uint256[](0));
        uint256[] memory tooMany = new uint256[](201);
        vm.expectRevert(IOrderBook.ClaimingTooManyOrders.selector);
        orderBook.claimAll(tooMany, new uint256[](0));
    }

    function testCancelAndMakeLimitOrdersBothSides() public {
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, QUANTITY));
        orderBook.cancelAndMakeLimitOrders(
            _uints(1), _cancel(IOrderBook.OrderSide.Buy, PRICE), _order(IOrderBook.OrderSide.Buy, PRICE + 1, 12)
        );
        assertEq(orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE).length, 0);
        IOrderBook.Order[] memory orders =
            orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE + 1);
        assertEq(orders.length, 1);
        assertEq(orders[0].id, 2);
        assertEq(orders[0].quantity, 12);
    }

    function testTickCompressionSupportsHighPricesAndEffectiveSettlement() public {
        uint256 tokenId = ORDERBOOK_TOKEN_ID + 1;
        uint128 tick = uint128(0.001 ether);
        uint256 price = 5000 ether;
        orderBook.setTokenIdInfos(_uints(tokenId), _tokenInfo(tick, 1));
        erc1155.setRoyaltyFee(0);
        orderBook.updateRoyaltyFee();
        orderBook.setFees(address(0), 0, 0);
        erc1155.mintSpecificId(address(this), tokenId, 2);
        IOrderBook.LimitOrder[] memory orders = new IOrderBook.LimitOrder[](1);
        orders[0] = IOrderBook.LimitOrder(IOrderBook.OrderSide.Sell, tokenId, price, 2);
        orderBook.limitOrders(orders);
        assertEq(orderBook.getLowestAsk(tokenId), price / tick);
        assertTrue(orderBook.nodeExists(IOrderBook.OrderSide.Sell, tokenId, price));
        brush.mint(ALICE, price * 2);
        vm.startPrank(ALICE);
        brush.approve(address(orderBook), type(uint256).max);
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Buy, tokenId, 2, price * 2));
        vm.stopPrank();
        assertEq(orderBook.tokensClaimable(_ids40(1)), price * 2);
        uint256 before = brush.balanceOf(address(this));
        orderBook.claimTokens(_uints(1));
        assertEq(brush.balanceOf(address(this)), before + price * 2);
    }

    function testTickCompressedMarketSellUsesEffectivePriceForBalancesAndClaims() public {
        uint256 tokenId = ORDERBOOK_TOKEN_ID + 1;
        uint128 tick = uint128(0.001 ether);
        uint256 price = 5000 ether;
        uint24 quantity = 2;
        orderBook.setTokenIdInfos(_uints(tokenId), _tokenInfo(tick, 1));
        erc1155.setRoyaltyFee(0);
        orderBook.updateRoyaltyFee();
        orderBook.setFees(address(0), 0, 0);
        erc1155.mintSpecificId(ALICE, tokenId, quantity);
        brush.mint(address(this), price * quantity);
        brush.approve(address(orderBook), type(uint256).max);

        IOrderBook.LimitOrder[] memory orders = new IOrderBook.LimitOrder[](1);
        orders[0] = IOrderBook.LimitOrder(IOrderBook.OrderSide.Buy, tokenId, price, quantity);
        orderBook.limitOrders(orders);
        uint256 aliceBefore = brush.balanceOf(ALICE);

        vm.prank(ALICE);
        orderBook.marketOrder(IOrderBook.MarketOrder(IOrderBook.OrderSide.Sell, tokenId, quantity, price * quantity));
        assertEq(brush.balanceOf(ALICE), aliceBefore + price * quantity);
        assertEq(erc1155.balanceOf(ALICE, tokenId), 0);

        uint40[] memory orderIds = _ids40(1);
        assertEq(orderBook.nftsClaimable(orderIds)[0], quantity);
        orderBook.claimNFTs(_uints(1));
        assertEq(erc1155.balanceOf(address(this), tokenId), quantity);
        assertEq(orderBook.nftsClaimable(orderIds)[0], 0);
    }

    function testUncompressedPriceBounds() public {
        vm.expectRevert();
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, 4800 ether, 1));
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, 4700 ether, 1));
        assertTrue(orderBook.nodeExists(IOrderBook.OrderSide.Sell, ORDERBOOK_TOKEN_ID, 4700 ether));
    }

    function testConsumedAndReaddedPriceLevelPreservesTombstoneOffset() public {
        orderBook.limitOrders(_orders(IOrderBook.OrderSide.Buy, PRICE, QUANTITY, 8));
        vm.prank(ALICE);
        orderBook.limitOrders(_orders(IOrderBook.OrderSide.Sell, PRICE, QUANTITY, 8));
        assertFalse(orderBook.nodeExists(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE));

        orderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, QUANTITY));
        assertEq(orderBook.getNode(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE).tombstoneOffset, 2);
        IOrderBook.Order[] memory orders =
            orderBook.allOrdersAtPrice(IOrderBook.OrderSide.Buy, ORDERBOOK_TOKEN_ID, PRICE);
        assertEq(orders.length, 1);
        assertEq(orders[0].id, 9);
    }

    function testUpgradeRequiresOwner() public {
        OrderBook newImplementation = _deployOrderBookImplementation();
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, ALICE));
        orderBook.upgradeToAndCall(address(newImplementation), "");
        orderBook.upgradeToAndCall(address(newImplementation), "");
        assertEq(orderBook.owner(), address(this));
    }

    function testERC1155CallbackCannotReenterLimitOrders() public {
        TestMaliciousReentrancy attacker = new TestMaliciousReentrancy(address(orderBook));
        address attackerAddress = address(attacker);
        brush.mint(attackerAddress, PRICE * QUANTITY);
        vm.prank(attackerAddress);
        brush.approve(address(orderBook), type(uint256).max);
        vm.prank(ALICE);
        orderBook.limitOrders(_order(IOrderBook.OrderSide.Sell, PRICE, QUANTITY));

        vm.prank(attackerAddress);
        vm.expectRevert(ReentrancyGuardTransientUpgradeable.ReentrancyGuardReentrantCall.selector);
        OrderBook(attackerAddress).limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, 1));
    }

    function testERC20CallbackCannotReenterWhileFundingBuyOrder() public {
        TestERC20Reentrancy reentrantToken = new TestERC20Reentrancy();
        OrderBook implementation = _deployOrderBookImplementation();
        OrderBook reentrantOrderBook = OrderBook(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(
                        OrderBook.initialize,
                        (
                            address(erc1155),
                            address(reentrantToken),
                            DEV,
                            uint16(30),
                            uint8(30),
                            ORDERBOOK_MAX_ORDERS_PER_PRICE
                        )
                    )
                )
            )
        );
        reentrantToken.setOrderBook(address(reentrantOrderBook));
        reentrantToken.mint(address(this), PRICE * QUANTITY);
        reentrantToken.approve(address(reentrantOrderBook), type(uint256).max);
        reentrantOrderBook.setTokenIdInfos(
            _uints(ORDERBOOK_TOKEN_ID), _tokenInfo(ORDERBOOK_TICK, ORDERBOOK_MIN_QUANTITY)
        );

        vm.expectRevert(ReentrancyGuardTransientUpgradeable.ReentrancyGuardReentrantCall.selector);
        reentrantOrderBook.limitOrders(_order(IOrderBook.OrderSide.Buy, PRICE, QUANTITY));
    }

    function _deployOrderBookImplementation() private returns (OrderBook) {
        return OrderBook(_deployArtifact("contracts/Bazaar/OrderBook.sol:OrderBook:via-ir"));
    }
}
