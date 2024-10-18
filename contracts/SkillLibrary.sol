// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Skill} from "./globals/misc.sol";

library SkillLibrary {
  function asSkill(uint8 skill) internal pure returns (Skill) {
    return Skill(skill);
  }

  function isSkill(uint8 skill, Skill check) internal pure returns (bool) {
    return Skill(skill) == check;
  }

  function isNotSkill(uint8 skill, Skill check) internal pure returns (bool) {
    return Skill(skill) != check;
  }
}
