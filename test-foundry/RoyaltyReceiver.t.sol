// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {RoyaltyReceiver} from "../contracts/RoyaltyReceiver.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {ISolidlyRouter} from "../contracts/interfaces/external/ISolidlyRouter.sol";
import {MockBrushToken} from "../contracts/test/external/MockBrushToken.sol";
import {MockRouter} from "../contracts/test/external/MockRouter.sol";

contract RoyaltyReceiverTest is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant TREASURY = address(0x7EA5);
    address private constant DEV = address(0xDE7);

    MockBrushToken private brush;
    RoyaltyReceiver private royaltyReceiver;

    function setUp() public {
        brush = new MockBrushToken();
        MockRouter router = new MockRouter();
        RoyaltyReceiver implementation = new RoyaltyReceiver();
        royaltyReceiver = RoyaltyReceiver(
            payable(address(
                    new ERC1967Proxy(
                        address(implementation),
                        abi.encodeCall(
                            implementation.initialize,
                            (ISolidlyRouter(address(router)), TREASURY, DEV, IBrushToken(address(brush)), address(this))
                        )
                    )
                ))
        );
    }

    function testCheckRecipients() public {
        vm.deal(ALICE, 100);
        uint256 beforeBalance = DEV.balance;

        vm.prank(ALICE);
        (bool success,) = address(royaltyReceiver).call{value: 100}("");

        assertTrue(success);
        assertEq(DEV.balance, beforeBalance + 33);
        assertEq(brush.balanceOf(TREASURY), 6);
    }

    function testDistributeBrush() public {
        assertEq(brush.balanceOf(TREASURY), 0);
        brush.mint(address(royaltyReceiver), 100);

        royaltyReceiver.distributeBrush();

        assertEq(brush.balanceOf(TREASURY), 100);
    }
}
