// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155Upgradeable} from "./ozUpgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {ItemNFTLibrary} from "./ItemNFTLibrary.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
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

  event AddItem(Item item, uint16 tokenId, string name);
  event AddItems(Item[] items, uint16[] tokenIds, string[] names);
  event EditItem(Item item, uint16 tokenId, string name);
  event EditItems(Item[] items, uint16[] tokenIds, string[] names);

  error IdTooHigh();
  error ItemNotTransferable();
  error InvalidChainId();
  error InvalidTokenId();
  error ItemAlreadyExists();
  error ItemDoesNotExist(uint16);
  error EquipmentPositionShouldNotChange();
  error OnlyForHardhat();
  error NotAllowedHardhat();
  error ERC1155ReceiverNotApproved();
  error NotPlayersOrShop();
  error NotAdminAndBeta();

  World private world;
  bool private isBeta;
  string private baseURI;

  // How many of this item exist
  mapping(uint itemId => uint amount) public itemBalances;
  mapping(uint itemId => uint timestamp) public timestampFirstMint;

  address private players;
  address private shop;
  uint16 public numUniqueItems;

  // Royalties
  address private royaltyReceiver;
  uint8 private royaltyFee; // base 1000, highest is 25.5

  mapping(uint itemId => string tokenURI) private tokenURIs;
  mapping(uint itemId => CombatStats combatStats) private combatStats;
  mapping(uint itemId => Item item) private items;

  AdminAccess private adminAccess;
  IBankFactory private bankFactory;

  modifier onlyPlayersOrShop() {
    if (_msgSender() != players && _msgSender() != shop) {
      revert NotPlayersOrShop();
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
  ) public initializer {
    __ERC1155_init("");
    __Ownable_init();
    __UUPSUpgradeable_init();
    world = _world;
    shop = _shop;
    baseURI = _baseURI;
    royaltyFee = 30; // 3%
    royaltyReceiver = _royaltyReceiver;
    adminAccess = _adminAccess;
    isBeta = _isBeta;
  }

  // Can't use Item[] array unfortunately as they don't support array casts
  function mintBatch(address _to, uint[] calldata _ids, uint[] calldata _amounts) external onlyPlayersOrShop {
    _mintBatchItems(_to, _ids, _amounts);
  }

  function uri(uint _tokenId) public view virtual override returns (string memory) {
    if (!exists(_tokenId)) {
      revert ItemDoesNotExist(uint16(_tokenId));
    }
    return string(abi.encodePacked(baseURI, tokenURIs[_tokenId]));
  }

  function exists(uint _tokenId) public view returns (bool) {
    return items[_tokenId].exists;
  }

  function getItem(uint16 _tokenId) external view returns (Item memory) {
    return _getItem(_tokenId);
  }

  function getEquipPositionAndMinRequirement(
    uint16 _item
  ) external view returns (Skill skill, uint32 minXP, EquipPosition equipPosition) {
    (skill, minXP) = _getMinRequirement(_item);
    equipPosition = _getEquipPosition(_item);
  }

  function getMinRequirements(
    uint16[] calldata _tokenIds
  ) external view returns (Skill[] memory skills, uint32[] memory minXPs) {
    skills = new Skill[](_tokenIds.length);
    minXPs = new uint32[](_tokenIds.length);
    U256 tokenIdsLength = _tokenIds.length.asU256();
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      (skills[i], minXPs[i]) = _getMinRequirement(_tokenIds[i]);
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
      equipPositions[i] = _getEquipPosition(_tokenIds[i]);
    }
  }

  function _getMinRequirement(uint16 _tokenId) private view returns (Skill, uint32) {
    return (items[_tokenId].skill, items[_tokenId].minXP);
  }

  function _getEquipPosition(uint16 _tokenId) private view returns (EquipPosition) {
    if (!exists(_tokenId)) {
      revert ItemDoesNotExist(_tokenId);
    }
    return items[_tokenId].equipPosition;
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
    if (newlyMintedItems > 0) {
      numUniqueItems = uint16(numUniqueItems.inc());
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
      numUniqueItems = uint16(numUniqueItems.add(numNewItems.asUint16()));
    }
    _mintBatch(_to, _tokenIds, _amounts, "");
  }

  function mint(address _to, uint _tokenId, uint _amount) external onlyPlayersOrShop {
    _mintItem(_to, _tokenId, _amount);
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

  function burnBatch(address _from, uint[] calldata _tokenIds, uint[] calldata _amounts) external {
    if (
      _from != _msgSender() && !isApprovedForAll(_from, _msgSender()) && players != _msgSender() && shop != _msgSender()
    ) {
      revert ERC1155ReceiverNotApproved();
    }
    _burnBatch(_from, _tokenIds, _amounts);
  }

  function burn(address _from, uint _tokenId, uint _amount) external {
    if (
      _from != _msgSender() && !isApprovedForAll(_from, _msgSender()) && players != _msgSender() && shop != _msgSender()
    ) {
      revert ERC1155ReceiverNotApproved();
    }
    _burn(_from, _tokenId, _amount);
  }

  function royaltyInfo(
    uint /*_tokenId*/,
    uint _salePrice
  ) external view override returns (address receiver, uint royaltyAmount) {
    uint amount = (_salePrice * royaltyFee) / 1000;
    return (royaltyReceiver, amount);
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
        numUniqueItems = uint16(numUniqueItems.dec());
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

  function _setItem(InputItem calldata _item) private returns (Item storage item) {
    if (_item.tokenId == 0) {
      revert InvalidTokenId();
    }
    ItemNFTLibrary.setItem(_item, items[_item.tokenId]);
    item = items[_item.tokenId];
    tokenURIs[_item.tokenId] = _item.metadataURI;
  }

  function getBoostInfo(uint16 _tokenId) external view returns (uint16 boostValue, uint24 boostDuration) {
    Item storage item = _getItem(_tokenId);
    return (item.boostValue, item.boostDuration);
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

  // Or make it constants and redeploy the contracts
  function addItem(InputItem calldata _inputItem) external onlyOwner {
    if (exists(_inputItem.tokenId)) {
      revert ItemAlreadyExists();
    }
    Item storage item = _setItem(_inputItem);
    emit AddItem(item, _inputItem.tokenId, _inputItem.name);
  }

  function addItems(InputItem[] calldata _inputItems) external onlyOwner {
    U256 iter = _inputItems.length.asU256();
    Item[] memory _items = new Item[](iter.asUint256());
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
    emit AddItems(_items, tokenIds, names);
  }

  function _editItem(InputItem calldata _inputItem) private returns (Item storage item) {
    if (!exists(_inputItem.tokenId)) {
      revert ItemDoesNotExist(_inputItem.tokenId);
    }
    if (
      items[_inputItem.tokenId].equipPosition != _inputItem.equipPosition &&
      items[_inputItem.tokenId].equipPosition != EquipPosition.NONE
    ) {
      revert EquipmentPositionShouldNotChange();
    }
    item = _setItem(_inputItem);
  }

  function editItem(InputItem calldata _inputItem) external onlyOwner {
    Item storage item = _editItem(_inputItem);
    emit EditItem(item, _inputItem.tokenId, _inputItem.name);
  }

  function editItems(InputItem[] calldata _inputItems) external onlyOwner {
    Item[] memory _items = new Item[](_inputItems.length);
    uint16[] memory tokenIds = new uint16[](_inputItems.length);
    string[] memory names = new string[](_inputItems.length);

    for (uint i = 0; i < _inputItems.length; ++i) {
      _items[i] = _editItem(_inputItems[i]);
      tokenIds[i] = _inputItems[i].tokenId;
      names[i] = _inputItems[i].name;
    }

    emit EditItems(_items, tokenIds, names);
  }

  function setPlayers(address _players) external onlyOwner {
    players = _players;
  }

  function setBankFactory(IBankFactory _bankFactory) external onlyOwner {
    bankFactory = _bankFactory;
  }

  function setBaseURI(string calldata _baseURI) external onlyOwner {
    baseURI = _baseURI;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function testMint(address _to, uint _tokenId, uint _amount) external isAdminAndBeta {
    _mintItem(_to, _tokenId, _amount);
  }

  function testMints(address _to, uint[] calldata _tokenIds, uint[] calldata _amounts) external isAdminAndBeta {
    _mintBatchItems(_to, _tokenIds, _amounts);
  }
}
