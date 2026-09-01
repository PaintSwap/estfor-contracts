// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../contracts/globals/actions.sol";
import "../../contracts/globals/clans.sol";
import "../../contracts/globals/items.sol";
import "../../contracts/globals/misc.sol";
import "../../contracts/globals/pets.sol";
import "../../contracts/globals/players.sol";
import "../../contracts/globals/promotions.sol";
import "../../contracts/globals/quests.sol";
import "../../contracts/globals/rewards.sol";

interface PetNFTReroll {
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function initialize(address owner, address itemNFT, address petNFT, address paintswapVRFConsumer) external;
    function owner() external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
    function renounceOwnership() external;
    function requestCost(uint256 numActions) external view returns (uint256);
    function rerollPet(uint256 petTokenId) external payable;
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    event CompletePetReroll(
        address indexed user, uint256 indexed originalPetTokenId, uint256 indexed newPetTokenId, uint256 requestId
    );
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RequestPetReroll(address indexed user, uint256 indexed petTokenId, uint256 requestId);
    event Upgraded(address indexed implementation);
    event VRFCoordinatorSet(address indexed coordinator);
    error AddressEmptyCode(address target);
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error InvalidAddress();
    error InvalidInitialization();
    error NoRandomWords();
    error NotInitializing();
    error NotOwnerOfPet();
    error NotOwnerOfPetShard();
    error OnlyVRFCoordinator(address sender, address coordinator);
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error RequestDoesNotExist();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error ZeroAddress();
}
