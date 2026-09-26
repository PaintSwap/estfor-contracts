// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {GlobalEventInfo} from "../contracts/globals/events.sol";

// Neutral ABI declarations keep implementation imports out of this test's compiler graph.
interface IReconciliationShop {
  struct Pack {
    uint80 price;
    uint16[] itemTokenIds;
    uint16[] itemQuantities;
    uint16 amountRemaining;
    uint32 startTimestamp;
    uint96 brushToGive;
  }
  struct Config {
    uint80 price;
    uint16[] itemTokenIds;
    uint16[] itemQuantities;
    uint32 startTimestamp;
    uint96 brushToGive;
  }
  function setSupporterPacks(uint24[] calldata ids, Pack[] calldata packs) external;
  function setSupporterPackConfig(uint24 id, Config calldata config) external;
  function getSupporterPackConfig(uint24 id) external view returns (Config memory);
  function getSupporterPackIds(uint256 start, uint256 end) external view returns (uint24[] memory);
  function removeSupporterPack(uint24 id) external;
  function setSupporterPackToken(address token) external;
  function setItemNFT(address token) external;
  function buySupporterPack(uint24 id, address to, uint16 amount) external;
}

interface IReconciliationEvents {
  function addGlobalEvents(uint256[] calldata ids, GlobalEventInfo[] calldata infos) external;
  function getGlobalEvent(uint256 id) external view returns (GlobalEventInfo memory);
  function getGlobalEventIds(uint256 start, uint256 count) external view returns (uint256[] memory);
  function setGlobalEventDisabled(uint256 id, bool disabled) external;
  function globalEventDisabled(uint256 id) external view returns (bool);
  function contribute(uint256 id, uint256 amount) external;
}

interface IReconciliationMarket {
  struct Item {
    uint128 price;
    uint16 tokenId;
    uint16 amountPerPurchase;
    uint16 currentStock;
    uint16 stock;
    bool isActive;
  }
  struct Config {
    uint128 price;
    uint16 tokenId;
    uint16 amountPerPurchase;
    uint16 stock;
  }
  function addShopItems(Item[] calldata items, uint256 id) external;
  function setAcceptedItemId(uint256 id, uint16 tokenId) external;
  function getShopCollection(uint256 id) external view returns (uint16, Item[] memory);
  function getShopCollectionIds(uint256 start, uint256 count) external view returns (uint256[] memory);
  function setShopCollectionConfig(uint256 id, uint16 acceptedItemId, Config[] calldata items) external;
}

interface IReconciliationUpgrade {
  function upgradeToAndCall(address implementation, bytes calldata data) external payable;
}

