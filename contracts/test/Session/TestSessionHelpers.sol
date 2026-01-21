// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Enum} from "../../interfaces/external/Enum.sol";
import {UsageBasedSessionModule} from "../../Session/UsageBasedSessionModule.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

/// @notice Minimal Safe-compatible mock that can enable sessions and forward calls
contract TestSessionSafe is ERC1155Holder {
  address public immutable owner;

  constructor(address _owner) {
    owner = _owner;
  }

  function callEnableSession(UsageBasedSessionModule module, address sessionKey, uint48 duration) external {
    require(msg.sender == owner, "Not owner");
    module.enableSession(sessionKey, duration);
  }

  function execTransactionFromModule(address to, uint256 value, bytes calldata data, Enum.Operation operation)
    external
    returns (bool success)
  {
    require(operation == Enum.Operation.Call, "Unsupported operation");
    bytes memory returnData;
    (success, returnData) = to.call{value: value}(data);
    // Bubble up revert reason for debugging
    // if (!success) {
    //   assembly {
    //     revert(add(returnData, 32), mload(returnData))
    //   }
    // }
  }
}

/// @notice Simple target used to test session execution
contract TestSessionTarget {
  uint256 public calls;

  event Called(address indexed caller, uint256 newCount);

  function doAction() external {
    calls += 1;
    emit Called(msg.sender, calls);
  }
}

contract TestSessionRevertingTarget {
  function revertAction() external pure {
    revert("TargetReverted");
  }
}