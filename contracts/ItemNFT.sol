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
  event AddItem(Item item);
  event AddItems(Item[] items);
  event EditItem(Item item);

  struct Item {
    CombatStats stats;
    string metadataURI;
    uint16 tokenId;
    EquipPosition equipPosition;
  }

  World world;
  string private baseURI;

  // How many of this item exist
  mapping(uint => uint) public itemBalances;

  address players;
  address shop;

  uint public uniqueItems; // unique number of items

  mapping(uint => string) private tokenURIs;
  mapping(uint => ItemStat) itemStats;

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

  function getItemStats(uint16 _tokenId) external view returns (ItemStat memory) {
    require(itemStats[_tokenId].exists, "Item doesn't exist");
    return itemStats[_tokenId];
  }

  // If an item is burnt, remove it from the total
  function _removeAnyBurntFromTotal(address _to, uint[] memory _ids, uint[] memory _amounts) internal {
    uint i = _ids.length;
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
    if (_from == address(0) || _amounts.length == 0) {
      // When minting do nothing
      return;
    }

    _removeAnyBurntFromTotal(_to, _ids, _amounts);
  }

  function _setItem(Item calldata _item) private {
    itemStats[_item.tokenId] = ItemStat({stats: _item.stats, exists: true, equipPosition: _item.equipPosition});
    tokenURIs[_item.tokenId] = _item.metadataURI;
  }

  function burn(address _from, uint _tokenId, uint _quantity) external {
    require(
      _from == _msgSender() || isApprovedForAll(_from, _msgSender()) || players == _msgSender() || shop == _msgSender(),
      "ERC1155: caller is not token owner, approved , players contract or shop contract"
    );
    _burn(_from, _tokenId, _quantity);
  }

  // Or make it constants and redeploy the contracts
  function addItem(Item calldata _item) external onlyOwner {
    require(!_exists(_item.tokenId), "This item was already added");
    _setItem(_item);
    emit AddItem(_item);
  }

  function addItems(Item[] calldata _items) external onlyOwner {
    for (uint i; i < _items.length; ++i) {
      require(!_exists(_items[i].tokenId), "This item was already added");
      _setItem(_items[i]);
    }
    emit AddItems(_items);
  }

  function editItem(Item calldata _item) external onlyOwner {
    require(_exists(_item.tokenId), "This item was not added yet");
    require(itemStats[_item.tokenId].equipPosition == _item.equipPosition, "Equipment position should not change");
    _setItem(_item);
    emit EditItem(_item);
  }

  function setPlayers(address _players) external onlyOwner {
    players = _players;
  }

  function setBaseURI(string calldata _baseURI) external onlyOwner {
    _setURI(_baseURI);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

  // TODO: Remove in live version
  function testMint(address _to, uint _tokenId, uint _amount) external {
    _mintItem(_to, _tokenId, _amount);
  }

  function testMints(address _to, uint[] calldata _tokenIds, uint[] calldata _amounts) external {
    _mintBatchItems(_to, _tokenIds, _amounts);
  }
}
