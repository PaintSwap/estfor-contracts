// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {ICombatants} from "../interfaces/ICombatants.sol";

import {AdminAccess} from "../AdminAccess.sol";

import {ClanRank} from "../globals/clans.sol";

import {EstforLibrary} from "../EstforLibrary.sol";

// This contract allows setting both territory and locked vault combatants in a single transaction
// And more efficiently checking if they are already combatants in either territory or locked vaults
// as the same player cannot be in both
contract CombatantsHelper is UUPSUpgradeable, OwnableUpgradeable {
  error NotOwnerOfPlayerAndActive();
  error NotLeader();
  error PlayerOnTerritoryAndLockedVault();
  error PlayerAlreadyExistingCombatant();
  error SetCombatantsIncorrectly();
  error NotSettingCombatants();
  error NotAdminAndBeta();
  error PlayerCombatantCooldownTimestamp();
  error PlayerIdsNotSortedOrDuplicates();
  error NotMemberOfClan();

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

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  modifier isAtLeastLeaderOfClan(uint256 clanId, uint256 playerId) {
    require(_clans.getRank(clanId, playerId) >= ClanRank.LEADER, NotLeader());
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
    AdminAccess adminAccess,
    bool isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _players = players;
    _clans = clans;
    _territories = territories;
    _lockedVaults = lockedVaults;

    _adminAccess = AdminAccess(adminAccess);
    _isBeta = isBeta;

    _combatantChangeCooldown = isBeta ? 5 minutes : 3 days;
  }

  function assignCombatants(
    uint256 clanId,
    bool setTerritoryCombatants,
    uint48[] calldata territoryPlayerIds,
    bool setLockedVaultCombatants,
    uint48[] calldata lockedVaultPlayerIds,
    uint256 leaderPlayerId
  ) external isOwnerOfPlayerAndActive(leaderPlayerId) isAtLeastLeaderOfClan(clanId, leaderPlayerId) {
    require(setTerritoryCombatants || setLockedVaultCombatants, NotSettingCombatants());

    _checkAndSetAssignCombatants(
      _territories,
      setTerritoryCombatants,
      territoryPlayerIds,
      _lockedVaults,
      setLockedVaultCombatants,
      lockedVaultPlayerIds,
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
      clanId,
      leaderPlayerId
    );
  }

  function _checkAndSetAssignCombatants(
    ICombatants combatants,
    bool setCombatants,
    uint48[] calldata playerIds,
    ICombatants otherCombatants,
    bool setOtherCombatants,
    uint48[] calldata otherPlayerIds,
    uint256 clanId,
    uint256 leaderPlayerId
  ) private {
    if (setCombatants) {
      uint256 newCombatantCooldownTimestamp = block.timestamp + _combatantChangeCooldown;
      // Check they are not being placed as a locked vault combatant
      for (uint256 i; i < playerIds.length; ++i) {
        if (setOtherCombatants) {
          if (otherPlayerIds.length != 0) {
            uint256 searchIndex = EstforLibrary.binarySearchMemory(otherPlayerIds, playerIds[i]);
            require(searchIndex == type(uint256).max, PlayerOnTerritoryAndLockedVault());
          }
        } else {
          require(!otherCombatants.isCombatant(clanId, playerIds[i]), PlayerAlreadyExistingCombatant());
        }

        // Check the cooldown periods on combatant assignment.
        // They might have just joined from another clan or assigned from territory to locked vaults
        require(
          _playerInfos[playerIds[i]].combatantCooldownTimestamp <= block.timestamp,
          PlayerCombatantCooldownTimestamp()
        );

        // Check they are part of the clan
        require(_clans.getRank(clanId, playerIds[i]) != ClanRank.NONE, NotMemberOfClan());

        if (i != playerIds.length - 1) {
          require(playerIds[i] < playerIds[i + 1], PlayerIdsNotSortedOrDuplicates());
        }

        _playerInfos[playerIds[i]].combatantCooldownTimestamp = uint40(newCombatantCooldownTimestamp);
      }
      combatants.assignCombatants(clanId, playerIds, newCombatantCooldownTimestamp, leaderPlayerId);
    } else {
      require(playerIds.length == 0, SetCombatantsIncorrectly());
    }
  }

  function clearCooldowns(uint48[] calldata playerIds) public isAdminAndBeta {
    for (uint256 i; i < playerIds.length; ++i) {
      _playerInfos[playerIds[i]].combatantCooldownTimestamp = 0;
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
