// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library DeploymentSlots {
  bytes32 internal constant IMPLEMENTATION = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
  bytes32 internal constant BEACON = bytes32(uint256(keccak256("eip1967.proxy.beacon")) - 1);
}
