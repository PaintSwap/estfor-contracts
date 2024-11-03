//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../interfaces/external/IMarketplaceWhitelist.sol";

contract MockPaintSwapMarketplaceWhitelist is IMarketplaceWhitelist {
  mapping(address => bool) public whitelist;

  function setWhitelisted(address nft, bool whitelisted) external {
    whitelist[nft] = whitelisted;
  }

  function isWhitelisted(address nft) external view override returns (bool) {
    return whitelist[nft];
  }
}
