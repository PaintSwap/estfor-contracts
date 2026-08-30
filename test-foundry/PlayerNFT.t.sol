// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {PlayerNFT} from "../contracts/PlayerNFT.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {PlayersBase} from "../contracts/Players/PlayersBase.sol";
import {PlayersImplMisc1} from "../contracts/Players/PlayersImplMisc1.sol";
import {Player, PlayerInfo, AvatarInfo} from "../contracts/globals/players.sol";
import {Skill} from "../contracts/globals/misc.sol";
import {
    BRONZE_SWORD,
    BRONZE_AXE,
    MAGIC_FIRE_STARTER,
    NET_STICK,
    BRONZE_PICKAXE,
    TOTEM_STAFF,
    BASIC_BOW
} from "../contracts/globals/items.sol";
import {FullGameStack} from "./utils/FullGameStack.sol";

contract PlayerNFTTest is FullGameStack {
    uint256 private constant EDIT_COST = 1 ether;
    uint256 private constant UPGRADE_COST = 1 ether;

    function setUp() public {
        deployFullGame();
    }

    function testCheckInitializationParams() public {
        PlayerNFT implementation = new PlayerNFT();
        vm.expectEmit(false, false, false, true);
        emit PlayerNFT.EditNameCost(EDIT_COST);
        vm.expectEmit(false, false, false, true);
        emit PlayerNFT.UpgradePlayerCost(2 ether);
        new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                PlayerNFT.initialize,
                (
                    IBrushToken(address(brush)),
                    address(shop),
                    DEV,
                    address(royaltyReceiver),
                    uint72(EDIT_COST),
                    uint72(2 ether),
                    "ipfs://",
                    uint64(1),
                    false,
                    address(bridge)
                )
            )
        );
    }

    function testEmptyName() public {
        vm.prank(ALICE);
        vm.expectRevert(PlayerNFT.NameTooShort.selector);
        playerNFT.mint(1, "", "", "", "", false, true);
    }

    function testNameTooLong() public {
        vm.prank(ALICE);
        vm.expectRevert(PlayerNFT.NameTooLong.selector);
        playerNFT.mint(1, "F12345678901234567890", "", "", "", false, true);
    }

    function testDuplicateNamesNotAllowed() public {
        _createPlayer(ALICE, 1, "A123", true);
        vm.startPrank(ALICE);
        vm.expectRevert(PlayerNFT.NameAlreadyExists.selector);
        playerNFT.mint(1, "A123", "", "", "", false, true);
        vm.expectRevert(PlayerNFT.NameAlreadyExists.selector);
        playerNFT.mint(1, "A123 ", "", "", "", false, true);
        vm.expectRevert(PlayerNFT.NameAlreadyExists.selector);
        playerNFT.mint(1, "a123", "", "", "", false, true);
        vm.stopPrank();
    }

    function testMintAStandardPlayer() public {
        vm.warp(block.timestamp + 1);
        uint256 timestamp = block.timestamp;
        uint256 newPlayerId = _createPlayer(ALICE, 1, "A123", true);
        PlayerInfo memory info = playerNFT.getPlayerInfo(newPlayerId);
        assertEq(info.avatarId, 1);
        assertEq(info.originalAvatarId, 1);
        assertEq(info.mintedTimestamp, timestamp);
        assertEq(info.upgradedTimestamp, 0);
    }

    function testMintingWithAnUpgradeShouldCostBrush() public {
        _fundAndApprove(ALICE, UPGRADE_COST);
        vm.prank(ALICE);
        playerNFT.mint(1, "name", "", "1231231", "", true, true);
        assertEq(brush.balanceOf(ALICE), 0);
        Player memory player = PlayersImplMisc1(address(players)).getPlayer(playerId + 1);
        assertEq(player.packedData, bytes1(0x80));
    }

    function testEditName() public {
        vm.prank(ALICE);
        brush.approve(address(playerNFT), EDIT_COST * 3);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 0, EDIT_COST / 2));
        playerNFT.editPlayer(playerId, "My name is edited", "", "", "", false);
        brush.mint(ALICE, EDIT_COST * 3);

        vm.expectRevert(PlayerNFT.NotOwnerOfPlayer.selector);
        playerNFT.editPlayer(playerId, "My name is edited", "", "", "", false);
        assertTrue(playerNFT.hasLowercaseName("0xsamwitch"));
        vm.prank(ALICE);
        playerNFT.editPlayer(playerId, "My name is edited", "", "", "", false);
        assertFalse(playerNFT.hasLowercaseName("0xsamwitch"));
        assertEq(playerNFT.getName(playerId), "My name is edited");

        uint256 newPlayerId = _createPlayer(ALICE, 1, "name", true);
        vm.prank(ALICE);
        vm.expectRevert(PlayerNFT.NameAlreadyExists.selector);
        playerNFT.editPlayer(newPlayerId, "My name is edited", "", "", "", false);
    }

    function testEditSocialsNoChargeIfNameDoesNotChange() public {
        vm.expectEmit(false, false, false, true, address(playerNFT));
        emit PlayerNFT.EditPlayer(playerId, ALICE, ORIG_NAME, 0, "", "1231231", "", false);
        vm.prank(ALICE);
        playerNFT.editPlayer(playerId, ORIG_NAME, "", "1231231", "", false);

        _fundAndApprove(ALICE, EDIT_COST);
        vm.expectEmit(false, false, false, true, address(playerNFT));
        emit PlayerNFT.EditPlayer(playerId, ALICE, "New name", EDIT_COST, "", "1231231", "", false);
        vm.prank(ALICE);
        playerNFT.editPlayer(playerId, "New name", "", "1231231", "", false);
    }

    function testEditingUpgradePlayerShouldCostBrush() public {
        uint256 brushAmount = EDIT_COST + UPGRADE_COST * 2;
        _fundAndApprove(ALICE, brushAmount);
        uint256 mintedTimestamp = playerNFT.getPlayerInfo(playerId).mintedTimestamp;
        assertNotEq(mintedTimestamp, 0);

        vm.expectEmit(false, false, false, true, address(playerNFT));
        emit PlayerNFT.UpgradePlayerAvatar(playerId, 10001, UPGRADE_COST);
        vm.expectEmit(false, false, false, true, address(playerNFT));
        emit PlayerNFT.EditPlayer(playerId, ALICE, "new name", EDIT_COST, "", "1231231", "", true);
        vm.prank(ALICE);
        playerNFT.editPlayer(playerId, "new name", "", "1231231", "", true);

        assertEq(brush.balanceOf(ALICE), brushAmount - EDIT_COST - UPGRADE_COST);
        assertEq(brush.balanceOf(DEV), UPGRADE_COST / 4 + EDIT_COST / 4);
        assertEq(brush.balanceOf(address(treasury)), UPGRADE_COST / 2 + EDIT_COST / 2);
        assertEq(PlayersImplMisc1(address(players)).getPlayer(playerId).packedData, bytes1(0x80));

        vm.prank(ALICE);
        vm.expectRevert(PlayersBase.AlreadyUpgraded.selector);
        playerNFT.editPlayer(playerId, "new name", "", "1231231", "", true);
        PlayerInfo memory info = playerNFT.getPlayerInfo(playerId);
        assertEq(info.avatarId, 10001);
        assertEq(info.originalAvatarId, 1);
        assertEq(info.mintedTimestamp, mintedTimestamp);
        assertEq(info.upgradedTimestamp, block.timestamp);
    }

    function testUpgradingFromMintShouldCostBrush() public {
        _fundAndApprove(ALICE, UPGRADE_COST);
        uint256 newPlayerId = playerId + 1;
        vm.expectEmit(false, false, false, true, address(playerNFT));
        emit PlayerNFT.NewPlayer(newPlayerId, 1, "name", ALICE, "", "1231231", "", true);
        vm.expectEmit(false, false, false, true, address(playerNFT));
        emit PlayerNFT.UpgradePlayerAvatar(newPlayerId, 10001, UPGRADE_COST);
        vm.prank(ALICE);
        playerNFT.mint(1, "name", "", "1231231", "", true, true);

        assertEq(brush.balanceOf(ALICE), 0);
        assertEq(brush.balanceOf(DEV), UPGRADE_COST / 4);
        assertEq(brush.balanceOf(address(treasury)), UPGRADE_COST / 2);
        assertEq(PlayersImplMisc1(address(players)).getPlayer(newPlayerId).packedData, bytes1(0x80));
        PlayerInfo memory info = playerNFT.getPlayerInfo(newPlayerId);
        assertEq(info.avatarId, 10001);
        assertEq(info.originalAvatarId, 1);
        assertEq(info.mintedTimestamp, block.timestamp);
        assertEq(info.upgradedTimestamp, block.timestamp);
    }

    function testURI() public view {
        string memory json = _uriJson(playerId);
        assertEq(vm.parseJsonString(json, ".name"), string.concat(ORIG_NAME, " (21)"));
        assertEq(vm.parseJsonString(json, ".image"), "ipfs://1234.png");
        assertEq(vm.parseJsonString(json, ".attributes[0].trait_type"), "Avatar");
        assertEq(vm.parseJsonString(json, ".attributes[0].value"), "Name goes here");
        assertEq(vm.parseJsonString(json, ".attributes[1].trait_type"), "Clan");
        assertEq(vm.parseJsonString(json, ".attributes[1].value"), "");
        assertEq(vm.parseJsonString(json, ".attributes[2].trait_type"), "Full version");
        assertEq(vm.parseJsonString(json, ".attributes[2].value"), "false");
        assertEq(vm.parseJsonString(json, ".attributes[3].trait_type"), "Melee level");
        assertEq(vm.parseJsonUint(json, ".attributes[3].value"), 1);
        assertEq(vm.parseJsonString(json, ".attributes[18].trait_type"), "Forging level");
        assertEq(vm.parseJsonUint(json, ".attributes[18].value"), 1);
        assertEq(vm.parseJsonString(json, ".attributes[19].trait_type"), "Farming level");
        assertEq(vm.parseJsonUint(json, ".attributes[19].value"), 1);
        assertEq(vm.parseJsonString(json, ".attributes[20].trait_type"), "Total level");
        assertEq(vm.parseJsonUint(json, ".attributes[20].value"), 21);
        assertEq(
            vm.parseJsonString(json, ".external_url"),
            string.concat("https://beta.estfor.com/journal/", vm.toString(playerId))
        );
    }

    function testMintNonExistentAvatar() public {
        vm.prank(ALICE);
        vm.expectRevert(PlayerNFT.BaseAvatarNotExists.selector);
        playerNFT.mint(500, "New name", "", "", "", false, true);
    }

    function testCannotMintNonBaseAvatar() public {
        AvatarInfo[] memory infos = new AvatarInfo[](1);
        infos[0] = AvatarInfo("Evolved", "description", "evolved.png", [Skill.MAGIC, Skill.NONE]);
        playerNFT.setAvatars(_uints(10001), infos);
        vm.prank(ALICE);
        vm.expectRevert(PlayerNFT.BaseAvatarNotExists.selector);
        playerNFT.mint(10001, "New name", "", "", "", false, true);
    }

    function testExternalURLWhenNotInBeta() public {
        // Direct storage write: Players._isBeta is at slot 5, offset 20 (see `forge inspect Players storage-layout`).
        // Clearing that byte flips the stack to non-beta; if the upstream layout changes, this write corrupts an
        // unrelated variable and the assertions below fail.
        bytes32 slot = vm.load(address(players), bytes32(uint256(5)));
        vm.store(address(players), bytes32(uint256(5)), bytes32(uint256(slot) & ~(uint256(0xff) << 160)));
        assertEq(
            vm.parseJsonString(_uriJson(playerId), ".external_url"),
            string.concat("https://estfor.com/journal/", vm.toString(playerId))
        );
    }

    function testSupportsIERC165() public view {
        assertTrue(playerNFT.supportsInterface(0x01ffc9a7));
    }

    function testSupportsIERC1155() public view {
        assertTrue(playerNFT.supportsInterface(0xd9b67a26));
    }

    function testSupportsIERC1155Metadata() public view {
        assertTrue(playerNFT.supportsInterface(0x0e89341c));
    }

    function testSupportsIERC2981Royalties() public view {
        assertTrue(playerNFT.supportsInterface(0x2a55205a));
    }

    function testNameAndSymbol() public {
        assertEq(playerNFT.name(), "Estfor Players (Beta)");
        assertEq(playerNFT.symbol(), "EK_PB");
        // Direct storage write: PlayerNFT._isBeta is at slot 9, offset 0 (see `forge inspect PlayerNFT storage-layout`).
        vm.store(address(playerNFT), bytes32(uint256(9)), bytes32(0));
        assertEq(playerNFT.name(), "Estfor Players");
        assertEq(playerNFT.symbol(), "EK_P");
    }

    function testCheckStartingItems() public view {
        uint16[] memory ids = new uint16[](7);
        ids[0] = BRONZE_SWORD;
        ids[1] = BRONZE_AXE;
        ids[2] = MAGIC_FIRE_STARTER;
        ids[3] = NET_STICK;
        ids[4] = BRONZE_PICKAXE;
        ids[5] = TOTEM_STAFF;
        ids[6] = BASIC_BOW;
        uint256[] memory balances = itemNFT.balanceOfs(ALICE, ids);
        for (uint256 i; i < balances.length; ++i) {
            assertEq(balances[i], 1);
        }
    }

    function testTotalSupply() public {
        assertEq(playerNFT.totalSupply(), 1);
        uint256 secondPlayerId = _createPlayer(address(this), 1, "name1", true);
        assertEq(playerNFT.totalSupply(), 2);
        assertEq(playerNFT.totalSupply(playerId), 1);
        assertEq(playerNFT.totalSupply(secondPlayerId), 1);
        vm.prank(ALICE);
        playerNFT.burn(ALICE, playerId);
        assertEq(playerNFT.totalSupply(), 1);
        playerNFT.burn(address(this), secondPlayerId);
        assertEq(playerNFT.totalSupply(), 0);
    }

    function _fundAndApprove(address account, uint256 amount) private {
        brush.mint(account, amount);
        vm.prank(account);
        brush.approve(address(playerNFT), amount);
    }

    function _uriJson(uint256 id) private view returns (string memory) {
        bytes memory uriBytes = bytes(playerNFT.uri(id));
        bytes memory prefix = bytes("data:application/json;base64,");
        bytes memory encoded = new bytes(uriBytes.length - prefix.length);
        for (uint256 i; i < encoded.length; ++i) {
            encoded[i] = uriBytes[i + prefix.length];
        }
        return string(_decodeBase64(encoded));
    }

    function _decodeBase64(bytes memory data) private pure returns (bytes memory result) {
        if (data.length == 0) return new bytes(0);
        uint256 decodedLength = (data.length / 4) * 3;
        if (data[data.length - 1] == "=") --decodedLength;
        if (data[data.length - 2] == "=") --decodedLength;
        result = new bytes(decodedLength);
        uint256 outputIndex;
        for (uint256 i; i < data.length; i += 4) {
            uint256 value = (_base64Value(data[i]) << 18) | (_base64Value(data[i + 1]) << 12)
                | (_base64Value(data[i + 2]) << 6) | _base64Value(data[i + 3]);
            if (outputIndex < decodedLength) result[outputIndex++] = bytes1(uint8(value >> 16));
            if (outputIndex < decodedLength) result[outputIndex++] = bytes1(uint8(value >> 8));
            if (outputIndex < decodedLength) result[outputIndex++] = bytes1(uint8(value));
        }
    }

    function _base64Value(bytes1 character) private pure returns (uint256) {
        uint8 value = uint8(character);
        if (value >= 65 && value <= 90) return value - 65;
        if (value >= 97 && value <= 122) return value - 71;
        if (value >= 48 && value <= 57) return value + 4;
        if (value == 43) return 62;
        if (value == 47) return 63;
        return 0;
    }
}
