// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {Treasury} from "./Treasury.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IItemNFT} from "./interfaces/IItemNFT.sol";

// The contract allows items to be bought/sold
contract Shop is UUPSUpgradeable, OwnableUpgradeable {
  event AddShopItems(ShopItem[] shopItems);
  event EditShopItems(ShopItem[] shopItems);
  event RemoveShopItems(uint16[] tokenIds);
  event Buy(address buyer, address to, uint256 tokenId, uint256 quantity, uint256 price);
  event BuyBatch(address buyer, address to, uint256[] tokenIds, uint256[] quantities, uint256[] prices);
  event Sell(address seller, uint256 tokenId, uint256 quantity, uint256 price);
  event SellBatch(address seller, uint256[] tokenIds, uint256[] quantities, uint256[] prices);
  event NewAllocation(uint16 tokenId, uint256 allocation);
  event AddUnsellableItems(uint16[] tokenIds);
  event RemoveUnsellableItems(uint16[] tokenIds);
  event SetMinItemQuantityBeforeSellsAllowed(uint256 minItemQuantityBeforeSellsAllowed);
  event SetBrushDistributionPercentages(
    uint256 brushBurntPercentage,
    uint256 brushTreasuryPercentage,
    uint256 brushDevPercentage
  );
  event SetSellingCutoffDuration(uint256 duration);

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
  error PercentNotTotal100();

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

  mapping(uint256 tokenId => TokenInfo tokenInfo) private _tokenInfos;

  IBrushToken private _brush;
  Treasury private _treasury;
  IItemNFT private _itemNFT;
  uint16 private _numUnsellableItems;
  uint24 private _minItemQuantityBeforeSellsAllowed;
  address private _dev;
  uint8 private _brushBurntPercentage;
  uint8 private _brushTreasuryPercentage;
  uint8 private _brushDevPercentage;
  uint24 private _sellingCutoffDuration;
  mapping(uint256 itemId => uint256 price) private _shopItems;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken brush,
    Treasury treasury,
    address dev,
    uint24 minItemQuantityBeforeSellsAllowed,
    uint24 sellingCutoffDuration
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());
    _brush = brush;
    _treasury = treasury;
    _dev = dev;

    setMinItemQuantityBeforeSellsAllowed(minItemQuantityBeforeSellsAllowed);
    setSellingCutoffDuration(sellingCutoffDuration);
  }

  function getMinItemQuantityBeforeSellsAllowed() external view returns (uint24) {
    return _minItemQuantityBeforeSellsAllowed;
  }

  function liquidatePrice(uint16 tokenId) external view returns (uint256) {
    return _liquidatePrice(tokenId, _totalBrushForItem());
  }

  function liquidatePrices(uint16[] calldata tokenIds) external view returns (uint256[] memory prices) {
    uint256 length = tokenIds.length;
    if (length != 0) {
      uint256 totalBrushForItem = _totalBrushForItem();
      prices = new uint256[](length);
      for (uint256 iter; iter < length; iter++) {
        prices[iter] = _liquidatePrice(tokenIds[iter], totalBrushForItem);
      }
    }
  }

  // Buy simple items and XP boosts using brush
  function buy(address to, uint16 tokenId, uint256 quantity) external {
    uint256 price = _shopItems[tokenId];
    require(price != 0, ItemCannotBeBought());
    uint256 tokenCost = price * quantity;
    // Pay
    (address[] memory accounts, uint256[] memory amounts) = _buyDistribution(tokenCost);
    _brush.transferFromBulk(msg.sender, accounts, amounts);
    _itemNFT.mint(to, tokenId, quantity);
    emit Buy(msg.sender, to, tokenId, quantity, price);
  }

  function buyBatch(address to, uint256[] calldata tokenIds, uint256[] calldata quantities) external {
    uint256 iter = tokenIds.length;
    require(iter != 0, LengthEmpty());
    require(iter == quantities.length, LengthMismatch());
    uint256 tokenCost;
    uint256[] memory prices = new uint256[](iter);
    while (iter != 0) {
      iter--;
      uint256 price = _shopItems[uint16(tokenIds[iter])];
      require(price != 0, ItemCannotBeBought());
      tokenCost += price * quantities[iter];
      prices[iter] = price;
    }

    // Pay
    (address[] memory accounts, uint256[] memory amounts) = _buyDistribution(tokenCost);
    _brush.transferFromBulk(msg.sender, accounts, amounts);
    _itemNFT.mintBatch(to, tokenIds, quantities);
    emit BuyBatch(msg.sender, to, tokenIds, quantities, prices);
  }

  function sell(uint16 tokenId, uint256 quantity, uint256 minExpectedBrush) external {
    uint256 price = _liquidatePrice(tokenId, _totalBrushForItem());
    uint256 totalBrush = price * quantity;
    _sell(tokenId, quantity, price);
    require(totalBrush >= minExpectedBrush, MinExpectedBrushNotReached(totalBrush, minExpectedBrush));
    _treasury.spend(msg.sender, totalBrush);
    _itemNFT.burn(msg.sender, tokenId, quantity);
    emit Sell(msg.sender, tokenId, quantity, price);
  }

  function sellBatch(uint256[] calldata tokenIds, uint256[] calldata quantities, uint256 minExpectedBrush) external {
    // check array lengths
    uint256 iter = tokenIds.length;
    require(iter != 0, LengthEmpty());
    require(iter == quantities.length, LengthMismatch());

    uint256 totalBrush;
    uint256[] memory prices = new uint256[](iter);
    uint256 totalBrushForItem = _totalBrushForItem();
    do {
      iter--;
      uint256 sellPrice = _liquidatePrice(uint16(tokenIds[iter]), totalBrushForItem);
      totalBrush = totalBrush + (sellPrice * quantities[iter]);
      prices[iter] = sellPrice;
      _sell(tokenIds[iter], quantities[iter], prices[iter]);
    } while (iter != 0);
    require(totalBrush >= minExpectedBrush, MinExpectedBrushNotReached(totalBrush, minExpectedBrush));
    _treasury.spend(msg.sender, totalBrush);
    _itemNFT.burnBatch(msg.sender, tokenIds, quantities);
    emit SellBatch(msg.sender, tokenIds, quantities, prices);
  }

  // Does not burn!
  function _sell(uint256 tokenId, uint256 quantity, uint256 sellPrice) private {
    uint256 price = _shopItems[tokenId];
    require(price == 0 || price >= sellPrice, LiquidatePriceIsHigherThanShop(tokenId));

    // A period of no selling allowed for a newly minted item
    require(
      _itemNFT.getTimestampFirstMint(tokenId) + _sellingCutoffDuration <= block.timestamp,
      SellingTooQuicklyAfterItemIntroduction()
    );

    // Check if tokenInfo checkpoint is older than 24 hours
    TokenInfo storage tokenInfo = _tokenInfos[tokenId];
    require(!tokenInfo.unsellable, ItemNotSellable(tokenId));

    uint256 allocationRemaining;
    if (_hasNewDailyData(tokenInfo.checkpointTimestamp)) {
      uint256 numItems = _getNumItems();
      // New day, reset max allocation can be sold
      allocationRemaining = _treasury.totalClaimable(address(this)) / numItems;
      tokenInfo.checkpointTimestamp = uint40((block.timestamp / 1 days) * 1 days);
      tokenInfo.price = uint80(sellPrice);
      emit NewAllocation(uint16(tokenId), allocationRemaining);
    } else {
      allocationRemaining = tokenInfo.allocationRemaining;
    }

    uint256 totalSold = quantity * sellPrice;
    require(allocationRemaining >= totalSold, NotEnoughAllocationRemaining(tokenId, totalSold, allocationRemaining));
    tokenInfo.allocationRemaining = uint80(allocationRemaining - totalSold);
  }

  function _liquidatePrice(uint16 tokenId, uint256 totalBrushPerItem) private view returns (uint80 price) {
    TokenInfo storage tokenInfo = _tokenInfos[tokenId];
    uint256 totalOfThisItem = _itemNFT.getItemBalance(tokenId);
    if (_hasNewDailyData(tokenInfo.checkpointTimestamp)) {
      if (totalOfThisItem != 0) {
        price = uint80(totalBrushPerItem / totalOfThisItem);
      }
    } else {
      price = uint80(tokenInfo.price);
    }

    if (totalOfThisItem < _minItemQuantityBeforeSellsAllowed || tokenInfo.unsellable) {
      // Needs to have a minimum of an item before any can be sold, and the item must be sellable
      price = 0;
    }
  }

  function _buyDistribution(
    uint256 tokenCost
  ) private view returns (address[] memory accounts, uint256[] memory amounts) {
    accounts = new address[](3);
    amounts = new uint256[](3);
    amounts[0] = (tokenCost * _brushBurntPercentage) / 100;
    amounts[1] = (tokenCost * _brushTreasuryPercentage) / 100;
    amounts[2] = (tokenCost * _brushDevPercentage) / 100;
    accounts[0] = address(0);
    accounts[1] = address(_treasury);
    accounts[2] = _dev;
  }

  function _getNumItems() private view returns (uint256) {
    uint256 totalSupply = _itemNFT.totalSupply();
    return (_numUnsellableItems >= totalSupply) ? totalSupply : totalSupply - _numUnsellableItems;
  }

  function _totalBrushForItem() private view returns (uint256) {
    return _treasury.totalClaimable(address(this)) / _getNumItems();
  }

  function _addBuyableItem(ShopItem calldata buyableItem) private {
    // Check item exists
    require(_itemNFT.exists(buyableItem.tokenId), ItemDoesNotExist());
    require(_shopItems[buyableItem.tokenId] == 0, ShopItemAlreadyExists());
    require(buyableItem.price != 0, PriceCannotBeZero());
    _shopItems[buyableItem.tokenId] = buyableItem.price;
  }

  function _hasNewDailyData(uint256 checkpointTimestamp) private view returns (bool) {
    return (block.timestamp / 1 days) * 1 days >= checkpointTimestamp + 1 days;
  }

  function tokenInfos(uint16 tokenId) external view returns (TokenInfo memory tokenInfo) {
    return _tokenInfos[tokenId];
  }

  function shopItems(uint16 tokenId) external view returns (uint256 price) {
    return _shopItems[tokenId];
  }

  function addBuyableItems(ShopItem[] calldata buyableItems) external onlyOwner {
    for (uint256 i; i < buyableItems.length; ++i) {
      _addBuyableItem(buyableItems[i]);
    }
    emit AddShopItems(buyableItems);
  }

  function editItems(ShopItem[] calldata itemsToEdit) external onlyOwner {
    for (uint256 i; i < itemsToEdit.length; ++i) {
      require(_shopItems[itemsToEdit[i].tokenId] != 0, ShopItemDoesNotExist());
      _shopItems[itemsToEdit[i].tokenId] = itemsToEdit[i].price;
    }
    emit EditShopItems(itemsToEdit);
  }

  function removeItems(uint16[] calldata tokenIds) external onlyOwner {
    for (uint256 i; i < tokenIds.length; ++i) {
      uint16 tokenId = tokenIds[i];
      require(_shopItems[tokenId] != 0, ShopItemDoesNotExist());
      delete _shopItems[tokenId];
    }
    emit RemoveShopItems(tokenIds);
  }

  function addUnsellableItems(uint16[] calldata itemTokenIds) external onlyOwner {
    for (uint256 i; i < itemTokenIds.length; ++i) {
      require(!_tokenInfos[itemTokenIds[i]].unsellable, AlreadyUnsellable());
      require(_itemNFT.exists(itemTokenIds[i]), ItemDoesNotExist());
      _tokenInfos[itemTokenIds[i]].unsellable = true;
    }
    _numUnsellableItems += uint16(itemTokenIds.length);
    emit AddUnsellableItems(itemTokenIds);
  }

  function removeUnsellableItems(uint16[] calldata itemTokenIds) external onlyOwner {
    for (uint256 i; i < itemTokenIds.length; ++i) {
      require(_tokenInfos[itemTokenIds[i]].unsellable, AlreadySellable());
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

  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external onlyOwner {
    require(brushBurntPercentage + brushTreasuryPercentage + brushDevPercentage == 100, PercentNotTotal100());

    _brushBurntPercentage = brushBurntPercentage;
    _brushTreasuryPercentage = brushTreasuryPercentage;
    _brushDevPercentage = brushDevPercentage;
    emit SetBrushDistributionPercentages(brushBurntPercentage, brushTreasuryPercentage, brushDevPercentage);
  }

  function setSellingCutoffDuration(uint24 duration) public onlyOwner {
    _sellingCutoffDuration = duration;
    emit SetSellingCutoffDuration(duration);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
