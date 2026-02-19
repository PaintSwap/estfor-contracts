// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {Skill} from "./globals/misc.sol";
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
    uint256 tokenId,
    string storage imageBaseUri,
    string memory name,
    bool isBeta
  ) external view returns (string memory) {
    string memory skin = _skinToString(basePetMetadata.skin);
    uint256 tier = basePetMetadata.tier;
    string memory petEnhancementType = _petEnhancementTypeToString(basePetMetadata.enhancementType);

    bool hasFixedStar = (pet.skillFixedEnhancement1 + pet.skillFixedEnhancement2) >= basePetMetadata.fixedStarThreshold;
    bool hasPercentageStar = (pet.skillPercentageEnhancement1 + pet.skillPercentageEnhancement2) >=
      basePetMetadata.percentageStarThreshold;

    // Create whole JSON
    string memory imageURI = string(
      abi.encodePacked(imageBaseUri, skin, "_", tier.toString(), "_", petEnhancementType, ".jpg")
    );

    string memory bothSkillAttributes = string(
      abi.encodePacked(
        _getTraitStringJSON("Skill bonus #1", _skillToString(pet.skillEnhancement1)),
        ",",
        _getTraitNumberJSON("Fixed increase #1", pet.skillFixedEnhancement1),
        ",",
        _getTraitNumberJSON("Fixed max #1", pet.skillFixedEnhancementMax1),
        ",",
        _getTraitNumberJSON("Percent increase #1", pet.skillPercentageEnhancement1),
        ",",
        _getTraitNumberJSON("Percent max #1", pet.skillPercentageEnhancementMax1),
        ",",
        _getTraitStringJSON("Skill bonus #2", _skillToString(pet.skillEnhancement2)),
        ",",
        _getTraitNumberJSON("Fixed increase #2", pet.skillFixedEnhancement2),
        ",",
        _getTraitNumberJSON("Fixed max #2", pet.skillFixedEnhancementMax2),
        ",",
        _getTraitNumberJSON("Percent increase #2", pet.skillPercentageEnhancement2),
        ",",
        _getTraitNumberJSON("Percent max #2", pet.skillPercentageEnhancementMax2)
      )
    );

    string memory attributes = string(
      abi.encodePacked(
        _getTraitStringJSON("Skin", skin),
        ",",
        _getTraitNumberJSON("Tier", tier),
        ",",
        _getTraitStringJSON("Enhancement type", petEnhancementType),
        ",",
        bothSkillAttributes,
        ",",
        _getTraitStringJSON("Fixed Star", hasFixedStar ? "true" : "false"),
        ",",
        _getTraitStringJSON("Percent Star", hasPercentageStar ? "true" : "false")
      )
    );

    name = _getPetName(tokenId, name);

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

  function _getPetName(uint256 tokenId, string memory petName) internal pure returns (string memory) {
    if (bytes(petName).length == 0) {
      petName = PetNFTLibrary._defaultPetName(tokenId);
    }
    return petName;
  }

  function _defaultPetName(uint256 petId) internal pure returns (string memory) {
    return string(abi.encodePacked(PET_NAME_PREFIX, petId.toString()));
  }

  function _getTraitStringJSON(string memory traitType, string memory value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(traitType), '"', value, '"}');
  }

  function _getTraitNumberJSON(string memory traitType, uint256 value) private pure returns (bytes memory) {
    return abi.encodePacked(_getTraitTypeJSON(traitType), value.toString(), "}");
  }

  function _getTraitTypeJSON(string memory traitType) private pure returns (bytes memory) {
    return abi.encodePacked('{"trait_type":"', traitType, '","value":');
  }

  function _skinToString(PetSkin skin) private pure returns (string memory) {
    if (skin == PetSkin.DEFAULT) {
      return "Default";
    }
    if (skin == PetSkin.OG) {
      return "OG";
    }
    if (skin == PetSkin.ONEKIN) {
      return "OneKin";
    }
    if (skin == PetSkin.FROST) {
      return "Frost";
    }
    if (skin == PetSkin.CRYSTAL) {
      return "Crystal";
    }
    if (skin == PetSkin.ANNIV1) {
      return "Anniv1";
    }
    if (skin == PetSkin.KRAGSTYR) {
      return "Kragstyr";
    }
    if (skin == PetSkin.ANNIV2) {
      return "Anniv2";
    }
    if (skin == PetSkin.RIFT) {
      return "Rift";
    }
    revert InvalidSkin(skin);
  }

  function _petEnhancementTypeToString(PetEnhancementType petEnhancementType) private pure returns (string memory) {
    if (petEnhancementType == PetEnhancementType.MELEE) {
      return "Melee";
    }
    if (petEnhancementType == PetEnhancementType.MAGIC) {
      return "Magic";
    }
    if (petEnhancementType == PetEnhancementType.RANGED) {
      return "Ranged";
    }
    if (petEnhancementType == PetEnhancementType.HEALTH) {
      return "Health";
    }
    if (petEnhancementType == PetEnhancementType.DEFENCE) {
      return "Defence";
    }
    if (petEnhancementType == PetEnhancementType.MELEE_AND_DEFENCE) {
      return "MeleeAndDefence";
    }
    if (petEnhancementType == PetEnhancementType.MAGIC_AND_DEFENCE) {
      return "MagicAndDefence";
    }
    if (petEnhancementType == PetEnhancementType.RANGED_AND_DEFENCE) {
      return "RangedAndDefence";
    }
    if (petEnhancementType == PetEnhancementType.ALCHEMY) {
      return "Alchemy";
    }
    revert InvalidPetEnhancementType(petEnhancementType);
  }

  function _skillToString(Skill skill) private pure returns (string memory) {
    if (skill == Skill.MELEE) {
      return "Melee";
    } else if (skill == Skill.RANGED) {
      return "Ranged";
    } else if (skill == Skill.MAGIC) {
      return "Magic";
    } else if (skill == Skill.DEFENCE) {
      return "Defence";
    } else if (skill == Skill.HEALTH) {
      return "Health";
    } else if (skill == Skill.MINING) {
      return "Mining";
    } else if (skill == Skill.WOODCUTTING) {
      return "Woodcutting";
    } else if (skill == Skill.FISHING) {
      return "Fishing";
    } else if (skill == Skill.SMITHING) {
      return "Smithing";
    } else if (skill == Skill.THIEVING) {
      return "Thieving";
    } else if (skill == Skill.CRAFTING) {
      return "Crafting";
    } else if (skill == Skill.COOKING) {
      return "Cooking";
    } else if (skill == Skill.FIREMAKING) {
      return "Firemaking";
    } else if (skill == Skill.ALCHEMY) {
      return "Alchemy";
    } else if (skill == Skill.FLETCHING) {
      return "Fletching";
    } else if (skill == Skill.FORGING) {
      return "Forging";
    } else if (skill == Skill.FARMING) {
      return "Farming";
    } else {
      return "None";
    }
  }
}
