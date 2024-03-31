// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155UpgradeableSinglePerToken} from "./ozUpgradeable/token/ERC1155/ERC1155UpgradeableSinglePerToken.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {IERC2981, IERC165} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {AdminAccess} from "./AdminAccess.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {IBrushToken} from "./interfaces/IBrushToken.sol";

import {EstforLibrary} from "./EstforLibrary.sol";

// solhint-disable-next-line no-global-import
import {Skill} from "./globals/misc.sol";
import {Pet, PetSkin, PetEnhancementType} from "./globals/pets.sol";

// The NFT contract contains data related to the pets and who owns them.
// It does not use the standard OZ _balances for tracking, instead it packs the owner
// into the pet struct and avoid updating multiple to/from balances using
// ERC1155UpgradeableSinglePerToken is a custom OZ ERC1155 implementation that optimizes for token ids with singular amounts
contract PetNFT is UUPSUpgradeable, OwnableUpgradeable, ERC1155UpgradeableSinglePerToken, IERC2981 {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using UnsafeMath for uint40;
  using Strings for uint256;

  event NewPet(uint petId, Pet pet, string name, address from);
  event NewPets(uint startPetId, Pet[] pets, string[] names, address from);
  event SetBrushDistributionPercentages(
    uint brushBurntPercentage,
    uint brushPoolPercentage,
    uint brushDevPercentage,
    uint brushTerritoriesPercentage
  );
  event EditPlayerPet(uint playerId, uint petId, address from, string newName);
  event AddBasePets(BasePetInput[] basePetInputs);
  event EditBasePets(BasePetInput[] basePetInputs);
  event EditNameCost(uint newCost);

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
  error NotBurner();
  error NameAlreadyExists();
  error NameTooLong();
  error NameTooShort();
  error NameInvalidCharacters();
  error NotSupportedYet();
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
  error InvalidSkin(PetSkin skin);
  error InvalidPetEnahncementType(PetEnhancementType petEnhancementType);
  error LevelNotHighEnough(Skill skill, uint level);
  error SkillFixedIncrementCannotBeZero();
  error SkillFixedMustBeAFactorOfIncrement();
  error NotPlayersOrAdminAndBeta();
  error IllegalNameStart();
  error SameName();

  struct BasePetInput {
    string description;
    uint8 tier;
    PetSkin skin;
    PetEnhancementType enhancementType;
    uint24 baseId;
    Skill[2] skillEnhancements;
    uint8[2] skillFixedMins;
    uint8[2] skillFixedMaxs;
    uint8[2] skillFixedIncrements;
    uint8[2] skillPercentageMins;
    uint8[2] skillPercentageMaxs;
    uint8[2] skillPercentageIncrements;
    uint8[2] skillMinLevels;
  }

  struct BasePetMetadata {
    string description;
    uint8 tier;
    PetSkin skin;
    PetEnhancementType enhancementType;
    Skill skillEnhancement1;
    uint8 skillFixedMin1;
    uint8 skillFixedMax1;
    uint8 skillFixedIncrement1;
    uint8 skillPercentageMin1;
    uint8 skillPercentageMax1;
    uint8 skillPercentageIncrement1;
    uint8 skillMinLevel1;
    Skill skillEnhancement2;
    uint8 skillFixedMin2;
    uint8 skillFixedMax2;
    uint8 skillFixedIncrement2;
    uint8 skillPercentageMin2;
    uint8 skillPercentageMax2;
    uint8 skillPercentageIncrement2;
    uint8 skillMinLevel2;
  }

  // From base class uint40 _totalSupplyAll
  uint40 public nextPetId;
  address private instantVRFActions;

  // What about the different skins?
  mapping(uint basePetId => BasePetMetadata metadata) private basePetMetadatas;
  mapping(uint petId => Pet pet) private pets;
  mapping(uint petId => string name) private names;
  mapping(string name => bool exists) private lowercaseNames;
  mapping(uint petId => uint40 lastAssignmentTimestamp) private lastAssignmentTimestamps;
  string private imageBaseUri;

  // Royalties
  address private royaltyReceiver;
  uint8 private royaltyFee; // base 1000, highest is 25.5

  AdminAccess private adminAccess;
  bool private isBeta;

  address private dev;
  IBrushToken private brush;
  uint72 private editNameCost; // Max is 4700 BRUSH
  uint8 private brushBurntPercentage;
  uint8 private brushPoolPercentage;
  uint8 private brushDevPercentage;
  uint8 private brushTerritoriesPercentage;
  address private territories;
  address private players;
  //  address private shop;

  string private constant PET_NAME_PREFIX = "Pet ";
  string private constant PET_NAME_LOWERCASE_PREFIX = "pet ";

  modifier onlyMinters() {
    if (_msgSender() != instantVRFActions && !(adminAccess.isAdmin(_msgSender()) && isBeta)) {
      revert NotMinter();
    }
    _;
  }

  modifier onlyBurners(address _from) {
    if (_msgSender() != _from && !isApprovedForAll(_from, _msgSender())) {
      revert NotBurner();
    }
    _;
  }

  modifier onlyPlayersOrAdminAndBeta() {
    if (_msgSender() != players && !(adminAccess.isAdmin(_msgSender()) && isBeta)) {
      revert NotPlayersOrAdminAndBeta();
    }
    _;
  }

  modifier isOwnerOfPet(uint _petId) {
    if (getOwner(_petId) != _msgSender()) {
      revert NotOwnerOfPet();
    }
    _;
  }

  modifier isOwnerOfPlayer(uint _playerId) {
    if (!IPlayers(players).isOwnerOfPlayerAndActive(_msgSender(), _playerId)) {
      revert NotOwnerOfPlayer();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken _brush,
    address _royaltyReceiver,
    string calldata _imageBaseUri,
    address _dev,
    uint72 _editNameCost,
    AdminAccess _adminAccess,
    bool _isBeta
  ) external initializer {
    __ERC1155_init("");
    __UUPSUpgradeable_init();
    __Ownable_init();

    bool storageSlotCorrect;
    assembly ("memory-safe") {
      storageSlotCorrect := eq(nextPetId.slot, _totalSupplyAll.slot)
    }
    if (!storageSlotCorrect) {
      revert StorageSlotIncorrect();
    }

    brush = _brush;
    royaltyFee = 30; // 3%
    royaltyReceiver = _royaltyReceiver;
    adminAccess = _adminAccess;
    imageBaseUri = _imageBaseUri;
    dev = _dev;
    isBeta = _isBeta;
    nextPetId = 1;
    _setEditNameCost(_editNameCost);
  }

  function editPet(
    uint _playerId,
    uint _petId,
    string calldata _name
  ) external isOwnerOfPlayer(_playerId) isOwnerOfPet(_petId) {
    (string memory trimmedName, string memory trimmedAndLowercaseName, bool nameChanged) = _setName(_petId, _name);

    if (nameChanged) {
      _pay(editNameCost);
    } else {
      revert SameName();
    }

    // Check trimmed name does not start with "Pet " as those are reserved
    if (bytes(trimmedAndLowercaseName).length > 3) {
      if (
        bytes(trimmedAndLowercaseName)[0] == bytes(PET_NAME_LOWERCASE_PREFIX)[0] &&
        bytes(trimmedAndLowercaseName)[1] == bytes(PET_NAME_LOWERCASE_PREFIX)[1] &&
        bytes(trimmedAndLowercaseName)[2] == bytes(PET_NAME_LOWERCASE_PREFIX)[2] &&
        bytes(trimmedAndLowercaseName)[3] == bytes(PET_NAME_LOWERCASE_PREFIX)[3]
      ) {
        revert IllegalNameStart();
      }
    }

    emit EditPlayerPet(_playerId, _petId, msg.sender, trimmedName);
  }

  function _pay(uint _brushCost) private {
    uint brushCost = _brushCost;
    if (brushPoolPercentage != 0) {
      revert NotSupportedYet();
    }

    if (brushTerritoriesPercentage != 0) {
      brush.transferFrom(msg.sender, territories, (brushCost * brushTerritoriesPercentage) / 100);
    }

    if (brushDevPercentage != 0) {
      brush.transferFrom(msg.sender, dev, (brushCost * brushDevPercentage) / 100);
    }

    if (brushBurntPercentage != 0) {
      uint amountBurnt = (brushCost * brushBurntPercentage) / 100;
      brush.transferFrom(msg.sender, address(this), amountBurnt);
      brush.burn(amountBurnt);
    }
  }

  function assignPet(address _from, uint _playerId, uint _petId, uint _timestamp) external onlyPlayersOrAdminAndBeta {
    // If pet is already assigned then don't change timestamp
    Pet storage pet = pets[_petId];
    if (getOwner(_petId) != _from) {
      revert PlayerDoesNotOwnPet();
    }

    // Check skill minimum levels are met
    Skill skillEnhancement1 = basePetMetadatas[pet.baseId].skillEnhancement1;
    uint skillMinLevel1 = basePetMetadatas[pet.baseId].skillMinLevel1;
    if (IPlayers(players).level(_playerId, skillEnhancement1) < skillMinLevel1) {
      revert LevelNotHighEnough(skillEnhancement1, skillMinLevel1);
    }

    Skill skillEnhancement2 = basePetMetadatas[pet.baseId].skillEnhancement2;
    if (skillEnhancement2 != Skill.NONE) {
      uint skillMinLevel2 = basePetMetadatas[pet.baseId].skillMinLevel2;
      if (IPlayers(players).level(_playerId, skillEnhancement2) < skillMinLevel2) {
        revert LevelNotHighEnough(skillEnhancement2, skillMinLevel2);
      }
    }

    if (pet.lastAssignmentTimestamp <= _timestamp) {
      return;
    }

    pet.lastAssignmentTimestamp = uint40(_timestamp);
  }

  function mintBatch(
    address _to,
    uint[] calldata _basePetIds,
    uint[] calldata _randomWords
  ) external onlyMinters returns (uint[] memory tokenIds) {
    if (_basePetIds.length != _randomWords.length) {
      revert LengthMismatch();
    }

    tokenIds = new uint[](_basePetIds.length);
    uint[] memory amounts = new uint[](_basePetIds.length);
    string[] memory trimmedNames = new string[](_basePetIds.length);
    Pet[] memory _pets = new Pet[](_basePetIds.length);

    uint startPetId = nextPetId;
    for (uint i = 0; i < _pets.length; ++i) {
      uint petId = startPetId + i;
      (Pet memory pet, string memory trimmedName) = _createPet(petId, _basePetIds[i], uint16(_randomWords[i]));
      _pets[i] = pet;
      pets[petId] = pet;
      tokenIds[i] = petId;
      amounts[i] = 1;
      trimmedNames[i] = trimmedName;
    }
    // Mint first
    _mintBatch(_to, tokenIds, amounts, "");
    nextPetId = uint40(startPetId + _pets.length);
    emit NewPets(startPetId, _pets, trimmedNames, _to);
  }

  function mint(address _to, uint _basePetId, uint _randomWord) external onlyMinters {
    uint petId = nextPetId++;
    (Pet memory pet, string memory trimmedName) = _createPet(petId, _basePetId, uint16(_randomWord));
    _mint(_to, petId, 1, "");
    emit NewPet(petId, pet, trimmedName, _msgSender());
  }

  function burnBatch(address _from, uint[] memory _tokenIds) external onlyBurners(_from) {
    uint[] memory amounts = new uint[](_tokenIds.length);
    _burnBatch(_from, _tokenIds, amounts);
  }

  function burn(address _from, uint _tokenId) external onlyBurners(_from) {
    _burn(_from, _tokenId, 1);
  }

  function _createPet(
    uint _petId,
    uint _basePetId,
    uint16 _randomWord
  ) private returns (Pet memory pet, string memory defaultName) {
    if (basePetMetadatas[_basePetId].skillEnhancement1 == Skill.NONE) {
      revert PetDoesNotExist();
    }

    // Fixed enhancement for skill 1
    uint skillFixedMin1 = basePetMetadatas[_basePetId].skillFixedMin1;
    uint skillFixedMax1 = basePetMetadatas[_basePetId].skillFixedMax1;
    uint skillFixedEnhancement1 = skillFixedMin1;
    if (skillFixedMax1 != skillFixedMin1) {
      skillFixedEnhancement1 =
        ((_randomWord >> 8) %
          (((skillFixedMax1 - skillFixedMin1) / basePetMetadatas[_basePetId].skillFixedIncrement1))) +
        skillFixedMin1;
    }

    // Percentage enhancement for skill 1
    uint skillPercentageMin1 = basePetMetadatas[_basePetId].skillPercentageMin1;
    uint skillPercentageMax1 = basePetMetadatas[_basePetId].skillPercentageMax1;
    uint skillPercentageEnhancement1 = skillPercentageMin1;
    if (skillPercentageMax1 != skillPercentageMin1) {
      skillPercentageEnhancement1 =
        (_randomWord %
          (((skillPercentageMax1 - skillPercentageMin1) / basePetMetadatas[_basePetId].skillPercentageIncrement1))) +
        skillPercentageMin1;
    }

    // Skill 2
    Skill skillEnhancement2 = basePetMetadatas[_basePetId].skillEnhancement2;
    uint skillFixedEnhancement2;
    uint skillPercentageEnhancement2;
    if (skillEnhancement2 != Skill.NONE) {
      uint otherRandomWord = uint(keccak256(abi.encodePacked(_randomWord)));
      // Fixed enhancement
      uint skillFixedMin2 = basePetMetadatas[_basePetId].skillFixedMin2;
      uint skillFixedMax2 = basePetMetadatas[_basePetId].skillFixedMax2;
      if (skillFixedMax2 != skillFixedMin2) {
        skillFixedEnhancement2 =
          (otherRandomWord %
            (((skillFixedMax2 - skillFixedMin2) / basePetMetadatas[_basePetId].skillFixedIncrement2))) +
          skillFixedMin2;
      } else {
        skillFixedEnhancement2 = skillFixedMin2;
      }

      // Percentage enhancement
      uint skillPercentageMin2 = basePetMetadatas[_basePetId].skillPercentageMin2;
      uint skillPercentageMax2 = basePetMetadatas[_basePetId].skillPercentageMax2;
      if (skillPercentageMax2 != skillPercentageMin2) {
        skillPercentageEnhancement2 =
          ((otherRandomWord >> 8) %
            (((skillPercentageMax2 - skillPercentageMin2) / basePetMetadatas[_basePetId].skillPercentageIncrement2))) +
          skillPercentageMin2;
      } else {
        skillPercentageEnhancement2 = skillPercentageMin2;
      }
    }

    pet = Pet(
      basePetMetadatas[_basePetId].skillEnhancement1,
      uint8(skillFixedEnhancement1),
      uint8(skillPercentageEnhancement1),
      skillEnhancement2,
      uint8(skillFixedEnhancement2),
      uint8(skillPercentageEnhancement2),
      type(uint40).max,
      address(0), // Will be updated in _mint
      uint24(_basePetId)
    );

    pets[_petId] = pet;
    (defaultName, , ) = _setName(_petId, string(abi.encodePacked(PET_NAME_PREFIX, _petId.toString())));
  }

  function _setName(
    uint _petId,
    string memory _name
  ) private returns (string memory trimmedName, string memory trimmedAndLowercaseName, bool nameChanged) {
    // Trimmed name cannot be empty
    trimmedName = EstforLibrary.trim(_name);
    if (bytes(trimmedName).length < 3) {
      revert NameTooShort();
    }
    if (bytes(trimmedName).length > 15) {
      revert NameTooLong();
    }

    if (!EstforLibrary.containsValidNameCharacters(trimmedName)) {
      revert NameInvalidCharacters();
    }

    trimmedAndLowercaseName = EstforLibrary.toLower(trimmedName);
    string memory oldName = EstforLibrary.toLower(names[_petId]);
    nameChanged = keccak256(abi.encodePacked(oldName)) != keccak256(abi.encodePacked(trimmedAndLowercaseName));
    if (nameChanged) {
      if (lowercaseNames[trimmedAndLowercaseName]) {
        revert NameAlreadyExists();
      }
      if (bytes(oldName).length != 0) {
        delete lowercaseNames[oldName];
      }
      lowercaseNames[trimmedAndLowercaseName] = true;
      names[_petId] = trimmedName;
    }
  }

  function _updateOwner(uint256 _id, address _to) internal override {
    bool isBurnt = _to == address(0) || _to == 0x000000000000000000000000000000000000dEaD;
    if (isBurnt) {
      delete pets[_id];
    } else {
      pets[_id].owner = _to;
      pets[_id].lastAssignmentTimestamp = uint40(block.timestamp);
    }
  }

  function _setEditNameCost(uint72 _editNameCost) private {
    editNameCost = _editNameCost;
    emit EditNameCost(_editNameCost);
  }

  function _setBasePet(BasePetInput calldata _basePetInput) private {
    if (_basePetInput.skillEnhancements[0] == Skill.NONE && _basePetInput.skillEnhancements[1] == Skill.NONE) {
      revert MustHaveOneSkillEnhancement();
    }

    if (_basePetInput.skillEnhancements[0] == Skill.NONE && _basePetInput.skillEnhancements[1] != Skill.NONE) {
      revert SkillEnhancementIncorrectOrder();
    }

    _checkBasePet(_basePetInput, 0);
    _checkBasePet(_basePetInput, 1);

    basePetMetadatas[_basePetInput.baseId] = BasePetMetadata(
      _basePetInput.description,
      _basePetInput.tier,
      _basePetInput.skin,
      _basePetInput.enhancementType,
      _basePetInput.skillEnhancements[0],
      _basePetInput.skillFixedMins[0],
      _basePetInput.skillFixedMaxs[0],
      _basePetInput.skillFixedIncrements[0],
      _basePetInput.skillPercentageMins[0],
      _basePetInput.skillPercentageMaxs[0],
      _basePetInput.skillPercentageIncrements[0],
      _basePetInput.skillMinLevels[0],
      _basePetInput.skillEnhancements[1],
      _basePetInput.skillFixedMins[1],
      _basePetInput.skillFixedMaxs[1],
      _basePetInput.skillFixedIncrements[1],
      _basePetInput.skillPercentageMins[1],
      _basePetInput.skillPercentageMaxs[1],
      _basePetInput.skillPercentageIncrements[1],
      _basePetInput.skillMinLevels[1]
    );
  }

  function _checkBasePet(BasePetInput calldata _basePetInput, uint index) private pure {
    bool isSkillSet = _basePetInput.skillEnhancements[index] != Skill.NONE;

    if (!isSkillSet) {
      return;
    }
    // Check percentage values are correct
    if (_basePetInput.skillPercentageMaxs[index] == 0 && _basePetInput.skillFixedMaxs[index] == 0) {
      revert MustHaveAtLeastPercentageOrFixedSet();
    }

    if (_basePetInput.skillPercentageMins[index] > _basePetInput.skillPercentageMaxs[index]) {
      revert SkillEnhancementMinGreaterThanMax();
    }

    uint percentageIncrement = _basePetInput.skillPercentageIncrements[index];
    if (
      percentageIncrement != 0 &&
      ((_basePetInput.skillPercentageMins[index] % percentageIncrement) != 0 ||
        (_basePetInput.skillPercentageMaxs[index] % percentageIncrement) != 0)
    ) {
      revert SkillPercentageMustBeAFactorOfIncrement();
    }

    if (_basePetInput.skillPercentageMaxs[index] != 0 && _basePetInput.skillPercentageIncrements[index] == 0) {
      revert SkillPercentageIncrementCannotBeZero();
    }

    // Check skill fixed values are correct.
    if (_basePetInput.skillFixedMins[index] > _basePetInput.skillFixedMaxs[index]) {
      revert SkillEnhancementMinGreaterThanMax();
    }

    uint fixedIncrement = _basePetInput.skillFixedIncrements[index];
    if (_basePetInput.skillFixedMaxs[index] != 0 && fixedIncrement == 0) {
      revert SkillFixedIncrementCannotBeZero();
    }

    if (
      fixedIncrement != 0 &&
      ((_basePetInput.skillFixedMins[index] % fixedIncrement) != 0 ||
        (_basePetInput.skillFixedMaxs[index] % fixedIncrement) != 0)
    ) {
      revert SkillFixedMustBeAFactorOfIncrement();
    }
  }

  function _basePetExists(BasePetInput calldata _basePetInput) private view returns (bool) {
    return basePetMetadatas[_basePetInput.baseId].skillEnhancement1 != Skill.NONE;
  }

  function _setBrushDistributionPercentages(
    uint8 _brushBurntPercentage,
    uint8 _brushPoolPercentage,
    uint8 _brushDevPercentage,
    uint8 _brushTerritoriesPercentage
  ) private {
    if (_brushBurntPercentage + _brushPoolPercentage + _brushDevPercentage + _brushTerritoriesPercentage != 100) {
      revert PercentNotTotal100();
    }

    brushBurntPercentage = _brushBurntPercentage;
    brushPoolPercentage = _brushPoolPercentage;
    brushDevPercentage = _brushDevPercentage;
    brushTerritoriesPercentage = _brushTerritoriesPercentage;
    emit SetBrushDistributionPercentages(
      _brushBurntPercentage,
      _brushPoolPercentage,
      _brushDevPercentage,
      _brushTerritoriesPercentage
    );
  }

  function _getTraitStringJSON(string memory _traitType, string memory _value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(_traitType), '"', _value, '"}');
  }

  function _getTraitNumberJSON(string memory _traitType, uint _value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(_traitType), _value.toString(), "}");
  }

  function _getTraitTypeJSON(string memory _traitType) private pure returns (bytes memory) {
    return abi.encodePacked('{"trait_type":"', _traitType, '","value":');
  }

  function getPet(uint _tokenId) external view returns (Pet memory) {
    return pets[_tokenId];
  }

  function _skinToString(PetSkin _skin) private pure returns (string memory) {
    if (_skin == PetSkin.DEFAULT) {
      return "Default";
    }
    if (_skin == PetSkin.OG) {
      return "OG";
    }
    if (_skin == PetSkin.ONEKIN) {
      return "OneKin";
    }
    if (_skin == PetSkin.FROST) {
      return "Frost";
    }
    if (_skin == PetSkin.CRYSTAL) {
      return "Crystal";
    }
    revert InvalidSkin(_skin);
  }

  function _petEnhancementTypeToString(PetEnhancementType _petEnhancementType) private pure returns (string memory) {
    if (_petEnhancementType == PetEnhancementType.MELEE) {
      return "Melee";
    }
    if (_petEnhancementType == PetEnhancementType.MAGIC) {
      return "Magic";
    }
    if (_petEnhancementType == PetEnhancementType.RANGED) {
      return "Ranged";
    }
    if (_petEnhancementType == PetEnhancementType.HEALTH) {
      return "Health";
    }
    if (_petEnhancementType == PetEnhancementType.DEFENCE) {
      return "Defence";
    }
    if (_petEnhancementType == PetEnhancementType.MELEE_AND_DEFENCE) {
      return "MeleeAndDefence";
    }
    if (_petEnhancementType == PetEnhancementType.MAGIC_AND_DEFENCE) {
      return "MagicAndDefence";
    }
    if (_petEnhancementType == PetEnhancementType.RANGED_AND_DEFENCE) {
      return "RangedAndDefence";
    }

    revert InvalidPetEnahncementType(_petEnhancementType);
  }

  function getOwner(uint _tokenId) public view override returns (address) {
    return pets[_tokenId].owner;
  }

  function uri(uint _tokenId) public view virtual override returns (string memory) {
    if (!_exists(_tokenId)) {
      revert ERC1155Metadata_URIQueryForNonexistentToken();
    }

    BasePetMetadata storage basePetMetadata = basePetMetadatas[pets[_tokenId].baseId];
    Pet storage pet = pets[_tokenId];
    string memory skin = _skinToString(basePetMetadata.skin);
    uint tier = basePetMetadata.tier;
    string memory petEnhancementType = _petEnhancementTypeToString(basePetMetadata.enhancementType);

    // Create whole JSON
    string memory imageURI = string(
      abi.encodePacked(imageBaseUri, skin, "_", tier.toString(), "_", petEnhancementType, ".jpg")
    );

    string memory attributes = string(
      abi.encodePacked(
        _getTraitStringJSON("Skin", skin),
        ",",
        _getTraitNumberJSON("Tier", tier),
        ",",
        _getTraitStringJSON("Enhancement type", petEnhancementType),
        ",",
        _getTraitStringJSON("Skill bonus #1", EstforLibrary.skillToString(pet.skillEnhancement1)),
        ",",
        _getTraitNumberJSON("Fixed increase #1", pet.skillFixedEnhancement1),
        ",",
        _getTraitNumberJSON("Percent increase #1", pet.skillPercentageEnhancement1),
        ",",
        _getTraitStringJSON("Skill bonus #2", EstforLibrary.skillToString(pet.skillEnhancement2)),
        ",",
        _getTraitNumberJSON("Fixed increase #2", pet.skillFixedEnhancement2),
        ",",
        _getTraitNumberJSON("Percent increase #2", pet.skillPercentageEnhancement2)
      )
    );

    bytes memory fullName = abi.encodePacked(names[_tokenId], " (T", tier.toString(), ")");
    bytes memory externalURL = abi.encodePacked("https://", isBeta ? "beta." : "", "estfor.com");
    string memory description = basePetMetadatas[pet.baseId].description;

    string memory json = Base64.encode(
      abi.encodePacked(
        '{"name":"',
        fullName,
        '","description":"',
        description,
        '","attributes":[',
        attributes,
        '],"image":"',
        imageURI,
        '", "external_url":"',
        externalURL,
        '"}'
      )
    );

    return string(abi.encodePacked("data:application/json;base64,", json));
  }

  /**
   * @dev Returns whether `_tokenId` exists.
   */
  function _exists(uint _tokenId) internal view override returns (bool) {
    return pets[_tokenId].owner != address(0);
  }

  function royaltyInfo(
    uint /*_tokenId*/,
    uint _salePrice
  ) external view override returns (address receiver, uint royaltyAmount) {
    uint amount = (_salePrice * royaltyFee) / 1000;
    return (royaltyReceiver, amount);
  }

  function supportsInterface(
    bytes4 interfaceId
  ) public view override(IERC165, ERC1155UpgradeableSinglePerToken) returns (bool) {
    return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked("Estfor Pets", isBeta ? " (Beta)" : ""));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked("EK_PETS", isBeta ? "_B" : ""));
  }

  function setImageBaseUri(string calldata _imageBaseUri) external onlyOwner {
    imageBaseUri = _imageBaseUri;
  }

  function setPlayers(address _players) external onlyOwner {
    players = _players;
  }

  function setEditNameCost(uint72 _editNameCost) external onlyOwner {
    _setEditNameCost(_editNameCost);
  }

  function setTerritories(address _territories) external onlyOwner {
    territories = _territories;
  }

  function setInstantVRFActions(address _instantVRFActions) external onlyOwner {
    instantVRFActions = _instantVRFActions;
  }

  function addBasePets(BasePetInput[] calldata _basePetInputs) external onlyOwner {
    for (uint i; i < _basePetInputs.length; ++i) {
      BasePetInput calldata basePetInput = _basePetInputs[i];
      if (_basePetExists(basePetInput)) {
        revert PetAlreadyExists();
      }
      _setBasePet(basePetInput);
    }
    emit AddBasePets(_basePetInputs);
  }

  function editBasePets(BasePetInput[] calldata _basePetInputs) external onlyOwner {
    for (uint i = 0; i < _basePetInputs.length; ++i) {
      BasePetInput calldata basePetInput = _basePetInputs[i];
      if (!_basePetExists(basePetInput)) {
        revert PetDoesNotExist();
      }

      // DO NOT change skills of existing pets
      if (basePetMetadatas[basePetInput.baseId].skillEnhancement1 != basePetInput.skillEnhancements[0]) {
        revert SkillEnhancementIncorrectlyFilled();
      }
      if (basePetMetadatas[basePetInput.baseId].skillEnhancement2 != basePetInput.skillEnhancements[1]) {
        revert SkillEnhancementIncorrectlyFilled();
      }

      _setBasePet(basePetInput);
    }
    emit EditBasePets(_basePetInputs);
  }

  function setBrushDistributionPercentages(
    uint8 _brushBurntPercentage,
    uint8 _brushPoolPercentage,
    uint8 _brushDevPercentage,
    uint8 _brushTerritoriesPercentage
  ) external onlyOwner {
    _setBrushDistributionPercentages(
      _brushBurntPercentage,
      _brushPoolPercentage,
      _brushDevPercentage,
      _brushTerritoriesPercentage
    );
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
