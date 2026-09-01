// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../contracts/globals/actions.sol";
import "../../contracts/globals/clans.sol";
import "../../contracts/globals/items.sol";
import "../../contracts/globals/misc.sol";
import "../../contracts/globals/pets.sol";
import "../../contracts/globals/players.sol";
import "../../contracts/globals/promotions.sol";
import "../../contracts/globals/quests.sol";
import "../../contracts/globals/rewards.sol";

interface PlayerNFT {
    function NUM_BASE_AVATARS() external view returns (uint256);
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function applyAvatarToPlayer(address owner, uint256 playerId, uint24 newAvatarId) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external
        view
        returns (uint256[] memory);
    function balanceOfs(address account, uint16[] calldata ids) external view returns (uint256[] memory batchBalances);
    function burn(address from_, uint256 playerId) external;
    function editPlayer(
        uint256 playerId,
        string calldata playerName,
        string calldata discord,
        string calldata twitter,
        string calldata telegram,
        bool upgrade
    ) external;
    function exists(uint256 tokenId) external view returns (bool);
    function getName(uint256 playerId) external view returns (string memory);
    function getPlayerInfo(uint256 playerId) external view returns (PlayerInfo memory);
    function hasLowercaseName(string calldata lowercaseName) external view returns (bool lowercaseNameExists);
    function initialize(
        address brush,
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
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function mint(
        uint256 avatarId,
        string calldata heroName,
        string calldata discord,
        string calldata twitter,
        string calldata telegram,
        bool upgrade,
        bool makeActive
    ) external;
    function name() external view returns (string memory);
    function owner() external view returns (address);
    function ownerOf(uint256 id) external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function renounceOwnership() external;
    function royaltyInfo(uint256 arg0, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount);
    function safeBatchTransferFrom(
        address from_,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external;
    function safeTransferFrom(address from_, address to, uint256 id, uint256 value, bytes calldata data) external;
    function setApprovalForAll(address operator, bool approved) external;
    function setAvatars(uint256[] calldata avatarIds, AvatarInfo[] calldata avatarInfos) external;
    function setBrushDistributionPercentages(
        uint8 brushBurntPercentage,
        uint8 brushTreasuryPercentage,
        uint8 brushDevPercentage
    ) external;
    function setCosmeticsAddress(address cosmeticsAddress) external;
    function setDevAddress(address dev) external;
    function setEditNameCost(uint72 editNameCost) external;
    function setImageBaseUri(string calldata imageBaseUri) external;
    function setMarketplaceAddress(address marketplaceAddress) external;
    function setPlayers(address players) external;
    function setUpgradeCost(uint72 upgradePlayerCost) external;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function symbol() external view returns (string memory);
    function tempSetHeroAndUpgradedTimestamps(
        uint256[] calldata playerIds,
        uint40[] calldata mintedTimestamps,
        uint40[] calldata upgradedTimestamps
    ) external;
    function totalSupply() external view returns (uint256);
    function totalSupply(uint256 tokenId) external view returns (uint256);
    function transferOwnership(address newOwner) external;
    function unapplyAvatarFromPlayer(address owner, uint256 playerId) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function uri(uint256 playerId) external view returns (string memory);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event EditAvatar(uint256 playerId, uint256 newAvatarId);
    event EditNameCost(uint256 newCost);
    event EditPlayer(
        uint256 playerId,
        address from_,
        string newName,
        uint256 paid,
        string discord,
        string twitter,
        string telegram,
        bool upgrade
    );
    event Initialized(uint64 version);
    event NewPlayer(
        uint256 playerId,
        uint256 avatarId,
        string name,
        address from_,
        string discord,
        string twitter,
        string telegram,
        bool upgrade
    );
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SetAvatars(uint256[] avatarIds, AvatarInfo[] avatarInfos);
    event SetBrushDistributionPercentages(
        uint256 brushBurntPercentage, uint256 brushTreasuryPercentage, uint256 brushDevPercentage
    );
    event TransferBatch(
        address indexed operator, address indexed from_, address indexed to, uint256[] ids, uint256[] values
    );
    event TransferSingle(
        address indexed operator, address indexed from_, address indexed to, uint256 id, uint256 value
    );
    event URI(string value, uint256 indexed id);
    event UpgradePlayerAvatar(uint256 playerId, uint256 newAvatarId, uint256 tokenCost);
    event UpgradePlayerCost(uint256 newCost);
    event Upgraded(address indexed implementation);
    error AddressEmptyCode(address target);
    error BaseAvatarNotExists();
    error DiscordInvalidCharacters();
    error DiscordTooLong();
    error ERC1155BurnForbidden();
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);
    error ERC1155InvalidApprover(address approver);
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);
    error ERC1155InvalidOperator(address operator);
    error ERC1155InvalidReceiver(address receiver);
    error ERC1155InvalidSender(address sender);
    error ERC1155Metadata_URIQueryForNonexistentToken();
    error ERC1155MintingMoreThanOneSameNFT();
    error ERC1155MissingApprovalForAll(address operator, address owner);
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidInitialization();
    error LengthMismatch();
    error MintedMoreThanAllowed();
    error NameAlreadyExists();
    error NameInvalidCharacters();
    error NameTooLong();
    error NameTooShort();
    error NotBridge();
    error NotCosmetics();
    error NotInWhitelist();
    error NotInitializing();
    error NotOwnerOfPlayer();
    error NotPlayers();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PercentNotTotal100();
    error TelegramInvalidCharacters();
    error TelegramTooLong();
    error TwitterInvalidCharacters();
    error TwitterTooLong();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
}
