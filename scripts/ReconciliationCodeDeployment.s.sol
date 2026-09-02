// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract ReconciliationCodeDeployment is Script {
  function prepareUpgrade(
    string calldata fullyQualifiedName,
    address expectedAddress
  ) external returns (address implementation) {
    Options memory options;
    options.unsafeAllow = "external-library-linking";

    vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
    implementation = Upgrades.prepareUpgrade(fullyQualifiedName, options);
    vm.stopBroadcast();

    require(implementation == expectedAddress, "Unexpected implementation address");
  }

  function deployLibrary(
    string calldata fullyQualifiedName,
    address expectedAddress
  ) external returns (address deployed) {
    bytes memory creationCode = vm.getCode(fullyQualifiedName);

    vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
    assembly ("memory-safe") {
      deployed := create(0, add(creationCode, 32), mload(creationCode))
    }
    vm.stopBroadcast();

    require(deployed == expectedAddress, "Unexpected library address");
  }
}
