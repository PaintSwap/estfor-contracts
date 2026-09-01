// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Error selector supplied by OpenZeppelin ReentrancyGuard implementations.
interface IReentrancyGuard {
  error ReentrancyGuardReentrantCall();
}
