// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "../globals/all.sol";
import {IPlayersBase} from "./IPlayersBase.sol";
interface IPlayersImplQueueActions is IPlayersBase {
  function checkAddToQueue(
    address from,
    uint256 playerId,
    QueuedActionInput calldata input,
    PendingQueuedActionProcessed calldata processed,
    QuestState calldata questState
  ) external view returns (bool);
  function clearEverything(address from, uint256 playerId, bool processTheActions) external;
  function setInitialCheckpoints(
    address from,
    uint256 playerId,
    uint256 numActionsFinished,
    QueuedAction[] calldata queuedActions,
    Attire[] calldata attire
  ) external;
  function startActions(
    uint256 playerId,
    QueuedActionInput[] calldata inputs,
    uint16 boostItemTokenId,
    uint8 boostStartReverseIndex,
    uint256 questId,
    uint256 donationAmount,
    ActionQueueStrategy queueStrategy
  ) external;
  function validateActionsImpl(
    address owner,
    uint256 playerId,
    QueuedActionInput[] calldata inputs
  ) external view returns (bool[] memory, bytes[] memory);
  error InvalidCombatStyleId(uint8 combatStyle);
  error InvalidSkillId(uint8 skill);
}
