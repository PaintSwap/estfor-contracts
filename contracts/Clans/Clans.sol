// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IClans} from "../interfaces/IClans.sol";
import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IMarketplaceWhitelist} from "../interfaces/IMarketplaceWhitelist.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";
import {EstforLibrary} from "../EstforLibrary.sol";

import {ClanRank} from "../globals/clans.sol";

contract Clans is UUPSUpgradeable, OwnableUpgradeable, IClans {
  event ClanCreated(uint256 clanId, uint256 playerId, string[] clanInfo, uint256 imageId, uint256 tierId);
  event SetClanRank(uint256 clanId, uint256 playerId, ClanRank clan);
  event InviteSent(uint256 clanId, uint256 playerId, uint256 fromPlayerId);
  event InvitesSent(uint256 clanId, uint256[] playerIds, uint256 fromPlayerId);
  event InviteAccepted(uint256 clanId, uint256 playerId);
  event MemberLeft(uint256 clanId, uint256 playerId, uint256 removedByPlayerId);
  event JoinRequestSent(uint256 clanId, uint256 playerId);
  event JoinRequestAccepted(uint256 clanId, uint256 playerId, uint256 acceptedByPlayerId);
  event JoinRequestsAccepted(uint256 clanId, uint256[] playerIds, uint256 acceptedByPlayerId);
  event JoinRequestRemoved(uint256 clanId, uint256 playerId);
  event ClanOwnershipTransferred(uint256 clanId, uint256 playerId);
  event AddTiers(Tier[] tiers);
  event EditTiers(Tier[] tiers);
  event ClanOwnerLeft(uint256 clanId, uint256 playerId);
  event ClanEdited(uint256 clanId, uint256 playerId, string[] clanInfo, uint256 imageId);
  event ClanUpgraded(uint256 clanId, uint256 playerId, uint256 tierId);
  event ClanDestroyed(uint256 clanId);
  event PlayerRankUpdated(uint256 clanId, uint256 memberId, ClanRank rank, uint256 playerId);
  event InvitesDeletedByPlayer(uint256[] clanIds, uint256 playerId);
  event InvitesDeletedByClan(uint256 clanId, uint256[] invitedPlayerIds, uint256 deletedInvitesPlayerId);
  event JoinRequestsRemovedByClan(uint256 clanId, uint256[] joinRequestPlayerIds, uint256 removingJoinRequestsPlayerId);
  event EditNameCost(uint256 newCost);
  event JoinRequestsEnabled(uint256 clanId, bool joinRequestsEnabled, uint256 playerId);
  event GateKeepNFTs(uint256 clanId, address[] nfts, uint256 playerId);
  event PinMessage(uint256 clanId, string message, uint256 playerId);
  event SetInitialMMR(uint256 mmr);

  error AlreadyInClan();
  error NotOwnerOfPlayer();
  error NotOwnerOfPlayerAndActive();
  error NotMemberOfClan();
  error ClanIsFull();
  error OwnerExists();
  error InvalidImageId();
  error NameTooShort();
  error NameTooLong();
  error NameInvalidCharacters();
  error DiscordTooLong();
  error DiscordTooShort();
  error DiscordInvalidCharacters();
  error TelegramTooLong();
  error TelegramInvalidCharacters();
  error TwitterTooLong();
  error TwitterInvalidCharacters();
  error ClanDoesNotExist();
  error TierDoesNotExist();
  error CannotDowngradeTier();
  error TierAlreadyExists();
  error NameAlreadyExists();
  error ClanDestroyFailedHasMembers();
  error PriceTooLow();
  error MemberCapacityTooLow();
  error BankCapacityTooLow();
  error ImageIdTooLow();
  error AlreadySentInvite();
  error AlreadySentJoinRequest();
  error NoJoinRequest();
  error RankMustBeLowerRenounce();
  error RankNotHighEnough();
  error CannotSetSameRank();
  error ChangingRankEqualOrHigherThanSelf();
  error ChangingRankOfPlayerHigherThanSelf();
  error ChangingRankOfPlayerEqualOrHigherThanSelf();
  error CannotRenounceToSelf();
  error InviteDoesNotExist();
  error NoInvitesToDelete();
  error NoJoinRequestsToDelete();
  error JoinRequestsDisabled();
  error TooManyNFTs();
  error InvalidNFTType();
  error NoGateKeptNFTFound();
  error NFTNotWhitelistedOnMarketplace();
  error UnsupportedNFTType();
  error MessageTooLong();
  error NotMMRSetter();

  struct Clan {
    uint80 owner;
    uint16 imageId;
    uint16 memberCount;
    uint40 createdTimestamp;
    uint8 tierId;
    bool disableJoinRequests;
    uint16 mmr;
    string name;
    mapping(uint256 playerId => bool invited) inviteRequests;
    NFTInfo[] gateKeptNFTs;
  }

  struct PlayerInfo {
    uint32 clanId; // What clan they are in
    ClanRank rank; // Current clan rank
    uint32 requestedClanId; // What clan they have requested to join
  }

  struct Tier {
    uint8 id;
    uint16 maxMemberCapacity;
    uint16 maxBankCapacity;
    uint24 maxImageId;
    uint40 minimumAge; // How old the clan must be before it can be upgraded to this tier
    uint80 price;
  }

  struct NFTInfo {
    address nft;
    uint80 nftType; // e.g erc721 or erc1155
  }

  IBrushToken private _brush;
  IPlayers private _players;
  IBankFactory private _bankFactory;
  IERC1155 private _playerNFT;
  uint80 private _nextClanId;
  uint16 private _initialMMR;
  address private _pool;
  uint80 private _editNameCost;
  address private _dev;
  mapping(uint256 clanId => Clan clan) private _clans;
  mapping(uint256 playerId => PlayerInfo) private _playerInfo;
  mapping(uint256 id => Tier tier) private _tiers;
  mapping(string name => bool exists) private _lowercaseNames;
  mapping(uint256 clanId => uint40 timestampLeft) private _ownerlessClanTimestamps; // timestamp
  address private _paintswapMarketplaceWhitelist;
  IClanMemberLeftCB private _territories;
  IClanMemberLeftCB private _lockedBankVaults;

  modifier isOwnerOfPlayer(uint256 playerId) {
    require(_playerNFT.balanceOf(_msgSender(), playerId) != 0, NotOwnerOfPlayer());
    _;
  }

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  modifier isMinimumRank(uint256 clanId, uint256 playerId, ClanRank _rank) {
    PlayerInfo storage player = _playerInfo[playerId];
    require(player.clanId == clanId, NotMemberOfClan());
    require(_playerInfo[playerId].rank >= _rank, RankNotHighEnough());
    _;
  }

  modifier isMemberOfClan(uint256 clanId, uint256 playerId) {
    require(_playerInfo[playerId].clanId == clanId, NotMemberOfClan());
    _;
  }

  modifier onlyMMRSetter() {
    require(_msgSender() == address(_lockedBankVaults), NotMMRSetter());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken brush,
    IERC1155 playerNFT,
    address pool,
    address dev,
    uint80 editNameCost,
    address paintswapMarketplaceWhitelist,
    uint16 initialMMR
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    _brush = brush;
    _playerNFT = playerNFT;
    _pool = pool;
    _dev = dev;
    _nextClanId = 1;
    _editNameCost = editNameCost;
    _paintswapMarketplaceWhitelist = paintswapMarketplaceWhitelist;
    emit EditNameCost(editNameCost);
    setInitialMMR(initialMMR);
  }

  function createClan(
    uint256 playerId,
    string calldata name,
    string calldata discord,
    string calldata telegram,
    string calldata twitter,
    uint16 imageId,
    uint8 tierId
  ) external isOwnerOfPlayerAndActive(playerId) {
    PlayerInfo storage player = _playerInfo[playerId];
    require(!isMemberOfAnyClan(playerId), AlreadyInClan());

    Tier storage tier = _tiers[tierId];
    _checkTierExists(tierId);
    _checkClanImage(imageId, tier.maxImageId);

    uint256 clanId = _nextClanId;
    _nextClanId++;
    Clan storage clan = _clans[clanId];
    clan.owner = uint80(playerId);
    clan.tierId = tierId;
    clan.imageId = imageId;
    clan.memberCount = 1;
    clan.createdTimestamp = uint40(block.timestamp);
    clan.mmr = _initialMMR;

    player.clanId = uint32(clanId);
    player.rank = ClanRank.OWNER;
    if (player.requestedClanId != 0) {
      removeJoinRequest(player.requestedClanId, playerId);
    }

    (string memory trimmedName, ) = _setName(clanId, name);
    _checkSocials(discord, telegram, twitter);
    string[] memory clanInfo = _createClanInfo(trimmedName, discord, telegram, twitter);
    emit ClanCreated(clanId, playerId, clanInfo, imageId, tierId);
    _pay(tier.price);

    _bankFactory.createBank(_msgSender(), clanId);
  }

  function editClan(
    uint256 clanId,
    string calldata name,
    string calldata discord,
    string calldata telegram,
    string calldata twitter,
    uint256 imageId,
    uint256 playerId
  ) external isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.LEADER) {
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

  function deleteInvitesAsPlayer(uint256[] calldata clanIds, uint256 playerId) external isOwnerOfPlayer(playerId) {
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
    uint256[] calldata _invitedPlayerIds,
    uint256 playerId
  ) external isOwnerOfPlayer(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    require(_invitedPlayerIds.length != 0, NoInvitesToDelete());

    for (uint256 i = 0; i < _invitedPlayerIds.length; ++i) {
      uint256 invitedPlayerId = _invitedPlayerIds[i];
      require(clan.inviteRequests[invitedPlayerId], InviteDoesNotExist());
      clan.inviteRequests[invitedPlayerId] = false;
    }

    emit InvitesDeletedByClan(clanId, _invitedPlayerIds, playerId);
  }

  function inviteMember(
    uint256 clanId,
    uint256 member,
    uint256 playerId
  ) external isOwnerOfPlayer(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    Tier storage tier = _tiers[clan.tierId];
    require(clan.memberCount < tier.maxMemberCapacity, ClanIsFull());

    _inviteMember(clanId, member);

    emit InviteSent(clanId, member, playerId);
  }

  function inviteMembers(
    uint256 clanId,
    uint256[] calldata _memberPlayerIds,
    uint256 playerId
  ) external isOwnerOfPlayer(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    Tier storage tier = _tiers[clan.tierId];
    require(clan.memberCount + _memberPlayerIds.length <= tier.maxMemberCapacity, ClanIsFull());

    for (uint256 i = 0; i < _memberPlayerIds.length; ++i) {
      _inviteMember(clanId, _memberPlayerIds[i]);
    }
    emit InvitesSent(clanId, _memberPlayerIds, playerId);
  }

  function _acceptInvite(uint256 clanId, uint256 playerId, uint256 gateKeepTokenId) private {
    Clan storage clan = _clans[clanId];
    PlayerInfo storage player = _playerInfo[playerId];

    require(clan.inviteRequests[playerId], InviteDoesNotExist());
    require(!isMemberOfAnyClan(playerId), AlreadyInClan());

    _checkGateKeeping(clanId, gateKeepTokenId);

    Tier storage tier = _tiers[clan.tierId];
    require(clan.memberCount < tier.maxMemberCapacity, ClanIsFull());

    clan.inviteRequests[playerId] = false;
    clan.memberCount++;

    player.clanId = uint32(clanId);
    player.rank = ClanRank.COMMONER;
    player.requestedClanId = 0;

    emit InviteAccepted(clanId, playerId);
  }

  function acceptInvite(
    uint256 clanId,
    uint256 playerId,
    uint256 gateKeepTokenId
  ) external isOwnerOfPlayerAndActive(playerId) {
    _acceptInvite(clanId, playerId, gateKeepTokenId);
  }

  function requestToJoin(
    uint256 clanId,
    uint256 playerId,
    uint256 _gateKeepTokenId
  ) external isOwnerOfPlayerAndActive(playerId) {
    _requestToJoin(clanId, playerId, _gateKeepTokenId);
  }

  function removeJoinRequest(uint256 clanId, uint256 playerId) public isOwnerOfPlayer(playerId) {
    _playerInfo[playerId].requestedClanId = 0;
    emit JoinRequestRemoved(clanId, playerId);
  }

  function removeJoinRequestsAsClan(
    uint256 clanId,
    uint256[] calldata joinRequestPlayerIds,
    uint256 playerId
  ) external isOwnerOfPlayer(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    require(joinRequestPlayerIds.length != 0, NoJoinRequestsToDelete());

    for (uint256 i = 0; i < joinRequestPlayerIds.length; ++i) {
      uint256 joinRequestPlayerId = joinRequestPlayerIds[i];
      PlayerInfo storage player = _playerInfo[joinRequestPlayerId];
      require(player.requestedClanId == clanId, NoJoinRequest());
      player.requestedClanId = 0;
    }

    emit JoinRequestsRemovedByClan(clanId, joinRequestPlayerIds, playerId);
  }

  function acceptJoinRequest(
    uint256 clanId,
    uint256 newMemberPlayedId,
    uint256 playerId
  ) public isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    Tier storage tier = _tiers[clan.tierId];
    require(clan.memberCount < tier.maxMemberCapacity, ClanIsFull());

    _acceptJoinRequest(clanId, newMemberPlayedId);

    emit JoinRequestAccepted(clanId, newMemberPlayedId, playerId);
  }

  function acceptJoinRequests(
    uint256 clanId,
    uint256[] calldata newMemberPlayedIds,
    uint256 playerId
  ) public isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    Tier storage tier = _tiers[clan.tierId];
    require(clan.memberCount + newMemberPlayedIds.length <= tier.maxMemberCapacity, ClanIsFull());

    for (uint256 i = 0; i < newMemberPlayedIds.length; ++i) {
      _acceptJoinRequest(clanId, newMemberPlayedIds[i]);
    }

    emit JoinRequestsAccepted(clanId, newMemberPlayedIds, playerId);
  }

  function changeRank(
    uint256 clanId,
    uint256 memberId,
    ClanRank rank,
    uint256 playerId
  ) public isOwnerOfPlayer(playerId) isMemberOfClan(clanId, memberId) {
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
  ) external isOwnerOfPlayer(playerId) {
    for (uint256 i = 0; i < memberIds.length; ++i) {
      changeRank(clanId, memberIds[i], ranks[i], playerId);
    }
  }

  function renounceOwnershipTo(
    uint256 clanId,
    uint256 newOwner,
    ClanRank newRank
  ) external isOwnerOfPlayer(_clans[clanId].owner) isMemberOfClan(clanId, newOwner) {
    Clan storage clan = _clans[clanId];
    uint256 oldOwnerId = clan.owner;

    require(newOwner != oldOwnerId, CannotRenounceToSelf());

    if (newRank != ClanRank.NONE) {
      require(newRank < ClanRank.OWNER, RankMustBeLowerRenounce());
      // Change old owner to new rank
      _updateRank(clanId, oldOwnerId, newRank, oldOwnerId);
    } else {
      _removeFromClan(clanId, oldOwnerId, oldOwnerId);
    }
    _claimOwnership(clanId, newOwner);
  }

  // Can claim a clan if there is no owner
  function claimOwnership(
    uint256 clanId,
    uint256 playerId
  ) external isOwnerOfPlayer(playerId) isMemberOfClan(clanId, playerId) {
    Clan storage clan = _clans[clanId];
    require(clan.owner == 0, OwnerExists());

    _claimOwnership(clanId, playerId);
  }

  function setJoinRequestsEnabled(
    uint256 clanId,
    bool joinRequestsEnabled,
    uint256 playerId
  ) external isOwnerOfPlayer(playerId) isMinimumRank(clanId, playerId, ClanRank.SCOUT) {
    Clan storage clan = _clans[clanId];
    clan.disableJoinRequests = !joinRequestsEnabled;
    emit JoinRequestsEnabled(clanId, joinRequestsEnabled, playerId);
  }

  function upgradeClan(uint256 clanId, uint256 playerId, uint8 newTierId) public isOwnerOfPlayer(playerId) {
    _upgradeClan(clanId, playerId, newTierId);
  }

  function pinMessage(
    uint256 clanId,
    string calldata _message,
    uint256 playerId
  ) external isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.LEADER) {
    require(bytes(_message).length <= 200, MessageTooLong());
    emit PinMessage(clanId, _message, playerId);
  }

  function setMMR(uint256 clanId, uint16 mmr) external onlyMMRSetter {
    _clans[clanId].mmr = mmr;
  }

  function getClanNameOfPlayer(uint256 playerId) external view returns (string memory) {
    uint256 clanId = _playerInfo[playerId].clanId;
    return _clans[clanId].name;
  }

  function canWithdraw(uint256 clanId, uint256 playerId) external view override returns (bool) {
    return _playerInfo[playerId].clanId == clanId && _playerInfo[playerId].rank >= ClanRank.TREASURER;
  }

  function isClanMember(uint256 clanId, uint256 playerId) external view returns (bool) {
    return _playerInfo[playerId].clanId == clanId;
  }

  function isMemberOfAnyClan(uint256 playerId) public view returns (bool) {
    return _playerInfo[playerId].clanId != 0;
  }

  function getClanTierMembership(uint256 playerId) external view returns (uint8) {
    return _clans[_playerInfo[playerId].clanId].tierId;
  }

  function getClanId(uint256 playerId) external view returns (uint256) {
    return _playerInfo[playerId].clanId;
  }

  function getMMR(uint256 clanId) external view returns (uint16 mmr) {
    mmr = _clans[clanId].mmr;
  }

  function hasInviteRequest(uint256 clanId, uint256 playerId) external view returns (bool) {
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

  function getRank(uint256 clanId, uint256 playerId) external view returns (ClanRank rank) {
    if (_playerInfo[playerId].clanId == clanId) {
      return _playerInfo[playerId].rank;
    }
    return ClanRank.NONE;
  }

  function getEditNameCost() external view returns (uint80) {
    return _editNameCost;
  }

  function getPlayerInfo(uint256 playerId) external view returns (PlayerInfo memory) {
    return _playerInfo[playerId];
  }

  function getLowercaseNames(string calldata name) external view returns (bool) {
    return _lowercaseNames[name];
  }

  function getTier(uint256 tierId) external view returns (Tier memory) {
    return _tiers[tierId];
  }

  function getClan(
    uint256 clanId
  )
    external
    view
    returns (
      uint80 owner,
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
      clan.owner,
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
    string memory oldName = EstforLibrary.toLower(_clans[clanId].name);
    nameChanged = keccak256(abi.encodePacked(oldName)) != keccak256(abi.encodePacked(trimmedAndLowercaseName));
    if (nameChanged) {
      require(!_lowercaseNames[trimmedAndLowercaseName], NameAlreadyExists());
      if (bytes(oldName).length != 0) {
        delete _lowercaseNames[oldName];
      }
      _lowercaseNames[trimmedAndLowercaseName] = true;
      _clans[clanId].name = trimmedName;
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
    bool foundNFT;
    if (nftInfo.length != 0) {
      // Check the player owns one of these NFTs
      for (uint256 i = 0; i < nftInfo.length; ++i) {
        if (nftInfo[i].nftType == 1155) {
          foundNFT = foundNFT || IERC1155(nftInfo[i].nft).balanceOf(_msgSender(), gateKeepTokenId) != 0;
        } else if (nftInfo[i].nftType == 721) {
          foundNFT = foundNFT || IERC721(nftInfo[i].nft).ownerOf(gateKeepTokenId) == _msgSender();
        }
      }

      require(foundNFT, NoGateKeptNFTFound());
    }
  }

  function _ownerCleared(uint256 clanId) private {
    uint256 oldOwnerId = _clans[clanId].owner;
    _clans[clanId].owner = 0;
    _ownerlessClanTimestamps[clanId] = uint40(block.timestamp);
    emit ClanOwnerLeft(clanId, oldOwnerId);
  }

  function _updateRank(uint256 clanId, uint256 memberId, ClanRank rank, uint256 playerId) private {
    PlayerInfo storage player = _playerInfo[memberId];
    player.rank = rank;
    emit PlayerRankUpdated(clanId, memberId, rank, playerId);
  }

  function _destroyClan(uint256 clanId) private {
    // Defensive check
    require(_clans[clanId].memberCount == 0, ClanDestroyFailedHasMembers());
    _lowercaseNames[EstforLibrary.toLower(_clans[clanId].name)] = false; // Name can be used again
    delete _clans[clanId]; // Delete the clan
    emit ClanDestroyed(clanId);
  }

  function _removeFromClan(uint256 clanId, uint256 playerId, uint256 _removingPlayerId) private {
    Clan storage clan = _clans[clanId];

    if (clan.owner == playerId) {
      _ownerCleared(clanId);
    }

    --clan.memberCount;
    if (clan.memberCount == 0) {
      _destroyClan(clanId);
    } else {
      emit MemberLeft(clanId, playerId, _removingPlayerId);
    }
    PlayerInfo storage player = _playerInfo[playerId];
    player.clanId = 0;
    player.rank = ClanRank.NONE;

    _territories.clanMemberLeft(clanId, playerId);
    _lockedBankVaults.clanMemberLeft(clanId, playerId);
  }

  function _claimOwnership(uint256 clanId, uint256 playerId) private {
    Clan storage clan = _clans[clanId];
    clan.owner = uint80(playerId);
    delete _ownerlessClanTimestamps[clanId];
    _playerInfo[playerId].rank = ClanRank.OWNER;
    emit ClanOwnershipTransferred(clanId, playerId);
  }

  function _pay(uint256 brushCost) private {
    // Pay
    _brush.transferFrom(_msgSender(), address(this), brushCost);
    uint256 quarterCost = brushCost / 4;
    // Burn 1 quarter
    _brush.burn(quarterCost);
    // Send half to the pool (currently shop)
    _brush.transfer(_pool, quarterCost * 2);
    // Send 1 quarter to the dev address
    _brush.transfer(_dev, brushCost - quarterCost * 3);
  }

  function _upgradeClan(uint256 clanId, uint256 playerId, uint8 newTierId) private {
    Tier storage oldTier = _tiers[_clans[clanId].tierId];
    require(oldTier.id != 0, ClanDoesNotExist());
    require(newTierId > oldTier.id, CannotDowngradeTier());

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
      require(tier.price >= _tiers[tierId - 1].price, PriceTooLow());
      require(tier.maxMemberCapacity >= _tiers[tierId - 1].maxMemberCapacity, MemberCapacityTooLow());
      require(tier.maxBankCapacity >= _tiers[tierId - 1].maxBankCapacity, BankCapacityTooLow());
      require(tier.maxImageId >= _tiers[tierId - 1].maxImageId, ImageIdTooLow());
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

  function _acceptJoinRequest(uint256 clanId, uint256 newMemberPlayedId) private {
    Clan storage clan = _clans[clanId];
    clan.inviteRequests[newMemberPlayedId] = false;
    clan.memberCount++;

    PlayerInfo storage player = _playerInfo[newMemberPlayedId];
    require(player.requestedClanId == clanId, NoJoinRequest());
    player.clanId = uint32(clanId);
    player.requestedClanId = 0;
    player.rank = ClanRank.COMMONER;
  }

  function addTiers(Tier[] calldata tiers) external onlyOwner {
    uint256 bounds = tiers.length;
    for (uint256 iter; iter < bounds; iter++) {
      require(tiers[iter].id != 0 && _tiers[tiers[iter].id].id == 0, TierAlreadyExists());
      _setTier(tiers[iter]);
    }
    emit AddTiers(tiers);
  }

  function editTiers(Tier[] calldata tiers) external onlyOwner {
    uint256 bounds = tiers.length;
    for (uint256 iter; iter < bounds; iter++) {
      _checkTierExists(tiers[iter].id);
      _setTier(tiers[iter]);
    }
    emit EditTiers(tiers);
  }

  function gateKeep(
    uint256 clanId,
    NFTInfo[] calldata nftInfos,
    uint256 playerId
  ) external isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.LEADER) {
    require(nftInfos.length <= 5, TooManyNFTs());

    address[] memory nfts = new address[](nftInfos.length);
    for (uint256 i; i < nftInfos.length; ++i) {
      // This must be whitelisted by the PaintSwapMarketplace marketplace
      address nft = nftInfos[i].nft;
      require(
        IMarketplaceWhitelist(_paintswapMarketplaceWhitelist).isWhitelisted(nft),
        NFTNotWhitelistedOnMarketplace()
      );
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

  function setBankFactory(IBankFactory bankFactory) external onlyOwner {
    _bankFactory = bankFactory;
  }

  function setPlayers(IPlayers players) external onlyOwner {
    _players = players;
  }

  function setEditNameCost(uint72 editNameCost) external onlyOwner {
    _editNameCost = editNameCost;
    emit EditNameCost(editNameCost);
  }

  function setPaintSwapMarketplaceWhitelist(address paintswapMarketplaceWhitelist) external onlyOwner {
    _paintswapMarketplaceWhitelist = paintswapMarketplaceWhitelist;
  }

  function setTerritoriesAndLockedBankVaults(
    IClanMemberLeftCB territories,
    IClanMemberLeftCB lockedBankVaults
  ) external onlyOwner {
    _territories = territories;
    _lockedBankVaults = lockedBankVaults;
  }

  function setInitialMMR(uint16 mmr) public onlyOwner {
    _initialMMR = mmr;
    emit SetInitialMMR(mmr);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
