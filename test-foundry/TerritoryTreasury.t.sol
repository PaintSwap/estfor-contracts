// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {TerritoryTreasury} from "../contracts/Clans/TerritoryTreasury.sol";
import {Treasury} from "../contracts/Treasury.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {MockTerritories} from "../contracts/test/MockTerritories.sol";
import {MockBrushToken} from "../contracts/test/external/MockBrushToken.sol";

contract PlayerBalanceStub {
    mapping(address account => mapping(uint256 playerId => uint256 balance)) private _balances;

    function setBalance(address account, uint256 playerId, uint256 balance) external {
        _balances[account][playerId] = balance;
    }

    function balanceOf(address account, uint256 playerId) external view returns (uint256) {
        return _balances[account][playerId];
    }
}

contract TerritoryTreasuryTest is Test {
    uint16 private constant MIN_HARVEST_INTERVAL = 13_500;
    uint256 private constant PLAYER_ID = 1;
    address private constant ALICE = address(0xA11CE);
    address private constant DEV = address(0xDE7);
    address private constant SHOP = address(0x5A0F);

    MockBrushToken private brush;
    MockTerritories private territories;
    Treasury private treasury;
    TerritoryTreasury private territoryTreasury;

    function setUp() public {
        brush = new MockBrushToken();
        IBrushToken brushToken = IBrushToken(address(brush));
        territories = new MockTerritories(brushToken);

        Treasury treasuryImplementation = new Treasury();
        treasury = Treasury(
            address(
                new ERC1967Proxy(
                    address(treasuryImplementation), abi.encodeCall(treasuryImplementation.initialize, (brushToken))
                )
            )
        );

        PlayerBalanceStub playerNFT = new PlayerBalanceStub();
        playerNFT.setBalance(ALICE, PLAYER_ID, 1);

        TerritoryTreasury territoryTreasuryImplementation = new TerritoryTreasury();
        territoryTreasury = TerritoryTreasury(
            address(
                new ERC1967Proxy(
                    address(territoryTreasuryImplementation),
                    abi.encodeCall(
                        territoryTreasuryImplementation.initialize,
                        (territories, brushToken, IERC1155(address(playerNFT)), DEV, treasury, MIN_HARVEST_INTERVAL)
                    )
                )
            )
        );

        address[] memory spenders = new address[](2);
        spenders[0] = address(territoryTreasury);
        spenders[1] = SHOP;
        treasury.setSpenders(spenders, true);

        address[] memory accounts = new address[](2);
        accounts[0] = SHOP;
        accounts[1] = address(territoryTreasury);
        uint256[] memory percentages = new uint256[](2);
        percentages[0] = 10;
        percentages[1] = 90;
        treasury.setFundAllocationPercentages(accounts, percentages);
    }

    function testHarvestRewardsWithATreasury() public {
        brush.mint(address(treasury), 1_000);

        vm.prank(ALICE);
        territoryTreasury.harvest(PLAYER_ID);

        assertEq(brush.balanceOf(address(territories)), 9);
    }

    function testCannotReharvestTooQuickly() public {
        brush.mint(address(treasury), 1_000);

        vm.prank(ALICE);
        territoryTreasury.harvest(PLAYER_ID);

        vm.expectRevert(TerritoryTreasury.HarvestingTooSoon.selector);
        vm.prank(ALICE);
        territoryTreasury.harvest(PLAYER_ID);

        vm.warp(block.timestamp + MIN_HARVEST_INTERVAL);
        vm.prank(ALICE);
        territoryTreasury.harvest(PLAYER_ID);
    }

    function testPendingBrush() public {
        brush.mint(address(treasury), 1_000);

        assertEq(territoryTreasury.pendingBrush(), 9);
    }

    // Mirrors the existing Hardhat placeholder so the candidate has one-for-one test parity.
    function testTODOHarvestingTooMuchError() public {}
}
