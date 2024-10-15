// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {InstantVRFActionInput, InstantVRFActionType} from "../globals/rewards.sol";

import {Skill} from "../globals/players.sol";

interface IInstantVRFActionStrategy {
  function getRandomRewards(
    uint actionId,
    uint actionAmount,
    uint[] calldata randomWords,
    uint randomWordStartIndex
  )
    external
    view
    returns (
      uint[] memory producedItemTokenIds,
      uint[] memory producedItemsAmounts,
      uint[] memory producedPetBaseIds,
      uint[] memory producedPetRandomWords
    );

  function setAction(InstantVRFActionInput calldata input) external;
}
