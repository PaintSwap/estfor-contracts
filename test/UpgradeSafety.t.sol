// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UpgradeSafetyTestBase} from "./utils/UpgradeSafetyTestBase.sol";

contract UpgradeSafetyTest is UpgradeSafetyTestBase {
  function testShopUpgradeSafe() public {
    _validateUpgrade("contracts/Shop.sol:Shop");
  }
}
