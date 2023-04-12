// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {World} from "./World.sol";
import {AdminAccess} from "./AdminAccess.sol";

/* solhint-disable no-global-import */
import "./globals/players.sol";
import "./globals/items.sol";

/* solhint-enable no-global-import */

// The NFT contract contains data related to the items and who owns them
contract ItemNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IERC2981 {
  using UnsafeMath for uint256;
  using UnsafeMath for U256;

  event AddItem(Item item, uint16 tokenId, string name);
  event AddItems(Item[] items, uint16[] tokenIds, string[] names);
  event EditItem(Item item, uint16 tokenId, string name);

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
  error NotAdminAndAlpha();

  // Input only
  struct NonCombatStats {
    Skill skill;
    uint8 diff;
  }

  // Contains everything you need to create an item
  struct InputItem {
    CombatStats combatStats;
    NonCombatStats nonCombatStats;
    uint16 tokenId;
    EquipPosition equipPosition;
    // Can it be transferred?
    bool isTransferable;
    // Minimum requirements in this skill
    Skill skill;
    uint32 minXP;
    // Food
    uint16 healthRestored;
    // Boost
    BoostType boostType;
    uint16 boostValue; // Varies, could be the % increase
    uint24 boostDuration; // How long the effect of the boost vial last
    // uri
    string metadataURI;
    string name;
  }

  World private world;
  bool private isAlpha;
  string private baseURI;

  // How many of this item exist
  mapping(uint itemId => uint amount) public itemBalances;
  mapping(uint itemId => uint timestamp) public timestampFirstMint;

  address private players;
  address private shop;

  // Royalties
  uint public royaltyFee;
  address public royaltyReceiver;

  uint public numUniqueItems;

  mapping(uint itemId => string tokenURI) private tokenURIs;
  mapping(uint itemId => CombatStats combatStats) public combatStats;
  mapping(uint itemId => Item item) public items;

  AdminAccess private adminAccess;

  modifier onlyPlayersOrShop() {
    if (_msgSender() != players && _msgSender() != shop) {
      revert NotPlayersOrShop();
    }
    _;
  }

  modifier isAdminAndAlpha() {
    if (!(adminAccess.isAdmin(_msgSender()) && isAlpha)) {
      revert NotAdminAndAlpha();
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
    bool _isAlpha
  ) public initializer {
    __ERC1155_init("");
    __Ownable_init();
    __UUPSUpgradeable_init();
    world = _world;
    shop = _shop;
    baseURI = _baseURI;
    royaltyFee = 250; // 2.5%
    royaltyReceiver = _royaltyReceiver;
    adminAccess = _adminAccess;
    isAlpha = _isAlpha;
  }

  function _mintItem(address _to, uint _tokenId, uint256 _amount) internal {
    if (_tokenId >= type(uint16).max) {
      revert IdTooHigh();
    }
    uint existingBalance = itemBalances[_tokenId];
    if (existingBalance == 0) {
      // First mint
      timestampFirstMint[_tokenId] = block.timestamp;
      numUniqueItems = numUniqueItems.inc();
    }

    itemBalances[_tokenId] = existingBalance + _amount;
    _mint(_to, uint(_tokenId), _amount, "");
  }

  function _mintBatchItems(address _to, uint[] calldata _tokenIds, uint[] calldata _amounts) internal {
    U256 numNewItems;
    U256 tokenIdsLength = U256.wrap(_tokenIds.length);
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      uint tokenId = _tokenIds[i];
      if (tokenId >= type(uint16).max) {
        revert IdTooHigh();
      }
      uint existingBalance = itemBalances[tokenId];
      if (existingBalance == 0) {
        // Brand new item
        numNewItems = numNewItems.inc();
      }

      itemBalances[tokenId] = existingBalance + _amounts[i];
    }
    if (numNewItems.neq(0)) {
      numUniqueItems += numNewItems.asUint256();
    }
    _mintBatch(_to, _tokenIds, _amounts, "");
  }

  function mint(address _to, uint _tokenId, uint256 _amount) external onlyPlayersOrShop {
    _mintItem(_to, _tokenId, _amount);
  }

  // Can't use Item[] array unfortunately as they don't support array casts
  function mintBatch(address _to, uint[] calldata _ids, uint256[] calldata _amounts) external onlyPlayersOrShop {
    _mintBatchItems(_to, _ids, _amounts);
  }

  function uri(uint256 _tokenId) public view virtual override returns (string memory) {
    if (!exists(_tokenId)) {
      revert ItemDoesNotExist(uint16(_tokenId));
    }
    return string(abi.encodePacked(baseURI, tokenURIs[_tokenId]));
  }

  function exists(uint _tokenId) public view returns (bool) {
    return items[_tokenId].exists;
  }

  function _getItem(uint16 _tokenId) private view returns (Item memory) {
    if (!exists(_tokenId)) {
      revert ItemDoesNotExist(_tokenId);
    }
    return items[_tokenId];
  }

  function getItem(uint16 _tokenId) external view returns (Item memory) {
    return _getItem(_tokenId);
  }

  function getMinRequirement(uint16 _tokenId) public view returns (Skill, uint32) {
    return (items[_tokenId].skill, items[_tokenId].minXP);
  }

  function getEquipPosition(uint16 _tokenId) public view returns (EquipPosition) {
    if (!exists(_tokenId)) {
      revert ItemDoesNotExist(_tokenId);
    }
    return items[_tokenId].equipPosition;
  }

  function getMinRequirements(
    uint16[] calldata _tokenIds
  ) external view returns (Skill[] memory skills, uint32[] memory minXPs) {
    skills = new Skill[](_tokenIds.length);
    minXPs = new uint32[](_tokenIds.length);
    U256 tokenIdsLength = U256.wrap(_tokenIds.length);
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      (skills[i], minXPs[i]) = getMinRequirement(_tokenIds[i]);
    }
  }

  function getItems(uint16[] calldata _tokenIds) external view returns (Item[] memory _items) {
    U256 tokenIdsLength = U256.wrap(_tokenIds.length);
    _items = new Item[](tokenIdsLength.asUint256());
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      _items[i] = _getItem(_tokenIds[i]);
    }
  }

  function getEquipPositions(
    uint16[] calldata _tokenIds
  ) external view returns (EquipPosition[] memory equipPositions) {
    U256 tokenIdsLength = U256.wrap(_tokenIds.length);
    equipPositions = new EquipPosition[](tokenIdsLength.asUint256());
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      equipPositions[i] = getEquipPosition(_tokenIds[i]);
    }
  }

  // If an item is burnt, remove it from the total
  function _removeAnyBurntFromTotal(uint[] memory _ids, uint[] memory _amounts) private {
    U256 iter = U256.wrap(_ids.length);
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      uint newBalance = itemBalances[_ids[i]] - _amounts[i];
      if (newBalance == 0) {
        numUniqueItems = numUniqueItems.dec();
      }
      itemBalances[_ids[i]] = newBalance;
    }
  }

  function _checkIsTransferable(uint[] memory _ids) private view {
    U256 iter = U256.wrap(_ids.length);
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      if (exists(_ids[i]) && !items[_ids[i]].isTransferable) {
        revert ItemNotTransferable();
      }
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
      _checkIsTransferable(_ids);
    }
    if (players == address(0)) {
      if (block.chainid != 31337) {
        revert InvalidChainId();
      }
    }
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(address _account, uint16[] memory _ids) external view returns (uint256[] memory batchBalances) {
    U256 iter = U256.wrap(_ids.length);
    batchBalances = new uint256[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      batchBalances[i] = balanceOf(_account, _ids[i]);
    }
  }

  function burn(address _from, uint _tokenId, uint _quantity) external {
    if (
      _from != _msgSender() && !isApprovedForAll(_from, _msgSender()) && players != _msgSender() && shop != _msgSender()
    ) {
      revert ERC1155ReceiverNotApproved();
    }
    _burn(_from, _tokenId, _quantity);
  }

  function _setItem(InputItem calldata _item) private returns (Item storage item) {
    if (_item.tokenId == 0) {
      revert InvalidTokenId();
    }
    bool hasCombat;
    CombatStats calldata _combatStats = _item.combatStats;
    assembly ("memory-safe") {
      hasCombat := not(iszero(_combatStats))
    }
    item = items[_item.tokenId];
    item.equipPosition = _item.equipPosition;
    item.isTransferable = _item.isTransferable;
    item.exists = true;

    if (hasCombat) {
      // Combat stats
      item.melee = _item.combatStats.melee;
      item.magic = _item.combatStats.magic;
      item.range = _item.combatStats.range;
      item.meleeDefence = _item.combatStats.meleeDefence;
      item.magicDefence = _item.combatStats.magicDefence;
      item.rangeDefence = _item.combatStats.rangeDefence;
      item.health = _item.combatStats.health;
    }
    item.skill1 = _item.nonCombatStats.skill;
    item.skillDiff1 = _item.nonCombatStats.diff;

    if (_item.healthRestored != 0) {
      item.healthRestored = _item.healthRestored;
    }

    if (_item.boostType != BoostType.NONE) {
      item.boostType = _item.boostType;
      item.boostValue = _item.boostValue;
      item.boostDuration = _item.boostDuration;
    }

    item.minXP = _item.minXP;
    item.skill = _item.skill;
    tokenURIs[_item.tokenId] = _item.metadataURI;
  }

  function royaltyInfo(
    uint256 /*_tokenId*/,
    uint256 _salePrice
  ) external view override returns (address receiver, uint256 royaltyAmount) {
    uint256 amount = (_salePrice * royaltyFee) / 10000;
    return (royaltyReceiver, amount);
  }

  function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC1155Upgradeable) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked("Estfor Items", isAlpha ? " (Alpha)" : ""));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked("EK_I", isAlpha ? "A" : ""));
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
    U256 iter = U256.wrap(_inputItems.length);
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

  function editItem(InputItem calldata _inputItem) external onlyOwner {
    if (!exists(_inputItem.tokenId)) {
      revert ItemDoesNotExist(_inputItem.tokenId);
    }
    if (
      items[_inputItem.tokenId].equipPosition != _inputItem.equipPosition &&
      items[_inputItem.tokenId].equipPosition != EquipPosition.NONE
    ) {
      revert EquipmentPositionShouldNotChange();
    }
    Item storage item = _setItem(_inputItem);
    emit EditItem(item, _inputItem.tokenId, _inputItem.name);
  }

  function setPlayers(address _players) external onlyOwner {
    players = _players;
  }

  function setBaseURI(string calldata _baseURI) external onlyOwner {
    baseURI = _baseURI;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  function testMint(address _to, uint _tokenId, uint _amount) external isAdminAndAlpha {
    _mintItem(_to, _tokenId, _amount);
  }

  function testMints(address _to, uint[] calldata _tokenIds, uint[] calldata _amounts) external isAdminAndAlpha {
    _mintBatchItems(_to, _tokenIds, _amounts);
  }
}
