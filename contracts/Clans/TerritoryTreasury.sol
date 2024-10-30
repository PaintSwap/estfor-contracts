// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {IPaintSwapDecorator} from "../interfaces/IPaintSwapDecorator.sol";
import {Treasury} from "../Treasury.sol";

contract TerritoryTreasury is UUPSUpgradeable, OwnableUpgradeable {
  event Deposit(uint256 amount);
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
  /* TODO: delete after the decorator is no longer used */
  IPaintSwapDecorator private _decorator;
  IERC20 private _lpToken;
  uint16 private _pid;
  /* End delete */

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
    uint16 minHarvestInterval,
    IPaintSwapDecorator decorator,
    uint256 pid
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

    _decorator = decorator;
    setPID(pid);
  }

  function deposit() external {
    uint256 balance = _lpToken.balanceOf(_msgSender());
    require(balance != 0, ZeroBalance());
    require(_lpToken.transferFrom(_msgSender(), address(this), balance), TransferFailed());
    _decorator.deposit(_pid, balance);
    emit Deposit(balance);
  }

  function harvest(uint256 playerId) external isOwnerOfPlayer(playerId) {
    // Max harvest once every few hours
    require(block.timestamp >= _nextHarvestAllowedTimestamp, HarvestingTooSoon());

    _nextHarvestAllowedTimestamp = uint40(block.timestamp + _minHarvestInterval);
    _decorator.updatePool(_pid);
    uint256 fullBrushAmount = pendingBrush();
    require(fullBrushAmount != 0, ZeroBalance());
    _decorator.deposit(_pid, 0); // get rewards
    _territories.addUnclaimedEmissions(fullBrushAmount);

    uint256 totalBrush = _treasury.totalClaimable(address(this)); // Take 1 % of it
    uint256 harvestableBrush = totalBrush / 100;
    if (harvestableBrush != 0) {
      _treasury.spend(address(this), harvestableBrush);
      _territories.addUnclaimedEmissions(harvestableBrush);
    }

    emit Harvest(_msgSender(), playerId, fullBrushAmount, uint40(block.timestamp + _minHarvestInterval));
  }

  function pendingBrush() public view returns (uint256) {
    return _decorator.pendingBrush(_pid, address(this));
  }

  // Delete after decorator is no longer used
  function setPID(uint256 pid) public onlyOwner {
    (address lpToken, , , ) = _decorator.poolInfo(pid);
    require(lpToken != address(0), InvalidPool());

    _lpToken = IERC20(lpToken);
    _pid = uint16(pid);
    _lpToken.approve(address(_decorator), type(uint256).max);
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
