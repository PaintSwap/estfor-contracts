// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Skill} from "../globals/misc.sol";

library SkillLibrary {
  error InvalidSkillId(uint8 skill);

  function _asSkill(uint8 skill) internal pure returns (Skill) {
    require(skill >= uint8(type(Skill).min) && skill <= uint8(type(Skill).max), InvalidSkillId(skill));
    return Skill(skill);
  }

  function _isSkill(uint8 skill) internal pure returns (bool) {
    return _isSkill(_asSkill(skill));
  }

  function _isSkill(uint8 skill, Skill check) internal pure returns (bool) {
    return _isSkill(_asSkill(skill), check);
  }

  function _isSkillCombat(uint8 skill) internal pure returns (bool) {
    return _isSkillCombat(_asSkill(skill));
  }

  function _isSkillNone(uint8 skill) internal pure returns (bool) {
    return _isSkillNone(_asSkill(skill));
  }

  function _asUint8(Skill skill) internal pure returns (uint8) {
    return uint8(skill);
  }

  function _isSkill(Skill skill) internal pure returns (bool) {
    return !_isSkill(skill, Skill.NONE);
  }

  function _isSkill(Skill skill, Skill check) internal pure returns (bool) {
    return skill == check;
  }

  function _isSkillCombat(Skill skill) internal pure returns (bool) {
    return _isSkill(skill, Skill.COMBAT);
  }

  function _isSkillNone(Skill skill) internal pure returns (bool) {
    return _isSkill(skill, Skill.NONE);
  }
}
