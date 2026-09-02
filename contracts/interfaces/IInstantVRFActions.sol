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
import {ItemNFT} from "../ItemNFT.sol";
import {IInstantVRFActionStrategy} from "../InstantVRFActionStrategies/interfaces/IInstantVRFActionStrategy.sol";
import {IActivityPoints, IActivityPointsCaller} from "../ActivityPoints/interfaces/IActivityPoints.sol";

interface IInstantVRFActions is IActivityPointsCaller {
  struct InstantVRFAction {
    uint16 inputTokenId1;
    uint24 inputAmount1;
    uint16 inputTokenId2;
    uint24 inputAmount2;
    uint16 inputTokenId3;
    uint24 inputAmount3;
    uint16 questPrerequisiteId;
    InstantVRFActionType actionType;
    bytes1 packedData;
  }
  function addActions(InstantVRFActionInput[] calldata instantVRFActionInputs) external;
  function addStrategies(InstantVRFActionType[] calldata instantVRFActionTypes, address[] calldata strategies) external;
  function doInstantVRFActions(
    uint256 playerId,
    uint16[] calldata actionIds,
    uint256[] calldata actionAmounts
  ) external payable;
  function editActions(InstantVRFActionInput[] calldata instantVRFActionInputs) external;
  function getAction(uint16 actionId) external view returns (IInstantVRFActions.InstantVRFAction memory);
  function getStrategy(InstantVRFActionType actionType) external view returns (IInstantVRFActionStrategy);
  function initialize(
    address players,
    ItemNFT itemNFT,
    address petNFT,
    address quests,
    address paintswapVRFConsumer,
    uint8 maxActionAmount,
    IActivityPoints activityPoints
  ) external;
  function initializeV3(address paintswapVRFConsumer) external;
  function removeActions(uint16[] calldata instantVRFActionIds) external;
  function requestCost(uint256 numActions) external view returns (uint256);
  function setActivityPoints(address activityPoints) external;
  function setGasCostPerUnit(uint64 gasCostPerUnit) external;
  function setMaxActionAmount(uint8 maxActionAmount) external;
  function setPetNFT(address petNFT) external;
  event AddInstantVRFActions(InstantVRFActionInput[] instantVRFActionInputs);
  event AddStrategies(InstantVRFActionType[] actionTypes, address[] strategies);
  event CompletedInstantVRFActions(
    address from_,
    uint256 playerId,
    uint256 requestId,
    uint256[] producedItemTokenIds,
    uint256[] producedItemAmounts,
    uint256[] producedPetTokenIds
  );
  event DoInstantVRFActions(
    address from_,
    uint256 playerId,
    uint256 requestId,
    uint16[] actionIds,
    uint256[] amounts,
    uint256[] consumedItemTokenIds,
    uint256[] consumedAmounts
  );
  event EditInstantVRFActions(InstantVRFActionInput[] instantVRFActionInputs);
  event RemoveInstantVRFActions(uint16[] actionIds);
  event SetGasCostPerUnit(uint256 gasCostPerUnit);
  event SetMaxActionAmount(uint8 maxActionAmount);
  error ActionAlreadyExists();
  error ActionDoesNotExist();
  error ActionIdZeroNotAllowed();
  error ActionNotAvailable();
  error AlreadyProcessing();
  error DependentQuestNotCompleted();
  error IncorrectInputAmounts();
  error InputAmountsMustBeInOrder();
  error InputItemNoDuplicates();
  error InputSpecifiedWithoutAmount();
  error InvalidInputTokenId();
  error InvalidStrategy();
  error LengthMismatch();
  error NotDoingAnyActions();
  error NotOwnerOfPlayerAndActive();
  error PlayerNotUpgraded();
  error RequestDoesNotExist();
  error StrategyAlreadyExists();
  error TooManyActionAmounts();
  error TooManyInputItems();
  error TransferFailed();
}
