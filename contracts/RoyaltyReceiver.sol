// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "./interfaces/external/IBrushToken.sol";
import {ISolidlyRouter, Route} from "./interfaces/external/ISolidlyRouter.sol";

import {ITerritories} from "./interfaces/ITerritories.sol";

contract RoyaltyReceiver is UUPSUpgradeable, OwnableUpgradeable {
  uint256 public constant MIN_BRUSH_TO_DISTRIBUTE = 100 ether;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  error AddressZero();
  error FailedSendToDev();
  error BrushTooLowToDistribute();

  ISolidlyRouter private _router;
  address private _pool;
  IBrushToken private _brush;
  address private _wNative;
  address private _dev;
  ITerritories private _territories;
  uint256 private constant DEADLINE_DURATION = 10 minutes; // Doesn't matter

  function initialize(
    ISolidlyRouter router,
    address pool,
    address dev,
    IBrushToken brush,
    address wNative
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    require(address(router) != address(0), AddressZero());
    require(pool != address(0), AddressZero());
    require(address(brush) != address(0), AddressZero());
    require(dev != address(0), AddressZero());

    _router = router;
    _pool = pool;
    _dev = dev;
    _brush = brush;
    _wNative = wNative;
  }

  function distributeBrush() external {
    uint256 balance = _brush.balanceOf(address(this));
    require(balance >= MIN_BRUSH_TO_DISTRIBUTE, BrushTooLowToDistribute());
    _territories.addUnclaimedEmissions(balance);
  }

  function canDistribute() external view returns (bool) {
    return _brush.balanceOf(address(this)) >= MIN_BRUSH_TO_DISTRIBUTE;
  }

  function setTerritories(ITerritories territories) external onlyOwner {
    _territories = territories;
    _brush.approve(address(territories), type(uint256).max);
  }

  receive() external payable {
    uint256 deadline = block.timestamp + DEADLINE_DURATION;

    uint256 third = msg.value / 3;
    (bool success, ) = _dev.call{value: third}("");
    require(success, FailedSendToDev());

    // Buy brush and send it to the pool
    Route[] memory routes = new Route[](1);
    routes[0] = Route({from: _wNative, to: address(_brush), stable: false});

    uint256[] memory amounts = _router.swapExactETHForTokens{value: msg.value - third}(
      0,
      routes,
      address(this),
      deadline
    );
    _brush.transfer(_pool, amounts[amounts.length - 1]);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
