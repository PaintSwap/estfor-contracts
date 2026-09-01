// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ABI and selectors supplied by OpenZeppelin Pausable implementations.
interface IPausable {
  event Paused(address account);
  event Unpaused(address account);

  error EnforcedPause();
  error ExpectedPause();

  function paused() external view returns (bool);
}
