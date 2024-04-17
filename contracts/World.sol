// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {VRFConsumerBaseV2Upgradeable} from "./VRFConsumerBaseV2Upgradeable.sol";

import {WorldLibrary} from "./WorldLibrary.sol";
import {IOracleRewardCB} from "./interfaces/IOracleRewardCB.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

contract World is VRFConsumerBaseV2Upgradeable, UUPSUpgradeable, OwnableUpgradeable {
  using UnsafeMath for U256;
  using UnsafeMath for uint;

  event RequestSent(uint requestId, uint32 numWords, uint lastRandomWordsUpdatedTime);
  event RequestFulfilledV2(uint requestId, uint randomWord);
  event AddActionsV2(Action[] actions);
  event EditActionsV2(Action[] actions);
  event AddDynamicActions(uint16[] actionIds);
  event RemoveDynamicActions(uint16[] actionIds);
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
  event RequestFulfilled(uint requestId, uint[3] randomWords);

  error RandomWordsCannotBeUpdatedYet();
  error CanOnlyRequestAfterTheNextCheckpoint(uint currentTime, uint checkpoint);
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
  error OnlyCombatMultipleGuaranteedRewards();
  error NotAFactorOf3600();
  error NonCombatCannotHaveBothGuaranteedAndRandomRewards();
  error InvalidReward();
  error TooManyRewardsInPool();
  error CallbackGasLimitTooHigh();

  // solhint-disable-next-line var-name-mixedcase
  VRFCoordinatorV2Interface private COORDINATOR;

  // Your subscription ID.
  uint64 private subscriptionId;

  // Past request ids
  uint[] public requestIds; // Each one is a set of random words for 1 day
  mapping(uint requestId => uint randomWord) public randomWords;
  uint40 public lastRandomWordsUpdatedTime;
  uint40 private startTime;
  uint40 private weeklyRewardCheckpoint;
  bytes8 public thisWeeksRandomWordSegment; // Every 8 bits is a random segment for the day
  uint24 private callbackGasLimit;

  // The gas lane to use, which specifies the maximum gas price to bump to.
  // For a list of available gas lanes on each network, this is 10000gwei
  // see https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/#configurations
  bytes32 private constant KEY_HASH = 0x5881eea62f9876043df723cf89f0c2bb6f950da25e9dfe66995c24f919c8f8ab;

  uint16 private constant REQUEST_CONFIRMATIONS = 1;
  // Cannot exceed VRFCoordinatorV2.MAX_NUM_WORDS.
  uint32 private constant NUM_WORDS = 1;

  uint32 public constant MIN_RANDOM_WORDS_UPDATE_TIME = 1 days;
  uint32 private constant MIN_DYNAMIC_ACTION_UPDATE_TIME = 1 days;

  uint32 public constant NUM_DAYS_RANDOM_WORDS_INITIALIZED = 3;

  mapping(uint actionId => ActionInfo actionInfo) public actions;
  uint16[] private lastAddedDynamicActions;
  uint private lastDynamicUpdatedTime;

  /// @custom:oz-renamed-from dailyRewards
  bytes32 dummy; // Not clean

  mapping(uint actionId => mapping(uint16 choiceId => ActionChoice actionChoice)) private actionChoices;
  mapping(uint actionId => CombatStats combatStats) private actionCombatStats;

  mapping(uint actionId => ActionRewards actionRewards) private actionRewards;

  IOracleRewardCB private quests;

  mapping(uint tier => Equipment[]) public dailyRewardPool;
  mapping(uint tier => Equipment[]) public weeklyRewardPool;

  IOracleRewardCB private wishingWell;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(VRFCoordinatorV2Interface _coordinator, uint64 _subscriptionId) external initializer {
    __VRFConsumerBaseV2_init(address(_coordinator));
    __UUPSUpgradeable_init();
    __Ownable_init();

    COORDINATOR = _coordinator;
    subscriptionId = _subscriptionId;
    startTime = uint40(
      (block.timestamp / MIN_RANDOM_WORDS_UPDATE_TIME) *
        MIN_RANDOM_WORDS_UPDATE_TIME -
        (NUM_DAYS_RANDOM_WORDS_INITIALIZED + 1) *
        1 days
    ); // Floor to the nearest day 00:00 UTC
    lastRandomWordsUpdatedTime = uint40(startTime + NUM_DAYS_RANDOM_WORDS_INITIALIZED * 1 days);
    weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
    callbackGasLimit = 600_000;

    // Initialize a few days worth of random words so that we have enough data to fetch the first day
    for (U256 iter; iter.lt(NUM_DAYS_RANDOM_WORDS_INITIALIZED); iter = iter.inc()) {
      uint i = iter.asUint256();
      uint requestId = 200 + i;
      requestIds.push(requestId);
      emit RequestSent(requestId, NUM_WORDS, startTime + (i * 1 days) + 1 days);
      uint[] memory _randomWords = new uint[](1);
      _randomWords[0] = uint(
        blockhash(block.number - NUM_DAYS_RANDOM_WORDS_INITIALIZED + i) ^
          0x3632d8eba811d69784e6904a58de6e0ab55f32638189623b309895beaa6920c4
      );
      fulfillRandomWords(requestId, _randomWords);
    }

    thisWeeksRandomWordSegment = bytes8(uint64(randomWords[0]));
  }

  function requestRandomWords() external returns (uint requestId) {
    // Last one has not been fulfilled yet
    if (requestIds.length != 0 && randomWords[requestIds[requestIds.length - 1]] == 0) {
      revert RandomWordsCannotBeUpdatedYet();
    }
    uint40 newLastRandomWordsUpdatedTime = lastRandomWordsUpdatedTime + MIN_RANDOM_WORDS_UPDATE_TIME;
    if (newLastRandomWordsUpdatedTime > block.timestamp) {
      revert CanOnlyRequestAfterTheNextCheckpoint(block.timestamp, newLastRandomWordsUpdatedTime);
    }

    // Will revert if subscription is not set and funded.
    requestId = COORDINATOR.requestRandomWords(
      KEY_HASH,
      subscriptionId,
      REQUEST_CONFIRMATIONS,
      callbackGasLimit,
      NUM_WORDS
    );

    requestIds.push(requestId);
    lastRandomWordsUpdatedTime = newLastRandomWordsUpdatedTime;
    emit RequestSent(requestId, NUM_WORDS, newLastRandomWordsUpdatedTime);
    return requestId;
  }

  function fulfillRandomWords(uint _requestId, uint[] memory _randomWords) internal override {
    if (randomWords[_requestId] != 0) {
      revert RequestAlreadyFulfilled();
    }

    if (_randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    uint randomWord = _randomWords[0];
    if (randomWord == 0) {
      // Not sure if 0 can be selected, but in case use previous block hash as pseudo random number
      randomWord = uint(blockhash(block.number - 1));
    }

    randomWords[_requestId] = randomWord;
    if (address(quests) != address(0)) {
      quests.newOracleRandomWords(randomWord);
    }
    if (address(wishingWell) != address(0)) {
      wishingWell.newOracleRandomWords(randomWord);
    }
    emit RequestFulfilledV2(_requestId, randomWord);

    // Are we at the threshold for a new week
    if (weeklyRewardCheckpoint <= ((block.timestamp) / 1 days) * 1 days) {
      // Issue new daily rewards for each tier based on the new random words
      thisWeeksRandomWordSegment = bytes8(uint64(randomWord));

      weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
    }
  }

  function getWeeklyReward(uint _tier, uint _playerId) public view returns (uint16 itemTokenId, uint24 amount) {
    uint day = 7;
    uint index = _getRewardIndex(_playerId, day, uint64(thisWeeksRandomWordSegment), weeklyRewardPool[_tier].length);
    Equipment storage equipment = weeklyRewardPool[_tier][index];
    return (equipment.itemTokenId, equipment.amount);
  }

  function getSpecificDailyReward(
    uint _tier,
    uint _playerId,
    uint _day,
    uint _randomWord
  ) public view returns (uint16 itemTokenId, uint24 amount) {
    uint index = _getRewardIndex(_playerId, _day, _randomWord, dailyRewardPool[_tier].length);
    Equipment storage equipment = dailyRewardPool[_tier][index];
    return (equipment.itemTokenId, equipment.amount);
  }

  function getDailyReward(uint _tier, uint _playerId) external view returns (uint itemTokenId, uint amount) {
    uint checkpoint = ((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days;
    uint day = ((block.timestamp / 1 days) * 1 days - checkpoint) / 1 days;
    return getSpecificDailyReward(_tier, _playerId, day, uint64(thisWeeksRandomWordSegment));
  }

  function getActiveDailyAndWeeklyRewards(
    uint _tier,
    uint _playerId
  ) external view returns (Equipment[8] memory rewards) {
    for (uint i; i < 7; ++i) {
      (rewards[i].itemTokenId, rewards[i].amount) = getSpecificDailyReward(
        _tier,
        _playerId,
        i,
        uint64(thisWeeksRandomWordSegment)
      );
    }
    (rewards[7].itemTokenId, rewards[7].amount) = getWeeklyReward(_tier, _playerId);
  }

  function _getRandomWordOffset(uint _timestamp) private view returns (int) {
    if (_timestamp < startTime) {
      return -1;
    }
    return int((_timestamp - startTime) / MIN_RANDOM_WORDS_UPDATE_TIME);
  }

  function _getRandomWord(uint _timestamp) private view returns (uint) {
    int offset = _getRandomWordOffset(_timestamp);
    if (offset < 0 || requestIds.length <= uint(offset)) {
      return 0;
    }
    return randomWords[requestIds[uint(offset)]];
  }

  function hasRandomWord(uint _timestamp) external view returns (bool) {
    return _getRandomWord(_timestamp) != 0;
  }

  function getRandomWord(uint _timestamp) public view returns (uint randomWord) {
    randomWord = _getRandomWord(_timestamp);
    if (randomWord == 0) {
      revert NoValidRandomWord();
    }
  }

  function getMultipleWords(uint _timestamp) public view returns (uint[4] memory words) {
    for (U256 iter; iter.lt(4); iter = iter.inc()) {
      uint i = iter.asUint256();
      words[i] = getRandomWord(_timestamp - (i * 1 days));
    }
  }

  function getSkill(uint _actionId) external view returns (Skill) {
    return actions[_actionId].skill;
  }

  function getActionRewards(uint _actionId) external view returns (ActionRewards memory) {
    return actionRewards[_actionId];
  }

  // TODO Delete after upgrading the player impls
  function getPermissibleItemsForAction(
    uint _actionId
  )
    external
    view
    returns (
      uint16 handItemTokenIdRangeMin,
      uint16 handItemTokenIdRangeMax,
      bool actionChoiceRequired,
      Skill skill,
      uint32 minXP,
      bool actionAvailable
    )
  {
    ActionInfo storage actionInfo = actions[_actionId];
    return (
      actionInfo.handItemTokenIdRangeMin,
      actionInfo.handItemTokenIdRangeMax,
      actionInfo.actionChoiceRequired,
      actionInfo.skill,
      actionInfo.minXP,
      actionInfo.isAvailable
    );
  }

  function getActionInfo(uint _actionId) external view returns (ActionInfo memory info) {
    return actions[_actionId];
  }

  function getXPPerHour(uint16 _actionId, uint16 _actionChoiceId) external view returns (uint24 xpPerHour) {
    return _actionChoiceId != 0 ? actionChoices[_actionId][_actionChoiceId].xpPerHour : actions[_actionId].xpPerHour;
  }

  function getNumSpawn(uint16 _actionId) external view returns (uint numSpawned) {
    return actions[_actionId].numSpawned;
  }

  function getCombatStats(uint16 _actionId) external view returns (CombatStats memory stats) {
    stats = actionCombatStats[_actionId];
  }

  function getActionChoice(uint16 _actionId, uint16 _choiceId) external view returns (ActionChoice memory choice) {
    ActionChoice storage actionChoice = actionChoices[_actionId][_choiceId];
    choice.skill = actionChoice.skill;
    choice.minXP = actionChoice.minXP;
    choice.skillDiff = actionChoice.skillDiff;
    choice.rate = actionChoice.rate;
    choice.xpPerHour = actionChoice.xpPerHour;
    choice.inputTokenId1 = actionChoice.inputTokenId1;
    choice.inputAmount1 = actionChoice.inputAmount1;
    choice.inputTokenId2 = actionChoice.inputTokenId2;
    choice.inputAmount2 = actionChoice.inputAmount2;
    choice.inputTokenId3 = actionChoice.inputTokenId3;
    choice.inputAmount3 = actionChoice.inputAmount3;
    choice.outputTokenId = actionChoice.outputTokenId;
    choice.outputAmount = actionChoice.outputAmount;
    choice.successPercent = actionChoice.successPercent;
    choice.handItemTokenIdRangeMin = actionChoice.handItemTokenIdRangeMin;
    choice.handItemTokenIdRangeMax = actionChoice.handItemTokenIdRangeMax;
    choice.packedData = actionChoice.packedData;
    // Only read second storage when needed
    if (
      (uint8(choice.packedData >> ACTION_CHOICE_USE_NEW_MIN_SKILL_SECOND_STORAGE_SLOT_BIT) & 1 == 1) ||
      (uint8(choice.packedData >> ACTION_CHOICE_USE_ALTERNATE_INPUTS_SECOND_STORAGE_SLOT) & 1 == 1)
    ) {
      choice.minSkill2 = actionChoice.minSkill2;
      choice.minXP2 = actionChoice.minXP2;
      choice.minSkill3 = actionChoice.minSkill3;
      choice.minXP3 = actionChoice.minXP3;

      choice.newInputAmount1 = actionChoice.newInputAmount1;
      choice.newInputAmount2 = actionChoice.newInputAmount2;
      choice.newInputAmount3 = actionChoice.newInputAmount3;
    }
  }

  function getActionSuccessPercentAndMinXP(
    uint16 _actionId
  ) external view returns (uint8 successPercent, uint32 minXP) {
    return (actions[_actionId].successPercent, actions[_actionId].minXP);
  }

  function getRewardsHelper(
    uint16 _actionId
  ) external view returns (ActionRewards memory, Skill skill, uint numSpanwed, uint8 worldLocation) {
    return (
      actionRewards[_actionId],
      actions[_actionId].skill,
      actions[_actionId].numSpawned,
      actions[_actionId].worldLocation
    );
  }

  function getRandomBytes(uint _numTickets, uint _timestamp, uint _playerId) external view returns (bytes memory b) {
    if (_numTickets <= 16) {
      // 32 bytes
      bytes32 word = bytes32(getRandomWord(_timestamp));
      b = abi.encodePacked(_getRandomComponent(word, _timestamp, _playerId));
    } else if (_numTickets <= MAX_UNIQUE_TICKETS_) {
      // 4 * 32 bytes
      uint[4] memory multipleWords = getMultipleWords(_timestamp);
      for (U256 iter; iter.lt(4); iter = iter.inc()) {
        uint i = iter.asUint256();
        multipleWords[i] = uint(_getRandomComponent(bytes32(multipleWords[i]), _timestamp, _playerId));
        // XOR all the words with the first fresh random number to give more randomness to the existing random words
        if (i != 0) {
          multipleWords[i] = uint(keccak256(abi.encodePacked(multipleWords[i] ^ multipleWords[0])));
        }
      }
      b = abi.encodePacked(multipleWords);
    } else {
      assert(false);
    }
  }

  function _addAction(Action calldata _action) private {
    if (_action.info.isDynamic) {
      revert DynamicActionsCannotBeAdded();
    }
    if (actions[_action.actionId].skill != Skill.NONE) {
      revert ActionAlreadyExists(_action.actionId);
    }
    _setAction(_action);
  }

  function _getRewardIndex(uint _playerId, uint _day, uint _randomWord, uint _length) private pure returns (uint) {
    return uint(keccak256(abi.encodePacked(_randomWord, _playerId)) >> (_day * 8)) % _length;
  }

  function _setAction(Action calldata _action) private {
    if (_action.actionId == 0) {
      revert ActionIdZeroNotAllowed();
    }
    if (_action.info.handItemTokenIdRangeMin > _action.info.handItemTokenIdRangeMax) {
      revert MinCannotBeGreaterThanMax();
    }

    if (_action.info.skill != Skill.COMBAT && _action.guaranteedRewards.length > 1) {
      revert OnlyCombatMultipleGuaranteedRewards();
    }

    if (_action.info.numSpawned != 0) {
      // Combat
      if ((3600 * SPAWN_MUL) % _action.info.numSpawned != 0) {
        revert NotAFactorOf3600();
      }
    } else if (_action.guaranteedRewards.length != 0) {
      // Non-combat guaranteed rewards
      if ((3600 * GUAR_MUL) % _action.guaranteedRewards[0].rate != 0) {
        revert NotAFactorOf3600();
      }
    }

    actions[_action.actionId] = _action.info;

    // Set the rewards
    ActionRewards storage actionReward = actionRewards[_action.actionId];
    delete actionRewards[_action.actionId];
    WorldLibrary.setActionGuaranteedRewards(_action.guaranteedRewards, actionReward);
    WorldLibrary.setActionRandomRewards(_action.randomRewards, actionReward);

    if (_action.info.skill == Skill.COMBAT) {
      actionCombatStats[_action.actionId] = _action.combatStats;
    } else {
      bool actionHasGuaranteedRewards = _action.guaranteedRewards.length != 0;
      bool actionHasRandomRewards = _action.randomRewards.length != 0;
      if (actionHasGuaranteedRewards && actionHasRandomRewards) {
        revert NonCombatCannotHaveBothGuaranteedAndRandomRewards();
      }
    }
  }

  function _addActionChoice(
    uint16 _actionId,
    uint16 _actionChoiceId,
    ActionChoiceInput calldata _actionChoiceInput
  ) private view {
    if (_actionChoiceId == 0) {
      revert ActionChoiceIdZeroNotAllowed();
    }
    if (actionChoices[_actionId][_actionChoiceId].skill != Skill.NONE) {
      revert ActionChoiceAlreadyExists();
    }
    WorldLibrary.checkActionChoice(_actionChoiceInput);
  }

  function _editActionChoice(
    uint16 _actionId,
    uint16 _actionChoiceId,
    ActionChoiceInput calldata _actionChoiceInput
  ) private view {
    if (actionChoices[_actionId][_actionChoiceId].skill == Skill.NONE) {
      revert ActionChoiceDoesNotExist();
    }

    WorldLibrary.checkActionChoice(_actionChoiceInput);
  }

  function _getRandomComponent(bytes32 _word, uint _skillEndTime, uint _playerId) private pure returns (bytes32) {
    return keccak256(abi.encodePacked(_word, _skillEndTime, _playerId));
  }

  function _packActionChoice(
    ActionChoiceInput calldata _actionChoiceInput
  ) private pure returns (ActionChoice memory actionChoice) {
    bytes1 packedData = bytes1(uint8(_actionChoiceInput.isFullModeOnly ? 1 << IS_FULL_MODE_BIT : 0));
    if (_actionChoiceInput.minSkills.length > 1) {
      packedData |= bytes1(uint8(1)) << ACTION_CHOICE_USE_NEW_MIN_SKILL_SECOND_STORAGE_SLOT_BIT;
    }

    bool anyInputExceedsStandardAmount = (_actionChoiceInput.inputAmounts.length > 0 &&
      _actionChoiceInput.inputAmounts[0] > 255) ||
      (_actionChoiceInput.inputAmounts.length > 1 && _actionChoiceInput.inputAmounts[1] > 255) ||
      (_actionChoiceInput.inputAmounts.length > 2 && _actionChoiceInput.inputAmounts[2] > 255);

    if (anyInputExceedsStandardAmount) {
      packedData |= bytes1(uint8(1)) << ACTION_CHOICE_USE_ALTERNATE_INPUTS_SECOND_STORAGE_SLOT;
    }

    actionChoice = ActionChoice({
      skill: _actionChoiceInput.skill,
      minXP: _actionChoiceInput.minXPs.length != 0 ? _actionChoiceInput.minXPs[0] : 0,
      skillDiff: _actionChoiceInput.skillDiff,
      rate: _actionChoiceInput.rate,
      xpPerHour: _actionChoiceInput.xpPerHour,
      inputTokenId1: _actionChoiceInput.inputTokenIds.length > 0 ? _actionChoiceInput.inputTokenIds[0] : NONE,
      inputAmount1: _actionChoiceInput.inputAmounts.length > 0 && !anyInputExceedsStandardAmount
        ? uint8(_actionChoiceInput.inputAmounts[0])
        : 0,
      inputTokenId2: _actionChoiceInput.inputTokenIds.length > 1 ? _actionChoiceInput.inputTokenIds[1] : NONE,
      inputAmount2: _actionChoiceInput.inputAmounts.length > 1 && !anyInputExceedsStandardAmount
        ? uint8(_actionChoiceInput.inputAmounts[1])
        : 0,
      inputTokenId3: _actionChoiceInput.inputTokenIds.length > 2 ? _actionChoiceInput.inputTokenIds[2] : NONE,
      inputAmount3: _actionChoiceInput.inputAmounts.length > 2 && !anyInputExceedsStandardAmount
        ? uint8(_actionChoiceInput.inputAmounts[2])
        : 0,
      outputTokenId: _actionChoiceInput.outputTokenId,
      outputAmount: _actionChoiceInput.outputAmount,
      successPercent: _actionChoiceInput.successPercent,
      handItemTokenIdRangeMin: _actionChoiceInput.handItemTokenIdRangeMin,
      handItemTokenIdRangeMax: _actionChoiceInput.handItemTokenIdRangeMax,
      packedData: packedData,
      reserved: bytes1(uint8(0)),
      // Second storage slot
      minSkill2: _actionChoiceInput.minSkills.length > 1 ? _actionChoiceInput.minSkills[1] : Skill.NONE,
      minXP2: _actionChoiceInput.minXPs.length > 1 ? _actionChoiceInput.minXPs[1] : 0,
      minSkill3: _actionChoiceInput.minSkills.length > 2 ? _actionChoiceInput.minSkills[2] : Skill.NONE,
      minXP3: _actionChoiceInput.minXPs.length > 2 ? _actionChoiceInput.minXPs[2] : 0,
      newInputAmount1: _actionChoiceInput.inputAmounts.length > 0 && anyInputExceedsStandardAmount
        ? _actionChoiceInput.inputAmounts[0]
        : 0,
      newInputAmount2: _actionChoiceInput.inputAmounts.length > 1 && anyInputExceedsStandardAmount
        ? _actionChoiceInput.inputAmounts[1]
        : 0,
      newInputAmount3: _actionChoiceInput.inputAmounts.length > 2 && anyInputExceedsStandardAmount
        ? _actionChoiceInput.inputAmounts[2]
        : 0
    });
  }

  function addActions(Action[] calldata _actions) external onlyOwner {
    U256 iter = _actions.length.asU256();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      _addAction(_actions[i]);
    }
    emit AddActionsV2(_actions);
  }

  function editActions(Action[] calldata _actions) external onlyOwner {
    for (uint i = 0; i < _actions.length; ++i) {
      if (actions[_actions[i].actionId].skill == Skill.NONE) {
        revert ActionDoesNotExist();
      }
      _setAction(_actions[i]);
    }
    emit EditActionsV2(_actions);
  }

  function addActionChoices(
    uint16 _actionId,
    uint16[] calldata _actionChoiceIds,
    ActionChoiceInput[] calldata _actionChoices
  ) public onlyOwner {
    emit AddActionChoicesV4(_actionId, _actionChoiceIds, _actionChoices);

    U256 actionChoiceLength = _actionChoices.length.asU256();
    if (actionChoiceLength.neq(_actionChoiceIds.length)) {
      revert LengthMismatch();
    }

    if (_actionChoiceIds.length == 0) {
      revert NoActionChoices();
    }

    for (U256 iter; iter < actionChoiceLength; iter = iter.inc()) {
      uint16 i = iter.asUint16();
      _addActionChoice(_actionId, _actionChoiceIds[i], _actionChoices[i]);
      // TODO: Could set the first storage slot only in cases where appropriate (same as editing)
      actionChoices[_actionId][_actionChoiceIds[i]] = _packActionChoice(_actionChoices[i]);
    }
  }

  // actionId of 0 means it is not tied to a specific action (combat)
  function addBulkActionChoices(
    uint16[] calldata _actionIds,
    uint16[][] calldata _actionChoiceIds,
    ActionChoiceInput[][] calldata _actionChoices
  ) external onlyOwner {
    if (_actionIds.length != _actionChoices.length) {
      revert LengthMismatch();
    }
    if (_actionIds.length == 0) {
      revert NoActionChoices();
    }

    U256 actionIdsLength = _actionIds.length.asU256();
    for (U256 iter; iter < actionIdsLength; iter = iter.inc()) {
      uint16 i = iter.asUint16();
      uint16 actionId = _actionIds[i];
      addActionChoices(actionId, _actionChoiceIds[i], _actionChoices[i]);
    }
  }

  function editActionChoices(
    uint16 _actionId,
    uint16[] calldata _actionChoiceIds,
    ActionChoiceInput[] calldata _actionChoices
  ) external onlyOwner {
    if (_actionChoiceIds.length == 0) {
      revert NoActionChoices();
    }
    if (_actionChoiceIds.length != _actionChoices.length) {
      revert LengthMismatch();
    }

    U256 actionIdsLength = _actionChoiceIds.length.asU256();
    for (U256 iter; iter < actionIdsLength; iter = iter.inc()) {
      uint16 i = iter.asUint16();
      _editActionChoice(_actionId, _actionChoiceIds[i], _actionChoices[i]);
      actionChoices[_actionId][_actionChoiceIds[i]] = _packActionChoice(_actionChoices[i]);
    }

    emit EditActionChoicesV4(_actionId, _actionChoiceIds, _actionChoices);
  }

  function removeActionChoices(uint16 _actionId, uint16[] calldata _actionChoiceIds) external onlyOwner {
    if (_actionChoiceIds.length == 0) {
      revert NoActionChoices();
    }

    U256 length = _actionChoiceIds.length.asU256();
    for (U256 iter; iter < length; iter = iter.inc()) {
      uint16 i = iter.asUint16();
      delete actionChoices[_actionId][_actionChoiceIds[i]];
    }
    emit RemoveActionChoicesV2(_actionId, _actionChoiceIds);
  }

  function setQuests(IOracleRewardCB _quests) external onlyOwner {
    quests = _quests;
  }

  function setWishingWell(IOracleRewardCB _wishingWell) external onlyOwner {
    wishingWell = _wishingWell;
  }

  function setDailyRewardPool(uint _tier, Equipment[] calldata _dailyRewards) external onlyOwner {
    if (_dailyRewards.length > 255) {
      revert TooManyRewardsInPool();
    }
    delete dailyRewardPool[_tier];

    for (uint i = 0; i < _dailyRewards.length; ++i) {
      // Amount should be divisible by 10 to allow percentage increases to be applied (like clan bonuses)
      if (_dailyRewards[i].itemTokenId == 0 || _dailyRewards[i].amount == 0 || _dailyRewards[i].amount % 10 != 0) {
        revert InvalidReward();
      }
      dailyRewardPool[_tier].push(_dailyRewards[i]);
    }
  }

  function setWeeklyRewardPool(uint _tier, Equipment[] calldata _weeklyRewards) external onlyOwner {
    if (_weeklyRewards.length > 255) {
      revert TooManyRewardsInPool();
    }

    delete weeklyRewardPool[_tier];

    for (uint i = 0; i < _weeklyRewards.length; ++i) {
      if (_weeklyRewards[i].itemTokenId == NONE || _weeklyRewards[i].amount == 0) {
        revert InvalidReward();
      }
      weeklyRewardPool[_tier].push(_weeklyRewards[i]);
    }
  }

  function setChainlinkCallbackGasLimit(uint _gasLimit) external onlyOwner {
    if (_gasLimit > 3_000_000) {
      revert CallbackGasLimitTooHigh();
    }
    callbackGasLimit = uint24(_gasLimit);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
