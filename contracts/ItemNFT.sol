// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155Upgradeable} from "./ozUpgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {IItemNFT} from "./interfaces/IItemNFT.sol";
import {ItemNFTLibrary} from "./ItemNFTLibrary.sol";
import {IBankFactory} from "./interfaces/IBankFactory.sol";
import {World} from "./World.sol";
import {AdminAccess} from "./AdminAccess.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// The NFT contract contains data related to the items and who owns them
contract ItemNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IERC2981, IItemNFT {
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

  World private _world; // Used by the promotions contract....
  bool private _isBeta;
  string private _baseURI;

  // How many of this item exist
  mapping(uint256 itemId => uint256 amount) private _itemBalances;
  mapping(uint256 itemId => uint256 timestamp) private _timestampFirstMint;

  address private _players;
  address private _shop;
  uint16 private _totalSupplyAll_;

  // Royalties
  address private _royaltyReceiver;
  uint8 private _royaltyFee; // base 1000, highest is 25.5

  mapping(uint256 itemId => string tokenURI) private _tokenURIs;
  mapping(uint256 itemId => CombatStats combatStats) private _combatStats;
  mapping(uint256 itemId => Item item) private _items;

  AdminAccess private _adminAccess;
  IBankFactory private _bankFactory;
  address private _promotions;
  address private _instantActions;
  address private _territories;
  address private _lockedBankVaults;
  address private _bazaar;
  address private _instantVRFActions;
  address private _passiveActions;

  modifier onlyMinters() {
    address sender = _msgSender();
    if (
      sender != _players &&
      sender != _shop &&
      sender != _promotions &&
      sender != _instantActions &&
      sender != _instantVRFActions &&
      sender != _passiveActions
    ) {
      revert NotMinter();
    }
    _;
  }

  modifier onlyBurners(address _from) {
    address sender = _msgSender();
    if (
      sender != _from &&
      !isApprovedForAll(_from, sender) &&
      sender != _players &&
      sender != _shop &&
      sender != _instantActions &&
      sender != _instantVRFActions &&
      sender != _territories &&
      sender != _lockedBankVaults &&
      sender != _passiveActions
    ) {
      revert NotBurner();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(_adminAccess.isAdmin(_msgSender()) && _isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    World world,
    address shop,
    address royaltyReceiver,
    AdminAccess adminAccess,
    string calldata baseURI,
    bool isBeta
  ) external initializer {
    __ERC1155_init("");
    __UUPSUpgradeable_init();
    __Ownable_init();

    _world = world;
    _shop = shop;
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

  function burn(address _from, uint256 tokenId, uint256 _amount) external override onlyBurners(_from) {
    _burn(_from, tokenId, _amount);
  }

  function _getMinRequirement(uint16 tokenId) private view returns (Skill, uint32, bool isFullModeOnly) {
    return (_items[tokenId].skill, _items[tokenId].minXP, _isItemFullMode(tokenId));
  }

  function _isItemFullMode(uint256 tokenId) private view returns (bool) {
    return uint8(_items[tokenId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _premint(uint256 tokenId, uint256 _amount) private returns (uint256 numNewUniqueItems) {
    if (tokenId >= type(uint16).max) {
      revert IdTooHigh();
    }
    uint256 existingBalance = _itemBalances[tokenId];
    if (existingBalance == 0) {
      // Brand new item
      _timestampFirstMint[tokenId] = block.timestamp;
      numNewUniqueItems = numNewUniqueItems.inc();
    }
    _itemBalances[tokenId] = existingBalance + _amount;
  }

  function _mintItem(address _to, uint256 tokenId, uint256 _amount) internal {
    uint256 newlyMintedItems = _premint(tokenId, _amount);
    if (newlyMintedItems != 0) {
      _totalSupplyAll_ = uint16(_totalSupplyAll_.inc());
    }
    _mint(_to, uint256(tokenId), _amount, "");
  }

  function _mintBatchItems(address _to, uint256[] memory tokenIds, uint256[] memory _amounts) internal {
    U256 numNewItems;
    U256 tokenIdsLength = tokenIds.length.asU256();
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      numNewItems = numNewItems.add(_premint(tokenIds[i], _amounts[i]));
    }
    if (numNewItems.neq(0)) {
      _totalSupplyAll_ = uint16(_totalSupplyAll_.add(numNewItems.asUint16()));
    }
    _mintBatch(_to, tokenIds, _amounts, "");
  }

  function safeBulkTransfer(BulkTransferInfo[] calldata _nftsInfo) external {
    if (_nftsInfo.length == 0) {
      return;
    }
    for (uint256 i = 0; i < _nftsInfo.length; ++i) {
      BulkTransferInfo memory nftsInfo = _nftsInfo[i];
      address to = nftsInfo.to;
      if (nftsInfo.tokenIds.length == 1) {
        safeTransferFrom(_msgSender(), to, nftsInfo.tokenIds[0], nftsInfo.amounts[0], "");
      } else {
        safeBatchTransferFrom(_msgSender(), to, nftsInfo.tokenIds, nftsInfo.amounts, "");
      }
    }
  }

  function _getItem(uint16 tokenId) private view returns (Item storage) {
    if (!exists(tokenId)) {
      revert ItemDoesNotExist(tokenId);
    }
    return _items[tokenId];
  }

  // If an item is burnt, remove it from the total
  function _removeAnyBurntFromTotal(uint256[] memory _ids, uint256[] memory _amounts) private {
    U256 iter = _ids.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      uint256 newBalance = _itemBalances[_ids[i]] - _amounts[i];
      if (newBalance == 0) {
        _totalSupplyAll_ = uint16(_totalSupplyAll_.dec());
      }
      _itemBalances[_ids[i]] = newBalance;
    }
  }

  function _checkIsTransferable(address _from, uint256[] memory _ids) private view {
    U256 iter = _ids.length.asU256();
    bool anyNonTransferable;
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      if (exists(_ids[i]) && !_items[_ids[i]].isTransferable) {
        anyNonTransferable = true;
      }
    }

    if (anyNonTransferable && (address(_bankFactory) == address(0) || !_bankFactory.createdHere(_from))) {
      // Check if this is from a bank, that's the only place it's allowed to withdraw non-transferable items
      revert ItemNotTransferable();
    }
  }

  function _beforeTokenTransfer(
    address /*_operator*/,
    address _from,
    address _to,
    uint256[] memory _ids,
    uint256[] memory _amounts,
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
    if (_players == address(0)) {
      if (block.chainid != 31337) {
        revert InvalidChainId();
      }
    }
  }

  function _setItem(ItemInput calldata input) private returns (ItemOutput memory item) {
    if (input.tokenId == 0) {
      revert InvalidTokenId();
    }
    ItemNFTLibrary.setItem(input, _items[input.tokenId]);
    _tokenURIs[input.tokenId] = input.metadataURI;

    item = ItemOutput({
      equipPosition: input.equipPosition,
      isFullModeOnly: input.isFullModeOnly,
      isTransferable: input.isTransferable,
      healthRestored: input.healthRestored,
      boostType: input.boostType,
      boostValue: input.boostValue,
      boostDuration: input.boostDuration,
      melee: input.combatStats.melee,
      ranged: input.combatStats.ranged,
      magic: input.combatStats.magic,
      meleeDefence: input.combatStats.meleeDefence,
      rangedDefence: input.combatStats.rangedDefence,
      magicDefence: input.combatStats.magicDefence,
      health: input.combatStats.health,
      skill: input.skill,
      minXP: input.minXP
    });
  }

  function _editItem(ItemInput calldata inputItem) private returns (ItemOutput memory item) {
    if (!exists(inputItem.tokenId)) {
      revert ItemDoesNotExist(inputItem.tokenId);
    }
    EquipPosition oldPosition = _items[inputItem.tokenId].equipPosition;
    EquipPosition newPosition = inputItem.equipPosition;

    bool isRightHandPositionSwapWithBothHands = (oldPosition == EquipPosition.RIGHT_HAND &&
      newPosition == EquipPosition.BOTH_HANDS) ||
      (oldPosition == EquipPosition.BOTH_HANDS && newPosition == EquipPosition.RIGHT_HAND);

    // Allowed to go from BOTH_HANDS to RIGHT_HAND or RIGHT_HAND to BOTH_HANDS
    if (oldPosition != newPosition && oldPosition != EquipPosition.NONE && !isRightHandPositionSwapWithBothHands) {
      revert EquipmentPositionShouldNotChange();
    }
    item = _setItem(inputItem);
  }

  function uri(uint256 tokenId) public view virtual override returns (string memory) {
    if (!exists(tokenId)) {
      revert ItemDoesNotExist(uint16(tokenId));
    }
    return string(abi.encodePacked(_baseURI, _tokenURIs[tokenId]));
  }

  function exists(uint256 tokenId) public view override returns (bool) {
    return _items[tokenId].packedData != 0;
  }

  function totalSupply(uint256 tokenId) external view returns (uint256) {
    return _itemBalances[tokenId];
  }

  function totalSupply() external view override returns (uint256) {
    return _totalSupplyAll_;
  }

  function getItem(uint16 tokenId) external view override returns (Item memory) {
    return _getItem(tokenId);
  }

  function getItems(uint16[] calldata tokenIds) external view override returns (Item[] memory items) {
    U256 tokenIdsLength = tokenIds.length.asU256();
    items = new Item[](tokenIdsLength.asUint256());
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      items[i] = _getItem(tokenIds[i]);
    }
  }

  function getItemBalance(uint256 tokenId) external view override returns (uint256) {
    return _itemBalances[tokenId];
  }

  function getTimestampFirstMint(uint256 tokenId) external view override returns (uint256) {
    return _timestampFirstMint[tokenId];
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
    U256 tokenIdsLength = tokenIds.length.asU256();
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      (skills[i], minXPs[i], isFullModeOnly[i]) = _getMinRequirement(tokenIds[i]);
    }
  }

  function getEquipPositions(uint16[] calldata tokenIds) external view returns (EquipPosition[] memory equipPositions) {
    U256 tokenIdsLength = tokenIds.length.asU256();
    equipPositions = new EquipPosition[](tokenIdsLength.asUint256());
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint256 i = iter.asUint256();
      equipPositions[i] = getEquipPosition(tokenIds[i]);
    }
  }

  function getEquipPosition(uint16 tokenId) public view returns (EquipPosition) {
    if (!exists(tokenId)) {
      revert ItemDoesNotExist(tokenId);
    }
    return _items[tokenId].equipPosition;
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(
    address _account,
    uint16[] memory _ids
  ) external view override returns (uint256[] memory batchBalances) {
    U256 iter = _ids.length.asU256();
    batchBalances = new uint256[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      batchBalances[i] = balanceOf(_account, _ids[i]);
    }
  }

  function balanceOf(address account, uint256 id) public view override(IItemNFT, ERC1155Upgradeable) returns (uint256) {
    return ERC1155Upgradeable.balanceOf(account, id);
  }

  function royaltyInfo(
    uint256 /*tokenId*/,
    uint256 _salePrice
  ) external view override returns (address receiver, uint256 royaltyAmount) {
    uint256 amount = (_salePrice * _royaltyFee) / 1000;
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
    return super.isApprovedForAll(account, operator) || operator == _bazaar;
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

  function getPlayersAddress() external view returns (address) {
    return _players;
  }

  function getWorld() external view returns (World) {
    return _world;
  }

  function addItems(ItemInput[] calldata _inputItems) external onlyOwner {
    U256 iter = _inputItems.length.asU256();
    ItemOutput[] memory items = new ItemOutput[](iter.asUint256());
    uint16[] memory tokenIds = new uint16[](iter.asUint256());
    string[] memory names = new string[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      if (exists(_inputItems[i].tokenId)) {
        revert ItemAlreadyExists();
      }
      items[i] = _setItem(_inputItems[i]);
      tokenIds[i] = _inputItems[i].tokenId;
      names[i] = _inputItems[i].name;
    }

    emit AddItemsV2(items, tokenIds, names);
  }

  function editItems(ItemInput[] calldata _inputItems) external onlyOwner {
    ItemOutput[] memory items = new ItemOutput[](_inputItems.length);
    uint16[] memory tokenIds = new uint16[](_inputItems.length);
    string[] memory names = new string[](_inputItems.length);

    for (uint256 i = 0; i < _inputItems.length; ++i) {
      items[i] = _editItem(_inputItems[i]);
      tokenIds[i] = _inputItems[i].tokenId;
      names[i] = _inputItems[i].name;
    }

    emit EditItemsV2(items, tokenIds, names);
  }

  // This should be only used when an item is not in active use
  // because it could mess up queued actions potentially
  function removeItems(uint16[] calldata _itemTokenIds) external onlyOwner {
    for (uint256 i = 0; i < _itemTokenIds.length; ++i) {
      if (!exists(_itemTokenIds[i])) {
        revert ItemDoesNotExist(_itemTokenIds[i]);
      }
      delete _items[_itemTokenIds[i]];
      delete _tokenURIs[_itemTokenIds[i]];
    }

    emit RemoveItemsV2(_itemTokenIds);
  }

  function setPlayers(address players) external onlyOwner {
    _players = players;
  }

  function setBankFactory(IBankFactory bankFactory) external onlyOwner {
    _bankFactory = bankFactory;
  }

  function setPromotions(address promotions) external onlyOwner {
    _promotions = promotions;
  }

  function setPassiveActions(address passiveActions) external onlyOwner {
    _passiveActions = passiveActions;
  }

  function setInstantActions(address instantActions) external onlyOwner {
    _instantActions = instantActions;
  }

  function setInstantVRFActions(address instantVRFActions) external onlyOwner {
    _instantVRFActions = instantVRFActions;
  }

  function setTerritoriesAndLockedBankVaults(address territories, address lockedBankVaults) external onlyOwner {
    _territories = territories;
    _lockedBankVaults = lockedBankVaults;
  }

  function setBaseURI(string calldata baseURI) external onlyOwner {
    _baseURI = baseURI;
  }

  function setBazaar(address bazaar) external onlyOwner {
    _bazaar = bazaar;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function testMint(address _to, uint256 tokenId, uint256 _amount) external isAdminAndBeta {
    _mintItem(_to, tokenId, _amount);
  }

  function testMints(address _to, uint256[] calldata tokenIds, uint256[] calldata _amounts) external isAdminAndBeta {
    _mintBatchItems(_to, tokenIds, _amounts);
  }

  function airdrop(address[] calldata _tos, uint256 tokenId, uint256[] calldata _amounts) external onlyOwner {
    if (_tos.length != _amounts.length) {
      revert LengthMismatch();
    }
    for (uint256 i = 0; i < _tos.length; ++i) {
      _mintItem(_tos[i], tokenId, _amounts[i]);
    }
  }
}
