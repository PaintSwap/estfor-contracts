// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {PlayersBase} from "./PlayersBase.sol";

// Use this first to get the same storage layout for implementation files as the main contract
contract PlayersUpgradeableImplDummyBase {
  // From UUPSUpgradeable, includes ERC1967UpgradeUpgradeable
  uint256[100] private __gap;
  // From OwnableUpgradeable, includes ContextUpgradeable
  uint256[100] private __gap1;
  // From ReentrancyGuardUpgradeable
  uint256[51] private __gap2;
  // DO NOT UPDATE THIS AFTER DEPLOYMENT!!!
}
