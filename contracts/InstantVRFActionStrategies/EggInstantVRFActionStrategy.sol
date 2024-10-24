// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

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

  address private instantVRFActions;
  uint32[65535] private actions; // actionId => rewardBasePetIdMin | rewardBasePetIdMax

  modifier onlyInstantVRFActions() {
    require(instantVRFActions == _msgSender(), OnlyInstantVRFActions());
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
    (, InstantVRFAction memory instantVRFAction) = abi.decode(_input.data, (uint8, InstantVRFAction));
    actions[_input.actionId - 1] =
      (uint32(instantVRFAction.rewardBasePetIdMin) << 16) |
      instantVRFAction.rewardBasePetIdMax;

    require(instantVRFAction.rewardBasePetIdMin <= instantVRFAction.rewardBasePetIdMax, BasePetIdMinGreaterThanMax());
  }

  function getRandomRewards(
    uint256 _actionId,
    uint256 _actionAmount,
    uint256[] calldata _randomWords,
    uint256 _randomWordStartIndex
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
    producedPetBaseIds = new uint256[](_actionAmount);
    producedPetRandomWords = new uint256[](_actionAmount);

    uint256 numWords = _actionAmount / 16 + ((_actionAmount % 16) == 0 ? 0 : 1);
    bytes memory randomBytes = abi.encodePacked(_randomWords[_randomWordStartIndex:_randomWordStartIndex + numWords]);

    bytes memory randomBytes1;
    for (uint256 i = 0; i < numWords; ++i) {
      randomBytes1 = abi.encodePacked(
        randomBytes1,
        keccak256(abi.encodePacked(_randomWords[_randomWordStartIndex + i]))
      );
    }
    for (uint256 i; i < _actionAmount; ++i) {
      uint16 slice = _getSlice(randomBytes, i);

      uint32 packedBasePetIdExtremes = actions[_actionId - 1];
      uint16 rewardBasePetIdMin = uint16(packedBasePetIdExtremes >> 16);
      uint16 rewardBasePetIdMax = uint16(packedBasePetIdExtremes);

      uint16 producedPetBaseId = rewardBasePetIdMin + (slice % (rewardBasePetIdMax - rewardBasePetIdMin + 1));
      producedPetBaseIds[i] = producedPetBaseId;
      producedPetRandomWords[i] = _getSlice(randomBytes1, i);
    }
  }

  function _getSlice(bytes memory _b, uint256 _index) private pure returns (uint16) {
    uint256 index = _index * 2;
    return uint16(_b[index] | (bytes2(_b[index + 1]) >> 8));
  }

  function setInstantVRFActions(address _instantVRFActions) external onlyOwner {
    instantVRFActions = _instantVRFActions;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
