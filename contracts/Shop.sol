// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IItemNFT} from "./interfaces/IItemNFT.sol";

// The contract allows items to be bought/sold
contract Shop is UUPSUpgradeable, OwnableUpgradeable {
  using UnsafeMath for U256;
  using UnsafeMath for uint40;
  using UnsafeMath for uint80;
  using UnsafeMath for uint256;

  event AddShopItems(ShopItem[] shopItems);
  event EditShopItems(ShopItem[] shopItems);
  event RemoveShopItems(uint16[] tokenId);
  event Buy(address buyer, address to, uint256 tokenId, uint256 quantity, uint256 price);
  event BuyBatch(address buyer, address to, uint256[] tokenIds, uint256[] quantities, uint256[] prices);
  event Sell(address seller, uint256 tokenId, uint256 quantity, uint256 price);
  event SellBatch(address seller, uint256[] tokenIds, uint256[] quantities, uint256[] prices);
  event NewAllocation(uint16 tokenId, uint256 allocation);
  event AddUnsellableItems(uint16[] tokenIds);
  event RemoveUnsellableItems(uint16[] tokenIds);
  event SetMinItemQuantityBeforeSellsAllowed(uint256 minItemQuantityBeforeSellsAllowed);

  error LengthMismatch();
  error LengthEmpty();
  error ItemCannotBeBought();
  error ItemDoesNotExist();
  error ShopItemDoesNotExist();
  error ShopItemAlreadyExists();
  error PriceCannotBeZero();
  error NotEnoughBrush(uint256 brushNeeded, uint256 brushAvailable);
  error MinExpectedBrushNotReached(uint256 totalBrush, uint256 minExpectedBrush);
  error LiquidatePriceIsHigherThanShop(uint256 tokenId);
  error SellingTooQuicklyAfterItemIntroduction();
  error NotEnoughAllocationRemaining(uint256 tokenId, uint256 totalSold, uint256 allocationRemaining);
  error AlreadyUnsellable();
  error AlreadySellable();
  error ItemNotSellable(uint256 tokenId);

  struct ShopItem {
    uint16 tokenId;
    uint128 price;
  }

  struct TokenInfo {
    uint80 allocationRemaining;
    uint80 price;
    uint40 checkpointTimestamp; // 00:00 UTC
    bool unsellable;
  }

  uint256 public constant SELLING_CUTOFF_DURATION = 2 days;

  mapping(uint256 tokenId => TokenInfo tokenInfo) private _tokenInfos;

  IBrushToken private _brush;
  IItemNFT private _itemNFT;
  uint16 private _numUnsellableItems;
  uint24 private _minItemQuantityBeforeSellsAllowed;
  address private _dev;
  mapping(uint256 itemId => uint256 price) private _shopItems;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IBrushToken brush, address dev) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    _brush = brush;
    _dev = dev;

    setMinItemQuantityBeforeSellsAllowed(500);
  }

  function getMinItemQuantityBeforeSellsAllowed() external view returns (uint24) {
    return _minItemQuantityBeforeSellsAllowed;
  }

  function liquidatePrice(uint16 tokenId) public view returns (uint80 price) {
    uint256 _totalBrush = _brush.balanceOf(address(this));
    uint256 _totalBrushForItem = _totalBrush / (_itemNFT.totalSupply() - _numUnsellableItems);
    return _liquidatePrice(tokenId, _totalBrushForItem);
  }

  function liquidatePrices(uint16[] calldata tokenIds) external view returns (uint256[] memory prices) {
    U256 _iter = tokenIds.length.asU256();
    if (_iter.eq(0)) {
      return prices;
    }

    uint256 _totalBrush = _brush.balanceOf(address(this));
    uint256 _totalBrushForItem = _totalBrush / (_itemNFT.totalSupply() - _numUnsellableItems);

    prices = new uint256[](_iter.asUint256());
    while (_iter.neq(0)) {
      _iter = _iter.dec();
      uint256 i = _iter.asUint256();
      prices[i] = _liquidatePrice(tokenIds[i], _totalBrushForItem);
    }
  }

  // Buy simple items and XP boosts using brush
  function buy(address to, uint16 tokenId, uint256 quantity) external {
    uint256 _price = _shopItems[tokenId];
    if (_price == 0) {
      revert ItemCannotBeBought();
    }
    uint256 brushCost = _price * quantity;
    // Pay
    _brush.transferFrom(msg.sender, address(this), brushCost);
    uint256 _quarterCost = brushCost / 4;
    // Send 1 quarter to the dev address
    _brush.transfer(_dev, _quarterCost);
    // Burn 1 quarter
    _brush.burn(_quarterCost);

    _itemNFT.mint(to, tokenId, quantity);
    emit Buy(msg.sender, to, tokenId, quantity, _price);
  }

  function buyBatch(address to, uint256[] calldata tokenIds, uint256[] calldata quantities) external {
    U256 _iter = tokenIds.length.asU256();
    if (_iter.eq(0)) {
      revert LengthEmpty();
    }
    if (_iter.neq(quantities.length)) {
      revert LengthMismatch();
    }
    uint256 _brushCost;
    uint256[] memory _prices = new uint256[](_iter.asUint256());
    while (_iter.neq(0)) {
      _iter = _iter.dec();
      uint256 i = _iter.asUint256();
      uint256 price = _shopItems[uint16(tokenIds[i])];
      if (price == 0) {
        revert ItemCannotBeBought();
      }
      _brushCost += price * quantities[i];
      _prices[i] = price;
    }

    // Pay
    _brush.transferFrom(msg.sender, address(this), _brushCost);
    uint256 quarterCost = _brushCost / 4;
    // Send 1 quarter to the dev address
    _brush.transfer(_dev, quarterCost);
    // Burn 1 quarter
    _brush.burn(quarterCost);

    _itemNFT.mintBatch(to, tokenIds, quantities);
    emit BuyBatch(msg.sender, to, tokenIds, quantities, _prices);
  }

  function sell(uint16 tokenId, uint256 quantity, uint256 minExpectedBrush) external {
    uint256 price = liquidatePrice(tokenId);
    uint256 totalBrush = price * quantity;
    _sell(tokenId, quantity, price);
    if (totalBrush < minExpectedBrush) {
      revert MinExpectedBrushNotReached(totalBrush, minExpectedBrush);
    }
    _brush.transfer(msg.sender, totalBrush);
    _itemNFT.burn(msg.sender, tokenId, quantity);
    emit Sell(msg.sender, tokenId, quantity, price);
  }

  function sellBatch(uint256[] calldata tokenIds, uint256[] calldata quantities, uint256 minExpectedBrush) external {
    U256 iter = tokenIds.length.asU256();
    if (iter.eq(0)) {
      revert LengthEmpty();
    }
    if (iter.neq(quantities.length)) {
      revert LengthMismatch();
    }
    U256 totalBrush;
    uint256[] memory prices = new uint256[](iter.asUint256());
    do {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      U256 sellPrice = liquidatePrice(uint16(tokenIds[i])).asU256();
      totalBrush = totalBrush + (sellPrice * quantities[i].asU256());
      prices[i] = sellPrice.asUint256();
      _sell(tokenIds[i], quantities[i], prices[i]);
    } while (iter.neq(0));
    if (totalBrush.lt(minExpectedBrush)) {
      revert MinExpectedBrushNotReached(totalBrush.asUint256(), minExpectedBrush);
    }
    _brush.transfer(msg.sender, totalBrush.asUint256());
    _itemNFT.burnBatch(msg.sender, tokenIds, quantities);
    emit SellBatch(msg.sender, tokenIds, quantities, prices);
  }

  // Does not burn!
  function _sell(uint256 _tokenId, uint256 _quantity, uint256 _sellPrice) private {
    uint256 price = _shopItems[_tokenId];
    if (price != 0 && price < _sellPrice) {
      revert LiquidatePriceIsHigherThanShop(_tokenId);
    }

    // 48 hour period of no selling for an item
    if (_itemNFT.timestampFirstMint(_tokenId).add(SELLING_CUTOFF_DURATION) > block.timestamp) {
      revert SellingTooQuicklyAfterItemIntroduction();
    }

    // Check if tokenInfo checkpoint is older than 24 hours
    TokenInfo storage tokenInfo = _tokenInfos[_tokenId];
    if (tokenInfo.unsellable) {
      revert ItemNotSellable(_tokenId);
    }

    uint256 allocationRemaining;
    if (_hasNewDailyData(tokenInfo.checkpointTimestamp)) {
      // New day, reset max allocation can be sold
      allocationRemaining = uint80(_brush.balanceOf(address(this)) / (_itemNFT.totalSupply() - _numUnsellableItems));
      tokenInfo.checkpointTimestamp = uint40(block.timestamp.div(1 days).mul(1 days));
      tokenInfo.price = uint80(_sellPrice);
      emit NewAllocation(uint16(_tokenId), allocationRemaining);
    } else {
      allocationRemaining = tokenInfo.allocationRemaining;
    }

    uint256 totalSold = _quantity * _sellPrice;
    if (allocationRemaining < totalSold) {
      revert NotEnoughAllocationRemaining(_tokenId, totalSold, allocationRemaining);
    }
    tokenInfo.allocationRemaining = uint80(allocationRemaining - totalSold);
  }

  function _liquidatePrice(uint16 _tokenId, uint256 _totalBrushPerItem) private view returns (uint80 price) {
    TokenInfo storage tokenInfo = _tokenInfos[_tokenId];
    uint256 totalOfThisItem = _itemNFT.itemBalances(_tokenId);
    if (_hasNewDailyData(tokenInfo.checkpointTimestamp)) {
      if (totalOfThisItem != 0) {
        price = uint80(_totalBrushPerItem / totalOfThisItem);
      }
    } else {
      price = uint80(tokenInfo.price);
    }

    if (totalOfThisItem < _minItemQuantityBeforeSellsAllowed || tokenInfo.unsellable) {
      // Needs to have a minimum of an item before any can be sold, and the item must be sellable
      price = 0;
    }
  }

  function _addBuyableItem(ShopItem calldata buyableItem) private {
    // Check item exists
    if (!_itemNFT.exists(buyableItem.tokenId)) {
      revert ItemDoesNotExist();
    }
    if (_shopItems[buyableItem.tokenId] != 0) {
      revert ShopItemAlreadyExists();
    }
    if (buyableItem.price == 0) {
      revert PriceCannotBeZero();
    }
    _shopItems[buyableItem.tokenId] = buyableItem.price;
  }

  function _hasNewDailyData(uint256 checkpointTimestamp) private view returns (bool) {
    return (block.timestamp.div(1 days)).mul(1 days) >= checkpointTimestamp.add(1 days);
  }

  function addBuyableItems(ShopItem[] calldata buyableItems) external onlyOwner {
    for (uint256 i; i < buyableItems.length; i++) {
      _addBuyableItem(buyableItems[i]);
    }
    emit AddShopItems(buyableItems);
  }

  function editItems(ShopItem[] calldata itemsToEdit) external onlyOwner {
    for (uint256 i; i < itemsToEdit.length; i++) {
      if (_shopItems[itemsToEdit[i].tokenId] == 0) {
        revert ShopItemDoesNotExist();
      }
      _shopItems[itemsToEdit[i].tokenId] = itemsToEdit[i].price;
    }
    emit EditShopItems(itemsToEdit);
  }

  function removeItems(uint16[] calldata tokenIds) external onlyOwner {
    for (uint256 i; i < tokenIds.length; i++) {
      uint16 tokenId = tokenIds[i];
      if (_shopItems[tokenId] == 0) {
        revert ShopItemDoesNotExist();
      }
      delete _shopItems[tokenId];
    }
    emit RemoveShopItems(tokenIds);
  }

  function addUnsellableItems(uint16[] calldata itemTokenIds) external onlyOwner {
    for (uint256 i; i < itemTokenIds.length; i++) {
      if (_tokenInfos[itemTokenIds[i]].unsellable) {
        revert AlreadyUnsellable();
      }
      if (!_itemNFT.exists(itemTokenIds[i])) {
        revert ItemDoesNotExist();
      }
      _tokenInfos[itemTokenIds[i]].unsellable = true;
    }
    _numUnsellableItems += uint16(itemTokenIds.length);
    emit AddUnsellableItems(itemTokenIds);
  }

  function removeUnsellableItems(uint16[] calldata itemTokenIds) external onlyOwner {
    for (uint256 i; i < itemTokenIds.length; i++) {
      if (!_tokenInfos[itemTokenIds[i]].unsellable) {
        revert AlreadySellable();
      }
      _tokenInfos[itemTokenIds[i]].unsellable = false;
    }
    _numUnsellableItems -= uint16(itemTokenIds.length);
    emit RemoveUnsellableItems(itemTokenIds);
  }

  function setItemNFT(IItemNFT itemNFT) external onlyOwner {
    _itemNFT = itemNFT;
  }

  function setMinItemQuantityBeforeSellsAllowed(uint24 minItemQuantityBeforeSellsAllowed) public onlyOwner {
    _minItemQuantityBeforeSellsAllowed = minItemQuantityBeforeSellsAllowed;
    emit SetMinItemQuantityBeforeSellsAllowed(minItemQuantityBeforeSellsAllowed);
  }

  // getters

  function tokenInfos(uint16 tokenId) external view returns (TokenInfo memory tokenInfo) {
    return _tokenInfos[tokenId];
  }

  function shopItems(uint16 tokenId) external view returns (uint256 price) {
    return _shopItems[tokenId];
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
