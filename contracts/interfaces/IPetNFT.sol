// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IBrushToken} from "./external/IBrushToken.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {RandomnessBeacon} from "../RandomnessBeacon.sol";
import {Skill} from "../globals/misc.sol";
import {Pet, PetSkin, PetEnhancementType} from "../globals/pets.sol";
import {IERC1155MetadataURI} from "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

interface IPetNFT is IERC1155MetadataURI, IERC2981 {
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
  event NewPets(uint256 startPetId, Pet[] pets, string[] names, address from);
  event SetBrushDistributionPercentages(
    uint256 brushBurntPercentage,
    uint256 brushTreasuryPercentage,
    uint256 brushDevPercentage
  );
  event EditPlayerPet(uint256 playerId, uint256 petId, address from, string newName);
  event AddBasePets(BasePetInput[] basePetInputs);
  event EditBasePets(BasePetInput[] basePetInputs);
  event EditNameCost(uint256 newCost);
  event Train(uint256 playerId, uint256 petId, uint256 xpGained);
  event SetApprovedMinters(address[] accounts, bool isApproved);
  event SetApprovedBurners(address[] accounts, bool isApproved);
  event BridgePets(uint256[] tokenIds, Pet[] pets, string[] names, address from);
  event RefreshPets(uint256[] tokenIds, Pet[] pets, string[] names, address[] owners);
  error PetAlreadyExists();
  error PetDoesNotExist();
  error ERC1155Metadata_URIQueryForNonexistentToken();
  error NotAdminAndBeta();
  error PlayerDoesNotOwnPet();
  error NotOwnerOfPet();
  error NotOwnerOfPlayer();
  error InvalidTimestamp();
  error StorageSlotIncorrect();
  error NotMinter();
  error NotBridge();
  error NotBurner();
  error NameAlreadyExists();
  error NameTooLong();
  error NameTooShort();
  error NameInvalidCharacters();
  error PercentNotTotal100();
  error InvalidAddress();
  error SkillEnhancementIncorrectOrder();
  error SkillPercentageIncrementCannotBeZero();
  error SkillPercentageMustBeAFactorOfIncrement();
  error SkillEnhancementMinGreaterThanMax();
  error MustHaveOneSkillEnhancement();
  error SkillEnhancementIncorrectlyFilled();
  error MustHaveAtLeastPercentageOrFixedSet();
  error LengthMismatch();
  error LevelNotHighEnough(Skill skill, uint256 level);
  error SkillFixedIncrementCannotBeZero();
  error SkillFixedMustBeAFactorOfIncrement();
  error NotPlayers();
  error IllegalNameStart();
  error SameName();
  error CannotTransferThisPet(uint256 petId);
  error TrainOnCooldown();
  function initialize(
    IBrushToken brush,
    address royaltyReceiver,
    string calldata imageBaseUri,
    address dev,
    uint72 editNameCost,
    address treasury,
    RandomnessBeacon randomnessBeacon,
    uint40 startPetId,
    address bridge,
    AdminAccess adminAccess,
    bool isBeta
  ) external;
  function editPet(uint256 playerId, uint256 petId, string calldata petName) external;
  function assignPet(address from, uint256 playerId, uint256 petId, uint256 timestamp) external;
  function mintBatch(address to, uint256[] calldata basePetIds, uint256 randomWord) external returns (uint256[] memory);
  function burnBatch(address from, uint256[] calldata tokenIds) external;
  function burn(address from, uint256 tokenId) external;
  function getPet(uint256 tokenId) external view returns (Pet memory);
  function ownerOf(uint256 tokenId) external view returns (address);
  function uri(uint256 tokenId) external view returns (string memory);
  function name() external view returns (string memory);
  function symbol() external view returns (string memory);
  function getNextPetId() external view returns (uint256);
  function setImageBaseUri(string calldata imageBaseUri) external;
  function setEditNameCost(uint72 editNameCost) external;
  function initializeAddresses(address instantVRFActions, address players, address territories) external;
  function setApprovedMinters(address[] calldata accounts, bool isApproved) external;
  function setApprovedBurners(address[] calldata accounts, bool isApproved) external;
  function addBasePets(BasePetInput[] calldata basePetInputs) external;
  function editBasePets(BasePetInput[] calldata basePetInputs) external;
  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external;
  function setDevAddress(address dev) external;
  function setBridge(address bridge) external;
  function setMarketplaceAddress(address marketplaceAddress) external;
}
