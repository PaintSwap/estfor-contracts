// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "./interfaces/IBrushToken.sol";
import "./World.sol";
import "./types.sol";
import "./items.sol";

// The NFT contract contains data related to the items and who owns them
contract ItemNFT is ERC1155Upgradeable, Multicall, UUPSUpgradeable, OwnableUpgradeable {
  event AddItem(Item item, uint16 tokenId);
  event AddItems(Item[] items, uint16[] tokenIds);
  event EditItem(Item item, uint16 tokenId);

  // Input only
  struct NonCombatStat {
    Skill skill;
    int16 diff;
  }
  // Contains everything you need to create an item
  struct InputItem {
    CombatStats combatStats;
    NonCombatStat[] nonCombatStats;
    uint16 tokenId;
    EquipPosition equipPosition;
    // Food
    uint16 healthRestored;
    // Potion
    BoostType boostType;
    uint16 boostValue; // Varies, could be the % increase
    uint24 boostDuration; // How long the effect of the potion last
    // uri
    string metadataURI;
  }

  World world;
  string private baseURI;

  // How many of this item exist
  mapping(uint => uint) public itemBalances;

  address players;
  address shop;

  uint public uniqueItems; // unique number of items

  mapping(uint => string) private tokenURIs;
  mapping(uint => CombatStats) combatStats;
  mapping(uint => Item) items;

  modifier onlyPlayersOrShop() {
    require(msg.sender == players || msg.sender == shop, "Not players OR shop");
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(World _world, address _shop) public initializer {
    __ERC1155_init("");
    __Ownable_init();
    __UUPSUpgradeable_init();
    world = _world;
    shop = _shop;
    baseURI = "ipfs://";
  }

  function _mintItem(address _to, uint _tokenId, uint256 _amount) internal {
    require(_tokenId < type(uint16).max, "id too high");
    //    require(_exists(_tokenId));
    uint existingBalance = itemBalances[_tokenId];
    if (existingBalance == 0) {
      ++uniqueItems;
    }

    itemBalances[_tokenId] = existingBalance + _amount;
    _mint(_to, uint(_tokenId), _amount, "");
  }

  function _mintBatchItems(address _to, uint[] calldata _tokenIds, uint[] calldata _amounts) internal {
    uint numNewItems;
    for (uint i = 0; i < _tokenIds.length; ++i) {
      uint tokenId = _tokenIds[i];
      require(tokenId < type(uint16).max, "id too high");
      //      require(_exists(_tokenIds[i]));
      uint existingBalance = itemBalances[tokenId];
      if (existingBalance == 0) {
        // Brand new item
        ++numNewItems;
      }

      itemBalances[tokenId] = existingBalance + _amounts[i];
    }
    if (numNewItems > 0) {
      uniqueItems += numNewItems;
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
    require(_exists(_tokenId), "Token does not exist");
    return string(abi.encodePacked(baseURI, tokenURIs[_tokenId]));
  }

  function _exists(uint _tokenId) private view returns (bool) {
    return bytes(tokenURIs[_tokenId]).length != 0;
  }

  function getItem(uint16 _tokenId) external view returns (Item memory) {
    require(items[_tokenId].exists, "Item doesn't exist");
    return items[_tokenId];
  }

  // If an item is burnt, remove it from the total
  function _removeAnyBurntFromTotal(address _to, uint[] memory _ids, uint[] memory _amounts) internal {
    uint i = _ids.length;
    // Precondition is that ids/amounts has some elements
    if (_to == address(0)) {
      // burning
      do {
        unchecked {
          --i;
        }
        itemBalances[_ids[i]] -= _amounts[i];
      } while (i > 0);
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
      // When minting, self sending or transferring then no further processing is required
      return;
    }

    _removeAnyBurntFromTotal(_to, _ids, _amounts);
  }

  function burn(address _from, uint _tokenId, uint _quantity) external {
    require(
      _from == _msgSender() || isApprovedForAll(_from, _msgSender()) || players == _msgSender() || shop == _msgSender(),
      "ERC1155: caller is not token owner, approved , players contract or shop contract"
    );
    _burn(_from, _tokenId, _quantity);
  }

  function _setItem(InputItem calldata _item) private returns (Item storage item) {
    bool hasCombat;
    CombatStats calldata _combatStats = _item.combatStats;
    assembly ("memory-safe") {
      hasCombat := not(iszero(_combatStats))
    }
    bool hasNonCombat = _item.nonCombatStats.length > 0;
    item = items[_item.tokenId];
    item.exists = true;
    item.hasCombatStats = hasCombat;
    item.hasNonCombatStats = hasNonCombat;
    item.equipPosition = _item.equipPosition;

    if (hasCombat) {
      // Combat stats
      item.attack = _item.combatStats.attack;
      item.magic = _item.combatStats.magic;
      item.range = _item.combatStats.range;
      item.meleeDefence = _item.combatStats.meleeDefence;
      item.magicDefence = _item.combatStats.magicDefence;
      item.rangeDefence = _item.combatStats.rangeDefence;
      item.health = _item.combatStats.health;
    }
    if (hasNonCombat) {
      item.skill1 = _item.nonCombatStats[0].skill;
      item.skillDiff1 = _item.nonCombatStats[0].diff;
      // TODO: Add more later if necessary
    }

    if (_item.healthRestored > 0) {
      item.healthRestored = _item.healthRestored;
    }

    if (_item.boostType != BoostType.NONE) {
      item.boostType = _item.boostType;
      item.boostValue = _item.boostValue;
    }
    tokenURIs[_item.tokenId] = _item.metadataURI;
  }

  // Or make it constants and redeploy the contracts
  function addItem(InputItem calldata _inputItem) external onlyOwner {
    require(!_exists(_inputItem.tokenId), "This item was already added");
    Item storage item = _setItem(_inputItem);
    emit AddItem(item, _inputItem.tokenId);
  }

  function addItems(InputItem[] calldata _inputItems) external onlyOwner {
    Item[] memory _items = new Item[](_inputItems.length);
    uint16[] memory tokenIds = new uint16[](_items.length);
    for (uint i; i < _inputItems.length; ++i) {
      require(!_exists(_inputItems[i].tokenId), "This item was already added");
      _items[i] = _setItem(_inputItems[i]);
      tokenIds[i] = _inputItems[i].tokenId;
    }
    emit AddItems(_items, tokenIds);
  }

  function editItem(InputItem calldata _inputItem) external onlyOwner {
    require(_exists(_inputItem.tokenId), "This item was not added yet");
    require(
      items[_inputItem.tokenId].equipPosition == _inputItem.equipPosition,
      "Equipment position should not change"
    );
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
    require(block.chainid == 31337, "Only for hardhat");
    _;
  }

  modifier isNotHardhat() {
    require(block.chainid != 31337, "Not allowed hardhat");
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
