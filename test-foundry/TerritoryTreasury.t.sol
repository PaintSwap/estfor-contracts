// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {TerritoryTreasury} from "../contracts/Clans/TerritoryTreasury.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {MockTerritories} from "../contracts/test/MockTerritories.sol";

contract PlayerBalanceStub {
    mapping(address account => mapping(uint256 playerId => uint256 balance)) private _balances;

    function setBalance(address account, uint256 playerId, uint256 balance) external {
        _balances[account][playerId] = balance;
    }

    function balanceOf(address account, uint256 playerId) external view returns (uint256) {
        return _balances[account][playerId];
    }
}

contract TerritoryTreasuryTest is EstforTest {
    uint16 private constant MIN_HARVEST_INTERVAL = 13_500;
    uint256 private constant PLAYER_ID = 1;

    MockTerritories private territories;
    TerritoryTreasury private territoryTreasury;

    function setUp() public {
        _deployTreasuryStack();
        territories = new MockTerritories(IBrushToken(address(brush)));

        PlayerBalanceStub playerNFT = new PlayerBalanceStub();
        playerNFT.setBalance(ALICE, PLAYER_ID, 1);

        TerritoryTreasury territoryTreasuryImplementation = new TerritoryTreasury();
        territoryTreasury = TerritoryTreasury(
            _deployUUPS(
                address(territoryTreasuryImplementation),
                abi.encodeCall(
                    territoryTreasuryImplementation.initialize,
                    (
                        territories,
                        IBrushToken(address(brush)),
                        IERC1155(address(playerNFT)),
                        DEV,
                        treasury,
                        MIN_HARVEST_INTERVAL
                    )
                )
            )
        );

        treasury.setSpenders(_addresses(address(territoryTreasury), SHOP), true);
        treasury.setFundAllocationPercentages(_addresses(SHOP, address(territoryTreasury)), _uints(10, 90));
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
