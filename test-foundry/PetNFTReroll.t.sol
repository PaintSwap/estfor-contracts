// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ItemNFT} from "../contracts/ItemNFT.sol";
import {PetNFT} from "../contracts/PetNFT.sol";
import {PetNFTReroll} from "../contracts/PetNFTReroll.sol";
import {Pet} from "../contracts/globals/pets.sol";
import {PET_SHARD} from "../contracts/globals/items.sol";
import {MockVRF} from "../contracts/test/MockVRF.sol";

contract PetNFTRerollTest is Test {
    event CompletePetReroll(
        address indexed user, uint256 indexed originalPetTokenId, uint256 indexed newPetTokenId, uint256 requestId
    );

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    ItemNFT private constant ITEM_NFT = ItemNFT(address(0x1111));
    PetNFT private constant PET_NFT = PetNFT(address(0x2222));
    uint256 private constant ORIGINAL_PET_TOKEN_ID = 100;
    uint24 private constant BASE_PET_ID = 1;

    PetNFTReroll private reroll;
    MockVRF private mockVRF;

    function setUp() public {
        mockVRF = new MockVRF();
        PetNFTReroll implementation = new PetNFTReroll();
        reroll = PetNFTReroll(
            address(
                new ERC1967Proxy(
                    address(implementation),
                    abi.encodeCall(implementation.initialize, (address(this), ITEM_NFT, PET_NFT, address(mockVRF)))
                )
            )
        );

        Pet memory pet;
        pet.baseId = BASE_PET_ID;
        vm.mockCall(address(PET_NFT), abi.encodeCall(PET_NFT.ownerOf, (ORIGINAL_PET_TOKEN_ID)), abi.encode(ALICE));
        vm.mockCall(address(PET_NFT), abi.encodeCall(PET_NFT.getPet, (ORIGINAL_PET_TOKEN_ID)), abi.encode(pet));
        vm.mockCall(address(ITEM_NFT), abi.encodeCall(ITEM_NFT.balanceOf, (ALICE, PET_SHARD)), abi.encode(1));
        vm.deal(ALICE, 1 ether);
        vm.deal(BOB, 1 ether);
    }

    function testRevertsWhenCallerIsNotThePetOwner() public {
        uint256 cost = reroll.requestCost(1);
        vm.expectRevert(PetNFTReroll.NotOwnerOfPet.selector);
        vm.prank(BOB);
        reroll.rerollPet{value: cost}(ORIGINAL_PET_TOKEN_ID);
    }

    function testRevertsWhenCallerDoesNotOwnAShard() public {
        vm.mockCall(address(ITEM_NFT), abi.encodeCall(ITEM_NFT.balanceOf, (ALICE, PET_SHARD)), abi.encode(0));
        uint256 cost = reroll.requestCost(1);

        vm.expectRevert(PetNFTReroll.NotOwnerOfPetShard.selector);
        vm.prank(ALICE);
        reroll.rerollPet{value: cost}(ORIGINAL_PET_TOKEN_ID);
    }

    function testRevertsWhenTheVRFFeeIsNotPaid() public {
        vm.expectRevert(abi.encodeWithSelector(MockVRF.InsufficientGasPayment.selector, 0, reroll.requestCost(1)));
        vm.prank(ALICE);
        reroll.rerollPet(ORIGINAL_PET_TOKEN_ID);
    }

    function testRerollsAPetAndConsumesOneShard() public {
        uint256 cost = reroll.requestCost(1);
        uint256 requestId = 1;
        uint256 newPetTokenId = 101;

        vm.expectCall(address(ITEM_NFT), abi.encodeCall(ITEM_NFT.burn, (ALICE, PET_SHARD, 1)));
        vm.expectCall(address(PET_NFT), abi.encodeCall(PET_NFT.burn, (ALICE, ORIGINAL_PET_TOKEN_ID)));
        vm.prank(ALICE);
        reroll.rerollPet{value: cost}(ORIGINAL_PET_TOKEN_ID);

        uint256[] memory basePetIds = new uint256[](1);
        basePetIds[0] = BASE_PET_ID;
        uint256 randomWord = uint256(keccak256(abi.encodePacked(uint256(987654322))));
        uint256[] memory newPetTokenIds = new uint256[](1);
        newPetTokenIds[0] = newPetTokenId;
        bytes memory mintCall = abi.encodeCall(PET_NFT.mintBatch, (ALICE, basePetIds, randomWord));
        vm.expectCall(address(PET_NFT), mintCall);
        vm.mockCall(address(PET_NFT), mintCall, abi.encode(newPetTokenIds));

        vm.expectEmit(true, true, true, true, address(reroll));
        emit CompletePetReroll(ALICE, ORIGINAL_PET_TOKEN_ID, newPetTokenId, requestId);
        mockVRF.fulfillSeeded(requestId, address(reroll), 987654321);

        vm.expectRevert(PetNFTReroll.RequestDoesNotExist.selector);
        mockVRF.fulfillSeeded(requestId, address(reroll), 987654321);
    }

    function testRevertsIfTheRequestDoesNotExist() public {
        vm.expectRevert(PetNFTReroll.RequestDoesNotExist.selector);
        mockVRF.fulfillSeeded(999999, address(reroll), 1);
    }
}
