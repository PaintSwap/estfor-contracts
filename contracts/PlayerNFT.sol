// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
  using UnsafeMath for uint;

  event NewPlayerV2(
    uint playerId,
    uint avatarId,
    string name,
    address from,
    string discord,
    string twitter,
    string telegram,
    uint paid,
    bool upgrade
  );
  event EditPlayerV2(
    uint playerId,
    string newName,
    uint paid,
    string discord,
    string twitter,
    string telegram,
    bool upgrade
  );
  event EditNameCost(uint newCost);
  event UpgradePlayerCost(uint newCost);
  event SetAvatars(uint startAvatarId, AvatarInfo[] avatarInfos);

  error NotOwnerOfPlayer();
  error NotAdmin();
  error NotAdminOrLive();
  error NotPlayers();
  error AvatarNotExists();
  error NameTooShort();
  error NameTooLong();
  error NameAlreadyExists();
  error NameInvalidCharacters();
  error MintedMoreThanAllowed();
  error NotInWhitelist();
  error ERC1155Metadata_URIQueryForNonexistentToken();
  error ERC1155BurnForbidden();
  error DiscordTooLong();
  error DiscordTooShort();
  error DiscordInvalidCharacters();
  error TelegramTooLong();
  error TelegramTooShort();
  error TelegramInvalidCharacters();
  error TwitterTooLong();
  error TwitterTooShort();
  error TwitterInvalidCharacters();

  // For ABI backwards compatibility
  event NewPlayer(uint playerId, uint avatarId, string name);
  event EditPlayer(uint playerId, string newName);

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
  uint80 upgradePlayerCost; // Max 1.2 million brush

  bytes32 private merkleRoot; // Unused now (was for alpha/beta whitelisting)
  mapping(address whitelistedUser => uint amount) private numMintedFromWhitelist; // Unused now
  AdminAccess private adminAccess;
  uint32 numBurned;

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
    uint80 _upgradePlayerCost,
    string calldata _imageBaseUri,
    bool _isBeta
  ) external initializer {
    __ERC1155_init("");
    __UUPSUpgradeable_init();
    __Ownable_init();

    brush = _brush;
    nextPlayerId = 1;
    imageBaseUri = _imageBaseUri;
    pool = _pool;
    dev = _dev;
    editNameCost = _editNameCost;
    upgradePlayerCost = _upgradePlayerCost;
    royaltyFee = 30; // 3%
    royaltyReceiver = _royaltyReceiver;
    adminAccess = _adminAccess;
    isBeta = _isBeta;

    emit EditNameCost(_editNameCost);
    emit UpgradePlayerCost(_upgradePlayerCost);
  }

  // TODO: Delete later, only here for backwards compatibility
  function mint(uint _avatarId, string calldata _name, bool _makeActive) external {
    address from = _msgSender();
    uint playerId = nextPlayerId++;
    (string memory trimmedName, ) = _setName(playerId, _name);
    emit NewPlayer(playerId, _avatarId, trimmedName);
    _setTokenIdToAvatar(playerId, _avatarId);
    _mint(from, playerId, 1, "");
    _mintStartingItems(from, playerId, _avatarId, _makeActive);
  }

  function mintTODOPaint(
    uint _avatarId,
    string calldata _name,
    string calldata _discord,
    string calldata _twitter,
    string calldata _telegram,
    bool _upgrade,
    bool _makeActive
  ) external {
    address from = _msgSender();
    uint playerId = nextPlayerId++;
    (string memory trimmedName, ) = _setName(playerId, _name);
    _checkSocials(_discord, _twitter, _telegram);
    uint paid = 0;
    if (_upgrade) {
      paid += upgradePlayerCost;
      _pay(upgradePlayerCost);
    }

    emit NewPlayerV2(playerId, _avatarId, trimmedName, from, _discord, _twitter, _telegram, paid, _upgrade);
    _setTokenIdToAvatar(playerId, _avatarId);
    _mint(from, playerId, 1, "");
    _mintStartingItems(from, playerId, _avatarId, _makeActive);
  }

  function burn(address _from, uint _playerId) external {
    if (_from != _msgSender() && !isApprovedForAll(_from, _msgSender())) {
      revert ERC1155BurnForbidden();
    }
    ++numBurned;
    _burn(_from, _playerId, 1);
  }

  // TODO: Delete later, only here for backwards compatibility
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

    (string memory trimmedName, ) = _setName(_playerId, _newName);
    emit EditPlayer(_playerId, trimmedName);
  }

  function editPlayer(
    uint _playerId,
    string calldata _name,
    string calldata _discord,
    string calldata _twitter,
    string calldata _telegram,
    bool _upgrade
  ) external isOwnerOfPlayer(_playerId) {
    // Only charge brush if changing the name
    (string memory trimmedName, bool nameChanged) = _setName(_playerId, _name);
    uint amountPaid;
    if (nameChanged) {
      amountPaid = editNameCost;
      _pay(editNameCost);
    }

    if (_upgrade) {
      amountPaid += upgradePlayerCost;
      _pay(upgradePlayerCost);
      players.upgradePlayer(_playerId);
    }

    _checkSocials(_discord, _twitter, _telegram);
    emit EditPlayerV2(_playerId, trimmedName, amountPaid, _discord, _twitter, _telegram, _upgrade);
  }

  function _pay(uint _brushCost) private {
    uint brushCost = _brushCost;
    // Pay
    brush.transferFrom(_msgSender(), address(this), brushCost);
    uint quarterCost = brushCost / 4;
    // Send half to the pool (currently shop)
    brush.transfer(pool, brushCost - quarterCost * 2);
    // Send 1 quarter to the dev address
    brush.transfer(dev, quarterCost);
    // Burn 1 quarter
    brush.burn(quarterCost);
  }

  function _mintStartingItems(address _from, uint _playerId, uint _avatarId, bool _makeActive) private {
    // Give the player some starting items
    uint[] memory itemTokenIds = new uint[](7);
    itemTokenIds[0] = BRONZE_SWORD;
    itemTokenIds[1] = BRONZE_AXE;
    itemTokenIds[2] = MAGIC_FIRE_STARTER;
    itemTokenIds[3] = NET_STICK;
    itemTokenIds[4] = BRONZE_PICKAXE;
    itemTokenIds[5] = TOTEM_STAFF;
    itemTokenIds[6] = BASIC_BOW;

    uint[] memory amounts = new uint[](7);
    amounts[0] = 1;
    amounts[1] = 1;
    amounts[2] = 1;
    amounts[3] = 1;
    amounts[4] = 1;
    amounts[5] = 1;
    amounts[6] = 1;
    players.mintedPlayer(_from, _playerId, avatars[_avatarId].startSkills, _makeActive, itemTokenIds, amounts);
  }

  function _setName(
    uint _playerId,
    string calldata _name
  ) private returns (string memory trimmedName, bool nameChanged) {
    // Trimmed name cannot be empty
    trimmedName = EstforLibrary.trim(_name);
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
    string memory oldName = EstforLibrary.toLower(names[_playerId]);
    nameChanged = keccak256(abi.encodePacked(oldName)) != keccak256(abi.encodePacked(trimmedAndLowercaseName));
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

  function _checkSocials(string calldata _discord, string calldata _twitter, string calldata _telegram) private pure {
    uint discordLength = bytes(_discord).length;
    if (discordLength > 32) {
      revert DiscordTooLong();
    }
    if (discordLength == 1) {
      revert DiscordTooShort();
    }
    if (!EstforLibrary.containsBaselineSocialNameCharacters(_discord)) {
      revert DiscordInvalidCharacters();
    }

    uint twitterLength = bytes(_twitter).length;
    if (twitterLength > 32) {
      revert TwitterTooLong();
    }
    if (twitterLength == 1) {
      revert TwitterTooShort();
    }
    if (!EstforLibrary.containsBaselineSocialNameCharacters(_twitter)) {
      revert TelegramInvalidCharacters();
    }

    uint telegramLength = bytes(_telegram).length;
    if (telegramLength > 32) {
      revert TelegramTooLong();
    }
    if (telegramLength == 1) {
      revert TelegramTooShort();
    }
    if (!EstforLibrary.containsBaselineSocialNameCharacters(_telegram)) {
      revert TelegramInvalidCharacters();
    }
  }

  function _setTokenIdToAvatar(uint _playerId, uint _avatarId) private {
    if (bytes(avatars[_avatarId].description).length == 0) {
      revert AvatarNotExists();
    }
    playerIdToAvatar[_playerId] = _avatarId;
  }

  function _beforeTokenTransfer(
    address /*operator*/,
    address from,
    address to,
    uint[] memory ids,
    uint[] memory amounts,
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
      if (to == address(0) || to == 0x000000000000000000000000000000000000dEaD) {
        // Burning
        string memory oldName = EstforLibrary.toLower(names[playerId]);
        delete lowercaseNames[oldName];
      }
    }
  }

  function uri(uint _playerId) public view virtual override returns (string memory) {
    if (!exists(_playerId)) {
      revert ERC1155Metadata_URIQueryForNonexistentToken();
    }
    AvatarInfo storage avatarInfo = avatars[playerIdToAvatar[_playerId]];
    string memory imageURI = string(abi.encodePacked(imageBaseUri, avatarInfo.imageURI));
    return players.getURI(_playerId, names[_playerId], avatarInfo.name, avatarInfo.description, imageURI);
  }

  /**
   * @dev Returns whether `playerId` exists.
   *
   * Tokens can be managed by their owner or approved accounts via {setApprovalForAll}.
   *
   */
  function exists(uint _tokenId) public view returns (bool) {
    return playerIdToAvatar[_tokenId] != 0;
  }

  function totalSupply(uint _tokenId) external view returns (uint) {
    return exists(_tokenId) ? 1 : 0;
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(address _account, uint16[] memory _ids) external view returns (uint[] memory batchBalances) {
    U256 iter = _ids.length.asU256();
    batchBalances = new uint[](iter.asUint256());
    while (iter.neq(0)) {
      iter = iter.dec();
      uint i = iter.asUint256();
      batchBalances[i] = balanceOf(_account, _ids[i]);
    }
  }

  function royaltyInfo(
    uint /*_tokenId*/,
    uint _salePrice
  ) external view override returns (address receiver, uint royaltyAmount) {
    uint amount = (_salePrice * royaltyFee) / 1000;
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

  function totalSupply() external view returns (uint) {
    return nextPlayerId - numBurned - 1;
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

  function setUpgradeCost(uint80 _upgradePlayerCost) external onlyOwner {
    upgradePlayerCost = _upgradePlayerCost;
    emit UpgradePlayerCost(_upgradePlayerCost);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
