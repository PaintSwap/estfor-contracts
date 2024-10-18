// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {IInstantVRFActionStrategy} from "./interfaces/IInstantVRFActionStrategy.sol";

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

  mapping(uint256 actionId => InstantVRFAction action) private _actions;
  address private _instantVRFActions;

  modifier onlyInstantVRFActions() {
    if (_instantVRFActions != _msgSender()) {
      revert OnlyInstantVRFActions();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address instantVRFActions) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    _instantVRFActions = instantVRFActions;
  }

  function setAction(InstantVRFActionInput calldata input) external override onlyInstantVRFActions {
    (, InstantVRFRandomReward[] memory randomRewards) = abi.decode(input.data, (uint8, InstantVRFRandomReward[]));
    _checkRandomRewards(randomRewards);
    _actions[input.actionId] = _packAction(randomRewards);
  }

  function getRandomRewards(
    uint256 actionId,
    uint256 actionAmount,
    uint256[] calldata randomWords,
    uint256 randomWordStartIndex
  )
    external
    view
    override
    returns (
      uint256[] memory producedItemTokenIds,
      uint256[] memory producedItemsAmounts,
      uint256[] memory producedPetBaseIds,
      uint256[] memory producedPetRandomWords
    )
  {
    producedItemTokenIds = new uint256[](actionAmount);
    producedItemsAmounts = new uint256[](actionAmount);
    InstantVRFRandomReward[] memory randomRewards = _setupRandomRewards(actionId);

    uint256 length = randomRewards.length;
    if (length != 0) {
      uint256 numWords = actionAmount / 16 + ((actionAmount % 16) == 0 ? 0 : 1);
      bytes memory randomBytes = abi.encodePacked(randomWords[randomWordStartIndex:randomWordStartIndex + numWords]);
      for (uint256 i; i < actionAmount; ++i) {
        uint16 rand = _getSlice(randomBytes, i);

        InstantVRFRandomReward memory randomReward;
        for (uint256 j; j < length; ++j) {
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

  function _getSlice(bytes memory b, uint256 index) private pure returns (uint16) {
    uint256 key = index * 2;
    return uint16(b[key] | (bytes2(b[key + 1]) >> 8));
  }

  function _setupRandomRewards(uint256 actionId) private view returns (InstantVRFRandomReward[] memory randomRewards) {
    // Read the strategy from the actionId
    InstantVRFAction storage action = _actions[actionId];

    randomRewards = new InstantVRFRandomReward[](action.randomRewardInfo.length / 3);
    uint256 randomRewardLength;
    for (uint256 i; i < action.randomRewardInfo.length / 3; ++i) {
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

  function _checkRandomRewards(InstantVRFRandomReward[] memory randomRewards) private pure {
    uint256 length = randomRewards.length;
    // Check random rewards are correct
    if (length > 10) {
      revert TooManyRandomRewards();
    }

    for (uint256 i; i < length; ++i) {
      if (randomRewards[i].itemTokenId == 0) {
        revert RandomRewardSpecifiedWithoutTokenId();
      }
      if (randomRewards[i].chance == 0) {
        revert RandomRewardSpecifiedWithoutChance();
      }
      if (randomRewards[i].amount == 0) {
        revert RandomRewardSpecifiedWithoutAmount();
      }

      if (i != length - 1) {
        if (randomRewards[i].chance <= randomRewards[i + 1].chance) {
          revert RandomRewardChanceMustBeInOrder();
        }
      }
    }
  }

  function _packAction(
    InstantVRFRandomReward[] memory randomRewards
  ) private pure returns (InstantVRFAction memory instantVRFAction) {
    uint256 length = randomRewards.length;
    instantVRFAction = InstantVRFAction({
      randomRewardInfo: [
        length != 0 ? randomRewards[0].itemTokenId : NONE,
        length != 0 ? randomRewards[0].chance : 0,
        length != 0 ? randomRewards[0].amount : 0,
        length > 1 ? randomRewards[1].itemTokenId : NONE,
        length > 1 ? randomRewards[1].chance : 0,
        length > 1 ? randomRewards[1].amount : 0,
        length > 2 ? randomRewards[2].itemTokenId : NONE,
        length > 2 ? randomRewards[2].chance : 0,
        length > 2 ? randomRewards[2].amount : 0,
        length > 3 ? randomRewards[3].itemTokenId : NONE,
        length > 3 ? randomRewards[3].chance : 0,
        length > 3 ? randomRewards[3].amount : 0,
        length > 4 ? randomRewards[4].itemTokenId : NONE,
        length > 4 ? randomRewards[4].chance : 0,
        length > 4 ? randomRewards[4].amount : 0,
        length > 5 ? randomRewards[5].itemTokenId : NONE,
        length > 5 ? randomRewards[5].chance : 0,
        length > 5 ? randomRewards[5].amount : 0,
        length > 6 ? randomRewards[6].itemTokenId : NONE,
        length > 6 ? randomRewards[6].chance : 0,
        length > 6 ? randomRewards[6].amount : 0,
        length > 7 ? randomRewards[7].itemTokenId : NONE,
        length > 7 ? randomRewards[7].chance : 0,
        length > 7 ? randomRewards[7].amount : 0,
        length > 8 ? randomRewards[8].itemTokenId : NONE,
        length > 8 ? randomRewards[8].chance : 0,
        length > 8 ? randomRewards[8].amount : 0,
        length > 9 ? randomRewards[9].itemTokenId : NONE,
        length > 9 ? randomRewards[9].chance : 0,
        length > 9 ? randomRewards[9].amount : 0
      ]
    });
  }

  // TODO, Delete later if there are other changes made in this file. Just to change up the bytecode for a rogue deployment
  function version() external view returns (uint256) {
    return 1;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
