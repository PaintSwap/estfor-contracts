// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC5313} from "@openzeppelin/contracts/interfaces/IERC5313.sol";

/// @notice ABI and selectors supplied by OpenZeppelin Ownable implementations.
interface IOwnable is IERC5313 {
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  error OwnableUnauthorizedAccount(address account);
  error OwnableInvalidOwner(address owner);

  function renounceOwnership() external;
  function transferOwnership(address newOwner) external;
}
