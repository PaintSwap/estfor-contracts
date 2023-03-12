// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";

interface Router {
  function swapExactETHForTokens(
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline
  ) external payable returns (uint[] memory amounts);
}

contract RoyaltyReceiver is Ownable {
  error AddressZero();

  Router public immutable router;
  address public immutable pool;
  IBrushToken public immutable brush;
  address private immutable buyPath1;
  address private immutable buyPath2;

  uint public constant DEADLINE_DURATION = 10 minutes; // Doesn't matter

  constructor(Router _router, address _pool, IBrushToken _brush, address[2] memory _buyPath) {
    pool = _pool;
    router = _router;
    brush = _brush;
    // store the path in the bytecode
    buyPath1 = _buyPath[0];
    buyPath2 = _buyPath[1];
    if (address(_router) == address(0)) {
      revert AddressZero();
    }
    if (_pool == address(0)) {
      revert AddressZero();
    }
    if (address(_brush) == address(0)) {
      revert AddressZero();
    }
  }

  function buyPath() public view returns (address[] memory _buyPath) {
    _buyPath = new address[](2);
    _buyPath[0] = buyPath1;
    _buyPath[1] = buyPath2;
  }

  receive() external payable {
    uint deadline = block.timestamp + DEADLINE_DURATION;
    // Buy brush and send it to the pool
    uint[] memory amounts = router.swapExactETHForTokens{value: msg.value}(0, buyPath(), address(this), deadline);
    brush.transfer(pool, amounts[amounts.length - 1]);
  }
}
