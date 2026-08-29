// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {AdminAccess} from "../../contracts/AdminAccess.sol";
import {DailyRewardsScheduler} from "../../contracts/DailyRewardsScheduler.sol";
import {ItemNFT} from "../../contracts/ItemNFT.sol";
import {RandomnessBeacon} from "../../contracts/RandomnessBeacon.sol";
import {RoyaltyReceiver} from "../../contracts/RoyaltyReceiver.sol";
import {Shop} from "../../contracts/Shop.sol";
import {Treasury} from "../../contracts/Treasury.sol";
import {OrderBook} from "../../contracts/Bazaar/OrderBook.sol";
import {IOrderBook} from "../../contracts/Bazaar/interfaces/IOrderBook.sol";
import {GameSubsidisationRegistry} from "../../contracts/Session/GameSubsidisationRegistry.sol";
import {UsageBasedSessionModule} from "../../contracts/Session/UsageBasedSessionModule.sol";
import {IBankFactory} from "../../contracts/interfaces/IBankFactory.sol";
import {IGameSubsidisationRegistry} from "../../contracts/interfaces/IGameSubsidisationRegistry.sol";
import {IPlayers} from "../../contracts/interfaces/IPlayers.sol";
import {IBrushToken} from "../../contracts/interfaces/external/IBrushToken.sol";
import {IOracleCB} from "../../contracts/interfaces/IOracleCB.sol";
import {ISolidlyRouter} from "../../contracts/interfaces/external/ISolidlyRouter.sol";
import {MockItemNFT} from "../../contracts/test/MockItemNFT.sol";
import {MockPlayers} from "../../contracts/test/MockPlayers.sol";
import {TestERC1155} from "../../contracts/test/TestERC1155.sol";
import {MockBrushToken} from "../../contracts/test/external/MockBrushToken.sol";
import {MockOracleCB} from "../../contracts/test/MockOracleCB.sol";
import {MockRouter} from "../../contracts/test/external/MockRouter.sol";
import {MockVRF} from "../../contracts/test/MockVRF.sol";

