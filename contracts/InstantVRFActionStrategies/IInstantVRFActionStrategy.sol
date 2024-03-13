// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {InstantVRFActionInput} from "../globals/rewards.sol";

interface IInstantVRFActionStrategy {
  function getRandomRewards(
    uint actionId,
    uint actionAmount,
    uint[] calldata randomWords,
    uint randomWordStartIndex
  ) external view returns (uint256[] memory producedItemTokenIds, uint[] memory producedAmounts);

  function setAction(uint16 actionId, InstantVRFActionInput calldata input) external;
}
