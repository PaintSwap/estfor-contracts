// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {IInstantVRFActionStrategy} from "./IInstantVRFActionStrategy.sol";

import {Skill} from "../globals/players.sol";
import {InstantVRFActionInput, InstantVRFActionType, InstantVRFRandomReward} from "../globals/rewards.sol";
import {NONE} from "../globals/items.sol";

contract GenericInstantVRFActionStrategy is UUPSUpgradeable, OwnableUpgradeable, IInstantVRFActionStrategy {
  error TooManyRandomRewards();
  error RandomRewardSpecifiedWithoutTokenId();
  error RandomRewardSpecifiedWithoutChance();
  error RandomRewardSpecifiedWithoutAmount();
  error RandomRewardChanceMustBeInOrder();
  error RandomRewardItemNoDuplicates();
  error OnlyInstantVRFActions();

  struct InstantVRFAction {
    uint16[30] randomRewardInfo; // Can have up to 5 different random reward tokens. Order is tokenId, chance, amount etc
  }

  mapping(uint actionId => InstantVRFAction action) private actions;
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

  function setAction(InstantVRFActionInput calldata _input) external override onlyInstantVRFActions {
    (, InstantVRFRandomReward[] memory randomRewards) = abi.decode(_input.data, (uint8, InstantVRFRandomReward[]));
    _checkRandomRewards(randomRewards);
    actions[_input.actionId] = _packAction(randomRewards);
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
    returns (
      uint[] memory producedItemTokenIds,
      uint[] memory producedItemsAmounts,
      uint[] memory producedPetBaseIds,
      uint[] memory producedPetRandomWords
    )
  {
    producedItemTokenIds = new uint[](_actionAmount);
    producedItemsAmounts = new uint[](_actionAmount);
    InstantVRFRandomReward[] memory randomRewards = _setupRandomRewards(_actionId);

    if (randomRewards.length != 0) {
      uint numWords = _actionAmount / 16 + ((_actionAmount % 16) == 0 ? 0 : 1);
      bytes memory randomBytes = abi.encodePacked(_randomWords[_randomWordStartIndex:_randomWordStartIndex + numWords]);
      for (uint i; i < _actionAmount; ++i) {
        uint16 rand = _getSlice(randomBytes, i);

        InstantVRFRandomReward memory randomReward;
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

  function _setupRandomRewards(uint _actionId) private view returns (InstantVRFRandomReward[] memory randomRewards) {
    // Read the strategy from the actionId
    InstantVRFAction storage action = actions[_actionId];

    randomRewards = new InstantVRFRandomReward[](action.randomRewardInfo.length / 3);
    uint randomRewardLength;
    for (uint i; i < action.randomRewardInfo.length / 3; ++i) {
      if (action.randomRewardInfo[i * 3] == 0) {
        break;
      }
      randomRewards[randomRewardLength] = InstantVRFRandomReward(
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

  function _checkRandomRewards(InstantVRFRandomReward[] memory _randomRewards) private pure {
    // Check random rewards are correct
    if (_randomRewards.length > 10) {
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
      }
    }
  }

  function _packAction(
    InstantVRFRandomReward[] memory _randomRewards
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
        _randomRewards.length > 4 ? _randomRewards[4].amount : 0,
        _randomRewards.length > 5 ? _randomRewards[5].itemTokenId : NONE,
        _randomRewards.length > 5 ? _randomRewards[5].chance : 0,
        _randomRewards.length > 5 ? _randomRewards[5].amount : 0,
        _randomRewards.length > 6 ? _randomRewards[6].itemTokenId : NONE,
        _randomRewards.length > 6 ? _randomRewards[6].chance : 0,
        _randomRewards.length > 6 ? _randomRewards[6].amount : 0,
        _randomRewards.length > 7 ? _randomRewards[7].itemTokenId : NONE,
        _randomRewards.length > 7 ? _randomRewards[7].chance : 0,
        _randomRewards.length > 7 ? _randomRewards[7].amount : 0,
        _randomRewards.length > 8 ? _randomRewards[8].itemTokenId : NONE,
        _randomRewards.length > 8 ? _randomRewards[8].chance : 0,
        _randomRewards.length > 8 ? _randomRewards[8].amount : 0,
        _randomRewards.length > 9 ? _randomRewards[9].itemTokenId : NONE,
        _randomRewards.length > 9 ? _randomRewards[9].chance : 0,
        _randomRewards.length > 9 ? _randomRewards[9].amount : 0
      ]
    });
  }

  // TODO, Delete later if there are other changes made in this file. Just to change up the bytecode for a rogue deployment
  function version() external view returns (uint) {
    return 1;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
