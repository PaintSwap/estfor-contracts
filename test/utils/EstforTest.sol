// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

import {AdminAccess} from "../../contracts/AdminAccess.sol";
import {DailyRewardsScheduler} from "../../contracts/DailyRewardsScheduler.sol";
import {ItemNFT} from "../../contracts/ItemNFT.sol";
import {RandomnessBeacon} from "../../contracts/RandomnessBeacon.sol";
import {RoyaltyReceiver} from "../../contracts/RoyaltyReceiver.sol";
import {Shop} from "../../contracts/Shop.sol";
import {ShopV1} from "../../contracts/old/ShopV1.sol";
import {Treasury} from "../../contracts/Treasury.sol";
import {IOrderBook, IOrderBook as OrderBook} from "../../contracts/Bazaar/interfaces/IOrderBook.sol";
import {GameSubsidisationRegistry} from "../../contracts/Session/GameSubsidisationRegistry.sol";
import {IUsageBasedSessionModule as UsageBasedSessionModule} from "../../contracts/interfaces/IUsageBasedSessionModule.sol";
import {IBankFactory} from "../../contracts/interfaces/IBankFactory.sol";
import {IPlayers} from "../../contracts/interfaces/IPlayers.sol";
import {IBrushToken} from "../../contracts/interfaces/external/IBrushToken.sol";
import {IOracleCB} from "../../contracts/interfaces/IOracleCB.sol";
import {IGameSubsidisationRegistry} from "../../contracts/interfaces/IGameSubsidisationRegistry.sol";
import {ISolidlyRouter} from "../../contracts/interfaces/external/ISolidlyRouter.sol";
import {MockItemNFT} from "../../contracts/test/MockItemNFT.sol";
import {MockPlayers} from "../../contracts/test/MockPlayers.sol";
import {TestERC1155} from "../../contracts/test/TestERC1155.sol";
import {MockBrushToken} from "../../contracts/test/external/MockBrushToken.sol";
import {MockOracleCB} from "../../contracts/test/MockOracleCB.sol";
import {MockRouter} from "../../contracts/test/external/MockRouter.sol";
import {MockVRF} from "../../contracts/test/MockVRF.sol";
import {Skill} from "../../contracts/globals/misc.sol";
import {XP_BYTES} from "../../contracts/globals/players.sol";

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

  address private constant ESTFOR_LIBRARY = address(0x1001);
  address private constant ITEM_NFT_LIBRARY = address(0x1002);
  address private constant PET_NFT_LIBRARY = address(0x1003);
  address private constant PLAYERS_LIBRARY = address(0x1004);
  address private constant PROMOTIONS_LIBRARY = address(0x1005);
  address private constant CLAN_BATTLE_LIBRARY = address(0x1006);
  address private constant LOCKED_BANK_VAULTS_LIBRARY = address(0x1007);

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

  bool private linkedLibrariesInstalled;

  constructor() {
    _installLinkedLibraries();
  }

  function _deployArtifact(string memory artifact) internal returns (address deployed) {
    _installLinkedLibraries();
    deployed = vm.deployCode(artifact);
  }

  function _deployArtifact(string memory artifact, bytes memory constructorArgs) internal returns (address deployed) {
    _installLinkedLibraries();
    deployed = vm.deployCode(artifact, constructorArgs);
  }

  function _installLinkedLibraries() internal {
    if (linkedLibrariesInstalled) return;
    linkedLibrariesInstalled = true;
    vm.etch(ESTFOR_LIBRARY, vm.getDeployedCode("contracts/EstforLibrary.sol:EstforLibrary:via-ir"));
    vm.etch(ITEM_NFT_LIBRARY, vm.getDeployedCode("contracts/ItemNFTLibrary.sol:ItemNFTLibrary:via-ir"));
    vm.etch(PET_NFT_LIBRARY, vm.getDeployedCode("contracts/PetNFTLibrary.sol:PetNFTLibrary:via-ir"));
    vm.etch(PLAYERS_LIBRARY, vm.getDeployedCode("contracts/Players/PlayersLibrary.sol:PlayersLibrary:via-ir"));
    vm.etch(PROMOTIONS_LIBRARY, vm.getDeployedCode("contracts/PromotionsLibrary.sol:PromotionsLibrary:via-ir"));
    vm.etch(CLAN_BATTLE_LIBRARY, vm.getDeployedCode("contracts/Clans/ClanBattleLibrary.sol:ClanBattleLibrary:via-ir"));
    vm.etch(
      LOCKED_BANK_VAULTS_LIBRARY,
      vm.getDeployedCode("contracts/Clans/LockedBankVaultsLibrary.sol:LockedBankVaultsLibrary:via-ir")
    );
  }

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
          new ERC1967Proxy(address(implementation), abi.encodeCall(implementation.initialize, (address(mockVRF))))
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

  function _deployAdminAccess(
    address[] memory admins,
    address[] memory promotionalAdmins
  ) internal returns (AdminAccess deployed) {
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
          ShopV1.initialize,
          (IBrushToken(address(brush)), treasury, DEV, MIN_ITEM_QUANTITY_BEFORE_SELLS_ALLOWED, SELLING_CUTOFF_DURATION)
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
        abi.encodeCall(AdminAccess.initialize, (_addresses(address(this), ALICE), _addresses(address(this), ALICE)))
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

    OrderBook orderBookImplementation = OrderBook(_deployArtifact("contracts/Bazaar/OrderBook.sol:OrderBook:via-ir"));
    orderBook = OrderBook(
      _deployUUPS(
        address(orderBookImplementation),
        abi.encodeCall(
          OrderBook.initialize,
          (IERC1155(address(erc1155)), address(brush), DEV, uint16(30), uint8(30), ORDERBOOK_MAX_ORDERS_PER_PRICE)
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
      _deployUUPS(address(registryImplementation), abi.encodeCall(registryImplementation.initialize, (address(this))))
    );

    UsageBasedSessionModule moduleImplementation = UsageBasedSessionModule(
      _deployArtifact("contracts/Session/UsageBasedSessionModule.sol:UsageBasedSessionModule:via-ir")
    );
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

  function _uint16s(uint16 a) internal pure returns (uint16[] memory values) {
    values = new uint16[](1);
    values[0] = a;
  }

  function _uint16s(uint16 a, uint16 b) internal pure returns (uint16[] memory values) {
    values = new uint16[](2);
    values[0] = a;
    values[1] = b;
  }

  function _uint16s(uint16 a, uint16 b, uint16 c) internal pure returns (uint16[] memory values) {
    values = new uint16[](3);
    values[0] = a;
    values[1] = b;
    values[2] = c;
  }

  function _uint16s(uint16 a, uint16 b, uint16 c, uint16 d) internal pure returns (uint16[] memory values) {
    values = new uint16[](4);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
  }

  function _uint24s(uint24 a) internal pure returns (uint24[] memory values) {
    values = new uint24[](1);
    values[0] = a;
  }

  function _uint24s(uint24 a, uint24 b, uint24 c) internal pure returns (uint24[] memory values) {
    values = new uint24[](3);
    values[0] = a;
    values[1] = b;
    values[2] = c;
  }

  function _uint8s(Skill a, Skill b) internal pure returns (uint8[] memory values) {
    values = new uint8[](2);
    values[0] = uint8(a);
    values[1] = uint8(b);
  }

  function _uint8s(Skill a, Skill b, Skill c) internal pure returns (uint8[] memory values) {
    values = new uint8[](3);
    values[0] = uint8(a);
    values[1] = uint8(b);
    values[2] = uint8(c);
  }

  function _uint8s(Skill a, Skill b, Skill c, Skill d) internal pure returns (uint8[] memory values) {
    values = new uint8[](4);
    values[0] = uint8(a);
    values[1] = uint8(b);
    values[2] = uint8(c);
    values[3] = uint8(d);
  }

  function _uint32s(uint256 a, uint256 b, uint256 c) internal pure returns (uint32[] memory values) {
    values = new uint32[](3);
    values[0] = uint32(a);
    values[1] = uint32(b);
    values[2] = uint32(c);
  }

  function _int16s(int16 a, int16 b, int16 c) internal pure returns (int16[] memory values) {
    values = new int16[](3);
    values[0] = a;
    values[1] = b;
    values[2] = c;
  }

  function _xpAtLevel(uint256 level) internal pure returns (uint56) {
    uint256 key = (level - 1) * 4;
    return
      uint56(
        uint32(
          XP_BYTES[key] |
            (bytes4(XP_BYTES[key + 1]) >> 8) |
            (bytes4(XP_BYTES[key + 2]) >> 16) |
            (bytes4(XP_BYTES[key + 3]) >> 24)
        )
      );
  }
}
