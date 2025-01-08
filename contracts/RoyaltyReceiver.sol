// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "./interfaces/external/IBrushToken.sol";
import {ISolidlyRouter, Route} from "./interfaces/external/ISolidlyRouter.sol";

import {ITerritories} from "./interfaces/ITerritories.sol";

contract RoyaltyReceiver is UUPSUpgradeable, OwnableUpgradeable {
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  error AddressZero();
  error FailedSendToDev();

  uint256 private constant DEADLINE_DURATION = 10 minutes; // Doesn't matter

  ISolidlyRouter private _router;
  address private _treasury;
  IBrushToken private _brush;
  address private _wNative;
  address private _dev;

  function initialize(
    ISolidlyRouter router,
    address treasury,
    address dev,
    IBrushToken brush,
    address wNative
  ) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();

    require(address(router) != address(0), AddressZero());
    require(treasury != address(0), AddressZero());
    require(address(brush) != address(0), AddressZero());
    require(dev != address(0), AddressZero());

    _router = router;
    _treasury = treasury;
    _dev = dev;
    _brush = brush;
    _wNative = wNative;
  }

  function distributeBrush() external {
    _brush.transfer(_treasury, _brush.balanceOf(address(this)));
  }

  receive() external payable {
    uint256 deadline = block.timestamp + DEADLINE_DURATION;

    uint256 third = msg.value / 3;
    (bool success, ) = _dev.call{value: third}("");
    require(success, FailedSendToDev());

    // Buy brush and send it to the treasury
    Route[] memory routes = new Route[](1);
    routes[0] = Route({from: _wNative, to: address(_brush), stable: false});

    uint256[] memory amounts = _router.swapExactETHForTokens{value: msg.value - third}(
      0,
      routes,
      address(this),
      deadline
    );
    _brush.transfer(_treasury, amounts[amounts.length - 1]);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
