// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ShopV1} from "./old/ShopV1.sol";

/// @custom:oz-upgrades-from ShopV1
/// @custom:oz-upgrades-unsafe-allow missing-initializer
contract Shop is ShopV1 {
  uint256 public constant MAX_STATE_READ_LENGTH = 1024;

  struct ShopItemState {
    uint16 tokenId;
    uint256 price;
    bool unsellable;
  }

  error InvalidStateReadRange();

  function getShopItemStates(uint256 startTokenId, uint256 endTokenId) external view returns (ShopItemState[] memory) {
    if (
      startTokenId >= endTokenId ||
      endTokenId > uint256(type(uint16).max) + 1 ||
      endTokenId - startTokenId > MAX_STATE_READ_LENGTH
    ) revert InvalidStateReadRange();

    uint256 count;
    for (uint256 tokenId = startTokenId; tokenId < endTokenId; ++tokenId) {
      uint256 price = this.shopItems(uint16(tokenId));
      TokenInfo memory tokenInfo = this.tokenInfos(uint16(tokenId));
      if (price != 0 || tokenInfo.unsellable) ++count;
    }

    ShopItemState[] memory states = new ShopItemState[](count);
    uint256 index;
    for (uint256 tokenId = startTokenId; tokenId < endTokenId; ++tokenId) {
      uint256 price = this.shopItems(uint16(tokenId));
      TokenInfo memory tokenInfo = this.tokenInfos(uint16(tokenId));
      if (price != 0 || tokenInfo.unsellable)
        states[index++] = ShopItemState(uint16(tokenId), price, tokenInfo.unsellable);
    }
    return states;
  }
}
