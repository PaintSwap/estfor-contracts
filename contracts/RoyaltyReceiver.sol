// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";

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

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  error AddressZero();
  error IncorrectBrushPath();
  error FailedSendToDev();

  Router public router;
  address public pool;
  IBrushToken public brush;
  address private buyPath1;
  address private dev;

  uint public constant DEADLINE_DURATION = 10 minutes; // Doesn't matter

  function initialize(
    Router _router,
    address _pool,
    address _dev,
    IBrushToken _brush,
    address[2] calldata _buyPath
  ) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();

    pool = _pool;
    router = _router;
    brush = _brush;
    buyPath1 = _buyPath[0];
    dev = _dev;
    if (_buyPath[1] != address(_brush)) {
      revert IncorrectBrushPath();
    }
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

  function buyPath() private view returns (address[] memory _buyPath) {
    _buyPath = new address[](2);
    _buyPath[0] = buyPath1;
    _buyPath[1] = address(brush);
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
      buyPath(),
      address(this),
      deadline
    );
    brush.transfer(pool, amounts[amounts.length - 1]);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
