// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC165} from "@openzeppelin/contracts/interfaces/IERC165.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {Marketplace} from "../contracts/Marketplace.sol";
import {IMarketplace} from "../contracts/interfaces/IMarketplace.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {MockBrushToken} from "../contracts/test/external/MockBrushToken.sol";
import {TestMaliciousReentrancy} from "../contracts/test/TestMaliciousReentrancy.sol";

contract MarketplaceNFTMock is ERC1155, IERC2981 {
  address public immutable royaltyReceiver;
  IMarketplace public immutable marketplace;

  constructor(address receiver, IMarketplace marketplace_) ERC1155("") {
    royaltyReceiver = receiver;
    marketplace = marketplace_;
  }

  function mint(address to, uint256 id, uint256 amount) external {
    _mint(to, id, amount, "");
  }

  function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) {
    return (royaltyReceiver, (salePrice * 3) / 100);
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC1155, IERC165) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
    super._update(from, to, ids, values);
    if (from != address(0) && to != address(0)) {
      for (uint256 i; i < ids.length; ++i) {
        marketplace.contractCancel(from, address(this), ids[i]);
      }
    }
  }
}

contract MarketplaceTest is EstforTest {
  event Listed(
    uint256 indexed listingId,
    address indexed seller,
    address nft,
    uint256 tokenId,
    uint96 price,
    uint96 amount
  );
  event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint96 price, uint96 amount);
  event Cancelled(uint256 indexed listingId);

  address private constant CHARLIE = address(0xCA11E);
  address private constant ROYALTY_RECEIVER = address(0xBEEF);
  uint256 private constant TOKEN_ID = 1;
  uint96 private constant PRICE = 1 ether;

  Marketplace private marketplace;
  MarketplaceNFTMock private nft;

  function setUp() public {
    brush = new MockBrushToken();
    Marketplace implementation = new Marketplace();
    marketplace = Marketplace(
      _deployUUPS(
        address(implementation),
        abi.encodeCall(implementation.initialize, (IBrushToken(address(brush)), address(this)))
      )
    );
    nft = new MarketplaceNFTMock(ROYALTY_RECEIVER, marketplace);
    brush.mint(ALICE, 100 ether);
    nft.mint(BOB, TOKEN_ID, 20);
  }

  function _listingId(address seller, address token, uint256 tokenId) private pure returns (uint256) {
    return uint256(keccak256(abi.encodePacked(seller, token, tokenId)));
  }

  function _list(uint96 amount) private returns (uint256 listingId) {
    vm.prank(BOB);
    listingId = marketplace.list(address(nft), TOKEN_ID, PRICE, amount);
  }

  function _approveSale(address payer, uint256 amount) private {
    vm.prank(BOB);
    nft.setApprovalForAll(address(marketplace), true);
    vm.prank(payer);
    brush.approve(address(marketplace), amount);
  }

  function testAllowsListingAnItem() public {
    uint256 id = _listingId(BOB, address(nft), TOKEN_ID);
    vm.expectEmit(true, true, false, true, address(marketplace));
    emit Listed(id, BOB, address(nft), TOKEN_ID, PRICE, 1);
    vm.prank(BOB);
    assertEq(marketplace.list(address(nft), TOKEN_ID, PRICE, 1), id);
  }

  function testRevertsOnInvalidPrice() public {
    vm.expectRevert(Marketplace.InvalidPrice.selector);
    vm.prank(BOB);
    marketplace.list(address(nft), TOKEN_ID, 0, 1);
  }

  function testRevertsOnInvalidAmount() public {
    vm.expectRevert(Marketplace.InvalidAmount.selector);
    vm.prank(BOB);
    marketplace.list(address(nft), TOKEN_ID, PRICE, 0);
  }

  function testRevertsOnUnownedTokenId() public {
    vm.expectRevert(Marketplace.InvalidAmount.selector);
    vm.prank(ALICE);
    marketplace.list(address(nft), TOKEN_ID, PRICE, 1);
  }

  function testRevertsBuyingNonexistentListing() public {
    vm.expectRevert(Marketplace.ListingDoesNotExist.selector);
    vm.prank(BOB);
    marketplace.buy(1, PRICE, BOB);
  }

  function testRevertsCancellingNonexistentListing() public {
    vm.expectRevert(Marketplace.ListingDoesNotExist.selector);
    vm.prank(BOB);
    marketplace.cancel(1);
  }

  function testRevertsContractCancelFromNonNFTContract() public {
    _list(1);
    vm.expectRevert(Marketplace.NotNFTContract.selector);
    vm.prank(BOB);
    marketplace.contractCancel(BOB, address(nft), TOKEN_ID);
  }

  function testCanCancelListedItem() public {
    uint256 id = _list(1);
    vm.expectEmit(true, false, false, false, address(marketplace));
    emit Cancelled(id);
    vm.prank(BOB);
    marketplace.cancel(id);
  }

  function testRevertsCancellingNonOwnedListing() public {
    uint256 id = _list(1);
    vm.expectRevert(Marketplace.NotSeller.selector);
    vm.prank(ALICE);
    marketplace.cancel(id);
  }

  function testNFTContractCanCancelListedItem() public {
    uint256 id = _list(1);
    vm.expectEmit(true, false, false, false, address(marketplace));
    emit Cancelled(id);
    vm.prank(address(nft));
    marketplace.contractCancel(BOB, address(nft), TOKEN_ID);
  }

  function testNFTContractCanSilentlyCancelNonexistentListing() public {
    vm.prank(address(nft));
    marketplace.contractCancel(BOB, address(nft), TOKEN_ID);
  }

  function testCanBuyListedItemAndDistributesRoyalty() public {
    uint256 id = _list(1);
    _approveSale(ALICE, PRICE);
    uint256 bobBefore = brush.balanceOf(BOB);
    uint256 aliceBefore = brush.balanceOf(ALICE);
    uint256 royaltyBefore = brush.balanceOf(ROYALTY_RECEIVER);
    vm.expectEmit(true, true, true, true, address(marketplace));
    emit Sold(id, ALICE, BOB, PRICE, 1);
    vm.prank(ALICE);
    marketplace.buy(id, PRICE, ALICE);
    assertEq(nft.balanceOf(ALICE, TOKEN_ID), 1);
    assertEq(brush.balanceOf(ROYALTY_RECEIVER), royaltyBefore + (PRICE * 3) / 100);
    assertEq(brush.balanceOf(BOB), bobBefore + (PRICE * 97) / 100);
    assertEq(brush.balanceOf(ALICE), aliceBefore - PRICE);
  }

  function testRevertsOnPriceFrontrun() public {
    uint256 id = _list(1);
    _approveSale(ALICE, PRICE);
    vm.expectRevert(Marketplace.InvalidPrice.selector);
    vm.prank(ALICE);
    marketplace.buy(id, PRICE / 2, ALICE);
  }

  function testExtractsPaymentFromSenderNotReceiver() public {
    uint256 id = _list(1);
    _approveSale(ALICE, PRICE);
    uint256 bobBefore = brush.balanceOf(BOB);
    uint256 aliceBefore = brush.balanceOf(ALICE);
    vm.expectEmit(true, true, true, true, address(marketplace));
    emit Sold(id, ALICE, BOB, PRICE, 1);
    vm.prank(ALICE);
    marketplace.buy(id, PRICE, CHARLIE);
    assertEq(nft.balanceOf(CHARLIE, TOKEN_ID), 1);
    assertGt(brush.balanceOf(BOB), bobBefore);
    assertLt(brush.balanceOf(ALICE), aliceBefore);
    assertEq(brush.balanceOf(CHARLIE), 0);
  }

  function testRevertsOnAllReentrancyAttempts() public {
    TestMaliciousReentrancy attacker = new TestMaliciousReentrancy(address(marketplace));
    address attackerAddress = address(attacker);
    brush.mint(attackerAddress, 10 ether);
    uint256 id = _list(10);
    _approveSale(attackerAddress, PRICE);
    vm.expectRevert(Marketplace.ListingDoesNotExist.selector);
    vm.prank(attackerAddress);
    Marketplace(attackerAddress).buy(id, PRICE, attackerAddress);
  }

  function testCancelsListingAutomaticallyOnTransfer() public {
    uint256 id = _list(1);
    vm.expectEmit(true, false, false, false, address(marketplace));
    emit Cancelled(id);
    vm.prank(BOB);
    nft.safeTransferFrom(BOB, ALICE, TOKEN_ID, 1, "");
    assertEq(nft.balanceOf(ALICE, TOKEN_ID), 1);
    vm.expectRevert(Marketplace.ListingDoesNotExist.selector);
    vm.prank(BOB);
    marketplace.cancel(id);
  }
}
