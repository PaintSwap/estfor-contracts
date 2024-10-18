// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Skill} from "./globals/misc.sol";

library SkillLibrary {
  function asSkill(uint8 skill) internal pure returns (Skill) {
    return Skill(skill);
  }

  function isSkill(uint8 skill, Skill check) internal pure returns (bool) {
    return isSkill(Skill(skill), check);
  }

  function isNotSkill(uint8 skill, Skill check) internal pure returns (bool) {
    return isNotSkill(Skill(skill), check);
  }

  function asUint8(Skill skill) internal pure returns (uint8) {
    return uint8(skill);
  }

  function isSkill(Skill skill, Skill check) internal pure returns (bool) {
    return skill == check;
  }

  function isNotSkill(Skill skill, Skill check) internal pure returns (bool) {
    return skill != check;
  }

  function isCombat(Skill skill) internal pure returns (bool) {
    return isSkill(skill, Skill.COMBAT);
  }

  function isNone(Skill skill) internal pure returns (bool) {
    return isSkill(skill, Skill.NONE);
  }
}
