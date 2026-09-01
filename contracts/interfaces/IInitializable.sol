// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Events and error selectors supplied by OpenZeppelin Initializable implementations.
interface IInitializable {
  event Initialized(uint64 version);

  error InvalidInitialization();
  error NotInitializing();
}
