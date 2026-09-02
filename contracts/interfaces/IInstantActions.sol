// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../globals/actions.sol";
import "../globals/clans.sol";
import "../globals/items.sol";
import "../globals/misc.sol";
import "../globals/pets.sol";
import "../globals/players.sol";
import "../globals/promotions.sol";
import "../globals/quests.sol";
import "../globals/rewards.sol";
import {IPlayers} from "./IPlayers.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {IQuests} from "./IQuests.sol";
import {IActivityPoints, IActivityPointsCaller} from "../ActivityPoints/interfaces/IActivityPoints.sol";

interface IInstantActions is IActivityPointsCaller {
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
    bool isAvailable;
    IInstantActions.InstantActionType actionType;
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
    bytes1 packedData;
    bytes1 reserved;
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
  function addActions(IInstantActions.InstantActionInput[] calldata instantActionInputs) external;
  function doInstantActions(
    uint256 playerId,
    uint16[] calldata actionIds,
    uint256[] calldata amounts,
    IInstantActions.InstantActionType actionType
  ) external;
  function editActions(IInstantActions.InstantActionInput[] calldata instantActionInputs) external;
  function getAction(
    IInstantActions.InstantActionType actionType,
    uint16 actionId
  ) external view returns (IInstantActions.InstantAction memory);
  function getInstantActionState(
    uint256 playerId,
    uint16[] calldata actionIds,
    uint256[] calldata amounts,
    IInstantActions.InstantActionType actionType
  ) external view returns (IInstantActions.InstantActionState memory instantActionState);
  function initialize(IPlayers players, ItemNFT itemNFT, IQuests quests, IActivityPoints activityPoints) external;
  function removeActions(
    IInstantActions.InstantActionType[] calldata actionTypes,
    uint16[] calldata instantActionIds
  ) external;
  function setActivityPoints(address activityPoints) external;
  event AddInstantActions(IInstantActions.InstantActionInput[] instantActionInputs);
  event DoInstantActions(
    uint256 playerId,
    address from_,
    uint16[] actionIds,
    uint256[] amounts,
    uint256[] consumedItemTokenIds,
    uint256[] consumedAmounts,
    uint256[] producedItemTokenIds,
    uint256[] producedAmounts,
    IInstantActions.InstantActionType actionType
  );
  event EditInstantActions(IInstantActions.InstantActionInput[] instantActionInputs);
  event RemoveInstantActions(IInstantActions.InstantActionType[] actionTypes, uint16[] actionIds);
  error ActionAlreadyExists();
  error ActionDoesNotExist();
  error ActionIdZeroNotAllowed();
  error ActionMustBeAvailable();
  error DependentQuestNotCompleted();
  error IncorrectInputAmounts();
  error InputItemNoDuplicates();
  error InputSpecifiedWithoutAmount();
  error InvalidActionId();
  error InvalidInputTokenId();
  error InvalidOutputTokenId();
  error InvalidSkill();
  error InvalidSkillId(uint8 skill);
  error LengthMismatch();
  error MinimumSkillsNoDuplicates();
  error MinimumXPNotReached(Skill minSkill, uint256 minXP);
  error NotOwnerOfPlayerAndActive();
  error OutputAmountCannotBeZero();
  error OutputTokenIdCannotBeEmpty();
  error PlayerNotUpgraded();
  error TooManyInputItems();
  error TooManyMinSkills();
  error UnsupportedActionType();
}
