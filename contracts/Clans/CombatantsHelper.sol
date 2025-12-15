// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IClans} from "../interfaces/IClans.sol";
import {ICombatantsHelper} from "../interfaces/ICombatantsHelper.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {ICombatants} from "../interfaces/ICombatants.sol";

import {AdminAccess} from "../AdminAccess.sol";

import {ClanRank} from "../globals/clans.sol";

import {EstforLibrary} from "../EstforLibrary.sol";

// This contract allows setting both territory and locked vault combatants in a single transaction
// And more efficiently checking if they are already combatants in either territory or locked vaults
// as the same player cannot be in both
contract CombatantsHelper is UUPSUpgradeable, OwnableUpgradeable, ICombatantsHelper {
  event EditMemberLeftCombatantCooldownTimestampPenalty(uint256 newCooldownTimestampPenalty);

  error NotOwnerOfPlayerAndActive();
  error RankNotHighEnough();
  error PlayerCannotBeInAssignedMoreThanOnce();
  error PlayerAlreadyExistingCombatant();
  error SetCombatantsIncorrectly();
  error NotSettingCombatants();
  error NotAdminAndBeta();
  error PlayerCombatantCooldownTimestamp();
  error PlayerIdsNotSortedOrDuplicates();
  error NotMemberOfClan();
  error PlayerNotUpgraded(uint256 playerId);
  error NotClans();

  struct PlayerInfo {
    uint40 combatantCooldownTimestamp;
  }

  mapping(uint256 playerId => PlayerInfo playerInfos) private _playerInfos;
  AdminAccess private _adminAccess;
  bool private _isBeta;
  IClans private _clans;
  IPlayers private _players;
  ICombatants private _territories;
  uint24 private _combatantChangeCooldown;
  ICombatants private _lockedVaults;
  ICombatants private _raids;
  uint24 internal _playerLeftCombatantCooldownTimestampPenalty;

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  modifier onlyClans() {
    require(msg.sender == address(_clans), NotClans());
    _;
  }

  modifier isMinimumRank(uint256 clanId, uint256 playerId, ClanRank clanRank) {
    require(_clans.getRank(clanId, playerId) >= clanRank, RankNotHighEnough());
    _;
  }

  modifier isAdminAndBeta() {
    require(_adminAccess.isAdmin(_msgSender()) && _isBeta, NotAdminAndBeta());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPlayers players,
    IClans clans,
    ICombatants territories,
    ICombatants lockedVaults,
    ICombatants raids,
    AdminAccess adminAccess,
    bool isBeta
  ) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();

    _players = players;
    _clans = clans;
    _territories = territories;
    _lockedVaults = lockedVaults;
    _raids = raids;

    _adminAccess = AdminAccess(adminAccess);
    _isBeta = isBeta;

    _combatantChangeCooldown = isBeta ? 5 minutes : 3 days;
    _playerLeftCombatantCooldownTimestampPenalty = 0 days;
  }

  function initializeV4() external reinitializer(4) {
    _playerLeftCombatantCooldownTimestampPenalty = 0 days; // needs to be zero for subgraph tracking
  }

  function assignCombatants(
    uint256 clanId,
    bool setTerritoryCombatants,
    uint64[] calldata territoryPlayerIds,
    bool setLockedVaultCombatants,
    uint64[] calldata lockedVaultPlayerIds,
    bool setRaidCombatants,
    uint64[] calldata raidPlayerIds,
    uint256 leaderPlayerId
  ) external isOwnerOfPlayerAndActive(leaderPlayerId) isMinimumRank(clanId, leaderPlayerId, ClanRank.COLONEL) {
    require(setTerritoryCombatants || setLockedVaultCombatants || setRaidCombatants, NotSettingCombatants());

    _checkAndSetAssignCombatants(
      _territories,
      setTerritoryCombatants,
      territoryPlayerIds,
      _lockedVaults,
      setLockedVaultCombatants,
      lockedVaultPlayerIds,
      _raids,
      setRaidCombatants,
      raidPlayerIds,
      clanId,
      leaderPlayerId
    );
    _checkAndSetAssignCombatants(
      _lockedVaults,
      setLockedVaultCombatants,
      lockedVaultPlayerIds,
      _territories,
      setTerritoryCombatants,
      territoryPlayerIds,
      _raids,
      setRaidCombatants,
      raidPlayerIds,
      clanId,
      leaderPlayerId
    );
    _checkAndSetAssignCombatants(
      _raids,
      setRaidCombatants,
      raidPlayerIds,
      _lockedVaults,
      setLockedVaultCombatants,
      lockedVaultPlayerIds,
      _territories,
      setTerritoryCombatants,
      territoryPlayerIds,
      clanId,
      leaderPlayerId
    );
  }

  function _checkAndSetAssignCombatants(
    ICombatants combatants,
    bool setCombatants,
    uint64[] calldata playerIds,
    ICombatants otherCombatants,
    bool setOtherCombatants,
    uint64[] calldata otherPlayerIds,
    ICombatants otherCombatants1,
    bool setOtherCombatants1,
    uint64[] calldata otherPlayerIds1,
    uint256 clanId,
    uint256 leaderPlayerId
  ) private {
    if (setCombatants) {
      uint256 newCombatantCooldownTimestamp = block.timestamp + _combatantChangeCooldown;
      // Check they are not being placed as a warrior in another  a locked vault combatant
      IClans clans = _clans;
      for (uint256 i; i < playerIds.length; ++i) {
        uint64 playerId = playerIds[i];
        if (setOtherCombatants) {
          if (otherPlayerIds.length != 0) {
            uint256 searchIndex = EstforLibrary.binarySearchMemory(otherPlayerIds, playerId);
            require(searchIndex == type(uint256).max, PlayerCannotBeInAssignedMoreThanOnce());
          } 
        } else {
          require(!otherCombatants.isCombatant(clanId, playerId), PlayerAlreadyExistingCombatant());
        }

        if (setOtherCombatants1) {
          if (otherPlayerIds1.length != 0) {
            uint256 searchIndex = EstforLibrary.binarySearchMemory(otherPlayerIds1, playerId);
            require(searchIndex == type(uint256).max, PlayerCannotBeInAssignedMoreThanOnce());
          }
        } else {
          require(!otherCombatants1.isCombatant(clanId, playerId), PlayerAlreadyExistingCombatant());
        }

        PlayerInfo storage playerInfo = _playerInfos[playerId];

        // Check the cooldown periods on combatant assignment.
        // They might have just joined from another clan or assigned from territory to locked vaults
        require(playerInfo.combatantCooldownTimestamp <= block.timestamp, PlayerCombatantCooldownTimestamp());

        // Check they are part of the clan
        require(clans.getRank(clanId, playerId) != ClanRank.NONE, NotMemberOfClan());

        if (i != playerIds.length - 1) {
          require(playerIds[i] < playerIds[i + 1], PlayerIdsNotSortedOrDuplicates());
        }
        require(_players.isPlayerEvolved(playerId), PlayerNotUpgraded(playerId));

        playerInfo.combatantCooldownTimestamp = uint40(newCombatantCooldownTimestamp);
      }
      combatants.assignCombatants(clanId, playerIds, newCombatantCooldownTimestamp, leaderPlayerId);
    } else {
      require(playerIds.length == 0, SetCombatantsIncorrectly());
    }
  }

  function clearCooldowns(uint64[] calldata playerIds) public isAdminAndBeta {
    for (uint256 i; i < playerIds.length; ++i) {
      _playerInfos[playerIds[i]].combatantCooldownTimestamp = 0;
    }
  }
  
  function setPlayerLeftCombatantCooldownTimestampPenalty(
    uint24 cooldownTimestampPenalty
  ) external onlyOwner {
    _playerLeftCombatantCooldownTimestampPenalty = cooldownTimestampPenalty;
    emit EditMemberLeftCombatantCooldownTimestampPenalty(cooldownTimestampPenalty);
  }

  function applyPlayerCombatantCooldownPenalty(
    uint256 playerId
  ) external onlyClans {
    PlayerInfo storage playerInfo = _playerInfos[playerId];
    playerInfo.combatantCooldownTimestamp = uint40(block.timestamp + _playerLeftCombatantCooldownTimestampPenalty);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
