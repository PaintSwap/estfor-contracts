// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./interfaces/IBrushToken.sol";
import "./types.sol";
import "./items.sol";
import "./ItemNFT.sol";

// The contract allows items to be bought/sold
contract Shop is UUPSUpgradeable, OwnableUpgradeable, Multicall {
  event AddShopItem(ShopItem shopItem);
  event AddShopItems(ShopItem[] shopItems);
  event RemoveShopItem(uint16 tokenId);
  event Buy(address buyer, uint16 tokenId, uint quantity, uint price);
  event BuyBatch(address buyer, uint[] tokenIds, uint[] quantities, uint[] prices);
  event Sell(address seller, uint16 tokenId, uint quantity, uint price);
  event SellBatch(address seller, uint16[] tokenIds, uint[] quantities, uint[] prices);

  error LengthMismatch();
  error LengthEmpty();
  error ItemCannotBeBought();
  error NotEnoughBrush(uint brushNeeded, uint brushAvailable);
  error MinExpectedBrushNotReaced(uint totalBrush, uint minExpectedBrush);

  struct ShopItem {
    uint16 tokenId;
    uint128 price;
  }

  IBrushToken brush;
  ItemNFT itemNFT;
  mapping(uint itemId => uint price) public shopItems;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IBrushToken _brush) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    brush = _brush;
  }

  function getPriceForItem(uint16 _tokenId) public view returns (uint price) {
    uint totalBrush = brush.balanceOf(address(this));
    uint totalBrushForItem = totalBrush / itemNFT.uniqueItems();
    uint totalOfThisItem = itemNFT.itemBalances(_tokenId);
    // Needs to have a minimum of an item before any can be sold.
    return totalBrushForItem / totalOfThisItem;
  }

  function getPriceForItems(uint16[] calldata _tokenIds) external view returns (uint[] memory prices) {
    if (_tokenIds.length == 0) {
      return prices;
    }

    uint totalBrush = brush.balanceOf(address(this));
    uint totalBrushForItem = totalBrush / itemNFT.uniqueItems();

    prices = new uint[](_tokenIds.length);
    uint i;
    do {
      uint totalOfThisItem = itemNFT.itemBalances(_tokenIds[i]);
      if (totalOfThisItem < 100) {
        // Need to be a minimum of an item before any can be sold.
        prices[i] = 0;
      } else {
        prices[i] = totalBrushForItem / totalOfThisItem;
      }

      unchecked {
        ++i;
      }
    } while (i < prices.length);
  }

  // Buy simple items and XP boosts using brush
  function buy(uint16 _tokenId, uint _quantity) external {
    uint price = shopItems[_tokenId];
    if (price == 0) {
      revert ItemCannotBeBought();
    }
    // Pay
    brush.transferFrom(msg.sender, address(this), price);
    // Burn half, the rest goes into the pool for sellable items
    brush.burn(price / 2);

    itemNFT.mint(msg.sender, _tokenId, _quantity);
    emit Buy(msg.sender, _tokenId, _quantity, price);
  }

  function buyBatch(uint[] calldata _tokenIds, uint[] calldata _quantities) external {
    if (_tokenIds.length != _quantities.length) {
      revert LengthMismatch();
    }
    if (_tokenIds.length == 0) {
      revert LengthEmpty();
    }
    uint totalBrush;
    uint[] memory prices = new uint[](_tokenIds.length);
    for (uint i = 0; i < _tokenIds.length; ++i) {
      uint price = shopItems[uint16(_tokenIds[i])];
      if (price == 0) {
        revert ItemCannotBeBought();
      }
      totalBrush += price * _quantities[i];
      prices[i] = price;
    }

    // Pay
    brush.transferFrom(msg.sender, address(this), totalBrush);
    // Burn half, the rest goes into the pool for sellable items
    brush.burn(totalBrush / 2);

    itemNFT.mintBatch(msg.sender, _tokenIds, _quantities);
    emit BuyBatch(msg.sender, _tokenIds, _quantities, prices);
  }

  function sell(uint16 _tokenId, uint _quantity, uint _minExpectedBrush) public {
    uint brushPerToken = getPriceForItem(_tokenId);
    uint totalBrush = brushPerToken * _quantity;
    if (totalBrush < _minExpectedBrush) {
      revert MinExpectedBrushNotReaced(totalBrush, _minExpectedBrush);
    }
    itemNFT.burn(msg.sender, uint(_tokenId), _quantity);
    brush.transfer(msg.sender, totalBrush);
    emit Sell(msg.sender, _tokenId, _quantity, totalBrush);
  }

  function sellBatch(uint16[] calldata _tokenIds, uint[] calldata _quantities, uint _minExpectedBrush) external {
    if (_tokenIds.length != _quantities.length) {
      revert LengthMismatch();
    }
    if (_tokenIds.length == 0) {
      revert LengthEmpty();
    }
    uint totalBrush;
    uint[] memory prices = new uint[](_tokenIds.length);
    for (uint i = 0; i < _tokenIds.length; ++i) {
      uint brushPerToken = getPriceForItem(_tokenIds[i]);
      totalBrush += brushPerToken * _quantities[i];
      itemNFT.burn(msg.sender, uint(_tokenIds[i]), _quantities[i]);
      prices[i] = brushPerToken;
    }
    if (totalBrush < _minExpectedBrush) {
      revert MinExpectedBrushNotReaced(totalBrush, _minExpectedBrush);
    }
    brush.transfer(msg.sender, totalBrush);
    emit SellBatch(msg.sender, _tokenIds, _quantities, prices);
  }

  // Spend brush to buy some things from the shop
  function addBuyableItem(ShopItem calldata _shopItem) external onlyOwner {
    shopItems[_shopItem.tokenId] = _shopItem.price;
    emit AddShopItem(_shopItem);
  }

  function addBuyableItems(ShopItem[] calldata _shopItems) external onlyOwner {
    if (_shopItems.length == 0) {
      revert LengthEmpty();
    }
    uint i;
    do {
      shopItems[_shopItems[i].tokenId] = _shopItems[i].price;
      unchecked {
        ++i;
      }
    } while (i < _shopItems.length);
    emit AddShopItems(_shopItems);
  }

  function removeItem(uint16 _tokenId) external onlyOwner {
    delete shopItems[_tokenId];
    emit RemoveShopItem(_tokenId);
  }

  function setItemNFT(ItemNFT _itemNFT) external onlyOwner {
    itemNFT = _itemNFT;
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
