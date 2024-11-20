// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {CombatStats, Skill} from "../globals/misc.sol";
import {ActionChoice} from "../globals/players.sol";
import {ActionRewards} from "../globals/rewards.sol";

interface IWorld {
  function getXPPerHour(uint16 actionId, uint16 actionChoiceId) external view returns (uint24 xpPerHour);

  function getNumSpawn(uint16 actionId) external view returns (uint256 numSpawned);

  function getActionSuccessPercentAndMinXP(uint16 actionId) external view returns (uint8 successPercent, uint32 minXP);

  function getCombatStats(uint16 actionId) external view returns (CombatStats memory stats);

  function getActionChoice(uint16 actionId, uint16 choiceId) external view returns (ActionChoice memory choice);

  function getRewardsHelper(
    uint16 actionId
  ) external view returns (ActionRewards memory, Skill skill, uint256 numSpanwed, uint8 worldLocation);
}
