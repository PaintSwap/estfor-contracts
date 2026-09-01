// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

import {PetNFT} from "./interfaces/PetNFT.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {Skill} from "../contracts/globals/misc.sol";
import {PetSkin, PetEnhancementType} from "../contracts/globals/pets.sol";
import {FullGameStack} from "./utils/FullGameStack.sol";

contract PetNFTTest is FullGameStack {
    uint256 private constant PET_ID = 1;
    uint24 private constant BASE_ID = 3;
    uint256 private constant EDIT_NAME_COST = 1 ether;

    function setUp() public {
        deployFullGame();
    }

    function testMustBeAMinterToMint() public {
        vm.prank(FRANK);
        vm.expectRevert(PetNFT.NotMinter.selector);
        petNFT.mintBatch(FRANK, _uints(1), 1);
    }

    function testMintAStandardPet() public {
        _addPet(_pet());
        vm.prank(ALICE);
        petNFT.mintBatch(ALICE, _uints(BASE_ID), 1);
        assertEq(petNFT.getNextPetId(), 2);
        assertEq(petNFT.balanceOf(ALICE, PET_ID), 1);
    }

    function testURI() public {
        _mintPet(_pet(), 1);
        string memory uri = petNFT.uri(PET_ID);
        assertTrue(_startsWith(uri, "data:application/json;base64"));
        string memory json = _uriJson(petNFT, PET_ID);
        assertEq(vm.parseJsonString(json, ".name"), "Pet 1 (T2)");
        assertEq(vm.parseJsonString(json, ".image"), "ipfs://OG_2_Melee.jpg");
        _assertStringAttribute(json, 0, "Skin", "OG");
        _assertUintAttribute(json, 1, "Tier", 2);
        _assertStringAttribute(json, 2, "Enhancement type", "Melee");
        _assertStringAttribute(json, 3, "Skill bonus #1", "Melee");
        _assertUintAttribute(json, 4, "Fixed increase #1", 0);
        _assertUintAttribute(json, 5, "Fixed max #1", 0);
        _assertUintAttribute(json, 6, "Percent increase #1", 9);
        _assertUintAttribute(json, 7, "Percent max #1", 10);
        _assertStringAttribute(json, 8, "Skill bonus #2", "Defence");
        _assertUintAttribute(json, 9, "Fixed increase #2", 0);
        _assertUintAttribute(json, 10, "Fixed max #2", 0);
        _assertUintAttribute(json, 11, "Percent increase #2", 15);
        _assertUintAttribute(json, 12, "Percent max #2", 18);
        _assertStringAttribute(json, 13, "Fixed Star", "false");
        _assertStringAttribute(json, 14, "Percent Star", "true");
        assertEq(vm.parseJsonString(json, ".external_url"), "https://beta.estfor.com");
    }

    function testMintNonExistentPet() public {
        vm.prank(ALICE);
        vm.expectRevert(PetNFT.PetDoesNotExist.selector);
        petNFT.mintBatch(ALICE, _uints(BASE_ID), 1);
    }

    function testExternalURLWhenNotInBeta() public {
        PetNFT nonBeta = _deployPetNFT(false);
        _addPet(nonBeta, _pet());
        vm.expectRevert(PetNFT.NotMinter.selector);
        nonBeta.mintBatch(ALICE, _uints(BASE_ID), 1);
        nonBeta.initializeAddresses(ALICE, ALICE, ALICE);
        vm.prank(ALICE);
        nonBeta.mintBatch(ALICE, _uints(BASE_ID), 1);
        assertEq(vm.parseJsonString(_uriJson(nonBeta, PET_ID), ".external_url"), "https://estfor.com");
    }

    function testSupportsIERC165() public view {
        assertTrue(petNFT.supportsInterface(type(IERC165).interfaceId));
    }

    function testSupportsIERC1155() public view {
        assertTrue(petNFT.supportsInterface(type(IERC1155).interfaceId));
    }

    function testSupportsIERC1155Metadata() public view {
        assertTrue(petNFT.supportsInterface(type(IERC1155MetadataURI).interfaceId));
    }

    function testSupportsIERC2981Royalties() public view {
        assertTrue(petNFT.supportsInterface(type(IERC2981).interfaceId));
    }

    function testNameAndSymbol() public {
        assertEq(petNFT.name(), "Estfor Pets (Beta)");
        assertEq(petNFT.symbol(), "EK_PETS_B");
        PetNFT nonBeta = _deployPetNFT(false);
        assertEq(nonBeta.name(), "Estfor Pets");
        assertEq(nonBeta.symbol(), "EK_PETS");
    }

    function testMustOwnPetToAssign() public {
        vm.prank(address(players));
        vm.expectRevert(PetNFT.PlayerDoesNotOwnPet.selector);
        petNFT.assignPet(ALICE, playerId, PET_ID, 0);
    }

    function testCheckMinLevelsAreRespected() public {
        PetNFT.BasePetInput memory input = _pet();
        input.skillMinLevels[0] = 2;
        _mintPet(input, 0);
        vm.prank(address(players));
        vm.expectRevert(abi.encodeWithSelector(PetNFT.LevelNotHighEnough.selector, Skill.MELEE, 2));
        petNFT.assignPet(ALICE, playerId, PET_ID, 0);
        players.modifyXP(ALICE, playerId, Skill.MELEE, _xpAtLevel(2), true);
        vm.prank(address(players));
        petNFT.assignPet(ALICE, playerId, PET_ID, 0);
    }

    function testMustBePlayersToCallAssignPet() public {
        _mintPet(_pet(), 0);
        vm.expectRevert(PetNFT.NotPlayers.selector);
        petNFT.assignPet(ALICE, playerId, PET_ID, 0);
        vm.prank(address(players));
        petNFT.assignPet(ALICE, playerId, PET_ID, 0);
    }

    function testCheckZeroForBothPercentageAndFixedReverts() public {
        PetNFT.BasePetInput memory input = _pet();
        input.skillPercentageMins[0] = 0;
        input.skillPercentageMaxs[0] = 0;
        vm.expectRevert(PetNFT.MustHaveAtLeastPercentageOrFixedSet.selector);
        _addPet(input);
        input.skillPercentageMins[0] = 1;
        input.skillPercentageMaxs[0] = 10;
        _mintPet(input, 0);
        vm.prank(address(players));
        petNFT.assignPet(ALICE, playerId, PET_ID, 0);
    }

    function testCheckAllSkins() public {
        string[10] memory names =
            ["Default", "OG", "OneKin", "Frost", "Crystal", "Anniv1", "Kragstyr", "Anniv2", "Rift", "Anniv3"];
        PetNFT.BasePetInput memory input = _pet();
        for (uint256 i; i < names.length; ++i) {
            input.skin = PetSkin(i + 1);
            input.baseId = uint24(BASE_ID + i);
            _mintPet(input, 0);
            assertEq(vm.parseJsonString(_uriJson(petNFT, i + 1), ".attributes[0].value"), names[i]);
        }
    }

    function testCheckZeroForFixedOrPercentageDoesNotRevert() public {
        PetNFT.BasePetInput memory input = _pet();
        _mintPet(input, 0);
        vm.prank(address(players));
        petNFT.assignPet(ALICE, playerId, PET_ID, 0);

        input.skillPercentageMins[0] = 0;
        input.skillPercentageMaxs[0] = 0;
        input.skillFixedMaxs[0] = 1;
        _editPet(input);
        vm.prank(address(players));
        petNFT.assignPet(ALICE, playerId, PET_ID, 0);

        input.skillFixedMaxs[1] = 1;
        vm.expectRevert(PetNFT.SkillFixedIncrementCannotBeZero.selector);
        _editPet(input);
        input.skillFixedIncrements[1] = 1;
        _editPet(input);
        input.skillFixedMaxs[1] = 0;
        input.skillPercentageIncrements[1] = 0;
        vm.expectRevert(PetNFT.SkillPercentageIncrementCannotBeZero.selector);
        _editPet(input);
        input.skillPercentageIncrements[1] = 1;
        _editPet(input);
        vm.prank(address(players));
        petNFT.assignPet(ALICE, playerId, PET_ID, 0);
    }

    function testEditPetName() public {
        _approvePetNameEdits(3);
        _mintPet(_pet(), 0);
        vm.prank(ALICE);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, ALICE, 0, EDIT_NAME_COST / 2)
        );
        petNFT.editPet(playerId, PET_ID, "My pet name is1");
        brush.mint(ALICE, EDIT_NAME_COST * 3);
        vm.prank(ALICE);
        vm.expectRevert(PetNFT.NotOwnerOfPlayer.selector);
        petNFT.editPet(playerId + 1, PET_ID, "My pet name is1");
        vm.prank(ALICE);
        petNFT.safeTransferFrom(ALICE, address(this), PET_ID, 1, "");
        vm.prank(ALICE);
        vm.expectRevert(PetNFT.NotOwnerOfPet.selector);
        petNFT.editPet(playerId, PET_ID, "My pet name is1");
        petNFT.safeTransferFrom(address(this), ALICE, PET_ID, 1, "");
        vm.expectEmit(true, true, true, true, address(petNFT));
        emit PetNFT.EditPlayerPet(playerId, PET_ID, ALICE, "My pet name is1");
        vm.prank(ALICE);
        petNFT.editPet(playerId, PET_ID, "My pet name is1");
        vm.prank(ALICE);
        petNFT.mintBatch(ALICE, _uints(BASE_ID), 0);
        vm.prank(ALICE);
        vm.expectRevert(PetNFT.NameAlreadyExists.selector);
        petNFT.editPet(playerId, PET_ID + 1, "My pet name is1");
    }

    function testChangingFromPreviousNameShouldRelinquishIt() public {
        _fundApproveAndMint(3);
        vm.startPrank(ALICE);
        petNFT.editPet(playerId, PET_ID, "CHOO CHOO");
        petNFT.editPet(playerId, PET_ID, "CHOO CHOO1");
        petNFT.editPet(playerId, PET_ID, "CHOO CHOO");
        vm.stopPrank();
    }

    function testEditingNameWithoutActuallyChangingItShouldRevert() public {
        _fundApproveAndMint(3);
        vm.startPrank(ALICE);
        petNFT.editPet(playerId, PET_ID, "CHOO CHOO");
        vm.expectRevert(PetNFT.SameName.selector);
        petNFT.editPet(playerId, PET_ID, "CHOO CHOO");
        vm.stopPrank();
    }

    function testMax15CharactersForTheName() public {
        _fundApproveAndMint(3);
        vm.startPrank(ALICE);
        vm.expectRevert(PetNFT.NameTooLong.selector);
        petNFT.editPet(playerId, PET_ID, "1234567890123456");
        petNFT.editPet(playerId, PET_ID, "123456789012345");
        vm.stopPrank();
    }

    function testCannotEditNameToStartWithPetRegardlessOfCase() public {
        _fundApproveAndMint(3);
        vm.startPrank(ALICE);
        vm.expectRevert(PetNFT.IllegalNameStart.selector);
        petNFT.editPet(playerId, PET_ID, "Pet sdfs");
        vm.expectRevert(PetNFT.IllegalNameStart.selector);
        petNFT.editPet(playerId, PET_ID, "PET sdfs");
        vm.stopPrank();
    }

    function testCheckBrushPaymentGoesToExpectedAddresses() public {
        _fundApproveAndMint(3);
        petNFT.setBrushDistributionPercentages(75, 0, 25);
        vm.prank(ALICE);
        petNFT.editPet(playerId, PET_ID, "New name");
        assertEq(brush.balanceOf(ALICE), EDIT_NAME_COST * 2);
        assertEq(brush.balanceOf(DEV), EDIT_NAME_COST * 25 / 100);
        assertEq(brush.amountBurnt(), EDIT_NAME_COST * 75 / 100);
    }

    function testANonTransferablePetCannotBeTransferred() public {
        PetNFT.BasePetInput memory input = _pet();
        input.isTransferable = false;
        _mintPet(input, 0);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(PetNFT.CannotTransferThisPet.selector, PET_ID));
        petNFT.safeTransferFrom(ALICE, DEV, PET_ID, 1, "");
        input.baseId = BASE_ID + 1;
        input.isTransferable = true;
        _mintPet(input, 0);
        vm.prank(ALICE);
        petNFT.safeTransferFrom(ALICE, DEV, PET_ID + 1, 1, "");
    }

    function testTotalSupply() public {
        assertEq(petNFT.totalSupply(), 0);
        _addPet(_pet());
        vm.startPrank(ALICE);
        petNFT.mintBatch(ALICE, _uints(BASE_ID), 1);
        petNFT.mintBatch(ALICE, _uints(BASE_ID), 1);
        assertEq(petNFT.totalSupply(), 2);
        assertEq(petNFT.totalSupply(1), 1);
        assertEq(petNFT.totalSupply(2), 1);
        petNFT.burn(ALICE, 1);
        assertEq(petNFT.totalSupply(), 1);
        assertEq(petNFT.totalSupply(1), 0);
        petNFT.burn(ALICE, 2);
        vm.stopPrank();
        assertEq(petNFT.totalSupply(), 0);
        assertEq(petNFT.totalSupply(2), 0);
    }

    function _pet() private pure returns (PetNFT.BasePetInput memory input) {
        input.tier = 2;
        input.skin = PetSkin.OG;
        input.enhancementType = PetEnhancementType.MELEE;
        input.baseId = BASE_ID;
        input.isTransferable = true;
        input.skillEnhancements = [Skill.MELEE, Skill.DEFENCE];
        input.skillFixedMins = [uint8(0), 0];
        input.skillFixedMaxs = [uint8(0), 0];
        input.skillFixedIncrements = [uint8(1), 0];
        input.skillPercentageMins = [uint8(5), 10];
        input.skillPercentageMaxs = [uint8(10), 20];
        input.skillPercentageIncrements = [uint8(1), 1];
        input.skillMinLevels = [uint8(1), 0];
        input.fixedStarThreshold = 1;
        input.percentageStarThreshold = 1;
    }

    function _addPet(PetNFT.BasePetInput memory input) private {
        _addPet(petNFT, input);
    }

    function _addPet(PetNFT target, PetNFT.BasePetInput memory input) private {
        PetNFT.BasePetInput[] memory inputs = new PetNFT.BasePetInput[](1);
        inputs[0] = input;
        target.addBasePets(inputs);
    }

    function _editPet(PetNFT.BasePetInput memory input) private {
        PetNFT.BasePetInput[] memory inputs = new PetNFT.BasePetInput[](1);
        inputs[0] = input;
        petNFT.editBasePets(inputs);
    }

    function _mintPet(PetNFT.BasePetInput memory input, uint256 randomWord) private {
        _addPet(input);
        vm.prank(ALICE);
        petNFT.mintBatch(ALICE, _uints(input.baseId), randomWord);
    }

    function _approvePetNameEdits(uint256 count) private {
        vm.prank(ALICE);
        brush.approve(address(petNFT), EDIT_NAME_COST * count);
    }

    function _fundApproveAndMint(uint256 count) private {
        _approvePetNameEdits(count);
        _mintPet(_pet(), 0);
        brush.mint(ALICE, EDIT_NAME_COST * count);
    }

    function _deployPetNFT(bool beta) private returns (PetNFT target) {
        PetNFT implementation = PetNFT(_deployArtifact("contracts/PetNFT.sol:PetNFT:via-ir"));
        target = PetNFT(
            _deployUUPS(
                address(implementation),
                abi.encodeCall(
                    PetNFT.initialize,
                    (
                        address(brush),
                        address(royaltyReceiver),
                        "ipfs://",
                        DEV,
                        uint72(EDIT_NAME_COST),
                        address(treasury),
                        address(randomnessBeacon),
                        uint40(1),
                        address(bridge),
                        address(adminAccess),
                        beta
                    )
                )
            )
        );
    }

    function _assertStringAttribute(string memory json, uint256 index, string memory trait, string memory value)
        private
    {
        string memory path = string.concat(".attributes[", vm.toString(index), "]");
        assertEq(vm.parseJsonString(json, string.concat(path, ".trait_type")), trait);
        assertEq(vm.parseJsonString(json, string.concat(path, ".value")), value);
    }

    function _assertUintAttribute(string memory json, uint256 index, string memory trait, uint256 value) private {
        string memory path = string.concat(".attributes[", vm.toString(index), "]");
        assertEq(vm.parseJsonString(json, string.concat(path, ".trait_type")), trait);
        assertEq(vm.parseJsonUint(json, string.concat(path, ".value")), value);
    }

    function _startsWith(string memory value, string memory prefix) private pure returns (bool) {
        bytes memory a = bytes(value);
        bytes memory b = bytes(prefix);
        if (a.length < b.length) return false;
        for (uint256 i; i < b.length; ++i) {
            if (a[i] != b[i]) return false;
        }
        return true;
    }

    function _uriJson(PetNFT target, uint256 id) private view returns (string memory) {
        bytes memory uriBytes = bytes(target.uri(id));
        bytes memory prefix = bytes("data:application/json;base64,");
        bytes memory encoded = new bytes(uriBytes.length - prefix.length);
        for (uint256 i; i < encoded.length; ++i) {
            encoded[i] = uriBytes[i + prefix.length];
        }
        return string(_decodeBase64(encoded));
    }

    function _decodeBase64(bytes memory data) private pure returns (bytes memory result) {
        if (data.length == 0) return new bytes(0);
        uint256 length = (data.length / 4) * 3;
        if (data[data.length - 1] == "=") --length;
        if (data[data.length - 2] == "=") --length;
        result = new bytes(length);
        uint256 output;
        for (uint256 i; i < data.length; i += 4) {
            uint256 value = (_base64Value(data[i]) << 18) | (_base64Value(data[i + 1]) << 12)
                | (_base64Value(data[i + 2]) << 6) | _base64Value(data[i + 3]);
            if (output < length) result[output++] = bytes1(uint8(value >> 16));
            if (output < length) result[output++] = bytes1(uint8(value >> 8));
            if (output < length) result[output++] = bytes1(uint8(value));
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
