// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {IInstantVRFActionStrategy} from "./IInstantVRFActionStrategy.sol";

import {InstantVRFActionInput, RandomReward, MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION} from "../globals/rewards.sol";
import {NONE} from "../globals/items.sol";

contract GenericInstantVRFActionStrategy is UUPSUpgradeable, OwnableUpgradeable, IInstantVRFActionStrategy {
  error TooManyRandomRewards();
  error RandomRewardSpecifiedWithoutTokenId();
  error RandomRewardSpecifiedWithoutChance();
  error RandomRewardSpecifiedWithoutAmount();
  error RandomRewardChanceMustBeInOrder();
  error RandomRewardItemNoDuplicates();

  struct InstantVRFAction {
    uint16[15] randomRewardInfo; // Can have up to 5 different random reward tokens. Order is tokenId, chance, amount etc
  }

  mapping(uint actionId => InstantVRFAction action) private actions;

  function setAction(uint16 _actionId, InstantVRFActionInput calldata _input) external override {
    _checkRandomRewards(_input);
    actions[_actionId] = _packAction(_input);
  }

  function getRandomRewards(
    uint _actionId,
    uint _actionAmount,
    uint[] calldata _randomWords,
    uint _randomWordStartIndex
  ) external view override returns (uint[] memory ids, uint[] memory amounts) {
    ids = new uint[](MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION * _actionAmount);
    amounts = new uint[](MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION * _actionAmount);
    uint actualLength;

    RandomReward[] memory randomRewards = _setupRandomRewards(_actionId);

    if (randomRewards.length != 0) {
      bytes memory randomBytes = abi.encodePacked(_randomWords[_randomWordStartIndex:]);
      for (uint i; i < _actionAmount; ++i) {
        uint16 rand = _getSlice(randomBytes, i);

        RandomReward memory randomReward;
        for (uint j; j < randomRewards.length; ++j) {
          if (rand > randomRewards[j].chance) {
            break;
          }
          randomReward = randomRewards[j];
        }

        // This random reward's chance was hit, so add it to the hits
        ids[actualLength] = randomReward.itemTokenId;
        amounts[actualLength] = randomReward.amount;
        ++actualLength;
      }
    }
    assembly ("memory-safe") {
      mstore(ids, actualLength)
      mstore(amounts, actualLength)
    }
  }

  function _getSlice(bytes memory _b, uint _index) private pure returns (uint16) {
    uint256 index = _index * 2;
    return uint16(_b[index] | (bytes2(_b[index + 1]) >> 8));
  }

  function _setupRandomRewards(uint _actionId) private view returns (RandomReward[] memory randomRewards) {
    // Read the strategy from the actionId
    InstantVRFAction storage action = actions[_actionId];

    randomRewards = new RandomReward[](action.randomRewardInfo.length / 3);
    uint randomRewardLength;
    for (uint i; i < action.randomRewardInfo.length / 3; ++i) {
      if (action.randomRewardInfo[i * 3] == 0) {
        break;
      }
      randomRewards[randomRewardLength] = RandomReward(
        action.randomRewardInfo[i * 3],
        action.randomRewardInfo[i * 3 + 1],
        action.randomRewardInfo[i * 3 + 2]
      );
      ++randomRewardLength;
    }

    assembly ("memory-safe") {
      mstore(randomRewards, randomRewardLength)
    }
  }

  function _checkRandomRewards(InstantVRFActionInput calldata _actionInput) private pure {
    // Check random rewards are correct
    if (_actionInput.randomRewards.length > 5) {
      revert TooManyRandomRewards();
    }

    for (uint i; i < _actionInput.randomRewards.length; ++i) {
      if (_actionInput.randomRewards[i].itemTokenId == 0) {
        revert RandomRewardSpecifiedWithoutTokenId();
      }
      if (_actionInput.randomRewards[i].chance == 0) {
        revert RandomRewardSpecifiedWithoutChance();
      }
      if (_actionInput.randomRewards[i].amount == 0) {
        revert RandomRewardSpecifiedWithoutAmount();
      }

      if (i != _actionInput.randomRewards.length - 1) {
        if (_actionInput.randomRewards[i].chance <= _actionInput.randomRewards[i + 1].chance) {
          revert RandomRewardChanceMustBeInOrder();
        }
        for (uint j; j < _actionInput.randomRewards.length; ++j) {
          if (j != i && _actionInput.randomRewards[i].itemTokenId == _actionInput.randomRewards[j].itemTokenId) {
            revert RandomRewardItemNoDuplicates();
          }
        }
      }
    }
  }

  function _packAction(
    InstantVRFActionInput calldata _actionInput
  ) private pure returns (InstantVRFAction memory instantVRFAction) {
    instantVRFAction = InstantVRFAction({
      randomRewardInfo: [
        _actionInput.randomRewards.length > 0 ? _actionInput.randomRewards[0].itemTokenId : NONE,
        _actionInput.randomRewards.length > 0 ? _actionInput.randomRewards[0].chance : 0,
        _actionInput.randomRewards.length > 0 ? _actionInput.randomRewards[0].amount : 0,
        _actionInput.randomRewards.length > 1 ? _actionInput.randomRewards[1].itemTokenId : NONE,
        _actionInput.randomRewards.length > 1 ? _actionInput.randomRewards[1].chance : 0,
        _actionInput.randomRewards.length > 1 ? _actionInput.randomRewards[1].amount : 0,
        _actionInput.randomRewards.length > 2 ? _actionInput.randomRewards[2].itemTokenId : NONE,
        _actionInput.randomRewards.length > 2 ? _actionInput.randomRewards[2].chance : 0,
        _actionInput.randomRewards.length > 2 ? _actionInput.randomRewards[2].amount : 0,
        _actionInput.randomRewards.length > 3 ? _actionInput.randomRewards[3].itemTokenId : NONE,
        _actionInput.randomRewards.length > 3 ? _actionInput.randomRewards[3].chance : 0,
        _actionInput.randomRewards.length > 3 ? _actionInput.randomRewards[3].amount : 0,
        _actionInput.randomRewards.length > 4 ? _actionInput.randomRewards[4].itemTokenId : NONE,
        _actionInput.randomRewards.length > 4 ? _actionInput.randomRewards[4].chance : 0,
        _actionInput.randomRewards.length > 4 ? _actionInput.randomRewards[4].amount : 0
      ]
    });
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
