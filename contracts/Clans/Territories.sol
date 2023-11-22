// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {IClans} from "../interfaces/IClans.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";

contract Territories is UUPSUpgradeable, OwnableUpgradeable, ITerritories {
  event AddTerritories(TerritoryInput[] territories);
  event EditTerritories(TerritoryInput[] territories);
  event RemoveTerritories(uint[] territoryIds);
  event ClaimedTerritory(uint indexed territoryId, uint indexed oldClanId, uint indexed newClanId);
  event Deposit(uint amount);

  error InvalidTerritory();
  error InvalidTerritoryId();
  error InvalidEmissionPercentage();
  error NoOccupier();
  error TransferFailed();

  uint constant PERCENTAGE_EMISSION_MUL = 10;

  struct TerritoryInput {
    uint16 territoryId;
    uint8 percentageEmissions; // Is multiplied by PERCENTAGE_EMISSION_MUL
  }

  struct Territory {
    uint16 territoryId; // TODO: Could be removed if necessary
    uint8 percentageEmissions;
    uint32 clanIdOccupier;
    uint88 unclaimedEmissions;
    uint40 lastClaimTime; // TODO: Needed?
  }

  Territory[] public territories;
  IClans public clans;
  uint8 public totalEmissionPercentage;
  IBrushToken public brush;

  uint constant MAX_DAILY_EMISSIONS = 10000 ether;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(TerritoryInput[] calldata _territories, IClans _clans, IBrushToken _brush) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    clans = _clans;
    brush = _brush;

    _addTerritories(_territories);
  }

  function _checkTerritory(TerritoryInput calldata _land) private pure {
    if (_land.territoryId == 0 || _land.percentageEmissions == 0) {
      revert InvalidTerritory();
    }
  }

  function _addTerritories(TerritoryInput[] calldata _territories) private {
    uint offset = territories.length + 1;
    uint _totalEmissionPercentage = totalEmissionPercentage;
    for (uint i; i < _territories.length; ++i) {
      _checkTerritory(_territories[i]);
      if (i + offset != _territories[i].territoryId) {
        revert InvalidTerritoryId();
      }

      territories.push(
        Territory({
          territoryId: _territories[i].territoryId,
          clanIdOccupier: 0,
          percentageEmissions: _territories[i].percentageEmissions,
          unclaimedEmissions: 0,
          lastClaimTime: 0
        })
      );
      _totalEmissionPercentage += _territories[i].percentageEmissions;
    }

    if (_totalEmissionPercentage > 100 * PERCENTAGE_EMISSION_MUL) {
      revert InvalidEmissionPercentage();
    }

    totalEmissionPercentage = uint8(_totalEmissionPercentage);
    emit AddTerritories(_territories);
  }

  function claimTerritory(uint territoryId) external {
    //    require(territoryId > 0 && territoryId <= territories.length, "Invalid land ID");
    //    require(territories[territoryId - 1].owner == address(0), "Territory already claimed");
    //    territories[territoryId - 1].owner = msg.sender;
    //   territories[territoryId - 1].lastClaimTime = block.timestamp;
    //   emit ClaimedTerritory(territoryId, msg.sender);
  }

  function attackTerritory(uint territoryId) external {
    // Implementation of attack logic
    // Can only attack once per day
    // Cannot have a land already
  }

  // Any harvest automatically does a claim as well beforehand
  function harvest(uint _territoryId) external {
    // Get the clan bank address which owns this
    _callAddUnclaimedEmissions();

    Territory storage land = territories[_territoryId - 1];
    if (land.clanIdOccupier == 0) {
      revert NoOccupier();
    }

    // TODO Frozen funds, here or in bank?
    //    clans.;

    // unclaimedEmissions

    // TODO Always leave 1 brush wei in at least.
  }

  function pendingEmissions(uint _territoryId) external {
    // get pending from masterchef * 2 ?
  }

  function addTerritories(TerritoryInput[] calldata _territories) external onlyOwner {
    _addTerritories(_territories);
  }

  function editTerritories(TerritoryInput[] calldata _territories) external onlyOwner {
    uint _totalEmissionPercentage = totalEmissionPercentage;
    for (uint i; i < _territories.length; ++i) {
      _checkTerritory(_territories[i]);
      _totalEmissionPercentage -= territories[i].percentageEmissions;
      _totalEmissionPercentage += _territories[i].percentageEmissions;
      territories[_territories[i].territoryId - 1].percentageEmissions = _territories[i].percentageEmissions;
    }

    if (_totalEmissionPercentage > 100) {
      revert InvalidEmissionPercentage();
    }
    totalEmissionPercentage = uint8(_totalEmissionPercentage);
    emit EditTerritories(_territories);
  }

  function removeTerritories(uint[] calldata _territoryIds) external onlyOwner {
    uint _totalEmissionPercentage = totalEmissionPercentage;
    for (uint i; i < _territoryIds.length; ++i) {
      if (territories[_territoryIds[i] - 1].territoryId == 0) {
        revert InvalidTerritoryId();
      }

      _totalEmissionPercentage -= territories[_territoryIds[i] - 1].percentageEmissions;
      delete territories[_territoryIds[i] - 1];
    }

    totalEmissionPercentage = uint8(_totalEmissionPercentage);
    emit RemoveTerritories(_territoryIds);
  }

  // If a transfer of assets
  function _callAddUnclaimedEmissions() private {
    //    _artGallery.
  }

  function addUnclaimedEmissions(uint _amount) external {
    if (!brush.transferFrom(msg.sender, address(this), _amount)) {
      revert TransferFailed();
    }
    for (uint i; i < territories.length; ++i) {
      territories[i].unclaimedEmissions += uint88(
        (_amount * territories[i].percentageEmissions) / totalEmissionPercentage
      );
    }
    emit Deposit(_amount);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
