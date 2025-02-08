// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

contract TestMaliciousReentrancy is ERC1155Holder {
  error CallFailed();

  address private immutable _orderBook;
  bytes private _data;
  uint256 private _stackCount;
  bool private _inFallback;

  constructor(address orderBook) {
    _orderBook = orderBook;
  }

  function onERC1155Received(
    address operator,
    address from,
    uint256 id,
    uint256 value,
    bytes memory data
  ) public override returns (bytes4) {
    // If we're not in a fallback-initiated call, just return
    if (!_inFallback) {
      return this.onERC1155Received.selector;
    }

    // Allow only one reentrant call during fallback
    if (_stackCount > 1) {
      return this.onERC1155Received.selector;
    }

    ++_stackCount;
    (bool success, bytes memory returnData) = _orderBook.call(_data);
    if (!success) {
      assembly ("memory-safe") {
        revert(add(returnData, 32), mload(returnData))
      }
    }
    --_stackCount;

    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address operator,
    address from,
    uint256[] memory ids,
    uint256[] memory values,
    bytes memory data
  ) public override returns (bytes4) {
    // Same logic as onERC1155Received
    if (!_inFallback) {
      return this.onERC1155BatchReceived.selector;
    }

    if (_stackCount > 1) {
      return this.onERC1155BatchReceived.selector;
    }

    ++_stackCount;
    (bool success, bytes memory returnData) = _orderBook.call(_data);
    if (!success) {
      assembly ("memory-safe") {
        revert(add(returnData, 32), mload(returnData))
      }
    }
    --_stackCount;

    return this.onERC1155BatchReceived.selector;
  }

  fallback(bytes calldata data) external returns (bytes memory) {
    _data = data;
    _inFallback = true;
    _stackCount = 1;

    (bool success, bytes memory returnData) = _orderBook.call(data);
    if (!success) {
      assembly ("memory-safe") {
        revert(add(returnData, 32), mload(returnData))
      }
    }

    _stackCount = 0;
    _inFallback = false;
    return returnData;
  }

  receive() external payable {
    if (!_inFallback) {
      return;
    }

    if (_stackCount > 1) {
      return;
    }

    ++_stackCount;
    (bool success, bytes memory returnData) = _orderBook.call(_data);
    if (!success) {
      assembly ("memory-safe") {
        revert(add(returnData, 32), mload(returnData))
      }
    }
    --_stackCount;
  }
}
