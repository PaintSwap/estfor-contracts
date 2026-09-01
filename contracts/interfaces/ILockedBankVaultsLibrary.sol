// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../globals/all.sol";

interface ILockedBankVaultsLibrary {
  function getNewMMRs(uint256 kA, uint256 kD, uint16 attackingMMR, uint16 defendingMMR, bool didAttackersWin)
    external
    pure
    returns (uint16 newAttackerMMR, uint16 newDefenderMMR);

  function isWithinRange(
    uint32[] calldata clanIds,
    uint16[] calldata mmrs,
    uint256 clanId,
    uint256 defendingClanId,
    uint256 mmrAttackDistance
  ) external pure returns (bool);

  error BlockAttacksCooldown();
  error CannotAttackSelf();
  error CannotAttackWhileStillAttacking();
  error CannotChangeCombatantsDuringAttack();
  error CannotReattackAndSuperAttackSameTime();
  error ClanAttackingCooldown();
  error ClanAttackingSameClanCooldown();
  error ClanCombatantsChangeCooldown();
  error ClanDoesntExist(uint256 clanId);
  error ClanIsBlockingAttacks();
  error ClanSuperAttackingCooldown();
  error LengthMismatch();
  error MaxLockedVaultsReached();
  error NoBrushToAttack();
  error NoCombatants();
  error NotALockedVaultAttackItem();
  error NotALockedVaultDefenceItem();
  error NothingToClaim();
  error OutsideMMRRange();
  error SpecifyingItemWhenNotReattackingOrSuperAttacking();
  error TooManyCombatants();
}
