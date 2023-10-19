// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMarketplaceWhitelist {
  function isWhitelisted(address nft) external view returns (bool);
}
