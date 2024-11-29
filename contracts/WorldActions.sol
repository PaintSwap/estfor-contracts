// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {SkillLibrary} from "./libraries/SkillLibrary.sol";
import {IWorldActions} from "./interfaces/IWorldActions.sol";

import {EstforLibrary} from "./EstforLibrary.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

contract WorldActions is UUPSUpgradeable, OwnableUpgradeable, IWorldActions {
  using SkillLibrary for uint8;
  using SkillLibrary for Skill;

  event AddActions(ActionInput[] actions);
  event EditActions(ActionInput[] actions);
  event AddActionChoices(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInput[] choices);
  event EditActionChoices(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInput[] choices);
  event RemoveActionChoices(uint16 actionId, uint16[] actionChoiceIds);

  error ActionIdZeroNotAllowed();
  error MinCannotBeGreaterThanMax();
  error ActionAlreadyExists(uint16 actionId);
  error ActionDoesNotExist();
  error ActionChoiceIdZeroNotAllowed();
  error LengthMismatch();
  error NoActionChoices();
  error ActionChoiceAlreadyExists();
  error ActionChoiceDoesNotExist();
  error NotAFactorOf3600(uint256 val);
  error NonCombatWithActionChoicesCannotHaveBothGuaranteedAndRandomRewards();
  error InputSpecifiedWithoutAmount();
  error InputAmountsMustBeInOrder();
  error TooManyInputItems();
  error InvalidInputTokenId();
  error InputItemNoDuplicates();
  error InvalidSkill();
  error MinimumSkillsNoDuplicates();
  error TooManySkills();
  error OutputAmountCannotBeZero();
  error OutputTokenIdCannotBeEmpty();

  mapping(uint256 actionId => ActionInfo actionInfo) private _actions;
  mapping(uint256 actionId => mapping(uint16 choiceId => ActionChoice actionChoice)) private _actionChoices;
  mapping(uint256 actionId => CombatStats combatStats) private _actionCombatStats;
  mapping(uint256 actionId => ActionRewards actionRewards) private _actionRewards;

  mapping(uint256 tier => Equipment[]) private _dailyRewardPool;
  mapping(uint256 tier => Equipment[]) private _weeklyRewardPool;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());
  }

  function getAction(uint256 actionId) external view returns (ActionInfo memory) {
    return _actions[actionId];
  }

  function getSkill(uint256 actionId) external view override returns (Skill) {
    return _actions[actionId].skill._asSkill();
  }

  function getActionRewards(uint256 actionId) external view override returns (ActionRewards memory) {
    return _actionRewards[actionId];
  }

  function getActionInfo(uint256 actionId) external view override returns (ActionInfo memory info) {
    return _actions[actionId];
  }

  function getXPPerHour(uint16 actionId, uint16 actionChoiceId) external view override returns (uint24 xpPerHour) {
    return actionChoiceId != 0 ? _actionChoices[actionId][actionChoiceId].xpPerHour : _actions[actionId].xpPerHour;
  }

  function getNumSpawn(uint16 actionId) external view override returns (uint256 numSpawned) {
    return _actions[actionId].numSpawned;
  }

  function getCombatStats(uint16 actionId) external view override returns (CombatStats memory stats) {
    stats = _actionCombatStats[actionId];
  }

  function getActionChoice(
    uint16 actionId,
    uint16 choiceId
  ) external view override returns (ActionChoice memory choice) {
    return _actionChoices[actionId][choiceId];
  }

  function getActionSuccessPercentAndMinXP(
    uint16 actionId
  ) external view override returns (uint8 successPercent, uint32 minXP) {
    return (_actions[actionId].successPercent, _actions[actionId].minXP);
  }

  function getRewardsHelper(
    uint16 actionId
  ) external view returns (ActionRewards memory, Skill skill, uint256 numSpawned) {
    // , uint8 worldLocation) {
    return (
      _actionRewards[actionId],
      _actions[actionId].skill._asSkill(),
      _actions[actionId].numSpawned
      //      _actions[actionId].worldLocation
    );
  }

  function _addAction(ActionInput calldata action) private {
    require(_actions[action.actionId].skill._asSkill() == Skill.NONE, ActionAlreadyExists(action.actionId));
    _setAction(action);
  }

  function _setAction(ActionInput calldata action) private {
    require(action.actionId != 0, ActionIdZeroNotAllowed());
    require(action.info.handItemTokenIdRangeMin <= action.info.handItemTokenIdRangeMax, MinCannotBeGreaterThanMax());

    if (action.info.numSpawned != 0) {
      // Combat
      require((3600 * SPAWN_MUL) % action.info.numSpawned == 0, NotAFactorOf3600(action.info.numSpawned));
    } else if (action.guaranteedRewards.length != 0) {
      // Non-combat guaranteed rewards. Only care about the first one as it's used for correctly taking into account partial loots.
      require(
        (3600 * GUAR_MUL) % action.guaranteedRewards[0].rate == 0,
        NotAFactorOf3600(action.guaranteedRewards[0].rate)
      );
    }

    _actions[action.actionId] = action.info;

    // Set the rewards
    ActionRewards storage _actionReward = _actionRewards[action.actionId];
    delete _actionRewards[action.actionId];
    EstforLibrary._setActionGuaranteedRewards(action.guaranteedRewards, _actionReward);
    EstforLibrary._setActionRandomRewards(action.randomRewards, _actionReward);

    if (action.info.skill._isSkillCombat()) {
      _actionCombatStats[action.actionId] = action.combatStats;
    } else {
      bool actionHasGuaranteedRewards = action.guaranteedRewards.length != 0;
      bool actionHasRandomRewards = action.randomRewards.length != 0;
      require(
        !(actionHasGuaranteedRewards && actionHasRandomRewards && action.info.actionChoiceRequired),
        NonCombatWithActionChoicesCannotHaveBothGuaranteedAndRandomRewards()
      );
    }
  }

  function _checkActionChoice(ActionChoiceInput calldata actionChoiceInput) private pure {
    uint16[] calldata inputTokenIds = actionChoiceInput.inputTokenIds;
    uint24[] calldata amounts = actionChoiceInput.inputAmounts;

    require(inputTokenIds.length <= 3, TooManyInputItems());
    require(inputTokenIds.length == amounts.length, LengthMismatch());

    require(
      !(actionChoiceInput.outputTokenId != NONE && actionChoiceInput.outputAmount == 0),
      OutputAmountCannotBeZero()
    );
    require(
      !(actionChoiceInput.outputTokenId == NONE && actionChoiceInput.outputAmount != 0),
      OutputTokenIdCannotBeEmpty()
    );

    for (uint256 i; i < inputTokenIds.length; ++i) {
      require(inputTokenIds[i] != 0, InvalidInputTokenId());
      require(amounts[i] != 0, InputSpecifiedWithoutAmount());

      if (i != inputTokenIds.length - 1) {
        for (uint256 j; j < inputTokenIds.length; ++j) {
          require(j == i || inputTokenIds[i] != inputTokenIds[j], InputItemNoDuplicates());
        }
      }
    }

    // Check minimum xp
    uint8[] calldata skills = actionChoiceInput.skills;

    // First minSkill must be the same as the action choice skill
    require(skills.length <= 3, TooManySkills());
    require(skills.length == actionChoiceInput.skillMinXPs.length, LengthMismatch());
    require(skills.length == actionChoiceInput.skillDiffs.length, LengthMismatch());

    for (uint256 i; i < skills.length; ++i) {
      require(!skills[i]._isSkillNone(), InvalidSkill());

      if (i != skills.length - 1) {
        for (uint256 j; j < skills.length; ++j) {
          require(j == i || skills[i] != skills[j], MinimumSkillsNoDuplicates());
        }
      }
    }

    if (actionChoiceInput.rate != 0) {
      // Check that it is a factor of 3600
      require((3600 * RATE_MUL) % actionChoiceInput.rate == 0, NotAFactorOf3600(actionChoiceInput.rate));
    }
  }

  function _checkAddActionChoice(
    uint16 actionId,
    uint16 actionChoiceId,
    ActionChoiceInput calldata actionChoiceInput
  ) private view {
    require(actionChoiceId != 0, ActionChoiceIdZeroNotAllowed());
    require(_actionChoices[actionId][actionChoiceId].skill._isSkillNone(), ActionChoiceAlreadyExists());
    _checkActionChoice(actionChoiceInput);
  }

  function _checkEditActionChoice(
    uint16 actionId,
    uint16 actionChoiceId,
    ActionChoiceInput calldata actionChoiceInput
  ) private view {
    require(Skill(_actionChoices[actionId][actionChoiceId].skill) != Skill.NONE, ActionChoiceDoesNotExist());
    _checkActionChoice(actionChoiceInput);
  }

  function _packActionChoice(
    ActionChoiceInput calldata actionChoiceInput
  ) private pure returns (ActionChoice memory actionChoice) {
    bytes1 _packedData = bytes1(uint8(actionChoiceInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    if (actionChoiceInput.isAvailable) {
      _packedData |= bytes1(uint8(1)) << IS_AVAILABLE_BIT;
    }

    actionChoice = ActionChoice({
      skill: actionChoiceInput.skill,
      rate: actionChoiceInput.rate,
      xpPerHour: actionChoiceInput.xpPerHour,
      inputTokenId1: actionChoiceInput.inputTokenIds.length != 0 ? actionChoiceInput.inputTokenIds[0] : NONE,
      inputAmount1: actionChoiceInput.inputAmounts.length != 0 ? actionChoiceInput.inputAmounts[0] : 0,
      inputTokenId2: actionChoiceInput.inputTokenIds.length > 1 ? actionChoiceInput.inputTokenIds[1] : NONE,
      inputAmount2: actionChoiceInput.inputAmounts.length > 1 ? actionChoiceInput.inputAmounts[1] : 0,
      inputTokenId3: actionChoiceInput.inputTokenIds.length > 2 ? actionChoiceInput.inputTokenIds[2] : NONE,
      inputAmount3: actionChoiceInput.inputAmounts.length > 2 ? actionChoiceInput.inputAmounts[2] : 0,
      outputTokenId: actionChoiceInput.outputTokenId,
      outputAmount: actionChoiceInput.outputAmount,
      successPercent: actionChoiceInput.successPercent,
      handItemTokenIdRangeMin: actionChoiceInput.handItemTokenIdRangeMin,
      handItemTokenIdRangeMax: actionChoiceInput.handItemTokenIdRangeMax,
      skill1: actionChoiceInput.skills.length != 0 ? actionChoiceInput.skills[0] : Skill.NONE._asUint8(),
      skillMinXP1: actionChoiceInput.skills.length != 0 ? actionChoiceInput.skillMinXPs[0] : 0,
      skillDiff1: actionChoiceInput.skillDiffs.length != 0 ? actionChoiceInput.skillDiffs[0] : int16(0),
      skill2: actionChoiceInput.skills.length > 1 ? actionChoiceInput.skills[1] : Skill.NONE._asUint8(),
      skillMinXP2: actionChoiceInput.skillDiffs.length > 1 ? actionChoiceInput.skillMinXPs[1] : 0,
      skillDiff2: actionChoiceInput.skillDiffs.length > 1 ? actionChoiceInput.skillDiffs[1] : int16(0),
      skill3: actionChoiceInput.skills.length > 2 ? actionChoiceInput.skills[2] : Skill.NONE._asUint8(),
      skillMinXP3: actionChoiceInput.skillDiffs.length > 2 ? actionChoiceInput.skillMinXPs[2] : 0,
      skillDiff3: actionChoiceInput.skillDiffs.length > 2 ? actionChoiceInput.skillDiffs[2] : int16(0),
      questPrerequisiteId: actionChoiceInput.questPrerequisiteId,
      packedData: _packedData
    });
  }

  function addActions(ActionInput[] calldata actions) external onlyOwner {
    for (uint256 i = 0; i < actions.length; ++i) {
      _addAction(actions[i]);
    }
    emit AddActions(actions);
  }

  function editActions(ActionInput[] calldata actions) external onlyOwner {
    for (uint256 i = 0; i < actions.length; ++i) {
      require(_actions[actions[i].actionId].skill._asSkill() != Skill.NONE, ActionDoesNotExist());
      _setAction(actions[i]);
    }
    emit EditActions(actions);
  }

  function addActionChoices(
    uint16 actionId,
    uint16[] calldata actionChoiceIds,
    ActionChoiceInput[] calldata actionChoicesToAdd
  ) public onlyOwner {
    emit AddActionChoices(actionId, actionChoiceIds, actionChoicesToAdd);

    uint256 actionChoiceLength = actionChoicesToAdd.length;
    require(actionChoiceLength == actionChoiceIds.length, LengthMismatch());
    require(actionChoiceIds.length != 0, NoActionChoices());

    for (uint16 i; i < actionChoiceLength; ++i) {
      _checkAddActionChoice(actionId, actionChoiceIds[i], actionChoicesToAdd[i]);
      _actionChoices[actionId][actionChoiceIds[i]] = _packActionChoice(actionChoicesToAdd[i]);
    }
  }

  // actionId of 0 means it is not tied to a specific action (combat)
  function addBulkActionChoices(
    uint16[] calldata actionIds,
    uint16[][] calldata actionChoiceIds,
    ActionChoiceInput[][] calldata actionChoicesToAdd
  ) external onlyOwner {
    require(actionIds.length == actionChoicesToAdd.length, LengthMismatch());
    require(actionIds.length != 0, NoActionChoices());

    uint16 _actionIdsLength = uint16(actionIds.length);
    for (uint16 i; i < _actionIdsLength; ++i) {
      uint16 actionId = actionIds[i];
      addActionChoices(actionId, actionChoiceIds[i], actionChoicesToAdd[i]);
    }
  }

  function editActionChoices(
    uint16 actionId,
    uint16[] calldata actionChoiceIds,
    ActionChoiceInput[] calldata actionChoicesToEdit
  ) external onlyOwner {
    require(actionChoiceIds.length != 0, NoActionChoices());
    require(actionChoiceIds.length == actionChoicesToEdit.length, LengthMismatch());

    uint256 _actionIdsLength = actionChoiceIds.length;
    for (uint16 i; i < _actionIdsLength; ++i) {
      _checkEditActionChoice(actionId, actionChoiceIds[i], actionChoicesToEdit[i]);
      _actionChoices[actionId][actionChoiceIds[i]] = _packActionChoice(actionChoicesToEdit[i]);
    }

    emit EditActionChoices(actionId, actionChoiceIds, actionChoicesToEdit);
  }

  function removeActionChoices(uint16 actionId, uint16[] calldata actionChoiceIds) external onlyOwner {
    require(actionChoiceIds.length != 0, NoActionChoices());

    uint256 length = actionChoiceIds.length;
    for (uint16 i; i < length; ++i) {
      delete _actionChoices[actionId][actionChoiceIds[i]];
    }
    emit RemoveActionChoices(actionId, actionChoiceIds);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
