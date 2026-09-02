// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ShopReconciliationFixture {
  struct ShopItem {
    uint16 tokenId;
    uint128 price;
  }

  struct TokenInfo {
    uint80 allocationRemaining;
    uint80 price;
    uint40 checkpointTimestamp;
    bool unsellable;
  }

  struct ShopItemState {
    uint16 tokenId;
    uint256 price;
    bool unsellable;
  }

  address public immutable owner;
  mapping(uint16 tokenId => uint256 price) public shopItems;
  mapping(uint16 tokenId => TokenInfo info) public tokenInfos;

  constructor(address owner_) {
    owner = owner_;
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "owner");
    _;
  }

  function addBuyableItems(ShopItem[] calldata items) external onlyOwner {
    for (uint256 i; i < items.length; ++i) {
      shopItems[items[i].tokenId] = items[i].price;
    }
  }

  function editItems(ShopItem[] calldata items) external onlyOwner {
    for (uint256 i; i < items.length; ++i) {
      shopItems[items[i].tokenId] = items[i].price;
    }
  }

  function removeItems(uint16[] calldata tokenIds) external onlyOwner {
    for (uint256 i; i < tokenIds.length; ++i) {
      delete shopItems[tokenIds[i]];
    }
  }

  function addUnsellableItems(uint16[] calldata tokenIds) external onlyOwner {
    for (uint256 i; i < tokenIds.length; ++i) {
      tokenInfos[tokenIds[i]].unsellable = true;
    }
  }

  function removeUnsellableItems(uint16[] calldata tokenIds) external onlyOwner {
    for (uint256 i; i < tokenIds.length; ++i) {
      tokenInfos[tokenIds[i]].unsellable = false;
    }
  }

  function getShopItemStates(uint256 startTokenId, uint256 endTokenId) external view returns (ShopItemState[] memory) {
    uint256 count;
    for (uint256 tokenId = startTokenId; tokenId < endTokenId; ++tokenId) {
      if (shopItems[uint16(tokenId)] != 0 || tokenInfos[uint16(tokenId)].unsellable) ++count;
    }
    ShopItemState[] memory states = new ShopItemState[](count);
    uint256 index;
    for (uint256 tokenId = startTokenId; tokenId < endTokenId; ++tokenId) {
      uint256 price = shopItems[uint16(tokenId)];
      bool unsellable = tokenInfos[uint16(tokenId)].unsellable;
      if (price != 0 || unsellable) states[index++] = ShopItemState(uint16(tokenId), price, unsellable);
    }
    return states;
  }
}
