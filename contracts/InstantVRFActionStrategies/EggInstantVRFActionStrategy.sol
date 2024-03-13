// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {IInstantVRFActionStrategy} from "./IInstantVRFActionStrategy.sol";

import {InstantVRFActionInput, RandomReward, MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION} from "../globals/rewards.sol";

// Just an example so far, use for eggs later
contract EggInstantVRFActionStrategy is UUPSUpgradeable, OwnableUpgradeable, IInstantVRFActionStrategy {
  function setAction(uint16 _actionId, InstantVRFActionInput calldata _input) external override {}

  function getRandomRewards(
    uint _actionId,
    uint _actionAmount,
    uint[] calldata _randomWords,
    uint _randomWordStartIndex
  ) external view override returns (uint[] memory ids, uint[] memory amounts) {
    ids = new uint[](MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION * _actionAmount);
    amounts = new uint[](MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION * _actionAmount);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
