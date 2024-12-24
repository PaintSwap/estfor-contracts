// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SamWitchERC1155UpgradeableSinglePerToken} from "./SamWitchERC1155UpgradeableSinglePerToken.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {AdminAccess} from "./AdminAccess.sol";
import {RandomnessBeacon} from "./RandomnessBeacon.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {IBrushToken} from "./interfaces/external/IBrushToken.sol";

import {SkillLibrary} from "./libraries/SkillLibrary.sol";

import {EstforLibrary} from "./EstforLibrary.sol";
import {PetNFTLibrary} from "./PetNFTLibrary.sol";

import {BloomFilter} from "./libraries/BloomFilter.sol";

// solhint-disable-next-line no-global-import
import {Skill} from "./globals/misc.sol";
import {Pet, PetSkin, PetEnhancementType, BasePetMetadata} from "./globals/pets.sol";

// The NFT contract contains data related to the pets and who owns them.
// It does not use the standard OZ _balances for tracking, instead it packs the owner
// into the pet struct and avoid updating multiple to/from balances using
// SamWitchERC1155UpgradeableSinglePerToken is a custom OZ ERC1155 implementation that optimizes for token ids with singular amounts
contract PetNFT is SamWitchERC1155UpgradeableSinglePerToken, UUPSUpgradeable, OwnableUpgradeable, IERC2981 {
  using SkillLibrary for Skill;
  using BloomFilter for BloomFilter.Filter;

  event NewPets(uint256 startPetId, Pet[] pets, string[] names, address from);
  event BridgePets(uint256[] tokenIds, Pet[] pets, string[] names, address from);
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
  error PetNameIsReserved(string name);

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

  // From base class uint40 _totalSupplyAll
  uint40 private _nextPetId;
  address private _instantVRFActions;

  mapping(uint256 basePetId => BasePetMetadata metadata) private _basePetMetadatas;
  mapping(uint256 petId => Pet pet) private _pets;
  mapping(uint256 petId => string name) private _names;
  mapping(string name => bool exists) private _lowercaseNames;
  string private _imageBaseUri;

  // Royalties
  address private _royaltyReceiver;
  uint8 private _royaltyFee; // base 1000, highest is 25.5

  AdminAccess private _adminAccess;
  bool private _isBeta;

  address private _dev;
  IBrushToken private _brush;
  address private _treasury;
  uint72 private _editNameCost; // Max is 4700 BRUSH
  uint8 private _brushBurntPercentage;
  uint8 private _brushTreasuryPercentage;
  uint8 private _brushDevPercentage;
  address private _territories;
  address private _players;
  RandomnessBeacon private _randomnessBeacon;
  BloomFilter.Filter private __unused; // TODO: old filter
  address private _bridge; // TODO: Bridge Can remove later
  BloomFilter.Filter private __unused2; // TODO: old filter 2
  BloomFilter.Filter private _reservedPetNames; // TODO: remove 90 days after launch

  string private constant PET_NAME_LOWERCASE_PREFIX = "pet ";

  modifier onlyBridge() {
    require(_msgSender() == _bridge, NotBridge());
    _;
  }

  modifier onlyMinters() {
    require(_msgSender() == _instantVRFActions || (_adminAccess.isAdmin(_msgSender()) && _isBeta), NotMinter());
    _;
  }

  modifier onlyBurners(address from) {
    require(_msgSender() == from || isApprovedForAll(from, _msgSender()), NotBurner());
    _;
  }

  modifier onlyPlayersOrAdminAndBeta() {
    require(_msgSender() == _players, NotPlayers());
    _;
  }

  modifier isOwnerOfPet(uint256 petId) {
    require(_pets[petId].owner == _msgSender(), NotOwnerOfPet());
    _;
  }

  modifier isOwnerOfPlayer(uint256 playerId) {
    require(IPlayers(_players).isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayer());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

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
  ) external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();
    __SamWitchERC1155UpgradeableSinglePerToken_init("");

    bool storageSlotCorrect;
    assembly ("memory-safe") {
      storageSlotCorrect := eq(_nextPetId.slot, _totalSupplyAll.slot)
    }
    require(storageSlotCorrect, StorageSlotIncorrect());

    _brush = brush;
    _royaltyFee = 30; // 3%
    _royaltyReceiver = royaltyReceiver;
    _adminAccess = adminAccess;
    _imageBaseUri = imageBaseUri;
    _dev = dev;
    _isBeta = isBeta;
    _nextPetId = startPetId;
    _treasury = treasury;
    _randomnessBeacon = randomnessBeacon;
    setEditNameCost(editNameCost);
    // TODO: Remove after migration is done
    _reservedPetNames._initialize(4, 100000);
    _bridge = bridge;
  }

  function editPet(
    uint256 playerId,
    uint256 petId,
    string calldata petName
  ) external isOwnerOfPlayer(playerId) isOwnerOfPet(petId) {
    (string memory trimmedName, string memory trimmedAndLowercaseName, bool nameChanged) = _setName(petId, petName);

    require(nameChanged, SameName());

    _pay(_editNameCost);

    // Check trimmed name does not start with "Pet " as those are reserved
    if (bytes(trimmedAndLowercaseName).length > 3) {
      require(
        !(bytes(trimmedAndLowercaseName)[0] == bytes(PET_NAME_LOWERCASE_PREFIX)[0] &&
          bytes(trimmedAndLowercaseName)[1] == bytes(PET_NAME_LOWERCASE_PREFIX)[1] &&
          bytes(trimmedAndLowercaseName)[2] == bytes(PET_NAME_LOWERCASE_PREFIX)[2] &&
          bytes(trimmedAndLowercaseName)[3] == bytes(PET_NAME_LOWERCASE_PREFIX)[3]),
        IllegalNameStart()
      );
    }

    emit EditPlayerPet(playerId, petId, _msgSender(), trimmedName);
  }

  function assignPet(
    address from,
    uint256 playerId,
    uint256 petId,
    uint256 timestamp
  ) external onlyPlayersOrAdminAndBeta {
    // If pet is already assigned then don't change timestamp
    Pet storage pet = _pets[petId];
    require(ownerOf(petId) == from, PlayerDoesNotOwnPet());

    // Check skill minimum levels are met
    Skill skillEnhancement1 = _basePetMetadatas[pet.baseId].skillEnhancement1;
    uint256 skillMinLevel1 = _basePetMetadatas[pet.baseId].skillMinLevel1;
    require(
      IPlayers(_players).getLevel(playerId, skillEnhancement1) >= skillMinLevel1,
      LevelNotHighEnough(skillEnhancement1, skillMinLevel1)
    );

    Skill skillEnhancement2 = _basePetMetadatas[pet.baseId].skillEnhancement2;
    if (skillEnhancement2 != Skill.NONE) {
      uint256 skillMinLevel2 = _basePetMetadatas[pet.baseId].skillMinLevel2;
      require(
        IPlayers(_players).getLevel(playerId, skillEnhancement2) >= skillMinLevel2,
        LevelNotHighEnough(skillEnhancement2, skillMinLevel2)
      );
    }

    if (pet.lastAssignmentTimestamp <= timestamp) {
      return;
    }

    pet.lastAssignmentTimestamp = uint40(timestamp);
  }

  function mintBatch(
    address to,
    uint256[] calldata basePetIds,
    uint256 randomWord
  ) external onlyMinters returns (uint256[] memory tokenIds) {
    tokenIds = new uint256[](basePetIds.length);
    uint256[] memory amounts = new uint256[](basePetIds.length);
    string[] memory names = new string[](basePetIds.length);
    Pet[] memory pets = new Pet[](basePetIds.length);

    uint256 startPetId = _nextPetId;
    for (uint256 i = 0; i < pets.length; ++i) {
      randomWord = uint256(keccak256(abi.encodePacked(randomWord))); // Get a new random word for each pet
      uint256 petId = startPetId + i;
      Pet memory pet = _createRandomPet(petId, basePetIds[i], randomWord);
      pets[i] = pet;
      tokenIds[i] = petId;
      amounts[i] = 1;
      _names[i] = PetNFTLibrary._defaultPetName(petId);
    }
    // Mint first
    _mintBatch(to, tokenIds, amounts, "");
    _nextPetId = uint40(startPetId + pets.length);
    emit NewPets(startPetId, pets, names, to);
  }

  function mintBridge(
    address petOwner,
    uint256[] calldata petIds,
    uint24[] calldata basePetIds,
    string[] memory petNames,
    Skill[] calldata skillEnhancement1s,
    uint8[] calldata skillFixedEnhancement1s,
    uint8[] calldata skillPercentageEnhancement1,
    Skill[] calldata skillEnhancement2s,
    uint8[] calldata skillFixedEnhancement2s,
    uint8[] calldata skillPercentageEnhancement2s
  ) external onlyBridge {
    uint256 length = petIds.length;
    require(
      length == basePetIds.length &&
        length == skillEnhancement1s.length &&
        length == skillFixedEnhancement1s.length &&
        length == skillPercentageEnhancement1.length &&
        length == skillEnhancement2s.length &&
        length == skillFixedEnhancement2s.length &&
        length == skillPercentageEnhancement2s.length,
      LengthMismatch()
    );

    Pet[] memory pets = new Pet[](length);
    uint256[] memory amounts = new uint256[](length);

    // Use the randomness beacon with the first day to assign some random pet enhancements
    uint256 id = 1; // Doesn't really matter

    uint256 startTimeWorld = _randomnessBeacon.getStartTime();
    bytes memory randomBytes = _randomnessBeacon.getRandomBytes(length, startTimeWorld, startTimeWorld + 1 days, id);

    for (uint256 i = 0; i < length; ++i) {
      // Take 2 byte portions of all the bytes for each pet
      uint16 randomness = EstforLibrary._get16bitSlice(randomBytes, i);
      uint24 basePetId = basePetIds[i];

      // Calculate maximum enhancements using randomness
      // For fixed enhancements: bound between current value and max from metadata
      uint8 fixedMax1 = EstforLibrary._getRandomInRange8(
        uint8(skillFixedEnhancement1s[i]),
        _basePetMetadatas[basePetId].skillFixedMax1,
        uint8(randomness) // Use first 8 bits
      );

      uint8 fixedMax2 = EstforLibrary._getRandomInRange8(
        uint8(skillFixedEnhancement2s[i]),
        _basePetMetadatas[basePetId].skillFixedMax2,
        uint8(randomness >> 8) // Use second 8 bits
      );

      // For percentage enhancements: bound between current value and max from metadata
      uint8 percentageMax1 = EstforLibrary._getRandomInRange8(
        uint8(skillPercentageEnhancement1[i]),
        _basePetMetadatas[basePetId].skillPercentageMax1,
        uint8((uint256(randomness) * 7919) >> 8) // Use scrambled bits for more randomness
      );

      uint8 percentageMax2 = EstforLibrary._getRandomInRange8(
        uint8(skillPercentageEnhancement2s[i]),
        _basePetMetadatas[basePetId].skillPercentageMax2,
        uint8((uint256(randomness) * 6271) >> 8) // Use different scrambled bits
      );
      pets[i] = _createPet(
        petIds[i],
        skillEnhancement1s[i],
        skillFixedEnhancement1s[i],
        skillPercentageEnhancement1[i],
        skillEnhancement2s[i],
        skillFixedEnhancement2s[i],
        skillPercentageEnhancement2s[i],
        basePetIds[i],
        fixedMax1,
        fixedMax2,
        percentageMax1,
        percentageMax2
      );
      amounts[i] = 1;
      bool isDefaultPetName = bytes(petNames[i]).length == 0;
      if (!isDefaultPetName) {
        _names[petIds[i]] = petNames[i];
        string memory lowercaseName = EstforLibrary.toLower(petNames[i]);
        _lowercaseNames[lowercaseName] = true;
      } else {
        petNames[i] = PetNFTLibrary._defaultPetName(petIds[i]);
      }
    }
    _mintBatch(petOwner, petIds, amounts, "");
    emit BridgePets(petIds, pets, petNames, petOwner);
  }

  function burnBatch(address from, uint256[] calldata tokenIds) external onlyBurners(from) {
    _burnBatch(from, tokenIds);
  }

  function burn(address from, uint256 tokenId) external onlyBurners(from) {
    _burn(from, tokenId, 1);
  }

  // Not used yet
  /*  function requestTrain(
    uint256 playerId,
    uint256 petId,
    uint256 timestamp
  ) external isOwnerOfPlayer(playerId) isOwnerOfPet(petId) {
    assert(false);
    uint256 lastTrainedDay = _pets[petId].lastTrainedTimestamp / 1 days;
    uint256 currentDay = timestamp / 1 days;
    require(lastTrainedDay < currentDay, TrainOnCooldown());

    // Still possible to train up? Harder to train up higher level pets? Requires multiple days?
    uint64 currentXP = _pets[petId].xp;

    // TODO: Use randomnessBeacon xpGained
    uint64 xpGained = 100;
    _pets[petId].xp = currentXP + xpGained;
    _pets[petId].lastTrainedTimestamp = uint40(timestamp);
    // TODO: Levelled up?
    emit Train(playerId, petId, xpGained);
  } */

  function _createRandomPet(uint256 petId, uint256 _basePetId, uint256 randomWord) private returns (Pet memory pet) {
    require(_basePetMetadatas[_basePetId].skillEnhancement1 != Skill.NONE, PetDoesNotExist());

    // Fixed enhancement for skill 1
    uint256 skillFixedMin1 = _basePetMetadatas[_basePetId].skillFixedMin1;
    uint256 skillFixedMax1 = _basePetMetadatas[_basePetId].skillFixedMax1;
    uint256 skillFixedEnhancement1 = skillFixedMin1;

    uint256 skillFixedEnhancementMax1;
    uint256 skillPercentageEnhancementMax1;
    if (skillFixedMax1 != skillFixedMin1) {
      skillFixedEnhancement1 =
        (uint8(randomWord) %
          (((skillFixedMax1 - skillFixedMin1 + 1) / _basePetMetadatas[_basePetId].skillFixedIncrement1))) +
        skillFixedMin1;

      skillFixedEnhancementMax1 =
        skillFixedEnhancement1 +
        (uint8(randomWord >> 8) % (skillFixedMax1 - skillFixedEnhancement1 + 1));
    } else {
      skillFixedEnhancementMax1 = skillFixedMin1;
    }

    // Percentage enhancement for skill 1
    uint256 skillPercentageMin1 = _basePetMetadatas[_basePetId].skillPercentageMin1;
    uint256 skillPercentageMax1 = _basePetMetadatas[_basePetId].skillPercentageMax1;
    uint256 skillPercentageEnhancement1 = skillPercentageMin1;
    if (skillPercentageMax1 != skillPercentageMin1) {
      skillPercentageEnhancement1 =
        (uint8(randomWord >> 16) %
          (
            ((skillPercentageMax1 - skillPercentageMin1 + 1) / _basePetMetadatas[_basePetId].skillPercentageIncrement1)
          )) +
        skillPercentageMin1;

      skillPercentageEnhancementMax1 =
        skillPercentageEnhancement1 +
        (uint8(randomWord >> 24) % (skillPercentageMax1 - skillPercentageEnhancement1 + 1));
    } else {
      skillPercentageEnhancementMax1 = skillPercentageMin1;
    }

    // Skill 2
    Skill skillEnhancement2 = _basePetMetadatas[_basePetId].skillEnhancement2;
    uint256 skillFixedEnhancement2;
    uint256 skillPercentageEnhancement2;
    uint256 skillFixedEnhancementMax2;
    uint256 skillPercentageEnhancementMax2;
    if (skillEnhancement2 != Skill.NONE) {
      // Fixed enhancement
      uint256 skillFixedMin2 = _basePetMetadatas[_basePetId].skillFixedMin2;
      uint256 skillFixedMax2 = _basePetMetadatas[_basePetId].skillFixedMax2;

      if (skillFixedMax2 != skillFixedMin2) {
        skillFixedEnhancement2 =
          (uint8(randomWord >> 32) %
            (((skillFixedMax2 - skillFixedMin2 + 1) / _basePetMetadatas[_basePetId].skillFixedIncrement2))) +
          skillFixedMin2;

        skillFixedEnhancementMax2 =
          skillFixedEnhancement2 +
          (uint8(randomWord >> 40) % (skillFixedMax2 - skillFixedEnhancement2 + 1));
      } else {
        skillFixedEnhancement2 = skillFixedMin2;
        skillFixedEnhancementMax2 = skillFixedMin2;
      }

      // Percentage enhancement
      uint256 skillPercentageMin2 = _basePetMetadatas[_basePetId].skillPercentageMin2;
      uint256 skillPercentageMax2 = _basePetMetadatas[_basePetId].skillPercentageMax2;
      if (skillPercentageMax2 != skillPercentageMin2) {
        skillPercentageEnhancement2 =
          (uint8(randomWord >> 48) %
            (
              ((skillPercentageMax2 - skillPercentageMin2 + 1) /
                _basePetMetadatas[_basePetId].skillPercentageIncrement2)
            )) +
          skillPercentageMin2;

        skillPercentageEnhancementMax2 =
          skillPercentageEnhancement2 +
          (uint8(randomWord >> 56) % (skillPercentageMax2 - skillPercentageEnhancement2 + 1));
      } else {
        skillPercentageEnhancement2 = skillPercentageMin2;
        skillPercentageEnhancementMax2 = skillPercentageMin2;
      }
    }

    return
      _createPet(
        petId,
        _basePetMetadatas[_basePetId].skillEnhancement1,
        uint8(skillFixedEnhancement1),
        uint8(skillPercentageEnhancement1),
        skillEnhancement2,
        uint8(skillFixedEnhancement2),
        uint8(skillPercentageEnhancement2),
        uint24(_basePetId),
        uint8(skillFixedEnhancementMax1),
        uint8(skillFixedEnhancementMax2),
        uint8(skillPercentageEnhancementMax1),
        uint8(skillPercentageEnhancementMax2)
      );
  }

  function _createPet(
    uint256 petId,
    Skill skillEnhancement1,
    uint8 skillFixedEnhancement1,
    uint8 skillPercentageEnhancement1,
    Skill skillEnhancement2,
    uint8 skillFixedEnhancement2,
    uint8 skillPercentageEnhancement2,
    uint24 basePetId,
    uint8 skillFixedEnhancementMax1,
    uint8 skillFixedEnhancementMax2,
    uint8 skillPercentageEnhancementMax1,
    uint8 skillPercentageEnhancementMax2
  ) private returns (Pet memory pet) {
    require(skillEnhancement1 != Skill.NONE, PetDoesNotExist());

    pet = Pet(
      _basePetMetadatas[basePetId].skillEnhancement1,
      uint8(skillFixedEnhancement1),
      uint8(skillPercentageEnhancement1),
      skillEnhancement2,
      uint8(skillFixedEnhancement2),
      uint8(skillPercentageEnhancement2),
      type(uint40).max, // Will be updated in _mintBatch
      address(0), // Will be updated in _mintBatch
      _basePetMetadatas[basePetId].isTransferable,
      uint24(basePetId),
      0, // lastTrainedTimestamp
      uint8(skillFixedEnhancementMax1),
      uint8(skillFixedEnhancementMax2),
      uint8(skillPercentageEnhancementMax1),
      uint8(skillPercentageEnhancementMax2),
      0 // xp
    );

    // Store the pet by id
    _pets[petId] = pet;
    return pet;
  }

  function _setName(
    uint256 petId,
    string memory petName
  ) private returns (string memory trimmedName, string memory trimmedAndLowercaseName, bool nameChanged) {
    // Trimmed name cannot be empty
    trimmedName = EstforLibrary.trim(petName);
    require(bytes(trimmedName).length >= 3, NameTooShort());
    require(bytes(trimmedName).length <= 15, NameTooLong());
    require(EstforLibrary.containsValidNameCharacters(trimmedName), NameInvalidCharacters());

    trimmedAndLowercaseName = EstforLibrary.toLower(trimmedName);
    string memory oldName = EstforLibrary.toLower(PetNFTLibrary._getPetName(petId, _names[petId]));
    nameChanged = keccak256(abi.encodePacked(oldName)) != keccak256(abi.encodePacked(trimmedAndLowercaseName));
    if (nameChanged) {
      require(
        !_reservedPetNames._probablyContainsString(trimmedAndLowercaseName),
        PetNameIsReserved(trimmedAndLowercaseName)
      );
      require(!_lowercaseNames[trimmedAndLowercaseName], NameAlreadyExists());
      if (bytes(oldName).length != 0) {
        delete _lowercaseNames[oldName];
      }
      _lowercaseNames[trimmedAndLowercaseName] = true;
      _names[petId] = trimmedName;
    }
  }

  function _pay(uint256 tokenCost) private {
    if (tokenCost == 0) {
      return;
    }

    address[] memory recipients = new address[](2);
    uint256[] memory amounts = new uint256[](2);
    recipients[0] = _treasury;
    amounts[0] = (tokenCost * _brushTreasuryPercentage) / 100;

    recipients[1] = _dev;
    amounts[1] = (tokenCost * _brushDevPercentage) / 100;

    _brush.transferFromBulk(_msgSender(), recipients, amounts);

    if (_brushBurntPercentage != 0) {
      _brush.burnFrom(_msgSender(), (tokenCost * _brushBurntPercentage) / 100);
    }
  }

  function _updateOwner(uint256 id, address from, address to) internal override {
    if (to == address(0)) {
      // Burnt
      delete _pets[id];
    } else {
      // Cannot transfer some pets like anniversary
      require(from == address(0) || _pets[id].isTransferable, CannotTransferThisPet(id));
      _pets[id].owner = to;
      _pets[id].lastAssignmentTimestamp = uint40(block.timestamp);
    }
  }

  function _setBasePet(BasePetInput calldata basePetInput) private {
    require(
      basePetInput.skillEnhancements[0] != Skill.NONE || basePetInput.skillEnhancements[1] != Skill.NONE,
      MustHaveOneSkillEnhancement()
    );

    require(
      basePetInput.skillEnhancements[0] != Skill.NONE || basePetInput.skillEnhancements[1] == Skill.NONE,
      SkillEnhancementIncorrectOrder()
    );

    _checkBasePet(basePetInput, 0);
    _checkBasePet(basePetInput, 1);

    _basePetMetadatas[basePetInput.baseId] = BasePetMetadata(
      basePetInput.description,
      basePetInput.tier,
      basePetInput.skin,
      basePetInput.enhancementType,
      basePetInput.skillEnhancements[0],
      basePetInput.skillFixedMins[0],
      basePetInput.skillFixedMaxs[0],
      basePetInput.skillFixedIncrements[0],
      basePetInput.skillPercentageMins[0],
      basePetInput.skillPercentageMaxs[0],
      basePetInput.skillPercentageIncrements[0],
      basePetInput.skillMinLevels[0],
      basePetInput.skillEnhancements[1],
      basePetInput.skillFixedMins[1],
      basePetInput.skillFixedMaxs[1],
      basePetInput.skillFixedIncrements[1],
      basePetInput.skillPercentageMins[1],
      basePetInput.skillPercentageMaxs[1],
      basePetInput.skillPercentageIncrements[1],
      basePetInput.skillMinLevels[1],
      basePetInput.fixedStarThreshold,
      basePetInput.percentageStarThreshold,
      basePetInput.isTransferable
    );
  }

  function _checkBasePet(BasePetInput calldata basePetInput, uint256 index) private pure {
    bool isSkillSet = basePetInput.skillEnhancements[index] != Skill.NONE;
    if (!isSkillSet) {
      return;
    }

    // Check percentage values are correct
    require(
      basePetInput.skillPercentageMaxs[index] != 0 || basePetInput.skillFixedMaxs[index] != 0,
      MustHaveAtLeastPercentageOrFixedSet()
    );

    require(
      basePetInput.skillPercentageMins[index] <= basePetInput.skillPercentageMaxs[index],
      SkillEnhancementMinGreaterThanMax()
    );

    uint256 percentageIncrement = basePetInput.skillPercentageIncrements[index];
    require(
      percentageIncrement == 0 ||
        ((basePetInput.skillPercentageMins[index] % percentageIncrement) == 0 &&
          (basePetInput.skillPercentageMaxs[index] % percentageIncrement) == 0),
      SkillPercentageMustBeAFactorOfIncrement()
    );
    require(
      basePetInput.skillPercentageMaxs[index] == 0 || basePetInput.skillPercentageIncrements[index] != 0,
      SkillPercentageIncrementCannotBeZero()
    );

    // Check skill fixed values are correct.
    require(
      basePetInput.skillFixedMins[index] <= basePetInput.skillFixedMaxs[index],
      SkillEnhancementMinGreaterThanMax()
    );

    uint256 fixedIncrement = basePetInput.skillFixedIncrements[index];
    require(basePetInput.skillFixedMaxs[index] == 0 || fixedIncrement != 0, SkillFixedIncrementCannotBeZero());

    require(
      fixedIncrement == 0 ||
        ((basePetInput.skillFixedMins[index] % fixedIncrement) == 0 &&
          (basePetInput.skillFixedMaxs[index] % fixedIncrement) == 0),
      SkillFixedMustBeAFactorOfIncrement()
    );
  }

  function _basePetExists(BasePetInput calldata basePetInput) private view returns (bool) {
    return _basePetMetadatas[basePetInput.baseId].skillEnhancement1 != Skill.NONE;
  }

  /**
   * @dev Returns whether `_tokenId` exists.
   */
  function _exists(uint256 tokenId) internal view override returns (bool) {
    return _pets[tokenId].owner != address(0);
  }

  function getPet(uint256 tokenId) external view returns (Pet memory) {
    return _pets[tokenId];
  }

  function ownerOf(uint256 tokenId) public view override returns (address) {
    return _pets[tokenId].owner;
  }

  function uri(uint256 tokenId) public view virtual override returns (string memory) {
    require(_exists(tokenId), ERC1155Metadata_URIQueryForNonexistentToken());

    Pet storage pet = _pets[tokenId];
    BasePetMetadata storage basePetMetadata = _basePetMetadatas[pet.baseId];

    return PetNFTLibrary.uri(basePetMetadata, pet, tokenId, _imageBaseUri, _names[tokenId], _isBeta);
  }

  function royaltyInfo(
    uint256 /*_tokenId*/,
    uint256 salePrice
  ) external view override returns (address receiver, uint256 royaltyAmount) {
    uint256 amount = (salePrice * _royaltyFee) / 1000;
    return (_royaltyReceiver, amount);
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(IERC165, SamWitchERC1155UpgradeableSinglePerToken) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked("Estfor Pets", _isBeta ? " (Beta)" : ""));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked("EK_PETS", _isBeta ? "_B" : ""));
  }

  function getNextPetId() external view returns (uint256) {
    return _nextPetId;
  }

  function setImageBaseUri(string calldata imageBaseUri) external onlyOwner {
    _imageBaseUri = imageBaseUri;
  }

  function setEditNameCost(uint72 editNameCost) public onlyOwner {
    _editNameCost = editNameCost;
    emit EditNameCost(editNameCost);
  }

  function initializeAddresses(address instantVRFActions, address players, address territories) external onlyOwner {
    _instantVRFActions = instantVRFActions;
    _players = players;
    _territories = territories;
  }

  function addBasePets(BasePetInput[] calldata basePetInputs) external onlyOwner {
    for (uint256 i; i < basePetInputs.length; ++i) {
      BasePetInput calldata basePetInput = basePetInputs[i];
      require(!_basePetExists(basePetInput), PetAlreadyExists());
      _setBasePet(basePetInput);
    }
    emit AddBasePets(basePetInputs);
  }

  function editBasePets(BasePetInput[] calldata basePetInputs) external onlyOwner {
    for (uint256 i = 0; i < basePetInputs.length; ++i) {
      BasePetInput calldata basePetInput = basePetInputs[i];
      require(_basePetExists(basePetInput), PetDoesNotExist());

      // DO NOT change skills of existing pets
      require(
        _basePetMetadatas[basePetInput.baseId].skillEnhancement1 == basePetInput.skillEnhancements[0],
        SkillEnhancementIncorrectlyFilled()
      );
      require(
        _basePetMetadatas[basePetInput.baseId].skillEnhancement2 == basePetInput.skillEnhancements[1],
        SkillEnhancementIncorrectlyFilled()
      );

      _setBasePet(basePetInput);
    }
    emit EditBasePets(basePetInputs);
  }

  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external onlyOwner {
    require(brushBurntPercentage + brushTreasuryPercentage + brushDevPercentage == 100, PercentNotTotal100());

    _brushBurntPercentage = brushBurntPercentage;
    _brushTreasuryPercentage = brushTreasuryPercentage;
    _brushDevPercentage = brushDevPercentage;
    emit SetBrushDistributionPercentages(brushBurntPercentage, brushTreasuryPercentage, brushDevPercentage);
  }

  function setReservedNameBits(uint256[] calldata positions) external onlyOwner {
    _reservedPetNames._addPositions(positions);
  }

  function setBridge(address bridge) external onlyOwner {
    _bridge = bridge;
  }

  function isPetNameReserved(string calldata petName) public view returns (bool) {
    return _reservedPetNames._probablyContainsString(EstforLibrary.toLower(petName));
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
