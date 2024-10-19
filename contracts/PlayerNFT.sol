// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155Upgradeable} from "./ozUpgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {EstforLibrary} from "./EstforLibrary.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {AdminAccess} from "./AdminAccess.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// Each NFT represents a player. This contract deals with the NFTs, and the Players contract deals with the player data
contract PlayerNFT is ERC1155Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IERC2981 {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;

  event NewPlayerV2(
    uint256 playerId,
    uint256 avatarId,
    string name,
    address from,
    string discord,
    string twitter,
    string telegram,
    uint256 paid,
    bool upgrade
  );
  event EditPlayerV2(
    uint256 playerId,
    address from,
    string newName,
    uint256 paid,
    string discord,
    string twitter,
    string telegram,
    bool upgrade
  );
  event EditNameCost(uint256 newCost);
  event UpgradePlayerCost(uint256 newCost);
  event SetAvatarsV2(uint256[] avatarIds, AvatarInfo[] avatarInfos);
  event UpgradePlayerAvatar(uint256 playerId, uint256 newAvatarId, uint256 brushBurnt);

  // For ABI backwards compatibility
  event NewPlayer(uint256 playerId, uint256 avatarId, string name);
  event EditPlayer(uint256 playerId, string newName);
  event SetAvatars(uint256 startAvatarId, AvatarInfo[] avatarInfos);

  error NotOwnerOfPlayer();
  error NotPlayers();
  error BaseAvatarNotExists();
  error NameTooShort();
  error NameTooLong();
  error NameAlreadyExists();
  error NameInvalidCharacters();
  error MintedMoreThanAllowed();
  error NotInWhitelist();
  error ERC1155Metadata_URIQueryForNonexistentToken();
  error ERC1155BurnForbidden();
  error DiscordTooLong();
  error DiscordInvalidCharacters();
  error TelegramTooLong();
  error TelegramInvalidCharacters();
  error TwitterTooLong();
  error TwitterInvalidCharacters();
  error LengthMismatch();

  struct PlayerInfo {
    uint24 avatarId;
    uint24 originalAvatarId;
  }

  uint256 constant EVOLVED_OFFSET = 10000;

  uint256 private _nextPlayerId;

  mapping(uint256 avatarId => AvatarInfo avatarInfo) private _avatars;
  string private _imageBaseUri;
  mapping(uint256 playerId => PlayerInfo playerInfo) private _playerInfos;
  mapping(uint256 playerId => string name) private _names;
  mapping(string name => bool exists) private _lowercaseNames;

  IBrushToken private _brush;
  IPlayers private _players;
  address private _pool;

  address private _royaltyReceiver;
  uint8 private _royaltyFee; // base 1000, highest is 25.5
  uint72 private _editNameCost; // Max is 4700 BRUSH
  bool private _isBeta;

  address private _dev;
  uint80 private _upgradePlayerCost; // Max 1.2 million brush

  bytes32 private _merkleRoot; // Unused now (was for alpha/beta whitelisting)
  mapping(address whitelistedUser => uint256 amount) private _numMintedFromWhitelist; // Unused now
  AdminAccess private _adminAccess; // Unused but is set
  uint32 private _numBurned;
  uint256 public constant NUM_BASE_AVATARS = 8;

  modifier isOwnerOfPlayer(uint256 playerId) {
    if (balanceOf(_msgSender(), playerId) != 1) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  modifier onlyPlayers() {
    if (_msgSender() != address(_players)) {
      revert NotPlayers();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken brush,
    address pool,
    address dev,
    address royaltyReceiver,
    uint72 editNameCost,
    uint80 upgradePlayerCost,
    string calldata imageBaseUri,
    bool isBeta
  ) external initializer {
    __ERC1155_init("");
    __UUPSUpgradeable_init();
    __Ownable_init();

    _brush = brush;
    _nextPlayerId = 1;
    _imageBaseUri = imageBaseUri;
    _pool = pool;
    _dev = dev;
    _upgradePlayerCost = upgradePlayerCost;
    setEditNameCost(editNameCost);
    setUpgradeCost(upgradePlayerCost);
    _royaltyFee = 30; // 3%
    _royaltyReceiver = royaltyReceiver;
    _isBeta = isBeta;
  }

  function mint(
    uint256 avatarId,
    string calldata heroName,
    string calldata discord,
    string calldata twitter,
    string calldata telegram,
    bool upgrade,
    bool makeActive
  ) external {
    address from = _msgSender();
    uint256 playerId = _nextPlayerId++;
    (string memory trimmedName, ) = _setName(playerId, heroName);
    _checkSocials(discord, twitter, telegram);
    emit NewPlayerV2(playerId, avatarId, trimmedName, from, discord, twitter, telegram, 0, upgrade);
    _checkMintingAvatar(avatarId);
    _playerInfos[playerId].originalAvatarId = uint24(avatarId);
    _mint(from, playerId, 1, "");
    _mintStartingItems(from, playerId, avatarId, makeActive);
    if (upgrade) {
      uint24 evolvedAvatarId = uint24(EVOLVED_OFFSET + avatarId);
      _upgradePlayer(playerId, evolvedAvatarId);
    } else {
      _playerInfos[playerId].avatarId = uint24(avatarId);
    }
  }

  function burn(address from, uint256 playerId) external {
    if (from != _msgSender() && !isApprovedForAll(from, _msgSender())) {
      revert ERC1155BurnForbidden();
    }
    _burn(from, playerId, 1);
  }

  function _upgradePlayer(uint256 playerId, uint24 _newAvatarId) private {
    _playerInfos[playerId].avatarId = _newAvatarId;
    _players.upgradePlayer(playerId);
    // Send quarter to the pool (currently shop)
    uint256 quarterCost = _upgradePlayerCost / 4;
    _brush.transferFrom(_msgSender(), _pool, quarterCost);
    // Send rest to the dev address
    _brush.transferFrom(_msgSender(), _dev, _upgradePlayerCost - quarterCost);
    emit UpgradePlayerAvatar(playerId, _newAvatarId, 0);
  }

  function editPlayer(
    uint256 playerId,
    string calldata playerName,
    string calldata discord,
    string calldata twitter,
    string calldata telegram,
    bool upgrade
  ) external isOwnerOfPlayer(playerId) {
    _checkSocials(discord, twitter, telegram);

    // Only charge brush if changing the name
    (string memory trimmedName, bool nameChanged) = _setName(playerId, playerName);
    uint256 amountPaid;
    if (nameChanged) {
      amountPaid = _editNameCost;
      _pay(_editNameCost);
    }

    if (upgrade) {
      if (_playerInfos[playerId].originalAvatarId == 0) {
        _playerInfos[playerId].originalAvatarId = _playerInfos[playerId].avatarId;
      }
      uint24 evolvedAvatarId = uint24(EVOLVED_OFFSET + _playerInfos[playerId].avatarId);
      _upgradePlayer(playerId, evolvedAvatarId);
    }

    emit EditPlayerV2(playerId, _msgSender(), trimmedName, amountPaid, discord, twitter, telegram, upgrade);
  }

  function _pay(uint256 brushCost) private {
    // Pay
    _brush.transferFrom(_msgSender(), address(this), brushCost);
    uint256 quarterCost = brushCost / 4;
    // Send half to the pool (currently shop)
    _brush.transfer(_pool, quarterCost * 2);
    // Send 1 quarter to the dev address
    _brush.transfer(_dev, quarterCost);
    // Burn the rest
    _brush.burn(brushCost - quarterCost * 2 - quarterCost);
  }

  function _mintStartingItems(address from, uint256 playerId, uint256 avatarId, bool makeActive) private {
    // Give the player some starting items
    uint256[] memory itemTokenIds = new uint256[](7);
    itemTokenIds[0] = BRONZE_SWORD;
    itemTokenIds[1] = BRONZE_AXE;
    itemTokenIds[2] = MAGIC_FIRE_STARTER;
    itemTokenIds[3] = NET_STICK;
    itemTokenIds[4] = BRONZE_PICKAXE;
    itemTokenIds[5] = TOTEM_STAFF;
    itemTokenIds[6] = BASIC_BOW;

    uint256[] memory amounts = new uint256[](7);
    amounts[0] = 1;
    amounts[1] = 1;
    amounts[2] = 1;
    amounts[3] = 1;
    amounts[4] = 1;
    amounts[5] = 1;
    amounts[6] = 1;
    _players.mintedPlayer(from, playerId, _avatars[avatarId].startSkills, makeActive, itemTokenIds, amounts);
  }

  function _setName(
    uint256 playerId,
    string calldata playerName
  ) private returns (string memory trimmedName, bool nameChanged) {
    // Trimmed name cannot be empty
    trimmedName = EstforLibrary.trim(playerName);
    if (bytes(trimmedName).length < 3) {
      revert NameTooShort();
    }
    if (bytes(trimmedName).length > 20) {
      revert NameTooLong();
    }

    if (!EstforLibrary.containsValidNameCharacters(trimmedName)) {
      revert NameInvalidCharacters();
    }

    string memory trimmedAndLowercaseName = EstforLibrary.toLower(trimmedName);
    string memory oldName = EstforLibrary.toLower(_names[playerId]);
    nameChanged = keccak256(abi.encodePacked(oldName)) != keccak256(abi.encodePacked(trimmedAndLowercaseName));
    if (nameChanged) {
      if (_lowercaseNames[trimmedAndLowercaseName]) {
        revert NameAlreadyExists();
      }
      if (bytes(oldName).length != 0) {
        delete _lowercaseNames[oldName];
      }
      _lowercaseNames[trimmedAndLowercaseName] = true;
      _names[playerId] = trimmedName;
    }
  }

  function _checkMintingAvatar(uint256 avatarId) private view {
    if (bytes(_avatars[avatarId].description).length == 0 || avatarId > NUM_BASE_AVATARS) {
      revert BaseAvatarNotExists();
    }
  }

  function _checkSocials(string calldata discord, string calldata twitter, string calldata telegram) private pure {
    require(bytes(discord).length <= 32, DiscordTooLong());
    require(EstforLibrary.containsBaselineSocialNameCharacters(discord), DiscordInvalidCharacters());

    require(bytes(twitter).length <= 32, TwitterTooLong());
    require(EstforLibrary.containsBaselineSocialNameCharacters(twitter), TwitterInvalidCharacters());

    require(bytes(telegram).length <= 32, TelegramTooLong());
    require(EstforLibrary.containsBaselineSocialNameCharacters(telegram), TelegramInvalidCharacters());
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
    U256 burned;
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      uint256 playerId = ids[i];
      _players.clearEverythingBeforeTokenTransfer(from, playerId);
      if (to == address(0) || to == 0x000000000000000000000000000000000000dEaD) {
        // Burning
        string memory oldName = EstforLibrary.toLower(_names[playerId]);
        delete _lowercaseNames[oldName];
        burned = burned.inc();
      } else if (from != address(0)) {
        // Not minting
        _players.beforeTokenTransferTo(to, playerId);
      }
    }
    if (burned.neq(0)) {
      _numBurned += burned.asUint32();
    }
  }

  function uri(uint256 playerId) public view virtual override returns (string memory) {
    if (!exists(playerId)) {
      revert ERC1155Metadata_URIQueryForNonexistentToken();
    }
    AvatarInfo storage avatarInfo = _avatars[_playerInfos[playerId].avatarId];
    string memory imageURI = string(abi.encodePacked(_imageBaseUri, avatarInfo.imageURI));
    return _players.getURI(playerId, _names[playerId], avatarInfo.name, avatarInfo.description, imageURI);
  }

  /**
   * @dev Returns whether `tokenId` exists.
   *
   * Tokens can be managed by their owner or approved accounts via {setApprovalForAll}.
   *
   */
  function exists(uint256 tokenId) public view returns (bool) {
    return _playerInfos[tokenId].avatarId != 0;
  }

  function totalSupply(uint256 tokenId) external view returns (uint256) {
    return exists(tokenId) ? 1 : 0;
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(address account, uint16[] memory ids) external view returns (uint256[] memory batchBalances) {
    U256 iter = ids.length.asU256();
    batchBalances = new uint256[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint256 i = iter.asUint256();
      batchBalances[i] = balanceOf(account, ids[i]);
    }
  }

  function royaltyInfo(
    uint256 /*tokenId*/,
    uint256 salePrice
  ) external view override returns (address receiver, uint256 royaltyAmount) {
    uint256 amount = (salePrice * _royaltyFee) / 1000;
    return (_royaltyReceiver, amount);
  }

  function supportsInterface(bytes4 interfaceId) public view override(IERC165, ERC1155Upgradeable) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked("Estfor Players", _isBeta ? " (Beta)" : ""));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked("EK_P", _isBeta ? "B" : ""));
  }

  function totalSupply() external view returns (uint256) {
    return _nextPlayerId - _numBurned - 1;
  }

  function getBrush() external view returns (IBrushToken) {
    return _brush;
  }

  function getPoolAddress() external view returns (address) {
    return _pool;
  }

  function getDevAddress() external view returns (address) {
    return _dev;
  }

  function getPlayerInfo(uint256 playerId) external view returns (PlayerInfo memory) {
    return _playerInfos[playerId];
  }

  function hasLowercaseName(string calldata lowercaseName) external view returns (bool lowercaseNameExists) {
    return _lowercaseNames[lowercaseName];
  }

  function getName(uint256 playerId) external view returns (string memory) {
    return _names[playerId];
  }

  function setAvatars(uint256[] calldata avatarIds, AvatarInfo[] calldata avatarInfos) external onlyOwner {
    require(avatarIds.length == avatarInfos.length, LengthMismatch());
    for (uint256 i; i < avatarIds.length; ++i) {
      _avatars[avatarIds[i]] = avatarInfos[i];
    }
    emit SetAvatarsV2(avatarIds, avatarInfos);
  }

  function setImageBaseUri(string calldata imageBaseUri) external onlyOwner {
    _imageBaseUri = imageBaseUri;
  }

  function setPlayers(IPlayers players) external onlyOwner {
    _players = players;
  }

  function setEditNameCost(uint72 editNameCost) public onlyOwner {
    _editNameCost = editNameCost;
    emit EditNameCost(editNameCost);
  }

  function setUpgradeCost(uint80 upgradePlayerCost) public onlyOwner {
    _upgradePlayerCost = upgradePlayerCost;
    emit UpgradePlayerCost(upgradePlayerCost);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
