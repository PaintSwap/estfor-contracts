// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ICombatants} from "./ICombatants.sol";
import {IClanMemberLeftCB} from "./IClanMemberLeftCB.sol";
import {IClans} from "./IClans.sol";
import {IPlayers} from "./IPlayers.sol";
import {IBrushToken} from "./external/IBrushToken.sol";
import {IBankFactory} from "./IBankFactory.sol";
import {ITerritories} from "./ITerritories.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {IActivityPoints} from "../ActivityPoints/interfaces/IActivityPoints.sol";
import {VaultClanInfo, ClanBattleInfo} from "../globals/clans.sol";
import {Skill} from "../globals/misc.sol";

interface ILockedBankVaults is ICombatants, IClanMemberLeftCB {
  event AttackVaults(
    uint256 clanId,
    uint256 defendingClanId,
    address from,
    uint256 leaderPlayerId,
    uint256 requestId,
    uint256 pendingAttackId,
    uint256 attackingCooldownTimestamp,
    uint256 reattackingCooldownTimestamp,
    uint256 itemTokenId
  );
  event SetComparableSkills(Skill[] skills);
  event BattleResult(
    uint256 requestId,
    uint64[] attackingPlayerIds,
    uint64[] defendingPlayerIds,
    uint256[] attackingRolls,
    uint256[] defendingRolls,
    uint8[] battleResults,
    uint8[] randomSkills,
    bool didAttackersWin,
    uint256 attackingClanId,
    uint256 defendingClanId,
    uint256[] randomWords,
    uint256 percentageToTake,
    uint256 brushLost,
    int256 attackingMMRDiff,
    int256 defendingMMRDiff,
    uint256 clanXPGainedWinner
  );
  event AssignCombatants(
    uint256 clanId,
    uint64[] playerIds,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );
  event RemoveCombatant(uint256 playerId, uint256 clanId);
  event ClaimFunds(uint256 clanId, address from, uint256 playerId, uint256 amount, uint256 numLocksClaimed);
  event LockFunds(uint256 clanId, address from, uint256 playerId, uint256 amount, uint256 lockingTimestamp);
  event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
  event SetMaxLockedVaults(uint256 maxLockedVaults);
  event SetMaxClanCombatants(uint256 maxClanCombatants);
  event BlockingAttacks(
    uint256 clanId,
    uint256 itemTokenId,
    address from,
    uint256 leaderPlayerId,
    uint256 blockAttacksTimestamp,
    uint256 blockAttacksCooldownTimestamp
  );
  event SuperAttackCooldown(uint256 clanId, uint256 cooldownTimestamp);
  event SetMMRAttackDistance(uint256 mmrAttackDistance);
  event ForceMMRUpdate(uint256[] clanIdsToDelete);
  event SetMMRs(uint256[] clanIds, uint16[] mmrs);
  event SetKValues(uint256 Ka, uint256 Kd);
  event SetBrushDistributionPercentages(
    uint256 brushBurntPercentage,
    uint256 brushTreasuryPercentage,
    uint256 brushDevPercentage
  );
  event SetPreventAttacks(bool preventAttacks);

  error PlayerOnTerritory();
  error TooManyCombatants();
  error NotOwnerOfPlayerAndActive();
  error RankNotHighEnough();
  error InvalidSkill(Skill skill);
  error NotMemberOfClan();
  error LengthMismatch();
  error OnlyClans();
  error OnlyTerritories();
  error OnlyCombatantsHelper();
  error TransferFailed();
  error CannotChangeCombatantsDuringAttack();
  error NotAdminAndBeta();
  error RequestIdNotKnown();
  error CallerNotSamWitchVRF();
  error AttacksPrevented();
  error PercentNotTotal100();

  function initialize(
    IPlayers players,
    IClans clans,
    IBrushToken brush,
    address bankRelay,
    ItemNFT itemNFT,
    address treasury,
    address dev,
    address paintswapVRFConsumer,
    Skill[] calldata comparableSkills,
    uint16 mmrAttackDistance,
    uint24 lockFundsPeriod,
    uint8 maxClanCombatants,
    uint8 maxLockedVaults,
    AdminAccess adminAccess,
    IActivityPoints activityPoints,
    bool isBeta
  ) external;
  function setActivityPoints(address activityPoints) external;
  function initializeV3(address paintswapVRFConsumer) external;
  function forceMMRUpdate(uint256[] calldata clanIds) external;
  function getIdleClans() external view returns (uint256[] memory clanIds);
  function attackVaults(
    uint256 clanId,
    uint256 defendingClanId,
    uint16 itemTokenId,
    uint256 leaderPlayerId
  ) external payable;
  function claimFunds(uint256 clanId, uint256 playerId) external;
  function blockAttacks(uint256 clanId, uint16 itemTokenId, uint256 playerId) external;
  function lockFunds(uint256 clanId, address from, uint256 playerId, uint256 amount) external;
  function getAttackCost() external view returns (uint256);
  function getClanInfo(uint256 clanId) external view returns (VaultClanInfo memory);
  function getSortedClanIdsByMMR() external view returns (uint32[] memory);
  function getSortedMMR() external view returns (uint16[] memory);
  function getLastClanBattles(uint256 clanId, uint256 otherClanId) external view returns (ClanBattleInfo memory);
  function setComparableSkills(Skill[] calldata skills) external;
  function setKValues(uint8 kA, uint8 kD) external;
  function setMMRAttackDistance(uint16 mmrAttackDistance) external;
  function setMaxLockedVaults(uint8 maxLockedVaults) external;
  function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) external;
  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external;
  function setDevAddress(address dev) external;
  function setMaxClanCombatants(uint8 maxClanCombatants) external;
  function setPreventAttacks(bool preventAttacks) external;
  function initializeMMR(uint256[] calldata clanIds, uint16[] calldata mmrs, bool clear) external;
  function initializeAddresses(ITerritories territories, address combatantsHelper, IBankFactory bankFactory) external;
  function clearCooldowns(uint256 clanId, uint256[] calldata otherClanIds) external;
  function setAttackInProgress(uint256 requestId) external;
}
