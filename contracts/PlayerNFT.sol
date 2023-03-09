// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {Unsafe256, U256} from "./lib/Unsafe256.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {INFTVaultFactory} from "./interfaces/INFTVaultFactory.sol";
import "./types.sol";
import "./items.sol";

// Each NFT represents a player. This contract deals with the NFTs, and the Players contract deals with the player data
contract PlayerNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IERC2981, Multicall {
  using Unsafe256 for U256;

  event NewPlayer(uint playerId, uint avatarId, bytes20 name);
  event EditPlayer(uint playerId, bytes20 newName);

  event SetAvatar(uint avatarId, AvatarInfo avatarInfo);
  event SetAvatars(uint startAvatarId, AvatarInfo[] avatarInfos);

  struct AvatarInfo {
    bytes32 name;
    string description;
    string imageURI;
  }

  error NotOwner();
  error AvatarNotExists();

  uint public latestPlayerId;

  mapping(uint avatarId => AvatarInfo avatarInfo) public avatars;
  string public baseURI;
  mapping(uint playerId => uint avatar) public playerIdToAvatar;
  mapping(uint playerId => bytes32 name) public names;
  mapping(bytes name => bool exists) public lowercaseNames;

  IBrushToken public brush;
  IPlayers public players;
  address public pool;

  uint public editNameCost;
  uint public royaltyFee;
  address public royaltyReceiver;

  bytes32 merkleRoot; // For airdrop
  mapping(address whitelistedUser => uint amount) numMintedFromWhitelist;
  INFTVaultFactory constant psVaultFactory = INFTVaultFactory(0xD80A0a2d69aC9fcEc428cA16cE113Eb6Dc55B991);
  uint public constant MAX_ALPHA_WHITELIST = 2;

  modifier isOwnerOfPlayer(uint playerId) {
    if (balanceOf(msg.sender, playerId) != 1) {
      revert NotOwner();
    }
    _;
  }

  modifier onlyPlayers() {
    require(msg.sender == address(players), "Not players");
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken _brush,
    address _pool,
    address _royaltyReceiver,
    uint _editNameCost
  ) public initializer {
    __ERC1155_init("");
    __Ownable_init();
    __UUPSUpgradeable_init();
    brush = _brush;
    latestPlayerId = 1;
    baseURI = "ipfs://";
    pool = _pool;
    editNameCost = _editNameCost;
    royaltyFee = 250; // 2.5%
    royaltyReceiver = _royaltyReceiver;
  }

  function _mintStartingItems() private {
    // Give the player some starting items
    uint[] memory itemNFTs = new uint[](5);
    itemNFTs[0] = BRONZE_SWORD;
    itemNFTs[1] = BRONZE_AXE;
    itemNFTs[2] = FIRE_LIGHTER;
    itemNFTs[3] = SMALL_NET;
    itemNFTs[4] = BRONZE_PICKAXE;

    uint[] memory quantities = new uint[](5);
    quantities[0] = 1;
    quantities[1] = 1;
    quantities[2] = 1;
    quantities[3] = 1;
    quantities[4] = 1;
    players.mintBatch(msg.sender, itemNFTs, quantities);
  }

  function _setName(uint _playerId, bytes20 _name) private {
    require(uint160(_name) != 0, "Name cannot be empty");
    names[_playerId] = _name;
    bytes memory lowercaseName = _toLower(_name);
    require(!lowercaseNames[lowercaseName], "Name already exists");
    lowercaseNames[lowercaseName] = true;
  }

  // Minting whitelist for the alpha
  function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
    merkleRoot = _merkleRoot;
  }

  function _isWhitelisted(bytes32[] calldata _proof, address _account) private view returns (bool) {
    bytes32 leaf = keccak256(abi.encodePacked(_account));
    return MerkleProof.verify(_proof, merkleRoot, leaf);
  }

  function checkInWhitelist(bytes32[] calldata _proof, address _vaultAddress) public view returns (bool whitelisted) {
    // First check if this is a proof for the account itself
    whitelisted = _isWhitelisted(_proof, msg.sender);
    if (!whitelisted && block.chainid == 250) {
      // Otherwise check the vaultAddress matches one for the sender. Only check on fantom for now.
      uint16 maxVaultVersion = psVaultFactory.version(); // Current 1, may change change in the future if new vaults are released.
      for (uint16 i = 1; i <= maxVaultVersion; ++i) {
        address vaultAddress = psVaultFactory.vaultAddresses(msg.sender, i);
        if (vaultAddress == _vaultAddress && _isWhitelisted(_proof, vaultAddress)) {
          return true;
        }
      }
    }
  }

  function _mintPlayer(uint _avatarId, bytes32 _name, bool _makeActive) private {
    address from = msg.sender;
    uint playerId = latestPlayerId++;
    emit NewPlayer(playerId, _avatarId, bytes20(_name));
    _mint(from, playerId, 1, "");
    _setName(playerId, bytes20(_name));
    players.mintedPlayer(from, playerId, _makeActive);
    _mintStartingItems();
    _setTokenIdToAvatar(playerId, _avatarId);
  }

  function mintWhitelist(
    uint _avatarId,
    bytes32 _name,
    bool _makeActive,
    bytes32[] calldata _proof,
    address _vaultAddress
  ) external {
    require(checkInWhitelist(_proof, _vaultAddress), "Not in whitelist");
    ++numMintedFromWhitelist[msg.sender];
    require(numMintedFromWhitelist[msg.sender] <= MAX_ALPHA_WHITELIST, "Minted more than allowed");
    _mintPlayer(_avatarId, _name, _makeActive);
  }

  // Costs nothing to mint, only gas
  function mint(uint _avatarId, bytes32 _name, bool _makeActive) external {
    _mintPlayer(_avatarId, _name, _makeActive);
  }

  function _setTokenIdToAvatar(uint _playerId, uint _avatarId) private {
    if (bytes(avatars[_avatarId].description).length == 0) {
      revert AvatarNotExists();
    }
    playerIdToAvatar[_playerId] = _avatarId;
  }

  function uri(uint256 _playerId) public view virtual override returns (string memory) {
    require(_exists(_playerId), "ERC1155Metadata: URI query for nonexistent token");
    AvatarInfo storage avatarInfo = avatars[playerIdToAvatar[_playerId]];
    string memory imageURI = string(abi.encodePacked(baseURI, avatarInfo.imageURI));
    return players.getURI(_playerId, names[_playerId], avatarInfo.name, avatarInfo.description, imageURI);
  }

  function _beforeTokenTransfer(
    address /*operator*/,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory /*data*/
  ) internal virtual override {
    if (from == address(0) || amounts.length == 0 || from == to) {
      return;
    }
    U256 iter = U256.wrap(ids.length);
    while (iter.notEqual(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      uint playerId = ids[i];
      players.clearEverythingBeforeTokenTransfer(from, playerId);
    }
  }

  /**
   * @dev Returns whether `playerId` exists.
   *
   * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
   *
   */
  function _exists(uint256 _playerId) private view returns (bool) {
    return playerIdToAvatar[_playerId] != 0;
  }

  function editName(uint _playerId, bytes32 _newName) external isOwnerOfPlayer(_playerId) {
    uint brushCost = editNameCost;
    // Pay
    brush.transferFrom(msg.sender, address(this), brushCost);
    // Send half to the pool (currently shop)
    brush.transferFrom(msg.sender, pool, brushCost - (brushCost / 2));
    // Burn the other half
    brush.burn(brushCost / 2);

    // Delete old name
    bytes32 oldName = names[_playerId];
    delete names[_playerId];
    bytes memory oldLowercaseName = _toLower(oldName);
    delete lowercaseNames[oldLowercaseName];

    _setName(_playerId, bytes20(_newName));

    emit EditPlayer(_playerId, bytes20(_newName));
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(address _account, uint16[] memory _ids) external view returns (uint256[] memory batchBalances) {
    U256 iter = U256.wrap(_ids.length);
    batchBalances = new uint256[](iter.asUint256());
    while (iter.notEqual(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      batchBalances[i] = balanceOf(_account, _ids[i]);
    }
  }

  function _toLower(bytes32 _name) private pure returns (bytes memory) {
    bytes memory lowerName = bytes(abi.encodePacked(_name));
    U256 iter = U256.wrap(lowerName.length);
    while (iter.notEqual(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      if ((uint8(lowerName[i]) >= 65) && (uint8(lowerName[i]) <= 90)) {
        // So we add 32 to make it lowercase
        lowerName[i] = bytes1(uint8(lowerName[i]) + 32);
      }
    }
    return lowerName;
  }

  function burn(address _from, uint _playerId) external {
    require(
      _from == _msgSender() || isApprovedForAll(_from, _msgSender()),
      "ERC1155: caller is not token owner or approved"
    );
    _burn(_from, _playerId, 1);
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

  function setAvatar(uint _avatarId, AvatarInfo calldata _avatarInfo) external onlyOwner {
    avatars[_avatarId] = _avatarInfo;
    emit SetAvatar(_avatarId, _avatarInfo);
  }

  function setAvatars(uint _startAvatarId, AvatarInfo[] calldata _avatarInfos) external onlyOwner {
    U256 iter = U256.wrap(_avatarInfos.length);
    while (iter.notEqual(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      avatars[_startAvatarId + i] = _avatarInfos[i];
    }
    emit SetAvatars(_startAvatarId, _avatarInfos);
  }

  function setBaseURI(string calldata _baseURI) external onlyOwner {
    _setURI(_baseURI);
  }

  function setPlayers(IPlayers _players) external onlyOwner {
    players = _players;
  }

  function setEditNameCost(uint _editNameCost) external onlyOwner {
    editNameCost = _editNameCost;
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
