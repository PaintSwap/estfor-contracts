// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {Bank} from "../../contracts/Clans/Bank.sol";
import {IBankRelay} from "../../contracts/interfaces/IBankRelay.sol";
import {IClans as Clans} from "../../contracts/interfaces/IClans.sol";
import {ClanRank} from "../../contracts/globals/clans.sol";
import {BulkTransferInfo} from "../../contracts/globals/items.sol";
import {EquipPosition, ItemInput} from "../../contracts/globals/players.sol";
import {ItemNFT} from "../../contracts/ItemNFT.sol";
import {TestERC1155NoRoyalty} from "../../contracts/test/TestERC1155NoRoyalty.sol";
import {TestERC721} from "../../contracts/test/TestERC721.sol";

contract BankTest is FullGameStack {
    uint256 private constant CLAN_ID = 1;
    uint256 private constant BRONZE_HELMET = 1;
    uint256 private constant SAPPHIRE_AMULET = 257;
    uint256 private constant BRONZE_SHIELD = 2198;
    uint256 private constant IRON_AXE = 2817;
    uint256 private constant MITHRIL_AXE = 2818;
    uint256 private constant ADAMANTINE_AXE = 2819;
    uint256 private constant RUNITE_AXE = 2820;
    uint256 private constant TITANIUM_AXE = 2821;
    uint256 private constant ORICHALCUM_AXE = 2822;
    uint256 private constant BRONZE_ARROW = 11776;
    uint256 private constant SKILL_BOOST = 12803;

    address payable private clanBank;

    function setUp() public {
        deployFullGame();
        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(1, 3, 3, 16, 0, 0);
        clans.addTiers(tiers);
        clanBank = payable(bankFactory.getBankAddress(CLAN_ID));
    }

    function testDepositCapacityAndOnlyTreasurersWithdraw() public {
        itemNFT.mintBatch(ALICE, _uints(BRONZE_SHIELD, BRONZE_HELMET, SAPPHIRE_AMULET), _uints(200, 100, 100));
        itemNFT.mint(ALICE, BRONZE_ARROW, 100);
        _createClan();
        vm.prank(ALICE);
        itemNFT.setApprovalForAll(clanBank, true);
        assertTrue(bankFactory.getCreatedHere(clanBank));
        assertEq(bankFactory.getBankAddress(CLAN_ID), clanBank);

        uint256 apBalance = itemNFT.balanceOf(clanBank, ACTIVITY_TICKET);
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.WithdrawItems(ALICE, ALICE, playerId, _uints(ACTIVITY_TICKET), _uints(apBalance));
        vm.prank(ALICE);
        bankRelay.withdrawItems(ALICE, playerId, _uints(ACTIVITY_TICKET), _uints(apBalance));

        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.DepositItems(ALICE, playerId, _uints(BRONZE_SHIELD), _uints(1));
        vm.prank(ALICE);
        bankRelay.depositItems(playerId, _uints(BRONZE_SHIELD), _uints(1));
        assertEq(bankRelay.getUniqueItemCountForPlayer(playerId), 1);

        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.DepositItem(ALICE, playerId, BRONZE_SHIELD, 1);
        vm.prank(ALICE);
        itemNFT.safeTransferFrom(ALICE, clanBank, BRONZE_SHIELD, 1, "");
        assertEq(bankRelay.getUniqueItemCountForPlayer(playerId), 1);

        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.DepositItems(ALICE, playerId, _uints(SAPPHIRE_AMULET, BRONZE_ARROW), _uints(5, 10));
        vm.prank(ALICE);
        itemNFT.safeBatchTransferFrom(ALICE, clanBank, _uints(SAPPHIRE_AMULET, BRONZE_ARROW), _uints(5, 10), "");
        assertEq(bankRelay.getUniqueItemCountForPlayer(playerId), 3);

        vm.expectRevert(Bank.MaxBankCapacityReached.selector);
        vm.prank(ALICE);
        bankRelay.depositItems(playerId, _uints(BRONZE_HELMET), _uints(1));
        vm.expectRevert(Bank.MaxBankCapacityReached.selector);
        vm.prank(ALICE);
        itemNFT.safeTransferFrom(ALICE, clanBank, BRONZE_HELMET, 1, "");
        vm.expectRevert(Bank.MaxBankCapacityReached.selector);
        vm.prank(ALICE);
        itemNFT.safeBatchTransferFrom(ALICE, clanBank, _uints(BRONZE_HELMET), _uints(1), "");

        vm.prank(ALICE);
        bankRelay.depositItems(playerId, _uints(BRONZE_SHIELD), _uints(1));
        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(2, 5, 5, 16, 0, 0);
        clans.addTiers(tiers);
        vm.prank(ALICE);
        clans.upgradeClan(CLAN_ID, playerId, 2);
        vm.prank(ALICE);
        bankRelay.depositItems(playerId, _uints(BRONZE_HELMET), _uints(1));
        assertEq(bankRelay.getUniqueItemCountForPlayer(playerId), 4);

        uint256 beforeBalance = itemNFT.balanceOf(ALICE, BRONZE_SHIELD);
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.WithdrawItems(ALICE, ALICE, playerId, _uints(BRONZE_SHIELD), _uints(1));
        vm.prank(ALICE);
        bankRelay.withdrawItems(ALICE, playerId, _uints(BRONZE_SHIELD), _uints(1));
        assertEq(itemNFT.balanceOf(ALICE, BRONZE_SHIELD), beforeBalance + 1);

        uint256 otherPlayerId = _createPlayer(address(this), 1, "my name ser", true);
        clans.requestToJoin(CLAN_ID, otherPlayerId, 0);
        vm.prank(ALICE);
        clans.acceptJoinRequests(CLAN_ID, _uints(otherPlayerId), playerId);
        vm.expectRevert(Bank.NotClanAdmin.selector);
        bankRelay.withdrawItems(ALICE, otherPlayerId, _uints(BRONZE_SHIELD), _uints(1));
    }

    function testDistributeItemToSomeoneElse() public {
        _createClan();
        itemNFT.mint(clanBank, BRONZE_SHIELD, 1);
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.WithdrawItems(ALICE, BOB, playerId, _uints(BRONZE_SHIELD), _uints(1));
        vm.prank(ALICE);
        bankRelay.withdrawItems(BOB, playerId, _uints(BRONZE_SHIELD), _uints(1));
    }

    function testDistributeItemUpdatesUniqueCount() public {
        _createClan();
        itemNFT.mint(clanBank, BRONZE_SHIELD, 1);
        assertEq(bankRelay.getUniqueItemCountForPlayer(playerId), 1);
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.WithdrawItems(ALICE, BOB, playerId, _uints(BRONZE_SHIELD), _uints(1));
        vm.prank(ALICE);
        bankRelay.withdrawItems(BOB, playerId, _uints(BRONZE_SHIELD), _uints(1));
        assertEq(bankRelay.getUniqueItemCountForPlayer(playerId), 0);
    }

    function testDistributeItemsToManyUsers() public {
        Clans.Tier[] memory tiers = new Clans.Tier[](1);
        tiers[0] = Clans.Tier(2, 5, 6, 16, 0, 0);
        clans.addTiers(tiers);
        vm.prank(ALICE);
        clans.createClan(playerId, "Clan 1", "discord", "telegram", "twitter", 2, 2);
        clanBank = payable(bankFactory.getBankAddress(CLAN_ID));
        uint256 apBalance = itemNFT.balanceOf(clanBank, ACTIVITY_TICKET);
        vm.prank(ALICE);
        bankRelay.withdrawItems(ALICE, playerId, _uints(ACTIVITY_TICKET), _uints(apBalance));
        itemNFT.mintBatch(clanBank, _uints(TITANIUM_AXE, IRON_AXE, MITHRIL_AXE), _uints(2, 3, 1));
        itemNFT.mintBatch(clanBank, _uints(ADAMANTINE_AXE, RUNITE_AXE, ORICHALCUM_AXE), _uints(4, 3, 2));
        assertEq(bankRelay.getUniqueItemCountForPlayer(playerId), 6);
        BulkTransferInfo[] memory infos = new BulkTransferInfo[](2);
        infos[0] = BulkTransferInfo(_uints(TITANIUM_AXE, RUNITE_AXE, ORICHALCUM_AXE), _uints(2, 1, 2), ALICE);
        infos[1] = BulkTransferInfo(_uints(IRON_AXE, ADAMANTINE_AXE), _uints(3, 4), BOB);
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.WithdrawItemsBulk(ALICE, infos, playerId);
        vm.prank(ALICE);
        bankRelay.withdrawItemsBulk(infos, playerId);
        assertEq(bankRelay.getUniqueItemCountForPlayer(playerId), 2);
        assertEq(itemNFT.balanceOf(ALICE, TITANIUM_AXE), 2);
        assertEq(itemNFT.balanceOf(ALICE, RUNITE_AXE), 1);
        assertEq(itemNFT.balanceOf(ALICE, ORICHALCUM_AXE), 2);
        assertEq(itemNFT.balanceOf(BOB, IRON_AXE), 3);
        assertEq(itemNFT.balanceOf(BOB, ADAMANTINE_AXE), 4);
        assertEq(itemNFT.balanceOf(clanBank, MITHRIL_AXE), 1);
    }

    function testWithdrawNonTransferableBoost() public {
        ItemInput[] memory items = new ItemInput[](1);
        items[0].tokenId = uint16(SKILL_BOOST);
        items[0].equipPosition = EquipPosition.RIGHT_HAND;
        items[0].isAvailable = true;
        itemNFT.addItems(items);
        itemNFT.mint(ALICE, SKILL_BOOST, 1);
        vm.expectRevert(abi.encodeWithSelector(ItemNFT.ItemNotTransferable.selector, SKILL_BOOST));
        vm.prank(ALICE);
        itemNFT.safeTransferFrom(ALICE, BOB, SKILL_BOOST, 1, "");
        _createClan();
        itemNFT.mint(clanBank, SKILL_BOOST, 1);
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.WithdrawItems(ALICE, ALICE, playerId, _uints(SKILL_BOOST), _uints(1));
        vm.prank(ALICE);
        bankRelay.withdrawItems(ALICE, playerId, _uints(SKILL_BOOST), _uints(1));
    }

    function testDepositAndWithdrawTokens() public {
        _createClan();
        brush.mint(ALICE, 1000);
        vm.prank(ALICE);
        brush.approve(clanBank, 1000);
        vm.expectRevert(IBankRelay.PlayerNotInClan.selector);
        vm.prank(ALICE);
        bankRelay.depositToken(playerId + 1, address(brush), 1000);
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.DepositToken(ALICE, playerId, address(brush), 1000);
        vm.prank(ALICE);
        bankRelay.depositToken(playerId, address(brush), 1000);
        assertEq(brush.balanceOf(clanBank), 1000);
        uint256 bobPlayerId = _createPlayer(BOB, 1, "bob", true);
        _withdrawTokenAndExpect(BOB, bobPlayerId, 500);
        assertEq(brush.balanceOf(BOB), 500);
        assertEq(brush.balanceOf(clanBank), 500);
        brush.mint(clanBank, 500);
        _withdrawTokenAndExpect(BOB, bobPlayerId, 750);
        assertEq(brush.balanceOf(BOB), 1250);
        assertEq(brush.balanceOf(clanBank), 250);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.SCOUT, playerId);
        vm.expectRevert(Bank.NotClanAdmin.selector);
        vm.prank(ALICE);
        bankRelay.withdrawToken(playerId, BOB, bobPlayerId, address(brush), 250);
    }

    function testDepositAndWithdrawOtherERC1155NFTs() public {
        _createClan();
        TestERC1155NoRoyalty erc1155 = new TestERC1155NoRoyalty();
        erc1155.mintSpecificId(clanBank, 1, 1000);
        uint256 bobPlayerId = _createPlayer(BOB, 1, "bob", true);
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.WithdrawNFT(ALICE, playerId, BOB, bobPlayerId, address(erc1155), 1, 400);
        vm.prank(ALICE);
        bankRelay.withdrawNFT(playerId, BOB, bobPlayerId, address(erc1155), 1, 400);
        assertEq(erc1155.balanceOf(BOB, 1), 400);
        assertEq(erc1155.balanceOf(clanBank, 1), 600);
        TestERC721 erc721 = new TestERC721();
        vm.expectRevert();
        erc721.mint(clanBank);
        vm.expectRevert(Bank.NFTTypeNotSupported.selector);
        vm.prank(ALICE);
        bankRelay.withdrawNFT(playerId, BOB, bobPlayerId, address(erc721), 1, 1);
        vm.expectRevert(Bank.ToIsNotOwnerOfPlayer.selector);
        vm.prank(ALICE);
        bankRelay.withdrawNFT(playerId, ALICE, bobPlayerId, address(erc721), 1, 1);
        vm.prank(ALICE);
        bankRelay.withdrawNFT(playerId, BOB, bobPlayerId, address(erc1155), 1, 400);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.SCOUT, playerId);
        vm.expectRevert(Bank.NotClanAdmin.selector);
        vm.prank(ALICE);
        bankRelay.withdrawToken(playerId, BOB, bobPlayerId, address(brush), 250);
    }

    function testWithdrawToManyWithdrawerNotOwner() public {
        _createClan();
        brush.mint(clanBank, 500);
        vm.expectRevert(IBankRelay.PlayerNotInClan.selector);
        vm.prank(ALICE);
        bankRelay.withdrawTokenToMany(playerId + 1, _addresses(ALICE), _uints(playerId), address(brush), _uints(250));
    }

    function testWithdrawToManyRequiresTreasurer() public {
        _createClan();
        brush.mint(clanBank, 500);
        vm.prank(ALICE);
        clans.changeRank(CLAN_ID, playerId, ClanRank.SCOUT, playerId);
        vm.expectRevert(Bank.NotClanAdmin.selector);
        vm.prank(ALICE);
        bankRelay.withdrawTokenToMany(playerId, _addresses(ALICE), _uints(playerId), address(brush), _uints(250));
    }

    function testWithdrawToManyLengthMismatch() public {
        _createClan();
        vm.expectRevert(Bank.LengthMismatch.selector);
        vm.prank(ALICE);
        bankRelay.withdrawTokenToMany(playerId, _addresses(ALICE), new uint256[](0), address(brush), _uints(250));
        vm.expectRevert(Bank.LengthMismatch.selector);
        vm.prank(ALICE);
        bankRelay.withdrawTokenToMany(playerId, _addresses(ALICE), _uints(playerId), address(brush), new uint256[](0));
    }

    function testWithdrawToManyOwnerMismatch() public {
        _createClan();
        brush.mint(clanBank, 500);
        vm.expectRevert(Bank.ToIsNotOwnerOfPlayer.selector);
        vm.prank(ALICE);
        bankRelay.withdrawTokenToMany(playerId, _addresses(ALICE), _uints(playerId + 1), address(brush), _uints(250));
    }

    function testWithdrawTokensToManyUsers() public {
        _createClan();
        brush.mint(clanBank, 500);
        uint256 bobPlayerId = _createPlayer(BOB, 1, "bob", true);
        address[] memory tos = _addresses(ALICE, BOB);
        uint256[] memory ids = _uints(playerId, bobPlayerId);
        uint256[] memory amounts = _uints(250, 200);
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.WithdrawTokens(ALICE, playerId, tos, ids, address(brush), amounts);
        vm.prank(ALICE);
        bankRelay.withdrawTokenToMany(playerId, tos, ids, address(brush), amounts);
        assertEq(brush.balanceOf(ALICE), 250);
        assertEq(brush.balanceOf(BOB), 200);
    }

    function _createClan() private {
        vm.prank(ALICE);
        clans.createClan(playerId, "Clan 1", "G4ZgtP52JK", "fantomfoundation", "fantomfdn", 2, 1);
        clanBank = payable(bankFactory.getBankAddress(CLAN_ID));
    }

    function _withdrawTokenAndExpect(address to, uint256 toPlayerId, uint256 amount) private {
        vm.expectEmit(false, false, false, true, clanBank);
        emit Bank.WithdrawToken(ALICE, playerId, to, toPlayerId, address(brush), amount);
        vm.prank(ALICE);
        bankRelay.withdrawToken(playerId, to, toPlayerId, address(brush), amount);
    }
}
