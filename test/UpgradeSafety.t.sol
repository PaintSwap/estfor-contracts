// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

contract UpgradeSafetyTest is Test {
  function testShopUpgradeSafe() public {
    _validateUpgrade("contracts/Shop.sol:Shop");
  }

  function _validateUpgrade(string memory fullyQualifiedName) private {
    string[] memory command = new string[](3);
    command[0] = "bash";
    command[1] = "scripts/validate-foundry-upgrade.sh";
    command[2] = fullyQualifiedName;
    vm.ffi(command);
  }
}
