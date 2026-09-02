// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {MockBrushToken} from "../contracts/test/external/MockBrushToken.sol";
import {WrappedNative} from "../contracts/test/external/MockWrappedNative.sol";
import {MockVRF} from "../contracts/test/MockVRF.sol";
import {MockRouter} from "../contracts/test/external/MockRouter.sol";
import {MockPaintSwapMarketplaceWhitelist} from "../contracts/test/external/MockPaintSwapMarketplaceWhitelist.sol";
import {MockUSDCToken} from "../contracts/test/external/MockUSDCToken.sol";
import {EndpointV2Mock} from "@layerzerolabs/test-devtools-evm-foundry/contracts/mocks/EndpointV2Mock.sol";

/// @notice Broadcasts local substitutes for the external contracts required by DeployGame.
/// @dev This is a CI-only prerequisite fixture. DeployGame itself always receives existing addresses.
contract LocalAnvilDependencies is Script {
  function run() external {
    uint256 privateKey = vm.envUint("PRIVATE_KEY");
    address owner = vm.addr(privateKey);

    vm.startBroadcast(privateKey);
    MockBrushToken brush = new MockBrushToken();
    brush.mint(owner, 10_000_000 ether);
    WrappedNative wftm = new WrappedNative();
    MockVRF vrf = new MockVRF();
    MockRouter router = new MockRouter();
    MockPaintSwapMarketplaceWhitelist marketplaceWhitelist = new MockPaintSwapMarketplaceWhitelist();
    MockUSDCToken usdc = new MockUSDCToken();
    usdc.mint(owner, 10_000_000 ether);
    EndpointV2Mock lzEndpoint = new EndpointV2Mock(30112, owner);
    vm.stopBroadcast();

    string memory json = vm.serializeAddress("dependencies", "owner", owner);
    json = vm.serializeAddress("dependencies", "brush", address(brush));
    json = vm.serializeAddress("dependencies", "wftm", address(wftm));
    json = vm.serializeAddress("dependencies", "vrf", address(vrf));
    json = vm.serializeAddress("dependencies", "router", address(router));
    json = vm.serializeAddress("dependencies", "paintSwapMarketplaceWhitelist", address(marketplaceWhitelist));
    json = vm.serializeAddress("dependencies", "usdc", address(usdc));
    json = vm.serializeAddress("dependencies", "lzEndpoint", address(lzEndpoint));
    vm.writeJson(json, vm.envOr("DEPENDENCIES_OUTPUT", string(".deployments/local-dependencies.json")));
  }
}
