// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "./utils/FullGameStack.sol";
import {IClans as Clans} from "../contracts/interfaces/IClans.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {IERC5313} from "@openzeppelin/contracts/interfaces/IERC5313.sol";

contract FullGameStackTest is FullGameStack {
    function testFullGameDeploysWithWiring() public {
        deployFullGame();

        assertEq(playerId, 1);
        assertEq(playerNFT.balanceOf(ALICE, playerId), 1);

        assertEq(IERC5313(address(players)).owner(), address(this));
        assertEq(IERC5313(address(playerNFT)).owner(), address(this));
        assertEq(itemNFT.owner(), address(this));
        assertEq(IERC5313(address(petNFT)).owner(), address(this));
        assertEq(IERC5313(address(clans)).owner(), address(this));
        assertEq(IERC5313(address(quests)).owner(), address(this));
        assertEq(shop.owner(), address(this));
        assertEq(treasury.owner(), address(this));
        assertEq(activityPoints.owner(), address(this));
        assertEq(IERC5313(address(territories)).owner(), address(this));
        assertEq(IERC5313(address(lockedBankVaults)).owner(), address(this));
        assertEq(IERC5313(address(raids)).owner(), address(this));
        assertEq(IERC5313(address(pvpBattleground)).owner(), address(this));
        assertEq(IERC5313(address(promotions)).owner(), address(this));
        assertEq(IERC5313(address(instantActions)).owner(), address(this));
        assertEq(IERC5313(address(instantVRFActions)).owner(), address(this));
        assertEq(bankFactory.owner(), address(this));
        assertEq(bankRegistry.owner(), address(this));
        assertEq(cosmetics.owner(), address(this));
        assertEq(globalEvents.owner(), address(this));
        assertEq(IERC5313(address(bridge)).owner(), address(this));
        assertEq(gameSubsidisationRegistry.owner(), address(this));
        assertEq(IERC5313(address(usageBasedSessionModule)).owner(), address(this));

        assertTrue(UpgradeableBeacon(bank).implementation().code.length > 0);
        assertEq(UpgradeableBeacon(bank).owner(), address(this));

        assertTrue(bankRegistry.isForceItemDepositor(address(raids)));
        assertTrue(bankRegistry.isForceItemDepositor(address(activityPoints)));

        assertEq(address(raids).balance, 10 ether);
        assertEq(treasury.totalClaimable(address(shop)), 0);
    }

    function testFullGameSupportsClanCreation() public {
        deployFullGame();

        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] =
            Clans.Tier({id: 1, maxMemberCapacity: 3, maxBankCapacity: 3, maxImageId: 16, minimumAge: 0, price: 0});
        clans.addTiers(tiers);
        assertEq(clans.getTier(1).id, 1);

        vm.prank(ALICE);
        clans.createClan(playerId, "Clan 1", "G4ZgtP52JK", "fantomfoundation", "fantomfdn", 2, 1);

        assertEq(bankFactory.getBankAddress(1), clans.getClanBankAddress(1));
        assertTrue(bankFactory.getBankAddress(1) != address(0));
    }
}
