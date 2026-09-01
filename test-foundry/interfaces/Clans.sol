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

interface Clans {
    struct Tier {
        uint8 id;
        uint16 maxMemberCapacity;
        uint16 maxBankCapacity;
        uint24 maxImageId;
        uint40 minimumAge;
        uint80 price;
    }

    struct NFTInfo {
        address nft;
        uint80 nftType;
    }

    struct PlayerInfo {
        uint40 clanId;
        ClanRank rank;
        uint40 requestedClanId;
    }
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function acceptInvite(uint256 clanId, uint256 playerId, uint256 gateKeepTokenId) external;
    function acceptJoinRequests(uint256 clanId, uint256[] calldata newMemberPlayerIds, uint256 playerId) external;
    function addTiers(Clans.Tier[] calldata tiers) external;
    function addXP(uint256 clanId, uint40 xp, bool xpEmittedElsewhere) external;
    function canWithdraw(uint256 clanId, uint256 playerId) external view returns (bool);
    function changeRank(uint256 clanId, uint256 memberId, ClanRank rank, uint256 playerId) external;
    function changeRanks(uint256 clanId, uint256[] calldata memberIds, ClanRank[] calldata ranks, uint256 playerId)
        external;
    function claimOwnership(uint256 clanId, uint256 playerId) external;
    function createClan(
        uint256 playerId,
        string calldata name,
        string calldata discord,
        string calldata telegram,
        string calldata twitter,
        uint16 imageId,
        uint8 tierId
    ) external;
    function createClanBridge(
        address from_,
        uint256 playerId,
        uint256 clanId,
        string calldata name,
        string calldata discord,
        string calldata telegram,
        string calldata twitter,
        uint256 imageId,
        uint256 createdTimestamp,
        uint256 tierId,
        uint256 mmr,
        bool disableJoinRequests
    ) external;
    function deleteInvitesAsClan(uint256 clanId, uint256[] calldata invitedPlayerIds, uint256 playerId) external;
    function deleteInvitesAsPlayer(uint256[] calldata clanIds, uint256 playerId) external;
    function editClan(
        uint256 clanId,
        string calldata name,
        string calldata discord,
        string calldata telegram,
        string calldata twitter,
        uint256 imageId,
        uint256 playerId
    ) external;
    function editTiers(Clans.Tier[] calldata tiers) external;
    function gateKeep(uint256 clanId, Clans.NFTInfo[] calldata nftInfos, uint256 playerId) external;
    function getClan(uint256 clanId)
        external
        view
        returns (
            uint64 ownerPlayerId,
            uint16 imageId,
            uint16 memberCount,
            uint40 createdTimestamp,
            uint8 tierId,
            bool disableJoinRequests,
            uint16 mmr,
            string memory name,
            Clans.NFTInfo[] memory gateKeptNFTs
        );
    function getClanBankAddress(uint256 clanId) external view returns (address bankAddress);
    function getClanId(uint256 playerId) external view returns (uint256);
    function getClanIdFromPlayer(uint256 playerId) external view returns (uint256);
    function getClanNameOfPlayer(uint256 playerId) external view returns (string memory);
    function getClanTierMembership(uint256 playerId) external view returns (uint8);
    function getEditNameCost() external view returns (uint80);
    function getLowercaseNames(string calldata name) external view returns (bool);
    function getMMR(uint256 clanId) external view returns (uint16 mmr);
    function getPlayerInfo(uint256 playerId) external view returns (Clans.PlayerInfo memory);
    function getRank(uint256 clanId, uint256 playerId) external view returns (ClanRank rank);
    function getTier(uint256 tierId) external view returns (Clans.Tier memory);
    function hasInviteRequest(uint256 clanId, uint256 playerId) external view returns (bool);
    function initialize(
        address brush,
        address playerNFT,
        address treasury,
        address dev,
        uint80 editNameCost,
        address paintswapMarketplaceWhitelist,
        uint16 initialMMR,
        uint40 startClanId,
        address bridge,
        address activityPoints
    ) external;
    function initializeAddresses(
        address players,
        address bankFactory,
        address territories,
        address lockedBankVaults,
        address raids
    ) external;
    function initializeV2(address combatantsHelper) external;
    function inviteMembers(uint256 clanId, uint256[] calldata memberPlayerIds, uint256 playerId) external;
    function isClanMember(uint256 clanId, uint256 playerId) external view returns (bool);
    function isMemberOfAnyClan(uint256 playerId) external view returns (bool);
    function maxBankCapacity(uint256 clanId) external view returns (uint16);
    function maxMemberCapacity(uint256 clanId) external view returns (uint16);
    function owner() external view returns (address);
    function pinMessage(uint256 clanId, string calldata message, uint256 playerId) external;
    function proxiableUUID() external view returns (bytes32);
    function removeJoinRequest(uint256 clanId, uint256 playerId) external;
    function removeJoinRequestsAsClan(uint256 clanId, uint256[] calldata joinRequestPlayerIds, uint256 playerId)
        external;
    function renounceOwnership() external;
    function renounceOwnershipTo(uint256 clanId, uint256 newOwnerPlayerId, ClanRank newRank) external;
    function requestToJoin(uint256 clanId, uint256 playerId, uint256 gateKeepTokenId) external;
    function setActivityPoints(address activityPoints) external;
    function setBrushDistributionPercentages(
        uint8 brushBurntPercentage,
        uint8 brushTreasuryPercentage,
        uint8 brushDevPercentage
    ) external;
    function setDevAddress(address dev) external;
    function setEditNameCost(uint80 editNameCost) external;
    function setInitialMMR(uint16 mmr) external;
    function setJoinRequestsEnabled(uint256 clanId, bool joinRequestsEnabled, uint256 playerId) external;
    function setMMR(uint256 clanId, uint16 mmr) external;
    function setXPModifiers(address[] calldata accounts, bool isModifier) external;
    function transferOwnership(address newOwner) external;
    function upgradeClan(uint256 clanId, uint256 playerId, uint8 newTierId) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event AddTiers(Clans.Tier[] tiers);
    event AddXP(uint256 clanId, uint256 xp, bool xpEmittedElsewhere);
    event ClanCreated(
        uint256 clanId, uint256 playerId, string[] clanInfo, uint256 imageId, uint256 tierId, uint256 createdTimestamp
    );
    event ClanDestroyed(uint256 clanId);
    event ClanEdited(uint256 clanId, uint256 playerId, string[] clanInfo, uint256 imageId);
    event ClanOwnerLeft(uint256 clanId, uint256 playerId);
    event ClanOwnershipTransferred(uint256 clanId, uint256 playerId);
    event ClanUpgraded(uint256 clanId, uint256 playerId, uint256 tierId);
    event EditNameCost(uint256 newCost);
    event EditTiers(Clans.Tier[] tiers);
    event GateKeepNFTs(uint256 clanId, address[] nfts, uint256 playerId);
    event Initialized(uint64 version);
    event InviteAccepted(uint256 clanId, uint256 playerId);
    event InviteSent(uint256 clanId, uint256 playerId, uint256 fromPlayerId);
    event InvitesDeletedByClan(uint256 clanId, uint256[] invitedPlayerIds, uint256 deletedInvitesPlayerId);
    event InvitesDeletedByPlayer(uint256[] clanIds, uint256 playerId);
    event InvitesSent(uint256 clanId, uint256[] playerIds, uint256 fromPlayerId);
    event JoinRequestAccepted(uint256 clanId, uint256 playerId, uint256 acceptedByPlayerId);
    event JoinRequestRemoved(uint256 clanId, uint256 playerId);
    event JoinRequestSent(uint256 clanId, uint256 playerId);
    event JoinRequestsAccepted(uint256 clanId, uint256[] playerIds, uint256 acceptedByPlayerId);
    event JoinRequestsEnabled(uint256 clanId, bool joinRequestsEnabled, uint256 playerId);
    event JoinRequestsRemovedByClan(
        uint256 clanId, uint256[] joinRequestPlayerIds, uint256 removingJoinRequestsPlayerId
    );
    event MemberLeft(uint256 clanId, uint256 playerId, uint256 removedByPlayerId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PinMessage(uint256 clanId, string message, uint256 playerId);
    event PlayerRankUpdated(uint256 clanId, uint256 memberId, ClanRank rank, uint256 playerId);
    event SetBrushDistributionPercentages(
        uint256 brushBurntPercentage, uint256 brushTreasuryPercentage, uint256 brushDevPercentage
    );
    event SetClanRank(uint256 clanId, uint256 playerId, ClanRank clan);
    event SetInitialMMR(uint256 mmr);
    event SetMMR(uint256 clanId, uint256 mmr);
    event Upgraded(address indexed implementation);
    error AddressEmptyCode(address target);
    error AlreadyInClan();
    error AlreadySentInvite();
    error AlreadySentJoinRequest();
    error BankCapacityTooLow();
    error BankFactoryAlreadySet();
    error CannotDowngradeTier();
    error CannotRenounceToSelf();
    error CannotSetSameRank();
    error ChangingRankEqualOrHigherThanSelf();
    error ChangingRankOfPlayerEqualOrHigherThanSelf();
    error ChangingRankOfPlayerHigherThanSelf();
    error ClanDestroyFailedHasMembers();
    error ClanDoesNotExist();
    error ClanIsFull();
    error DiscordInvalidCharacters();
    error DiscordTooLong();
    error DiscordTooShort();
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error ImageIdTooLow();
    error InvalidImageId();
    error InvalidInitialization();
    error InvalidNFTType();
    error InviteDoesNotExist();
    error JoinRequestsDisabled();
    error MemberCapacityTooLow();
    error MessageTooLong();
    error NFTNotWhitelistedOnMarketplace();
    error NameAlreadyExists();
    error NameInvalidCharacters();
    error NameTooLong();
    error NameTooShort();
    error NoGateKeptNFTFound();
    error NoInvitesToDelete();
    error NoJoinRequest();
    error NoJoinRequestsToDelete();
    error NotBridge();
    error NotInitializing();
    error NotMMRSetter();
    error NotMemberOfClan();
    error NotOwnerOfPlayer();
    error NotOwnerOfPlayerAndActive();
    error NotXPModifier();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error OwnerExists();
    error PercentNotTotal100();
    error PlayersAlreadySet();
    error PriceTooLow();
    error RankMustBeLowerRenounce();
    error RankNotHighEnough();
    error TelegramInvalidCharacters();
    error TelegramTooLong();
    error TierAlreadyExists();
    error TierDoesNotExist();
    error TooManyNFTs();
    error TwitterInvalidCharacters();
    error TwitterTooLong();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error UnsupportedNFTType();
}
