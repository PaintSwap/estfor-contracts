// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {Skill} from "./globals/players.sol";
import {Pet, PetSkin, PetEnhancementType, BasePetMetadata} from "./globals/pets.sol";

// This file contains methods for interacting with the pet NFT, used to decrease implementation deployment bytecode code.
library PetNFTLibrary {
  using Strings for uint256;

  error InvalidSkin(PetSkin skin);
  error InvalidPetEnhancementType(PetEnhancementType petEnhancementType);

  string private constant PET_NAME_PREFIX = "Pet ";

  function uri(
    BasePetMetadata storage basePetMetadata,
    Pet storage pet,
    uint tokenId,
    string storage imageBaseUri,
    string memory name,
    bool isBeta
  ) external view returns (string memory) {
    string memory skin = _skinToString(basePetMetadata.skin);
    uint tier = basePetMetadata.tier;
    string memory petEnhancementType = _petEnhancementTypeToString(basePetMetadata.enhancementType);

    bool hasFixedStar = (pet.skillFixedEnhancement1 + pet.skillFixedEnhancement2) >= basePetMetadata.fixedStarThreshold;
    bool hasPercentageStar = (pet.skillPercentageEnhancement1 + pet.skillPercentageEnhancement2) >=
      basePetMetadata.percentageStarThreshold;

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
        _getTraitStringJSON("Skill bonus #1", _skillToString(pet.skillEnhancement1)),
        ",",
        _getTraitNumberJSON("Fixed increase #1", pet.skillFixedEnhancement1),
        ",",
        _getTraitNumberJSON("Percent increase #1", pet.skillPercentageEnhancement1),
        ",",
        _getTraitStringJSON("Skill bonus #2", _skillToString(pet.skillEnhancement2)),
        ",",
        _getTraitNumberJSON("Fixed increase #2", pet.skillFixedEnhancement2),
        ",",
        _getTraitNumberJSON("Percent increase #2", pet.skillPercentageEnhancement2),
        ",",
        _getTraitStringJSON("Fixed Star", hasFixedStar ? "true" : "false"),
        ",",
        _getTraitStringJSON("Percent Star", hasPercentageStar ? "true" : "false")
      )
    );

    // Set default name if they don't have one
    if (bytes(name).length == 0) {
      name = _defaultPetName(tokenId);
    }

    bytes memory fullName = abi.encodePacked(name, " (T", tier.toString(), ")");
    bytes memory externalURL = abi.encodePacked("https://", isBeta ? "beta." : "", "estfor.com");
    string memory description = basePetMetadata.description;

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

  function _defaultPetName(uint _petId) internal pure returns (string memory) {
    return string(abi.encodePacked(PET_NAME_PREFIX, _petId.toString()));
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

    revert InvalidPetEnhancementType(_petEnhancementType);
  }

  function _skillToString(Skill _skill) private pure returns (string memory) {
    if (_skill == Skill.MELEE) {
      return "Melee";
    } else if (_skill == Skill.RANGED) {
      return "Ranged";
    } else if (_skill == Skill.MAGIC) {
      return "Magic";
    } else if (_skill == Skill.DEFENCE) {
      return "Defence";
    } else if (_skill == Skill.HEALTH) {
      return "Health";
    } else if (_skill == Skill.MINING) {
      return "Mining";
    } else if (_skill == Skill.WOODCUTTING) {
      return "Woodcutting";
    } else if (_skill == Skill.FISHING) {
      return "Fishing";
    } else if (_skill == Skill.SMITHING) {
      return "Smithing";
    } else if (_skill == Skill.THIEVING) {
      return "Thieving";
    } else if (_skill == Skill.CRAFTING) {
      return "Crafting";
    } else if (_skill == Skill.COOKING) {
      return "Cooking";
    } else if (_skill == Skill.FIREMAKING) {
      return "Firemaking";
    } else if (_skill == Skill.ALCHEMY) {
      return "Alchemy";
    } else if (_skill == Skill.FLETCHING) {
      return "Fletching";
    } else if (_skill == Skill.FORGING) {
      return "Forging";
    } else {
      return "None";
    }
  }
}
