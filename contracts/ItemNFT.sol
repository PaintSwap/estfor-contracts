// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {UnsafeMath} from "./lib/UnsafeMath.sol";
import {Unsafe256, U256} from "./lib/Unsafe256.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {World} from "./World.sol";

import "./types.sol";
import "./items.sol";

// The NFT contract contains data related to the items and who owns them
contract ItemNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IERC2981, Multicall {
  using UnsafeMath for uint256;
  using Unsafe256 for U256;

  event AddItem(Item item, uint16 tokenId);
  event AddItems(Item[] items, uint16[] tokenIds);
  event EditItem(Item item, uint16 tokenId);

  error IdTooHigh();
  error ItemNotTransferable();
  error InvalidChainId();
  error InvalidTokenId();
  error ItemAlreadyExists();
  error ItemDoesNotExist();
  error EquipmentPositionShouldNotChange();
  error OnlyForHardhat();
  error NotAllowedHardhat();
  error ERC1155ReceiverNotApproved();
  error NotPlayersOrShop();

  // Input only
  struct NonCombatStats {
    Skill skill;
    int16 diff;
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
    uint32 minSkillPoints;
    // Food
    uint16 healthRestored;
    // Boost
    BoostType boostType;
    uint16 boostValue; // Varies, could be the % increase
    uint24 boostDuration; // How long the effect of the boost vial last
    // uri
    string metadataURI;
  }

  World world;
  string private baseURI;

  // How many of this item exist
  mapping(uint itemId => uint amount) public itemBalances;

  address players;
  address shop;

  // Royalties
  uint public royaltyFee;
  address public royaltyReceiver;

  uint public uniqueItems; // unique number of items

  mapping(uint itemId => string tokenURI) private tokenURIs;
  mapping(uint itemId => CombatStats combatStats) combatStats;
  mapping(uint itemId => Item) items;

  modifier onlyPlayersOrShop() {
    if (msg.sender != players && msg.sender != shop) {
      revert NotPlayersOrShop();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(World _world, address _shop, address _royaltyReceiver) public initializer {
    __ERC1155_init("");
    __Ownable_init();
    __UUPSUpgradeable_init();
    world = _world;
    shop = _shop;
    baseURI = "ipfs://";
    royaltyFee = 250; // 2.5%
    royaltyReceiver = _royaltyReceiver;
  }

  function _mintItem1() internal {}

  function _mintItem(address _to, uint _tokenId, uint256 _amount) internal {
    if (_tokenId >= type(uint16).max) {
      revert IdTooHigh();
    }
    //    require(_exists(_tokenId));
    uint existingBalance = itemBalances[_tokenId];
    if (existingBalance == 0) {
      uniqueItems = uniqueItems.unsafe_increment();
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
      //      require(_exists(_tokenIds[i]));
      uint existingBalance = itemBalances[tokenId];
      if (existingBalance == 0) {
        // Brand new item
        numNewItems = numNewItems.inc();
      }

      itemBalances[tokenId] = existingBalance + _amounts[i];
    }
    if (numNewItems.neq(0)) {
      uniqueItems += numNewItems.asUint256();
    }
    _mintBatch(_to, _tokenIds, _amounts, "");
  }

  function mint(address _to, uint _tokenId, uint256 _amount) external onlyPlayersOrShop {
    _mintItem(_to, _tokenId, _amount);
  }

  // Can't use Item[] array unfortunately so they don't support array casts
  function mintBatch(address _to, uint[] calldata _ids, uint256[] calldata _amounts) external onlyPlayersOrShop {
    _mintBatchItems(_to, _ids, _amounts);
  }

  function uri(uint256 _tokenId) public view virtual override returns (string memory) {
    if (!_exists(_tokenId)) {
      revert ItemDoesNotExist();
    }
    return string(abi.encodePacked(baseURI, tokenURIs[_tokenId]));
  }

  function _exists(uint _tokenId) private view returns (bool) {
    return items[_tokenId].equipPosition != EquipPosition.NONE;
  }

  function _getItem(uint _tokenId) private view returns (Item memory) {
    if (!_exists(_tokenId)) {
      revert ItemDoesNotExist();
    }
    return items[_tokenId];
  }

  function getItem(uint16 _tokenId) external view returns (Item memory) {
    return _getItem(_tokenId);
  }

  function getMinRequirement(uint16 _tokenId) public view returns (Skill, uint32) {
    return (items[_tokenId].skill, items[_tokenId].minSkillPoints);
  }

  function getEquipPosition(uint16 _tokenId) public view returns (EquipPosition) {
    if (!_exists(_tokenId)) {
      revert ItemDoesNotExist();
    }
    return items[_tokenId].equipPosition;
  }

  function getMinRequirements(
    uint16[] calldata _tokenIds
  ) external view returns (Skill[] memory skills, uint32[] memory minSkillPoints) {
    skills = new Skill[](_tokenIds.length);
    minSkillPoints = new uint32[](_tokenIds.length);
    U256 tokenIdsLength = U256.wrap(_tokenIds.length);
    for (U256 iter; iter < tokenIdsLength; iter = iter.inc()) {
      uint i = iter.asUint256();
      (skills[i], minSkillPoints[i]) = getMinRequirement(_tokenIds[i]);
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
      itemBalances[_ids[i]] -= _amounts[i];
    }
  }

  function _checkIsTransferable(uint[] memory _ids) private view {
    U256 iter = U256.wrap(_ids.length);
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      if (_exists(_ids[i]) && !items[_ids[i]].isTransferable) {
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
    if (players != address(0)) {
      IPlayers(players).itemBeforeTokenTransfer(_from, _ids, _amounts);
    } else {
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

    if (hasCombat) {
      // Combat stats
      item.melee = int8(_item.combatStats.melee);
      item.magic = int8(_item.combatStats.magic);
      item.range = int8(_item.combatStats.range);
      item.meleeDefence = int8(_item.combatStats.meleeDefence);
      item.magicDefence = int8(_item.combatStats.magicDefence);
      item.rangeDefence = int8(_item.combatStats.rangeDefence);
      item.health = int8(_item.combatStats.health);
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

    item.minSkillPoints = _item.minSkillPoints;
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

  function setRoyaltyReceiver(address _receiver) external onlyOwner {
    royaltyReceiver = _receiver;
  }

  // Or make it constants and redeploy the contracts
  function addItem(InputItem calldata _inputItem) external onlyOwner {
    if (_exists(_inputItem.tokenId)) {
      revert ItemAlreadyExists();
    }
    Item storage item = _setItem(_inputItem);
    emit AddItem(item, _inputItem.tokenId);
  }

  function addItems(InputItem[] calldata _inputItems) external onlyOwner {
    U256 iter = U256.wrap(_inputItems.length);
    Item[] memory _items = new Item[](iter.asUint256());
    uint16[] memory tokenIds = new uint16[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      if (_exists(_inputItems[i].tokenId)) {
        revert ItemAlreadyExists();
      }
      _items[i] = _setItem(_inputItems[i]);
      tokenIds[i] = _inputItems[i].tokenId;
    }
    emit AddItems(_items, tokenIds);
  }

  function editItem(InputItem calldata _inputItem) external onlyOwner {
    if (!_exists(_inputItem.tokenId)) {
      revert ItemDoesNotExist();
    }
    if (items[_inputItem.tokenId].equipPosition != _inputItem.equipPosition) {
      revert EquipmentPositionShouldNotChange();
    }
    Item storage item = _setItem(_inputItem);
    emit EditItem(item, _inputItem.tokenId);
  }

  function setPlayers(address _players) external onlyOwner {
    players = _players;
  }

  function setBaseURI(string calldata _baseURI) external onlyOwner {
    _setURI(_baseURI);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  modifier isHardhat() {
    if (block.chainid != 31337) {
      revert OnlyForHardhat();
    }
    _;
  }

  modifier isNotHardhat() {
    if (block.chainid == 31337) {
      revert NotAllowedHardhat();
    }
    _;
  }

  // TODO: Remove in live version!! Just using it for live testing atm
  function testMint(address _to, uint _tokenId, uint _amount) external isNotHardhat {
    _mintItem(_to, _tokenId, _amount);
  }

  function testMints(address _to, uint[] calldata _tokenIds, uint[] calldata _amounts) external isNotHardhat {
    _mintBatchItems(_to, _tokenIds, _amounts);
  }

  // These are just to make tests easier to run by allowing arbitrary minting
  function testOnlyMint(address _to, uint _tokenId, uint _amount) external isHardhat {
    _mintItem(_to, _tokenId, _amount);
  }

  function testOnlyMints(address _to, uint[] calldata _tokenIds, uint[] calldata _amounts) external isHardhat {
    _mintBatchItems(_to, _tokenIds, _amounts);
  }
}