abstract contract EstforTest is Test, ERC1155Holder {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant DEV = address(0xDE7);
    address internal constant SHOP = address(0x5A0F);
    address internal constant ROYALTY_RECIPIENT = address(0xFEE);

    uint24 internal constant MIN_ITEM_QUANTITY_BEFORE_SELLS_ALLOWED = 500;
    uint24 internal constant SELLING_CUTOFF_DURATION = 48 hours;

    uint16 internal constant ORDERBOOK_MAX_ORDERS_PER_PRICE = 100;
    uint256 internal constant ORDERBOOK_INITIAL_COINS = 100 ether;
    uint256 internal constant ORDERBOOK_INITIAL_QUANTITY = 100;
    uint256 internal constant ORDERBOOK_TOKEN_ID = 11;
    uint128 internal constant ORDERBOOK_TICK = 1;
    uint128 internal constant ORDERBOOK_MIN_QUANTITY = 1;

    RandomnessBeacon internal randomnessBeacon;
    MockVRF internal mockVRF;
    MockBrushToken internal brush;
    Treasury internal treasury;

    DailyRewardsScheduler internal dailyRewardsScheduler;
    Shop internal shop;
    RoyaltyReceiver internal royaltyReceiver;
    AdminAccess internal adminAccess;
    ItemNFT internal itemNFT;

    OrderBook internal orderBook;
    TestERC1155 internal erc1155;
    MockItemNFT internal mockItemNFT;

    GameSubsidisationRegistry internal gameSubsidisationRegistry;
    UsageBasedSessionModule internal usageBasedSessionModule;

    function _deployUUPS(address implementation, bytes memory initializeData) internal returns (address proxy) {
        proxy = address(new ERC1967Proxy(implementation, initializeData));
    }

    function _deployBeaconStack() internal {
        vm.warp(20 weeks);
        mockVRF = new MockVRF();
        RandomnessBeacon implementation = new RandomnessBeacon();
        randomnessBeacon = RandomnessBeacon(
            payable(
                address(
                    new ERC1967Proxy(
                        address(implementation), abi.encodeCall(implementation.initialize, (address(mockVRF)))
                    )
                )
            )
        );
        vm.deal(address(randomnessBeacon), 1 ether);
    }

    function _initializeBeaconRandomWords(MockOracleCB oracleCB, IOracleCB rewardsRequester) internal {
        randomnessBeacon.initializeAddresses(IOracleCB(address(oracleCB)), rewardsRequester);
        randomnessBeacon.initializeRandomWords();
    }

    function _deployTreasuryStack() internal {
        brush = new MockBrushToken();
        Treasury implementation = new Treasury();
        treasury = Treasury(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(implementation.initialize, (IBrushToken(address(brush))))
                )
            )
        );
    }

    function _deployAdminAccess(address[] memory admins, address[] memory promotionalAdmins)
        internal
        returns (AdminAccess deployed)
    {
        deployed = AdminAccess(
            _deployUUPS(address(new AdminAccess()), abi.encodeCall(AdminAccess.initialize, (admins, promotionalAdmins)))
        );
    }

    function _deployShopStack(address bankFactory) internal {
        _deployBeaconStack();
        MockOracleCB oracle = new MockOracleCB();
        _initializeBeaconRandomWords(oracle, IOracleCB(address(oracle)));

        _deployTreasuryStack();

        DailyRewardsScheduler schedulerImplementation = new DailyRewardsScheduler();
        dailyRewardsScheduler = DailyRewardsScheduler(
            _deployUUPS(
                address(schedulerImplementation),
                abi.encodeCall(schedulerImplementation.initialize, (address(randomnessBeacon)))
            )
        );

        Shop shopImplementation = new Shop();
        shop = Shop(
            _deployUUPS(
                address(shopImplementation),
                abi.encodeCall(
                    Shop.initialize,
                    (
                        IBrushToken(address(brush)),
                        treasury,
                        DEV,
                        MIN_ITEM_QUANTITY_BEFORE_SELLS_ALLOWED,
                        SELLING_CUTOFF_DURATION
                    )
                )
            )
        );

        MockRouter router = new MockRouter();
        RoyaltyReceiver royaltyReceiverImplementation = new RoyaltyReceiver();
        royaltyReceiver = RoyaltyReceiver(
            payable(
                _deployUUPS(
                    address(royaltyReceiverImplementation),
                    abi.encodeCall(
                        RoyaltyReceiver.initialize,
                        (ISolidlyRouter(address(router)), address(shop), DEV, IBrushToken(address(brush)), ALICE)
                    )
                )
            )
        );

        adminAccess = AdminAccess(
            _deployUUPS(
                address(new AdminAccess()),
                abi.encodeCall(
                    AdminAccess.initialize, (_addresses(address(this), ALICE), _addresses(address(this), ALICE))
                )
            )
        );

        ItemNFT itemNFTImplementation = new ItemNFT();
        itemNFT = ItemNFT(
            _deployUUPS(
                address(itemNFTImplementation),
                abi.encodeCall(ItemNFT.initialize, (address(royaltyReceiver), "ipfs://", adminAccess, true))
            )
        );

        itemNFT.initializeAddresses(IBankFactory(bankFactory), IPlayers(address(new MockPlayers())));
    }

    function _deployOrderBookStack() internal {
        brush = new MockBrushToken();
        erc1155 = new TestERC1155(ROYALTY_RECIPIENT);
        mockItemNFT = new MockItemNFT();

        OrderBook orderBookImplementation = new OrderBook();
        orderBook = OrderBook(
            _deployUUPS(
                address(orderBookImplementation),
                abi.encodeCall(
                    OrderBook.initialize,
                    (
                        IERC1155(address(erc1155)),
                        address(brush),
                        DEV,
                        uint16(30),
                        uint8(30),
                        ORDERBOOK_MAX_ORDERS_PER_PRICE
                    )
                )
            )
        );

        brush.mint(address(this), ORDERBOOK_INITIAL_COINS);
        brush.approve(address(orderBook), ORDERBOOK_INITIAL_COINS);
        vm.startPrank(ALICE);
        brush.mint(ALICE, ORDERBOOK_INITIAL_COINS);
        brush.approve(address(orderBook), ORDERBOOK_INITIAL_COINS);
        vm.stopPrank();

        erc1155.mintSpecificId(address(this), ORDERBOOK_TOKEN_ID, ORDERBOOK_INITIAL_QUANTITY * 2);
        erc1155.setApprovalForAll(address(orderBook), true);
        erc1155.safeTransferFrom(address(this), ALICE, ORDERBOOK_TOKEN_ID, ORDERBOOK_INITIAL_QUANTITY, "");
        vm.prank(ALICE);
        erc1155.setApprovalForAll(address(orderBook), true);

        uint256[] memory tokenIds = _uints(ORDERBOOK_TOKEN_ID);
        IOrderBook.TokenIdInfo[] memory infos = new IOrderBook.TokenIdInfo[](1);
        infos[0] = IOrderBook.TokenIdInfo({tick: ORDERBOOK_TICK, minQuantity: ORDERBOOK_MIN_QUANTITY});
        orderBook.setTokenIdInfos(tokenIds, infos);
    }

    function _deploySessionStack() internal {
        GameSubsidisationRegistry registryImplementation = new GameSubsidisationRegistry();
        gameSubsidisationRegistry = GameSubsidisationRegistry(
            _deployUUPS(
                address(registryImplementation), abi.encodeCall(registryImplementation.initialize, (address(this)))
            )
        );

        UsageBasedSessionModule moduleImplementation = new UsageBasedSessionModule();
        usageBasedSessionModule = UsageBasedSessionModule(
            payable(
                _deployUUPS(
                    address(moduleImplementation),
                    abi.encodeCall(
                        moduleImplementation.initialize,
                        (address(this), IGameSubsidisationRegistry(address(gameSubsidisationRegistry)))
                    )
                )
            )
        );
    }

    function _addresses(address a) internal pure returns (address[] memory values) {
        values = new address[](1);
        values[0] = a;
    }

    function _addresses(address a, address b) internal pure returns (address[] memory values) {
        values = new address[](2);
        values[0] = a;
        values[1] = b;
    }

    function _addresses(address a, address b, address c) internal pure returns (address[] memory values) {
        values = new address[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }

    function _uints(uint256 a) internal pure returns (uint256[] memory values) {
        values = new uint256[](1);
        values[0] = a;
    }

    function _uints(uint256 a, uint256 b) internal pure returns (uint256[] memory values) {
        values = new uint256[](2);
        values[0] = a;
        values[1] = b;
    }

    function _uints(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[] memory values) {
        values = new uint256[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }
}
