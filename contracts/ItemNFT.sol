// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155Upgradeable} from "./ozUpgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {ItemNFTLibrary} from "./ItemNFTLibrary.sol";
import {IBankFactory} from "./interfaces/IBankFactory.sol";
import {World} from "./World.sol";
import {AdminAccess} from "./AdminAccess.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// The NFT contract contains data related to the items and who owns them
contract ItemNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IERC2981 {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using UnsafeMath for uint16;

  event AddItemsV2(ItemOutput[] items, uint16[] tokenIds, string[] names);
  event EditItemsV2(ItemOutput[] items, uint16[] tokenIds, string[] names);
  event RemoveItemsV2(uint16[] tokenIds);

  // Legacy for ABI
  event AddItem(ItemV1 item, uint16 tokenId, string name);
  event AddItems(ItemV1[] items, uint16[] tokenIds, string[] names);
  event EditItem(ItemV1 item, uint16 tokenId, string name);
  event EditItems(ItemV1[] items, uint16[] tokenIds, string[] names);

  error IdTooHigh();
  error ItemNotTransferable();
  error InvalidChainId();
  error InvalidTokenId();
  error ItemAlreadyExists();
  error ItemDoesNotExist(uint16);
  error EquipmentPositionShouldNotChange();
  error NotMinter();
  error NotBurner();
  error NotAdminAndBeta();
  error LengthMismatch();

  World public world; // Used by the promotions contract....
  bool private isBeta;
  string private baseURI;

  // How many of this item exist
  mapping(uint itemId => uint amount) public itemBalances;
  mapping(uint itemId => uint timestamp) public timestampFirstMint;

  address public players;
  address private shop;
  uint16 private totalSupplyAll_;

  // Royalties
  address private royaltyReceiver;
  uint8 private royaltyFee; // base 1000, highest is 25.5

  mapping(uint itemId => string tokenURI) private tokenURIs;
  mapping(uint itemId => CombatStats combatStats) private combatStats;
  mapping(uint itemId => Item item) private items;

  AdminAccess private adminAccess;
  IBankFactory private bankFactory;
  address private promotions;
  address private instantActions;
  address private territories;
  address private lockedBankVaults;
  address private bazaar;
  address private instantVRFActions;

  modifier onlyMinters() {
    if (
      _msgSender() != players &&
      _msgSender() != shop &&
      _msgSender() != promotions &&
      _msgSender() != instantActions &&
      _msgSender() != instantVRFActions
    ) {
      revert NotMinter();
    }
    _;
  }

  modifier onlyBurners(address _from) {
    if (
      _msgSender() != _from &&
      !isApprovedForAll(_from, _msgSender()) &&
      _msgSender() != players &&
      _msgSender() != shop &&
      _msgSender() != instantActions &&
      _msgSender() != instantVRFActions &&
      _msgSender() != territories &&
      _msgSender() != lockedBankVaults
    ) {
      revert NotBurner();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(adminAccess.isAdmin(_msgSender()) && isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    World _world,
    address _shop,
    address _royaltyReceiver,
    AdminAccess _adminAccess,
    string calldata _baseURI,
    bool _isBeta
  ) external initializer {
    __ERC1155_init("");
    __UUPSUpgradeable_init();
    __Ownable_init();

    world = _world;
    shop = _shop;
    baseURI = _baseURI;
    royaltyFee = 30; // 3%
    royaltyReceiver = _royaltyReceiver;
    adminAccess = _adminAccess;
    isBeta = _isBeta;
  }

  function mint(address _to, uint _tokenId, uint _amount) external onlyMinters {
    _mintItem(_to, _tokenId, _amount);
  }

  function mintBatch(address _to, uint[] calldata _ids, uint[] calldata _amounts) external onlyMinters {
    _mintBatchItems(_to, _ids, _amounts);
  }

  function burnBatch(address _from, uint[] calldata _tokenIds, uint[] calldata _amounts) external onlyBurners(_from) {
    _burnBatch(_from, _tokenIds, _amounts);
  }

  function burn(address _from, uint _tokenId, uint _amount) external onlyBurners(_from) {
    _burn(_from, _tokenId, _amount);
  }

  function _getMinRequirement(uint16 _tokenId) private view returns (Skill, uint32, bool isFullModeOnly) {
    return (items[_tokenId].skill, items[_tokenId].minXP, _isItemFullMode(_tokenId));
  }

  function _isItemFullMode(uint _tokenId) private view returns (bool) {
    return uint8(items[_tokenId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _premint(uint _tokenId, uint _amount) private returns (uint numNewUniqueItems) {
    if (_tokenId >= type(uint16).max) {
      revert IdTooHigh();
    }
    uint existingBalance = itemBalances[_tokenId];
    if (existingBalance == 0) {
      // Brand new item
      timestampFirstMint[_tokenId] = block.timestamp;
      numNewUniqueItems = numNewUniqueItems.inc();
    }
    itemBalances[_tokenId] = existingBalance + _amount;
  }

  function _mintItem(address _to, uint _tokenId, uint _amount) internal {
    uint newlyMintedItems = _premint(_tokenId, _amount);
    if (newlyMintedItems != 0) {
      totalSupplyAll_ = uint16(totalSupplyAll_.inc());
    }
    _mint(_to, uint(_tokenId), _amount, "");
  }

  function _mintBatchItems(address _to, uint[] memory _tokenIds, uint[] memory _amounts) internal {
    U256 numNewItems;
    U256 tokenIdsLength = _tokenIds.length.asU256();
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      numNewItems = numNewItems.add(_premint(_tokenIds[i], _amounts[i]));
    }
    if (numNewItems.neq(0)) {
      totalSupplyAll_ = uint16(totalSupplyAll_.add(numNewItems.asUint16()));
    }
    _mintBatch(_to, _tokenIds, _amounts, "");
  }

  function _getItem(uint16 _tokenId) private view returns (Item storage) {
    if (!exists(_tokenId)) {
      revert ItemDoesNotExist(_tokenId);
    }
    return items[_tokenId];
  }

  // If an item is burnt, remove it from the total
  function _removeAnyBurntFromTotal(uint[] memory _ids, uint[] memory _amounts) private {
    U256 iter = _ids.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      uint newBalance = itemBalances[_ids[i]] - _amounts[i];
      if (newBalance == 0) {
        totalSupplyAll_ = uint16(totalSupplyAll_.dec());
      }
      itemBalances[_ids[i]] = newBalance;
    }
  }

  function _checkIsTransferable(address _from, uint[] memory _ids) private view {
    U256 iter = _ids.length.asU256();
    bool anyNonTransferable;
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      if (exists(_ids[i]) && !items[_ids[i]].isTransferable) {
        anyNonTransferable = true;
      }
    }

    if (anyNonTransferable && (address(bankFactory) == address(0) || !bankFactory.createdHere(_from))) {
      // Check if this is from a bank, that's the only place it's allowed to withdraw non-transferable items
      revert ItemNotTransferable();
    }
  }

  function _beforeTokenTransfer(
    address /*_operator*/,
    address _from,
    address _to,
    uint[] memory _ids,
    uint[] memory _amounts,
    bytes memory /*_data*/
  ) internal virtual override {
    if (_from == address(0) || _amounts.length == 0 || _from == _to) {
      // When minting or self sending, then no further processing is required
      return;
    }

    bool isBurnt = _to == address(0) || _to == 0x000000000000000000000000000000000000dEaD;
    if (isBurnt) {
      _removeAnyBurntFromTotal(_ids, _amounts);
    } else {
      _checkIsTransferable(_from, _ids);
    }
    if (players == address(0)) {
      if (block.chainid != 31337) {
        revert InvalidChainId();
      }
    }
  }

  function _setItem(ItemInput calldata _item) private returns (ItemOutput memory item) {
    if (_item.tokenId == 0) {
      revert InvalidTokenId();
    }
    ItemNFTLibrary.setItem(_item, items[_item.tokenId]);
    tokenURIs[_item.tokenId] = _item.metadataURI;

    item = ItemOutput({
      equipPosition: _item.equipPosition,
      isFullModeOnly: _item.isFullModeOnly,
      isTransferable: _item.isTransferable,
      healthRestored: _item.healthRestored,
      boostType: _item.boostType,
      boostValue: _item.boostValue,
      boostDuration: _item.boostDuration,
      melee: _item.combatStats.melee,
      ranged: _item.combatStats.ranged,
      magic: _item.combatStats.magic,
      meleeDefence: _item.combatStats.meleeDefence,
      rangedDefence: _item.combatStats.rangedDefence,
      magicDefence: _item.combatStats.magicDefence,
      health: _item.combatStats.health,
      skill: _item.skill,
      minXP: _item.minXP
    });
  }

  function _editItem(ItemInput calldata _inputItem) private returns (ItemOutput memory item) {
    if (!exists(_inputItem.tokenId)) {
      revert ItemDoesNotExist(_inputItem.tokenId);
    }
    EquipPosition oldPosition = items[_inputItem.tokenId].equipPosition;
    EquipPosition newPosition = _inputItem.equipPosition;

    bool isRightHandPositionSwapWithBothHands = (oldPosition == EquipPosition.RIGHT_HAND &&
      newPosition == EquipPosition.BOTH_HANDS) ||
      (oldPosition == EquipPosition.BOTH_HANDS && newPosition == EquipPosition.RIGHT_HAND);

    // Allowed to go from BOTH_HANDS to RIGHT_HAND or RIGHT_HAND to BOTH_HANDS
    if (oldPosition != newPosition && oldPosition != EquipPosition.NONE && !isRightHandPositionSwapWithBothHands) {
      revert EquipmentPositionShouldNotChange();
    }
    item = _setItem(_inputItem);
  }

  function uri(uint _tokenId) public view virtual override returns (string memory) {
    if (!exists(_tokenId)) {
      revert ItemDoesNotExist(uint16(_tokenId));
    }
    return string(abi.encodePacked(baseURI, tokenURIs[_tokenId]));
  }

  function exists(uint _tokenId) public view returns (bool) {
    return items[_tokenId].packedData != 0;
  }

  function totalSupply(uint _tokenId) external view returns (uint) {
    return itemBalances[_tokenId];
  }

  function totalSupply() external view returns (uint) {
    return totalSupplyAll_;
  }

  function getItem(uint16 _tokenId) external view returns (Item memory) {
    return _getItem(_tokenId);
  }

  function getEquipPositionAndMinRequirement(
    uint16 _item
  ) external view returns (Skill skill, uint32 minXP, EquipPosition equipPosition, bool isFullModeOnly) {
    (skill, minXP, isFullModeOnly) = _getMinRequirement(_item);
    equipPosition = getEquipPosition(_item);
  }

  function getMinRequirements(
    uint16[] calldata _tokenIds
  ) external view returns (Skill[] memory skills, uint32[] memory minXPs, bool[] memory isFullModeOnly) {
    skills = new Skill[](_tokenIds.length);
    minXPs = new uint32[](_tokenIds.length);
    isFullModeOnly = new bool[](_tokenIds.length);
    U256 tokenIdsLength = _tokenIds.length.asU256();
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      (skills[i], minXPs[i], isFullModeOnly[i]) = _getMinRequirement(_tokenIds[i]);
    }
  }

  function getItems(uint16[] calldata _tokenIds) external view returns (Item[] memory _items) {
    U256 tokenIdsLength = _tokenIds.length.asU256();
    _items = new Item[](tokenIdsLength.asUint256());
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      _items[i] = _getItem(_tokenIds[i]);
    }
  }

  function getEquipPositions(
    uint16[] calldata _tokenIds
  ) external view returns (EquipPosition[] memory equipPositions) {
    U256 tokenIdsLength = _tokenIds.length.asU256();
    equipPositions = new EquipPosition[](tokenIdsLength.asUint256());
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      equipPositions[i] = getEquipPosition(_tokenIds[i]);
    }
  }

  function getEquipPosition(uint16 _tokenId) public view returns (EquipPosition) {
    if (!exists(_tokenId)) {
      revert ItemDoesNotExist(_tokenId);
    }
    return items[_tokenId].equipPosition;
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(address _account, uint16[] memory _ids) external view returns (uint[] memory batchBalances) {
    U256 iter = _ids.length.asU256();
    batchBalances = new uint[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      batchBalances[i] = balanceOf(_account, _ids[i]);
    }
  }

  function royaltyInfo(
    uint /*_tokenId*/,
    uint _salePrice
  ) external view override returns (address receiver, uint royaltyAmount) {
    uint amount = (_salePrice * royaltyFee) / 1000;
    return (royaltyReceiver, amount);
  }

  function getBoostInfo(
    uint16 _tokenId
  ) external view returns (BoostType boostType, uint16 boostValue, uint24 boostDuration) {
    Item storage item = _getItem(_tokenId);
    return (item.boostType, item.boostValue, item.boostDuration);
  }

  /**
   * @dev See {IERC1155-isApprovedForAll}.
   */
  function isApprovedForAll(address _account, address _operator) public view virtual override returns (bool) {
    return super.isApprovedForAll(_account, _operator) || _operator == bazaar;
  }

  function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC1155Upgradeable) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked("Estfor Items", isBeta ? " (Beta)" : ""));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked("EK_I", isBeta ? "B" : ""));
  }

  function addItems(ItemInput[] calldata _inputItems) external onlyOwner {
    U256 iter = _inputItems.length.asU256();
    ItemOutput[] memory _items = new ItemOutput[](iter.asUint256());
    uint16[] memory tokenIds = new uint16[](iter.asUint256());
    string[] memory names = new string[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      if (exists(_inputItems[i].tokenId)) {
        revert ItemAlreadyExists();
      }
      _items[i] = _setItem(_inputItems[i]);
      tokenIds[i] = _inputItems[i].tokenId;
      names[i] = _inputItems[i].name;
    }

    emit AddItemsV2(_items, tokenIds, names);
  }

  function editItems(ItemInput[] calldata _inputItems) external onlyOwner {
    ItemOutput[] memory _items = new ItemOutput[](_inputItems.length);
    uint16[] memory tokenIds = new uint16[](_inputItems.length);
    string[] memory names = new string[](_inputItems.length);

    for (uint i = 0; i < _inputItems.length; ++i) {
      _items[i] = _editItem(_inputItems[i]);
      tokenIds[i] = _inputItems[i].tokenId;
      names[i] = _inputItems[i].name;
    }

    emit EditItemsV2(_items, tokenIds, names);
  }

  // This should be only used when an item is not in active use
  // because it could mess up queued actions potentially
  function removeItems(uint16[] calldata _itemTokenIds) external onlyOwner {
    for (uint i = 0; i < _itemTokenIds.length; ++i) {
      if (!exists(_itemTokenIds[i])) {
        revert ItemDoesNotExist(_itemTokenIds[i]);
      }
      delete items[_itemTokenIds[i]];
      delete tokenURIs[_itemTokenIds[i]];
    }

    emit RemoveItemsV2(_itemTokenIds);
  }

  function setPlayers(address _players) external onlyOwner {
    players = _players;
  }

  function setBankFactory(IBankFactory _bankFactory) external onlyOwner {
    bankFactory = _bankFactory;
  }

  function setPromotions(address _promotions) external onlyOwner {
    promotions = _promotions;
  }

  function setInstantActions(address _instantActions) external onlyOwner {
    instantActions = _instantActions;
  }

  function setInstantVRFActions(address _instantVRFActions) external onlyOwner {
    instantVRFActions = _instantVRFActions;
  }

  function setTerritoriesAndLockedBankVaults(address _territories, address _lockedBankVaults) external onlyOwner {
    territories = _territories;
    lockedBankVaults = _lockedBankVaults;
  }

  function setBaseURI(string calldata _baseURI) external onlyOwner {
    baseURI = _baseURI;
  }

  function setBazaar(address _bazaar) external onlyOwner {
    bazaar = _bazaar;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function testMint(address _to, uint _tokenId, uint _amount) external isAdminAndBeta {
    _mintItem(_to, _tokenId, _amount);
  }

  function testMints(address _to, uint[] calldata _tokenIds, uint[] calldata _amounts) external isAdminAndBeta {
    _mintBatchItems(_to, _tokenIds, _amounts);
  }

  function airdrop(address[] calldata _tos, uint _tokenId, uint[] calldata _amounts) external onlyOwner {
    if (_tos.length != _amounts.length) {
      revert LengthMismatch();
    }
    for (uint i = 0; i < _tos.length; ++i) {
      _mintItem(_tos[i], _tokenId, _amounts[i]);
    }
  }
}
