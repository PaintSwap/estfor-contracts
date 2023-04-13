// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IClans, Clan} from "../interfaces/IClans.sol";
import {IBankFactory} from "../interfaces/IBankFactory.sol";

contract Clans is UUPSUpgradeable, OwnableUpgradeable, IClans {
  event ClanCreated(uint clanId, uint playerId, string name, uint imageId, uint tierId);
  event AdminAdded(uint clanId, uint playerId);
  event AdminRemoved(uint clanId, uint playerId);
  event InviteSent(uint clanId, uint playerId, uint fromPlayerId);
  event InviteAccepted(uint clanId, uint playerId);
  event MemberLeft(uint clanId, uint playerId);
  event JoinRequestSent(uint clanId, uint playerId);
  event JoinRequestAccepted(uint clanId, uint playerId, uint acceptedByPlayerId);
  event JoinRequestRemoved(uint clanId, uint playerId);
  event ClanOwnershipTransferred(uint clanId, uint playerId);
  event AddTiers(Tier[] tiers);
  event EditTier(Tier tier);
  event ClanOwnerLeft(uint clanId, uint playerId);
  event ClanEdited(uint clanId, uint playerId, string name, uint imageId);
  event ClanUpgraded(uint clanId, uint playerId, uint tierId);
  event ClanDestroyed(uint clanId);

  error OnlyOwner();
  error OnlyAdmin();
  error AlreadyInClan();
  error UserAlreadyAdmin();
  error NotOwnerOfPlayer();
  error NotOwnerOfPlayerAndActive();
  error NotMemberOfClan();
  error NotAdmin();
  error ClanIsFull();
  error NoInviteRequest();
  error NotInClan();
  error OwnerExists();
  error InvalidTier();
  error PlayerAlreadyAdmin();
  error CannotBeCalledOnOwner();
  error CannotBeCalledOnSelf();
  error InvalidImageId();
  error InvalidName();
  error ClanDoesNotExist();
  error TierDoesNotExist();
  error CannotDowngradeTier();
  error TierAlreadyExists();
  error NameAlreadyExists();
  error OnlyOwnerCanKickAdmin();
  error OnlyOwnerOrSelf();
  error OnlyAdminsOrOwnerCanKickMember();
  error ClanDestroyFailedHasMembers();
  error PriceTooLow();
  error MemberCapacityTooLow();
  error BankCapacityTooLow();
  error ImageIdTooLow();
  error AlreadySentInvite();
  error AlreadySentJoinRequest();

  struct PlayerInfo {
    uint32 clanId; // What clan they are in
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

  modifier isOwnerOfPlayer(uint _playerId) {
    if (!players.isOwnerOfPlayer(msg.sender, _playerId)) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier onlyClanAdmin(uint _clanId, uint _playerId) {
    if (!clans[_clanId].admins[_playerId]) {
      revert OnlyAdmin();
    }
    _;
  }

  modifier isMemberOfClan(uint _clanId, uint _playerId) {
    if (!clans[_clanId].members[_playerId]) {
      revert NotMemberOfClan();
    }
    _;
  }

  IBrushToken private brushToken;
  IPlayers private players;
  IBankFactory public bankFactory;
  address private pool;
  uint public nextClanId;
  mapping(uint clanId => Clan clan) public clans;
  mapping(uint playerId => PlayerInfo) public playerInfo;
  mapping(uint id => Tier tier) public tiers;
  mapping(string name => bool exists) public lowercaseNames;
  mapping(uint clanId => uint40 timestampLeft) public ownerlessClanTimestamps; // timestamp

  // TODO Permissions

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IBrushToken _brushToken, address _pool) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    brushToken = _brushToken;
    pool = _pool;
    nextClanId = 1;
  }

  function createClan(
    uint _playerId,
    string calldata _name,
    uint24 _imageId,
    uint8 _tierId
  ) external isOwnerOfPlayerAndActive(_playerId) {
    PlayerInfo storage player = playerInfo[_playerId];
    if (player.clanId != 0) {
      revert AlreadyInClan();
    }

    Tier storage tier = tiers[_tierId];
    if (tier.id != _tierId) {
      revert InvalidTier();
    }

    _checkClanSettings(_imageId, tier.maxImageId);

    uint clanId = nextClanId++;
    Clan storage clan = clans[clanId];
    clan.owner = uint80(_playerId);
    clan.tierId = _tierId;
    clan.imageId = _imageId;
    clan.members[_playerId] = true;
    clan.memberCount = 1;
    clan.admins[_playerId] = true;
    clan.adminCount = 1;
    clan.createdTimestamp = uint40(block.timestamp);

    player.clanId = uint32(clanId);
    if (player.requestedClanId != 0) {
      removeJoinRequest(clanId, _playerId);
    }

    _setName(clanId, _name);
    emit ClanCreated(clanId, _playerId, _name, _imageId, _tierId);
    if (_tierId != 1) {
      _upgradeClan(clanId, _playerId, _tierId);
    }

    bankFactory.createBank(msg.sender, clanId);
  }

  function editClan(uint _clanId, string calldata _name, uint _imageId) external isOwnerOfPlayer(clans[_clanId].owner) {
    Clan storage clan = clans[_clanId];
    Tier storage tier = tiers[clan.tierId];
    _checkClanSettings(_imageId, tier.maxImageId);
    _setName(_clanId, _name);
    emit ClanEdited(_clanId, clans[_clanId].owner, _name, _imageId);
  }

  function editClanAsAdmin(
    uint _clanId,
    uint _playerId,
    uint _imageId
  ) external isOwnerOfPlayer(_playerId) onlyClanAdmin(_clanId, _playerId) {
    Clan storage clan = clans[_clanId];
    Tier storage tier = tiers[clan.tierId];
    _checkClanSettings(_imageId, tier.maxImageId);
    emit ClanEdited(_clanId, _playerId, clan.name, _imageId);
  }

  function addAdmin(uint _clanId, uint _admin) public isOwnerOfPlayer(clans[_clanId].owner) {
    Clan storage clan = clans[_clanId];

    if (!clan.members[_admin]) {
      revert NotMemberOfClan();
    }

    if (clan.admins[_admin]) {
      revert PlayerAlreadyAdmin();
    }
    _addAdmin(_clanId, _admin);
  }

  function removeAdmin(uint _clanId, uint _admin) external {
    if (!players.isOwnerOfPlayer(msg.sender, clans[_clanId].owner) && !players.isOwnerOfPlayer(msg.sender, _admin)) {
      revert OnlyOwnerOrSelf();
    }

    _removeAdmin(_clanId, _admin);
  }

  function inviteMember(
    uint _clanId,
    uint _member,
    uint _playerId
  ) external isOwnerOfPlayer(_playerId) onlyClanAdmin(_clanId, _playerId) {
    Clan storage clan = clans[_clanId];

    Tier storage tier = tiers[clan.tierId];

    if (clan.memberCount >= tier.maxMemberCapacity) {
      revert ClanIsFull();
    }

    if (clan.inviteRequests[_member]) {
      revert AlreadySentInvite();
    }

    clan.inviteRequests[_member] = true;
    emit InviteSent(_clanId, _member, _playerId);
  }

  function acceptInvite(uint _clanId, uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    Clan storage clan = clans[_clanId];
    PlayerInfo storage player = playerInfo[_playerId];

    if (!clan.inviteRequests[_playerId]) {
      revert NoInviteRequest();
    }

    clan.inviteRequests[_playerId] = false;
    ++clan.memberCount;
    clan.members[_playerId] = true;

    player.clanId = uint32(_clanId);
    player.requestedClanId = 0;

    emit InviteAccepted(_clanId, _playerId);
  }

  function leaveClan(uint _clanId, uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    _removeFromClan(_clanId, _playerId);
  }

  function requestToJoin(uint _clanId, uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    Clan storage clan = clans[_clanId];
    if (clan.createdTimestamp == 0) {
      revert ClanDoesNotExist();
    }

    PlayerInfo storage player = playerInfo[_playerId];

    if (player.clanId != 0) {
      revert AlreadyInClan();
    }

    if (player.requestedClanId != 0) {
      if (player.requestedClanId == _clanId) {
        revert AlreadySentJoinRequest();
      }
      emit JoinRequestRemoved(player.requestedClanId, _playerId);
    }

    player.requestedClanId = uint32(_clanId);

    emit JoinRequestSent(_clanId, _playerId);
  }

  function removeJoinRequest(uint _clanId, uint _playerId) public isOwnerOfPlayer(_playerId) {
    playerInfo[_playerId].requestedClanId = 0;
    emit JoinRequestRemoved(_clanId, _playerId);
  }

  function acceptJoinRequest(
    uint _clanId,
    uint _member,
    uint _playerId
  ) public isOwnerOfPlayerAndActive(_playerId) onlyClanAdmin(_clanId, _playerId) {
    Clan storage clan = clans[_clanId];
    PlayerInfo storage player = playerInfo[_member];

    if (clan.inviteRequests[_member]) {
      revert NoInviteRequest();
    }

    clan.inviteRequests[_member] = false;
    clan.memberCount++;
    clan.members[_member] = true;

    player.clanId = uint32(_clanId);
    player.requestedClanId = 0;

    emit JoinRequestAccepted(_clanId, _member, _playerId);
  }

  function kickMember(uint _clanId, uint _member, uint playerId) external isOwnerOfPlayerAndActive(playerId) {
    // Only owner can kick an admin
    if (clans[_clanId].admins[_member] && clans[_clanId].owner != playerId) {
      revert OnlyOwnerCanKickAdmin();
    }
    if (clans[_clanId].owner == _member) {
      revert CannotBeCalledOnOwner();
    }

    // Only admins or owner can kick a member
    if (!clans[_clanId].admins[playerId] && clans[_clanId].owner != playerId) {
      revert OnlyAdminsOrOwnerCanKickMember();
    }
    _removeFromClan(_clanId, _member);
  }

  function renonuceOwnershipTo(
    uint _clanId,
    uint _admin,
    bool _leaveClan
  ) external isOwnerOfPlayer(clans[_clanId].owner) onlyClanAdmin(_clanId, _admin) {
    Clan storage clan = clans[_clanId];
    uint oldOwnerPlayerId = clan.owner;
    _removeFromClan(_clanId, clan.owner);
    if (!_leaveClan) {
      // Add as a member
      ++clan.memberCount;
      clan.members[oldOwnerPlayerId] = true;
      playerInfo[oldOwnerPlayerId].clanId = uint32(_clanId);
      // Add as an admin
      _addAdmin(_clanId, _admin);
    }
    _claimOwnership(_clanId, _admin);
  }

  // Can claim a clan if there is no owner. Must be an admin if there are any admins, otherwise can be any member.
  function claimOwnership(
    uint _clanId,
    uint _playerId
  ) external isOwnerOfPlayer(_playerId) isMemberOfClan(_clanId, _playerId) {
    Clan storage clan = clans[_clanId];
    if (clan.owner != 0) {
      revert OwnerExists();
    }

    if (clan.adminCount != 0) {
      // Must be an admin
      if (!clan.admins[_playerId]) {
        revert NotAdmin();
      }
    }

    _claimOwnership(_clanId, _playerId);
  }

  function upgradeClan(uint _clanId, uint _playerId, uint8 _newTierId) public isOwnerOfPlayer(_playerId) {
    _upgradeClan(_clanId, _playerId, _newTierId);
  }

  function getClanName(uint _playerId) external view returns (string memory) {
    uint clanId = playerInfo[_playerId].clanId;
    return clans[clanId].name;
  }

  function isClanAdmin(uint _clanId, uint _playerId) external view override returns (bool) {
    return clans[_clanId].admins[_playerId];
  }

  function isClanMember(uint _clanId, uint _playerId) external view returns (bool) {
    return clans[_clanId].members[_playerId];
  }

  function hasInviteRequest(uint _clanId, uint _playerId) external view returns (bool) {
    return clans[_clanId].inviteRequests[_playerId];
  }

  function maxBankCapacity(uint _clanId) external view override returns (uint16) {
    Tier storage tier = tiers[clans[_clanId].tierId];
    return tier.maxBankCapacity;
  }

  function maxMemberCapacity(uint _clanId) external view override returns (uint16) {
    Tier storage tier = tiers[clans[_clanId].tierId];
    return tier.maxMemberCapacity;
  }

  function _removeAdmin(uint _clanId, uint _admin) private {
    Clan storage clan = clans[_clanId];
    // Check they are an admin first
    if (!clan.admins[_admin]) {
      revert NotAdmin();
    }

    // Make sure the owner isn't trying to remove themselves
    if (_admin == clan.owner) {
      revert CannotBeCalledOnOwner();
    }

    clan.admins[_admin] = false;
    --clan.adminCount;
    emit AdminRemoved(_clanId, _admin);
  }

  function _checkClanSettings(uint _imageId, uint _maxImageId) private pure {
    if (_imageId == 0 || _imageId > _maxImageId) {
      revert InvalidImageId();
    }
  }

  function _setName(uint _clanId, string calldata _name) private {
    if (bytes(_name).length == 0 || bytes(_name).length > 20) {
      revert InvalidName();
    }

    string memory lowercaseName = _toLower(_name);
    if (lowercaseNames[lowercaseName]) {
      revert NameAlreadyExists();
    }
    lowercaseNames[lowercaseName] = true;
    string storage oldName = clans[_clanId].name;
    if (bytes(oldName).length > 0) {
      delete lowercaseNames[oldName];
    }
    clans[_clanId].name = _name;
  }

  function _addAdmin(uint _clanId, uint _admin) private {
    Clan storage clan = clans[_clanId];
    clan.admins[_admin] = true;
    ++clan.adminCount;
    emit AdminAdded(_clanId, _admin);
  }

  function _destroyClan(uint _clanId) private {
    if (clans[_clanId].memberCount != 0) {
      // Defensive check
      revert ClanDestroyFailedHasMembers();
    }
    lowercaseNames[_toLower(clans[_clanId].name)] = false; // Name can be used again
    delete clans[_clanId]; // Delete the clan
    emit ClanDestroyed(_clanId);
  }

  function _removeFromClan(uint _clanId, uint _playerId) private {
    Clan storage clan = clans[_clanId];
    PlayerInfo storage player = playerInfo[_playerId];

    if (player.clanId != _clanId) {
      revert NotInClan();
    }

    if (clan.owner == _playerId) {
      clan.owner = 0;
      ownerlessClanTimestamps[_clanId] = uint40(block.timestamp);
      emit ClanOwnerLeft(_clanId, _playerId);
    }
    if (clans[_clanId].admins[_playerId]) {
      _removeAdmin(_clanId, _playerId);
    }

    --clan.memberCount;
    if (clan.memberCount == 0) {
      _destroyClan(_clanId);
    } else {
      clan.members[_playerId] = false;
      emit MemberLeft(_clanId, _playerId);
    }
    player.clanId = 0;
  }

  function _claimOwnership(uint _clanId, uint _playerId) private {
    Clan storage clan = clans[_clanId];
    clan.owner = uint80(_playerId);
    delete ownerlessClanTimestamps[_clanId];

    if (!clan.admins[_playerId]) {
      _addAdmin(_clanId, _playerId);
    }
    emit ClanOwnershipTransferred(_clanId, _playerId);
  }

  function _upgradeClan(uint _clanId, uint _playerId, uint8 _newTierId) private {
    Tier storage oldTier = tiers[clans[_clanId].tierId];
    if (oldTier.id == 0) {
      revert ClanDoesNotExist();
    }

    if (_newTierId <= oldTier.id) {
      revert CannotDowngradeTier();
    }

    Tier storage newTier = tiers[_newTierId];
    if (newTier.id == 0) {
      revert TierDoesNotExist();
    }

    uint priceDifference = newTier.price - oldTier.price;
    uint half = priceDifference / 2;
    brushToken.transferFrom(msg.sender, address(this), priceDifference);
    brushToken.burn(half);
    brushToken.transfer(pool, priceDifference - half);
    clans[_clanId].tierId = _newTierId; // Increase the tier
    emit ClanUpgraded(_clanId, _playerId, _newTierId);
  }

  function _toLower(string memory _name) private pure returns (string memory) {
    bytes memory lowercaseName = abi.encodePacked(_name);
    for (uint i; i < lowercaseName.length; ++i) {
      if ((uint8(lowercaseName[i]) >= 65) && (uint8(lowercaseName[i]) <= 90)) {
        // So we add 32 to make it lowercase
        lowercaseName[i] = bytes1(uint8(lowercaseName[i]) + 32);
      }
    }
    return string(lowercaseName);
  }

  function _setTier(Tier calldata _tier) private {
    uint tierId = _tier.id;
    // TODO: Some other checks

    // Price should be higher than the one prior
    if (tierId > 1) {
      if (_tier.price < tiers[tierId - 1].price) {
        revert PriceTooLow();
      }
      if (_tier.maxMemberCapacity < tiers[tierId - 1].maxMemberCapacity) {
        revert MemberCapacityTooLow();
      }
      if (_tier.maxBankCapacity < tiers[tierId - 1].maxBankCapacity) {
        revert BankCapacityTooLow();
      }
      if (_tier.maxImageId < tiers[tierId - 1].maxImageId) {
        revert ImageIdTooLow();
      }
    }
    tiers[tierId] = _tier;
  }

  function addTiers(Tier[] calldata _tiers) external onlyOwner {
    for (uint i = 0; i < _tiers.length; ++i) {
      if (tiers[_tiers[i].id].id != 0 || _tiers[i].id == 0) {
        revert TierAlreadyExists();
      }
      _setTier(_tiers[i]);
    }
    emit AddTiers(_tiers);
  }

  function editTier(Tier calldata _tier) external onlyOwner {
    uint tierId = _tier.id;
    if (tiers[tierId].id == 0) {
      revert TierDoesNotExist();
    }
    _setTier(_tier);
    emit EditTier(_tier);
  }

  function setBankFactory(IBankFactory _bankFactory) external onlyOwner {
    bankFactory = _bankFactory;
  }

  function setPlayers(IPlayers _players) external onlyOwner {
    players = _players;
  }

  function _authorizeUpgrade(address) internal override onlyOwner {}
}
