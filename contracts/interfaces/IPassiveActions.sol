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
import {RandomnessBeacon} from "../RandomnessBeacon.sol";
import {IActivityPoints, IActivityPointsCaller} from "../ActivityPoints/interfaces/IActivityPoints.sol";

interface IPassiveActions is IActivityPointsCaller {
  struct PassiveActionInput {
    uint16 actionId;
    IPassiveActions.PassiveActionInfoInput info;
    GuaranteedReward[] guaranteedRewards;
    RandomReward[] randomRewards;
  }

  struct PassiveActionInfoInput {
    uint8 durationDays;
    uint16[] inputTokenIds;
    uint24[] inputAmounts;
    Skill[] minSkills;
    uint8[] minLevels;
    uint8 skipSuccessPercent;
    uint8 worldLocation;
    bool isFullModeOnly;
    bool isAvailable;
    uint16 questPrerequisiteId;
  }

  struct PassiveAction {
    uint8 durationDays;
    uint16 inputTokenId1;
    uint24 inputAmount1;
    uint16 inputTokenId2;
    uint24 inputAmount2;
    uint16 inputTokenId3;
    uint24 inputAmount3;
    Skill minSkill1;
    uint8 minLevel1;
    Skill minSkill2;
    uint8 minLevel2;
    Skill minSkill3;
    uint8 minLevel3;
    uint8 skipSuccessPercent;
    bytes1 packedData;
    uint16 questPrerequisiteId;
  }

  struct PendingPassiveActionState {
    uint256[] producedItemTokenIds;
    uint256[] producedAmounts;
    uint256[] producedRandomRewardItemTokenIds;
    uint256[] producedRandomRewardAmounts;
    uint256 numDaysSkipped;
    bool skippedToday;
    bool isReady;
  }
  function addActions(IPassiveActions.PassiveActionInput[] calldata passiveActionInputs) external;
  function addPassiveActionBridge(uint256 playerId, uint256 actionId, uint256 startTime) external;
  function claim(uint256 playerId) external;
  function editActions(IPassiveActions.PassiveActionInput[] calldata passiveActionInputs) external;
  function endEarly(uint256 playerId) external;
  function finishedInfo(
    uint256 playerId
  )
    external
    view
    returns (bool finished, bool oracleCalled, bool hasRandomRewards, uint256 numWinners, bool skippedToday);
  function getAction(uint16 actionId) external view returns (IPassiveActions.PassiveAction memory);
  function initialize(
    IPlayers players,
    ItemNFT itemNFT,
    RandomnessBeacon randomnessBeacon,
    address bridge,
    IActivityPoints activityPoints
  ) external;
  function pendingPassiveActionState(
    uint256 playerId
  ) external view returns (IPassiveActions.PendingPassiveActionState memory _pendingPassiveActionState);
  function setActivityPoints(address activityPoints) external;
  function startAction(uint256 playerId, uint16 actionId, uint16 boostItemTokenId) external;
  event AddPassiveActions(IPassiveActions.PassiveActionInput[] passiveActionInputs);
  event ClaimPassiveAction(
    uint256 playerId,
    address from_,
    uint256 queueId,
    uint256[] itemTokenIds,
    uint256[] amounts,
    bool startingAnother
  );
  event EarlyEndPassiveAction(uint256 playerId, address from_, uint256 queueId);
  event EditPassiveActions(IPassiveActions.PassiveActionInput[] passiveActionInputs);
  event StartPassiveAction(
    uint256 playerId,
    address from_,
    uint256 actionId,
    uint256 queueId,
    uint256 boostItemTokenId,
    uint256 startTimestamp
  );
  error ActionAlreadyExists(uint16 actionId);
  error ActionAlreadyFinished();
  error ActionDoesNotExist();
  error ActionIdZeroNotAllowed();
  error ActionNotAvailable();
  error DurationTooLong();
  error GuaranteedRewardsNoDuplicates();
  error InputAmountsMustBeInOrder();
  error InputItemNoDuplicates();
  error InputSpecifiedWithoutAmount();
  error InvalidActionId();
  error InvalidInputTokenId();
  error InvalidSkill();
  error LengthMismatch();
  error MinimumLevelNotReached(Skill minSkill, uint256 minLevel);
  error MinimumSkillsNoDuplicates();
  error NoActivePassiveAction();
  error NoInputItemsSpecified();
  error NotBridge();
  error NotOwnerOfPlayerAndActive();
  error NotPassiveVial();
  error PassiveActionNotReadyToBeClaimed();
  error PlayerNotUpgraded();
  error PreviousActionNotFinished();
  error PreviousInputTokenIdMustBeSpecified();
  error RandomRewardNoDuplicates();
  error RandomRewardsMustBeInOrder(uint16 chance1, uint16 chance2);
  error TooManyGuaranteedRewards();
  error TooManyInputItems();
  error TooManyMinSkills();
  error TooManyRandomRewards();
}
