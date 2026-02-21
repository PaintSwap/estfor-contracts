// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {ItemNFT} from "../ItemNFT.sol";

import {PaintswapVRFConsumerUpgradeable} from "@paintswap/vrf/contracts/PaintswapVRFConsumerUpgradeable.sol";

contract BlackMarketTrader is
  UUPSUpgradeable,
  OwnableUpgradeable,
  PaintswapVRFConsumerUpgradeable
{
  error ItemDoesNotExist();
  error ShopItemAlreadyExists();
  error ShopItemDoesNotExist();
  error PriceCannotBeZero();  
  error ItemCannotBeBought();
  error ShopClosed();
  error RequestDoesNotExist();
  error ItemStockInsufficient();
  error AcceptedItemNotSet();
  error ShopAvailabilityNotDetermined();
  error NoItemsInShop();
  error AlreadyInitialisedToday();
  error QuantityCannotBeZero();

  event AcceptedItemIdSet(uint256 indexed globalEventId, uint16 itemId);
  event AddShopItems(ShopItem[] shopItems, uint256 indexed globalEventId);
  event EditShopItems(ShopItem[] shopItems, uint256 indexed globalEventId);
  event RemoveShopItems(uint16[] tokenIds, uint256 indexed globalEventId);
  event Buy(
    address indexed buyer,
    address indexed to,
    uint256 indexed globalEventId,
    uint16 tokenId,
    uint256 quantity,
    uint128 price,
    uint16 amountPerPurchase
  );
  event RequestSent(uint256 requestId, uint256 globalEventId, uint256 numWords);
  event ShopActiveItemsUpdated(uint16[] activeTokenIds, uint256 indexed globalEventId);

  struct ShopItem {
    uint128 price;
    uint16 tokenId;
    uint16 amountPerPurchase;
    uint16 currentStock; // Current stock available - resets when shop availability is determined
    uint16 stock; // 0 means infinite stock
    bool isActive;
  }

  struct ShopCollection {
    uint16 acceptedItemId;
    uint40 lastRequestDay;
    uint40 lastFulfillmentDay;
    uint16[] itemTokenIds;
    mapping(uint16 => ShopItem) shopItems;
  }

  uint256 private constant CALLBACK_GAS_LIMIT_PER_ACTION = 140_000;
  ItemNFT private _itemNFT;

  mapping(uint256 globalEventId => ShopCollection) private _shopCollections;
  mapping(uint256 requestId => uint256 globalEventId) private _requestIdToGlobalEventId;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address owner,
    ItemNFT itemNFT,
    address paintswapVRFConsumer
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(owner);
    __PaintswapVRFConsumerUpgradeable_init(paintswapVRFConsumer);

    _itemNFT = itemNFT;
  }

  // Buy any available item with a specific tokenId
  function buy(address to, uint256 globalEventId, uint16 tokenId, uint16 quantity) external {
    require(quantity != 0, QuantityCannotBeZero());
    ShopCollection storage collection = _shopCollections[globalEventId];
    ShopItem storage shopItem = collection.shopItems[tokenId];
    // Check shop is open
    require(_isShopOpen(), ShopClosed());
    require(shopItem.isActive, ItemCannotBeBought());
    require(shopItem.price != 0, ItemCannotBeBought());
    require(shopItem.stock == 0 || shopItem.currentStock >= quantity, ItemStockInsufficient());
    require(collection.acceptedItemId != 0, AcceptedItemNotSet());

    uint40 currentDay = uint40(block.timestamp / 1 days);
    require(collection.lastFulfillmentDay == currentDay, ShopAvailabilityNotDetermined());

    // Update stock
    if (shopItem.stock != 0) {
      shopItem.currentStock -= quantity;
    }

    // Calculate cost
    uint256 tokenCost = uint256(shopItem.price) * quantity;

    // Pay
    _itemNFT.burn(_msgSender(), collection.acceptedItemId, tokenCost);

    // Mint item to chosen address (amountPerPurchase * quantity)
    _itemNFT.mint(to, tokenId, uint256(shopItem.amountPerPurchase) * quantity);

    emit Buy(_msgSender(), to, globalEventId, tokenId, quantity, shopItem.price, shopItem.amountPerPurchase);
  }

  function initialiseShopItemsForEvent(uint256 globalEventId) external payable {
    require(_isShopOpen(), ShopClosed());
    ShopCollection storage collection = _shopCollections[globalEventId];
    uint256 itemLength = collection.itemTokenIds.length;
    require(itemLength != 0, NoItemsInShop());

    uint40 currentDay = uint40(block.timestamp / 1 days);
    require(collection.lastRequestDay != currentDay, AlreadyInitialisedToday());
    collection.lastRequestDay = currentDay; // Set immediately to prevent duplicate requests before VRF fulfillment
    uint16 numOfRandomWordsNeeded = uint16(itemLength / 16 + ((itemLength % 16) == 0 ? 0 : 1));
    uint256 requestId = _requestRandomWords(numOfRandomWordsNeeded);
    _requestIdToGlobalEventId[requestId] = globalEventId;
    emit RequestSent(requestId, globalEventId, numOfRandomWordsNeeded);
  }

  // Shop is open for 4 days every 3 weeks, starting on week 1 (i.e. week 0 closed, week 1 open, week 2 closed)
  // Within that 1 week, shop is open for days 0-3 of the week (i.e. Thu-Sun as unix days start on Thu)
  function _isShopOpen() private view returns (bool) {
    return ((block.timestamp / 1 weeks) % 3) == 1 && ((block.timestamp / 1 days) % 7) < 4;
  }

  function _requestRandomWords(uint256 numWords) private returns (uint256 requestId) {
    requestId = _requestRandomnessPayInNative(
      callbackGasLimitForRequests(numWords),
      numWords,
      msg.sender,
      msg.value
    );
  }

  function _fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
    require(_requestIdToGlobalEventId[requestId] != 0, RequestDoesNotExist());

    uint256 globalEventId = _requestIdToGlobalEventId[requestId];
    ShopCollection storage collection = _shopCollections[globalEventId];

    delete _requestIdToGlobalEventId[requestId];

    collection.lastFulfillmentDay = uint40(block.timestamp / 1 days);
    uint256 itemLength = collection.itemTokenIds.length;
    uint16[] memory activeTokenIds = new uint16[](itemLength);
    uint256 activeCount;

    for (uint256 i; i < itemLength; ++i) {
      uint256 randomWordIndex = i / 16;
      if (randomWordIndex >= randomWords.length) {
        randomWordIndex = 0; // Fallback in case of insufficient random words
      }

      uint16 tokenId = collection.itemTokenIds[i];
      ShopItem storage item = collection.shopItems[tokenId];
      // Randomly determine if item is active this time
      uint16 rand = uint16(randomWords[randomWordIndex] >> ((i % 16) * 16));
      item.isActive = (rand % 3) == 0; // 1 in 3 chance of being active
      item.currentStock = item.stock;
      if (item.isActive) {
        activeTokenIds[activeCount++] = tokenId;
      }
    }

    assembly ("memory-safe") {
      mstore(activeTokenIds, activeCount)
    }
    emit ShopActiveItemsUpdated(activeTokenIds, globalEventId);
  }

  function callbackGasLimitForRequests(uint256 numActions) private pure returns (uint256 callbackGasLimit) {
    callbackGasLimit = CALLBACK_GAS_LIMIT_PER_ACTION * numActions;
    // Have both a minimum and maximum gas limit
    if (callbackGasLimit < 200_000) {
      callbackGasLimit = 200_000;
    } else if (callbackGasLimit > 6_500_000) {
      callbackGasLimit = 6_500_000;
    }
  }

  function requestCost(uint256 numActions) public view returns (uint256) {
    return _calculateRequestPriceNative(callbackGasLimitForRequests(numActions));
  }

  function _addShopItem(ShopItem calldata shopItem, uint256 globalEventId) private {
    // Check item exists
    require(_itemNFT.exists(shopItem.tokenId), ItemDoesNotExist());
    require(shopItem.price != 0, PriceCannotBeZero());

    ShopCollection storage collection = _shopCollections[globalEventId];
    require(collection.shopItems[shopItem.tokenId].price == 0, ShopItemAlreadyExists());

    collection.itemTokenIds.push(shopItem.tokenId);
    collection.shopItems[shopItem.tokenId] = shopItem;
  }

  function setAcceptedItemId(uint256 globalEventId, uint16 itemId) external onlyOwner {
    require(_itemNFT.exists(itemId), ItemDoesNotExist());
    _shopCollections[globalEventId].acceptedItemId = itemId;
    emit AcceptedItemIdSet(globalEventId, itemId);
  }

  function editShopItems(ShopItem[] calldata itemsToEdit, uint256 globalEventId) external onlyOwner {
    ShopCollection storage collection = _shopCollections[globalEventId];
    for (uint256 i; i < itemsToEdit.length; ++i) {
      ShopItem storage item = collection.shopItems[itemsToEdit[i].tokenId];
      require(item.price != 0, ShopItemDoesNotExist());
      require(itemsToEdit[i].price != 0, PriceCannotBeZero());
      item.price = itemsToEdit[i].price;
      item.stock = itemsToEdit[i].stock;
      item.currentStock = itemsToEdit[i].stock; // Reset stock to new stock amount when edited
      item.amountPerPurchase = itemsToEdit[i].amountPerPurchase;
    }
    emit EditShopItems(itemsToEdit, globalEventId);
  }

  function removeShopItems(uint16[] calldata tokenIds, uint256 globalEventId) external onlyOwner {
    ShopCollection storage collection = _shopCollections[globalEventId];
    for (uint256 i; i < tokenIds.length; ++i) {
      uint16 tokenId = tokenIds[i];
      require(collection.shopItems[tokenId].price != 0, ShopItemDoesNotExist());
      delete collection.shopItems[tokenId];

      // Remove from itemTokenIds array
      for (uint256 j; j < collection.itemTokenIds.length; ++j) {
        if (collection.itemTokenIds[j] == tokenId) {
          collection.itemTokenIds[j] = collection.itemTokenIds[collection.itemTokenIds.length - 1];
          collection.itemTokenIds.pop();
          break;
        }
      }
    }
    emit RemoveShopItems(tokenIds, globalEventId);
  }

  function addShopItems(ShopItem[] calldata items, uint256 globalEventId) external onlyOwner {
    for (uint256 i; i < items.length; ++i) {
      _addShopItem(items[i], globalEventId);
    }
    emit AddShopItems(items, globalEventId);
  }
  
  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

}