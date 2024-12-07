// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IBrushToken} from "../interfaces/external/IBrushToken.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {Treasury} from "../Treasury.sol";

contract TerritoryTreasury is UUPSUpgradeable, OwnableUpgradeable {
  event Harvest(address from, uint256 playerId, uint256 amount, uint256 nextHarvestAllowedTimestamp);
  event SetMinHarvestInternal(uint256 minHarvestInterval);

  error InvalidPool();
  error ZeroBalance();
  error TransferFailed();
  error HarvestingTooSoon();
  error HarvestingTooMuch();
  error NotOwnerOfPlayer();

  ITerritories private _territories;
  uint16 private _minHarvestInterval;
  IBrushToken private _brush;
  address private _dev;
  IERC1155 private _playerNFT;
  Treasury private _treasury;
  uint40 private _nextHarvestAllowedTimestamp;

  modifier isOwnerOfPlayer(uint256 playerId) {
    require(_playerNFT.balanceOf(_msgSender(), playerId) != 0, NotOwnerOfPlayer());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    ITerritories territories,
    IBrushToken brush,
    IERC1155 playerNFT,
    address dev,
    Treasury treasury,
    uint16 minHarvestInterval
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _territories = territories;
    _playerNFT = playerNFT;
    _brush = brush;
    _dev = dev;
    _treasury = treasury;
    _brush.approve(address(territories), type(uint256).max);
    setMinHarvestInterval(minHarvestInterval);
  }

  function harvest(uint256 playerId) external isOwnerOfPlayer(playerId) {
    // Max harvest once every few hours
    require(block.timestamp >= _nextHarvestAllowedTimestamp, HarvestingTooSoon());

    _nextHarvestAllowedTimestamp = uint40(block.timestamp + _minHarvestInterval);
    uint256 brushAmount = pendingBrush();
    require(brushAmount != 0, ZeroBalance());
    ITerritories territories = _territories;

    _treasury.spend(address(this), brushAmount);
    territories.addUnclaimedEmissions(brushAmount);

    emit Harvest(_msgSender(), playerId, brushAmount, uint40(block.timestamp + _minHarvestInterval));
  }

  function pendingBrush() public view returns (uint256) {
    uint256 totalBrush = _treasury.totalClaimable(address(this)); // Take 1 % of the our allowance
    uint256 harvestableBrush = totalBrush / 100;
    return harvestableBrush;
  }

  function setMinHarvestInterval(uint16 minHarvestInterval) public onlyOwner {
    _minHarvestInterval = minHarvestInterval;
    emit SetMinHarvestInternal(minHarvestInterval);
  }

  function setTerritories(ITerritories territories) external onlyOwner {
    _territories = territories;
    _brush.approve(address(territories), type(uint256).max);
  }

  function clearHarvestCooldownTimestamp() external onlyOwner {
    _nextHarvestAllowedTimestamp = 0;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
