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

interface PetNFT {
    struct BasePetInput {
        string description;
        uint8 tier;
        PetSkin skin;
        PetEnhancementType enhancementType;
        uint24 baseId;
        bool isTransferable;
        Skill[2] skillEnhancements;
        uint8[2] skillFixedMins;
        uint8[2] skillFixedMaxs;
        uint8[2] skillFixedIncrements;
        uint8[2] skillPercentageMins;
        uint8[2] skillPercentageMaxs;
        uint8[2] skillPercentageIncrements;
        uint8[2] skillMinLevels;
        uint16 fixedStarThreshold;
        uint16 percentageStarThreshold;
    }
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function addBasePets(PetNFT.BasePetInput[] calldata basePetInputs) external;
    function assignPet(address from_, uint256 playerId, uint256 petId, uint256 timestamp) external;
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external
        view
        returns (uint256[] memory);
    function burn(address from_, uint256 tokenId) external;
    function burnBatch(address from_, uint256[] calldata tokenIds) external;
    function editBasePets(PetNFT.BasePetInput[] calldata basePetInputs) external;
    function editPet(uint256 playerId, uint256 petId, string calldata petName) external;
    function getNextPetId() external view returns (uint256);
    function getPet(uint256 tokenId) external view returns (Pet memory);
    function initialize(
        address brush,
        address royaltyReceiver,
        string calldata imageBaseUri,
        address dev,
        uint72 editNameCost,
        address treasury,
        address randomnessBeacon,
        uint40 startPetId,
        address bridge,
        address adminAccess,
        bool isBeta
    ) external;
    function initializeAddresses(address instantVRFActions, address players, address territories) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function mintBatch(address to, uint256[] calldata basePetIds, uint256 randomWord)
        external
        returns (uint256[] memory tokenIds);
    function name() external view returns (string memory);
    function owner() external view returns (address);
    function ownerOf(uint256 tokenId) external view returns (address);
    function proxiableUUID() external view returns (bytes32);
    function renounceOwnership() external;
    function royaltyInfo(uint256 arg0, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount);
    function safeBatchTransferFrom(
        address from_,
        address to,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external;
    function safeTransferFrom(address from_, address to, uint256 id, uint256 value, bytes calldata data) external;
    function setApprovalForAll(address operator, bool approved) external;
    function setApprovedBurners(address[] calldata accounts, bool isApproved) external;
    function setApprovedMinters(address[] calldata accounts, bool isApproved) external;
    function setBridge(address bridge) external;
    function setBrushDistributionPercentages(
        uint8 brushBurntPercentage,
        uint8 brushTreasuryPercentage,
        uint8 brushDevPercentage
    ) external;
    function setDevAddress(address dev) external;
    function setEditNameCost(uint72 editNameCost) external;
    function setImageBaseUri(string calldata imageBaseUri) external;
    function setMarketplaceAddress(address marketplaceAddress) external;
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function symbol() external view returns (string memory);
    function totalSupply() external view returns (uint256);
    function totalSupply(uint256 tokenId) external view returns (uint256);
    function transferOwnership(address newOwner) external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function uri(uint256 tokenId) external view returns (string memory);
    event AddBasePets(PetNFT.BasePetInput[] basePetInputs);
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event BridgePets(uint256[] tokenIds, Pet[] pets, string[] names, address from_);
    event EditBasePets(PetNFT.BasePetInput[] basePetInputs);
    event EditNameCost(uint256 newCost);
    event EditPlayerPet(uint256 playerId, uint256 petId, address from_, string newName);
    event Initialized(uint64 version);
    event NewPets(uint256 startPetId, Pet[] pets, string[] names, address from_);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RefreshPets(uint256[] tokenIds, Pet[] pets, string[] names, address[] owners);
    event SetApprovedBurners(address[] accounts, bool isApproved);
    event SetApprovedMinters(address[] accounts, bool isApproved);
    event SetBrushDistributionPercentages(
        uint256 brushBurntPercentage, uint256 brushTreasuryPercentage, uint256 brushDevPercentage
    );
    event Train(uint256 playerId, uint256 petId, uint256 xpGained);
    event TransferBatch(
        address indexed operator, address indexed from_, address indexed to, uint256[] ids, uint256[] values
    );
    event TransferSingle(
        address indexed operator, address indexed from_, address indexed to, uint256 id, uint256 value
    );
    event URI(string value, uint256 indexed id);
    event Upgraded(address indexed implementation);
    error AddressEmptyCode(address target);
    error CannotTransferThisPet(uint256 petId);
    error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId);
    error ERC1155InvalidApprover(address approver);
    error ERC1155InvalidArrayLength(uint256 idsLength, uint256 valuesLength);
    error ERC1155InvalidOperator(address operator);
    error ERC1155InvalidReceiver(address receiver);
    error ERC1155InvalidSender(address sender);
    error ERC1155Metadata_URIQueryForNonexistentToken();
    error ERC1155MintingMoreThanOneSameNFT();
    error ERC1155MissingApprovalForAll(address operator, address owner);
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error FailedCall();
    error IllegalNameStart();
    error InvalidAddress();
    error InvalidInitialization();
    error InvalidTimestamp();
    error LengthMismatch();
    error LevelNotHighEnough(Skill skill, uint256 level);
    error MustHaveAtLeastPercentageOrFixedSet();
    error MustHaveOneSkillEnhancement();
    error NameAlreadyExists();
    error NameInvalidCharacters();
    error NameTooLong();
    error NameTooShort();
    error NotAdminAndBeta();
    error NotBridge();
    error NotBurner();
    error NotInitializing();
    error NotMinter();
    error NotOwnerOfPet();
    error NotOwnerOfPlayer();
    error NotPlayers();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error PercentNotTotal100();
    error PetAlreadyExists();
    error PetDoesNotExist();
    error PlayerDoesNotOwnPet();
    error SameName();
    error SkillEnhancementIncorrectOrder();
    error SkillEnhancementIncorrectlyFilled();
    error SkillEnhancementMinGreaterThanMax();
    error SkillFixedIncrementCannotBeZero();
    error SkillFixedMustBeAFactorOfIncrement();
    error SkillPercentageIncrementCannotBeZero();
    error SkillPercentageMustBeAFactorOfIncrement();
    error StorageSlotIncorrect();
    error TrainOnCooldown();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
}
