// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Multicall.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

import "./interfaces/IBrushToken.sol";
import "./interfaces/IPlayers.sol";
import "./World.sol";
import "./types.sol";
import "./items.sol";

// The NFT contract contains data related to the items and who owns them
contract ItemNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IERC2981, Multicall {
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
    require(msg.sender == players || msg.sender == shop, "Not players OR shop");
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
    uint i;
    while (i < _tokenIds.length) {
      uint tokenId = _tokenIds[i];
      require(tokenId < type(uint16).max, "id too high");
      //      require(_exists(_tokenIds[i]));
      uint existingBalance = itemBalances[tokenId];
      if (existingBalance == 0) {
        // Brand new item
        ++numNewItems;
      }

      itemBalances[tokenId] = existingBalance + _amounts[i];
      unchecked {
        ++i;
      }
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
    return items[_tokenId].exists;
  }

  function _getItem(uint _tokenId) private view returns (Item memory) {
    require(_exists(_tokenId), "Token does not exist");
    return items[_tokenId];
  }

  function getItem(uint16 _tokenId) external view returns (Item memory) {
    return _getItem(_tokenId);
  }

  function getMinRequirement(uint16 _tokenId) public view returns (Skill, uint32) {
    return (items[_tokenId].skill, items[_tokenId].minSkillPoints);
  }

  function getMinRequirements(
    uint16[] calldata _tokenIds
  ) external view returns (Skill[] memory skills, uint32[] memory minSkillPoints) {
    skills = new Skill[](_tokenIds.length);
    minSkillPoints = new uint32[](_tokenIds.length);
    uint i;
    while (i < _tokenIds.length) {
      (skills[i], minSkillPoints[i]) = getMinRequirement(_tokenIds[i]);
      unchecked {
        ++i;
      }
    }
  }

  function getItems(uint16[] calldata _tokenIds) external view returns (Item[] memory _items) {
    _items = new Item[](_tokenIds.length);
    uint i;
    while (i < _tokenIds.length) {
      _items[i] = _getItem(_tokenIds[i]);
      unchecked {
        ++i;
      }
    }
  }

  // If an item is burnt, remove it from the total
  function _removeAnyBurntFromTotal(uint[] memory _ids, uint[] memory _amounts) private {
    uint i = _ids.length;
    // Precondition is that ids/amounts has some elements
    do {
      unchecked {
        --i;
      }
      itemBalances[_ids[i]] -= _amounts[i];
    } while (i > 0);
  }

  function _checkIsTransferable(uint[] memory _ids) private view {
    uint i = _ids.length;
    // Precondition is that ids has some elements
    do {
      unchecked {
        --i;
      }
      require(!items[_ids[i]].exists || items[_ids[i]].isTransferable);
    } while (i > 0);
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
      // Only for tests
      require(block.chainid == 31337);
    }
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(address _account, uint16[] memory _ids) external view returns (uint256[] memory batchBalances) {
    batchBalances = new uint256[](_ids.length);

    uint i;
    while (i < _ids.length) {
      batchBalances[i] = balanceOf(_account, _ids[i]);
      unchecked {
        ++i;
      }
    }
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
    require(!_exists(_inputItem.tokenId), "This item was already added");
    Item storage item = _setItem(_inputItem);
    emit AddItem(item, _inputItem.tokenId);
  }

  function addItems(InputItem[] calldata _inputItems) external onlyOwner {
    Item[] memory _items = new Item[](_inputItems.length);
    uint16[] memory tokenIds = new uint16[](_items.length);
    uint i;
    while (i < _inputItems.length) {
      require(!_exists(_inputItems[i].tokenId), "This item was already added");
      _items[i] = _setItem(_inputItems[i]);
      tokenIds[i] = _inputItems[i].tokenId;
      unchecked {
        ++i;
      }
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
