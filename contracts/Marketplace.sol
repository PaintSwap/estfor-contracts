// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IMarketplace} from "./interfaces/IMarketplace.sol";
import {IMarketplaceNFT} from "./interfaces/IMarketplaceNFT.sol";
import {IBrushToken} from "./interfaces/external/IBrushToken.sol";

contract Marketplace is UUPSUpgradeable, OwnableUpgradeable, IMarketplace {
  error NotSeller();
  error NotNFTContract();
  error ListingDoesNotExist();
  error InvalidPrice();
  error InvalidAmount();
  error InvalidNFTContract();

  mapping(uint256 => IMarketplace.Listing) private _listings;
  IBrushToken private _brush;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IBrushToken brushTokenAddress, address owner) public initializer {
    __Ownable_init(owner);
    __UUPSUpgradeable_init();
    _brush = brushTokenAddress;
  }

  function list(
    address nftContract, 
    uint256 tokenId, 
    uint96 price,
    uint96 amount
  ) external returns (uint256 listingId) {
    // 1. Basic Validation
    if (price == 0) revert InvalidPrice();
    require(IMarketplaceNFT(nftContract).supportsInterface(type(IERC1155).interfaceId), InvalidNFTContract());
    require(amount != 0 && IMarketplaceNFT(nftContract).balanceOf(msg.sender, tokenId) >= amount, InvalidAmount());

    // 2. Generate Deterministic ID
    // We use abi.encodePacked because the types are fixed-length (saves gas over abi.encode)
    listingId = uint256(
      keccak256(abi.encodePacked(msg.sender, nftContract, tokenId))
    );

    // 3. Storage Reference
    IMarketplace.Listing storage listing = _listings[listingId];

    listing.seller = msg.sender;
    listing.nftContract = nftContract;
    listing.tokenId = tokenId;
    listing.price = price;
    listing.amount = amount;

    emit Listed(listingId, msg.sender, nftContract, tokenId, price, amount);
  }

  function buy(uint256 listingId, uint96 expectedPrice, address to) external {
    // 1. Load listing data
    IMarketplace.Listing storage listing = _listings[listingId];

    // 2. Cache values to memory to save SLOAD gas
    address actualSeller = listing.seller;
    uint96 price = listing.price;
    uint96 amount = listing.amount;
    uint256 tokenId = listing.tokenId;
    address nftContract = address(listing.nftContract);

    // 3. Validation
    require(actualSeller != address(0), ListingDoesNotExist());
    require(price == expectedPrice, InvalidPrice());
    
    // 4. CEI Pattern: Delete the listing BEFORE transferring funds/NFT
    // This provides the gas refund and prevents re-entrancy issues
    delete _listings[listingId];

    uint96 sellerReceives = price;

    // 5. Payment Transfer
    if (IMarketplaceNFT(nftContract).supportsInterface(type(IERC2981).interfaceId)) {
      (address receiver, uint256 royaltyAmount) = IMarketplaceNFT(nftContract).royaltyInfo(tokenId, price);

      if (receiver != address(0) && royaltyAmount > 0) {
        _brush.transferFrom(msg.sender, receiver, royaltyAmount);
        sellerReceives = price - uint96(royaltyAmount);
      }
    }
    
    _brush.transferFrom(msg.sender, actualSeller, sellerReceives);

    // 6. NFT Transfer
    // The Marketplace must be an approved operator for the seller
    IMarketplaceNFT(nftContract).safeTransferFrom(
      actualSeller,
      to,
      tokenId,
      amount,
      ""
    );

    emit Sold(listingId, msg.sender, actualSeller, price, amount);
  }

  function cancel(uint256 listingId) external {
    IMarketplace.Listing storage listing = _listings[listingId];
    require(listing.seller != address(0), ListingDoesNotExist()); // Prevents double deletes
    require(listing.seller == msg.sender, NotSeller());
    delete _listings[listingId];
    emit Cancelled(listingId);
  }

  function contractCancel(address seller, address nftContract, uint256 tokenId) external {
    uint256 listingId = uint256(
      keccak256(abi.encodePacked(seller, nftContract, tokenId))
    );
    IMarketplace.Listing storage listing = _listings[listingId];
    if (listing.seller == address(0)) return; // Prevents double deletes (no error)
    require(listing.nftContract == msg.sender, NotNFTContract());
    delete _listings[listingId];
    emit Cancelled(listingId);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}