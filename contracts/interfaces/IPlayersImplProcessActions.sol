// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../globals/all.sol";
import {IPlayersBase} from "./IPlayersBase.sol";
interface IPlayersImplProcessActions is IPlayersBase {
  function donate(address from, uint256 playerId, uint256 amount) external;
  function processActions(address from, uint256 playerId) external returns (QueuedAction[] memory, PendingQueuedActionData memory);
  function processActionsAndSetState(address from, uint256 playerId) external returns (QueuedAction[] memory, Attire[] memory);
  error InvalidCombatStyleId(uint8 combatStyle);
  error InvalidSkillId(uint8 skill);
}
