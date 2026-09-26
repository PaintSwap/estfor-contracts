// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Skill} from "../globals/misc.sol";

/// @notice Owner-only configuration removal. Existing player state is not reset.
interface IPlayersConfiguration {
  event RemoveXPThresholdReward(uint32 xpThreshold);
  event ClearFullAttireBonus(Skill skill);

  /// @notice Removes configured thresholds. Missing thresholds revert the whole batch.
  /// @dev Like edits, this changes rewards for XP that has not yet been processed.
  function removeXPThresholdRewards(uint32[] calldata xpThresholds) external;

  /// @notice Clears bonuses for non-NONE skills. Clearing an absent bonus is allowed.
  /// @dev Like additions, this changes bonuses for actions that have not yet been processed.
  function clearFullAttireBonuses(Skill[] calldata skills) external;
}
