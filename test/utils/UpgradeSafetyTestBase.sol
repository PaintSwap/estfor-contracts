// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

abstract contract UpgradeSafetyTestBase is Test {
  function _validateUpgrade(string memory fullyQualifiedName) internal {
    string[] memory command = new string[](3);
    command[0] = "bash";
    command[1] = "scripts/validate-foundry-upgrade.sh";
    command[2] = fullyQualifiedName;
    vm.ffi(command);
  }
}
