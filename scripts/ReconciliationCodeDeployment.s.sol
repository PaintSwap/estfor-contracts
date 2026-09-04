// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";

contract ReconciliationCodeDeployment is Script {
  function deployCode(
    string calldata fullyQualifiedName,
    address expectedAddress,
    bytes calldata constructorData
  ) external returns (address deployed) {
    bytes memory creationCode = abi.encodePacked(vm.getCode(fullyQualifiedName), constructorData);

    vm.startBroadcast(vm.envUint("PROPOSER_PRIVATE_KEY"));
    assembly ("memory-safe") {
      deployed := create(0, add(creationCode, 32), mload(creationCode))
    }
    vm.stopBroadcast();

    require(deployed == expectedAddress, "Unexpected deployment address");
  }
}
