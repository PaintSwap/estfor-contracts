// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
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

  event NewPlayer(uint playerId, uint avatarId, bytes20 name);
  event EditPlayer(uint playerId, bytes20 newName);

  event SetAvatar(uint avatarId, AvatarInfo avatarInfo);
  event SetAvatars(uint startAvatarId, AvatarInfo[] avatarInfos);

  error NotOwnerOfPlayer();
  error NotAdmin();
  error NotAdminOrLive();
  error NotPlayers();
  error AvatarNotExists();
  error NameCannotBeEmpty();
  error NameAlreadyExists();
  error MintedMoreThanAllowed();
  error NotInWhitelist();
  error ERC1155Metadata_URIQueryForNonexistentToken();
  error ERC1155BurnForbidden();

  uint public nextPlayerId;

  mapping(uint avatarId => AvatarInfo avatarInfo) public avatars;
  string public imageBaseUri;
  mapping(uint playerId => uint avatar) public playerIdToAvatar;
  mapping(uint playerId => bytes32 name) public names;
  mapping(bytes name => bool exists) public lowercaseNames;

  IBrushToken private brush;
  IPlayers private players;
  address public pool;

  uint public editNameCost;
  uint public royaltyFee;
  address public royaltyReceiver;
  bool public isAlpha;

  bytes32 private merkleRoot; // For airdrop
  mapping(address whitelistedUser => uint amount) public numMintedFromWhitelist;
  uint public constant MAX_ALPHA_WHITELIST = 3;
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
    if (!adminAccess.isAdmin(_msgSender()) && !isAlpha) {
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
    address _royaltyReceiver,
    AdminAccess _adminAccess,
    uint _editNameCost,
    string calldata _imageBaseUri,
    bool _isAlpha
  ) public initializer {
    __ERC1155_init("");
    __Ownable_init();
    __UUPSUpgradeable_init();
    brush = _brush;
    nextPlayerId = 1;
    imageBaseUri = _imageBaseUri;
    pool = _pool;
    editNameCost = _editNameCost;
    royaltyFee = 250; // 2.5%
    royaltyReceiver = _royaltyReceiver;
    adminAccess = _adminAccess;
    isAlpha = _isAlpha;
  }

  function _mintStartingItems() private {
    // Give the player some starting items
    uint[] memory itemNFTs = new uint[](6);
    itemNFTs[0] = BRONZE_SWORD;
    itemNFTs[1] = BRONZE_AXE;
    itemNFTs[2] = MAGIC_FIRE_STARTER;
    itemNFTs[3] = NET_STICK;
    itemNFTs[4] = BRONZE_PICKAXE;
    itemNFTs[5] = TOTEM_STAFF;

    uint[] memory quantities = new uint[](6);
    quantities[0] = 1;
    quantities[1] = 1;
    quantities[2] = 1;
    quantities[3] = 1;
    quantities[4] = 1;
    quantities[5] = 1;
    players.mintBatch(_msgSender(), itemNFTs, quantities);
  }

  function _setName(uint _playerId, bytes20 _name) private {
    if (uint160(_name) == 0) {
      revert NameCannotBeEmpty();
    }
    names[_playerId] = _name;
    bytes memory lowercaseName = _toLower(_name);
    if (lowercaseNames[lowercaseName]) {
      revert NameAlreadyExists();
    }
    lowercaseNames[lowercaseName] = true;
  }

  // Minting whitelist for the alpha
  function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
    merkleRoot = _merkleRoot;
  }

  function checkInWhitelist(bytes32[] calldata _proof) public view returns (bool whitelisted) {
    bytes32 leaf = keccak256(abi.encodePacked(_msgSender()));
    return MerkleProof.verify(_proof, merkleRoot, leaf);
  }

  function _mintPlayer(uint _avatarId, bytes32 _name, bool _makeActive) private {
    address from = _msgSender();
    uint playerId = nextPlayerId++;
    emit NewPlayer(playerId, _avatarId, bytes20(_name));
    _mint(from, playerId, 1, "");
    _setName(playerId, bytes20(_name));
    players.mintedPlayer(from, playerId, avatars[_avatarId].startSkills, _makeActive);
    _mintStartingItems();
    _setTokenIdToAvatar(playerId, _avatarId);
  }

  // Costs nothing to mint, only gas
  function mintWhitelist(uint _avatarId, bytes32 _name, bool _makeActive, bytes32[] calldata _proof) external {
    if (!checkInWhitelist(_proof)) {
      revert NotInWhitelist();
    }
    uint _numMintedFromWhitelist = numMintedFromWhitelist[_msgSender()];
    if (_numMintedFromWhitelist + 1 > MAX_ALPHA_WHITELIST) {
      revert MintedMoreThanAllowed();
    }
    numMintedFromWhitelist[_msgSender()] = _numMintedFromWhitelist + 1;
    _mintPlayer(_avatarId, _name, _makeActive);
  }

  function mint(uint _avatarId, bytes32 _name, bool _makeActive) external isAdminOrMain {
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
    U256 iter = U256.wrap(ids.length);
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

  function editName(uint _playerId, bytes32 _newName) external isOwnerOfPlayer(_playerId) {
    uint brushCost = editNameCost;
    // Pay
    brush.transferFrom(_msgSender(), address(this), brushCost);
    // Send half to the pool (currently shop)
    brush.transfer(pool, brushCost - (brushCost / 2));
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
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      batchBalances[i] = balanceOf(_account, _ids[i]);
    }
  }

  function _toLower(bytes32 _name) private pure returns (bytes memory lowerName) {
    lowerName = abi.encodePacked(_name);
    U256 iter = U256.wrap(lowerName.length);
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      if ((uint8(lowerName[i]) >= 65) && (uint8(lowerName[i]) <= 90)) {
        // So we add 32 to make it lowercase
        lowerName[i] = bytes1(uint8(lowerName[i]) + 32);
      }
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
    uint256 amount = (_salePrice * royaltyFee) / 10000;
    return (royaltyReceiver, amount);
  }

  function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC1155Upgradeable) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked("Estfor Players", isAlpha ? " (Alpha)" : ""));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked("EK_P", isAlpha ? "A" : ""));
  }

  function setAvatar(uint _avatarId, AvatarInfo calldata _avatarInfo) external onlyOwner {
    avatars[_avatarId] = _avatarInfo;
    emit SetAvatar(_avatarId, _avatarInfo);
  }

  function setAvatars(uint _startAvatarId, AvatarInfo[] calldata _avatarInfos) external onlyOwner {
    U256 iter = U256.wrap(_avatarInfos.length);
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      avatars[_startAvatarId + i] = _avatarInfos[i];
    }
    emit SetAvatars(_startAvatarId, _avatarInfos);
  }

  function setImageBaseUri(string calldata _imageBaseUri) external onlyOwner {
    imageBaseUri = _imageBaseUri;
  }

  function setPlayers(IPlayers _players) external onlyOwner {
    players = _players;
  }

  function setEditNameCost(uint _editNameCost) external onlyOwner {
    editNameCost = _editNameCost;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
