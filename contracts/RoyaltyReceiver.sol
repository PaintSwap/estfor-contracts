// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {ITerritories} from "./interfaces/ITerritories.sol";

interface Router {
  function swapExactETHForTokens(
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline
  ) external payable returns (uint[] memory amounts);
}

contract RoyaltyReceiver is UUPSUpgradeable, OwnableUpgradeable {
  using UnsafeMath for uint256;

  uint public constant MIN_BRUSH_TO_DISTRIBUTE = 100 ether;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  error AddressZero();
  error FailedSendToDev();
  error BrushTooLowToDistribute();

  Router public router;
  address public pool;
  IBrushToken public brush;
  address private wNative;
  address private dev;
  ITerritories private territories;
  uint public constant DEADLINE_DURATION = 10 minutes; // Doesn't matter

  function initialize(
    Router _router,
    address _pool,
    address _dev,
    IBrushToken _brush,
    address _wNative
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    router = _router;
    pool = _pool;
    dev = _dev;
    brush = _brush;
    wNative = _wNative;
    if (address(_router) == address(0)) {
      revert AddressZero();
    }
    if (_pool == address(0)) {
      revert AddressZero();
    }
    if (address(_brush) == address(0)) {
      revert AddressZero();
    }
    if (dev == address(0)) {
      revert AddressZero();
    }
  }

  function distributeBrush() external {
    uint balance = brush.balanceOf(address(this));
    if (balance < MIN_BRUSH_TO_DISTRIBUTE) {
      revert BrushTooLowToDistribute();
    }
    territories.addUnclaimedEmissions(balance);
  }

  function _buyPath() private view returns (address[] memory buyPath) {
    buyPath = new address[](2);
    buyPath[0] = wNative;
    buyPath[1] = address(brush);
  }

  function canDistribute() external view returns (bool) {
    return brush.balanceOf(address(this)) >= MIN_BRUSH_TO_DISTRIBUTE;
  }

  function setTerritories(ITerritories _territories) external onlyOwner {
    territories = _territories;
    brush.approve(address(_territories), type(uint256).max);
  }

  receive() external payable {
    uint deadline = block.timestamp.add(DEADLINE_DURATION);

    uint third = msg.value / 3;
    (bool success, ) = dev.call{value: third}("");
    if (!success) {
      revert FailedSendToDev();
    }

    // Buy brush and send it to the pool
    uint[] memory amounts = router.swapExactETHForTokens{value: msg.value - third}(
      0,
      _buyPath(),
      address(this),
      deadline
    );
    brush.transfer(pool, amounts[amounts.length - 1]);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
