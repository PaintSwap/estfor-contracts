// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {FullGameStack} from "../utils/FullGameStack.sol";
import {Clans} from "../../contracts/Clans/Clans.sol";
import {ClanRank} from "../../contracts/globals/clans.sol";
import {TestERC1155NoRoyalty} from "../../contracts/test/TestERC1155NoRoyalty.sol";
import {TestERC721} from "../../contracts/test/TestERC721.sol";

contract ClansTest is FullGameStack {
    uint256 internal constant CLAN_ID = 1;
    uint16 internal constant IMAGE_ID = 2;
    uint8 internal constant TIER_ID = 1;
    string internal constant DISCORD = "G4ZgtP52JK";
    string internal constant TELEGRAM = "fantomfoundation";
    string internal constant TWITTER = "fantomfdn";

    uint256 internal bobPlayerId;
    uint256 internal charliePlayerId;
    uint256 internal devPlayerId;

    function setUp() public {
        deployFullGame();
        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(TIER_ID, 3, 3, 16, 0, 0);
        clans.addTiers(tiers);
        vm.prank(ALICE);
        clans.createClan(playerId, "Clan 1", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);
        bobPlayerId = _createPlayer(BOB, 1, "bob", true);
        charliePlayerId = _createPlayer(CHARLIE, 1, "charlie", true);
        devPlayerId = _createPlayer(DEV, 1, "dev", true);
    }

    function testNewClan() public {
        (
            uint64 ownerPlayerId,
            uint16 imageId,
            uint16 memberCount,
            uint40 createdTimestamp,
            uint8 tierId,,
            uint16 mmr,
            string memory name,
        ) = clans.getClan(CLAN_ID);
        assertEq(ownerPlayerId, playerId);
        assertEq(memberCount, 1);
        assertEq(imageId, IMAGE_ID);
        assertEq(tierId, TIER_ID);
        assertEq(name, "Clan 1");
        assertEq(mmr, INITIAL_MMR);
        assertEq(createdTimestamp, vm.getBlockTimestamp());
        Clans.Tier memory tier = clans.getTier(TIER_ID);
        assertEq(tier.maxMemberCapacity, 3);
        assertEq(tier.maxBankCapacity, 3);
        assertTrue(clans.canWithdraw(CLAN_ID, playerId));
        assertTrue(clans.isClanMember(CLAN_ID, playerId));
        assertFalse(clans.hasInviteRequest(CLAN_ID, playerId));

        Clans.PlayerInfo memory player = clans.getPlayerInfo(playerId);
        assertEq(player.clanId, CLAN_ID);
        assertEq(player.requestedClanId, 0);
    }

    function testCannotCreateAClanIfAlreadyInAnother() public {
        vm.prank(ALICE);
        vm.expectRevert(Clans.AlreadyInClan.selector);
        clans.createClan(playerId, "Another clan", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);
    }

    function testCannotCreateAClanWithTheSameName() public {
        vm.prank(BOB);
        vm.expectRevert(Clans.NameAlreadyExists.selector);
        clans.createClan(bobPlayerId, "Clan 1", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);
    }

    function testCannotCreateAClanWithInvalidName() public {
        vm.prank(BOB);
        vm.expectRevert(Clans.NameInvalidCharacters.selector);
        clans.createClan(bobPlayerId, unicode" uhh$£", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);
    }

    function testCannotCreateAClanWithInvalidSocialMediaHandles() public {
        string memory anotherName = "Another name";
        vm.startPrank(BOB);
        vm.expectRevert(Clans.DiscordInvalidCharacters.selector);
        clans.createClan(bobPlayerId, anotherName, unicode"uhh$£", TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);
        vm.expectRevert(Clans.DiscordTooShort.selector);
        clans.createClan(bobPlayerId, anotherName, "12", TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);
        vm.expectRevert(Clans.DiscordTooLong.selector);
        clans.createClan(bobPlayerId, anotherName, "01234567890123456789012345", TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);
        vm.expectRevert(Clans.TelegramInvalidCharacters.selector);
        clans.createClan(bobPlayerId, anotherName, DISCORD, unicode"uhh$£", TWITTER, IMAGE_ID, TIER_ID);
        vm.expectRevert(Clans.TelegramTooLong.selector);
        clans.createClan(bobPlayerId, anotherName, DISCORD, "01234567890123456789012345", TWITTER, IMAGE_ID, TIER_ID);
        vm.expectRevert(Clans.TwitterInvalidCharacters.selector);
        clans.createClan(bobPlayerId, anotherName, DISCORD, TELEGRAM, unicode"uhh$£", IMAGE_ID, TIER_ID);
        vm.expectRevert(Clans.TwitterTooLong.selector);
        clans.createClan(bobPlayerId, anotherName, DISCORD, TELEGRAM, "01234567890123456789012345", IMAGE_ID, TIER_ID);
        vm.stopPrank();
    }

    function testAllowedToCreateAClanWithEmptyDiscord() public {
        vm.prank(BOB);
        clans.createClan(bobPlayerId, "Another name", "", TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);
    }

    function testAllowedToCreateAClanWithEmptyTelegram() public {
        vm.prank(BOB);
        clans.createClan(bobPlayerId, "Another name", DISCORD, "", TWITTER, IMAGE_ID, TIER_ID);
    }

    function testAllowedToCreateAClanWithEmptyTwitter() public {
        vm.prank(BOB);
        clans.createClan(bobPlayerId, "Another name", DISCORD, TELEGRAM, "", IMAGE_ID, TIER_ID);
    }

    function testAllowedToCreateAClanIfThereIsAPendingRequestElsewhere() public {
        vm.prank(ALICE);
        vm.expectRevert(Clans.AlreadyInClan.selector);
        clans.requestToJoin(CLAN_ID, playerId, 0);
        vm.prank(BOB);
        vm.expectRevert(Clans.ClanDoesNotExist.selector);
        clans.requestToJoin(CLAN_ID + 1, bobPlayerId, 0);

        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);
        Clans.PlayerInfo memory player = clans.getPlayerInfo(bobPlayerId);
        assertEq(player.clanId, 0);
        assertEq(player.requestedClanId, CLAN_ID);

        vm.expectEmit(true, true, true, true, address(clans));
        emit Clans.JoinRequestRemoved(CLAN_ID, bobPlayerId);
        vm.prank(BOB);
        clans.createClan(bobPlayerId, "Clan 11", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);

        player = clans.getPlayerInfo(bobPlayerId);
        assertEq(player.clanId, CLAN_ID + 1);
        assertEq(player.requestedClanId, 0);
    }

    function testInviteAPlayerToAClan() public {
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId), playerId);
        assertTrue(clans.hasInviteRequest(CLAN_ID, bobPlayerId));
        assertFalse(clans.hasInviteRequest(CLAN_ID, playerId));

        vm.prank(ALICE);
        vm.expectRevert(Clans.NotOwnerOfPlayerAndActive.selector);
        clans.acceptInvite(CLAN_ID, bobPlayerId, 0);
        vm.prank(BOB);
        clans.acceptInvite(CLAN_ID, bobPlayerId, 0);

        assertFalse(clans.canWithdraw(CLAN_ID, bobPlayerId));
        assertTrue(clans.isClanMember(CLAN_ID, bobPlayerId));
        Clans.PlayerInfo memory player = clans.getPlayerInfo(bobPlayerId);
        assertEq(player.clanId, CLAN_ID);
        assertEq(player.requestedClanId, 0);
    }

    function testInviteMultiplePlayersToAClan() public {
        vm.prank(ALICE);
        vm.expectRevert(Clans.ClanIsFull.selector);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId, charliePlayerId, devPlayerId), playerId);
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId, charliePlayerId), playerId);
        assertTrue(clans.hasInviteRequest(CLAN_ID, bobPlayerId));
        assertTrue(clans.hasInviteRequest(CLAN_ID, charliePlayerId));
        assertFalse(clans.hasInviteRequest(CLAN_ID, playerId));
        assertFalse(clans.hasInviteRequest(CLAN_ID, devPlayerId));
    }

    function testCannotAcceptAnInviteThatDoesNotExist() public {
        vm.prank(BOB);
        vm.expectRevert(Clans.InviteDoesNotExist.selector);
        clans.acceptInvite(CLAN_ID, bobPlayerId, 0);
    }

    function testCannotInviteAPlayerToAClanIfYouAreNotAtLeastAScout() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.COMMONER, playerId);
        assertEq(uint8(clans.getPlayerInfo(playerId).rank), uint8(ClanRank.COMMONER));
        vm.prank(ALICE);
        vm.expectRevert(Clans.RankNotHighEnough.selector);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId), playerId);
    }

    function testCannotAcceptAnInviteIfYouAreAlreadyInAClan() public {
        vm.prank(BOB);
        clans.createClan(bobPlayerId, "bob", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, 1);
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId), playerId);
        vm.prank(BOB);
        vm.expectRevert(Clans.AlreadyInClan.selector);
        clans.acceptInvite(CLAN_ID, bobPlayerId, 0);
    }

    function testDeleteInvitesAsAPlayer() public {
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId), playerId);
        vm.prank(BOB);
        clans.acceptInvite(CLAN_ID, bobPlayerId, 0);

        vm.prank(BOB);
        vm.expectRevert(Clans.InviteDoesNotExist.selector);
        clans.deleteInvitesAsPlayer(_uints(CLAN_ID), bobPlayerId);

        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(charliePlayerId), playerId);

        vm.prank(BOB);
        vm.expectRevert(Clans.NotOwnerOfPlayer.selector);
        clans.deleteInvitesAsPlayer(_uints(CLAN_ID), charliePlayerId);

        vm.expectEmit(true, true, true, true, address(clans));
        emit Clans.InvitesDeletedByPlayer(_uints(CLAN_ID), charliePlayerId);
        vm.prank(CHARLIE);
        clans.deleteInvitesAsPlayer(_uints(CLAN_ID), charliePlayerId);
        assertFalse(clans.hasInviteRequest(CLAN_ID, charliePlayerId));
    }

    function testDeleteInvitesAsAClan() public {
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId), playerId);
        vm.prank(BOB);
        clans.acceptInvite(CLAN_ID, bobPlayerId, 0);
        assertFalse(clans.hasInviteRequest(CLAN_ID, bobPlayerId));

        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(charliePlayerId), playerId);

        vm.prank(CHARLIE);
        vm.expectRevert(Clans.NotMemberOfClan.selector);
        clans.deleteInvitesAsClan(CLAN_ID, _playerIds(charliePlayerId), charliePlayerId);

        vm.prank(BOB);
        vm.expectRevert(Clans.RankNotHighEnough.selector);
        clans.deleteInvitesAsClan(CLAN_ID, _playerIds(charliePlayerId), bobPlayerId);

        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.SCOUT, playerId);
        vm.expectEmit(true, true, true, true, address(clans));
        emit Clans.InvitesDeletedByClan(CLAN_ID, _uints(charliePlayerId), bobPlayerId);
        vm.prank(BOB);
        clans.deleteInvitesAsClan(CLAN_ID, _uints(charliePlayerId), bobPlayerId);
        assertFalse(clans.hasInviteRequest(CLAN_ID, charliePlayerId));
    }

    function testAcceptMultipleJoinRequests() public {
        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);
        vm.prank(CHARLIE);
        clans.requestToJoin(CLAN_ID, charliePlayerId, 0);
        vm.prank(DEV);
        clans.requestToJoin(CLAN_ID, devPlayerId, 0);

        vm.prank(ALICE);
        vm.expectRevert(Clans.ClanIsFull.selector);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId, charliePlayerId, devPlayerId), playerId);
        vm.expectRevert(Clans.NotOwnerOfPlayerAndActive.selector);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId, charliePlayerId, devPlayerId), playerId);

        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId, charliePlayerId), playerId);
        assertTrue(clans.isClanMember(CLAN_ID, bobPlayerId));
        assertTrue(clans.isClanMember(CLAN_ID, charliePlayerId));
        assertFalse(clans.isClanMember(CLAN_ID, devPlayerId));
    }

    function testRemoveJoinRequestAsPlayer() public {
        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);
        vm.prank(CHARLIE);
        clans.requestToJoin(CLAN_ID, charliePlayerId, 0);

        assertEq(clans.getPlayerInfo(bobPlayerId).requestedClanId, CLAN_ID);
        vm.prank(BOB);
        clans.removeJoinRequest(CLAN_ID, bobPlayerId);
        assertEq(clans.getPlayerInfo(bobPlayerId).requestedClanId, 0);
        assertEq(clans.getPlayerInfo(charliePlayerId).requestedClanId, CLAN_ID);
    }

    function testRemoveJoinRequestsAsClan() public {
        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);
        vm.prank(CHARLIE);
        clans.requestToJoin(CLAN_ID, charliePlayerId, 0);
        vm.prank(DEV);
        clans.requestToJoin(CLAN_ID, devPlayerId, 0);

        assertEq(clans.getPlayerInfo(bobPlayerId).requestedClanId, CLAN_ID);
        assertEq(clans.getPlayerInfo(charliePlayerId).requestedClanId, CLAN_ID);
        assertEq(clans.getPlayerInfo(devPlayerId).requestedClanId, CLAN_ID);

        vm.prank(ALICE);
        vm.expectRevert(Clans.NoJoinRequest.selector);
        clans.removeJoinRequestsAsClan(CLAN_ID, _playerIds(charliePlayerId, charliePlayerId), playerId);

        vm.expectRevert(Clans.NotOwnerOfPlayer.selector);
        clans.removeJoinRequestsAsClan(CLAN_ID, _playerIds(charliePlayerId), playerId);

        vm.prank(ALICE);
        clans.removeJoinRequestsAsClan(CLAN_ID, _playerIds(devPlayerId, charliePlayerId), playerId);

        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.COMMONER, playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.RankNotHighEnough.selector);
        clans.removeJoinRequestsAsClan(CLAN_ID, _playerIds(bobPlayerId), playerId);

        assertEq(clans.getPlayerInfo(bobPlayerId).requestedClanId, CLAN_ID);
        assertEq(clans.getPlayerInfo(charliePlayerId).requestedClanId, 0);
        assertEq(clans.getPlayerInfo(devPlayerId).requestedClanId, 0);
    }

    function testDisableJoinRequestsToClan() public {
        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);

        vm.expectRevert(Clans.NotOwnerOfPlayer.selector);
        clans.setJoinRequestsEnabled(CLAN_ID, false, playerId);

        vm.prank(ALICE);
        clans.setJoinRequestsEnabled(CLAN_ID, false, playerId);

        vm.prank(CHARLIE);
        vm.expectRevert(Clans.JoinRequestsDisabled.selector);
        clans.requestToJoin(CLAN_ID, charliePlayerId, 0);

        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.COMMONER, playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.RankNotHighEnough.selector);
        clans.setJoinRequestsEnabled(CLAN_ID, false, playerId);

        vm.expectRevert(Clans.NotOwnerOfPlayer.selector);
        clans.setJoinRequestsEnabled(CLAN_ID, false, playerId);
    }

    function testMustBeAMemberToBePromotedToAdmin() public {
        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);

        vm.prank(ALICE);
        vm.expectRevert(Clans.NotMemberOfClan.selector);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.TREASURER, playerId);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId), playerId);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.TREASURER, playerId);

        assertTrue(clans.canWithdraw(CLAN_ID, bobPlayerId));
        assertTrue(clans.isClanMember(CLAN_ID, bobPlayerId));
        Clans.PlayerInfo memory player = clans.getPlayerInfo(bobPlayerId);
        assertEq(player.clanId, CLAN_ID);
        assertEq(player.requestedClanId, 0);
    }

    function testOnlyOwnerCanAddNewTreasurers() public {
        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);

        vm.prank(ALICE);
        vm.expectRevert(Clans.NotMemberOfClan.selector);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.TREASURER, playerId);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId), playerId);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.TREASURER, playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.CannotSetSameRank.selector);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.TREASURER, playerId);

        assertTrue(clans.canWithdraw(CLAN_ID, bobPlayerId));
        assertTrue(clans.isClanMember(CLAN_ID, bobPlayerId));
        Clans.PlayerInfo memory player = clans.getPlayerInfo(bobPlayerId);
        assertEq(player.clanId, CLAN_ID);
        assertEq(player.requestedClanId, 0);

        vm.prank(CHARLIE);
        clans.requestToJoin(CLAN_ID, charliePlayerId, 0);
        vm.prank(BOB);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(charliePlayerId), bobPlayerId);
        vm.expectRevert(Clans.NotOwnerOfPlayer.selector);
        clans.changeRank(CLAN_ID, charliePlayerId, ClanRank.TREASURER, charliePlayerId);
    }

    function testScoutsAndAboveCanChangesMembersBelowThemInRank() public {
        vm.prank(DEV);
        clans.requestToJoin(CLAN_ID, devPlayerId, 0);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(devPlayerId), playerId);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, devPlayerId, ClanRank.SCOUT, playerId);

        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);
        vm.prank(DEV);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId), devPlayerId);
        assertTrue(clans.isClanMember(CLAN_ID, bobPlayerId));
        vm.expectRevert(Clans.NotOwnerOfPlayer.selector);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.SCOUT, playerId);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.SCOUT, playerId);

        vm.prank(DEV);
        vm.expectRevert(Clans.ChangingRankEqualOrHigherThanSelf.selector);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.SCOUT, devPlayerId);

        vm.prank(DEV);
        clans.changeRank(CLAN_ID, devPlayerId, ClanRank.COMMONER, devPlayerId);
        assertFalse(clans.canWithdraw(CLAN_ID, devPlayerId));
        assertTrue(clans.isClanMember(CLAN_ID, devPlayerId));

        vm.prank(BOB);
        clans.changeRank(CLAN_ID, devPlayerId, ClanRank.NONE, bobPlayerId);

        vm.prank(CHARLIE);
        clans.requestToJoin(CLAN_ID, charliePlayerId, 0);
        vm.prank(BOB);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(charliePlayerId), bobPlayerId);
        vm.prank(DEV);
        vm.expectRevert(Clans.ChangingRankEqualOrHigherThanSelf.selector);
        clans.changeRank(CLAN_ID, charliePlayerId, ClanRank.NONE, devPlayerId);

        vm.prank(BOB);
        clans.changeRank(CLAN_ID, charliePlayerId, ClanRank.NONE, bobPlayerId);

        assertFalse(clans.canWithdraw(CLAN_ID, devPlayerId));
        assertFalse(clans.isClanMember(CLAN_ID, devPlayerId));
        Clans.PlayerInfo memory player = clans.getPlayerInfo(devPlayerId);
        assertEq(player.clanId, 0);
        assertEq(player.requestedClanId, 0);
    }

    function testCheckMaxCapacityOfAddedMembers() public {
        uint256 maxMemberCapacity = clans.getTier(TIER_ID).maxMemberCapacity;
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId), playerId);
        for (uint256 i; i < maxMemberCapacity - 1; ++i) {
            uint256 charlieChildPlayerId = _createPlayer(CHARLIE, 1, string.concat("charlie", vm.toString(i)), true);
            vm.prank(ALICE);
            clans.inviteMembers(CLAN_ID, _playerIds(charlieChildPlayerId), playerId);
            vm.prank(CHARLIE);
            clans.acceptInvite(CLAN_ID, charlieChildPlayerId, 0);
        }

        vm.prank(BOB);
        vm.expectRevert(Clans.ClanIsFull.selector);
        clans.acceptInvite(CLAN_ID, bobPlayerId, 0);
        uint256 newPlayerId = _createPlayer(address(this), 1, "unique name1", true);
        vm.prank(ALICE);
        vm.expectRevert(Clans.ClanIsFull.selector);
        clans.inviteMembers(CLAN_ID, _playerIds(newPlayerId), playerId);

        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);
        vm.prank(ALICE);
        vm.expectRevert(Clans.ClanIsFull.selector);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId), playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.ClanIsFull.selector);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId), playerId);
    }

    function testCheckGetClanNameIsCaseSensitive() public {
        assertEq(clans.getClanNameOfPlayer(playerId), "Clan 1");
    }

    function testCommonerLeaveClan() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.COMMONER, playerId);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.NONE, playerId);
    }

    function testChangeRanks() public {
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId, charliePlayerId), playerId);
        vm.prank(BOB);
        clans.acceptInvite(CLAN_ID, bobPlayerId, 0);
        vm.prank(CHARLIE);
        clans.acceptInvite(CLAN_ID, charliePlayerId, 0);

        ClanRank[] memory ranks = new ClanRank[](2);
        ranks[0] = ClanRank.SCOUT;
        ranks[1] = ClanRank.TREASURER;
        vm.prank(ALICE);
        clans.changeRanks(CLAN_ID, _playerIds(bobPlayerId, charliePlayerId), ranks, playerId);

        assertEq(uint8(clans.getPlayerInfo(bobPlayerId).rank), uint8(ClanRank.SCOUT));
        assertEq(uint8(clans.getPlayerInfo(charliePlayerId).rank), uint8(ClanRank.TREASURER));
    }

    function testClaimOwnershipOfClanWithNoLeader() public {
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId), playerId);

        vm.prank(BOB);
        vm.expectRevert(Clans.NotMemberOfClan.selector);
        clans.claimOwnership(CLAN_ID, bobPlayerId);

        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(charliePlayerId), playerId);
        vm.prank(CHARLIE);
        clans.acceptInvite(CLAN_ID, charliePlayerId, 0);

        vm.prank(CHARLIE);
        vm.expectRevert(Clans.OwnerExists.selector);
        clans.claimOwnership(CLAN_ID, charliePlayerId);

        vm.expectEmit(true, true, true, true, address(clans));
        emit Clans.ClanOwnerLeft(CLAN_ID, playerId);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.NONE, playerId);
        (uint64 ownerPlayerIdAfter,, uint16 memberCountAfter,,,,,,) = clans.getClan(CLAN_ID);
        assertEq(ownerPlayerIdAfter, 0);
        assertEq(memberCountAfter, 1);

        vm.prank(BOB);
        vm.expectRevert(Clans.NotMemberOfClan.selector);
        clans.claimOwnership(CLAN_ID, bobPlayerId);
        vm.prank(BOB);
        clans.acceptInvite(CLAN_ID, bobPlayerId, 0);
        vm.prank(BOB);
        clans.claimOwnership(CLAN_ID, bobPlayerId);

        (uint64 ownerPlayerIdFinal,, uint16 memberCountFinal,,,,,,) = clans.getClan(CLAN_ID);
        assertEq(ownerPlayerIdFinal, bobPlayerId);
        assertEq(memberCountFinal, 2);
    }

    function testCreateUpgradedClan() public {
        _addUpgradedTiers();
        uint256 initialBrush = 2000;
        brush.mint(BOB, initialBrush);
        vm.startPrank(BOB);
        brush.approve(address(clans), initialBrush);
        clans.createClan(bobPlayerId, "bob", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, 2);
        vm.stopPrank();
        assertEq(brush.balanceOf(BOB), initialBrush - clans.getTier(2).price);
    }

    function testAnyoneCanUpgrade() public {
        _addUpgradedTiers();
        uint256 tier2Price = clans.getTier(2).price;
        vm.prank(ALICE);
        // The clan upgrade pays via burn (25%) then treasury (50%) then dev (25%), the burn reverts first
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(clans), 0, (tier2Price * 25) / 100
            )
        );
        clans.upgradeClan(CLAN_ID, playerId, 2);

        uint256 brushAmount = tier2Price;
        brush.mint(ALICE, brushAmount - 1);
        vm.startPrank(ALICE);
        brush.approve(address(clans), brushAmount);
        // The burn and treasury transfer succeed, the dev transfer fails with the remaining balance
        uint256 remainingBalance = (brushAmount - 1) - (brushAmount * 25) / 100 - (brushAmount * 50) / 100;
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector, ALICE, remainingBalance, (brushAmount * 25) / 100
            )
        );
        clans.upgradeClan(CLAN_ID, playerId, 2);
        vm.stopPrank();
        brush.mint(ALICE, 1);
        vm.prank(ALICE);
        clans.upgradeClan(CLAN_ID, playerId, 2);
        (,,,, uint8 newTierId,,,,) = clans.getClan(CLAN_ID);
        assertEq(newTierId, 2);
        assertEq(brush.balanceOf(ALICE), 0);
    }

    function testPayForTier1IfItHasACost() public {
        _addUpgradedTiers();
        uint256 price = 1000;
        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(1, 1, 1, 50, 0, uint80(price));
        clans.editTiers(tiers);

        brush.mint(ALICE, price);
        vm.startPrank(ALICE);
        brush.approve(address(clans), price);
        clans.changeRank(CLAN_ID, playerId, ClanRank.NONE, playerId);
        clans.createClan(playerId, "Clan 1", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, TIER_ID);
        vm.stopPrank();
        assertEq(brush.balanceOf(ALICE), 0);
    }

    function testCheckCostsAreExpectedWhenCreatingHigherTierClanWhenTier1HasACost() public {
        _addUpgradedTiers();
        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(1, 1, 1, 50, 0, 1);
        clans.editTiers(tiers);

        brush.mint(BOB, 1000);
        vm.startPrank(BOB);
        brush.approve(address(clans), 1000);
        clans.createClan(bobPlayerId, "bob", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, 2);
        vm.stopPrank();
        assertEq(brush.balanceOf(BOB), 1000 - clans.getTier(2).price);
    }

    function testPayTheDifferenceForIncrementalUpgrades() public {
        _addUpgradedTiers();
        uint256 brushAmount = clans.getTier(3).price;
        brush.mint(ALICE, brushAmount);
        uint256 beforeBalance = brush.balanceOf(ALICE);
        vm.startPrank(ALICE);
        brush.approve(address(clans), brushAmount);

        clans.upgradeClan(CLAN_ID, playerId, 2);
        assertEq(brush.balanceOf(ALICE), beforeBalance - clans.getTier(2).price);
        clans.upgradeClan(CLAN_ID, playerId, 3);
        vm.stopPrank();
        assertEq(brush.balanceOf(ALICE), beforeBalance - brushAmount);
    }

    function testCannotUpgradeToATierThatDoesntExist() public {
        _addUpgradedTiers();
        assertEq(clans.getTier(4).price, 0);
        brush.mint(BOB, 1000);
        vm.startPrank(BOB);
        brush.approve(address(clans), 1000);
        vm.stopPrank();
        vm.prank(BOB);
        vm.expectRevert(Clans.TierDoesNotExist.selector);
        clans.upgradeClan(CLAN_ID, bobPlayerId, 4);
    }

    function testCannotDowngradeAClan() public {
        _addUpgradedTiers();
        brush.mint(ALICE, 1000);
        vm.startPrank(ALICE);
        brush.approve(address(clans), 1000);
        clans.upgradeClan(CLAN_ID, playerId, 2);
        vm.expectRevert(Clans.CannotDowngradeTier.selector);
        clans.upgradeClan(CLAN_ID, playerId, 1);
        vm.stopPrank();
    }

    function testEditTiers() public {
        Clans.Tier[] memory addedTiers = new Clans.Tier[](1);
        addedTiers[0] = Clans.Tier(2, 10, 10, 16, 0, 10);
        clans.addTiers(addedTiers);

        Clans.Tier[] memory tiers = new Clans.Tier[](3);
        tiers[0] = Clans.Tier(1, 1, 1, 50, 0, 1);
        tiers[1] = Clans.Tier(2, 2, 2, 50, 0, 2);
        tiers[2] = Clans.Tier(3, 3, 3, 150, 0, 3);

        vm.expectRevert(Clans.TierDoesNotExist.selector);
        clans.editTiers(tiers);

        Clans.Tier[] memory twoTiers = new Clans.Tier[](2);
        twoTiers[0] = tiers[0];
        twoTiers[1] = tiers[1];
        clans.editTiers(twoTiers);

        Clans.Tier memory tier1 = clans.getTier(1);
        assertEq(tier1.maxMemberCapacity, 1);
        assertEq(tier1.maxBankCapacity, 1);
        assertEq(tier1.maxImageId, 50);
        assertEq(tier1.minimumAge, 0);
        assertEq(tier1.price, 1);
        Clans.Tier memory tier2 = clans.getTier(2);
        assertEq(tier2.maxMemberCapacity, 2);
        assertEq(tier2.maxBankCapacity, 2);
        assertEq(tier2.maxImageId, 50);
        assertEq(tier2.minimumAge, 0);
        assertEq(tier2.price, 2);
    }

    function testMustBeOwnerOfPlayerToEdit() public {
        vm.expectRevert(Clans.NotOwnerOfPlayerAndActive.selector);
        clans.editClan(CLAN_ID, "Clan 1", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, playerId);
    }

    function testMustBeAtLeastLeaderToEdit() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.TREASURER, playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.RankNotHighEnough.selector);
        clans.editClan(CLAN_ID, "Clan 1", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, playerId);
    }

    function testEditedClanNameShouldBeFreedAndAvailable() public {
        string memory anotherName = "Another name";
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        vm.prank(ALICE);
        vm.expectRevert();
        clans.editClan(CLAN_ID, anotherName, DISCORD, TELEGRAM, TWITTER, IMAGE_ID, playerId);

        brush.mint(ALICE, clans.getEditNameCost() * 5);
        vm.startPrank(ALICE);
        brush.approve(address(clans), clans.getEditNameCost() * 5);
        clans.editClan(CLAN_ID, anotherName, DISCORD, TELEGRAM, TWITTER, IMAGE_ID, playerId);
        vm.stopPrank();
        assertFalse(clans.getLowercaseNames("clan 1"));
        assertTrue(clans.getLowercaseNames("another name"));

        vm.startPrank(ALICE);
        clans.editClan(CLAN_ID, anotherName, DISCORD, TELEGRAM, TWITTER, IMAGE_ID, playerId);
        clans.editClan(CLAN_ID, "Clan 1", DISCORD, TELEGRAM, TWITTER, IMAGE_ID, playerId);
        vm.stopPrank();
        assertTrue(clans.getLowercaseNames("clan 1"));
        assertFalse(clans.getLowercaseNames("another name"));

        vm.startPrank(ALICE);
        clans.editClan(CLAN_ID, anotherName, DISCORD, TELEGRAM, TWITTER, IMAGE_ID, playerId);
        clans.editClan(CLAN_ID, anotherName, DISCORD, TELEGRAM, TWITTER, IMAGE_ID + 1, playerId);
        vm.stopPrank();
        assertTrue(clans.getLowercaseNames("another name"));
    }

    function testEditClanImage() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        vm.prank(ALICE);
        clans.editClan(CLAN_ID, "Clan 1", DISCORD, TELEGRAM, TWITTER, IMAGE_ID + 1, playerId);
    }

    function testEditClanSocials() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        string[] memory clanInfo = new string[](4);
        clanInfo[0] = "Clan 1";
        clanInfo[1] = string.concat(DISCORD, "1");
        clanInfo[2] = string.concat(TELEGRAM, "1");
        clanInfo[3] = string.concat(TWITTER, "1");
        vm.expectEmit(true, true, true, true, address(clans));
        emit Clans.ClanEdited(CLAN_ID, playerId, clanInfo, IMAGE_ID);
        vm.prank(ALICE);
        clans.editClan(
            CLAN_ID,
            "Clan 1",
            string.concat(DISCORD, "1"),
            string.concat(TELEGRAM, "1"),
            string.concat(TWITTER, "1"),
            IMAGE_ID,
            playerId
        );
    }

    function testOnlyLeaderCanRemoveTreasurers() public {
        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, 0);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId), playerId);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.TREASURER, playerId);

        vm.prank(BOB);
        vm.expectRevert(Clans.ChangingRankOfPlayerEqualOrHigherThanSelf.selector);
        clans.changeRank(CLAN_ID, playerId, ClanRank.SCOUT, bobPlayerId);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, bobPlayerId, ClanRank.SCOUT, playerId);

        assertFalse(clans.canWithdraw(CLAN_ID, bobPlayerId));
        assertTrue(clans.isClanMember(CLAN_ID, bobPlayerId));
        Clans.PlayerInfo memory player = clans.getPlayerInfo(bobPlayerId);
        assertEq(player.clanId, CLAN_ID);
        assertEq(player.requestedClanId, 0);
    }

    function testCheckGatewayDefensiveConstraints() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        TestERC1155NoRoyalty erc1155 = new TestERC1155NoRoyalty();
        Clans.NFTInfo[] memory infos = new Clans.NFTInfo[](1);
        infos[0] = Clans.NFTInfo(address(erc1155), 1155);

        vm.expectRevert(Clans.NotOwnerOfPlayerAndActive.selector);
        clans.gateKeep(CLAN_ID, infos, playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.NFTNotWhitelistedOnMarketplace.selector);
        clans.gateKeep(CLAN_ID, infos, playerId);
        paintSwapMarketplaceWhitelist.setWhitelisted(address(erc1155), true);
        infos[0] = Clans.NFTInfo(address(erc1155), 999);
        vm.prank(ALICE);
        vm.expectRevert(Clans.UnsupportedNFTType.selector);
        clans.gateKeep(CLAN_ID, infos, playerId);
        infos[0] = Clans.NFTInfo(address(erc1155), 721);
        vm.prank(ALICE);
        vm.expectRevert(Clans.InvalidNFTType.selector);
        clans.gateKeep(CLAN_ID, infos, playerId);
        infos[0] = Clans.NFTInfo(address(erc1155), 1155);
        vm.prank(ALICE);
        clans.gateKeep(CLAN_ID, infos, playerId);

        TestERC721 erc721 = new TestERC721();
        infos[0] = Clans.NFTInfo(address(erc721), 721);
        vm.prank(ALICE);
        vm.expectRevert(Clans.NFTNotWhitelistedOnMarketplace.selector);
        clans.gateKeep(CLAN_ID, infos, playerId);
        paintSwapMarketplaceWhitelist.setWhitelisted(address(erc721), true);
        infos[0] = Clans.NFTInfo(address(erc721), 999);
        vm.prank(ALICE);
        vm.expectRevert(Clans.UnsupportedNFTType.selector);
        clans.gateKeep(CLAN_ID, infos, playerId);
        infos[0] = Clans.NFTInfo(address(erc721), 1155);
        vm.prank(ALICE);
        vm.expectRevert(Clans.InvalidNFTType.selector);
        clans.gateKeep(CLAN_ID, infos, playerId);
        infos[0] = Clans.NFTInfo(address(erc721), 721);
        vm.prank(ALICE);
        clans.gateKeep(CLAN_ID, infos, playerId);

        vm.prank(ALICE);
        clans.gateKeep(CLAN_ID, _nftInfos(address(erc721), 5), playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.TooManyNFTs.selector);
        clans.gateKeep(CLAN_ID, _nftInfos(address(erc721), 6), playerId);
    }

    function testGateKeepJoinRequestWithERC1155() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        TestERC1155NoRoyalty erc1155 = new TestERC1155NoRoyalty();
        paintSwapMarketplaceWhitelist.setWhitelisted(address(erc1155), true);

        Clans.NFTInfo[] memory infos = new Clans.NFTInfo[](1);
        infos[0] = Clans.NFTInfo(address(erc1155), 1155);
        vm.prank(ALICE);
        clans.gateKeep(CLAN_ID, infos, playerId);

        uint256 tokenId = 1;
        vm.prank(BOB);
        vm.expectRevert(Clans.NoGateKeptNFTFound.selector);
        clans.requestToJoin(CLAN_ID, bobPlayerId, tokenId);

        erc1155.mint(BOB, 1);
        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, tokenId);
        vm.prank(BOB);
        erc1155.safeTransferFrom(BOB, ALICE, tokenId, 1, "");

        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId), playerId);
    }

    function testGateKeepJoinRequestWithERC721() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        TestERC721 erc721 = new TestERC721();
        paintSwapMarketplaceWhitelist.setWhitelisted(address(erc721), true);

        Clans.NFTInfo[] memory infos = new Clans.NFTInfo[](1);
        infos[0] = Clans.NFTInfo(address(erc721), 721);
        vm.prank(ALICE);
        clans.gateKeep(CLAN_ID, infos, playerId);

        uint256 tokenId = 1;
        vm.prank(BOB);
        vm.expectRevert(Clans.NoGateKeptNFTFound.selector);
        clans.requestToJoin(CLAN_ID, bobPlayerId, tokenId);

        erc721.mint(BOB);
        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, tokenId);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId), playerId);
    }

    function testGateKeepJoinRequestWithManyERC721sWhereSomeTokenIdsDoNotExist() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        TestERC721 erc721 = new TestERC721();
        paintSwapMarketplaceWhitelist.setWhitelisted(address(erc721), true);

        TestERC721 erc721Another = new TestERC721();
        paintSwapMarketplaceWhitelist.setWhitelisted(address(erc721Another), true);

        Clans.NFTInfo[] memory infos = new Clans.NFTInfo[](2);
        infos[0] = Clans.NFTInfo(address(erc721Another), 721);
        infos[1] = Clans.NFTInfo(address(erc721), 721);
        vm.prank(ALICE);
        clans.gateKeep(CLAN_ID, infos, playerId);

        uint256 tokenId = 1;
        erc721.mint(BOB);

        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, tokenId));
        erc721Another.ownerOf(tokenId);

        Clans.NFTInfo[] memory gateKeptNFTs;
        (,,,,,,,, gateKeptNFTs) = clans.getClan(CLAN_ID);
        assertEq(gateKeptNFTs[0].nft, address(erc721Another));

        vm.prank(BOB);
        clans.requestToJoin(CLAN_ID, bobPlayerId, tokenId);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _playerIds(bobPlayerId), playerId);
    }

    function testGateKeepAcceptingInvitesWithERC1155() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        TestERC1155NoRoyalty erc1155 = new TestERC1155NoRoyalty();
        paintSwapMarketplaceWhitelist.setWhitelisted(address(erc1155), true);

        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId), playerId);
        assertTrue(clans.hasInviteRequest(CLAN_ID, bobPlayerId));

        Clans.NFTInfo[] memory infos = new Clans.NFTInfo[](1);
        infos[0] = Clans.NFTInfo(address(erc1155), 1155);
        vm.prank(ALICE);
        clans.gateKeep(CLAN_ID, infos, playerId);

        uint256 tokenId = 1;
        vm.prank(BOB);
        vm.expectRevert(Clans.NoGateKeptNFTFound.selector);
        clans.acceptInvite(CLAN_ID, bobPlayerId, tokenId);
        erc1155.mint(BOB, 1);
        vm.prank(BOB);
        clans.acceptInvite(CLAN_ID, bobPlayerId, tokenId);
    }

    function testGateKeepAcceptingInvitesWithERC721() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        TestERC721 erc721 = new TestERC721();
        paintSwapMarketplaceWhitelist.setWhitelisted(address(erc721), true);

        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(bobPlayerId), playerId);
        assertTrue(clans.hasInviteRequest(CLAN_ID, bobPlayerId));

        Clans.NFTInfo[] memory infos = new Clans.NFTInfo[](1);
        infos[0] = Clans.NFTInfo(address(erc721), 721);
        vm.prank(ALICE);
        clans.gateKeep(CLAN_ID, infos, playerId);

        uint256 tokenId = 1;
        vm.prank(BOB);
        vm.expectRevert(Clans.NoGateKeptNFTFound.selector);
        clans.acceptInvite(CLAN_ID, bobPlayerId, tokenId);
        erc721.mint(BOB);
        vm.prank(BOB);
        clans.acceptInvite(CLAN_ID, bobPlayerId, tokenId);
    }

    function testMustBeOwnerOfPlayerToPin() public {
        vm.expectRevert(Clans.NotOwnerOfPlayerAndActive.selector);
        clans.pinMessage(CLAN_ID, "test", playerId);
        vm.prank(ALICE);
        clans.pinMessage(CLAN_ID, "test", playerId);
    }

    function testMustBeLeaderToPin() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.TREASURER, playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.RankNotHighEnough.selector);
        clans.pinMessage(CLAN_ID, "test", playerId);
    }

    function testCheckMaximumLength() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.MessageTooLong.selector);
        clans.pinMessage(CLAN_ID, string(bytes.concat(bytes("x"), new bytes(200))), playerId);
    }

    function testPinMessage() public {
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.LEADER, playerId);
        vm.expectEmit(true, true, true, true, address(clans));
        emit Clans.PinMessage(CLAN_ID, "test", playerId);
        vm.prank(ALICE);
        clans.pinMessage(CLAN_ID, "test", playerId);
    }

    function testMustBeOwnerToRenounce() public {
        vm.prank(ALICE);
        vm.expectRevert(Clans.CannotRenounceToSelf.selector);
        clans.renounceOwnershipTo(CLAN_ID, playerId, ClanRank.COMMONER);

        uint256 uniqueNamePlayerId = _createPlayer(BOB, 1, "unique name", true);
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(uniqueNamePlayerId), playerId);
        vm.prank(BOB);
        clans.acceptInvite(CLAN_ID, uniqueNamePlayerId, 0);

        vm.prank(ALICE);
        clans.renounceOwnershipTo(CLAN_ID, uniqueNamePlayerId, ClanRank.COMMONER);

        Clans.PlayerInfo memory oldLeader = clans.getPlayerInfo(playerId);
        assertEq(uint8(oldLeader.rank), uint8(ClanRank.COMMONER));
        assertEq(oldLeader.clanId, CLAN_ID);

        (uint64 ownerPlayerIdNow,, uint16 memberCountNow,,,,,,) = clans.getClan(CLAN_ID);
        assertEq(ownerPlayerIdNow, uniqueNamePlayerId);
        assertEq(memberCountNow, 2);

        vm.prank(ALICE);
        vm.expectRevert(Clans.NotOwnerOfPlayer.selector);
        clans.renounceOwnershipTo(CLAN_ID, uniqueNamePlayerId, ClanRank.COMMONER);
    }

    function testCanOnlyRenounceToAMember() public {
        uint256 uniqueNamePlayerId = _createPlayer(BOB, 1, "unique name", true);
        vm.prank(ALICE);
        clans.inviteMembers(CLAN_ID, _playerIds(uniqueNamePlayerId), playerId);
        vm.prank(ALICE);
        vm.expectRevert(Clans.NotMemberOfClan.selector);
        clans.renounceOwnershipTo(CLAN_ID, uniqueNamePlayerId, ClanRank.COMMONER);
    }

    function _addUpgradedTiers() private {
        Clans.Tier[] memory tiers = new Clans.Tier[](2);
        tiers[0] = Clans.Tier(2, 10, 10, 16, 0, 100);
        tiers[1] = Clans.Tier(3, 20, 10, 30, 0, 1000);
        clans.addTiers(tiers);
    }

    function _playerIds(uint256 a) private pure returns (uint256[] memory ids) {
        ids = new uint256[](1);
        ids[0] = a;
    }

    function _playerIds(uint256 a, uint256 b) private pure returns (uint256[] memory ids) {
        ids = new uint256[](2);
        ids[0] = a;
        ids[1] = b;
    }

    function _playerIds(uint256 a, uint256 b, uint256 c) private pure returns (uint256[] memory ids) {
        ids = new uint256[](3);
        ids[0] = a;
        ids[1] = b;
        ids[2] = c;
    }

    function _nftInfos(address nft, uint256 count) private pure returns (Clans.NFTInfo[] memory infos) {
        infos = new Clans.NFTInfo[](count);
        for (uint256 i; i < count; ++i) {
            infos[i] = Clans.NFTInfo(nft, 721);
        }
    }
}
