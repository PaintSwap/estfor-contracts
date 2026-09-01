// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AdminAccess} from "../AdminAccess.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {IPlayerNFT} from "./IPlayerNFT.sol";
import {IBrushToken} from "./external/IBrushToken.sol";
import {IPlayers} from "./IPlayers.sol";
import {BattleResultEnum} from "../globals/clans.sol";
import {Skill} from "../globals/misc.sol";

interface IPVPBattleground {
  struct PlayerInfo {
    uint40 attackingCooldownTimestamp;
    bool currentlyAttacking;
    uint40 blockAttacksTimestamp;
    uint8 blockAttacksCooldownHours;
  }

  struct PendingAttack {
    uint64 playerId;
    uint64 defendingPlayerId;
    bool attackInProgress;
  }

  function initialize(
    IPlayers players,
    IPlayerNFT playerNFT,
    IBrushToken brush,
    ItemNFT itemNFT,
    address paintswapVRFConsumer,
    Skill[] calldata comparableSkills,
    uint24 pvpAttackingCooldown,
    AdminAccess adminAccess,
    bool isBeta
  ) external;
  function initializeV3(address paintswapVRFConsumer) external;
  function attackPlayer(uint256 playerId, uint256 defendingPlayerId) external payable;
  function determineBattleOutcome(
    uint64 playerId,
    uint64 defendingPlayerId,
    Skill[] calldata skills,
    uint256[] calldata randomWords,
    uint256 extraRollsA,
    uint256 extraRollsB
  )
    external
    view
    returns (BattleResultEnum[] memory battleResults, uint256[] memory rollsA, uint256[] memory rollsB, bool didAWin);
  function getPlayerInfo(uint256 playerId) external view returns (PlayerInfo memory);
  function getAttackCost() external view returns (uint256);
  function getPendingAttack(uint256 pendingAttackId) external view returns (PendingAttack memory pendingAttack);
  function getExpectedGasLimitFulfill() external view returns (uint88 expectedGasLimitFulfill);
  function setComparableSkills(Skill[] calldata skills, uint8 numSkillsToCompare) external;
  function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) external;
  function setAttackCooldown(uint24 attackCooldown) external;
  function setPreventAttacks(bool preventAttacks) external;
  function clearCooldowns(uint256 playerId) external;
  function setAttackInProgress(uint256 requestId) external;

  event AttackPlayer(
    address from,
    uint256 playerId,
    uint256 defendingPlayerId,
    uint256 requestId,
    uint256 pendingAttackId,
    uint256 attackingCooldownTimestamp
  );
  event BattleResult(
    uint256 requestId,
    uint256 attackingPlayerId,
    uint256 defendingPlayerId,
    uint256[] attackingRolls,
    uint256[] defendingRolls,
    BattleResultEnum[] battleResults,
    Skill[] randomSkills,
    bool didAttackersWin,
    uint256[] randomWords
  );
  event SetComparableSkills(Skill[] skills, uint256 numSkillsToCompare);
  event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
  event SetAttackCooldown(uint256 attackCooldown);
  event SetPreventAttacks(bool preventAttacks);

  error TransferFailed();
  error PlayerAttackingCooldown();
  error PlayerIsBlockingAttacks();
  error InvalidSkill(Skill skill);
  error LengthMismatch();
  error NotOwnerOfPlayerAndActive();
  error NotAdminAndBeta();
  error CannotAttackWhileStillAttacking();
  error AmountTooLow();
  error RequestIdNotKnown();
  error BlockAttacksCooldown();
  error CannotAttackSelf();
  error NotEnoughRandomWords();
  error DefendingPlayerDoesntExist();
  error TooManySkillsToCompare();
  error AttacksPrevented();
}
