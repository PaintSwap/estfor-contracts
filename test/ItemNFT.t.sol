// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC1155Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {EstforTest} from "./utils/EstforTest.sol";
import {IOwnable} from "../contracts/interfaces/IOwnable.sol";
import {ItemNFT} from "../contracts/ItemNFT.sol";
import {MockBankFactory} from "../contracts/test/MockBankFactory.sol";
import {BulkTransferInfo, EquipPosition, ItemInput} from "../contracts/globals/all.sol";

contract ItemNFTTest is EstforTest {
  uint16 private constant BRONZE_ARMOR = 513;
  uint16 private constant BRONZE_AXE = 2816;
  uint16 private constant IRON_AXE = 2817;
  uint16 private constant MITHRIL_AXE = 2818;
  uint16 private constant ADAMANTINE_AXE = 2819;
  uint16 private constant RUNITE_AXE = 2820;
  uint16 private constant TITANIUM_AXE = 2821;
  uint16 private constant ORICHALCUM_AXE = 2822;

  function setUp() public {
    _deployShopStack(address(new MockBankFactory()));
  }

  function _item(uint16 tokenId, EquipPosition equipPosition) private pure returns (ItemInput memory input) {
    input.tokenId = tokenId;
    input.equipPosition = equipPosition;
    input.isTransferable = true;
  }

  function _addItem(uint16 tokenId, EquipPosition equipPosition, bool transferable) private {
    ItemInput[] memory items = new ItemInput[](1);
    items[0] = _item(tokenId, equipPosition);
    items[0].isTransferable = transferable;
    itemNFT.addItems(items);
  }

  function testSupportsInterfaceIERC165() public view {
    assertTrue(itemNFT.supportsInterface(type(IERC165).interfaceId));
  }

  function testSupportsInterfaceIERC1155() public view {
    assertTrue(itemNFT.supportsInterface(type(IERC1155).interfaceId));
  }

  function testSupportsInterfaceIERC1155Metadata() public view {
    assertTrue(itemNFT.supportsInterface(type(IERC1155MetadataURI).interfaceId));
  }

  function testSupportsInterfaceIERC2981Royalties() public view {
    assertTrue(itemNFT.supportsInterface(type(IERC2981).interfaceId));
  }

  // TODO: The Hardhat source intentionally contains no assertions yet.
  function testGetItem() public view {}

  // TODO: The Hardhat source intentionally contains no assertions yet.
  function testBalanceOfs() public view {}

  function testEditItem() public {
    _addItem(BRONZE_AXE, EquipPosition.RIGHT_HAND, false);

    ItemInput[] memory items = new ItemInput[](1);
    items[0] = _item(BRONZE_AXE, EquipPosition.LEFT_HAND);
    vm.expectRevert(ItemNFT.EquipmentPositionShouldNotChange.selector);
    itemNFT.editItems(items);

    items[0].equipPosition = EquipPosition.BOTH_HANDS;
    itemNFT.editItems(items);
    items[0].equipPosition = EquipPosition.RIGHT_HAND;
    itemNFT.editItems(items);

    items[0] = _item(BRONZE_ARMOR, EquipPosition.LEFT_HAND);
    vm.expectRevert(abi.encodeWithSelector(ItemNFT.ItemDoesNotExist.selector, BRONZE_ARMOR));
    itemNFT.editItems(items);

    items[0] = _item(BRONZE_AXE, EquipPosition.RIGHT_HAND);
    items[0].minXP = 100;
    itemNFT.editItems(items);
    assertEq(itemNFT.getItem(BRONZE_AXE).minXP, 100);

    items[0].minXP = 200;
    itemNFT.editItems(items);
    assertEq(itemNFT.getItem(BRONZE_AXE).minXP, 200);
  }

  function testTransferableNFT() public {
    _addItem(BRONZE_AXE, EquipPosition.RIGHT_HAND, true);
    itemNFT.mint(ALICE, BRONZE_AXE, 1);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 1);
    vm.prank(ALICE);
    itemNFT.safeTransferFrom(ALICE, address(this), BRONZE_AXE, 1, "");
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 0);
  }

  function testNonTransferableNFT() public {
    _addItem(BRONZE_AXE, EquipPosition.RIGHT_HAND, false);
    itemNFT.mint(ALICE, BRONZE_AXE, 1);
    vm.prank(ALICE);
    vm.expectRevert(ItemNFT.ItemNotTransferable.selector);
    itemNFT.safeTransferFrom(ALICE, address(this), BRONZE_AXE, 1, "");

    vm.prank(ALICE);
    itemNFT.burn(ALICE, BRONZE_AXE, 1);
  }

  function testTotalSupply() public {
    itemNFT.mint(ALICE, BRONZE_AXE, 3);
    assertEq(itemNFT.totalSupply(), 1);
    assertEq(itemNFT.totalSupply(BRONZE_AXE), 3);
    itemNFT.mint(ALICE, BRONZE_AXE, 1);
    assertEq(itemNFT.totalSupply(), 1);
    itemNFT.mint(ALICE, BRONZE_ARMOR, 1);
    assertEq(itemNFT.totalSupply(), 2);
    vm.startPrank(ALICE);
    itemNFT.burn(ALICE, BRONZE_AXE, 3);
    assertEq(itemNFT.totalSupply(), 2);
    itemNFT.burn(ALICE, BRONZE_AXE, 1);
    assertEq(itemNFT.totalSupply(), 1);
    vm.stopPrank();
    itemNFT.mint(ALICE, BRONZE_AXE, 1);
    assertEq(itemNFT.totalSupply(), 2);
    vm.prank(ALICE);
    itemNFT.burn(ALICE, BRONZE_AXE, 1);
    assertEq(itemNFT.totalSupply(), 1);
    vm.prank(ALICE);
    itemNFT.burn(ALICE, BRONZE_ARMOR, 1);
    assertEq(itemNFT.totalSupply(), 0);
    itemNFT.mint(ALICE, BRONZE_ARMOR, 1);
    assertEq(itemNFT.totalSupply(), 1);
    assertEq(itemNFT.totalSupply(BRONZE_ARMOR), 1);
  }

  function testAirdrop() public {
    itemNFT.airdrop(_addresses(address(this), ALICE), BRONZE_AXE, _uints(1, 2));
    assertEq(itemNFT.balanceOf(address(this), BRONZE_AXE), 1);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 2);

    itemNFT.airdrop(_addresses(ALICE), BRONZE_AXE, _uints(3));
    assertEq(itemNFT.balanceOf(address(this), BRONZE_AXE), 1);
    assertEq(itemNFT.balanceOf(ALICE, BRONZE_AXE), 5);

    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    itemNFT.airdrop(_addresses(ALICE), BRONZE_AXE, _uints(3));
  }

  function testIsApprovedForAllOverride() public {
    itemNFT.mint(address(this), BRONZE_AXE, 3);
    vm.prank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IERC1155Errors.ERC1155MissingApprovalForAll.selector, ALICE, address(this)));
    itemNFT.safeTransferFrom(address(this), ALICE, BRONZE_AXE, 1, "");

    itemNFT.setApproved(_addresses(ALICE), true);
    vm.prank(ALICE);
    itemNFT.safeTransferFrom(address(this), ALICE, BRONZE_AXE, 1, "");
  }

  function testNameAndSymbol() public {
    assertEq(itemNFT.name(), "Estfor Items (Beta)");
    assertEq(itemNFT.symbol(), "EK_IB");

    ItemNFT implementation = new ItemNFT();
    ItemNFT itemNFTNotBeta = ItemNFT(
      _deployUUPS(
        address(implementation),
        abi.encodeCall(ItemNFT.initialize, (address(royaltyReceiver), "ipfs://", adminAccess, false))
      )
    );
    assertEq(itemNFTNotBeta.name(), "Estfor Items");
    assertEq(itemNFTNotBeta.symbol(), "EK_I");
  }

  function testTransferOfItemsToManyDifferentUsersAtOnce() public {
    itemNFT.mint(address(this), TITANIUM_AXE, 2);
    itemNFT.mint(address(this), IRON_AXE, 3);
    itemNFT.mint(address(this), MITHRIL_AXE, 1);
    itemNFT.mint(address(this), ADAMANTINE_AXE, 4);
    itemNFT.mint(address(this), RUNITE_AXE, 3);
    itemNFT.mint(address(this), ORICHALCUM_AXE, 2);

    BulkTransferInfo[] memory infos = new BulkTransferInfo[](2);
    infos[0] = BulkTransferInfo({
      tokenIds: _uints(TITANIUM_AXE, RUNITE_AXE, ORICHALCUM_AXE),
      amounts: _uints(2, 1, 2),
      to: ALICE
    });
    infos[1] = BulkTransferInfo({tokenIds: _uints(IRON_AXE, ADAMANTINE_AXE), amounts: _uints(3, 4), to: DEV});
    itemNFT.safeBulkTransfer(infos);

    assertEq(itemNFT.balanceOfs(ALICE, _uint16s(TITANIUM_AXE, RUNITE_AXE, ORICHALCUM_AXE)), _uints(2, 1, 2));
    assertEq(itemNFT.balanceOfs(DEV, _uint16s(IRON_AXE, ADAMANTINE_AXE)), _uints(3, 4));
    assertEq(itemNFT.balanceOf(address(this), MITHRIL_AXE), 1);
  }
}
