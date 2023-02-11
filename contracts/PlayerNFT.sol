// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./interfaces/IBrushToken.sol";
import "./interfaces/IPlayers.sol";
import "./types.sol";
import "./items.sol";
import "hardhat/console.sol";

// Each NFT represents a player. This contract deals with the NFTs, and the Players contract deals with the player data
contract PlayerNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable {
  event NewPlayer(uint tokenId, uint avatarId, bytes32 name);
  event EditPlayer(uint tokenId, bytes32 newName);

  event SetAvatar(uint avatarId, AvatarInfo avatarInfo);
  event SetAvatars(uint startAvatarId, AvatarInfo[] avatarInfos);

  struct AvatarInfo {
    bytes32 name;
    string description;
    string imageURI;
  }

  error NotOwner();
  error AvatarNotExists();

  uint private latestPlayerId;

  mapping(uint avatarId => AvatarInfo avatarInfo) private avatars;
  string private baseURI;
  mapping(uint tokenId => uint avatarId) private tokenIdToAvatar; // tokenId => avatar id
  mapping(uint tokenId => bytes32 name) private names;

  IBrushToken brush;
  IPlayers private players;

  modifier isOwnerOfPlayer(uint tokenId) {
    if (balanceOf(msg.sender, tokenId) != 1) {
      revert NotOwner();
    }
    _;
  }

  modifier onlyPlayers() {
    require(msg.sender == address(players));
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IBrushToken _brush) public initializer {
    __ERC1155_init("");
    __Ownable_init();
    __UUPSUpgradeable_init();
    brush = _brush;
    latestPlayerId = 1;
    baseURI = "ipfs://";
  }

  function _mintStartingItems() private {
    // Give the player some starting items
    (uint[] memory itemNFTs, uint[] memory quantities) = _getInitialStartingItems();
    players.mintBatch(msg.sender, itemNFTs, quantities);
  }

  // Costs nothing to mint, only gas
  function mint(uint _avatarId, bytes32 _name) external {
    uint currentPlayerId = latestPlayerId;
    emit NewPlayer(currentPlayerId, _avatarId, _name);
    _mint(msg.sender, currentPlayerId, 1, "");
    names[currentPlayerId] = _name;
    _mintStartingItems();
    _setTokenIdToAvatar(currentPlayerId, _avatarId);
    ++latestPlayerId;
  }

  function _setTokenIdToAvatar(uint _tokenId, uint _avatarId) private {
    if (bytes(avatars[_avatarId].description).length == 0) {
      revert AvatarNotExists();
    }
    tokenIdToAvatar[_tokenId] = _avatarId;
  }

  function uri(uint256 _tokenId) public view virtual override returns (string memory) {
    require(_exists(_tokenId));
    AvatarInfo storage avatarInfo = avatars[tokenIdToAvatar[_tokenId]];
    string memory imageURI = string(abi.encodePacked(baseURI, avatarInfo.imageURI));
    return players.getURI(names[_tokenId], avatarInfo.name, avatarInfo.description, imageURI);
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal virtual override {
    if (from == address(0) || amounts.length == 0 || from == to) {
      return;
    }
    uint i = 0;
    do {
      // Get player and consume any actions & unequip all items before transferring the whole player
      uint tokenId = ids[i];
      players.clearEverythingBeforeTokenTransfer(from, tokenId);
      unchecked {
        ++i;
      }
    } while (i < ids.length);
  }

  /**
   * @dev Returns whether `tokenId` exists.
   *
   * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
   *
   */
  function _exists(uint256 _tokenId) private view returns (bool) {
    return tokenIdToAvatar[_tokenId] != 0;
  }

  function _getInitialStartingItems() private pure returns (uint[] memory itemNFTs, uint[] memory quantities) {
    itemNFTs = new uint[](5);
    itemNFTs[0] = BRONZE_SWORD;
    itemNFTs[1] = BRONZE_AXE;
    itemNFTs[2] = FIRE_LIGHTER;
    itemNFTs[3] = SMALL_NET;
    itemNFTs[4] = BRONZE_PICKAXE;

    quantities = new uint[](5);
    quantities[0] = 1;
    quantities[1] = 1;
    quantities[2] = 1;
    quantities[3] = 1;
    quantities[4] = 1;
  }

  function editName(uint _tokenId, bytes32 _newName) external isOwnerOfPlayer(_tokenId) {
    uint brushCost = 5000;
    // Pay
    brush.transferFrom(msg.sender, address(this), brushCost);
    // Burn half, the rest goes into the pool
    brush.burn(brushCost / 2);

    names[_tokenId] = _newName;
    emit EditPlayer(_tokenId, _newName);
  }

  function setAvatar(uint _avatarId, AvatarInfo calldata _avatarInfo) external onlyOwner {
    avatars[_avatarId] = _avatarInfo;
    emit SetAvatar(_avatarId, _avatarInfo);
  }

  function setAvatars(uint _startAvatarId, AvatarInfo[] calldata _avatarInfos) external onlyOwner {
    for (uint i; i < _avatarInfos.length; ++i) {
      avatars[_startAvatarId + i] = _avatarInfos[i];
    }
    emit SetAvatars(_startAvatarId, _avatarInfos);
  }

  function setBaseURI(string calldata _baseURI) external onlyOwner {
    _setURI(_baseURI);
  }

  function burn(address _from, uint _tokenId) external {
    require(
      _from == _msgSender() || isApprovedForAll(_from, _msgSender()),
      "ERC1155: caller is not token owner or approved"
    );
    _burn(_from, _tokenId, 1);
  }

  function setPlayers(IPlayers _players) external onlyOwner {
    players = _players;
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
