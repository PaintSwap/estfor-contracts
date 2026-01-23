// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMarketplaceNFT} from "./IMarketplaceNFT.sol";

interface IMarketplace {
  struct Listing {
    /* SLOT 0 */
    address seller;
    uint96 price;       // Price in custom ERC20

    /* SLOT 1 */
    address nftContract; // Can be PlayerNFT or PetNFT
    uint96 amount;  // Amount of tokens listed (will be 1 for PlayerNFT and PetNFT)

    /* SLOT 2 */
    uint256 tokenId;
  }

  event Listed(uint256 indexed listingId, address indexed seller, address nft, uint256 tokenId, uint96 price, uint96 amount);
  event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint96 price, uint96 amount);
  event Cancelled(uint256 indexed listingId);

  function list(address nftContract, uint256 tokenId, uint96 price, uint96 amount) external returns (uint256);
  function buy(uint256 listingId, uint96 expectedPrice, address to) external;
  function cancel(uint256 listingId) external;
  function contractCancel(address seller, address nftContract, uint256 tokenId) external;
}