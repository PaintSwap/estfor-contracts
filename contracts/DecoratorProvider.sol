// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {ITerritories} from "./interfaces/ITerritories.sol";
import {IPaintSwapDecorator} from "./interfaces/IPaintSwapDecorator.sol";
import {IPaintSwapArtGallery} from "./interfaces/IPaintSwapArtGallery.sol";

contract DecoratorProvider is UUPSUpgradeable, OwnableUpgradeable {
  event Deposit(uint amount);
  event Harvest(uint amount);
  event SetPID(uint pid);
  event UnlockFromArtGallery(uint amount);

  error InvalidPool();
  error ZeroBalance();
  error TransferFailed();

  IPaintSwapDecorator public decorator;
  IPaintSwapArtGallery public artGallery;
  ITerritories public territories;
  IBrushToken public brush;
  address public dev;
  IERC20 public lpToken;
  uint16 public pid;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPaintSwapDecorator _decorator,
    IPaintSwapArtGallery _artGallery,
    ITerritories _territories,
    IBrushToken _brush,
    address _dev,
    uint _pid
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    territories = _territories;
    brush = _brush;
    artGallery = _artGallery;
    decorator = _decorator;
    dev = _dev;
    _brush.approve(address(_territories), type(uint256).max);
    setPID(_pid);
  }

  function deposit() external {
    uint balance = lpToken.balanceOf(msg.sender);
    if (balance == 0) {
      revert ZeroBalance();
    }
    if (!lpToken.transferFrom(msg.sender, address(this), balance)) {
      revert TransferFailed();
    }
    decorator.deposit(pid, balance);
    emit Deposit(balance);
  }

  function harvest() external {
    uint amountBrush = decorator.pendingBrush(pid, address(this));
    if (amountBrush == 0) {
      revert ZeroBalance();
    }
    decorator.deposit(pid, 0);
    uint fullBrushAmount = amountBrush * 2; // There will be funds here which are used to offset the art gallery rewards
    territories.addUnclaimedEmissions(fullBrushAmount);
    emit Harvest(fullBrushAmount);
  }

  function unlockFromArtGallery() external {
    (, , , uint256 unlockableAmount, , ) = artGallery.inspect(address(this));
    artGallery.unlock();
    brush.transfer(dev, unlockableAmount);
    emit UnlockFromArtGallery(unlockableAmount);
  }

  function setPID(uint _pid) public onlyOwner {
    (address _lpToken, , , ) = decorator.poolInfo(_pid);
    if (_lpToken == address(0)) {
      revert InvalidPool();
    }

    lpToken = IERC20(_lpToken);
    pid = uint16(_pid);
    lpToken.approve(address(decorator), type(uint256).max);
    emit SetPID(_pid);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
