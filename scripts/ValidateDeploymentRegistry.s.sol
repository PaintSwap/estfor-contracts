// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

/// @notice Validates stable addresses and Safe ownership for a tracked deployment.
contract ValidateDeploymentRegistry is Script {
    string private registryJson;
    address private safe;

    function run() external {
        registryJson = vm.readFile(vm.envString("DEPLOYMENT_INPUT"));
        require(vm.parseJsonUint(registryJson, ".chainId") == block.chainid, "deployment chain id mismatch");
        require(
            vm.parseJsonUint(registryJson, ".deploymentBlock") <= block.number, "deployment block is ahead of chain"
        );

        string memory genesisJson = vm.rpcJson("eth_getBlockByNumber", '["0x0",false]');
        require(
            keccak256(bytes(vm.parseJsonString(genesisJson, ".hash")))
                == keccak256(bytes(vm.parseJsonString(registryJson, ".networkFingerprint.genesisHash"))),
            "network fingerprint mismatch"
        );

        require(
            keccak256(bytes(vm.parseJsonString(registryJson, ".authority.type"))) == keccak256("safe"),
            "authority is not Safe"
        );
        safe = vm.parseJsonAddress(registryJson, ".authority.address");
        require(safe.code.length != 0, "Safe has no code");
        address[] memory owners = _safeOwners();
        uint256 threshold = _safeThreshold();
        require(threshold >= 2 && owners.length >= threshold, "authority is not multisignature Safe");

        string[] memory contractNames = vm.parseJsonKeys(registryJson, ".contracts");
        for (uint256 i; i < contractNames.length; ++i) {
            address deployedContract = _contractAddress(contractNames[i]);
            require(deployedContract.code.length != 0, string.concat("contract has no code: ", contractNames[i]));
        }

        string[] memory externalNames = vm.parseJsonKeys(registryJson, ".externals");
        for (uint256 i; i < externalNames.length; ++i) {
            address externalContract = vm.parseJsonAddress(registryJson, string.concat(".externals.", externalNames[i]));
            require(externalContract.code.length != 0, string.concat("external has no code: ", externalNames[i]));
        }

        for (uint256 i; i < contractNames.length; ++i) {
            _validateOwner(contractNames[i]);
        }

        console2.log("Validated deployment", vm.parseJsonString(registryJson, ".deploymentId"));
        console2.log("Chain", block.chainid);
        console2.log("Contracts", contractNames.length);
        console2.log("Externals", externalNames.length);
        console2.log("Safe", safe);
        console2.log("Safe threshold", threshold);
        console2.log("Safe owners", owners.length);
    }

    function _contractAddress(string memory name) private view returns (address) {
        return vm.parseJsonAddress(registryJson, string.concat(".contracts.", name, ".address"));
    }

    function _validateOwner(string memory name) private view {
        string memory path = string.concat(".contracts.", name);
        bytes32 kind = keccak256(bytes(vm.parseJsonString(registryJson, string.concat(path, ".kind"))));
        if (kind == keccak256("uups") || kind == keccak256("beacon")) {
            address deployedContract = _contractAddress(name);
            (bool success, bytes memory result) = deployedContract.staticcall(abi.encodeWithSignature("owner()"));
            require(success && result.length == 32, string.concat("owner read failed: ", name));
            require(abi.decode(result, (address)) == safe, string.concat("owner is not Safe: ", name));
        }
    }

    function _safeOwners() private view returns (address[] memory owners) {
        (bool success, bytes memory result) = safe.staticcall(abi.encodeWithSignature("getOwners()"));
        require(success, "Safe owner read failed");
        owners = abi.decode(result, (address[]));
    }

    function _safeThreshold() private view returns (uint256 threshold) {
        (bool success, bytes memory result) = safe.staticcall(abi.encodeWithSignature("getThreshold()"));
        require(success && result.length == 32, "Safe threshold read failed");
        threshold = abi.decode(result, (uint256));
    }
}
