// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {IInstantVRFActionStrategy} from "./IInstantVRFActionStrategy.sol";

import {Skill} from "../globals/players.sol";
import {InstantVRFActionInput, InstantVRFActionType, RandomReward, MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION} from "../globals/rewards.sol";
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
    (, RandomReward[] memory randomRewards) = abi.decode(_input.data, (uint8, RandomReward[]));
    _checkRandomRewards(randomRewards);
    actions[_actionId] = _packAction(randomRewards);
  }

  function getRandomRewards(
    uint _actionId,
    uint _actionAmount,
    uint[] calldata _randomWords,
    uint _randomWordStartIndex
  )
    external
    view
    override
    returns (uint[] memory producedItemTokenIds, uint[] memory producedItemsAmounts, uint[] memory, uint[] memory)
  {
    producedItemTokenIds = new uint[](MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION * _actionAmount);
    producedItemsAmounts = new uint[](MAX_INSTANT_VRF_RANDOM_REWARDS_PER_ACTION * _actionAmount);
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

        producedItemTokenIds[i] = randomReward.itemTokenId;
        producedItemsAmounts[i] = randomReward.amount;
      }
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

  function _checkRandomRewards(RandomReward[] memory _randomRewards) private pure {
    // Check random rewards are correct
    if (_randomRewards.length > 5) {
      revert TooManyRandomRewards();
    }

    for (uint i; i < _randomRewards.length; ++i) {
      if (_randomRewards[i].itemTokenId == 0) {
        revert RandomRewardSpecifiedWithoutTokenId();
      }
      if (_randomRewards[i].chance == 0) {
        revert RandomRewardSpecifiedWithoutChance();
      }
      if (_randomRewards[i].amount == 0) {
        revert RandomRewardSpecifiedWithoutAmount();
      }

      if (i != _randomRewards.length - 1) {
        if (_randomRewards[i].chance <= _randomRewards[i + 1].chance) {
          revert RandomRewardChanceMustBeInOrder();
        }
        for (uint j; j < _randomRewards.length; ++j) {
          if (j != i && _randomRewards[i].itemTokenId == _randomRewards[j].itemTokenId) {
            revert RandomRewardItemNoDuplicates();
          }
        }
      }
    }
  }

  function _packAction(
    RandomReward[] memory _randomRewards
  ) private pure returns (InstantVRFAction memory instantVRFAction) {
    instantVRFAction = InstantVRFAction({
      randomRewardInfo: [
        _randomRewards.length > 0 ? _randomRewards[0].itemTokenId : NONE,
        _randomRewards.length > 0 ? _randomRewards[0].chance : 0,
        _randomRewards.length > 0 ? _randomRewards[0].amount : 0,
        _randomRewards.length > 1 ? _randomRewards[1].itemTokenId : NONE,
        _randomRewards.length > 1 ? _randomRewards[1].chance : 0,
        _randomRewards.length > 1 ? _randomRewards[1].amount : 0,
        _randomRewards.length > 2 ? _randomRewards[2].itemTokenId : NONE,
        _randomRewards.length > 2 ? _randomRewards[2].chance : 0,
        _randomRewards.length > 2 ? _randomRewards[2].amount : 0,
        _randomRewards.length > 3 ? _randomRewards[3].itemTokenId : NONE,
        _randomRewards.length > 3 ? _randomRewards[3].chance : 0,
        _randomRewards.length > 3 ? _randomRewards[3].amount : 0,
        _randomRewards.length > 4 ? _randomRewards[4].itemTokenId : NONE,
        _randomRewards.length > 4 ? _randomRewards[4].chance : 0,
        _randomRewards.length > 4 ? _randomRewards[4].amount : 0
      ]
    });
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
