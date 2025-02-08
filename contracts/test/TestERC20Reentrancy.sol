// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20Reentrancy is ERC20("PaintSwap Token Reentrancy", "BRUSH_R") {
  address private _orderBook;
  uint256 private _orderId;

  function setOrderBook(address orderBook) external {
    _orderBook = orderBook;
  }

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function transferFrom(address from, address recipient, uint256 amount) public override returns (bool) {
    if (recipient == _orderBook) {
      uint256[] memory orderIds = new uint256[](1);
      orderIds[0] = _orderId;
      bytes memory data = abi.encodeWithSignature("claimTokens(uint256[])", orderIds);
      (bool success, bytes memory returnData) = _orderBook.call(data);
      if (!success) {
        assembly ("memory-safe") {
          revert(add(returnData, 32), mload(returnData))
        }
      }
    }

    _transfer(_msgSender(), recipient, amount);
    return true;
  }
}
