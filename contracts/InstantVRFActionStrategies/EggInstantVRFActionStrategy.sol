// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {IInstantVRFActionStrategy} from "./IInstantVRFActionStrategy.sol";

import {InstantVRFActionInput, MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION} from "../globals/rewards.sol";

// Just an example so far, use for eggs later
contract EggInstantVRFActionStrategy is UUPSUpgradeable, OwnableUpgradeable, IInstantVRFActionStrategy {
  error OnlyInstantVRFActions();

  address private instantVRFActions;

  modifier onlyInstantVRFActions() {
    if (instantVRFActions != _msgSender()) {
      revert OnlyInstantVRFActions();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address _instantVRFActions) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    instantVRFActions = _instantVRFActions;
  }

  function setAction(InstantVRFActionInput calldata _input) external override onlyInstantVRFActions {}

  function getRandomRewards(
    uint _actionId,
    uint _actionAmount,
    uint[] calldata _randomWords,
    uint _randomWordStartIndex
  ) external view override returns (uint[] memory, uint[] memory, uint[] memory, uint[] memory) {}

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
