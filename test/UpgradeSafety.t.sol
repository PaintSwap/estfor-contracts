// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Upgrades, Options} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract UpgradeSafetyTest is Test {
  function testShopUpgradeSafe() public {
    Options memory opts;
    Upgrades.validateUpgrade("contracts/Shop.sol:Shop", opts);
  }
}
