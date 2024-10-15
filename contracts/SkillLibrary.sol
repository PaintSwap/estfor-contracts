// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Skill} from "./globals/misc.sol";

library SkillLibrary {
  function asSkill(uint8 _skill) internal pure returns (Skill) {
    return Skill(_skill);
  }

  function isSkill(uint8 _skill, Skill _check) internal pure returns (bool) {
    return Skill(_skill) == _check;
  }

  function isNotSkill(uint8 _skill, Skill _check) internal pure returns (bool) {
    return Skill(_skill) != _check;
  }
}
