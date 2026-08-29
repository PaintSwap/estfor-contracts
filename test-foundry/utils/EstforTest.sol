// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {RandomnessBeacon} from "../../contracts/RandomnessBeacon.sol";
import {Treasury} from "../../contracts/Treasury.sol";
import {IBrushToken} from "../../contracts/interfaces/external/IBrushToken.sol";
import {IOracleCB} from "../../contracts/interfaces/IOracleCB.sol";
import {MockBrushToken} from "../../contracts/test/external/MockBrushToken.sol";
import {MockOracleCB} from "../../contracts/test/MockOracleCB.sol";
import {MockVRF} from "../../contracts/test/MockVRF.sol";

abstract contract EstforTest is Test {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant DEV = address(0xDE7);
    address internal constant SHOP = address(0x5A0F);

    RandomnessBeacon internal randomnessBeacon;
    MockVRF internal mockVRF;
    MockBrushToken internal brush;
    Treasury internal treasury;

    function _deployUUPS(address implementation, bytes memory initializeData) internal returns (address proxy) {
        proxy = address(new ERC1967Proxy(implementation, initializeData));
    }

    function _deployBeaconStack() internal {
        vm.warp(20 weeks);
        mockVRF = new MockVRF();
        RandomnessBeacon implementation = new RandomnessBeacon();
        randomnessBeacon = RandomnessBeacon(
            payable(
                address(
                    new ERC1967Proxy(
                        address(implementation), abi.encodeCall(implementation.initialize, (address(mockVRF)))
                    )
                )
            )
        );
        vm.deal(address(randomnessBeacon), 1 ether);
    }

    function _initializeBeaconRandomWords(MockOracleCB oracleCB, IOracleCB rewardsRequester) internal {
        randomnessBeacon.initializeAddresses(IOracleCB(address(oracleCB)), rewardsRequester);
        randomnessBeacon.initializeRandomWords();
    }

    function _deployTreasuryStack() internal {
        brush = new MockBrushToken();
        Treasury implementation = new Treasury();
        treasury = Treasury(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(implementation.initialize, (IBrushToken(address(brush))))
                )
            )
        );
    }

    function _addresses(address a) internal pure returns (address[] memory values) {
        values = new address[](1);
        values[0] = a;
    }

    function _addresses(address a, address b) internal pure returns (address[] memory values) {
        values = new address[](2);
        values[0] = a;
        values[1] = b;
    }

    function _addresses(address a, address b, address c) internal pure returns (address[] memory values) {
        values = new address[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }

    function _uints(uint256 a) internal pure returns (uint256[] memory values) {
        values = new uint256[](1);
        values[0] = a;
    }

    function _uints(uint256 a, uint256 b) internal pure returns (uint256[] memory values) {
        values = new uint256[](2);
        values[0] = a;
        values[1] = b;
    }

    function _uints(uint256 a, uint256 b, uint256 c) internal pure returns (uint256[] memory values) {
        values = new uint256[](3);
        values[0] = a;
        values[1] = b;
        values[2] = c;
    }
}
