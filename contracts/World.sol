// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {WorldLibrary} from "./WorldLibrary.sol";
import {SkillLibrary} from "./libraries/SkillLibrary.sol";
import {IOracleRewardCB} from "./interfaces/IOracleRewardCB.sol";
import {ISamWitchVRF} from "./interfaces/ISamWitchVRF.sol";
import {IWorld} from "./interfaces/IWorld.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

contract World is UUPSUpgradeable, OwnableUpgradeable, IWorld {
  using SkillLibrary for uint8;
  using SkillLibrary for Skill;

  event RequestSent(uint256 requestId, uint256 numWords, uint256 lastRandomWordsUpdatedTime);
  event RequestFulfilled(uint256 requestId, uint256 randomWord);
  event AddActions(Action[] actions);
  event EditActions(Action[] actions);
  event AddActionChoices(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInput[] choices);
  event EditActionChoices(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInput[] choices);
  event RemoveActionChoices(uint16 actionId, uint16[] actionChoiceIds);

  error RandomWordsCannotBeUpdatedYet();
  error CanOnlyRequestAfterTheNextCheckpoint(uint256 currentTime, uint256 checkpoint);
  error RequestAlreadyFulfilled();
  error NoValidRandomWord();
  error CanOnlyRequestAfter1DayHasPassed();
  error ActionIdZeroNotAllowed();
  error MinCannotBeGreaterThanMax();
  error ActionAlreadyExists(uint16 actionId);
  error ActionDoesNotExist();
  error ActionChoiceIdZeroNotAllowed();
  error LengthMismatch();
  error NoActionChoices();
  error ActionChoiceAlreadyExists();
  error ActionChoiceDoesNotExist();
  error NotAFactorOf3600();
  error NonCombatWithActionChoicesCannotHaveBothGuaranteedAndRandomRewards();
  error InvalidReward();
  error TooManyRewardsInPool();
  error CallbackGasLimitTooHigh();
  error CallerNotSamWitchVRF();

  uint256 private constant NUM_WORDS = 1;
  uint256 public constant MIN_RANDOM_WORDS_UPDATE_TIME = 1 days;
  uint256 public constant NUM_DAYS_RANDOM_WORDS_INITIALIZED = 3;

  uint256[] private _requestIds; // Each one is a set of random words for 1 day
  mapping(uint256 requestId => uint256 randomWord) private _randomWords;
  uint40 private _lastRandomWordsUpdatedTime;
  uint40 private _startTime;
  uint40 private _weeklyRewardCheckpoint;
  bytes8 private _thisWeeksRandomWordSegment; // Every 8 bits is a random segment for the day
  uint24 private _expectedGasLimitFulfill;
  ISamWitchVRF private _samWitchVRF;
  IOracleRewardCB private _wishingWell;

  mapping(uint256 actionId => ActionInfo actionInfo) private _actions;

  mapping(uint256 actionId => mapping(uint16 choiceId => ActionChoice actionChoice)) private _actionChoices;
  mapping(uint256 actionId => CombatStats combatStats) private _actionCombatStats;

  mapping(uint256 actionId => ActionRewards actionRewards) private _actionRewards;

  mapping(uint256 tier => Equipment[]) private _dailyRewardPool;
  mapping(uint256 tier => Equipment[]) private _weeklyRewardPool;

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    require(_msgSender() == address(_samWitchVRF), CallerNotSamWitchVRF());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address vrf) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    uint40 startTime = uint40(
      (block.timestamp / MIN_RANDOM_WORDS_UPDATE_TIME) *
        MIN_RANDOM_WORDS_UPDATE_TIME -
        (NUM_DAYS_RANDOM_WORDS_INITIALIZED + 1) *
        1 days
    );
    _startTime = startTime; // Floor to the nearest day 00:00 UTC
    _lastRandomWordsUpdatedTime = uint40(startTime + NUM_DAYS_RANDOM_WORDS_INITIALIZED * 1 days);
    _weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
    _expectedGasLimitFulfill = 600_000;
    _samWitchVRF = ISamWitchVRF(vrf);

    // Initialize a few days worth of random words so that we have enough data to fetch the first day
    for (uint256 i; i < NUM_DAYS_RANDOM_WORDS_INITIALIZED; ++i) {
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
    require(
      _requestIds.length == 0 || _randomWords[_requestIds[_requestIds.length - 1]] != 0,
      RandomWordsCannotBeUpdatedYet()
    );
    uint40 newLastRandomWordsUpdatedTime = uint40(_lastRandomWordsUpdatedTime + MIN_RANDOM_WORDS_UPDATE_TIME);
    require(
      newLastRandomWordsUpdatedTime <= block.timestamp,
      CanOnlyRequestAfterTheNextCheckpoint(block.timestamp, newLastRandomWordsUpdatedTime)
    );

    requestId = uint256(_samWitchVRF.requestRandomWords(NUM_WORDS, _expectedGasLimitFulfill));
    _requestIds.push(requestId);
    _lastRandomWordsUpdatedTime = newLastRandomWordsUpdatedTime;
    emit RequestSent(requestId, NUM_WORDS, newLastRandomWordsUpdatedTime);
    return requestId;
  }

  function fulfillRandomWords(bytes32 requestId, uint256[] memory words) external onlySamWitchVRF {
    _fulfillRandomWords(uint256(requestId), words);
  }

  function getWeeklyReward(uint256 tier, uint256 playerId) public view returns (uint16 itemTokenId, uint24 amount) {
    uint256 day = 7;
    uint256 index = _getRewardIndex(playerId, day, uint64(_thisWeeksRandomWordSegment), _weeklyRewardPool[tier].length);
    Equipment storage equipment = _weeklyRewardPool[tier][index];
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
    require(randomWord != 0, NoValidRandomWord());
  }

  function getMultipleWords(uint256 timestamp) public view returns (uint256[4] memory words) {
    for (uint256 i; i < 4; ++i) {
      words[i] = getRandomWord(timestamp - (i * 1 days));
    }
  }

  function getSkill(uint256 actionId) external view returns (Skill) {
    return _actions[actionId].skill._asSkill();
  }

  function getActionRewards(uint256 actionId) external view returns (ActionRewards memory) {
    return _actionRewards[actionId];
  }

  function getActionInfo(uint256 actionId) external view returns (ActionInfo memory info) {
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

  function getThisWeeksRandomWordSegment() external view returns (bytes8) {
    return _thisWeeksRandomWordSegment;
  }

  function getRewardsHelper(
    uint16 actionId
  ) external view returns (ActionRewards memory, Skill skill, uint256 numSpanwed, uint8 worldLocation) {
    return (
      _actionRewards[actionId],
      _actions[actionId].skill._asSkill(),
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
      for (uint256 i; i < 4; ++i) {
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
    require(_actions[action.actionId].skill._asSkill() == Skill.NONE, ActionAlreadyExists(action.actionId));
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
    require(action.actionId != 0, ActionIdZeroNotAllowed());
    require(action.info.handItemTokenIdRangeMin <= action.info.handItemTokenIdRangeMax, MinCannotBeGreaterThanMax());

    if (action.info.numSpawned != 0) {
      // Combat
      require((3600 * SPAWN_MUL) % action.info.numSpawned == 0, NotAFactorOf3600());
    } else if (action.guaranteedRewards.length != 0) {
      // Non-combat guaranteed rewards. Only care about the first one as it's used for correctly taking into account partial loots.
      require((3600 * GUAR_MUL) % action.guaranteedRewards[0].rate == 0, NotAFactorOf3600());
    }

    _actions[action.actionId] = action.info;

    // Set the rewards
    ActionRewards storage _actionReward = _actionRewards[action.actionId];
    delete _actionRewards[action.actionId];
    WorldLibrary.setActionGuaranteedRewards(action.guaranteedRewards, _actionReward);
    WorldLibrary.setActionRandomRewards(action.randomRewards, _actionReward);

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

  function _checkAddActionChoice(
    uint16 actionId,
    uint16 actionChoiceId,
    ActionChoiceInput calldata actionChoiceInput
  ) private view {
    require(actionChoiceId != 0, ActionChoiceIdZeroNotAllowed());
    require(_actionChoices[actionId][actionChoiceId].skill._isSkillNone(), ActionChoiceAlreadyExists());
    WorldLibrary.checkActionChoice(actionChoiceInput);
  }

  function _checkEditActionChoice(
    uint16 actionId,
    uint16 actionChoiceId,
    ActionChoiceInput calldata actionChoiceInput
  ) private view {
    require(Skill(_actionChoices[actionId][actionChoiceId].skill) != Skill.NONE, ActionChoiceDoesNotExist());

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

  function _fulfillRandomWords(uint256 requestId, uint256[] memory fulfilledRandomWords) internal {
    require(_randomWords[requestId] == 0, RequestAlreadyFulfilled());
    require(fulfilledRandomWords.length == NUM_WORDS, LengthMismatch());

    uint256 _randomWord = fulfilledRandomWords[0];
    if (_randomWord == 0) {
      // Not sure if 0 can be selected, but in case use previous block hash as pseudo random number
      _randomWord = uint256(blockhash(block.number - 1));
    }

    _randomWords[requestId] = _randomWord;
    if (address(_wishingWell) != address(0)) {
      _wishingWell.newOracleRandomWords(_randomWord);
    }
    emit RequestFulfilled(requestId, _randomWord);

    // Are we at the threshold for a new week
    if (_weeklyRewardCheckpoint <= ((block.timestamp) / 1 days) * 1 days) {
      // Issue new daily rewards for each tier based on the new random words
      _thisWeeksRandomWordSegment = bytes8(uint64(_randomWord));

      _weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
    }
  }

  function addActions(Action[] calldata actionsToAdd) external onlyOwner {
    for (uint256 i = 0; i < actionsToAdd.length; ++i) {
      _addAction(actionsToAdd[i]);
    }
    emit AddActions(actionsToAdd);
  }

  function editActions(Action[] calldata actionsToEdit) external onlyOwner {
    for (uint256 i = 0; i < actionsToEdit.length; ++i) {
      require(_actions[actionsToEdit[i].actionId].skill._asSkill() != Skill.NONE, ActionDoesNotExist());
      _setAction(actionsToEdit[i]);
    }
    emit EditActions(actionsToEdit);
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

  function setWishingWell(IOracleRewardCB iOracleRewardCB) external onlyOwner {
    _wishingWell = iOracleRewardCB;
  }

  function setDailyRewardPool(uint256 tier, Equipment[] calldata dailyRewards) external onlyOwner {
    require(dailyRewards.length <= 255, TooManyRewardsInPool());
    delete _dailyRewardPool[tier];

    for (uint256 i = 0; i < dailyRewards.length; ++i) {
      // Amount should be divisible by 10 to allow percentage increases to be applied (like clan bonuses)
      require(
        dailyRewards[i].itemTokenId != 0 && dailyRewards[i].amount != 0 && dailyRewards[i].amount % 10 == 0,
        InvalidReward()
      );
      _dailyRewardPool[tier].push(dailyRewards[i]);
    }
  }

  function setWeeklyRewardPool(uint256 tier, Equipment[] calldata weeklyRewards) external onlyOwner {
    require(weeklyRewards.length <= 255, TooManyRewardsInPool());

    delete _weeklyRewardPool[tier];

    for (uint256 i = 0; i < weeklyRewards.length; ++i) {
      require(weeklyRewards[i].itemTokenId != NONE && weeklyRewards[i].amount != 0, InvalidReward());
      _weeklyRewardPool[tier].push(weeklyRewards[i]);
    }
  }

  function setExpectedGasLimitFulfill(uint256 gasLimit) external onlyOwner {
    require(gasLimit <= 3_000_000, CallbackGasLimitTooHigh());
    _expectedGasLimitFulfill = uint24(gasLimit);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
