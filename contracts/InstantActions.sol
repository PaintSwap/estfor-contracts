// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IPlayers} from "./interfaces/IPlayers.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {Quests} from "./Quests.sol";
import {SkillLibrary} from "./libraries/SkillLibrary.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

contract InstantActions is UUPSUpgradeable, OwnableUpgradeable {
  using SkillLibrary for uint8;
  using SkillLibrary for Skill;

  event AddInstantActions(InstantActionInput[] instantActionInputs);
  event EditInstantActions(InstantActionInput[] instantActionInputs);
  event RemoveInstantActions(InstantActionType[] actionTypes, uint16[] actionIds);
  event DoInstantActions(
    uint256 playerId,
    address from,
    uint16[] actionIds,
    uint256[] amounts,
    uint256[] consumedItemTokenIds,
    uint256[] consumedAmounts,
    uint256[] producedItemTokenIds,
    uint256[] producedAmounts,
    InstantActionType actionType
  );

  error ActionIdZeroNotAllowed();
  error InvalidOutputTokenId();
  error ActionDoesNotExist();
  error MinimumXPNotReached(Skill minSkill, uint256 minXP);
  error NotOwnerOfPlayerAndActive();
  error PlayerNotUpgraded();
  error ActionAlreadyExists();
  error UnsupportedActionType();
  error IncorrectInputAmounts();
  error InputSpecifiedWithoutAmount();
  error InputAmountsMustBeInOrder();
  error InvalidInputTokenId();
  error InputItemNoDuplicates();
  error TooManyInputItems();
  error InvalidSkill();
  error LengthMismatch();
  error MinimumSkillsNoDuplicates();
  error TooManyMinSkills();
  error InvalidActionId();
  error OutputAmountCannotBeZero();
  error OutputTokenIdCannotBeEmpty();
  error DependentQuestNotCompleted();
  error ActionMustBeAvailable();

  enum InstantActionType {
    NONE,
    FORGING_COMBINE,
    GENERIC
  }

  struct InstantActionInput {
    uint16 actionId;
    uint8[] minSkills;
    uint32[] minXPs;
    uint16[] inputTokenIds;
    uint24[] inputAmounts;
    uint16 outputTokenId;
    uint16 outputAmount;
    uint16 questPrerequisiteId;
    bool isFullModeOnly;
    bool isAvailable; // Only used for
    InstantActionType actionType;
  }

  struct InstantAction {
    uint8 minSkill1;
    uint32 minXP1;
    uint8 minSkill2;
    uint32 minXP2;
    uint8 minSkill3;
    uint32 minXP3;
    uint16 inputTokenId1;
    uint24 inputAmount1;
    uint16 inputTokenId2;
    uint24 inputAmount2;
    uint16 inputTokenId3;
    uint24 inputAmount3;
    bytes1 packedData; // last bit is full mode only
    bytes1 reserved;
    // Second storage slot
    uint16 questPrerequisiteId;
    uint16 outputTokenId;
    uint24 outputAmount;
  }

  struct InstantActionState {
    uint256[] consumedTokenIds;
    uint256[] consumedAmounts;
    uint256[] producedTokenIds;
    uint256[] producedAmounts;
  }

  IPlayers private _players;
  Quests private _quests;
  mapping(InstantActionType actionType => mapping(uint16 actionId => InstantAction instantAction)) private _actions;
  ItemNFT private _itemNFT;

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IPlayers players, ItemNFT itemNFT, Quests quests) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());
    _quests = quests;
    _players = players;
    _itemNFT = itemNFT;
  }

  function getAction(InstantActionType actionType, uint16 actionId) external view returns (InstantAction memory) {
    return _actions[actionType][actionId];
  }

  function doInstantActions(
    uint256 playerId,
    uint16[] calldata actionIds,
    uint256[] calldata amounts,
    InstantActionType actionType
  ) external isOwnerOfPlayerAndActive(playerId) {
    InstantActionState memory instantActionState = getInstantActionState(playerId, actionIds, amounts, actionType);

    _itemNFT.burnBatch(_msgSender(), instantActionState.consumedTokenIds, instantActionState.consumedAmounts);
    _itemNFT.mintBatch(_msgSender(), instantActionState.producedTokenIds, instantActionState.producedAmounts);

    emit DoInstantActions(
      playerId,
      _msgSender(),
      actionIds,
      amounts,
      instantActionState.consumedTokenIds,
      instantActionState.consumedAmounts,
      instantActionState.producedTokenIds,
      instantActionState.producedAmounts,
      actionType
    );
  }

  function _checkDoActionRequirements(uint256 playerId, InstantAction storage instantAction) private view {
    require(instantAction.inputTokenId1 != NONE, InvalidActionId());
    _checkMinXPRequirements(playerId, instantAction);
    require(!_isActionFullMode(instantAction) || _players.isPlayerUpgraded(playerId), PlayerNotUpgraded());
    if (instantAction.questPrerequisiteId != 0) {
      require(_quests.isQuestCompleted(playerId, instantAction.questPrerequisiteId), DependentQuestNotCompleted());
    }
  }

  function getInstantActionState(
    uint256 playerId,
    uint16[] calldata actionIds,
    uint256[] calldata amounts,
    InstantActionType actionType
  ) public view returns (InstantActionState memory instantActionState) {
    if (actionType == InstantActionType.FORGING_COMBINE) {
      instantActionState = _forgingCombineActionState(playerId, actionIds, amounts);
    } else if (actionType == InstantActionType.GENERIC) {
      instantActionState = _genericInstantActionState(playerId, actionIds, amounts);
    } else {
      revert UnsupportedActionType();
    }
  }

  function _genericInstantActionState(
    uint256 playerId,
    uint16[] calldata actionIds,
    uint256[] calldata amounts
  ) private view returns (InstantActionState memory instantActionState) {
    // Burn all those and mint the components back
    uint256 MAX_INPUTS = 3;
    instantActionState.consumedTokenIds = new uint256[](actionIds.length * MAX_INPUTS);
    instantActionState.consumedAmounts = new uint256[](actionIds.length * MAX_INPUTS);
    instantActionState.producedTokenIds = new uint256[](actionIds.length);
    instantActionState.producedAmounts = new uint256[](actionIds.length);
    uint256 length;
    mapping(uint16 actionId => InstantAction instantAction) storage actions = _actions[InstantActionType.GENERIC];
    for (uint256 i; i < actionIds.length; ++i) {
      InstantAction storage instantAction = actions[actionIds[i]];

      _checkDoActionRequirements(playerId, instantAction);

      if (instantAction.inputTokenId1 != 0) {
        instantActionState.consumedTokenIds[length] = instantAction.inputTokenId1;
        instantActionState.consumedAmounts[length++] = instantAction.inputAmount1 * amounts[i];
      }

      if (instantAction.inputTokenId2 != 0) {
        instantActionState.consumedTokenIds[length] = instantAction.inputTokenId2;
        instantActionState.consumedAmounts[length++] = instantAction.inputAmount2 * amounts[i];
      }

      if (instantAction.inputTokenId3 != 0) {
        instantActionState.consumedTokenIds[length] = instantAction.inputTokenId3;
        instantActionState.consumedAmounts[length++] = instantAction.inputAmount3 * amounts[i];
      }

      instantActionState.producedTokenIds[i] = instantAction.outputTokenId;
      instantActionState.producedAmounts[i] = instantAction.outputAmount * amounts[i];
    }

    uint256[] memory consumedTokenIds = instantActionState.consumedTokenIds;
    uint256[] memory consumedAmounts = instantActionState.consumedAmounts;

    assembly ("memory-safe") {
      mstore(consumedTokenIds, length)
      mstore(consumedAmounts, length)
    }
  }

  function _forgingCombineActionState(
    uint256 playerId,
    uint16[] calldata actionIds,
    uint256[] calldata amounts
  ) private view returns (InstantActionState memory instantActionState) {
    // Forging actions only have 1 input, burn all those and mint the components back
    instantActionState.consumedTokenIds = new uint256[](actionIds.length);
    instantActionState.consumedAmounts = new uint256[](actionIds.length);
    // All outputTokenIds should be the same for forging
    uint256 producedAmount;
    uint256 producedTokenId = _actions[InstantActionType.FORGING_COMBINE][actionIds[0]].outputTokenId;
    for (uint256 i; i < actionIds.length; ++i) {
      InstantAction storage instantAction = _actions[InstantActionType.FORGING_COMBINE][actionIds[i]];
      // All outputs should be the same
      require(producedTokenId == instantAction.outputTokenId, InvalidOutputTokenId());

      _checkDoActionRequirements(playerId, instantAction);

      producedAmount += instantAction.outputAmount * amounts[i];
      instantActionState.consumedTokenIds[i] = instantAction.inputTokenId1;
      instantActionState.consumedAmounts[i] = instantAction.inputAmount1 * amounts[i];
    }

    instantActionState.producedTokenIds = new uint256[](1);
    instantActionState.producedTokenIds[0] = producedTokenId;
    instantActionState.producedAmounts = new uint256[](1);
    instantActionState.producedAmounts[0] = producedAmount;
  }

  function _checkMinXPRequirements(uint256 playerId, InstantAction storage instantAction) private view {
    Skill minSkill1 = instantAction.minSkill1._asSkill();
    require(
      minSkill1 == Skill.NONE || _players.getPlayerXP(playerId, minSkill1) >= instantAction.minXP1,
      MinimumXPNotReached(minSkill1, instantAction.minXP1)
    );

    Skill minSkill2 = instantAction.minSkill2._asSkill();
    require(
      minSkill2 == Skill.NONE || _players.getPlayerXP(playerId, minSkill2) >= instantAction.minXP2,
      MinimumXPNotReached(minSkill2, instantAction.minXP2)
    );

    Skill minSkill3 = instantAction.minSkill3._asSkill();
    require(
      minSkill3 == Skill.NONE || _players.getPlayerXP(playerId, minSkill3) >= instantAction.minXP3,
      MinimumXPNotReached(minSkill3, instantAction.minXP3)
    );
  }

  function _setAction(InstantActionInput calldata instantActionInput) private {
    require(instantActionInput.actionId != 0, ActionIdZeroNotAllowed());
    require(instantActionInput.actionType != InstantActionType.NONE, UnsupportedActionType());
    require(instantActionInput.isAvailable, ActionMustBeAvailable());
    _checkInputs(instantActionInput);
    _actions[instantActionInput.actionType][instantActionInput.actionId] = _packAction(instantActionInput);
  }

  function _isActionFullMode(InstantAction memory instantAction) private pure returns (bool) {
    return uint8(instantAction.packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _packAction(
    InstantActionInput calldata actionInput
  ) private pure returns (InstantAction memory instantAction) {
    bytes1 packedData = bytes1(uint8(actionInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    instantAction = InstantAction({
      minSkill1: actionInput.minSkills.length != 0 ? actionInput.minSkills[0] : Skill.NONE._asUint8(),
      minXP1: actionInput.minXPs.length != 0 ? actionInput.minXPs[0] : 0,
      minSkill2: actionInput.minSkills.length > 1 ? actionInput.minSkills[1] : Skill.NONE._asUint8(),
      minXP2: actionInput.minXPs.length > 1 ? actionInput.minXPs[1] : 0,
      minSkill3: actionInput.minSkills.length > 2 ? actionInput.minSkills[2] : Skill.NONE._asUint8(),
      minXP3: actionInput.minXPs.length > 2 ? actionInput.minXPs[2] : 0,
      inputTokenId1: actionInput.inputTokenIds.length != 0 ? actionInput.inputTokenIds[0] : NONE,
      inputAmount1: actionInput.inputAmounts.length != 0 ? actionInput.inputAmounts[0] : 0,
      inputTokenId2: actionInput.inputTokenIds.length > 1 ? actionInput.inputTokenIds[1] : NONE,
      inputAmount2: actionInput.inputAmounts.length > 1 ? actionInput.inputAmounts[1] : 0,
      inputTokenId3: actionInput.inputTokenIds.length > 2 ? actionInput.inputTokenIds[2] : NONE,
      inputAmount3: actionInput.inputAmounts.length > 2 ? actionInput.inputAmounts[2] : 0,
      reserved: 0,
      outputTokenId: actionInput.outputTokenId,
      outputAmount: actionInput.outputAmount,
      packedData: packedData,
      questPrerequisiteId: actionInput.questPrerequisiteId
    });
  }

  // Assumes that it has at least 1 input
  function _actionExists(InstantActionInput calldata instantActionInput) private view returns (bool) {
    return _actions[instantActionInput.actionType][instantActionInput.actionId].inputTokenId1 != NONE;
  }

  function _checkInputs(InstantActionInput calldata actionInput) private pure {
    (uint16[] calldata inputTokenIds, uint24[] calldata amounts) = (
      actionInput.inputTokenIds,
      actionInput.inputAmounts
    );

    require(inputTokenIds.length <= 3, TooManyInputItems());
    require(inputTokenIds.length == amounts.length, LengthMismatch());
    require(
      actionInput.outputTokenId == NONE || (actionInput.outputTokenId != NONE && actionInput.outputAmount != 0),
      OutputAmountCannotBeZero()
    );
    require(
      actionInput.outputAmount == 0 || (actionInput.outputTokenId != NONE && actionInput.outputAmount != 0),
      OutputTokenIdCannotBeEmpty()
    );

    // If forging then you need exactly 1 input
    if (actionInput.actionType == InstantActionType.FORGING_COMBINE) {
      require(inputTokenIds.length == 1, IncorrectInputAmounts());
    } else {
      // Otherwise you need at least 1 input
      require(inputTokenIds.length != 0, IncorrectInputAmounts());
    }

    for (uint256 i; i < inputTokenIds.length; ++i) {
      require(inputTokenIds[i] != 0, InvalidInputTokenId());
      require(amounts[i] != 0, InputSpecifiedWithoutAmount());

      if (i != inputTokenIds.length - 1) {
        require(amounts[i] <= amounts[i + 1], InputAmountsMustBeInOrder());
        for (uint256 j; j < inputTokenIds.length; ++j) {
          require(j == i || inputTokenIds[i] != inputTokenIds[j], InputItemNoDuplicates());
        }
      }
    }

    // Check minimum xp
    (uint8[] calldata minSkills, uint32[] calldata minXPs) = (actionInput.minSkills, actionInput.minXPs);

    require(minSkills.length <= 3, TooManyMinSkills());
    require(minSkills.length == minXPs.length, LengthMismatch());
    for (uint256 i; i < minSkills.length; ++i) {
      require(!minSkills[i]._isSkillNone(), InvalidSkill());
      require(minXPs[i] != 0, InputSpecifiedWithoutAmount());

      if (i != minSkills.length - 1) {
        for (uint256 j; j < minSkills.length; ++j) {
          require(j == i || minSkills[i] != minSkills[j], MinimumSkillsNoDuplicates());
        }
      }
    }
  }

  function addActions(InstantActionInput[] calldata instantActionInputs) external onlyOwner {
    for (uint256 i; i < instantActionInputs.length; ++i) {
      InstantActionInput calldata instantActionInput = instantActionInputs[i];
      require(!_actionExists(instantActionInput), ActionAlreadyExists());
      _setAction(instantActionInput);
    }
    emit AddInstantActions(instantActionInputs);
  }

  function editActions(InstantActionInput[] calldata instantActionInputs) external onlyOwner {
    for (uint256 i = 0; i < instantActionInputs.length; ++i) {
      InstantActionInput calldata instantActionInput = instantActionInputs[i];
      require(_actionExists(instantActionInput), ActionDoesNotExist());
      _setAction(instantActionInput);
    }
    emit EditInstantActions(instantActionInputs);
  }

  function removeActions(
    InstantActionType[] calldata actionTypes,
    uint16[] calldata instantActionIds
  ) external onlyOwner {
    require(instantActionIds.length == actionTypes.length, LengthMismatch());

    for (uint256 i = 0; i < instantActionIds.length; ++i) {
      require(_actions[actionTypes[i]][instantActionIds[i]].inputTokenId1 != NONE, ActionDoesNotExist());
      delete _actions[actionTypes[i]][instantActionIds[i]];
    }
    emit RemoveInstantActions(actionTypes, instantActionIds);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
