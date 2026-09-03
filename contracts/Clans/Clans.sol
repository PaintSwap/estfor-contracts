// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "../interfaces/external/IBrushToken.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IClans} from "../interfaces/IClans.sol";
import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IBank} from "../interfaces/IBank.sol";
import {IMarketplaceWhitelist} from "../interfaces/external/IMarketplaceWhitelist.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";
import {ICombatantsHelper} from "../interfaces/ICombatantsHelper.sol";
import {EstforLibrary} from "../EstforLibrary.sol";

import {BloomFilter} from "../libraries/BloomFilter.sol";

import {ClanRank} from "../globals/clans.sol";

import {IActivityPoints, IActivityPointsCaller, ActivityType} from "../ActivityPoints/interfaces/IActivityPoints.sol";

/// @custom:oz-upgrades-from ClansV1
contract Clans is UUPSUpgradeable, OwnableUpgradeable, IClans, IActivityPointsCaller {
  using BloomFilter for BloomFilter.Filter;

  struct Clan {
    uint64 ownerPlayerId;
    uint16 imageId;
    uint16 memberCount;
    uint40 createdTimestamp;
    uint8 tierId;
    bool disableJoinRequests;
    uint16 mmr;
    uint40 xp;
    string name;
    mapping(uint256 playerId => bool invited) inviteRequests;
    NFTInfo[] gateKeptNFTs;
  }

  IBrushToken private _brush;
  IPlayers private _players;
  IBankFactory private _bankFactory;
  IERC1155 private _playerNFT;
  uint40 private _nextClanId;
  uint16 private _initialMMR;
  address private _treasury;
  uint80 private _editNameCost;
  address private _dev;
  uint8 private _brushBurntPercentage;
  uint8 private _brushTreasuryPercentage;
  uint8 private _brushDevPercentage;
  address private _paintswapMarketplaceWhitelist;
  IClanMemberLeftCB private _territories;
  IClanMemberLeftCB private _lockedBankVaults;
  IClanMemberLeftCB private _raids;
  mapping(uint256 clanId => Clan clan) private _clans;
  mapping(uint256 playerId => PlayerInfo) private _playerInfo;
  mapping(uint256 id => Tier tier) private _tiers;
  mapping(string name => bool exists) private _lowercaseNames;
  mapping(uint256 clanId => uint40 timestampLeft) private _ownerlessClanTimestamps; // timestamp
  mapping(address account => bool isModifier) private _xpModifiers;
  BloomFilter.Filter private _reservedClanNames; // TODO: unused
  address private _bridge; // TODO: Bridge Can remove later if no longer need the bridge
  IActivityPoints private _activityPoints;
  ICombatantsHelper private _combatantsHelper;

  modifier isOwnerOfPlayer(uint256 playerId) {
    require(_playerNFT.balanceOf(_msgSender(), playerId) != 0, NotOwnerOfPlayer());
    _;
  }

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  modifier isMinimumRank(uint256 clanId, uint256 playerId, ClanRank rank) {
    PlayerInfo storage player = _playerInfo[playerId];
    require(player.clanId == clanId, NotMemberOfClan());
    require(_playerInfo[playerId].rank >= rank, RankNotHighEnough());
    _;
  }

  modifier isMemberOfClan(uint256 clanId, uint256 playerId) {
    require(_playerInfo[playerId].clanId == clanId, NotMemberOfClan());
    _;
  }

  modifier isXPModifier() {
    require(_xpModifiers[_msgSender()], NotXPModifier());
    _;
  }

  modifier onlyMMRSetter() {
    require(_msgSender() == address(_lockedBankVaults), NotMMRSetter());
    _;
  }

  modifier onlyBridge() {
    require(_msgSender() == _bridge, NotBridge());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken brush,
    IERC1155 playerNFT,
    address treasury,
    address dev,
    uint80 editNameCost,
    address paintswapMarketplaceWhitelist,
    uint16 initialMMR,
    uint40 startClanId,
    address bridge,
    IActivityPoints activityPoints
  ) external override initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();

    _brush = brush;
    _playerNFT = playerNFT;
    _treasury = treasury;
    _dev = dev;
    _nextClanId = startClanId;
    _paintswapMarketplaceWhitelist = paintswapMarketplaceWhitelist;
    setEditNameCost(editNameCost);
    setInitialMMR(initialMMR);
    _bridge = bridge;
    _activityPoints = activityPoints;
  }

  // TODO: remove in prod
  function setActivityPoints(address activityPoints) external override(IClans, IActivityPointsCaller) onlyOwner {
    _activityPoints = IActivityPoints(activityPoints);
  }

  function initializeV2(ICombatantsHelper combatantsHelper) external override reinitializer(2) {
    _combatantsHelper = combatantsHelper;
  }

  function createClan(
    uint256 playerId,
    string calldata name,
    string calldata discord,
    string calldata telegram,
    string calldata twitter,
    uint16 imageId,
    uint8 tierId
  ) external override isOwnerOfPlayerAndActive(playerId) {
    require(!isMemberOfAnyClan(playerId), AlreadyInClan());

    Tier storage tier = _tiers[tierId];
    _checkTierExists(tierId);
    _checkClanImage(imageId, tier.maxImageId);

    uint256 clanId = _nextClanId++;
    Clan storage clan = _clans[clanId];
    clan.ownerPlayerId = uint64(playerId);
    clan.tierId = tierId;
    clan.imageId = imageId;
    clan.memberCount = 1;
    clan.createdTimestamp = uint40(block.timestamp);
    clan.mmr = _initialMMR;

    PlayerInfo storage player = _playerInfo[playerId];
    player.clanId = uint32(clanId);
    player.rank = ClanRank.OWNER;
    if (player.requestedClanId != 0) {
      removeJoinRequest(player.requestedClanId, playerId);
    }

    address msgSender = _msgSender();
    (string memory trimmedName, ) = _setName(clanId, name);
    _checkSocials(discord, telegram, twitter);
    string[] memory clanInfo = _createClanInfo(trimmedName, discord, telegram, twitter);
    emit ClanCreated(clanId, playerId, clanInfo, imageId, tierId, block.timestamp);
    _pay(tier.price);

    _activityPoints.rewardBlueTickets(
      ActivityType.clans_evt_clancreated,
      _bankFactory.createBank(msgSender, clanId),
      _players.isPlayerEvolved(playerId),
      1
    );
  }

  function createClanBridge(
    address from,
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
  ) external override onlyBridge {
    Clan storage clan = _clans[clanId];
    clan.ownerPlayerId = uint64(playerId);
    clan.tierId = uint8(tierId);
    clan.imageId = uint16(imageId);
    clan.memberCount = 1;
    clan.createdTimestamp = uint40(createdTimestamp);
    clan.mmr = uint16(mmr);

    PlayerInfo storage player = _playerInfo[playerId];
    player.clanId = uint32(clanId);
    player.rank = ClanRank.OWNER;

    // don't call _setName to avoid name reservation check
    clan.name = name;
    _lowercaseNames[EstforLibrary.toLower(name)] = true; // already trimmed

    string[] memory clanInfo = _createClanInfo(name, discord, telegram, twitter);
    emit ClanCreated(clanId, playerId, clanInfo, imageId, tierId, createdTimestamp);
    if (disableJoinRequests) {
      clan.disableJoinRequests = disableJoinRequests;
      emit JoinRequestsEnabled(clanId, !disableJoinRequests, playerId);
    }
    emit SetMMR(clanId, mmr);
    _bankFactory.createBank(from, clanId);
  }

  function editClan(
    uint256 clanId,
    string calldata name,
    string calldata discord,
    string calldata telegram,
    string calldata twitter,
    uint256 imageId,
    uint256 playerId
  ) external override isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.LEADER) {
    Clan storage clan = _clans[clanId];
    Tier storage tier = _tiers[clan.tierId];
    _checkClanImage(imageId, tier.maxImageId);
    (string memory trimmedName, bool nameChanged) = _setName(clanId, name);
    if (nameChanged) {
      _pay(_editNameCost);
    }

    _checkSocials(discord, telegram, twitter);
    string[] memory clanInfo = _createClanInfo(trimmedName, discord, telegram, twitter);
    emit ClanEdited(clanId, playerId, clanInfo, imageId);
  }

  function deleteInvitesAsPlayer(
    uint256[] calldata clanIds,
    uint256 playerId
  ) external override isOwnerOfPlayer(playerId) {
    require(clanIds.length != 0, NoInvitesToDelete());

    for (uint256 i = 0; i < clanIds.length; ++i) {
      uint256 clanId = clanIds[i];
      require(_clans[clanId].inviteRequests[playerId], InviteDoesNotExist());
      delete _clans[clanId].inviteRequests[playerId];
    }
    emit InvitesDeletedByPlayer(clanIds, playerId);
  }

  function deleteInvitesAsClan(
    uint256 clanId,
    uint256[] calldata invitedPlayerIds,
    uint256 playerId
  ) external override isOwnerOfPlayer(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    require(invitedPlayerIds.length != 0, NoInvitesToDelete());

    for (uint256 i = 0; i < invitedPlayerIds.length; ++i) {
      uint256 invitedPlayerId = invitedPlayerIds[i];
      require(clan.inviteRequests[invitedPlayerId], InviteDoesNotExist());
      clan.inviteRequests[invitedPlayerId] = false;
    }

    emit InvitesDeletedByClan(clanId, invitedPlayerIds, playerId);
  }

  function inviteMembers(
    uint256 clanId,
    uint256[] calldata memberPlayerIds,
    uint256 playerId
  ) external override isOwnerOfPlayer(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    Tier storage tier = _tiers[clan.tierId];
    require(clan.memberCount + memberPlayerIds.length <= tier.maxMemberCapacity, ClanIsFull());

    for (uint256 i = 0; i < memberPlayerIds.length; ++i) {
      _inviteMember(clanId, memberPlayerIds[i]);
    }
    emit InvitesSent(clanId, memberPlayerIds, playerId);
  }

  function _acceptInvite(uint256 clanId, uint256 playerId, uint256 gateKeepTokenId) private {
    Clan storage clan = _clans[clanId];

    require(clan.inviteRequests[playerId], InviteDoesNotExist());
    require(!isMemberOfAnyClan(playerId), AlreadyInClan());

    _checkGateKeeping(clanId, gateKeepTokenId);

    Tier storage tier = _tiers[clan.tierId];
    require(clan.memberCount < tier.maxMemberCapacity, ClanIsFull());

    clan.inviteRequests[playerId] = false;
    clan.memberCount++;

    PlayerInfo storage player = _playerInfo[playerId];
    player.clanId = uint32(clanId);
    player.rank = ClanRank.COMMONER;
    player.requestedClanId = 0;

    emit InviteAccepted(clanId, playerId);
  }

  function acceptInvite(
    uint256 clanId,
    uint256 playerId,
    uint256 gateKeepTokenId
  ) external override isOwnerOfPlayerAndActive(playerId) {
    _acceptInvite(clanId, playerId, gateKeepTokenId);
  }

  function requestToJoin(
    uint256 clanId,
    uint256 playerId,
    uint256 gateKeepTokenId
  ) external override isOwnerOfPlayerAndActive(playerId) {
    _requestToJoin(clanId, playerId, gateKeepTokenId);
  }

  function removeJoinRequest(uint256 clanId, uint256 playerId) public override isOwnerOfPlayer(playerId) {
    _playerInfo[playerId].requestedClanId = 0;
    emit JoinRequestRemoved(clanId, playerId);
  }

  function removeJoinRequestsAsClan(
    uint256 clanId,
    uint256[] calldata joinRequestPlayerIds,
    uint256 playerId
  ) external override isOwnerOfPlayer(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    require(joinRequestPlayerIds.length != 0, NoJoinRequestsToDelete());

    for (uint256 i = 0; i < joinRequestPlayerIds.length; ++i) {
      uint256 joinRequestPlayerId = joinRequestPlayerIds[i];
      PlayerInfo storage playerInfo = _playerInfo[joinRequestPlayerId];
      require(playerInfo.requestedClanId == clanId, NoJoinRequest());
      playerInfo.requestedClanId = 0;
    }

    emit JoinRequestsRemovedByClan(clanId, joinRequestPlayerIds, playerId);
  }

  function acceptJoinRequests(
    uint256 clanId,
    uint256[] calldata newMemberPlayerIds,
    uint256 playerId
  ) public override isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    Tier storage tier = _tiers[clan.tierId];
    require(clan.memberCount + newMemberPlayerIds.length <= tier.maxMemberCapacity, ClanIsFull());

    for (uint256 i = 0; i < newMemberPlayerIds.length; ++i) {
      _acceptJoinRequest(clanId, newMemberPlayerIds[i]);
    }

    emit JoinRequestsAccepted(clanId, newMemberPlayerIds, playerId);
  }

  function changeRank(
    uint256 clanId,
    uint256 memberId,
    ClanRank rank,
    uint256 playerId
  ) public override isOwnerOfPlayer(playerId) isMemberOfClan(clanId, memberId) {
    ClanRank currentMemberRank = _playerInfo[memberId].rank;
    ClanRank callerRank = _playerInfo[playerId].rank;
    bool changingSelf = memberId == playerId;

    require(callerRank > rank, ChangingRankEqualOrHigherThanSelf());

    // Cannot change Rank of someone higher or equal yourself
    if (changingSelf) {
      require(callerRank >= currentMemberRank, ChangingRankOfPlayerHigherThanSelf());
    } else {
      require(callerRank > currentMemberRank, ChangingRankOfPlayerEqualOrHigherThanSelf());
    }

    require(currentMemberRank != rank, CannotSetSameRank());

    bool isDemoting = currentMemberRank > rank;
    if (isDemoting) {
      // Are they leaving?
      if (rank == ClanRank.NONE) {
        _removeFromClan(clanId, memberId, playerId);
      } else {
        // If owner is leaving their post then we need to update the owned state
        if (currentMemberRank == ClanRank.OWNER) {
          _ownerCleared(clanId);
        }
        _updateRank(clanId, memberId, rank, playerId);
      }
    } else {
      // Promoting
      _updateRank(clanId, memberId, rank, playerId);
    }
  }

  function changeRanks(
    uint256 clanId,
    uint256[] calldata memberIds,
    ClanRank[] calldata ranks,
    uint256 playerId
  ) external override isOwnerOfPlayer(playerId) {
    for (uint256 i = 0; i < memberIds.length; ++i) {
      changeRank(clanId, memberIds[i], ranks[i], playerId);
    }
  }

  function renounceOwnershipTo(
    uint256 clanId,
    uint256 newOwnerPlayerId,
    ClanRank newRank
  ) external override isOwnerOfPlayer(_clans[clanId].ownerPlayerId) isMemberOfClan(clanId, newOwnerPlayerId) {
    Clan storage clan = _clans[clanId];
    uint256 oldOwnerPlayerId = clan.ownerPlayerId;

    require(newOwnerPlayerId != oldOwnerPlayerId, CannotRenounceToSelf());

    if (newRank != ClanRank.NONE) {
      require(newRank < ClanRank.OWNER, RankMustBeLowerRenounce());
      // Change old owner to new rank
      _updateRank(clanId, oldOwnerPlayerId, newRank, oldOwnerPlayerId);
    } else {
      _removeFromClan(clanId, oldOwnerPlayerId, oldOwnerPlayerId);
    }
    _claimOwnership(clanId, newOwnerPlayerId);
  }

  // Can claim a clan if there is no owner
  function claimOwnership(
    uint256 clanId,
    uint256 playerId
  ) external override isOwnerOfPlayer(playerId) isMemberOfClan(clanId, playerId) {
    Clan storage clan = _clans[clanId];
    require(clan.ownerPlayerId == 0, OwnerExists());

    _claimOwnership(clanId, playerId);
  }

  function setJoinRequestsEnabled(
    uint256 clanId,
    bool joinRequestsEnabled,
    uint256 playerId
  ) external override isOwnerOfPlayer(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    clan.disableJoinRequests = !joinRequestsEnabled;
    emit JoinRequestsEnabled(clanId, joinRequestsEnabled, playerId);
  }

  function upgradeClan(uint256 clanId, uint256 playerId, uint8 newTierId) public override isOwnerOfPlayer(playerId) {
    _upgradeClan(clanId, playerId, newTierId);
  }

  function pinMessage(
    uint256 clanId,
    string calldata message,
    uint256 playerId
  ) external override isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.LEADER) {
    require(bytes(message).length <= 200, MessageTooLong());
    emit PinMessage(clanId, message, playerId);
  }

  function gateKeep(
    uint256 clanId,
    NFTInfo[] calldata nftInfos,
    uint256 playerId
  ) external override isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.LEADER) {
    require(nftInfos.length <= 5, TooManyNFTs());

    address[] memory nfts = new address[](nftInfos.length);
    IMarketplaceWhitelist paintswapMarketplaceWhitelist = IMarketplaceWhitelist(_paintswapMarketplaceWhitelist);
    for (uint256 i; i < nftInfos.length; ++i) {
      // This must be whitelisted by the PaintSwapMarketplace marketplace
      address nft = nftInfos[i].nft;
      require(paintswapMarketplaceWhitelist.isWhitelisted(nft), NFTNotWhitelistedOnMarketplace());
      // Must be a supported NFT standard
      uint256 nftType = nftInfos[i].nftType;

      // Checks supportsInterface is correct
      if (nftType == 721) {
        require(IERC721(nft).supportsInterface(type(IERC721).interfaceId), InvalidNFTType());
      } else if (nftType == 1155) {
        require(IERC1155(nft).supportsInterface(type(IERC1155).interfaceId), InvalidNFTType());
      } else {
        revert UnsupportedNFTType();
      }

      nfts[i] = nft;
    }

    _clans[clanId].gateKeptNFTs = nftInfos;
    emit GateKeepNFTs(clanId, nfts, playerId);
  }

  // The flag is for cases where XP is added in the future and not part of those events
  function addXP(uint256 clanId, uint40 xp, bool xpEmittedElsewhere) external override isXPModifier {
    _clans[clanId].xp += xp;
    emit AddXP(clanId, xp, xpEmittedElsewhere);
  }

  function setMMR(uint256 clanId, uint16 mmr) external override onlyMMRSetter {
    _clans[clanId].mmr = mmr;
  }

  function _checkClanImage(uint256 imageId, uint256 maxImageId) private pure {
    require(imageId != 0 && imageId <= maxImageId, InvalidImageId());
  }

  function _setName(
    uint256 clanId,
    string calldata name
  ) private returns (string memory trimmedName, bool nameChanged) {
    // Trimmed name cannot be empty
    trimmedName = EstforLibrary.trim(name);
    require(bytes(trimmedName).length >= 3, NameTooShort());
    require(bytes(trimmedName).length <= 20, NameTooLong());
    require(EstforLibrary.containsValidNameCharacters(trimmedName), NameInvalidCharacters());

    string memory trimmedAndLowercaseName = EstforLibrary.toLower(trimmedName);
    Clan storage clan = _clans[clanId];
    string memory oldName = EstforLibrary.toLower(clan.name);
    nameChanged = keccak256(abi.encodePacked(oldName)) != keccak256(abi.encodePacked(trimmedAndLowercaseName));
    if (nameChanged) {
      require(!_lowercaseNames[trimmedAndLowercaseName], NameAlreadyExists());
      if (bytes(oldName).length != 0) {
        delete _lowercaseNames[oldName];
      }
      _lowercaseNames[trimmedAndLowercaseName] = true;
      clan.name = trimmedName;
    }
  }

  function _checkSocials(string calldata discord, string calldata telegram, string calldata twitter) private pure {
    uint256 discordLength = bytes(discord).length;
    require(discordLength <= 25, DiscordTooLong());
    require(discordLength == 0 || discordLength >= 4, DiscordTooShort());
    require(EstforLibrary.containsBaselineSocialNameCharacters(discord), DiscordInvalidCharacters());

    uint256 telegramLength = bytes(telegram).length;
    require(telegramLength <= 25, TelegramTooLong());
    require(EstforLibrary.containsBaselineSocialNameCharacters(telegram), TelegramInvalidCharacters());

    uint256 twitterLength = bytes(twitter).length;
    require(twitterLength <= 25, TwitterTooLong());
    require(EstforLibrary.containsBaselineSocialNameCharacters(twitter), TwitterInvalidCharacters());
  }

  function _createClanInfo(
    string memory trimmedName,
    string calldata discord,
    string calldata telegram,
    string calldata twitter
  ) private pure returns (string[] memory clanInfo) {
    clanInfo = new string[](4);
    clanInfo[0] = trimmedName;
    clanInfo[1] = discord;
    clanInfo[2] = telegram;
    clanInfo[3] = twitter;
  }

  function _checkGateKeeping(uint256 clanId, uint256 gateKeepTokenId) private view {
    NFTInfo[] memory nftInfo = _clans[clanId].gateKeptNFTs;
    if (nftInfo.length != 0) {
      bool foundNFT;
      // Check the player owns one of these NFTs
      address sender = _msgSender();
      for (uint256 i = 0; i < nftInfo.length && !foundNFT; ++i) {
        if (nftInfo[i].nftType == 1155) {
          foundNFT = IERC1155(nftInfo[i].nft).balanceOf(sender, gateKeepTokenId) != 0;
        } else if (nftInfo[i].nftType == 721) {
          try IERC721(nftInfo[i].nft).ownerOf(gateKeepTokenId) returns (address nftOwner) {
            foundNFT = nftOwner == sender;
          } catch {
            // Reverting is fine, the tokenId just might not exist
          }
        }
      }

      require(foundNFT, NoGateKeptNFTFound());
    }
  }

  function _ownerCleared(uint256 clanId) private {
    Clan storage clan = _clans[clanId];
    uint256 oldOwnerPlayerId = clan.ownerPlayerId;
    clan.ownerPlayerId = 0;
    _ownerlessClanTimestamps[clanId] = uint40(block.timestamp);
    emit ClanOwnerLeft(clanId, oldOwnerPlayerId);
  }

  function _updateRank(uint256 clanId, uint256 memberId, ClanRank rank, uint256 playerId) private {
    PlayerInfo storage player = _playerInfo[memberId];
    player.rank = rank;
    emit PlayerRankUpdated(clanId, memberId, rank, playerId);
  }

  function _destroyClan(uint256 clanId) private {
    // Defensive check
    Clan storage clan = _clans[clanId];
    require(clan.memberCount == 0, ClanDestroyFailedHasMembers());
    _lowercaseNames[EstforLibrary.toLower(clan.name)] = false; // Name can be used again
    delete _clans[clanId]; // Delete the clan
    emit ClanDestroyed(clanId);
  }

  function _removeFromClan(uint256 clanId, uint256 playerId, uint256 removingPlayerId) private {
    Clan storage clan = _clans[clanId];

    if (clan.ownerPlayerId == playerId) {
      _ownerCleared(clanId);
    }

    clan.memberCount--;
    if (clan.memberCount == 0) {
      _destroyClan(clanId);
    } else {
      emit MemberLeft(clanId, playerId, removingPlayerId);
    }
    PlayerInfo storage player = _playerInfo[playerId];
    player.clanId = 0;
    player.rank = ClanRank.NONE;

    _territories.clanMemberLeft(clanId, playerId);
    _lockedBankVaults.clanMemberLeft(clanId, playerId);
    _raids.clanMemberLeft(clanId, playerId);
    _combatantsHelper.applyPlayerCombatantCooldownPenalty(playerId);
  }

  function _claimOwnership(uint256 clanId, uint256 playerId) private {
    Clan storage clan = _clans[clanId];
    clan.ownerPlayerId = uint64(playerId);
    delete _ownerlessClanTimestamps[clanId];
    _playerInfo[playerId].rank = ClanRank.OWNER;
    emit ClanOwnershipTransferred(clanId, playerId);
  }

  function _pay(uint256 tokenCost) private {
    IBrushToken brush = _brush;
    address sender = _msgSender();
    brush.burnFrom(sender, (tokenCost * _brushBurntPercentage) / 100);
    brush.transferFrom(sender, _treasury, (tokenCost * _brushTreasuryPercentage) / 100);
    brush.transferFrom(sender, _dev, (tokenCost * _brushDevPercentage) / 100);
  }

  function _upgradeClan(uint256 clanId, uint256 playerId, uint8 newTierId) private {
    Tier storage oldTier = _tiers[_clans[clanId].tierId];
    require(oldTier.id != 0, ClanDoesNotExist());
    require(newTierId > oldTier.id, CannotDowngradeTier());

    // require(_playerInfo[playerId].clanId == clanId, NotMemberOfClan());

    _checkTierExists(newTierId);

    Tier storage newTier = _tiers[newTierId];
    uint256 priceDifference = newTier.price - oldTier.price;
    _pay(priceDifference);

    _clans[clanId].tierId = newTierId; // Increase the tier
    emit ClanUpgraded(clanId, playerId, newTierId);
  }

  function _setTier(Tier calldata tier) private {
    uint256 tierId = tier.id;
    // TODO: Some other checks

    // Price should be higher than the one prior
    if (tierId > 1) {
      Tier memory priorTier = _tiers[tierId - 1];
      require(tier.price >= priorTier.price, PriceTooLow());
      require(tier.maxMemberCapacity >= priorTier.maxMemberCapacity, MemberCapacityTooLow());
      require(tier.maxBankCapacity >= priorTier.maxBankCapacity, BankCapacityTooLow());
      require(tier.maxImageId >= priorTier.maxImageId, ImageIdTooLow());
    }
    _tiers[tierId] = tier;
  }

  function _checkTierExists(uint256 tierId) private view {
    Tier storage tier = _tiers[tierId];
    require(tier.id != 0, TierDoesNotExist());
  }

  function _inviteMember(uint256 clanId, uint256 member) private {
    Clan storage clan = _clans[clanId];
    require(!clan.inviteRequests[member], AlreadySentInvite());

    clan.inviteRequests[member] = true;
  }

  function _requestToJoin(uint256 clanId, uint256 playerId, uint256 gateKeepTokenId) private {
    Clan storage clan = _clans[clanId];
    require(clan.createdTimestamp != 0, ClanDoesNotExist());
    require(!clan.disableJoinRequests, JoinRequestsDisabled());

    _checkGateKeeping(clanId, gateKeepTokenId);

    PlayerInfo storage player = _playerInfo[playerId];

    require(!isMemberOfAnyClan(playerId), AlreadyInClan());

    uint256 playerRequestedClanId = player.requestedClanId;
    if (playerRequestedClanId != 0) {
      require(playerRequestedClanId != clanId, AlreadySentJoinRequest());
      emit JoinRequestRemoved(playerRequestedClanId, playerId);
    }

    player.requestedClanId = uint32(clanId);

    emit JoinRequestSent(clanId, playerId);
  }

  function _acceptJoinRequest(uint256 clanId, uint256 newMemberPlayerId) private {
    Clan storage clan = _clans[clanId];
    clan.inviteRequests[newMemberPlayerId] = false;
    clan.memberCount++;

    PlayerInfo storage player = _playerInfo[newMemberPlayerId];
    require(player.requestedClanId == clanId, NoJoinRequest());
    player.clanId = uint32(clanId);
    player.requestedClanId = 0;
    player.rank = ClanRank.COMMONER;
  }

  function getClanIdFromPlayer(uint256 playerId) external view override returns (uint256) {
    return _playerInfo[playerId].clanId;
  }

  function getClanNameOfPlayer(uint256 playerId) external view override returns (string memory) {
    uint256 clanId = _playerInfo[playerId].clanId;
    return _clans[clanId].name;
  }

  function canWithdraw(uint256 clanId, uint256 playerId) external view override returns (bool) {
    return _playerInfo[playerId].clanId == clanId && _playerInfo[playerId].rank >= ClanRank.TREASURER;
  }

  function isClanMember(uint256 clanId, uint256 playerId) external view override returns (bool) {
    return _playerInfo[playerId].clanId == clanId;
  }

  function isMemberOfAnyClan(uint256 playerId) public view override returns (bool) {
    return _playerInfo[playerId].clanId != 0;
  }

  function getClanTierMembership(uint256 playerId) external view override returns (uint8) {
    return _clans[_playerInfo[playerId].clanId].tierId;
  }

  function getClanId(uint256 playerId) external view override returns (uint256) {
    return _playerInfo[playerId].clanId;
  }

  function getMMR(uint256 clanId) external view override returns (uint16 mmr) {
    mmr = _clans[clanId].mmr;
  }

  function hasInviteRequest(uint256 clanId, uint256 playerId) external view override returns (bool) {
    return _clans[clanId].inviteRequests[playerId];
  }

  function maxBankCapacity(uint256 clanId) external view override returns (uint16) {
    Tier storage tier = _tiers[_clans[clanId].tierId];
    return tier.maxBankCapacity;
  }

  function maxMemberCapacity(uint256 clanId) external view override returns (uint16) {
    Tier storage tier = _tiers[_clans[clanId].tierId];
    return tier.maxMemberCapacity;
  }

  function getRank(uint256 clanId, uint256 playerId) external view override returns (ClanRank rank) {
    if (_playerInfo[playerId].clanId == clanId) {
      return _playerInfo[playerId].rank;
    }
    return ClanRank.NONE;
  }

  function getEditNameCost() external view override returns (uint80) {
    return _editNameCost;
  }

  function getPlayerInfo(uint256 playerId) external view override returns (PlayerInfo memory) {
    return _playerInfo[playerId];
  }

  function getLowercaseNames(string calldata name) external view override returns (bool) {
    return _lowercaseNames[name];
  }

  function getTier(uint256 tierId) external view override returns (Tier memory) {
    return _tiers[tierId];
  }

  function getTierIds() external view returns (uint8[] memory tierIds) {
    tierIds = new uint8[](type(uint8).max);
    uint256 length;
    for (uint256 tierId = 1; tierId <= type(uint8).max; ++tierId) {
      if (_tiers[tierId].id != 0) tierIds[length++] = uint8(tierId);
    }

    assembly ("memory-safe") {
      mstore(tierIds, length)
    }
  }

  function getClan(
    uint256 clanId
  )
    external
    view
    override
    returns (
      uint64 ownerPlayerId,
      uint16 imageId,
      uint16 memberCount,
      uint40 createdTimestamp,
      uint8 tierId,
      bool disableJoinRequests,
      uint16 mmr,
      string memory name,
      NFTInfo[] memory gateKeptNFTs
    )
  {
    Clan storage clan = _clans[clanId];
    return (
      clan.ownerPlayerId,
      clan.imageId,
      clan.memberCount,
      clan.createdTimestamp,
      clan.tierId,
      clan.disableJoinRequests,
      clan.mmr,
      clan.name,
      clan.gateKeptNFTs
    );
  }

  /// @dev used by Territories to get Clan Bank for Activity Points
  function getClanBankAddress(uint256 clanId) external view override returns (address bankAddress) {
    return _bankFactory.getBankAddress(clanId);
  }

  function addTiers(Tier[] calldata tiers) external override onlyOwner {
    for (uint256 i; i < tiers.length; ++i) {
      require(tiers[i].id != 0 && _tiers[tiers[i].id].id == 0, TierAlreadyExists());
      _setTier(tiers[i]);
    }
    emit AddTiers(tiers);
  }

  function editTiers(Tier[] calldata tiers) external override onlyOwner {
    for (uint256 i; i < tiers.length; ++i) {
      _checkTierExists(tiers[i].id);
      _setTier(tiers[i]);
    }
    emit EditTiers(tiers);
  }

  function initializeAddresses(
    IPlayers players,
    IBankFactory bankFactory,
    IClanMemberLeftCB territories,
    IClanMemberLeftCB lockedBankVaults,
    IClanMemberLeftCB raids
  ) external override onlyOwner {
    require(address(_bankFactory) == address(0) || _bankFactory == bankFactory, BankFactoryAlreadySet());

    _players = players;
    _bankFactory = bankFactory;
    _territories = territories;
    _lockedBankVaults = lockedBankVaults;
    _raids = raids;
  }

  function setXPModifiers(address[] calldata accounts, bool isModifier) external override onlyOwner {
    for (uint256 i; i < accounts.length; ++i) {
      _xpModifiers[accounts[i]] = isModifier;
    }
  }

  function setEditNameCost(uint80 editNameCost) public override onlyOwner {
    _editNameCost = editNameCost;
    emit EditNameCost(editNameCost);
  }

  function setInitialMMR(uint16 mmr) public override onlyOwner {
    _initialMMR = mmr;
    emit SetInitialMMR(mmr);
  }

  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external override onlyOwner {
    require(brushBurntPercentage + brushTreasuryPercentage + brushDevPercentage == 100, PercentNotTotal100());

    _brushBurntPercentage = brushBurntPercentage;
    _brushTreasuryPercentage = brushTreasuryPercentage;
    _brushDevPercentage = brushDevPercentage;
    emit SetBrushDistributionPercentages(brushBurntPercentage, brushTreasuryPercentage, brushDevPercentage);
  }

  function setDevAddress(address dev) external override onlyOwner {
    _dev = dev;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
