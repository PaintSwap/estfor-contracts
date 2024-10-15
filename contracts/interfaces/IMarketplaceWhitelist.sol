// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IMarketplaceWhitelist {
  function isWhitelisted(address nft) external view returns (bool);
}
