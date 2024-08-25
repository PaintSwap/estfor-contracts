// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "./ozUpgradeable/security/ReentrancyGuardUpgradeable.sol";

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
  event StartPassiveAction(uint playerId, address from, uint actionId, uint queueId, uint16 boostItemTokenId);
  event EarlyEndPassiveAction(uint playerId, address from, uint queueId);
  event ClaimPassiveAction(
    uint playerId,
    address from,
    uint queueId,
    uint[] itemTokenIds,
    uint[] amounts,
    bool startingAnother
  );
  event SetAvailableActions(uint256[] actionIds, bool isAvailable); // TODO: Combine this with PassiveActionInput later

  error NotOwnerOfPlayerAndActive();
  error NotPassiveVial();
  error InvalidActionId();
  error ActionNotAvailable();
  error ActionAlreadyExists(uint16 actionId);
  error ActionDoesNotExist();
  error ActionIdZeroNotAllowed();
  error DurationCannotBeZero();
  error DurationTooLong();
  error PlayerNotUpgraded();
  error MinimumLevelNotReached(Skill minSkill, uint minLevel);
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
    uint16[] minLevels;
    uint8 skipSuccessPercent; // 0-100 (% chance of skipping a day)
    uint8 worldLocation; // 0 is the main starting world
    bool isFullModeOnly;
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
    uint16 minLevel1;
    Skill minSkill2;
    uint16 minLevel2;
    Skill minSkill3;
    uint16 minLevel3;
    uint8 skipSuccessPercent;
    bool hasRandomRewards;
    bytes1 packedData; // worldLocation first bit, second bit isAvailable, last bit isFullModeOnly
  }

  struct PendingPassiveActionState {
    uint[] producedItemTokenIds;
    uint[] producedAmounts;
    uint[] producedRandomRewardItemTokenIds; // Oracle loot
    uint[] producedRandomRewardAmounts;
    uint numDaysSkipped;
    bool skippedToday;
    bool isReady;
  }

  struct ActivePassiveInfo {
    uint16 actionId;
    uint96 queueId;
    uint40 startTime;
    uint16 boostItemTokenId;
  }

  IPlayers public players;
  ItemNFT public itemNFT;
  World public world;
  uint80 lastQueueId;
  mapping(uint actionId => PassiveAction action) public actions;
  mapping(uint actionId => ActionRewards) private actionRewards;
  mapping(uint playerId => ActivePassiveInfo activePassiveInfo) private activePassiveActions;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IPlayers _players, ItemNFT _itemNFT, World _world) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    __ReentrancyGuard_init();
    players = _players;
    itemNFT = _itemNFT;
    world = _world;
    lastQueueId = 1;
  }

  function startAction(
    uint _playerId,
    uint16 _actionId,
    uint16 _boostItemTokenId
  ) external isOwnerOfPlayerAndActive(_playerId) {
    // Cannot start a passive action when one is active already for this player
    if (activePassiveActions[_playerId].actionId != NONE) {
      (bool finished, , , , ) = finishedInfo(_playerId);
      if (finished) {
        _claim(_playerId, activePassiveActions[_playerId].queueId, true);
      } else {
        revert PreviousActionNotFinished();
      }
    }

    PassiveAction storage action = actions[_actionId];
    if (action.inputTokenId1 == NONE) {
      revert InvalidActionId();
    }

    _checkMinLevelRequirements(_playerId, _actionId);

    if (!_isActionAvailable(_actionId)) {
      revert ActionNotAvailable();
    }

    if (_isActionFullMode(_actionId) && !players.isPlayerUpgraded(_playerId)) {
      revert PlayerNotUpgraded();
    }

    if (_boostItemTokenId != NONE) {
      Item memory item = itemNFT.getItem(_boostItemTokenId);
      if (item.equipPosition != EquipPosition.PASSIVE_BOOST_VIAL) {
        revert NotPassiveVial();
      }
    }

    uint96 queueId = lastQueueId++;
    activePassiveActions[_playerId] = ActivePassiveInfo({
      actionId: _actionId,
      queueId: queueId,
      startTime: uint40(block.timestamp),
      boostItemTokenId: _boostItemTokenId
    });

    _burnInputs(action, _boostItemTokenId);

    emit StartPassiveAction(_playerId, msg.sender, _actionId, queueId, _boostItemTokenId);
  }

  function claim(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) nonReentrant {
    uint queueId = activePassiveActions[_playerId].queueId;
    if (queueId == NONE) {
      revert NoActivePassiveAction();
    }
    (bool finished, bool oracleCalled, bool hasRandomRewards, , ) = finishedInfo(_playerId);
    if (!finished || (hasRandomRewards && !oracleCalled)) {
      revert PassiveActionNotReadyToBeClaimed();
    }

    _claim(_playerId, queueId, false);
    delete activePassiveActions[_playerId];
  }

  function endEarly(uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    uint queueId = activePassiveActions[_playerId].queueId;
    if (queueId == NONE) {
      revert NoActivePassiveAction();
    }

    (bool finished, , , , ) = finishedInfo(_playerId);
    if (finished) {
      revert ActionAlreadyFinished();
    }

    delete activePassiveActions[_playerId];
    emit EarlyEndPassiveAction(_playerId, msg.sender, queueId);
  }

  // Get current state of the passive action
  function pendingPassiveActionState(
    uint _playerId
  ) public view returns (PendingPassiveActionState memory _pendingPassiveActionState) {
    // If it's not finished then you get nothing
    (bool finished, bool oracleCalled, bool hasRandomRewards, uint numWinners, bool skippedToday) = finishedInfo(
      _playerId
    );
    _pendingPassiveActionState.isReady = finished && (oracleCalled || !hasRandomRewards);
    _pendingPassiveActionState.numDaysSkipped = numWinners;
    _pendingPassiveActionState.skippedToday = skippedToday;
    if (!finished) {
      return _pendingPassiveActionState;
    }

    ActivePassiveInfo storage passiveAction = activePassiveActions[_playerId];
    PassiveAction memory action = actions[passiveAction.actionId];

    uint numIterations = action.durationDays;
    ActionRewards storage _actionRewards = actionRewards[passiveAction.actionId];

    // Add guaranteed rewards
    uint guaranteedRewardLength = _actionRewards.guaranteedRewardTokenId3 != NONE
      ? 3
      : _actionRewards.guaranteedRewardTokenId2 != NONE
      ? 2
      : _actionRewards.guaranteedRewardTokenId1 != NONE
      ? 1
      : 0;

    _pendingPassiveActionState.producedItemTokenIds = new uint[](guaranteedRewardLength);
    _pendingPassiveActionState.producedAmounts = new uint[](guaranteedRewardLength);
    if (_actionRewards.guaranteedRewardTokenId1 != NONE) {
      _pendingPassiveActionState.producedItemTokenIds[0] = _actionRewards.guaranteedRewardTokenId1;
      _pendingPassiveActionState.producedAmounts[0] = _actionRewards.guaranteedRewardRate1;
    }
    if (_actionRewards.guaranteedRewardTokenId2 != NONE) {
      _pendingPassiveActionState.producedItemTokenIds[1] = _actionRewards.guaranteedRewardTokenId2;
      _pendingPassiveActionState.producedAmounts[1] = _actionRewards.guaranteedRewardRate2;
    }
    if (_actionRewards.guaranteedRewardTokenId3 != NONE) {
      _pendingPassiveActionState.producedItemTokenIds[2] = _actionRewards.guaranteedRewardTokenId3;
      _pendingPassiveActionState.producedAmounts[2] = _actionRewards.guaranteedRewardRate3;
    }

    // Add random rewards
    if (oracleCalled) {
      RandomReward[] memory randomRewards = _setupRandomRewards(_actionRewards);
      uint endTime = passiveAction.startTime + (action.durationDays - numWinners) * 1 days - 1 days;
      bytes memory randomBytes = world.getRandomBytes(numIterations, passiveAction.startTime, endTime, _playerId);

      _pendingPassiveActionState.producedRandomRewardItemTokenIds = new uint[](randomRewards.length);
      _pendingPassiveActionState.producedRandomRewardAmounts = new uint[](randomRewards.length);

      uint length;
      for (uint i; i < numIterations; ++i) {
        uint operation = uint(_getSlice(randomBytes, i));
        uint16 rand = uint16(Math.min(type(uint16).max, operation));
        for (uint j; j < randomRewards.length; ++j) {
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

      uint[] memory ids = _pendingPassiveActionState.producedRandomRewardItemTokenIds;
      uint[] memory amounts = _pendingPassiveActionState.producedRandomRewardAmounts;
      assembly ("memory-safe") {
        mstore(ids, length)
        mstore(amounts, length)
      }
    }
  }

  function _checkMinLevelRequirements(uint _playerId, uint _actionId) private view {
    PassiveAction storage action = actions[_actionId];
    if (action.minSkill1 != Skill.NONE && players.level(_playerId, action.minSkill1) < action.minLevel1) {
      revert MinimumLevelNotReached(action.minSkill1, action.minLevel1);
    }

    if (action.minSkill2 != Skill.NONE && players.level(_playerId, action.minSkill2) < action.minLevel2) {
      revert MinimumLevelNotReached(action.minSkill2, action.minLevel2);
    }

    if (action.minSkill3 != Skill.NONE && players.level(_playerId, action.minSkill3) < action.minLevel3) {
      revert MinimumLevelNotReached(action.minSkill3, action.minLevel3);
    }
  }

  // Action must be finished as a precondition
  function _claim(uint _playerId, uint _queueId, bool _startingAnother) private {
    PendingPassiveActionState memory _pendingPassiveActionState = pendingPassiveActionState(_playerId);
    uint numItemsToMint = _pendingPassiveActionState.producedItemTokenIds.length +
      _pendingPassiveActionState.producedRandomRewardItemTokenIds.length;
    uint[] memory itemTokenIds = new uint[](numItemsToMint);
    uint[] memory amounts = new uint[](numItemsToMint);
    for (uint i; i < _pendingPassiveActionState.producedItemTokenIds.length; ++i) {
      itemTokenIds[i] = _pendingPassiveActionState.producedItemTokenIds[i];
      amounts[i] = _pendingPassiveActionState.producedAmounts[i];
    }

    for (uint i; i < _pendingPassiveActionState.producedRandomRewardItemTokenIds.length; ++i) {
      itemTokenIds[i + _pendingPassiveActionState.producedItemTokenIds.length] = _pendingPassiveActionState
        .producedRandomRewardItemTokenIds[i];
      amounts[i + _pendingPassiveActionState.producedItemTokenIds.length] = _pendingPassiveActionState
        .producedRandomRewardAmounts[i];
    }
    if (numItemsToMint > 0) {
      itemNFT.mintBatch(msg.sender, itemTokenIds, amounts);
    }
    emit ClaimPassiveAction(_playerId, msg.sender, _queueId, itemTokenIds, amounts, _startingAnother);
  }

  function _getSlice(bytes memory _b, uint _index) private pure returns (uint16) {
    uint256 index = _index * 2;
    return uint16(_b[index] | (bytes2(_b[index + 1]) >> 8));
  }

  function _isWinner(
    uint _playerId,
    uint _startTimestamp,
    uint _endTimestamp,
    uint16 _boostIncrease,
    uint8 _skipSuccessPercent
  ) private view returns (bool winner) {
    bytes memory randomBytes = world.getRandomBytes(1, _startTimestamp, _endTimestamp, _playerId);
    uint16 word = _getSlice(randomBytes, 0);
    return word < ((type(uint16).max * (uint(_skipSuccessPercent) + _boostIncrease)) / 100);
  }

  /// @param _playerId The player id
  /// @return finished If the action has finished
  /// @return oracleCalled If the oracle has been called for the previous day of the finished passive action
  /// @return hasRandomRewards If the passive action has random rewards
  /// @return numWinners The number of winners
  /// @return skippedToday If the player has skipped today
  function finishedInfo(
    uint _playerId
  ) public view returns (bool finished, bool oracleCalled, bool hasRandomRewards, uint numWinners, bool skippedToday) {
    // Check random reward results which may lower the time remaining (e.g. oracle speed boost)
    ActivePassiveInfo storage passiveAction = activePassiveActions[_playerId];
    if (passiveAction.actionId == NONE) {
      return (false, false, false, 0, false);
    }

    PassiveAction storage action = actions[passiveAction.actionId];
    uint duration = action.durationDays * 1 days;

    uint startTime = activePassiveActions[_playerId].startTime;
    uint timespan = Math.min(duration, (block.timestamp - startTime));
    uint numDays = timespan / 1 days;

    hasRandomRewards = action.hasRandomRewards;
    // Special case
    if (duration == 0) {
      finished = true;
    }

    for (uint timestamp = startTime; timestamp <= startTime + numDays * 1 days; timestamp += 1 days) {
      // Work out how many days we can skip
      if (action.skipSuccessPercent != 0 && timestamp < startTime + numDays * 1 days) {
        uint16 boostIncrease;
        if (passiveAction.boostItemTokenId != NONE) {
          boostIncrease = itemNFT.getItem(passiveAction.boostItemTokenId).boostValue;
        }

        oracleCalled = world.hasRandomWord(timestamp);

        if (oracleCalled && _isWinner(_playerId, startTime, timestamp, boostIncrease, action.skipSuccessPercent)) {
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
        if (action.hasRandomRewards && timestamp != startTime + duration - numWinners * 1 days - 1 days) {
          oracleCalled = world.hasRandomWord(startTime + duration - numWinners * 1 days - 1 days);
        }
        break;
      }
    }
  }

  function _burnInputs(PassiveAction storage action, uint16 _boostItemTokenId) private {
    if (action.inputTokenId1 == NONE && _boostItemTokenId == NONE) {
      // There is nothing to burn
      return;
    }

    uint inputTokenLength = action.inputTokenId2 == NONE ? 1 : (action.inputTokenId3 == NONE ? 2 : 3);
    uint arrLength = inputTokenLength;
    if (_boostItemTokenId != NONE) {
      ++arrLength;
    }
    uint[] memory itemTokenIds = new uint[](arrLength);
    uint[] memory amounts = new uint[](arrLength);

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

    if (_boostItemTokenId != NONE) {
      itemTokenIds[arrLength - 1] = _boostItemTokenId;
      amounts[arrLength - 1] = 1;
    }

    // Burn it all
    itemNFT.burnBatch(msg.sender, itemTokenIds, amounts);
  }

  function _setupRandomRewards(
    ActionRewards memory _rewards
  ) private pure returns (RandomReward[] memory randomRewards) {
    randomRewards = new RandomReward[](4);
    uint randomRewardLength;
    if (_rewards.randomRewardTokenId1 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId1,
        _rewards.randomRewardChance1,
        _rewards.randomRewardAmount1
      );
    }
    if (_rewards.randomRewardTokenId2 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId2,
        _rewards.randomRewardChance2,
        _rewards.randomRewardAmount2
      );
    }
    if (_rewards.randomRewardTokenId3 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId3,
        _rewards.randomRewardChance3,
        _rewards.randomRewardAmount3
      );
    }
    if (_rewards.randomRewardTokenId4 != 0) {
      randomRewards[randomRewardLength++] = RandomReward(
        _rewards.randomRewardTokenId4,
        _rewards.randomRewardChance4,
        _rewards.randomRewardAmount4
      );
    }

    assembly ("memory-safe") {
      mstore(randomRewards, randomRewardLength)
    }
  }

  function _isActionFullMode(uint16 _actionId) private view returns (bool) {
    return uint8(actions[_actionId].packedData >> IS_FULL_MODE_BIT) & 1 == 1;
  }

  function _isActionAvailable(uint16 _actionId) private view returns (bool) {
    return uint8(actions[_actionId].packedData >> IS_AVAILABLE_BIT) & 1 == 1;
  }

  function _packAction(
    PassiveActionInfoInput calldata _actionInfo,
    bool _hasRandomRewards
  ) private pure returns (PassiveAction memory passiveAction) {
    bytes1 packedData = bytes1(uint8(_actionInfo.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    packedData |= bytes1(uint8(1 << IS_AVAILABLE_BIT));
    passiveAction = PassiveAction({
      durationDays: _actionInfo.durationDays,
      minSkill1: _actionInfo.minSkills.length > 0 ? _actionInfo.minSkills[0] : Skill.NONE,
      minLevel1: _actionInfo.minLevels.length > 0 ? _actionInfo.minLevels[0] : 0,
      minSkill2: _actionInfo.minSkills.length > 1 ? _actionInfo.minSkills[1] : Skill.NONE,
      minLevel2: _actionInfo.minLevels.length > 1 ? _actionInfo.minLevels[1] : 0,
      minSkill3: _actionInfo.minSkills.length > 2 ? _actionInfo.minSkills[2] : Skill.NONE,
      minLevel3: _actionInfo.minLevels.length > 2 ? _actionInfo.minLevels[2] : 0,
      inputTokenId1: _actionInfo.inputTokenIds.length > 0 ? _actionInfo.inputTokenIds[0] : NONE,
      inputAmount1: _actionInfo.inputAmounts.length > 0 ? _actionInfo.inputAmounts[0] : 0,
      inputTokenId2: _actionInfo.inputTokenIds.length > 1 ? _actionInfo.inputTokenIds[1] : NONE,
      inputAmount2: _actionInfo.inputAmounts.length > 1 ? _actionInfo.inputAmounts[1] : 0,
      inputTokenId3: _actionInfo.inputTokenIds.length > 2 ? _actionInfo.inputTokenIds[2] : NONE,
      inputAmount3: _actionInfo.inputAmounts.length > 2 ? _actionInfo.inputAmounts[2] : 0,
      skipSuccessPercent: _actionInfo.skipSuccessPercent,
      hasRandomRewards: _hasRandomRewards,
      packedData: packedData
    });
  }

  function _setAction(PassiveActionInput calldata _passiveActionInput) private {
    if (_passiveActionInput.actionId == 0) {
      revert ActionIdZeroNotAllowed();
    }
    PassiveActionInfoInput calldata actionInfo = _passiveActionInput.info;
    // Allow for the beta for initial testing
    //    if (_passiveActionInput.info.durationDays == 0) {
    //      revert DurationCannotBeZero();
    //    }
    if (_passiveActionInput.info.durationDays > MAX_UNIQUE_TICKETS_) {
      revert DurationTooLong();
    }

    _checkInfo(actionInfo);
    actions[_passiveActionInput.actionId] = _packAction(
      _passiveActionInput.info,
      _passiveActionInput.randomRewards.length != 0
    );

    // Set the rewards
    ActionRewards storage actionReward = actionRewards[_passiveActionInput.actionId];
    delete actionRewards[_passiveActionInput.actionId];
    WorldLibrary.setActionGuaranteedRewards(_passiveActionInput.guaranteedRewards, actionReward);
    WorldLibrary.setActionRandomRewards(_passiveActionInput.randomRewards, actionReward);
  }

  function _checkInfo(PassiveActionInfoInput calldata _actionInfo) private pure {
    uint16[] calldata inputTokenIds = _actionInfo.inputTokenIds;
    uint24[] calldata amounts = _actionInfo.inputAmounts;

    if (inputTokenIds.length > 3) {
      revert TooManyInputItems();
    }
    if (inputTokenIds.length != amounts.length) {
      revert LengthMismatch();
    }

    // Must have at least 1 input
    if (inputTokenIds.length == 0) {
      revert NoInputItemsSpecified();
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
    Skill[] calldata minSkills = _actionInfo.minSkills;
    uint16[] calldata minLevels = _actionInfo.minLevels;

    if (minSkills.length > 3) {
      revert TooManyMinSkills();
    }
    if (minSkills.length != minLevels.length) {
      revert LengthMismatch();
    }
    for (uint i; i < minSkills.length; ++i) {
      if (minSkills[i] == Skill.NONE) {
        revert InvalidSkill();
      }
      if (minLevels[i] == 0) {
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

  function addActions(PassiveActionInput[] calldata _passiveActionInputs) external onlyOwner {
    for (uint i; i < _passiveActionInputs.length; ++i) {
      if (actions[_passiveActionInputs[i].actionId].inputTokenId1 != 0) {
        revert ActionAlreadyExists(_passiveActionInputs[i].actionId);
      }
      _setAction(_passiveActionInputs[i]);
    }
    emit AddPassiveActions(_passiveActionInputs);
  }

  function editActions(PassiveActionInput[] calldata _passiveActionInputs) external onlyOwner {
    for (uint i = 0; i < _passiveActionInputs.length; ++i) {
      if (actions[_passiveActionInputs[i].actionId].inputTokenId1 == NONE) {
        revert ActionDoesNotExist();
      }
      _setAction(_passiveActionInputs[i]);
    }
    emit EditPassiveActions(_passiveActionInputs);
  }

  function setAvailable(uint256[] calldata _actionIds, bool _isAvailable) external onlyOwner {
    for (uint16 i; i < _actionIds.length; ++i) {
      bytes1 packedData = actions[_actionIds[i]].packedData;
      bytes1 mask = bytes1(uint8(1 << IS_AVAILABLE_BIT));
      if (_isAvailable) {
        packedData |= mask;
      } else {
        packedData &= ~mask;
      }

      actions[_actionIds[i]].packedData = packedData;
    }
    emit SetAvailableActions(_actionIds, _isAvailable);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
