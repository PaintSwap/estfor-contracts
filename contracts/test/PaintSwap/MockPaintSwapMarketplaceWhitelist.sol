//SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../../interfaces/IMarketplaceWhitelist.sol";

contract MockPaintSwapMarketplaceWhitelist is IMarketplaceWhitelist {
  mapping(address => bool) public whitelist;

  function setWhitelisted(address _nft, bool _whitelisted) external {
    whitelist[_nft] = _whitelisted;
  }

  function isWhitelisted(address _nft) external view override returns (bool) {
    return whitelist[_nft];
  }
}
