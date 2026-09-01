// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "./utils/FullGameStack.sol";
import {Clans} from "./interfaces/Clans.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract FullGameStackTest is FullGameStack {
    function testFullGameDeploysWithWiring() public {
        deployFullGame();

        assertEq(playerId, 1);
        assertEq(playerNFT.balanceOf(ALICE, playerId), 1);

        assertEq(players.owner(), address(this));
        assertEq(playerNFT.owner(), address(this));
        assertEq(itemNFT.owner(), address(this));
        assertEq(petNFT.owner(), address(this));
        assertEq(clans.owner(), address(this));
        assertEq(quests.owner(), address(this));
        assertEq(shop.owner(), address(this));
        assertEq(treasury.owner(), address(this));
        assertEq(activityPoints.owner(), address(this));
        assertEq(territories.owner(), address(this));
        assertEq(lockedBankVaults.owner(), address(this));
        assertEq(raids.owner(), address(this));
        assertEq(pvpBattleground.owner(), address(this));
        assertEq(promotions.owner(), address(this));
        assertEq(instantActions.owner(), address(this));
        assertEq(instantVRFActions.owner(), address(this));
        assertEq(bankFactory.owner(), address(this));
        assertEq(bankRegistry.owner(), address(this));
        assertEq(cosmetics.owner(), address(this));
        assertEq(globalEvents.owner(), address(this));
        assertEq(bridge.owner(), address(this));
        assertEq(gameSubsidisationRegistry.owner(), address(this));
        assertEq(usageBasedSessionModule.owner(), address(this));

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
