// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IInstantVRFActionStrategy} from "./interfaces/IInstantVRFActionStrategy.sol";
import {Skill} from "../globals/players.sol";
import {InstantVRFActionInput} from "../globals/rewards.sol";

contract EggInstantVRFActionStrategy is UUPSUpgradeable, OwnableUpgradeable, IInstantVRFActionStrategy {
  error OnlyInstantVRFActions();
  error BasePetIdMinGreaterThanMax();

  struct InstantVRFAction {
    uint16 rewardBasePetIdMin;
    uint16 rewardBasePetIdMax;
  }

  address private _instantVRFActions;
  uint32[65535] private _actions; // actionId => rewardBasePetIdMin | rewardBasePetIdMax

  modifier onlyInstantVRFActions() {
    require(_instantVRFActions == _msgSender(), OnlyInstantVRFActions());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address instantVRFActions) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _instantVRFActions = instantVRFActions;
  }

  function setAction(InstantVRFActionInput calldata input) external override onlyInstantVRFActions {
    (, InstantVRFAction memory instantVRFAction) = abi.decode(input.data, (uint8, InstantVRFAction));
    _actions[input.actionId - 1] =
      (uint32(instantVRFAction.rewardBasePetIdMin) << 16) |
      instantVRFAction.rewardBasePetIdMax;

    require(instantVRFAction.rewardBasePetIdMin <= instantVRFAction.rewardBasePetIdMax, BasePetIdMinGreaterThanMax());
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
    producedPetBaseIds = new uint256[](actionAmount);
    producedPetRandomWords = new uint256[](actionAmount);

    uint256 numWords = actionAmount / 16 + ((actionAmount % 16) == 0 ? 0 : 1);
    bytes memory randomBytes = abi.encodePacked(randomWords[randomWordStartIndex:randomWordStartIndex + numWords]);

    bytes memory randomBytes1;
    for (uint256 i = 0; i < numWords; ++i) {
      randomBytes1 = abi.encodePacked(randomBytes1, keccak256(abi.encodePacked(randomWords[randomWordStartIndex + i])));
    }
    for (uint256 i; i < actionAmount; ++i) {
      uint16 slice = _getSlice(randomBytes, i);

      uint32 packedBasePetIdExtremes = _actions[actionId - 1];
      uint16 rewardBasePetIdMin = uint16(packedBasePetIdExtremes >> 16);
      uint16 rewardBasePetIdMax = uint16(packedBasePetIdExtremes);

      uint16 producedPetBaseId = rewardBasePetIdMin + (slice % (rewardBasePetIdMax - rewardBasePetIdMin + 1));
      producedPetBaseIds[i] = producedPetBaseId;
      producedPetRandomWords[i] = _getSlice(randomBytes1, i);
    }
  }

  function _getSlice(bytes memory b, uint256 index) private pure returns (uint16) {
    uint256 key = index * 2;
    return uint16(b[key] | (bytes2(b[key + 1]) >> 8));
  }

  function setInstantVRFActions(address instantVRFActions) external onlyOwner {
    _instantVRFActions = instantVRFActions;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
