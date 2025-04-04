// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SamWitchERC1155UpgradeableSinglePerToken} from "./SamWitchERC1155UpgradeableSinglePerToken.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {EstforLibrary} from "./EstforLibrary.sol";
import {IBrushToken} from "./interfaces/external/IBrushToken.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {AdminAccess} from "./AdminAccess.sol";

import {BloomFilter} from "./libraries/BloomFilter.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// Each NFT represents a player. This contract deals with the NFTs, and the Players contract deals with the player data
contract PlayerNFT is UUPSUpgradeable, OwnableUpgradeable, SamWitchERC1155UpgradeableSinglePerToken, IERC2981 {
  using BloomFilter for BloomFilter.Filter;

  event NewPlayer(
    uint256 playerId,
    uint256 avatarId,
    string name,
    address from,
    string discord,
    string twitter,
    string telegram,
    bool upgrade
  );
  event EditPlayer(
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
  event SetAvatars(uint256[] avatarIds, AvatarInfo[] avatarInfos);
  event UpgradePlayerAvatar(uint256 playerId, uint256 newAvatarId, uint256 tokenCost);
  event SetBrushDistributionPercentages(
    uint256 brushBurntPercentage,
    uint256 brushTreasuryPercentage,
    uint256 brushDevPercentage
  );

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
  error PercentNotTotal100();
  error NotBridge();

  uint256 private constant EVOLVED_OFFSET = 10000;
  uint256 public constant NUM_BASE_AVATARS = 8;

  IBrushToken private _brush;
  IPlayers private _players;
  uint64 private _nextPlayerId;
  address private _treasury;
  address private _royaltyReceiver;
  uint8 private _royaltyFee; // base 1000, highest is 25.5
  uint72 private _editNameCost; // Max is 4700 BRUSH
  address private _dev;
  uint72 private _upgradePlayerCost; // Max is 4700 BRUSH
  uint8 private _brushBurntPercentage;
  uint8 private _brushTreasuryPercentage;
  uint8 private _brushDevPercentage;
  bytes32 private _merkleRoot; // Unused now (was for alpha/beta whitelisting)
  bool private _isBeta; // Not need to pack this
  AdminAccess private _adminAccess; // Unused but is set
  uint32 private _numBurned;
  string private _imageBaseUri;
  mapping(uint256 avatarId => AvatarInfo avatarInfo) private _avatars;
  mapping(uint256 playerId => PlayerInfo playerInfo) private _playerInfos;
  mapping(uint256 playerId => string name) private _names;
  mapping(string name => bool exists) private _lowercaseNames;
  BloomFilter.Filter private _reservedHeroNames; // TODO: unused
  address private _bridge; // TODO: Bridge Can remove later

  modifier isOwnerOfPlayer(uint256 playerId) {
    require(balanceOf(_msgSender(), playerId) == 1, NotOwnerOfPlayer());
    _;
  }

  modifier onlyPlayers() {
    require(_msgSender() == address(_players), NotPlayers());
    _;
  }

  modifier onlyBridge() {
    require(_msgSender() == address(_bridge), NotBridge());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken brush,
    address treasury,
    address dev,
    address royaltyReceiver,
    uint72 editNameCost,
    uint72 upgradePlayerCost,
    string calldata imageBaseUri,
    uint64 startPlayerId,
    bool isBeta,
    address bridge
  ) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();
    __SamWitchERC1155UpgradeableSinglePerToken_init("");

    _brush = brush;
    _nextPlayerId = startPlayerId;
    _imageBaseUri = imageBaseUri;
    _treasury = treasury;
    _dev = dev;
    _upgradePlayerCost = upgradePlayerCost;
    setEditNameCost(editNameCost);
    setUpgradeCost(upgradePlayerCost);
    _royaltyFee = 30; // 3%
    _royaltyReceiver = royaltyReceiver;
    _isBeta = isBeta;
    _bridge = bridge;
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
    emit NewPlayer(playerId, avatarId, trimmedName, from, discord, twitter, telegram, upgrade);
    _checkMintingAvatar(avatarId);
    PlayerInfo storage playerInfo = _playerInfos[playerId];
    playerInfo.originalAvatarId = uint24(avatarId);
    playerInfo.mintedTimestamp = uint40(block.timestamp);
    _mint(from, playerId, 1, "");
    _mintStartingItems(from, playerId, avatarId, makeActive);
    if (upgrade) {
      uint24 evolvedAvatarId = uint24(EVOLVED_OFFSET + avatarId);
      _upgradePlayer(playerId, evolvedAvatarId);
    } else {
      _playerInfos[playerId].avatarId = uint24(avatarId);
    }
  }

  function mintBridge(
    address from,
    uint256 playerId,
    uint256 avatarId,
    string calldata heroName,
    string calldata discord,
    string calldata twitter,
    string calldata telegram,
    bool isUpgrade
  ) external onlyBridge {
    _lowercaseNames[EstforLibrary.toLower(heroName)] = true;
    _names[playerId] = heroName;
    emit NewPlayer(playerId, avatarId, heroName, from, discord, twitter, telegram, isUpgrade);

    PlayerInfo storage playerInfo = _playerInfos[playerId];
    playerInfo.originalAvatarId = uint24(avatarId);
    playerInfo.mintedTimestamp = uint40(block.timestamp);
    _mint(from, playerId, 1, "");
    uint256[] memory startingItemTokenIds;
    uint256[] memory startingAmounts;

    // Only make active if the account has no active player
    bool makeActive = _players.getActivePlayer(from) == 0;
    _players.mintedPlayer(
      from,
      playerId,
      _avatars[avatarId].startSkills,
      makeActive,
      startingItemTokenIds,
      startingAmounts
    );
    if (isUpgrade) {
      uint24 evolvedAvatarId = uint24(EVOLVED_OFFSET + avatarId);
      // _upgradePlayer equivalent
      playerInfo.avatarId = evolvedAvatarId;
      playerInfo.upgradedTimestamp = uint40(block.timestamp);
      _players.upgradePlayer(playerId);
      uint256 tokenCost = 0; // Free when bridging
      emit UpgradePlayerAvatar(playerId, evolvedAvatarId, tokenCost);
      // end _upgradePlayer equivalent
    } else {
      _playerInfos[playerId].avatarId = uint24(avatarId);
    }
  }

  function burn(address from, uint256 playerId) external {
    require(from == _msgSender() || isApprovedForAll(from, _msgSender()), ERC1155BurnForbidden());
    _burn(from, playerId, 1);
  }

  function _upgradePlayer(uint256 playerId, uint24 newAvatarId) private {
    PlayerInfo storage playerInfo = _playerInfos[playerId];
    playerInfo.avatarId = newAvatarId;
    playerInfo.upgradedTimestamp = uint40(block.timestamp);
    _players.upgradePlayer(playerId);
    uint256 tokenCost = _upgradePlayerCost;
    _pay(tokenCost);
    emit UpgradePlayerAvatar(playerId, newAvatarId, tokenCost);
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
      _playerInfos[playerId].originalAvatarId = _playerInfos[playerId].avatarId;
      uint24 evolvedAvatarId = uint24(EVOLVED_OFFSET + _playerInfos[playerId].avatarId);
      _upgradePlayer(playerId, evolvedAvatarId);
    }

    emit EditPlayer(playerId, _msgSender(), trimmedName, amountPaid, discord, twitter, telegram, upgrade);
  }

  function _pay(uint256 tokenCost) private {
    address sender = _msgSender();
    _brush.transferFrom(sender, _treasury, (tokenCost * _brushTreasuryPercentage) / 100);
    _brush.transferFrom(sender, _dev, (tokenCost * _brushDevPercentage) / 100);
    _brush.burnFrom(sender, (tokenCost * _brushBurntPercentage) / 100);
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
    require(bytes(trimmedName).length >= 3, NameTooShort());
    require(bytes(trimmedName).length <= 20, NameTooLong());
    require(EstforLibrary.containsValidNameCharacters(trimmedName), NameInvalidCharacters());

    string memory trimmedAndLowercaseName = EstforLibrary.toLower(trimmedName);
    string memory oldName = EstforLibrary.toLower(_names[playerId]);
    nameChanged = keccak256(abi.encodePacked(oldName)) != keccak256(abi.encodePacked(trimmedAndLowercaseName));
    if (nameChanged) {
      require(!_lowercaseNames[trimmedAndLowercaseName], NameAlreadyExists());
      if (bytes(oldName).length != 0) {
        delete _lowercaseNames[oldName];
      }
      _lowercaseNames[trimmedAndLowercaseName] = true;
      _names[playerId] = trimmedName;
    }
  }

  function _checkMintingAvatar(uint256 avatarId) private view {
    require(bytes(_avatars[avatarId].description).length != 0 && avatarId <= NUM_BASE_AVATARS, BaseAvatarNotExists());
  }

  function _checkSocials(string calldata discord, string calldata twitter, string calldata telegram) private pure {
    require(bytes(discord).length <= 32, DiscordTooLong());
    require(EstforLibrary.containsBaselineSocialNameCharacters(discord), DiscordInvalidCharacters());

    require(bytes(twitter).length <= 32, TwitterTooLong());
    require(EstforLibrary.containsBaselineSocialNameCharacters(twitter), TwitterInvalidCharacters());

    require(bytes(telegram).length <= 32, TelegramTooLong());
    require(EstforLibrary.containsBaselineSocialNameCharacters(telegram), TelegramInvalidCharacters());
  }

  function _update(address from, address to, uint256[] memory ids, uint256[] memory amounts) internal virtual override {
    if (from != address(0) && amounts.length != 0 && from != to) {
      uint32 burned;
      IPlayers players = _players;
      for (uint256 i = 0; i < ids.length; ++i) {
        uint256 playerId = ids[i];
        players.clearEverythingBeforeTokenTransfer(from, playerId);
        if (to == address(0)) {
          // Burning
          string memory oldName = EstforLibrary.toLower(_names[playerId]);
          delete _lowercaseNames[oldName];
          ++burned;
        } else if (from != address(0)) {
          // Not minting
          players.beforeTokenTransferTo(to, playerId);
        }
      }
      if (burned != 0) {
        _numBurned += burned;
      }
    }
    super._update(from, to, ids, amounts);
  }

  function uri(uint256 playerId) public view virtual override returns (string memory) {
    require(exists(playerId), ERC1155Metadata_URIQueryForNonexistentToken());
    AvatarInfo storage avatarInfo = _avatars[_playerInfos[playerId].avatarId];
    string memory imageURI = string(abi.encodePacked(_imageBaseUri, avatarInfo.imageURI));
    return _players.getURI(playerId, _names[playerId], avatarInfo.name, avatarInfo.description, imageURI);
  }

  /**
   * @dev Returns whether `tokenId` exists.
   * Tokens can be managed by their owner or approved accounts via {setApprovalForAll}.
   */
  function exists(uint256 tokenId) public view returns (bool) {
    return _playerInfos[tokenId].avatarId != 0;
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}. This implementation is not standard ERC1155, it's optimized for the single account case
   */
  function balanceOfs(address account, uint16[] memory ids) external view returns (uint256[] memory batchBalances) {
    uint256 length = ids.length;
    batchBalances = new uint256[](length);
    for (uint256 i; i < length; ++i) {
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

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(IERC165, SamWitchERC1155UpgradeableSinglePerToken) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked("Estfor Players", _isBeta ? " (Beta)" : ""));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked("EK_P", _isBeta ? "B" : ""));
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
    emit SetAvatars(avatarIds, avatarInfos);
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

  function setUpgradeCost(uint72 upgradePlayerCost) public onlyOwner {
    _upgradePlayerCost = upgradePlayerCost;
    emit UpgradePlayerCost(upgradePlayerCost);
  }

  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external onlyOwner {
    require(brushBurntPercentage + brushTreasuryPercentage + brushDevPercentage == 100, PercentNotTotal100());

    _brushBurntPercentage = brushBurntPercentage;
    _brushTreasuryPercentage = brushTreasuryPercentage;
    _brushDevPercentage = brushDevPercentage;
    emit SetBrushDistributionPercentages(brushBurntPercentage, brushTreasuryPercentage, brushDevPercentage);
  }

  function tempSetHeroAndUpgradedTimestamps(
    uint256[] calldata playerIds,
    uint40[] calldata mintedTimestamps,
    uint40[] calldata upgradedTimestamps
  ) external onlyOwner {
    require(
      playerIds.length == mintedTimestamps.length && playerIds.length == upgradedTimestamps.length,
      LengthMismatch()
    );
    for (uint256 i; i < playerIds.length; ++i) {
      _playerInfos[playerIds[i]].mintedTimestamp = mintedTimestamps[i];
      _playerInfos[playerIds[i]].upgradedTimestamp = upgradedTimestamps[i];
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
