// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {ITerritories} from "./interfaces/ITerritories.sol";
import {IPaintSwapDecorator} from "./interfaces/IPaintSwapDecorator.sol";
import {IPaintSwapArtGallery} from "./interfaces/IPaintSwapArtGallery.sol";

contract DecoratorProvider is UUPSUpgradeable, OwnableUpgradeable {
  event Deposit(uint256 amount);
  event Harvest(address from, uint256 playerId, uint256 amount, uint256 nextHarvestAllowedTimestamp);
  event SetPID(uint256 pid);
  event UnlockFromArtGallery(uint256 amount);

  error InvalidPool();
  error ZeroBalance();
  error TransferFailed();
  error HarvestingTooSoon();
  error HarvestingTooMuch();
  error NotOwnerOfPlayer();

  IPaintSwapDecorator private _decorator;
  IPaintSwapArtGallery private _artGallery;
  ITerritories private _territories;
  IBrushToken private _brush;
  address private _dev;
  IERC1155 private _playerNFT;
  uint16 private _pid;
  uint40 private _nextHarvestAllowedTimestamp;
  uint16 private _numUnclaimedHarvests;
  IERC20 private _lpToken;

  uint256 public constant MAX_UNCLAIMED_HARVESTS = 600;
  uint256 public constant MIN_HARVEST_INTERVAL = 3 hours + 45 minutes;

  modifier isOwnerOfPlayer(uint256 playerId) {
    if (_playerNFT.balanceOf(_msgSender(), playerId) == 0) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPaintSwapDecorator decorator,
    IPaintSwapArtGallery artGallery,
    ITerritories territories,
    IBrushToken brush,
    IERC1155 playerNFT,
    address dev,
    uint256 pid
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    _territories = territories;
    _playerNFT = playerNFT;
    _brush = brush;
    _artGallery = artGallery;
    _decorator = decorator;
    _dev = dev;
    _brush.approve(address(territories), type(uint256).max);
    setPID(pid);
  }

  function deposit() external {
    uint256 balance = _lpToken.balanceOf(_msgSender());
    if (balance == 0) {
      revert ZeroBalance();
    }
    if (!_lpToken.transferFrom(_msgSender(), address(this), balance)) {
      revert TransferFailed();
    }
    _decorator.deposit(_pid, balance);
    emit Deposit(balance);
  }

  function harvest(uint256 playerId) external isOwnerOfPlayer(playerId) {
    // Max harvest once every few hours
    if (block.timestamp < _nextHarvestAllowedTimestamp) {
      revert HarvestingTooSoon();
    }

    // Can not go above 600 unclaimed harvests
    if (_numUnclaimedHarvests > MAX_UNCLAIMED_HARVESTS) {
      revert HarvestingTooMuch();
    }

    _nextHarvestAllowedTimestamp = uint40(block.timestamp + MIN_HARVEST_INTERVAL);
    ++_numUnclaimedHarvests;
    _decorator.updatePool(_pid);
    uint256 fullBrushAmount = pendingBrushInclArtGallery();
    if (fullBrushAmount == 0) {
      revert ZeroBalance();
    }
    _decorator.deposit(_pid, 0); // get rewards
    _territories.addUnclaimedEmissions(fullBrushAmount);
    emit Harvest(_msgSender(), playerId, fullBrushAmount, uint40(block.timestamp + MIN_HARVEST_INTERVAL));
  }

  function inspectUnlockableAmount() external view returns (uint256 unlockableAmount) {
    (, , , unlockableAmount, , ) = _artGallery.inspect(address(this));
  }

  function unlockFromArtGallery() external {
    (, , uint256 unlockableCount, uint256 unlockableAmount, , ) = _artGallery.inspect(address(this));
    if (unlockableAmount == 0) {
      revert ZeroBalance();
    }

    _artGallery.unlock();
    _numUnclaimedHarvests -= uint16(unlockableCount);
    // Dev address gets the funds because it is using it to offset art gallery rewards currently
    _brush.transfer(_dev, unlockableAmount);
    emit UnlockFromArtGallery(unlockableAmount);
  }

  function pendingBrushInclArtGallery() public view returns (uint256) {
    return _decorator.pendingBrush(_pid, address(this)) * 2;
  }

  function setPID(uint256 pid) public onlyOwner {
    (address lpToken, , , ) = _decorator.poolInfo(pid);
    if (lpToken == address(0)) {
      revert InvalidPool();
    }

    _lpToken = IERC20(lpToken);
    _pid = uint16(pid);
    _lpToken.approve(address(_decorator), type(uint256).max);
    emit SetPID(pid);
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
