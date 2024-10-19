// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
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

  mapping(uint256 playerId => PlayerInfo playerInfos) private playerInfos;
  AdminAccess private adminAccess;
  bool private isBeta;
  IClans public clans;
  IPlayers public players;
  ICombatants public territories;
  uint24 private combatantChangeCooldown;
  ICombatants public lockedVaults;

  modifier isOwnerOfPlayerAndActive(uint256 _playerId) {
    if (!players.isOwnerOfPlayerAndActive(_msgSender(), _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isAtLeastLeaderOfClan(uint256 _clanId, uint256 _playerId) {
    if (clans.getRank(_clanId, _playerId) < ClanRank.LEADER) {
      revert NotLeader();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(adminAccess.isAdmin(_msgSender()) && isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPlayers _players,
    IClans _clans,
    ICombatants _territories,
    ICombatants _lockedVaults,
    AdminAccess _adminAccess,
    bool _isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    players = _players;
    clans = _clans;
    territories = _territories;
    lockedVaults = _lockedVaults;

    adminAccess = AdminAccess(_adminAccess);
    isBeta = _isBeta;

    combatantChangeCooldown = _isBeta ? 5 minutes : 3 days;
  }

  function assignCombatants(
    uint256 _clanId,
    bool _setTerritoryCombatants,
    uint48[] calldata _territoryPlayerIds,
    bool _setLockedVaultCombatants,
    uint48[] calldata _lockedVaultPlayerIds,
    uint256 _leaderPlayerId
  ) external isOwnerOfPlayerAndActive(_leaderPlayerId) isAtLeastLeaderOfClan(_clanId, _leaderPlayerId) {
    if (!_setTerritoryCombatants && !_setLockedVaultCombatants) {
      revert NotSettingCombatants();
    }

    _checkAndSetAssignCombatants(
      territories,
      _setTerritoryCombatants,
      _territoryPlayerIds,
      lockedVaults,
      _setLockedVaultCombatants,
      _lockedVaultPlayerIds,
      _clanId,
      _leaderPlayerId
    );
    _checkAndSetAssignCombatants(
      lockedVaults,
      _setLockedVaultCombatants,
      _lockedVaultPlayerIds,
      territories,
      _setTerritoryCombatants,
      _territoryPlayerIds,
      _clanId,
      _leaderPlayerId
    );
  }

  function _checkAndSetAssignCombatants(
    ICombatants _combatants,
    bool _setCombatants,
    uint48[] calldata _playerIds,
    ICombatants _otherCombatants,
    bool _setOtherCombatants,
    uint48[] calldata _otherPlayerIds,
    uint256 _clanId,
    uint256 _leaderPlayerId
  ) private {
    if (_setCombatants) {
      uint256 newCombatantCooldownTimestamp = block.timestamp + combatantChangeCooldown;
      // Check they are not being placed as a locked vault combatant
      for (uint256 i; i < _playerIds.length; ++i) {
        if (_setOtherCombatants) {
          if (_otherPlayerIds.length != 0) {
            uint256 searchIndex = EstforLibrary.binarySearchMemory(_otherPlayerIds, _playerIds[i]);
            if (searchIndex != type(uint256).max) {
              revert PlayerOnTerritoryAndLockedVault();
            }
          }
        } else {
          bool isCombatant = _otherCombatants.isCombatant(_clanId, _playerIds[i]);
          if (isCombatant) {
            revert PlayerAlreadyExistingCombatant();
          }
        }

        // Check the cooldown periods on combatant assignment.
        // They might have just joined from another clan or assigned from territory to locked vaults
        if (playerInfos[_playerIds[i]].combatantCooldownTimestamp > block.timestamp) {
          revert PlayerCombatantCooldownTimestamp();
        }

        // Check they are part of the clan
        if (clans.getRank(_clanId, _playerIds[i]) == ClanRank.NONE) {
          revert NotMemberOfClan();
        }

        if (i != _playerIds.length - 1 && _playerIds[i] >= _playerIds[i + 1]) {
          revert PlayerIdsNotSortedOrDuplicates();
        }

        playerInfos[_playerIds[i]].combatantCooldownTimestamp = uint40(newCombatantCooldownTimestamp);
      }
      _combatants.assignCombatants(_clanId, _playerIds, newCombatantCooldownTimestamp, _leaderPlayerId);
    } else if (_playerIds.length != 0) {
      revert SetCombatantsIncorrectly();
    }
  }

  function clearCooldowns(uint48[] calldata _playerIds) public isAdminAndBeta {
    for (uint256 i; i < _playerIds.length; ++i) {
      playerInfos[_playerIds[i]].combatantCooldownTimestamp = 0;
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
