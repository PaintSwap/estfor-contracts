// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC1155Upgradeable} from "./ozUpgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {EstforLibrary} from "./EstforLibrary.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {AdminAccess} from "./AdminAccess.sol";

/* solhint-disable no-global-import */
import "./globals/items.sol";
import "./globals/players.sol";

/* solhint-enable no-global-import */

// Each NFT represents a player. This contract deals with the NFTs, and the Players contract deals with the player data
contract PlayerNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IERC2981 {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;

  event NewPlayer(uint playerId, uint avatarId, string name);
  event EditPlayer(uint playerId, string newName);
  event EditNameCost(uint newCost);

  event SetAvatars(uint startAvatarId, AvatarInfo[] avatarInfos);

  error NotOwnerOfPlayer();
  error NotAdmin();
  error NotAdminOrLive();
  error NotPlayers();
  error AvatarNotExists();
  error NameTooShort();
  error NameTooLong(uint length, string name, string name1);
  error NameAlreadyExists();
  error NameInvalidCharacters();
  error MintedMoreThanAllowed();
  error NotInWhitelist();
  error ERC1155Metadata_URIQueryForNonexistentToken();
  error ERC1155BurnForbidden();

  uint private nextPlayerId;

  mapping(uint avatarId => AvatarInfo avatarInfo) public avatars;
  string public imageBaseUri;
  mapping(uint playerId => uint avatar) public playerIdToAvatar;
  mapping(uint playerId => string name) public names;
  mapping(string name => bool exists) public lowercaseNames;

  IBrushToken private brush;
  IPlayers private players;
  address private pool;

  address private royaltyReceiver;
  uint8 private royaltyFee; // base 1000, highest is 25.5
  uint72 public editNameCost; // Max is 4700 BRUSH
  bool public isBeta;

  address private dev;

  bytes32 private merkleRoot; // For airdrop
  mapping(address whitelistedUser => uint amount) public numMintedFromWhitelist;
  uint public constant MAX_BETA_WHITELIST = 3;
  AdminAccess private adminAccess;

  modifier isOwnerOfPlayer(uint playerId) {
    if (balanceOf(_msgSender(), playerId) != 1) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  modifier onlyPlayers() {
    if (_msgSender() != address(players)) {
      revert NotPlayers();
    }
    _;
  }

  modifier isAdmin() {
    if (!adminAccess.isAdmin(_msgSender())) {
      revert NotAdmin();
    }
    _;
  }

  modifier isAdminOrMain() {
    if (!adminAccess.isAdmin(_msgSender()) && !isBeta) {
      revert NotAdminOrLive();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken _brush,
    address _pool,
    address _dev,
    address _royaltyReceiver,
    AdminAccess _adminAccess,
    uint72 _editNameCost,
    string calldata _imageBaseUri,
    bool _isBeta
  ) public initializer {
    __ERC1155_init("");
    __Ownable_init();
    __UUPSUpgradeable_init();
    brush = _brush;
    nextPlayerId = 1;
    imageBaseUri = _imageBaseUri;
    pool = _pool;
    dev = _dev;
    editNameCost = _editNameCost;
    royaltyFee = 30; // 3%
    royaltyReceiver = _royaltyReceiver;
    adminAccess = _adminAccess;
    isBeta = _isBeta;

    emit EditNameCost(_editNameCost);
  }

  function _mintStartingItems(address _from, uint _playerId, uint _avatarId, bool _makeActive) private {
    // Give the player some starting items
    uint[] memory itemTokenIds = new uint[](6);
    itemTokenIds[0] = BRONZE_SWORD;
    itemTokenIds[1] = BRONZE_AXE;
    itemTokenIds[2] = MAGIC_FIRE_STARTER;
    itemTokenIds[3] = NET_STICK;
    itemTokenIds[4] = BRONZE_PICKAXE;
    itemTokenIds[5] = TOTEM_STAFF;

    uint[] memory amounts = new uint[](6);
    amounts[0] = 1;
    amounts[1] = 1;
    amounts[2] = 1;
    amounts[3] = 1;
    amounts[4] = 1;
    amounts[5] = 1;
    players.mintedPlayer(_from, _playerId, avatars[_avatarId].startSkills, _makeActive, itemTokenIds, amounts);
  }

  function _setName(uint _playerId, string calldata _name) private returns (string memory trimmedName) {
    // Trimmed name cannot be empty
    trimmedName = EstforLibrary.trim(_name);
    if (bytes(trimmedName).length < 3) {
      revert NameTooShort();
    }
    if (bytes(trimmedName).length > 20) {
      revert NameTooLong(bytes(trimmedName).length, _name, trimmedName);
    }

    if (!EstforLibrary.containsValidCharacters(trimmedName)) {
      revert NameInvalidCharacters();
    }

    string memory trimmedAndLowercaseName = EstforLibrary.toLower(trimmedName);
    string memory oldName = EstforLibrary.toLower(names[_playerId]);
    bool nameChanged = keccak256(abi.encodePacked(oldName)) != keccak256(abi.encodePacked(trimmedAndLowercaseName));
    if (nameChanged) {
      if (lowercaseNames[trimmedAndLowercaseName]) {
        revert NameAlreadyExists();
      }
      if (bytes(oldName).length != 0) {
        delete lowercaseNames[oldName];
      }
      lowercaseNames[trimmedAndLowercaseName] = true;
      names[_playerId] = trimmedName;
    }
  }

  // Minting whitelist for the beta
  function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
    merkleRoot = _merkleRoot;
  }

  function checkInWhitelist(bytes32[] calldata _proof) public view returns (bool whitelisted) {
    bytes32 leaf = keccak256(abi.encodePacked(_msgSender()));
    return EstforLibrary.merkleProofVerify(_proof, merkleRoot, leaf);
  }

  function _mintPlayer(uint _avatarId, string calldata _name, bool _makeActive) private {
    address from = _msgSender();
    uint playerId = nextPlayerId;
    nextPlayerId = nextPlayerId.inc();
    string memory trimmedName = _setName(playerId, _name);
    emit NewPlayer(playerId, _avatarId, trimmedName);
    _mint(from, playerId, 1, "");
    _mintStartingItems(from, playerId, _avatarId, _makeActive);
    _setTokenIdToAvatar(playerId, _avatarId);
  }

  // Costs nothing to mint, only gas
  function mintWhitelist(uint _avatarId, string calldata _name, bool _makeActive, bytes32[] calldata _proof) external {
    if (!checkInWhitelist(_proof)) {
      revert NotInWhitelist();
    }
    uint _numMintedFromWhitelist = numMintedFromWhitelist[_msgSender()];
    if (_numMintedFromWhitelist.inc() > MAX_BETA_WHITELIST) {
      revert MintedMoreThanAllowed();
    }
    numMintedFromWhitelist[_msgSender()] = _numMintedFromWhitelist.inc();
    _mintPlayer(_avatarId, _name, _makeActive);
  }

  function mint(uint _avatarId, string calldata _name, bool _makeActive) external isAdminOrMain {
    _mintPlayer(_avatarId, _name, _makeActive);
  }

  function _setTokenIdToAvatar(uint _playerId, uint _avatarId) private {
    if (bytes(avatars[_avatarId].description).length == 0) {
      revert AvatarNotExists();
    }
    playerIdToAvatar[_playerId] = _avatarId;
  }

  function uri(uint256 _playerId) public view virtual override returns (string memory) {
    if (!_exists(_playerId)) {
      revert ERC1155Metadata_URIQueryForNonexistentToken();
    }
    AvatarInfo storage avatarInfo = avatars[playerIdToAvatar[_playerId]];
    string memory imageURI = string(abi.encodePacked(imageBaseUri, avatarInfo.imageURI));
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
    U256 iter = ids.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      uint playerId = ids[i];
      players.clearEverythingBeforeTokenTransfer(from, playerId);
    }
  }

  /**
   * @dev Returns whether `playerId` exists.
   *
   * Tokens can be managed by their owner or approved accounts via {setApprovalForAll}.
   *
   */
  function _exists(uint256 _playerId) private view returns (bool) {
    return playerIdToAvatar[_playerId] != 0;
  }

  function editName(uint _playerId, string calldata _newName) external isOwnerOfPlayer(_playerId) {
    uint brushCost = editNameCost;
    // Pay
    brush.transferFrom(_msgSender(), address(this), brushCost);
    uint quarterCost = brushCost / 4;
    // Send half to the pool (currently shop)
    brush.transfer(pool, brushCost - quarterCost * 2);
    // Send 1 quarter to the dev address
    brush.transfer(dev, quarterCost);
    // Burn 1 quarter
    brush.burn(quarterCost);

    string memory trimmedName = _setName(_playerId, _newName);
    emit EditPlayer(_playerId, trimmedName);
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(address _account, uint16[] memory _ids) external view returns (uint256[] memory batchBalances) {
    U256 iter = _ids.length.asU256();
    batchBalances = new uint256[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      batchBalances[i] = balanceOf(_account, _ids[i]);
    }
  }

  function burn(address _from, uint _playerId) external {
    if (_from != _msgSender() && !isApprovedForAll(_from, _msgSender())) {
      revert ERC1155BurnForbidden();
    }
    _burn(_from, _playerId, 1);
  }

  function royaltyInfo(
    uint256 /*_tokenId*/,
    uint256 _salePrice
  ) external view override returns (address receiver, uint256 royaltyAmount) {
    uint256 amount = (_salePrice * royaltyFee) / 1000;
    return (royaltyReceiver, amount);
  }

  function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC1155Upgradeable) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked("Estfor Players", isBeta ? " (Beta)" : ""));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked("EK_P", isBeta ? "B" : ""));
  }

  function setAvatars(uint _startAvatarId, AvatarInfo[] calldata _avatarInfos) external onlyOwner {
    U256 iter = _avatarInfos.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      avatars[_startAvatarId.add(i)] = _avatarInfos[i];
    }
    emit SetAvatars(_startAvatarId, _avatarInfos);
  }

  function setImageBaseUri(string calldata _imageBaseUri) external onlyOwner {
    imageBaseUri = _imageBaseUri;
  }

  function setPlayers(IPlayers _players) external onlyOwner {
    players = _players;
  }

  function setEditNameCost(uint72 _editNameCost) external onlyOwner {
    editNameCost = _editNameCost;
    emit EditNameCost(_editNameCost);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