contract MarketEventReconciliationTest is Test {
  address private constant MOCK = address(0x1234);
  address private constant USER = address(0x5678);

  function setUp() public {
    vm.warp(1 days);
    vm.etch(MOCK, hex"00");
    vm.mockCall(MOCK, bytes(""), abi.encode(true));
  }

  function _proxy(string memory artifact, bytes memory init) private returns (address) {
    return address(new ERC1967Proxy(vm.deployCode(artifact), init));
  }

  function _upgrade(address proxy, string memory artifact) private {
    IReconciliationUpgrade(proxy).upgradeToAndCall(vm.deployCode(artifact), "");
  }

  function _shop() private returns (IReconciliationShop shop) {
    shop = IReconciliationShop(
      _proxy(
        "contracts/old/ShopV2.sol:ShopV2",
        abi.encodeWithSignature("initialize(address,address,address,uint24,uint24)", MOCK, MOCK, USER, 1, 1)
      )
    );
    shop.setSupporterPackToken(MOCK);
    shop.setItemNFT(MOCK);
    uint24[] memory ids = new uint24[](2);
    ids[0] = 0;
    ids[1] = type(uint24).max;
    IReconciliationShop.Pack[] memory packs = new IReconciliationShop.Pack[](2);
    packs[0] = IReconciliationShop.Pack(10, new uint16[](0), new uint16[](0), 5, 1, 0);
    packs[1] = IReconciliationShop.Pack(20, new uint16[](0), new uint16[](0), 0, 1, 0);
    shop.setSupporterPacks(ids, packs);
    shop.buySupporterPack(0, USER, 3);
    _upgrade(address(shop), "contracts/Shop.sol:Shop");
  }

  function testSupporterPackLegacyDiscoveryAndInventoryPreservation() public {
    IReconciliationShop shop = _shop();
    assertEq(shop.getSupporterPackIds(0, 1)[0], 0);
    assertEq(shop.getSupporterPackIds(type(uint24).max, uint256(type(uint24).max) + 1)[0], type(uint24).max);
    IReconciliationShop.Config memory config = shop.getSupporterPackConfig(0);
    assertEq(config.price, 10);
    config.price = 15;
    shop.setSupporterPackConfig(0, config);
    shop.removeSupporterPack(0);
    assertEq(shop.getSupporterPackIds(0, 1).length, 0);
    assertEq(shop.getSupporterPackConfig(0).price, 0);
    vm.expectRevert(bytes4(keccak256("ShopItemDoesNotExist()")));
    shop.buySupporterPack(0, USER, 1);
    shop.setSupporterPackConfig(0, config);
    shop.buySupporterPack(0, USER, 2);
    vm.expectRevert(abi.encodeWithSignature("SupporterPackInsufficientRemaining(uint16,uint16)", 1, 0));
    shop.buySupporterPack(0, USER, 1);
    assertEq(shop.getSupporterPackIds(0, 1).length, 1);
  }

  function testSupporterPackValidationAndOwner() public {
    IReconciliationShop shop = _shop();
    IReconciliationShop.Config memory config = shop.getSupporterPackConfig(0);
    vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", USER));
    vm.prank(USER);
    shop.setSupporterPackConfig(0, config);
    vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", USER));
    vm.prank(USER);
    shop.removeSupporterPack(0);
    config.itemQuantities = new uint16[](1);
    vm.expectRevert(bytes4(keccak256("LengthMismatch()")));
    shop.setSupporterPackConfig(0, config);
    vm.expectRevert(bytes4(keccak256("InvalidStateReadRange()")));
    shop.getSupporterPackIds(0, 1025);
    vm.expectRevert(bytes4(keccak256("InvalidStateReadRange()")));
    shop.getSupporterPackIds(2, 1);
    vm.expectRevert(bytes4(keccak256("InvalidStateReadRange()")));
    shop.getSupporterPackIds(type(uint24).max, uint256(type(uint24).max) + 2);
  }

  function testGlobalEventLegacyMaxIdDisableAndPreserveContributions() public {
    IReconciliationEvents events = IReconciliationEvents(
      _proxy(
        "contracts/old/GlobalEventsV2.sol:GlobalEventsV2",
        abi.encodeWithSignature("initialize(address,address,address)", address(this), MOCK, MOCK)
      )
    );
    uint256[] memory ids = new uint256[](1);
    ids[0] = type(uint256).max;
    GlobalEventInfo[] memory infos = new GlobalEventInfo[](1);
    infos[0] = GlobalEventInfo(1, 0, 2, 1, 1, 10, 0);
    events.addGlobalEvents(ids, infos);
    events.contribute(ids[0], 3);
    _upgrade(address(events), "contracts/Events/GlobalEvent.sol:GlobalEvents");
    assertEq(events.getGlobalEventIds(ids[0], 1)[0], ids[0]);
    events.setGlobalEventDisabled(ids[0], true);
    assertEq(events.getGlobalEvent(ids[0]).totalInputAmount, 3);
    assertEq(events.getGlobalEventIds(ids[0], 1).length, 1);
    vm.expectRevert(bytes4(keccak256("EventNotStarted()")));
    events.contribute(ids[0], 1);
    infos[0].rewardItemAmountPerInput = 2;
    infos[0].totalInputAmount = 100;
    events.addGlobalEvents(ids, infos);
    assertTrue(events.globalEventDisabled(ids[0]));
    assertEq(events.getGlobalEvent(ids[0]).totalInputAmount, 3);
    infos[0].inputItemMaxAmount = 2;
    vm.expectRevert(bytes4(keccak256("EventAtMaxCapacity()")));
    events.addGlobalEvents(ids, infos);
    infos[0].inputItemMaxAmount = 10;
    infos[0].inputItemTokenId = 3;
    vm.expectRevert(bytes4(keccak256("ContributedEventIdentityChange()")));
    events.addGlobalEvents(ids, infos);
    events.setGlobalEventDisabled(ids[0], false);
    events.contribute(ids[0], 1);
    assertEq(events.getGlobalEvent(ids[0]).totalInputAmount, 4);
    vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", USER));
    vm.prank(USER);
    events.setGlobalEventDisabled(ids[0], true);
    vm.expectRevert(bytes4(keccak256("InvalidStateReadRange()")));
    events.getGlobalEventIds(ids[0], 2);
    vm.expectRevert(bytes4(keccak256("InvalidStateReadRange()")));
    events.getGlobalEventIds(0, 1025);
  }

  function testBlackMarketLegacyDiscoveryAndRuntimePreserved() public {
    IReconciliationMarket market = IReconciliationMarket(
      _proxy(
        "contracts/old/BlackMarketTraderV2.sol:BlackMarketTraderV2",
        abi.encodeWithSignature("initialize(address,address,address)", address(this), MOCK, MOCK)
      )
    );
    uint256 id = type(uint256).max;
    IReconciliationMarket.Item[] memory items = new IReconciliationMarket.Item[](1);
    items[0] = IReconciliationMarket.Item(10, 1, 2, 3, 5, true);
    market.addShopItems(items, id);
    market.setAcceptedItemId(0, 1);
    _upgrade(address(market), "contracts/Events/BlackMarketTrader.sol:BlackMarketTrader");
    assertEq(market.getShopCollectionIds(id, 1)[0], id);
    assertEq(market.getShopCollectionIds(0, 1)[0], 0);
    IReconciliationMarket.Config[] memory configs = new IReconciliationMarket.Config[](1);
    configs[0] = IReconciliationMarket.Config(20, 1, 4, 8);
    market.setShopCollectionConfig(id, 2, configs);
    (uint16 accepted, IReconciliationMarket.Item[] memory actual) = market.getShopCollection(id);
    assertEq(accepted, 2);
    assertEq(actual[0].price, 20);
    assertEq(actual[0].amountPerPurchase, 4);
    assertEq(actual[0].stock, 8);
    assertEq(actual[0].currentStock, 3);
    assertTrue(actual[0].isActive);
    vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", USER));
    vm.prank(USER);
    market.setShopCollectionConfig(id, 2, configs);
    configs[0].tokenId = 2;
    vm.expectRevert(bytes4(keccak256("ShopItemDoesNotExist()")));
    market.setShopCollectionConfig(id, 3, configs);
    (accepted, ) = market.getShopCollection(id);
    assertEq(accepted, 2);
    vm.warp(1 weeks);
    vm.expectRevert(bytes4(keccak256("ShopConfigurationLocked()")));
    market.setShopCollectionConfig(id, 2, configs);
    vm.expectRevert(bytes4(keccak256("InvalidStateReadRange()")));
    market.getShopCollectionIds(id, 2);
    vm.expectRevert(bytes4(keccak256("InvalidStateReadRange()")));
    market.getShopCollectionIds(0, 1025);
  }
}
