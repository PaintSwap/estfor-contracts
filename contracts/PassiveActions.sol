// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import {IPlayers} from "./interfaces/IPlayers.sol";
import {ItemNFT} from "./ItemNFT.sol";
import {World} from "./World.sol";

import {WorldLibrary} from "./WorldLibrary.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

// Stake some items which get burnt and get something else in return for waiting a certain time. All or nothing.
// Supports skipping a day based on random chance & random items in Passive Actions
contract PassiveActions is UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, ERC1155Holder {
  using Math for uint256;

  event AddPassiveActions(PassiveActionInput[] passiveActionInputs);
  event EditPassiveActions(PassiveActionInput[] passiveActionInputs);
  event StartPassiveAction(uint256 playerId, address from, uint256 actionId, uint256 queueId, uint16 boostItemTokenId);
  event EarlyEndPassiveAction(uint256 playerId, address from, uint256 queueId);
  event ClaimPassiveAction(
    uint256 playerId,
    address from,
    uint256 queueId,
    uint256[] itemTokenIds,
    uint256[] amounts,
    bool startingAnother
  );

  error NotOwnerOfPlayerAndActive();
  error NotPassiveVial();
  error InvalidActionId();
  error ActionNotAvailable();
  error ActionAlreadyExists(uint16 actionId);
  error ActionDoesNotExist();
  error ActionIdZeroNotAllowed();
  error DurationTooLong();
  error PlayerNotUpgraded();
  error MinimumLevelNotReached(Skill minSkill, uint256 minLevel);
  error InputSpecifiedWithoutAmount();
  error InputAmountsMustBeInOrder();
  error PreviousInputTokenIdMustBeSpecified();
  error MinimumSkillsNoDuplicates();
  error ActionAlreadyFinished();
  error NoActivePassiveAction();
  error PassiveActionNotReadyToBeClaimed();
  error PreviousActionNotFinished();
  error LengthMismatch();
  error InputItemNoDuplicates();
  error TooManyMinSkills();
  error InvalidSkill();
  error TooManyInputItems();
  error InvalidInputTokenId();
  error NoInputItemsSpecified();

  struct PassiveActionInput {
    uint16 actionId;
    PassiveActionInfoInput info;
    GuaranteedReward[] guaranteedRewards;
    RandomReward[] randomRewards;
  }

  struct PassiveActionInfoInput {
    uint8 durationDays;
    uint16[] inputTokenIds;
    uint24[] inputAmounts;
    Skill[] minSkills;
    uint8[] minLevels;
    uint8 skipSuccessPercent; // 0-100 (% chance of skipping a day)
    uint8 worldLocation; // 0 is the main starting world
    bool isFullModeOnly;
    bool isAvailable;
    uint16 questPrerequisiteId;
  }

  struct PassiveAction {
    uint8 durationDays; // Up to 64 days
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
    bytes1 packedData; // worldLocation first bit, 6bit is has random rewards, 7th bit isAvailable, last bit isFullModeOnly
    uint16 questPrerequisiteId;
  }

  struct PendingPassiveActionState {
    uint256[] producedItemTokenIds;
    uint256[] producedAmounts;
    uint256[] producedRandomRewardItemTokenIds; // Oracle loot
    uint256[] producedRandomRewardAmounts;
    uint256 numDaysSkipped;
    bool skippedToday;
    bool isReady;
  }

  struct ActivePassiveInfo {
    uint16 actionId;
    uint96 queueId;
    uint40 startTime;
    uint16 boostItemTokenId;
  }

  IPlayers private _players;
  ItemNFT private _itemNFT;
  World private _world;
  uint80 private _lastQueueId;
  mapping(uint256 actionId => PassiveAction action) private _actions;
  mapping(uint256 actionId => ActionRewards) private _actionRewards;
  mapping(uint256 playerId => ActivePassiveInfo activePassiveInfo) private _activePassiveActions;

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IPlayers players, ItemNFT itemNFT, World world) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());
    __ReentrancyGuard_init();
    _players = players;
    _itemNFT = itemNFT;
    _world = world;
    _lastQueueId = 1;
  }

  function startAction(
    uint256 playerId,
    uint16 actionId,
    uint16 boostItemTokenId
  ) external isOwnerOfPlayerAndActive(playerId) {
    // Cannot start a passive action when one is active already for this player
    if (_activePassiveActions[playerId].actionId != NONE) {
      (bool finished, , , , ) = finishedInfo(playerId);
      require(finished, PreviousActionNotFinished());
      _claim(playerId, _activePassiveActions[playerId].queueId, true);
    }

    PassiveAction storage action = _actions[actionId];
    require(action.inputTokenId1 != NONE, InvalidActionId());

    _checkMinLevelRequirements(playerId, actionId);

    require(_isActionAvailable(actionId), ActionNotAvailable());

    require(!_isActionFullMode(actionId) || _players.isPlayerUpgraded(playerId), PlayerNotUpgraded());

    if (boostItemTokenId != NONE) {
      Item memory item = _itemNFT.getItem(boostItemTokenId);
      require(item.equipPosition == EquipPosition.PASSIVE_BOOST_VIAL, NotPassiveVial());
    }

    uint96 queueId = _lastQueueId++;
    _activePassiveActions[playerId] = ActivePassiveInfo({
      actionId: actionId,
      queueId: queueId,
      startTime: uint40(block.timestamp),
      boostItemTokenId: boostItemTokenId
    });

    _burnInputs(action, boostItemTokenId);

    emit StartPassiveAction(playerId, _msgSender(), actionId, queueId, boostItemTokenId);
  }

  function claim(uint256 playerId) external isOwnerOfPlayerAndActive(playerId) nonReentrant {
    uint256 queueId = _activePassiveActions[playerId].queueId;
    require(queueId != NONE, NoActivePassiveAction());
    (bool finished, bool oracleCalled, bool hasRandomRewards, , ) = finishedInfo(playerId);
    require(finished && !(hasRandomRewards && !oracleCalled), PassiveActionNotReadyToBeClaimed());

    _claim(playerId, queueId, false);
    delete _activePassiveActions[playerId];
  }

  function endEarly(uint256 playerId) external isOwnerOfPlayerAndActive(playerId) {
    uint256 queueId = _activePassiveActions[playerId].queueId;
    require(queueId != NONE, NoActivePassiveAction());

    (bool finished, , , , ) = finishedInfo(playerId);
    require(!finished, ActionAlreadyFinished());

    delete _activePassiveActions[playerId];
    emit EarlyEndPassiveAction(playerId, _msgSender(), queueId);
  }

  // Get current state of the passive action
  function pendingPassiveActionState(
    uint256 playerId
  ) public view returns (PendingPassiveActionState memory _pendingPassiveActionState) {
    // If it's not finished then you get nothing
    (bool finished, bool oracleCalled, bool hasRandomRewards, uint256 numWinners, bool skippedToday) = finishedInfo(
      playerId
    );
    _pendingPassiveActionState.isReady = finished && (oracleCalled || !hasRandomRewards);
    _pendingPassiveActionState.numDaysSkipped = numWinners;
    _pendingPassiveActionState.skippedToday = skippedToday;
    if (!finished) {
      return _pendingPassiveActionState;
    }

    ActivePassiveInfo storage passiveAction = _activePassiveActions[playerId];
    PassiveAction memory action = _actions[passiveAction.actionId];

    uint256 numIterations = action.durationDays;
    ActionRewards storage reward = _actionRewards[passiveAction.actionId];

    // Add guaranteed rewards
    uint256 guaranteedRewardLength = reward.guaranteedRewardTokenId3 != NONE
      ? 3
      : reward.guaranteedRewardTokenId2 != NONE
        ? 2
        : reward.guaranteedRewardTokenId1 != NONE
          ? 1
          : 0;

    _pendingPassiveActionState.producedItemTokenIds = new uint256[](guaranteedRewardLength);
    _pendingPassiveActionState.producedAmounts = new uint256[](guaranteedRewardLength);
    if (reward.guaranteedRewardTokenId1 != NONE) {
      _pendingPassiveActionState.producedItemTokenIds[0] = reward.guaranteedRewardTokenId1;
      _pendingPassiveActionState.producedAmounts[0] = reward.guaranteedRewardRate1;
    }
    if (reward.guaranteedRewardTokenId2 != NONE) {
      _pendingPassiveActionState.producedItemTokenIds[1] = reward.guaranteedRewardTokenId2;
      _pendingPassiveActionState.producedAmounts[1] = reward.guaranteedRewardRate2;
    }
    if (reward.guaranteedRewardTokenId3 != NONE) {
      _pendingPassiveActionState.producedItemTokenIds[2] = reward.guaranteedRewardTokenId3;
      _pendingPassiveActionState.producedAmounts[2] = reward.guaranteedRewardRate3;
    }

    // Add random rewards
    if (oracleCalled) {
      RandomReward[] memory randomRewards = _setupRandomRewards(reward);
      uint256 endTime = passiveAction.startTime + (action.durationDays - numWinners) * 1 days - 1 days;
      bytes memory randomBytes = _world.getRandomBytes(numIterations, passiveAction.startTime, endTime, playerId);

      _pendingPassiveActionState.producedRandomRewardItemTokenIds = new uint256[](randomRewards.length);
      _pendingPassiveActionState.producedRandomRewardAmounts = new uint256[](randomRewards.length);

      uint256 length;
      for (uint256 i; i < numIterations; ++i) {
        uint256 operation = uint256(_getSlice(randomBytes, i));
        uint16 rand = uint16(Math.min(type(uint16).max, operation));
        for (uint256 j; j < randomRewards.length; ++j) {
          RandomReward memory randomReward = randomRewards[j];
          if (rand <= randomReward.chance) {
            // This random reward's chance was hit, so add it to the hits
            _pendingPassiveActionState.producedRandomRewardItemTokenIds[j] = randomReward.itemTokenId;
            _pendingPassiveActionState.producedRandomRewardAmounts[j] += randomReward.amount;
            length = Math.max(length, j + 1);
          } else {
            // A common one isn't found so a rarer one won't be.
            break;
          }
        }
      }

      (uint256[] memory ids, uint256[] memory amounts) = (
        _pendingPassiveActionState.producedRandomRewardItemTokenIds,
        _pendingPassiveActionState.producedRandomRewardAmounts
      );

      assembly ("memory-safe") {
        mstore(ids, length)
        mstore(amounts, length)
      }
    }
  }

  function _checkMinLevelRequirements(uint256 playerId, uint256 actionId) private view {
    PassiveAction storage action = _actions[actionId];
    require(
      action.minSkill1 == Skill.NONE || _players.getLevel(playerId, action.minSkill1) >= action.minLevel1,
      MinimumLevelNotReached(action.minSkill1, action.minLevel1)
    );

    require(
      action.minSkill2 == Skill.NONE || _players.getLevel(playerId, action.minSkill2) >= action.minLevel2,
      MinimumLevelNotReached(action.minSkill2, action.minLevel2)
    );

    require(
      action.minSkill3 == Skill.NONE || _players.getLevel(playerId, action.minSkill3) >= action.minLevel3,
      MinimumLevelNotReached(action.minSkill3, action.minLevel3)
    );
  }

  // Action must be finished as a precondition
  function _claim(uint256 playerId, uint256 queueId, bool startingAnother) private {
    PendingPassiveActionState memory _pendingPassiveActionState = pendingPassiveActionState(playerId);
    uint256 numItemsToMint = _pendingPassiveActionState.producedItemTokenIds.length +
      _pendingPassiveActionState.producedRandomRewardItemTokenIds.length;
    uint256[] memory itemTokenIds = new uint256[](numItemsToMint);
    uint256[] memory amounts = new uint256[](numItemsToMint);
    for (uint256 i; i < _pendingPassiveActionState.producedItemTokenIds.length; ++i) {
      itemTokenIds[i] = _pendingPassiveActionState.producedItemTokenIds[i];
      amounts[i] = _pendingPassiveActionState.producedAmounts[i];
    }

    for (uint256 i; i < _pendingPassiveActionState.producedRandomRewardItemTokenIds.length; ++i) {
      itemTokenIds[i + _pendingPassiveActionState.producedItemTokenIds.length] = _pendingPassiveActionState
        .producedRandomRewardItemTokenIds[i];
      amounts[i + _pendingPassiveActionState.producedItemTokenIds.length] = _pendingPassiveActionState
        .producedRandomRewardAmounts[i];
    }
    if (numItemsToMint != 0) {
      _itemNFT.mintBatch(_msgSender(), itemTokenIds, amounts);
    }
    emit ClaimPassiveAction(playerId, _msgSender(), queueId, itemTokenIds, amounts, startingAnother);
  }

  function _getSlice(bytes memory b, uint256 index) private pure returns (uint16) {
    uint256 key = index * 2;
    return uint16(b[key] | (bytes2(b[key + 1]) >> 8));
  }

  function _isWinner(
    uint256 playerId,
    uint256 startTimestamp,
    uint256 endTimestamp,
    uint16 boostIncrease,
    uint8 skipSuccessPercent
  ) private view returns (bool winner) {
    bytes memory randomBytes = _world.getRandomBytes(1, startTimestamp, endTimestamp, playerId);
    uint16 word = _getSlice(randomBytes, 0);
    return word < ((type(uint16).max * (uint256(skipSuccessPercent) + boostIncrease)) / 100);
  }

  /// @param playerId The player id
  /// @return finished If the action has finished
  /// @return oracleCalled If the oracle has been called for the previous day of the finished passive action
  /// @return hasRandomRewards If the passive action has random rewards
  /// @return numWinners The number of winners
  /// @return skippedToday If the player has skipped today
  function finishedInfo(
    uint256 playerId
  )
    public
    view
    returns (bool finished, bool oracleCalled, bool hasRandomRewards, uint256 numWinners, bool skippedToday)
  {
    // Check random reward results which may lower the time remaining (e.g. oracle speed boost)
    ActivePassiveInfo storage passiveAction = _activePassiveActions[playerId];
    uint256 actionId = passiveAction.actionId;
    if (actionId == NONE) {
      return (false, false, false, 0, false);
    }

    PassiveAction storage action = _actions[actionId];
    uint256 duration = action.durationDays * 1 days;

    uint256 startTime = _activePassiveActions[playerId].startTime;
    uint256 timespan = Math.min(duration, (block.timestamp - startTime));
    uint256 numDays = timespan / 1 days;

    hasRandomRewards = _hasRandomRewards(actionId);
    // Special case
    if (duration == 0) {
      finished = true;
    }

    World world = _world;
    for (uint256 timestamp = startTime; timestamp <= startTime + numDays * 1 days; timestamp += 1 days) {
      // Work out how many days we can skip
      if (action.skipSuccessPercent != 0 && timestamp < startTime + numDays * 1 days) {
        uint16 boostIncrease;
        if (passiveAction.boostItemTokenId != NONE) {
          boostIncrease = _itemNFT.getItem(passiveAction.boostItemTokenId).boostValue;
        }

        oracleCalled = world.hasRandomWord(timestamp);

        if (oracleCalled && _isWinner(playerId, startTime, timestamp, boostIncrease, action.skipSuccessPercent)) {
          ++numWinners;

          // Is this yesterday's oracle?
          if (timestamp / 1 days == (block.timestamp / 1 days - 1)) {
            // This is the last day, so we can return
            skippedToday = true;
          }
        }
      }
      // Take the number of winners for skipping and see if that oracle has been called
      if ((startTime + duration - numWinners * 1 days <= block.timestamp)) {
        finished = true;
        // Actually check if it has the random word for this day
        if (_hasRandomRewards(actionId) && timestamp != startTime + duration - numWinners * 1 days - 1 days) {
          oracleCalled = world.hasRandomWord(startTime + duration - numWinners * 1 days - 1 days);
        }
        break;
      }
    }
  }

  function _burnInputs(PassiveAction storage action, uint16 boostItemTokenId) private {
    if (action.inputTokenId1 == NONE && boostItemTokenId == NONE) {
      // There is nothing to burn
      return;
    }

    uint256 inputTokenLength = action.inputTokenId2 == NONE ? 1 : (action.inputTokenId3 == NONE ? 2 : 3);
    uint256 arrLength = inputTokenLength;
    if (boostItemTokenId != NONE) {
      ++arrLength;
    }
    uint256[] memory itemTokenIds = new uint256[](arrLength);
    uint256[] memory amounts = new uint256[](arrLength);

    itemTokenIds[0] = action.inputTokenId1;
    amounts[0] = action.inputAmount1;
    if (inputTokenLength > 1) {
      itemTokenIds[1] = action.inputTokenId2;
      amounts[1] = action.inputAmount2;
    }
    if (inputTokenLength > 2) {
      itemTokenIds[2] = action.inputTokenId3;
      amounts[2] = action.inputAmount3;
    }

    if (boostItemTokenId != NONE) {
      itemTokenIds[arrLength - 1] = boostItemTokenId;
      amounts[arrLength - 1] = 1;
    }

    // Burn it all
    _itemNFT.burnBatch(_msgSender(), itemTokenIds, amounts);
  }

  function _setupRandomRewards(
    ActionRewards memory rewards
  ) private pure returns (RandomReward[] memory randomRewards) {
    randomRewards = new RandomReward[](4);
    uint256 randomRewardLength;
    if (rewards.randomRewardTokenId1 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        rewards.randomRewardTokenId1,
        rewards.randomRewardChance1,
        rewards.randomRewardAmount1
      );
    }
    if (rewards.randomRewardTokenId2 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        rewards.randomRewardTokenId2,
        rewards.randomRewardChance2,
        rewards.randomRewardAmount2
      );
    }
    if (rewards.randomRewardTokenId3 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        rewards.randomRewardTokenId3,
        rewards.randomRewardChance3,
        rewards.randomRewardAmount3
      );
    }
    if (rewards.randomRewardTokenId4 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        rewards.randomRewardTokenId4,
        rewards.randomRewardChance4,
        rewards.randomRewardAmount4
      );
    }

    assembly ("memory-safe") {
      mstore(randomRewards, randomRewardLength)
    }
  }

  function _hasRandomRewards(uint256 actionId) private view returns (bool) {
    return uint8(_actions[actionId].packedData >> HAS_RANDOM_REWARDS_BIT) & 1 == 1;
  }

  function _isActionFullMode(uint16 actionId) private view returns (bool) {
    return uint8(_actions[actionId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _isActionAvailable(uint16 actionId) private view returns (bool) {
    return uint8(_actions[actionId].packedData >> IS_AVAILABLE_BIT) & 1 == 1;
  }

  function _packAction(
    PassiveActionInfoInput calldata actionInfo,
    bool hasRandomRewards
  ) private pure returns (PassiveAction memory passiveAction) {
    bytes1 packedData = bytes1(uint8(actionInfo.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    if (actionInfo.isAvailable) {
      packedData |= bytes1(uint8(1 << IS_AVAILABLE_BIT));
    }
    if (hasRandomRewards) {
      packedData |= bytes1(uint8(1 << HAS_RANDOM_REWARDS_BIT));
    }
    passiveAction = PassiveAction({
      durationDays: actionInfo.durationDays,
      minSkill1: actionInfo.minSkills.length != 0 ? actionInfo.minSkills[0] : Skill.NONE,
      minLevel1: actionInfo.minLevels.length != 0 ? actionInfo.minLevels[0] : 0,
      minSkill2: actionInfo.minSkills.length > 1 ? actionInfo.minSkills[1] : Skill.NONE,
      minLevel2: actionInfo.minLevels.length > 1 ? actionInfo.minLevels[1] : 0,
      minSkill3: actionInfo.minSkills.length > 2 ? actionInfo.minSkills[2] : Skill.NONE,
      minLevel3: actionInfo.minLevels.length > 2 ? actionInfo.minLevels[2] : 0,
      inputTokenId1: actionInfo.inputTokenIds.length != 0 ? actionInfo.inputTokenIds[0] : NONE,
      inputAmount1: actionInfo.inputAmounts.length != 0 ? actionInfo.inputAmounts[0] : 0,
      inputTokenId2: actionInfo.inputTokenIds.length > 1 ? actionInfo.inputTokenIds[1] : NONE,
      inputAmount2: actionInfo.inputAmounts.length > 1 ? actionInfo.inputAmounts[1] : 0,
      inputTokenId3: actionInfo.inputTokenIds.length > 2 ? actionInfo.inputTokenIds[2] : NONE,
      inputAmount3: actionInfo.inputAmounts.length > 2 ? actionInfo.inputAmounts[2] : 0,
      skipSuccessPercent: actionInfo.skipSuccessPercent,
      packedData: packedData,
      questPrerequisiteId: actionInfo.questPrerequisiteId
    });
  }

  function _setAction(PassiveActionInput calldata passiveActionInput) private {
    require(passiveActionInput.actionId != 0, ActionIdZeroNotAllowed());
    require(passiveActionInput.info.durationDays <= MAX_UNIQUE_TICKETS, DurationTooLong());
    PassiveActionInfoInput calldata actionInfo = passiveActionInput.info;
    _checkInfo(actionInfo);
    _actions[passiveActionInput.actionId] = _packAction(
      passiveActionInput.info,
      passiveActionInput.randomRewards.length != 0
    );

    // Set the rewards
    ActionRewards storage actionReward = _actionRewards[passiveActionInput.actionId];
    delete _actionRewards[passiveActionInput.actionId];
    WorldLibrary.setActionGuaranteedRewards(passiveActionInput.guaranteedRewards, actionReward);
    WorldLibrary.setActionRandomRewards(passiveActionInput.randomRewards, actionReward);
  }

  function _checkInfo(PassiveActionInfoInput calldata actionInfo) private pure {
    uint16[] calldata inputTokenIds = actionInfo.inputTokenIds;
    uint24[] calldata amounts = actionInfo.inputAmounts;

    require(inputTokenIds.length <= 3, TooManyInputItems());
    require(inputTokenIds.length == amounts.length, LengthMismatch());

    // Must have at least 1 input
    require(inputTokenIds.length != 0, NoInputItemsSpecified());

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
    Skill[] calldata minSkills = actionInfo.minSkills;
    uint8[] calldata minLevels = actionInfo.minLevels;

    require(minSkills.length <= 3, TooManyMinSkills());
    require(minSkills.length == minLevels.length, LengthMismatch());
    for (uint256 i; i < minSkills.length; ++i) {
      require(minSkills[i] != Skill.NONE, InvalidSkill());
      require(minLevels[i] != 0, InputSpecifiedWithoutAmount());

      if (i != minSkills.length - 1) {
        for (uint256 j; j < minSkills.length; ++j) {
          require(j == i || minSkills[i] != minSkills[j], MinimumSkillsNoDuplicates());
        }
      }
    }
  }

  function addActions(PassiveActionInput[] calldata passiveActionInputs) external onlyOwner {
    for (uint256 i; i < passiveActionInputs.length; ++i) {
      require(
        _actions[passiveActionInputs[i].actionId].inputTokenId1 == 0,
        ActionAlreadyExists(passiveActionInputs[i].actionId)
      );
      _setAction(passiveActionInputs[i]);
    }
    emit AddPassiveActions(passiveActionInputs);
  }

  function editActions(PassiveActionInput[] calldata passiveActionInputs) external onlyOwner {
    for (uint256 i = 0; i < passiveActionInputs.length; ++i) {
      require(_actions[passiveActionInputs[i].actionId].inputTokenId1 != NONE, ActionDoesNotExist());
      _setAction(passiveActionInputs[i]);
    }
    emit EditPassiveActions(passiveActionInputs);
  }

  function getAction(uint16 actionId) external view returns (PassiveAction memory) {
    return _actions[actionId];
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
