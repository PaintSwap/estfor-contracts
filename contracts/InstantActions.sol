// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {IPlayers} from "./interfaces/IPlayers.sol";
import {ItemNFT} from "./ItemNFT.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

contract InstantActions is UUPSUpgradeable, OwnableUpgradeable {
  event AddInstantActions(InstantActionInput[] instantActionInputs);
  event EditInstantActions(InstantActionInput[] instantActionInputs);
  event DoInstantActions(
    uint playerId,
    address from,
    uint16[] actionIds,
    uint[] amounts,
    uint[] consumedItemTokenIds,
    uint[] consumedAmounts,
    uint[] producedItemTokenIds,
    uint[] producedAmounts,
    InstantActionType actionType
  );

  error ActionIdZeroNotAllowed();
  error InvalidOutputTokenId();
  error ActionDoesNotExist();
  error MinimumXPNotReached(Skill minSkill, uint minXP);
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

  enum InstantActionType {
    NONE,
    FORGING_COMBINE,
    GENERIC
  }

  struct InstantActionInput {
    uint16 actionId;
    Skill[] minSkills;
    uint32[] minXPs;
    uint16[] inputTokenIds;
    uint16[] inputAmounts;
    uint16 outputTokenId;
    uint16 outputAmount;
    bool isFullModeOnly;
    InstantActionType actionType;
  }

  struct InstantAction {
    Skill minSkill1;
    uint32 minXP1;
    Skill minSkill2;
    uint32 minXP2;
    Skill minSkill3;
    uint32 minXP3;
    uint16 inputTokenId1;
    uint16 inputAmount1;
    uint16 inputTokenId2;
    uint16 inputAmount2;
    uint16 inputTokenId3;
    uint16 inputAmount3;
    uint16 outputTokenId;
    uint16 outputAmount;
    bytes1 packedData; // last bit is full mode only
  }

  struct InstantActionState {
    uint[] consumedTokenIds;
    uint[] consumedAmounts;
    uint[] producedTokenIds;
    uint[] producedAmounts;
  }

  IPlayers public players;
  mapping(InstantActionType actionType => mapping(uint16 actionId => InstantAction instantAction)) public actions;
  ItemNFT public itemNFT;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  function initialize(IPlayers _players, ItemNFT _itemNFT) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    players = _players;
    itemNFT = _itemNFT;
  }

  function doInstantActions(
    uint _playerId,
    uint16[] calldata _actionIds,
    uint[] calldata _amounts,
    InstantActionType _actionType
  ) external isOwnerOfPlayerAndActive(_playerId) {
    InstantActionState memory instantActionState = getInstantActionState(_playerId, _actionIds, _amounts, _actionType);

    itemNFT.burnBatch(msg.sender, instantActionState.consumedTokenIds, instantActionState.consumedAmounts);
    itemNFT.mintBatch(msg.sender, instantActionState.producedTokenIds, instantActionState.producedAmounts);

    emit DoInstantActions(
      _playerId,
      msg.sender,
      _actionIds,
      _amounts,
      instantActionState.consumedTokenIds,
      instantActionState.consumedAmounts,
      instantActionState.producedTokenIds,
      instantActionState.producedAmounts,
      _actionType
    );
  }

  function _checkDoActionRequirements(uint _playerId, InstantAction storage _instantAction) private view {
    if (_instantAction.inputTokenId1 == NONE) {
      revert InvalidActionId();
    }

    _checkMinXPRequirements(_playerId, _instantAction);

    if (_isActionFullMode(_instantAction) && !players.isPlayerUpgraded(_playerId)) {
      revert PlayerNotUpgraded();
    }
  }

  function getInstantActionState(
    uint _playerId,
    uint16[] calldata _actionIds,
    uint[] calldata _amounts,
    InstantActionType _actionType
  ) public view returns (InstantActionState memory instantActionState) {
    if (_actionType == InstantActionType.FORGING_COMBINE) {
      instantActionState = _forgingCombineActionState(_playerId, _actionIds, _amounts);
    } else if (_actionType == InstantActionType.GENERIC) {
      instantActionState = _genericInstantActionState(_playerId, _actionIds, _amounts);
    } else {
      revert UnsupportedActionType();
    }
  }

  function _genericInstantActionState(
    uint _playerId,
    uint16[] calldata _actionIds,
    uint[] calldata _amounts
  ) private view returns (InstantActionState memory instantActionState) {
    // Forging actions only have 1 input, burn all those and mint the components back
    uint MAX_INPUTS = 3;
    instantActionState.consumedTokenIds = new uint[](_actionIds.length * MAX_INPUTS);
    instantActionState.consumedAmounts = new uint[](_actionIds.length * MAX_INPUTS);
    instantActionState.producedTokenIds = new uint[](_actionIds.length);
    instantActionState.producedAmounts = new uint[](_actionIds.length);
    uint length;
    // All producedTokenIds should be the same for forging
    for (uint i; i < _actionIds.length; ++i) {
      InstantAction storage instantAction = actions[InstantActionType.GENERIC][_actionIds[i]];

      _checkDoActionRequirements(_playerId, instantAction);

      if (instantAction.inputTokenId1 != 0) {
        instantActionState.consumedTokenIds[length] = instantAction.inputTokenId1;
        instantActionState.consumedAmounts[length++] = instantAction.inputAmount1 * _amounts[i];
      }

      if (instantAction.inputTokenId2 != 0) {
        instantActionState.consumedTokenIds[length] = instantAction.inputTokenId2;
        instantActionState.consumedAmounts[length++] = instantAction.inputAmount2 * _amounts[i];
      }

      if (instantAction.inputTokenId3 != 0) {
        instantActionState.consumedTokenIds[length] = instantAction.inputTokenId3;
        instantActionState.consumedAmounts[length++] = instantAction.inputAmount3 * _amounts[i];
      }

      instantActionState.producedTokenIds[i] = instantAction.outputTokenId;
      instantActionState.producedAmounts[i] = instantAction.outputAmount * _amounts[i];
    }

    uint[] memory consumedTokenIds = instantActionState.consumedTokenIds;
    uint[] memory consumedAmounts = instantActionState.consumedAmounts;

    assembly ("memory-safe") {
      mstore(consumedTokenIds, length)
      mstore(consumedAmounts, length)
    }
  }

  function _forgingCombineActionState(
    uint _playerId,
    uint16[] calldata _actionIds,
    uint[] calldata _amounts
  ) private view returns (InstantActionState memory instantActionState) {
    // Forging actions only have 1 input, burn all those and mint the components back
    instantActionState.consumedTokenIds = new uint[](_actionIds.length);
    instantActionState.consumedAmounts = new uint[](_actionIds.length);
    // All outputTokenIds should be the same for forging
    uint producedAmount;
    uint producedTokenId = actions[InstantActionType.FORGING_COMBINE][_actionIds[0]].outputTokenId;
    for (uint i; i < _actionIds.length; ++i) {
      InstantAction storage instantAction = actions[InstantActionType.FORGING_COMBINE][_actionIds[i]];
      if (producedTokenId != instantAction.outputTokenId) {
        // All outputs should be the same
        revert InvalidOutputTokenId();
      }

      _checkDoActionRequirements(_playerId, instantAction);

      producedAmount += instantAction.outputAmount * _amounts[i];
      instantActionState.consumedTokenIds[i] = instantAction.inputTokenId1;
      instantActionState.consumedAmounts[i] = instantAction.inputAmount1 * _amounts[i];
    }

    instantActionState.producedTokenIds = new uint[](1);
    instantActionState.producedTokenIds[0] = producedTokenId;
    instantActionState.producedAmounts = new uint[](1);
    instantActionState.producedAmounts[0] = producedAmount;
  }

  function _checkMinXPRequirements(uint _playerId, InstantAction storage _instantAction) private view {
    if (
      _instantAction.minSkill1 != Skill.NONE && players.xp(_playerId, _instantAction.minSkill1) < _instantAction.minXP1
    ) {
      revert MinimumXPNotReached(_instantAction.minSkill1, _instantAction.minXP1);
    }

    if (
      _instantAction.minSkill2 != Skill.NONE && players.xp(_playerId, _instantAction.minSkill2) < _instantAction.minXP2
    ) {
      revert MinimumXPNotReached(_instantAction.minSkill2, _instantAction.minXP2);
    }

    if (
      _instantAction.minSkill3 != Skill.NONE && players.xp(_playerId, _instantAction.minSkill3) < _instantAction.minXP3
    ) {
      revert MinimumXPNotReached(_instantAction.minSkill3, _instantAction.minXP3);
    }
  }

  function _setAction(InstantActionInput calldata _instantActionInput) private {
    if (_instantActionInput.actionId == 0) {
      revert ActionIdZeroNotAllowed();
    }
    if (_instantActionInput.actionType == InstantActionType.NONE) {
      revert UnsupportedActionType();
    }
    _checkInputs(_instantActionInput);
    actions[_instantActionInput.actionType][_instantActionInput.actionId] = _packAction(_instantActionInput);
  }

  function _isActionFullMode(InstantAction memory _instantAction) private pure returns (bool) {
    return uint8(_instantAction.packedData >> IS_FULL_MODE_BIT) == 1;
  }

  function _packAction(
    InstantActionInput calldata _actionInput
  ) private pure returns (InstantAction memory instantAction) {
    bytes1 packedData = bytes1(uint8(_actionInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    instantAction = InstantAction({
      minSkill1: _actionInput.minSkills.length > 0 ? _actionInput.minSkills[0] : Skill.NONE,
      minXP1: _actionInput.minXPs.length > 0 ? _actionInput.minXPs[0] : 0,
      minSkill2: _actionInput.minSkills.length > 1 ? _actionInput.minSkills[1] : Skill.NONE,
      minXP2: _actionInput.minXPs.length > 1 ? _actionInput.minXPs[1] : 0,
      minSkill3: _actionInput.minSkills.length > 2 ? _actionInput.minSkills[2] : Skill.NONE,
      minXP3: _actionInput.minXPs.length > 2 ? _actionInput.minXPs[2] : 0,
      inputTokenId1: _actionInput.inputTokenIds.length > 0 ? _actionInput.inputTokenIds[0] : NONE,
      inputAmount1: _actionInput.inputAmounts.length > 0 ? _actionInput.inputAmounts[0] : 0,
      inputTokenId2: _actionInput.inputTokenIds.length > 1 ? _actionInput.inputTokenIds[1] : NONE,
      inputAmount2: _actionInput.inputAmounts.length > 1 ? _actionInput.inputAmounts[1] : 0,
      inputTokenId3: _actionInput.inputTokenIds.length > 2 ? _actionInput.inputTokenIds[2] : NONE,
      inputAmount3: _actionInput.inputAmounts.length > 2 ? _actionInput.inputAmounts[2] : 0,
      outputTokenId: _actionInput.outputTokenId,
      outputAmount: _actionInput.outputAmount,
      packedData: packedData
    });
  }

  // Assumes that it has at least 1 input
  function _actionExists(InstantActionInput calldata _instantActionInput) private view returns (bool) {
    return actions[_instantActionInput.actionType][_instantActionInput.actionId].inputTokenId1 != NONE;
  }

  function _checkInputs(InstantActionInput calldata _actionInput) private pure {
    uint16[] calldata inputTokenIds = _actionInput.inputTokenIds;
    uint16[] calldata amounts = _actionInput.inputAmounts;

    if (inputTokenIds.length > 3) {
      revert TooManyInputItems();
    }
    if (inputTokenIds.length != amounts.length) {
      revert LengthMismatch();
    }

    if (_actionInput.outputTokenId != NONE && _actionInput.outputAmount == 0) {
      revert OutputAmountCannotBeZero();
    }

    if (_actionInput.outputTokenId == NONE && _actionInput.outputAmount != 0) {
      revert OutputTokenIdCannotBeEmpty();
    }

    // If forging then you need exactly 1 input
    if (_actionInput.actionType == InstantActionType.FORGING_COMBINE) {
      if (inputTokenIds.length != 1) {
        revert IncorrectInputAmounts();
      }
    } else {
      // Otherwise you need at least 1 input
      if (inputTokenIds.length == 0) {
        revert IncorrectInputAmounts();
      }
    }

    for (uint i; i < inputTokenIds.length; ++i) {
      if (inputTokenIds[i] == 0) {
        revert InvalidInputTokenId();
      }
      if (amounts[i] == 0) {
        revert InputSpecifiedWithoutAmount();
      }

      if (i != inputTokenIds.length - 1) {
        if (amounts[i] > amounts[i + 1]) {
          revert InputAmountsMustBeInOrder();
        }
        for (uint j; j < inputTokenIds.length; ++j) {
          if (j != i && inputTokenIds[i] == inputTokenIds[j]) {
            revert InputItemNoDuplicates();
          }
        }
      }
    }

    // Check minimum xp
    Skill[] calldata minSkills = _actionInput.minSkills;
    uint32[] calldata minXPs = _actionInput.minXPs;

    if (minSkills.length > 3) {
      revert TooManyMinSkills();
    }
    if (minSkills.length != minXPs.length) {
      revert LengthMismatch();
    }
    for (uint i; i < minSkills.length; ++i) {
      if (minSkills[i] == Skill.NONE) {
        revert InvalidSkill();
      }
      if (minXPs[i] == 0) {
        revert InputSpecifiedWithoutAmount();
      }

      if (i != minSkills.length - 1) {
        for (uint j; j < minSkills.length; ++j) {
          if (j != i && minSkills[i] == minSkills[j]) {
            revert MinimumSkillsNoDuplicates();
          }
        }
      }
    }
  }

  function addActions(InstantActionInput[] calldata _instantActionInputs) external onlyOwner {
    for (uint i; i < _instantActionInputs.length; ++i) {
      InstantActionInput calldata instantActionInput = _instantActionInputs[i];
      if (_actionExists(instantActionInput)) {
        revert ActionAlreadyExists();
      }
      _setAction(instantActionInput);
    }
    emit AddInstantActions(_instantActionInputs);
  }

  function editActions(InstantActionInput[] calldata _instantActionInputs) external onlyOwner {
    for (uint i = 0; i < _instantActionInputs.length; ++i) {
      InstantActionInput calldata instantActionInput = _instantActionInputs[i];
      if (!_actionExists(instantActionInput)) {
        revert ActionDoesNotExist();
      }
      _setAction(instantActionInput);
    }
    emit EditInstantActions(_instantActionInputs);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
