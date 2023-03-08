// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IBrushToken.sol";

interface Router {
  function swapExactETHForTokens(
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline
  ) external payable returns (uint[] memory amounts);
}

contract RoyaltyReceiver is Ownable {
  Router router;
  address pool;
  IBrushToken brush;
  address[] buyPath;
  uint constant deadlineDuration = 10 minutes; // Doesn't matter

  constructor(Router _router, address _pool, IBrushToken _brush, address[] memory _buyPath) {
    pool = _pool;
    router = _router;
    brush = _brush;
    buyPath = _buyPath;
    require(address(_router) != address(0));
    require(_pool != address(0));
    require(address(_brush) != address(0));
  }

  receive() external payable {
    uint deadline = block.timestamp + deadlineDuration;
    // Buy brush and send it to the pool
    uint[] memory amounts = router.swapExactETHForTokens{value: msg.value}(0, buyPath, address(this), deadline);
    brush.transfer(pool, amounts[amounts.length - 1]);
  }
}
