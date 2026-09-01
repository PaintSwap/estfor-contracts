// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../globals/all.sol";
import {IPlayersBase} from "./IPlayersBase.sol";
interface IPlayersImplRewards is IPlayersBase {
  function claimRandomRewards(address from, uint256 playerId, PendingQueuedActionProcessed calldata processed) external;
  function pendingQueuedActionStateImpl(address owner, uint256 playerId) external view returns (PendingQueuedActionState memory);
  error InvalidCombatStyleId(uint8 combatStyle);
  error InvalidSkillId(uint8 skill);
}
