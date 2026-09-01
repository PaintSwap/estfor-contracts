// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC1967} from "@openzeppelin/contracts/interfaces/IERC1967.sol";
import {IERC1822Proxiable} from "@openzeppelin/contracts/interfaces/draft-IERC1822.sol";

/// @notice ABI and selectors supplied by OpenZeppelin UUPS implementations.
interface IUUPSUpgradeable is IERC1822Proxiable, IERC1967 {
  error UUPSUnauthorizedCallContext();
  error UUPSUnsupportedProxiableUUID(bytes32 slot);

  function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
  function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}
