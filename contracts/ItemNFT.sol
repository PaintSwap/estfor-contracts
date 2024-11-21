// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {IItemNFT} from "./interfaces/IItemNFT.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {ItemNFTLibrary} from "./ItemNFTLibrary.sol";
import {IBankFactory} from "./interfaces/IBankFactory.sol";
import {AdminAccess} from "./AdminAccess.sol";

import {BoostType, BulkTransferInfo, CombatStats, EquipPosition, Item, ItemInput, Skill, IS_FULL_MODE_BIT, IS_AVAILABLE_BIT} from "./globals/all.sol";

// The NFT contract contains data related to the items and who owns them
contract ItemNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IERC2981, IItemNFT {
  event AddItems(ItemInput[] items);
  event EditItems(ItemInput[] items);
  event RemoveItems(uint16[] tokenIds);

  error IdTooHigh();
  error ItemNotTransferable();
  error InvalidTokenId();
  error ItemAlreadyExists();
  error ItemDoesNotExist(uint16);
  error EquipmentPositionShouldNotChange();
  error NotMinter();
  error NotBurner();
  error LengthMismatch();

  struct ItemInfo {
    uint40 timestampFirstMint;
    uint216 balance; // can be smaller if we want to pack more data
  }

  uint16 private _totalSupplyAll;
  string private _baseURI;

  AdminAccess private _adminAccess;
  bool private _isBeta;
  IBankFactory private _bankFactory;
  IPlayers private _players;

  // Royalties
  address private _royaltyReceiver;
  uint8 private _royaltyFee; // base 1000, highest is 25.5

  mapping(uint256 itemId => ItemInfo itemInfo) private _itemInfos; // (timestampFirstMint, balance)
  mapping(uint256 itemId => string tokenURI) private _tokenURIs;
  mapping(uint256 itemId => CombatStats combatStats) private _combatStats;
  mapping(uint256 itemId => Item item) private _items;

  mapping(address account => bool isApproved) private _approvals;

  modifier onlyMinters() {
    address sender = _msgSender();
    require(_isApproved(sender) || (_adminAccess.isAdmin(sender) && _isBeta), NotMinter());
    _;
  }

  modifier onlyBurners(address from) {
    address sender = _msgSender();
    require(sender == from || isApprovedForAll(from, sender), NotBurner());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address royaltyReceiver,
    string calldata baseURI,
    AdminAccess adminAccess,
    bool isBeta
  ) external initializer {
    __ERC1155_init("");
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _baseURI = baseURI;
    _royaltyFee = 30; // 3%
    _royaltyReceiver = royaltyReceiver;
    _adminAccess = adminAccess;
    _isBeta = isBeta;
  }

  function mint(address to, uint256 tokenId, uint256 amount) external override onlyMinters {
    _mintItem(to, tokenId, amount);
  }

  function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts) external override onlyMinters {
    _mintBatchItems(to, ids, amounts);
  }

  function burnBatch(
    address from,
    uint256[] calldata tokenIds,
    uint256[] calldata amounts
  ) external override onlyBurners(from) {
    _burnBatch(from, tokenIds, amounts);
  }

  function burn(address from, uint256 tokenId, uint256 amount) external override onlyBurners(from) {
    _burn(from, tokenId, amount);
  }

  function _getMinRequirement(uint16 tokenId) private view returns (Skill, uint32, bool isFullModeOnly) {
    Item memory item = _items[tokenId];
    return (item.skill, item.minXP, _isItemFullMode(tokenId));
  }

  function _isItemFullMode(uint256 tokenId) private view returns (bool) {
    return uint8(_items[tokenId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  // TODO: Not used yet
  function _isItemAvailable(uint16 tokenId) private view returns (bool) {
    return uint8(_items[tokenId].packedData >> IS_AVAILABLE_BIT) & 1 == 1;
  }

  function _premint(uint256 tokenId, uint256 amount) private returns (uint256 numNewUniqueItems) {
    require(tokenId < type(uint16).max, IdTooHigh());
    uint256 existingBalance = _itemInfos[tokenId].balance;
    if (existingBalance == 0) {
      // Brand new item
      _itemInfos[tokenId].timestampFirstMint = uint40(block.timestamp);
      numNewUniqueItems++;
    }
    _itemInfos[tokenId].balance = uint216(existingBalance + amount);
  }

  function _mintItem(address to, uint256 tokenId, uint256 amount) internal {
    uint256 newlyMintedItems = _premint(tokenId, amount);
    if (newlyMintedItems != 0) {
      ++_totalSupplyAll;
    }
    _mint(to, uint256(tokenId), amount, "");
  }

  function _mintBatchItems(address to, uint256[] memory tokenIds, uint256[] memory amounts) internal {
    uint256 numNewItems;
    uint256 tokenIdsLength = tokenIds.length;
    for (uint256 i; i < tokenIdsLength; ++i) {
      numNewItems = numNewItems + _premint(tokenIds[i], amounts[i]);
    }
    if (numNewItems != 0) {
      _totalSupplyAll += uint16(numNewItems);
    }
    _mintBatch(to, tokenIds, amounts, "");
  }

  function safeBulkTransfer(BulkTransferInfo[] calldata nftsInfo) external {
    if (nftsInfo.length == 0) {
      return;
    }
    for (uint256 i = 0; i < nftsInfo.length; ++i) {
      BulkTransferInfo memory nftInfo = nftsInfo[i];
      address to = nftInfo.to;
      if (nftInfo.tokenIds.length == 1) {
        safeTransferFrom(_msgSender(), to, nftInfo.tokenIds[0], nftInfo.amounts[0], "");
      } else {
        safeBatchTransferFrom(_msgSender(), to, nftInfo.tokenIds, nftInfo.amounts, "");
      }
    }
  }

  function _getItem(uint16 tokenId) private view returns (Item storage) {
    require(exists(tokenId), ItemDoesNotExist(tokenId));
    return _items[tokenId];
  }

  // If an item is burnt, remove it from the total
  function _removeAnyBurntFromTotal(uint256[] memory ids, uint256[] memory amounts) private {
    uint256 totalSupplyDelta;
    for (uint256 i = 0; i < ids.length; ++i) {
      uint256 newBalance = _itemInfos[ids[i]].balance - amounts[i];
      if (newBalance == 0) {
        ++totalSupplyDelta;
      }
      _itemInfos[ids[i]].balance = uint216(newBalance);
    }
    _totalSupplyAll -= uint16(totalSupplyDelta);
  }

  function _checkIsTransferable(address from, uint256[] memory ids) private view {
    bool anyNonTransferable;
    for (uint256 i = 0; i < ids.length; ++i) {
      if (exists(ids[i]) && !_items[ids[i]].isTransferable) {
        anyNonTransferable = true;
        break;
      }
    }

    // Check if this is from a bank, that's the only place it's allowed to transfer non-transferable items
    require(!anyNonTransferable || _bankFactory.getCreatedHere(from), ItemNotTransferable());
  }

  function _update(address from, address to, uint256[] memory ids, uint256[] memory amounts) internal virtual override {
    if (amounts.length != 0 && from != to) {
      bool isBurnt = to == address(0) || to == address(0xdEaD);
      bool isMinted = from == address(0);
      if (isBurnt) {
        _removeAnyBurntFromTotal(ids, amounts);
      } else if (!isMinted) {
        _checkIsTransferable(from, ids);
      }
      _players.beforeItemNFTTransfer(from, to, ids, amounts);
    }
    super._update(from, to, ids, amounts);
  }

  function _setItem(ItemInput calldata input) private {
    require(input.tokenId != 0, InvalidTokenId());
    ItemNFTLibrary.setItem(input, _items[input.tokenId]);
    _tokenURIs[input.tokenId] = input.metadataURI;
  }

  function _editItem(ItemInput calldata inputItem) private {
    require(exists(inputItem.tokenId), ItemDoesNotExist(inputItem.tokenId));
    EquipPosition oldPosition = _items[inputItem.tokenId].equipPosition;
    EquipPosition newPosition = inputItem.equipPosition;

    bool isRightHandPositionSwapWithBothHands = (oldPosition == EquipPosition.RIGHT_HAND &&
      newPosition == EquipPosition.BOTH_HANDS) ||
      (oldPosition == EquipPosition.BOTH_HANDS && newPosition == EquipPosition.RIGHT_HAND);

    // Allowed to go from BOTH_HANDS to RIGHT_HAND or RIGHT_HAND to BOTH_HANDS
    require(
      oldPosition == newPosition || oldPosition == EquipPosition.NONE || isRightHandPositionSwapWithBothHands,
      EquipmentPositionShouldNotChange()
    );
    _setItem(inputItem);
  }

  function _isApproved(address account) private view returns (bool) {
    return _approvals[account];
  }

  function uri(uint256 tokenId) public view virtual override returns (string memory) {
    require(exists(tokenId), ItemDoesNotExist(uint16(tokenId)));
    return string(abi.encodePacked(_baseURI, _tokenURIs[tokenId]));
  }

  function exists(uint256 tokenId) public view override returns (bool) {
    return _items[tokenId].packedData != 0;
  }

  function totalSupply(uint256 tokenId) external view override returns (uint256) {
    return _itemInfos[tokenId].balance;
  }

  function totalSupply() external view override returns (uint256) {
    return _totalSupplyAll;
  }

  function getItem(uint16 tokenId) external view override returns (Item memory) {
    return _getItem(tokenId);
  }

  function getItems(uint16[] calldata tokenIds) external view override returns (Item[] memory items) {
    uint256 tokenIdsLength = tokenIds.length;
    items = new Item[](tokenIdsLength);
    for (uint256 i; i < tokenIdsLength; ++i) {
      items[i] = _getItem(tokenIds[i]);
    }
  }

  function getTimestampFirstMint(uint256 tokenId) external view override returns (uint256) {
    return _itemInfos[tokenId].timestampFirstMint;
  }

  function getEquipPositionAndMinRequirement(
    uint16 item
  ) external view returns (Skill skill, uint32 minXP, EquipPosition equipPosition, bool isFullModeOnly) {
    (skill, minXP, isFullModeOnly) = _getMinRequirement(item);
    equipPosition = getEquipPosition(item);
  }

  function getMinRequirements(
    uint16[] calldata tokenIds
  ) external view returns (Skill[] memory skills, uint32[] memory minXPs, bool[] memory isFullModeOnly) {
    skills = new Skill[](tokenIds.length);
    minXPs = new uint32[](tokenIds.length);
    isFullModeOnly = new bool[](tokenIds.length);
    uint256 tokenIdsLength = tokenIds.length;
    for (uint256 i; i < tokenIdsLength; ++i) {
      (skills[i], minXPs[i], isFullModeOnly[i]) = _getMinRequirement(tokenIds[i]);
    }
  }

  function getEquipPositions(uint16[] calldata tokenIds) external view returns (EquipPosition[] memory equipPositions) {
    uint256 tokenIdsLength = tokenIds.length;
    equipPositions = new EquipPosition[](tokenIdsLength);
    for (uint256 i; i < tokenIdsLength; ++i) {
      equipPositions[i] = getEquipPosition(tokenIds[i]);
    }
  }

  function getEquipPosition(uint16 tokenId) public view returns (EquipPosition) {
    require(exists(tokenId), ItemDoesNotExist(uint16(tokenId)));
    return _items[tokenId].equipPosition;
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(
    address account,
    uint16[] memory ids
  ) external view override returns (uint256[] memory batchBalances) {
    batchBalances = new uint256[](ids.length);
    for (uint256 i = 0; i < ids.length; ++i) {
      batchBalances[i] = balanceOf(account, ids[i]);
    }
  }

  function balanceOfs10(
    address account,
    uint16[10] memory ids
  ) external view override returns (uint256[] memory batchBalances) {
    batchBalances = new uint256[](ids.length);
    for (uint256 i = 0; i < ids.length; ++i) {
      batchBalances[i] = balanceOf(account, ids[i]);
    }
  }

  function balanceOf(address account, uint256 id) public view override(IItemNFT, ERC1155Upgradeable) returns (uint256) {
    return ERC1155Upgradeable.balanceOf(account, id);
  }

  function royaltyInfo(
    uint256 /*tokenId*/,
    uint256 salePrice
  ) external view override returns (address receiver, uint256 royaltyAmount) {
    uint256 amount = (salePrice * _royaltyFee) / 1000;
    return (_royaltyReceiver, amount);
  }

  function getBoostInfo(
    uint16 tokenId
  ) external view returns (BoostType boostType, uint16 boostValue, uint24 boostDuration) {
    Item storage item = _getItem(tokenId);
    return (item.boostType, item.boostValue, item.boostDuration);
  }

  /**
   * @dev See {IERC1155-isApprovedForAll}.
   */
  function isApprovedForAll(address account, address operator) public view virtual override returns (bool) {
    return super.isApprovedForAll(account, operator) || _approvals[operator];
  }

  function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC1155Upgradeable) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked("Estfor Items", _isBeta ? " (Beta)" : ""));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked("EK_I", _isBeta ? "B" : ""));
  }

  function addItems(ItemInput[] calldata inputItems) external onlyOwner {
    uint256 length = inputItems.length;
    for (uint256 i; i < length; ++i) {
      require(!exists(inputItems[i].tokenId), ItemAlreadyExists());
      _setItem(inputItems[i]);
    }

    emit AddItems(inputItems);
  }

  function editItems(ItemInput[] calldata inputItems) external onlyOwner {
    for (uint256 i = 0; i < inputItems.length; ++i) {
      _editItem(inputItems[i]);
    }

    emit EditItems(inputItems);
  }

  // This should be only used when an item is not in active use
  // because it could mess up queued actions potentially
  function removeItems(uint16[] calldata itemTokenIds) external onlyOwner {
    for (uint256 i = 0; i < itemTokenIds.length; ++i) {
      require(exists(itemTokenIds[i]), ItemDoesNotExist(itemTokenIds[i]));
      delete _items[itemTokenIds[i]];
      delete _tokenURIs[itemTokenIds[i]];
    }

    emit RemoveItems(itemTokenIds);
  }

  function initializeAddresses(IBankFactory bankFactory, IPlayers players) external onlyOwner {
    _bankFactory = bankFactory;
    _players = players;
  }

  function setApproved(address[] calldata accounts, bool isApproved) external onlyOwner {
    for (uint256 i = 0; i < accounts.length; ++i) {
      _approvals[accounts[i]] = isApproved;
    }
  }

  function setBaseURI(string calldata baseURI) external onlyOwner {
    _baseURI = baseURI;
  }

  function airdrop(address[] calldata tos, uint256 tokenId, uint256[] calldata amounts) external onlyOwner {
    require(tos.length == amounts.length, LengthMismatch());
    for (uint256 i = 0; i < tos.length; ++i) {
      _mintItem(tos[i], tokenId, amounts[i]);
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
