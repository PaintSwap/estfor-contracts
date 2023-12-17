// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {ICombatants} from "../interfaces/ICombatants.sol";

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

  IClans public clans;
  IPlayers public players;
  ICombatants public territories;
  ICombatants public lockedVaults;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isAtLeastLeaderOfClan(uint _clanId, uint _playerId) {
    if (clans.getRank(_clanId, _playerId) < ClanRank.LEADER) {
      revert NotLeader();
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
    ICombatants _lockedVaults
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    players = _players;
    clans = _clans;
    territories = _territories;
    lockedVaults = _lockedVaults;
  }

  function assignCombatants(
    uint _clanId,
    bool _setTerritoryCombatants,
    uint48[] calldata _territoryPlayerIds,
    bool _setLockedVaultCombatants,
    uint48[] calldata _lockedVaultPlayerIds,
    uint _leaderPlayerId
  ) external isOwnerOfPlayerAndActive(_leaderPlayerId) isAtLeastLeaderOfClan(_clanId, _leaderPlayerId) {
    if (!_setTerritoryCombatants && !_setLockedVaultCombatants) {
      revert NotSettingCombatants();
    }

    _checkAssignCombatants(
      territories,
      _setTerritoryCombatants,
      _territoryPlayerIds,
      lockedVaults,
      _setLockedVaultCombatants,
      _lockedVaultPlayerIds,
      _clanId,
      _leaderPlayerId
    );
    _checkAssignCombatants(
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

  function _checkAssignCombatants(
    ICombatants _combatants,
    bool _setCombatants,
    uint48[] calldata _playerIds,
    ICombatants _otherCombatants,
    bool _setOtherCombantants,
    uint48[] calldata _otherPlayerIds,
    uint _clanId,
    uint _leaderPlayerId
  ) private {
    if (_setCombatants) {
      // Check they are not being placed as a locked vault combatant
      if (_setOtherCombantants) {
        for (uint i; i < _playerIds.length; ++i) {
          uint searchIndex = EstforLibrary.binarySearchMemory(_otherPlayerIds, _playerIds[i]);
          if (searchIndex != type(uint).max) {
            revert PlayerOnTerritoryAndLockedVault();
          }
        }
      } else {
        for (uint i; i < _playerIds.length; ++i) {
          bool isCombatant = _otherCombatants.isCombatant(_clanId, _playerIds[i]);
          if (isCombatant) {
            revert PlayerAlreadyExistingCombatant();
          }
        }
      }

      _combatants.assignCombatants(_clanId, _playerIds, _leaderPlayerId);
    } else if (_playerIds.length > 0) {
      revert SetCombatantsIncorrectly();
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
