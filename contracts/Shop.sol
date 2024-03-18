// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {ItemNFT} from "./ItemNFT.sol";

// solhint-disable-next-line no-global-import
import "./globals/items.sol";

// The contract allows items to be bought/sold
contract Shop is UUPSUpgradeable, OwnableUpgradeable, Multicall {
  using UnsafeMath for U256;
  using UnsafeMath for uint40;
  using UnsafeMath for uint80;
  using UnsafeMath for uint256;

  event AddShopItem(ShopItem shopItem);
  event AddShopItems(ShopItem[] shopItems);
  event EditShopItems(ShopItem[] shopItems);
  event RemoveShopItem(uint16 tokenId);
  event Buy(address buyer, address to, uint tokenId, uint quantity, uint price);
  event BuyBatch(address buyer, address to, uint[] tokenIds, uint[] quantities, uint[] prices);
  event Sell(address seller, uint tokenId, uint quantity, uint price);
  event SellBatch(address seller, uint[] tokenIds, uint[] quantities, uint[] prices);
  event NewAllocation(uint16 tokenId, uint allocation);

  error LengthMismatch();
  error LengthEmpty();
  error ItemCannotBeBought();
  error ItemDoesNotExist();
  error ShopItemDoesNotExist();
  error ShopItemAlreadyExists();
  error PriceCannotBeZero();
  error NotEnoughBrush(uint brushNeeded, uint brushAvailable);
  error MinExpectedBrushNotReached(uint totalBrush, uint minExpectedBrush);
  error LiquidatePriceIsHigherThanShop(uint tokenId);
  error SellingTooQuicklyAfterItemIntroduction();
  error NotEnoughAllocationRemaining(uint tokenId, uint totalSold, uint allocationRemaining);

  struct ShopItem {
    uint16 tokenId;
    uint128 price;
  }

  uint public constant SELLING_CUTOFF_DURATION = 2 days;

  struct TokenAllocation {
    uint80 allocationRemaining;
    uint80 price;
    uint40 checkpointTimestamp; // 00:00 UTC
  }

  mapping(uint tokenId => TokenAllocation) public tokenAllocations;

  IBrushToken public brush;
  ItemNFT public itemNFT;
  address public dev;
  mapping(uint itemId => uint price) public shopItems;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IBrushToken _brush, address _dev) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    brush = _brush;
    dev = _dev;
  }

  function liquidatePrice(uint16 _tokenId) public view returns (uint80 price) {
    uint totalBrush = brush.balanceOf(address(this));
    uint totalBrushForItem = totalBrush / itemNFT.totalSupply();
    return _liquidatePrice(_tokenId, totalBrushForItem);
  }

  function liquidatePrices(uint16[] calldata _tokenIds) external view returns (uint[] memory prices) {
    U256 iter = _tokenIds.length.asU256();
    if (iter.eq(0)) {
      return prices;
    }

    uint totalBrush = brush.balanceOf(address(this));
    uint totalBrushForItem = totalBrush / itemNFT.totalSupply();

    prices = new uint[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      prices[i] = _liquidatePrice(_tokenIds[i], totalBrushForItem);
    }
  }

  // Buy simple items and XP boosts using brush
  function buy(address _to, uint16 _tokenId, uint _quantity) external {
    uint price = shopItems[_tokenId];
    if (price == 0) {
      revert ItemCannotBeBought();
    }
    uint brushCost = price * _quantity;
    // Pay
    brush.transferFrom(msg.sender, address(this), brushCost);
    uint quarterCost = brushCost / 4;
    // Send 1 quarter to the dev address
    brush.transfer(dev, quarterCost);
    // Burn 1 quarter
    brush.burn(quarterCost);

    itemNFT.mint(_to, _tokenId, _quantity);
    emit Buy(msg.sender, _to, _tokenId, _quantity, price);
  }

  function buyBatch(address _to, uint[] calldata _tokenIds, uint[] calldata _quantities) external {
    U256 iter = _tokenIds.length.asU256();
    if (iter.eq(0)) {
      revert LengthEmpty();
    }
    if (iter.neq(_quantities.length)) {
      revert LengthMismatch();
    }
    uint brushCost;
    uint[] memory prices = new uint[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      uint price = shopItems[uint16(_tokenIds[i])];
      if (price == 0) {
        revert ItemCannotBeBought();
      }
      brushCost += price * _quantities[i];
      prices[i] = price;
    }

    // Pay
    brush.transferFrom(msg.sender, address(this), brushCost);
    uint quarterCost = brushCost / 4;
    // Send 1 quarter to the dev address
    brush.transfer(dev, quarterCost);
    // Burn 1 quarter
    brush.burn(quarterCost);

    itemNFT.mintBatch(_to, _tokenIds, _quantities);
    emit BuyBatch(msg.sender, _to, _tokenIds, _quantities, prices);
  }

  function sell(uint16 _tokenId, uint _quantity, uint _minExpectedBrush) external {
    uint price = liquidatePrice(_tokenId);
    uint totalBrush = price * _quantity;
    if (totalBrush < _minExpectedBrush) {
      revert MinExpectedBrushNotReached(totalBrush, _minExpectedBrush);
    }
    _sell(_tokenId, _quantity, price);
    brush.transfer(msg.sender, totalBrush);
    emit Sell(msg.sender, _tokenId, _quantity, price);
  }

  function sellBatch(uint[] calldata _tokenIds, uint[] calldata _quantities, uint _minExpectedBrush) external {
    U256 iter = _tokenIds.length.asU256();
    if (iter.eq(0)) {
      revert LengthEmpty();
    }
    if (iter.neq(_quantities.length)) {
      revert LengthMismatch();
    }
    U256 totalBrush;
    uint[] memory prices = new uint[](iter.asUint256());
    do {
      iter = iter.dec();
      uint i = iter.asUint256();
      U256 sellPrice = liquidatePrice(uint16(_tokenIds[i])).asU256();
      totalBrush = totalBrush + (sellPrice * _quantities[i].asU256());
      prices[i] = sellPrice.asUint256();
      _sell(_tokenIds[i], _quantities[i], prices[i]);
    } while (iter.neq(0));
    if (totalBrush.lt(_minExpectedBrush)) {
      revert MinExpectedBrushNotReached(totalBrush.asUint256(), _minExpectedBrush);
    }
    brush.transfer(msg.sender, totalBrush.asUint256());
    emit SellBatch(msg.sender, _tokenIds, _quantities, prices);
  }

  function _sell(uint _tokenId, uint _quantity, uint _sellPrice) private {
    uint price = shopItems[_tokenId];
    if (price != 0 && price < _sellPrice) {
      revert LiquidatePriceIsHigherThanShop(_tokenId);
    }

    // 48 hour period of no selling for an item
    if (itemNFT.timestampFirstMint(_tokenId).add(SELLING_CUTOFF_DURATION) > block.timestamp) {
      revert SellingTooQuicklyAfterItemIntroduction();
    }

    // Check if tokenAllocation checkpoint is older than 24 hours
    TokenAllocation storage tokenAllocation = tokenAllocations[_tokenId];
    uint allocationRemaining;
    if (_hasNewDailyData(tokenAllocation.checkpointTimestamp)) {
      // New day, reset max allocation can be sold
      allocationRemaining = uint80(brush.balanceOf(address(this)) / itemNFT.totalSupply());
      tokenAllocation.checkpointTimestamp = uint40(block.timestamp.div(1 days).mul(1 days));
      tokenAllocation.price = uint80(_sellPrice);
      emit NewAllocation(uint16(_tokenId), allocationRemaining);
    } else {
      allocationRemaining = tokenAllocation.allocationRemaining;
    }

    uint totalSold = _quantity * _sellPrice;
    if (allocationRemaining < totalSold) {
      revert NotEnoughAllocationRemaining(_tokenId, totalSold, allocationRemaining);
    }
    tokenAllocation.allocationRemaining = uint80(allocationRemaining - totalSold);
    itemNFT.burn(msg.sender, _tokenId, _quantity);
  }

  function _liquidatePrice(uint16 _tokenId, uint _totalBrushPerItem) private view returns (uint80 price) {
    TokenAllocation storage tokenAllocation = tokenAllocations[_tokenId];
    uint totalOfThisItem = itemNFT.itemBalances(_tokenId);
    if (_hasNewDailyData(tokenAllocation.checkpointTimestamp)) {
      if (totalOfThisItem != 0) {
        price = uint80(_totalBrushPerItem / totalOfThisItem);
      }
    } else {
      price = uint80(tokenAllocation.price);
    }

    if (totalOfThisItem < 100) {
      // Needs to have a minimum of an item before any can be sold.
      price = 0;
    }
  }

  function _addBuyableItem(ShopItem calldata _shopItem) private {
    // Check item exists
    if (!itemNFT.exists(_shopItem.tokenId)) {
      revert ItemDoesNotExist();
    }
    if (shopItems[_shopItem.tokenId] != 0) {
      revert ShopItemAlreadyExists();
    }
    if (_shopItem.price == 0) {
      revert PriceCannotBeZero();
    }
    shopItems[_shopItem.tokenId] = _shopItem.price;
  }

  function _hasNewDailyData(uint checkpointTimestamp) private view returns (bool) {
    return (block.timestamp / 1 days) * 1 days >= checkpointTimestamp.add(1 days);
  }

  // Spend brush to buy some things from the shop
  function addBuyableItem(ShopItem calldata _shopItem) external onlyOwner {
    _addBuyableItem(_shopItem);
    emit AddShopItem(_shopItem);
  }

  function addBuyableItems(ShopItem[] calldata _shopItems) external onlyOwner {
    U256 iter = _shopItems.length.asU256();
    if (iter.eq(0)) {
      revert LengthEmpty();
    }
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      _addBuyableItem(_shopItems[i]);
    }
    emit AddShopItems(_shopItems);
  }

  function editItems(ShopItem[] calldata _shopItems) external onlyOwner {
    U256 bounds = _shopItems.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      uint i = iter.asUint256();
      if (shopItems[_shopItems[i].tokenId] == 0) {
        revert ShopItemDoesNotExist();
      }
      shopItems[_shopItems[i].tokenId] = _shopItems[i].price;
    }
    emit EditShopItems(_shopItems);
  }

  function removeItem(uint16 _tokenId) external onlyOwner {
    if (shopItems[_tokenId] == 0) {
      revert ShopItemDoesNotExist();
    }
    delete shopItems[_tokenId];
    emit RemoveShopItem(_tokenId);
  }

  function setItemNFT(ItemNFT _itemNFT) external onlyOwner {
    itemNFT = _itemNFT;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
