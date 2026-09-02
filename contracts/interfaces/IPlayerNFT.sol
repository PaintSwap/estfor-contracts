// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IBrushToken} from "./external/IBrushToken.sol";
import {IPlayers} from "./IPlayers.sol";
import {AvatarInfo, PlayerInfo} from "../globals/players.sol";
import {IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

interface IPlayerNFT is IERC1155MetadataURI, IERC2981 {
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
  event EditAvatar(uint256 playerId, uint256 newAvatarId);

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
  error NotCosmetics();

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
  ) external;
  function mint(
    uint256 avatarId,
    string calldata heroName,
    string calldata discord,
    string calldata twitter,
    string calldata telegram,
    bool upgrade,
    bool makeActive
  ) external;
  function burn(address from, uint256 playerId) external;
  function applyAvatarToPlayer(address owner, uint256 playerId, uint24 newAvatarId) external;
  function unapplyAvatarFromPlayer(address owner, uint256 playerId) external;
  function editPlayer(
    uint256 playerId,
    string calldata playerName,
    string calldata discord,
    string calldata twitter,
    string calldata telegram,
    bool upgrade
  ) external;
  function uri(uint256 playerId) external view returns (string memory);
  function exists(uint256 tokenId) external view returns (bool);
  function ownerOf(uint256 tokenId) external view returns (address);
  function balanceOfs(address account, uint16[] calldata ids) external view returns (uint256[] memory);
  function name() external view returns (string memory);
  function symbol() external view returns (string memory);
  function getPlayerInfo(uint256 playerId) external view returns (PlayerInfo memory);
  function hasLowercaseName(string calldata lowercaseName) external view returns (bool);
  function getName(uint256 playerId) external view returns (string memory);
  function setAvatars(uint256[] calldata avatarIds, AvatarInfo[] calldata avatarInfos) external;
  function setImageBaseUri(string calldata imageBaseUri) external;
  function setPlayers(IPlayers players) external;
  function setEditNameCost(uint72 editNameCost) external;
  function setUpgradeCost(uint72 upgradePlayerCost) external;
  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external;
  function tempSetHeroAndUpgradedTimestamps(
    uint256[] calldata playerIds,
    uint40[] calldata mintedTimestamps,
    uint40[] calldata upgradedTimestamps
  ) external;
  function setDevAddress(address dev) external;
  function setMarketplaceAddress(address marketplaceAddress) external;
  function setCosmeticsAddress(address cosmeticsAddress) external;
}
