// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {SamWitchVRFConsumerUpgradeable} from "./SamWitchVRFConsumerUpgradeable.sol";

import {WorldLibrary} from "./WorldLibrary.sol";
import {SkillLibrary} from "./SkillLibrary.sol";
import {IOracleRewardCB} from "./interfaces/IOracleRewardCB.sol";
import {ISamWitchVRF} from "./interfaces/ISamWitchVRF.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

contract World is SamWitchVRFConsumerUpgradeable, UUPSUpgradeable, OwnableUpgradeable {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;
  using SkillLibrary for uint8;

  event RequestSent(uint256 requestId, uint32 numWords, uint256 lastRandomWordsUpdatedTime);
  event RequestFulfilledV2(uint256 requestId, uint256 randomWord);
  event AddActionsV2(Action[] actions);
  event EditActionsV2(Action[] actions);
  event AddActionChoicesV4(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInput[] choices);
  event EditActionChoicesV4(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInput[] choices);
  event RemoveActionChoicesV2(uint16 actionId, uint16[] actionChoiceIds);

  // Legacy for old live events
  event AddActionChoicesV3(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInputV3[] choices);
  event EditActionChoicesV3(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInputV3[] choices);
  event AddActionChoicesV2(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInputV2[] choices);
  event EditActionChoicesV2(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInputV2[] choices);

  // Legacy, just for ABI reasons and old beta events
  event AddAction(ActionV1 action);
  event AddActions(ActionV1[] actions);
  event EditActions(ActionV1[] actions);
  event AddActionChoice(uint16 actionId, uint16 actionChoiceId, ActionChoiceV1 choice);
  event AddActionChoices(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceV1[] choices);
  event EditActionChoice(uint16 actionId, uint16 actionChoiceId, ActionChoiceV1 choice);
  event EditActionChoices_(uint16[] actionIds, uint16[] actionChoiceIds, ActionChoiceV1[] choices);
  event RequestFulfilled(uint256 requestId, uint256[3] randomWords);

  error RandomWordsCannotBeUpdatedYet();
  error CanOnlyRequestAfterTheNextCheckpoint(uint256 currentTime, uint256 checkpoint);
  error RequestAlreadyFulfilled();
  error NoValidRandomWord();
  error CanOnlyRequestAfter1DayHasPassed();
  error ActionIdZeroNotAllowed();
  error MinCannotBeGreaterThanMax();
  error DynamicActionsCannotBeAdded();
  error ActionAlreadyExists(uint16 actionId);
  error ActionDoesNotExist();
  error ActionChoiceIdZeroNotAllowed();
  error DynamicActionsCannotBeSet();
  error LengthMismatch();
  error NoActionChoices();
  error ActionChoiceAlreadyExists();
  error ActionChoiceDoesNotExist();
  error NotAFactorOf3600();
  error NonCombatWithActionChoicesCannotHaveBothGuaranteedAndRandomRewards();
  error InvalidReward();
  error TooManyRewardsInPool();
  error CallbackGasLimitTooHigh();

  // solhint-disable-next-line var-name-mixedcase
  address private COORDINATOR; // Not used anymore

  // Your subscription ID.
  uint64 private _subscriptionId; // Not used anymore

  // Past request ids
  uint256[] private _requestIds; // Each one is a set of random words for 1 day
  mapping(uint256 requestId => uint256 randomWord) private _randomWords;
  uint40 private _lastRandomWordsUpdatedTime;
  uint40 private _startTime;
  uint40 private _weeklyRewardCheckpoint;
  bytes8 private _thisWeeksRandomWordSegment; // Every 8 bits is a random segment for the day
  uint24 private _callbackGasLimit;

  uint32 public constant NUM_WORDS = 1;

  uint32 public constant MIN_RANDOM_WORDS_UPDATE_TIME = 1 days;
  uint32 private constant MIN_DYNAMIC_ACTION_UPDATE_TIME = 1 days;

  uint32 public constant NUM_DAYS_RANDOM_WORDS_INITIALIZED = 3;

  mapping(uint256 actionId => ActionInfo actionInfo) private _actions;
  uint16[] private _lastAddedDynamicActions;
  uint256 private _lastDynamicUpdatedTime;

  mapping(uint256 actionId => mapping(uint16 choiceId => ActionChoice actionChoice)) private _actionChoices;
  mapping(uint256 actionId => CombatStats combatStats) private _actionCombatStats;

  mapping(uint256 actionId => ActionRewards actionRewards) private _actionRewards;

  IOracleRewardCB private _quests;

  mapping(uint256 tier => Equipment[]) private _dailyRewardPool;
  mapping(uint256 tier => Equipment[]) private _weeklyRewardPool;

  IOracleRewardCB private _wishingWell;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address vrf) external initializer {
    __SamWitchVRFConsumerUpgradeable_init(ISamWitchVRF(vrf));
    __UUPSUpgradeable_init();
    __Ownable_init();

    uint40 startTime = uint40(
      (block.timestamp / MIN_RANDOM_WORDS_UPDATE_TIME) *
        MIN_RANDOM_WORDS_UPDATE_TIME -
        (NUM_DAYS_RANDOM_WORDS_INITIALIZED + 1) *
        1 days
    );
    _startTime = startTime; // Floor to the nearest day 00:00 UTC
    _lastRandomWordsUpdatedTime = uint40(startTime + NUM_DAYS_RANDOM_WORDS_INITIALIZED * 1 days);
    _weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
    _callbackGasLimit = 600_000;

    // Initialize a few days worth of random words so that we have enough data to fetch the first day
    for (U256 iter; iter.lt(NUM_DAYS_RANDOM_WORDS_INITIALIZED); iter = iter.inc()) {
      uint256 i = iter.asUint256();
      uint256 requestId = 200 + i;
      _requestIds.push(requestId);
      emit RequestSent(requestId, NUM_WORDS, startTime + (i * 1 days) + 1 days);
      uint256[] memory words = new uint256[](1);
      words[0] = uint256(keccak256(abi.encodePacked(block.chainid == 31337 ? address(31337) : address(this), i)));
      _fulfillRandomWords(requestId, words);
    }

    _thisWeeksRandomWordSegment = bytes8(uint64(_randomWords[0]));
  }

  function requestIds(uint256 requestId) external view returns (uint256) {
    return _requestIds[requestId];
  }

  function randomWords(uint256 requestId) external view returns (uint256) {
    return _randomWords[requestId];
  }

  function lastRandomWordsUpdatedTime() external view returns (uint256) {
    return _lastRandomWordsUpdatedTime;
  }

  function actions(uint256 actionId) external view returns (ActionInfo memory) {
    return _actions[actionId];
  }

  function requestRandomWords() external returns (uint256 requestId) {
    // Last one has not been fulfilled yet
    if (_requestIds.length != 0 && _randomWords[_requestIds[_requestIds.length - 1]] == 0) {
      revert RandomWordsCannotBeUpdatedYet();
    }
    uint40 newLastRandomWordsUpdatedTime = _lastRandomWordsUpdatedTime + MIN_RANDOM_WORDS_UPDATE_TIME;
    if (newLastRandomWordsUpdatedTime > block.timestamp) {
      revert CanOnlyRequestAfterTheNextCheckpoint(block.timestamp, newLastRandomWordsUpdatedTime);
    }

    requestId = uint256(_samWitchVRF.requestRandomWords(NUM_WORDS, _callbackGasLimit));
    _requestIds.push(requestId);
    _lastRandomWordsUpdatedTime = newLastRandomWordsUpdatedTime;
    emit RequestSent(requestId, NUM_WORDS, newLastRandomWordsUpdatedTime);
    return requestId;
  }

  function fulfillRandomWords(bytes32 requestId, uint256[] memory words) external onlySamWitchVRF {
    _fulfillRandomWords(uint256(requestId), words);
  }

  function getWeeklyReward(uint256 _tier, uint256 _playerId) public view returns (uint16 itemTokenId, uint24 amount) {
    uint256 day = 7;
    uint256 index = _getRewardIndex(
      _playerId,
      day,
      uint64(_thisWeeksRandomWordSegment),
      _weeklyRewardPool[_tier].length
    );
    Equipment storage equipment = _weeklyRewardPool[_tier][index];
    return (equipment.itemTokenId, equipment.amount);
  }

  function getSpecificDailyReward(
    uint256 tier,
    uint256 playerId,
    uint256 day,
    uint256 randomWord
  ) public view returns (uint16 itemTokenId, uint24 amount) {
    uint256 _index = _getRewardIndex(playerId, day, randomWord, _dailyRewardPool[tier].length);
    Equipment storage _equipment = _dailyRewardPool[tier][_index];
    return (_equipment.itemTokenId, _equipment.amount);
  }

  function getDailyReward(uint256 tier, uint256 playerId) external view returns (uint256 itemTokenId, uint256 amount) {
    uint256 _checkpoint = ((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days;
    uint256 _day = ((block.timestamp / 1 days) * 1 days - _checkpoint) / 1 days;
    return getSpecificDailyReward(tier, playerId, _day, uint64(_thisWeeksRandomWordSegment));
  }

  function getActiveDailyAndWeeklyRewards(
    uint256 tier,
    uint256 playerId
  ) external view returns (Equipment[8] memory rewards) {
    for (uint256 i; i < 7; ++i) {
      (rewards[i].itemTokenId, rewards[i].amount) = getSpecificDailyReward(
        tier,
        playerId,
        i,
        uint64(_thisWeeksRandomWordSegment)
      );
    }
    (rewards[7].itemTokenId, rewards[7].amount) = getWeeklyReward(tier, playerId);
  }

  function _getRandomWordOffset(uint256 timestamp) private view returns (int) {
    if (timestamp < _startTime) {
      return -1;
    }
    return int((timestamp - _startTime) / MIN_RANDOM_WORDS_UPDATE_TIME);
  }

  function _getRandomWord(uint256 timestamp) private view returns (uint256) {
    int _offset = _getRandomWordOffset(timestamp);
    if (_offset < 0 || _requestIds.length <= uint256(_offset)) {
      return 0;
    }
    return _randomWords[_requestIds[uint256(_offset)]];
  }

  function hasRandomWord(uint256 timestamp) external view returns (bool) {
    return _getRandomWord(timestamp) != 0;
  }

  function getRandomWord(uint256 timestamp) public view returns (uint256 randomWord) {
    randomWord = _getRandomWord(timestamp);
    if (randomWord == 0) {
      revert NoValidRandomWord();
    }
  }

  function getMultipleWords(uint256 timestamp) public view returns (uint256[4] memory words) {
    for (U256 iter; iter.lt(4); iter = iter.inc()) {
      uint256 i = iter.asUint256();
      words[i] = getRandomWord(timestamp - (i * 1 days));
    }
  }

  function getSkill(uint256 actionId) external view returns (Skill) {
    return _actions[actionId].skill.asSkill();
  }

  function getActionRewards(uint256 actionId) external view returns (ActionRewards memory) {
    return _actionRewards[actionId];
  }

  function getActionInfo(uint256 actionId) external view returns (ActionInfo memory info) {
    return _actions[actionId];
  }

  function getXPPerHour(uint16 actionId, uint16 actionChoiceId) external view returns (uint24 xpPerHour) {
    return actionChoiceId != 0 ? _actionChoices[actionId][actionChoiceId].xpPerHour : _actions[actionId].xpPerHour;
  }

  function getNumSpawn(uint16 actionId) external view returns (uint256 numSpawned) {
    return _actions[actionId].numSpawned;
  }

  function getCombatStats(uint16 actionId) external view returns (CombatStats memory stats) {
    stats = _actionCombatStats[actionId];
  }

  function getActionChoice(uint16 actionId, uint16 choiceId) external view returns (ActionChoice memory choice) {
    ActionChoice storage _actionChoice = _actionChoices[actionId][choiceId];
    choice.skill = _actionChoice.skill;
    choice.minXP = _actionChoice.minXP;
    choice.skillDiff = _actionChoice.skillDiff;
    choice.rate = _actionChoice.rate;
    choice.xpPerHour = _actionChoice.xpPerHour;
    choice.inputTokenId1 = _actionChoice.inputTokenId1;
    choice.inputAmount1 = _actionChoice.inputAmount1;
    choice.inputTokenId2 = _actionChoice.inputTokenId2;
    choice.inputAmount2 = _actionChoice.inputAmount2;
    choice.inputTokenId3 = _actionChoice.inputTokenId3;
    choice.inputAmount3 = _actionChoice.inputAmount3;
    choice.outputTokenId = _actionChoice.outputTokenId;
    choice.outputAmount = _actionChoice.outputAmount;
    choice.successPercent = _actionChoice.successPercent;
    choice.handItemTokenIdRangeMin = _actionChoice.handItemTokenIdRangeMin;
    choice.handItemTokenIdRangeMax = _actionChoice.handItemTokenIdRangeMax;
    choice.packedData = _actionChoice.packedData;
    // Only read second storage when needed
    if (
      (uint8(choice.packedData >> ACTION_CHOICE_USE_NEW_MIN_SKILL_SECOND_STORAGE_SLOT_BIT) & 1 == 1) ||
      (uint8(choice.packedData >> ACTION_CHOICE_USE_ALTERNATE_INPUTS_SECOND_STORAGE_SLOT) & 1 == 1)
    ) {
      choice.minSkill2 = _actionChoice.minSkill2;
      choice.minXP2 = _actionChoice.minXP2;
      choice.minSkill3 = _actionChoice.minSkill3;
      choice.minXP3 = _actionChoice.minXP3;

      choice.newInputAmount1 = _actionChoice.newInputAmount1;
      choice.newInputAmount2 = _actionChoice.newInputAmount2;
      choice.newInputAmount3 = _actionChoice.newInputAmount3;
    }
  }

  function getActionSuccessPercentAndMinXP(uint16 actionId) external view returns (uint8 successPercent, uint32 minXP) {
    return (_actions[actionId].successPercent, _actions[actionId].minXP);
  }

  function getThisWeeksRandomWordSegment() external view returns (bytes8) {
    return _thisWeeksRandomWordSegment;
  }

  function getRewardsHelper(
    uint16 actionId
  ) external view returns (ActionRewards memory, Skill skill, uint256 numSpanwed, uint8 worldLocation) {
    return (
      _actionRewards[actionId],
      _actions[actionId].skill.asSkill(),
      _actions[actionId].numSpawned,
      _actions[actionId].worldLocation
    );
  }

  function getRandomBytes(
    uint256 numTickets,
    uint256 startTimestamp,
    uint256 endTimestamp,
    uint256 playerId
  ) external view returns (bytes memory randomBytes) {
    if (numTickets <= 16) {
      // 32 bytes
      bytes32 word = bytes32(getRandomWord(endTimestamp));
      randomBytes = abi.encodePacked(_getRandomComponent(word, startTimestamp, endTimestamp, playerId));
    } else if (numTickets <= MAX_UNIQUE_TICKETS) {
      // 4 * 32 bytes
      uint256[4] memory multipleWords = getMultipleWords(endTimestamp);
      for (U256 iter; iter.lt(4); iter = iter.inc()) {
        uint256 i = iter.asUint256();
        multipleWords[i] = uint256(
          _getRandomComponent(bytes32(multipleWords[i]), startTimestamp, endTimestamp, playerId)
        );
        // XOR all the words with the first fresh random number to give more randomness to the existing random words
        if (i != 0) {
          multipleWords[i] = uint256(keccak256(abi.encodePacked(multipleWords[i] ^ multipleWords[0])));
        }
      }
      randomBytes = abi.encodePacked(multipleWords);
    } else {
      assert(false);
    }
  }

  function _addAction(Action calldata action) private {
    if (action.info.isDynamic) {
      revert DynamicActionsCannotBeAdded();
    }
    if (_actions[action.actionId].skill.asSkill() != Skill.NONE) {
      revert ActionAlreadyExists(action.actionId);
    }
    _setAction(action);
  }

  function _getRewardIndex(
    uint256 playerId,
    uint256 day,
    uint256 randomWord,
    uint256 length
  ) private pure returns (uint256) {
    return uint256(keccak256(abi.encodePacked(randomWord, playerId)) >> (day * 8)) % length;
  }

  function _setAction(Action calldata action) private {
    if (action.actionId == 0) {
      revert ActionIdZeroNotAllowed();
    }
    if (action.info.handItemTokenIdRangeMin > action.info.handItemTokenIdRangeMax) {
      revert MinCannotBeGreaterThanMax();
    }

    if (action.info.numSpawned != 0) {
      // Combat
      if ((3600 * SPAWN_MUL) % action.info.numSpawned != 0) {
        revert NotAFactorOf3600();
      }
    } else if (action.guaranteedRewards.length != 0) {
      // Non-combat guaranteed rewards. Only care about the first one as it's used for correctly taking into account partial loots.
      if ((3600 * GUAR_MUL) % action.guaranteedRewards[0].rate != 0) {
        revert NotAFactorOf3600();
      }
    }

    _actions[action.actionId] = action.info;

    // Set the rewards
    ActionRewards storage _actionReward = _actionRewards[action.actionId];
    delete _actionRewards[action.actionId];
    WorldLibrary.setActionGuaranteedRewards(action.guaranteedRewards, _actionReward);
    WorldLibrary.setActionRandomRewards(action.randomRewards, _actionReward);

    if (action.info.skill.asSkill() == Skill.COMBAT) {
      _actionCombatStats[action.actionId] = action.combatStats;
    } else {
      bool actionHasGuaranteedRewards = action.guaranteedRewards.length != 0;
      bool actionHasRandomRewards = action.randomRewards.length != 0;
      if (actionHasGuaranteedRewards && actionHasRandomRewards && action.info.actionChoiceRequired) {
        revert NonCombatWithActionChoicesCannotHaveBothGuaranteedAndRandomRewards();
      }
    }
  }

  function _addActionChoice(
    uint16 actionId,
    uint16 actionChoiceId,
    ActionChoiceInput calldata actionChoiceInput
  ) private view {
    if (actionChoiceId == 0) {
      revert ActionChoiceIdZeroNotAllowed();
    }
    if (Skill(_actionChoices[actionId][actionChoiceId].skill) != Skill.NONE) {
      revert ActionChoiceAlreadyExists();
    }
    WorldLibrary.checkActionChoice(actionChoiceInput);
  }

  function _editActionChoice(
    uint16 actionId,
    uint16 actionChoiceId,
    ActionChoiceInput calldata actionChoiceInput
  ) private view {
    if (Skill(_actionChoices[actionId][actionChoiceId].skill) == Skill.NONE) {
      revert ActionChoiceDoesNotExist();
    }

    WorldLibrary.checkActionChoice(actionChoiceInput);
  }

  function _getRandomComponent(
    bytes32 word,
    uint256 startTimestamp,
    uint256 endTimestamp,
    uint256 playerId
  ) private pure returns (bytes32) {
    return keccak256(abi.encodePacked(word, startTimestamp, endTimestamp, playerId));
  }

  function _packActionChoice(
    ActionChoiceInput calldata actionChoiceInput
  ) private pure returns (ActionChoice memory actionChoice) {
    bytes1 _packedData = bytes1(uint8(actionChoiceInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    if (actionChoiceInput.minSkills.length > 1) {
      _packedData |= bytes1(uint8(1)) << ACTION_CHOICE_USE_NEW_MIN_SKILL_SECOND_STORAGE_SLOT_BIT;
    }

    bool _anyInputExceedsStandardAmount = (actionChoiceInput.inputAmounts.length != 0 &&
      actionChoiceInput.inputAmounts[0] > 255) ||
      (actionChoiceInput.inputAmounts.length > 1 && actionChoiceInput.inputAmounts[1] > 255) ||
      (actionChoiceInput.inputAmounts.length > 2 && actionChoiceInput.inputAmounts[2] > 255);

    if (_anyInputExceedsStandardAmount) {
      _packedData |= bytes1(uint8(1)) << ACTION_CHOICE_USE_ALTERNATE_INPUTS_SECOND_STORAGE_SLOT;
    }

    actionChoice = ActionChoice({
      skill: actionChoiceInput.skill,
      minXP: actionChoiceInput.minXPs.length != 0 ? actionChoiceInput.minXPs[0] : 0,
      skillDiff: actionChoiceInput.skillDiff,
      rate: actionChoiceInput.rate,
      xpPerHour: actionChoiceInput.xpPerHour,
      inputTokenId1: actionChoiceInput.inputTokenIds.length != 0 ? actionChoiceInput.inputTokenIds[0] : NONE,
      inputAmount1: actionChoiceInput.inputAmounts.length != 0 && !_anyInputExceedsStandardAmount
        ? uint8(actionChoiceInput.inputAmounts[0])
        : 0,
      inputTokenId2: actionChoiceInput.inputTokenIds.length > 1 ? actionChoiceInput.inputTokenIds[1] : NONE,
      inputAmount2: actionChoiceInput.inputAmounts.length > 1 && !_anyInputExceedsStandardAmount
        ? uint8(actionChoiceInput.inputAmounts[1])
        : 0,
      inputTokenId3: actionChoiceInput.inputTokenIds.length > 2 ? actionChoiceInput.inputTokenIds[2] : NONE,
      inputAmount3: actionChoiceInput.inputAmounts.length > 2 && !_anyInputExceedsStandardAmount
        ? uint8(actionChoiceInput.inputAmounts[2])
        : 0,
      outputTokenId: actionChoiceInput.outputTokenId,
      outputAmount: actionChoiceInput.outputAmount,
      successPercent: actionChoiceInput.successPercent,
      handItemTokenIdRangeMin: actionChoiceInput.handItemTokenIdRangeMin,
      handItemTokenIdRangeMax: actionChoiceInput.handItemTokenIdRangeMax,
      packedData: _packedData,
      reserved: bytes1(uint8(0)),
      // Second storage slot
      minSkill2: actionChoiceInput.minSkills.length > 1 ? actionChoiceInput.minSkills[1] : uint8(Skill.NONE),
      minXP2: actionChoiceInput.minXPs.length > 1 ? actionChoiceInput.minXPs[1] : 0,
      minSkill3: actionChoiceInput.minSkills.length > 2 ? actionChoiceInput.minSkills[2] : uint8(Skill.NONE),
      minXP3: actionChoiceInput.minXPs.length > 2 ? actionChoiceInput.minXPs[2] : 0,
      newInputAmount1: actionChoiceInput.inputAmounts.length != 0 && _anyInputExceedsStandardAmount
        ? actionChoiceInput.inputAmounts[0]
        : 0,
      newInputAmount2: actionChoiceInput.inputAmounts.length > 1 && _anyInputExceedsStandardAmount
        ? actionChoiceInput.inputAmounts[1]
        : 0,
      newInputAmount3: actionChoiceInput.inputAmounts.length > 2 && _anyInputExceedsStandardAmount
        ? actionChoiceInput.inputAmounts[2]
        : 0
    });
  }

  function _fulfillRandomWords(uint256 requestId, uint256[] memory fulfilledRandomWords) internal {
    if (_randomWords[requestId] != 0) {
      revert RequestAlreadyFulfilled();
    }

    if (fulfilledRandomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    uint256 _randomWord = fulfilledRandomWords[0];
    if (_randomWord == 0) {
      // Not sure if 0 can be selected, but in case use previous block hash as pseudo random number
      _randomWord = uint256(blockhash(block.number - 1));
    }

    _randomWords[requestId] = _randomWord;
    if (address(_quests) != address(0)) {
      _quests.newOracleRandomWords(_randomWord);
    }
    if (address(_wishingWell) != address(0)) {
      _wishingWell.newOracleRandomWords(_randomWord);
    }
    emit RequestFulfilledV2(requestId, _randomWord);

    // Are we at the threshold for a new week
    if (_weeklyRewardCheckpoint <= ((block.timestamp) / 1 days) * 1 days) {
      // Issue new daily rewards for each tier based on the new random words
      _thisWeeksRandomWordSegment = bytes8(uint64(_randomWord));

      _weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
    }
  }

  function addActions(Action[] calldata actionsToAdd) external onlyOwner {
    U256 _iter = actionsToAdd.length.asU256();
    while (_iter.neq(0)) {
      _iter = _iter.dec();
      uint16 i = _iter.asUint16();
      _addAction(actionsToAdd[i]);
    }
    emit AddActionsV2(actionsToAdd);
  }

  function editActions(Action[] calldata actionsToEdit) external onlyOwner {
    for (uint256 i = 0; i < actionsToEdit.length; ++i) {
      if (_actions[actionsToEdit[i].actionId].skill.asSkill() == Skill.NONE) {
        revert ActionDoesNotExist();
      }
      _setAction(actionsToEdit[i]);
    }
    emit EditActionsV2(actionsToEdit);
  }

  function addActionChoices(
    uint16 actionId,
    uint16[] calldata actionChoiceIds,
    ActionChoiceInput[] calldata actionChoicesToAdd
  ) public onlyOwner {
    emit AddActionChoicesV4(actionId, actionChoiceIds, actionChoicesToAdd);

    U256 actionChoiceLength = actionChoicesToAdd.length.asU256();
    if (actionChoiceLength.neq(actionChoiceIds.length)) {
      revert LengthMismatch();
    }

    if (actionChoiceIds.length == 0) {
      revert NoActionChoices();
    }

    for (U256 iter; iter < actionChoiceLength; iter = iter.inc()) {
      uint16 i = iter.asUint16();
      _addActionChoice(actionId, actionChoiceIds[i], actionChoicesToAdd[i]);
      // TODO: Could set the first storage slot only in cases where appropriate (same as editing)
      _actionChoices[actionId][actionChoiceIds[i]] = _packActionChoice(actionChoicesToAdd[i]);
    }
  }

  // actionId of 0 means it is not tied to a specific action (combat)
  function addBulkActionChoices(
    uint16[] calldata actionIds,
    uint16[][] calldata actionChoiceIds,
    ActionChoiceInput[][] calldata actionChoicesToAdd
  ) external onlyOwner {
    if (actionIds.length != actionChoicesToAdd.length) {
      revert LengthMismatch();
    }
    if (actionIds.length == 0) {
      revert NoActionChoices();
    }

    U256 _actionIdsLength = actionIds.length.asU256();
    for (U256 iter; iter < _actionIdsLength; iter = iter.inc()) {
      uint16 i = iter.asUint16();
      uint16 actionId = actionIds[i];
      addActionChoices(actionId, actionChoiceIds[i], actionChoicesToAdd[i]);
    }
  }

  function editActionChoices(
    uint16 actionId,
    uint16[] calldata actionChoiceIds,
    ActionChoiceInput[] calldata actionChoicesToEdit
  ) external onlyOwner {
    if (actionChoiceIds.length == 0) {
      revert NoActionChoices();
    }
    if (actionChoiceIds.length != actionChoicesToEdit.length) {
      revert LengthMismatch();
    }

    U256 _actionIdsLength = actionChoiceIds.length.asU256();
    for (U256 iter; iter < _actionIdsLength; iter = iter.inc()) {
      uint16 i = iter.asUint16();
      _editActionChoice(actionId, actionChoiceIds[i], actionChoicesToEdit[i]);
      _actionChoices[actionId][actionChoiceIds[i]] = _packActionChoice(actionChoicesToEdit[i]);
    }

    emit EditActionChoicesV4(actionId, actionChoiceIds, actionChoicesToEdit);
  }

  function removeActionChoices(uint16 actionId, uint16[] calldata actionChoiceIds) external onlyOwner {
    if (actionChoiceIds.length == 0) {
      revert NoActionChoices();
    }

    U256 _length = actionChoiceIds.length.asU256();
    for (U256 iter; iter < _length; iter = iter.inc()) {
      uint16 i = iter.asUint16();
      delete _actionChoices[actionId][actionChoiceIds[i]];
    }
    emit RemoveActionChoicesV2(actionId, actionChoiceIds);
  }

  function setQuests(IOracleRewardCB iOracleRewardCB) external onlyOwner {
    _quests = iOracleRewardCB;
  }

  function setWishingWell(IOracleRewardCB iOracleRewardCB) external onlyOwner {
    _wishingWell = iOracleRewardCB;
  }

  function setDailyRewardPool(uint256 tier, Equipment[] calldata dailyRewards) external onlyOwner {
    if (dailyRewards.length > 255) {
      revert TooManyRewardsInPool();
    }
    delete _dailyRewardPool[tier];

    for (uint256 i = 0; i < dailyRewards.length; ++i) {
      // Amount should be divisible by 10 to allow percentage increases to be applied (like clan bonuses)
      if (dailyRewards[i].itemTokenId == 0 || dailyRewards[i].amount == 0 || dailyRewards[i].amount % 10 != 0) {
        revert InvalidReward();
      }
      _dailyRewardPool[tier].push(dailyRewards[i]);
    }
  }

  function setWeeklyRewardPool(uint256 tier, Equipment[] calldata weeklyRewards) external onlyOwner {
    if (weeklyRewards.length > 255) {
      revert TooManyRewardsInPool();
    }

    delete _weeklyRewardPool[tier];

    for (uint256 i = 0; i < weeklyRewards.length; ++i) {
      if (weeklyRewards[i].itemTokenId == NONE || weeklyRewards[i].amount == 0) {
        revert InvalidReward();
      }
      _weeklyRewardPool[tier].push(weeklyRewards[i]);
    }
  }

  function setCallbackGasLimit(uint256 gasLimit) external onlyOwner {
    if (gasLimit > 3_000_000) {
      revert CallbackGasLimitTooHigh();
    }
    _callbackGasLimit = uint24(gasLimit);
  }

  function setVRF(address _vrf) external onlyOwner {
    _samWitchVRF = ISamWitchVRF(_vrf);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
