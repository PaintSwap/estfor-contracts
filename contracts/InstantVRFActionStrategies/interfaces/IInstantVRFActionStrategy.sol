// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {InstantVRFActionInput, InstantVRFActionType} from "../../globals/rewards.sol";

import {Skill} from "../../globals/players.sol";

interface IInstantVRFActionStrategy {
  function getRandomRewards(
    uint256 actionId,
    uint256 actionAmount,
    uint256[] calldata randomWords,
    uint256 randomWordStartIndex
  )
    external
    view
    returns (
      uint256[] memory producedItemTokenIds,
      uint256[] memory producedItemsAmounts,
      uint256[] memory producedPetBaseIds,
      uint256[] memory producedPetRandomWords
    );

  function setAction(InstantVRFActionInput calldata input) external;
}
