// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";
import {VRFConsumerBaseV2Upgradeable} from "./VRFConsumerBaseV2Upgradeable.sol";

import {WorldLibrary} from "./WorldLibrary.sol";
import {IQuests} from "./interfaces/IQuests.sol";

// solhint-disable-next-line no-global-import
import "./globals/all.sol";

contract World is VRFConsumerBaseV2Upgradeable, UUPSUpgradeable, OwnableUpgradeable {
  using UnsafeMath for U256;
  using UnsafeMath for uint;

  event RequestSent(uint requestId, uint32 numWords, uint lastRandomWordsUpdatedTime);
  event RequestFulfilled(uint requestId, uint[3] randomWords);
  event AddActionsV2(Action[] actions);
  event EditActionsV2(Action[] actions);
  event AddDynamicActions(uint16[] actionIds);
  event RemoveDynamicActions(uint16[] actionIds);
  event AddActionChoicesV2(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInput[] choices);
  event EditActionChoicesV2(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceInput[] choices);
  event RemoveActionChoicesV2(uint16 actionId, uint16[] actionChoiceIds);

  // Legacy, just for ABI reasons
  event AddAction(ActionV1 action);
  event AddActions(ActionV1[] actions);
  event EditActions(ActionV1[] actions);
  event AddActionChoice(uint16 actionId, uint16 actionChoiceId, ActionChoiceV1 choice);
  event AddActionChoices(uint16 actionId, uint16[] actionChoiceIds, ActionChoiceV1[] choices);
  event EditActionChoice(uint16 actionId, uint16 actionChoiceId, ActionChoiceV1 choice);
  event EditActionChoices_(uint16[] actionIds, uint16[] actionChoiceIds, ActionChoiceV1[] choices);

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

  // solhint-disable-next-line var-name-mixedcase
  VRFCoordinatorV2Interface private COORDINATOR;

  // Your subscription ID.
  uint64 private subscriptionId;

  // Past request ids
  uint[] public requestIds; // Each one is a set of random words for 1 day
  mapping(uint requestId => uint[3] randomWord) public randomWords;
  uint40 public lastRandomWordsUpdatedTime;
  uint40 private startTime;
  uint40 private weeklyRewardCheckpoint;
  bytes8 private thisWeeksRandomWordSegment; // Every 8 bits is a random segment for the day

  // The gas lane to use, which specifies the maximum gas price to bump to.
  // For a list of available gas lanes on each network, this is 10000gwei
  // see https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/#configurations
  bytes32 private constant KEY_HASH = 0x5881eea62f9876043df723cf89f0c2bb6f950da25e9dfe66995c24f919c8f8ab;

  uint32 private constant CALLBACK_GAS_LIMIT = 500000;
  // The default is 3, but you can set this higher.
  uint16 private constant REQUEST_CONFIRMATIONS = 1;
  // For this example, retrieve 3 random values in one request.
  // Cannot exceed VRFCoordinatorV2.MAX_NUM_WORDS.
  uint32 private constant NUM_WORDS = 3;

  uint32 public constant MIN_RANDOM_WORDS_UPDATE_TIME = 1 days;
  uint32 private constant MIN_DYNAMIC_ACTION_UPDATE_TIME = 1 days;

  mapping(uint actionId => ActionInfo actionInfo) public actions;
  uint16[] private lastAddedDynamicActions;
  uint private lastDynamicUpdatedTime;

  /// @custom:oz-renamed-from dailyRewards
  bytes32 dummy; // Not clean

  mapping(uint actionId => mapping(uint16 choiceId => ActionChoice actionChoice)) private actionChoices;
  mapping(uint actionId => CombatStats combatStats) private actionCombatStats;

  mapping(uint actionId => ActionRewards actionRewards) private actionRewards;

  IQuests private quests;

  mapping(uint tier => Equipment[]) public dailyRewardPool;
  mapping(uint tier => Equipment[]) public weeklyRewardPool;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    VRFCoordinatorV2Interface _coordinator,
    uint64 _subscriptionId,
    Equipment[][] calldata _dailyRewards,
    Equipment[][] calldata _weeklyRewards
  ) public initializer {
    __VRFConsumerBaseV2_init(address(_coordinator));
    __Ownable_init();
    __UUPSUpgradeable_init();

    COORDINATOR = _coordinator;
    subscriptionId = _subscriptionId;
    startTime = uint40((block.timestamp / MIN_RANDOM_WORDS_UPDATE_TIME) * MIN_RANDOM_WORDS_UPDATE_TIME) - 5 days; // Floor to the nearest day 00:00 UTC
    lastRandomWordsUpdatedTime = startTime + 4 days;
    weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;

    // Initialize 4 days worth of random words
    for (U256 iter; iter.lt(4); iter = iter.inc()) {
      uint i = iter.asUint256();
      uint requestId = 200 + i;
      requestIds.push(requestId);
      emit RequestSent(requestId, NUM_WORDS, startTime + (i * 1 days) + 1 days);
      uint[] memory _randomWords = new uint[](3);
      _randomWords[0] = uint(
        blockhash(block.number - 4 + i) ^ 0x3632d8eba811d69784e6904a58de6e0ab55f32638189623b309895beaa6920c4
      );
      _randomWords[1] = uint(
        blockhash(block.number - 4 + i) ^ 0xca820e9e57e5e703aeebfa2dc60ae09067f931b6e888c0a7c7a15a76341ab2c2
      );
      _randomWords[2] = uint(
        blockhash(block.number - 4 + i) ^ 0xd1f1b7d57307aee9687ae39dbb462b1c1f07a406d34cd380670360ef02f243b6
      );
      fulfillRandomWords(requestId, _randomWords);
    }

    thisWeeksRandomWordSegment = bytes8(uint64(randomWords[3][0]));

    for (uint i = 0; i < _dailyRewards.length; ++i) {
      setDailyRewardPool(i + 1, _dailyRewards[i]);
    }
    for (uint i = 0; i < _weeklyRewards.length; ++i) {
      setWeeklyRewardPool(i + 1, _weeklyRewards[i]);
    }
  }

  function requestRandomWords() external returns (uint requestId) {
    // Last one has not been fulfilled yet
    if (requestIds.length != 0 && randomWords[requestIds[requestIds.length - 1]][0] == 0) {
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
      CALLBACK_GAS_LIMIT,
      NUM_WORDS
    );

    requestIds.push(requestId);
    lastRandomWordsUpdatedTime = newLastRandomWordsUpdatedTime;
    emit RequestSent(requestId, NUM_WORDS, newLastRandomWordsUpdatedTime);
    return requestId;
  }

  function fulfillRandomWords(uint _requestId, uint[] memory _randomWords) internal override {
    if (randomWords[_requestId][0] != 0) {
      revert RequestAlreadyFulfilled();
    }

    uint[3] memory random = [_randomWords[0], _randomWords[1], _randomWords[2]];

    if (random[0] == 0) {
      // Not sure if 0 can be selected, but in case use previous block hash as pseudo random number
      random[0] = uint(blockhash(block.number - 1));
    }
    if (random[1] == 0) {
      random[1] = uint(blockhash(block.number - 2));
    }
    if (random[2] == 0) {
      random[2] = uint(blockhash(block.number - 3));
    }

    randomWords[_requestId] = random;
    if (address(quests) != address(0)) {
      quests.newOracleRandomWords(random);
    }
    emit RequestFulfilled(_requestId, random);

    // Are we at the threshold for a new week
    if (weeklyRewardCheckpoint <= ((block.timestamp) / 1 days) * 1 days) {
      // Issue new daily rewards for each tier based on the new random words
      thisWeeksRandomWordSegment = bytes8(uint64(random[0]));

      weeklyRewardCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
    }
  }

  function getWeeklyReward(uint _tier, uint _playerId) public view returns (uint16 itemTokenId, uint24 amount) {
    uint day = 7;
    uint index = _getRewardIndex(_playerId, day, weeklyRewardPool[_tier].length);
    Equipment storage equipment = weeklyRewardPool[_tier][index];
    return (equipment.itemTokenId, equipment.amount);
  }

  function getSpecificDailyReward(
    uint _tier,
    uint _playerId,
    uint _day
  ) public view returns (uint16 itemTokenId, uint24 amount) {
    uint index = _getRewardIndex(_playerId, _day, dailyRewardPool[_tier].length);
    Equipment storage equipment = dailyRewardPool[_tier][index];
    return (equipment.itemTokenId, equipment.amount);
  }

  function getDailyReward(uint _tier, uint _playerId) external view returns (uint itemTokenId, uint amount) {
    uint checkpoint = ((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days;
    uint day = ((block.timestamp / 1 days) * 1 days - checkpoint) / 1 days;
    return getSpecificDailyReward(_tier, _playerId, day);
  }

  function getActiveDailyAndWeeklyRewards(
    uint _tier,
    uint _playerId
  ) external view returns (Equipment[8] memory rewards) {
    for (uint i; i < 7; ++i) {
      (rewards[i].itemTokenId, rewards[i].amount) = getSpecificDailyReward(_tier, _playerId, i);
    }
    (rewards[7].itemTokenId, rewards[7].amount) = getWeeklyReward(_tier, _playerId);
  }

  function _getRandomWordOffset(uint _timestamp) private view returns (int) {
    if (_timestamp < startTime) {
      return -1;
    }
    return int((_timestamp - startTime) / MIN_RANDOM_WORDS_UPDATE_TIME);
  }

  // Just returns the first random word of the array
  function _getRandomWord(uint _timestamp) private view returns (uint) {
    int offset = _getRandomWordOffset(_timestamp);
    if (offset < 0 || requestIds.length <= uint(offset)) {
      return 0;
    }
    return randomWords[requestIds[uint(offset)]][0];
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

  function getFullRandomWords(uint _timestamp) public view returns (uint[3] memory) {
    int offset = _getRandomWordOffset(_timestamp);
    if (offset < 0 || requestIds.length <= uint(offset)) {
      revert NoValidRandomWord();
    }
    return randomWords[requestIds[uint(offset)]];
  }

  function getMultipleFullRandomWords(uint _timestamp) public view returns (uint[3][5] memory words) {
    for (U256 iter; iter.lt(5); iter = iter.inc()) {
      uint i = iter.asUint256();
      words[i] = getFullRandomWords(_timestamp - i * 1 days);
    }
  }

  function getSkill(uint _actionId) external view returns (Skill) {
    return actions[_actionId].skill;
  }

  function getActionRewards(uint _actionId) external view returns (ActionRewards memory) {
    return actionRewards[_actionId];
  }

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

  function getXPPerHour(uint16 _actionId, uint16 _actionChoiceId) external view returns (uint24 xpPerHour) {
    return _actionChoiceId != 0 ? actionChoices[_actionId][_actionChoiceId].xpPerHour : actions[_actionId].xpPerHour;
  }

  function getNumSpawn(uint16 _actionId) external view returns (uint numSpawned) {
    return actions[_actionId].numSpawned;
  }

  function getCombatStats(uint16 _actionId) external view returns (CombatStats memory stats) {
    stats = actionCombatStats[_actionId];
  }

  function getActionChoice(uint16 _actionId, uint16 _choiceId) external view returns (ActionChoice memory) {
    return actionChoices[_actionId][_choiceId];
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

  function getRandomBytes(uint _numTickets, uint _skillEndTime, uint _playerId) external view returns (bytes memory b) {
    if (_numTickets <= 16) {
      // 32 bytes
      bytes32 word = bytes32(getRandomWord(_skillEndTime));
      b = abi.encodePacked(_getRandomComponent(word, _skillEndTime, _playerId));
    } else if (_numTickets <= 48) {
      uint[3] memory fullWords = getFullRandomWords(_skillEndTime);
      // 3 * 32 bytes
      for (U256 iter; iter.lt(3); iter = iter.inc()) {
        uint i = iter.asUint256();
        fullWords[i] = uint(_getRandomComponent(bytes32(fullWords[i]), _skillEndTime, _playerId));
      }
      b = abi.encodePacked(fullWords);
    } else {
      // 3 * 5 * 32 bytes
      uint[3][5] memory multipleFullWords = getMultipleFullRandomWords(_skillEndTime);
      for (U256 iter; iter.lt(5); iter = iter.inc()) {
        uint i = iter.asUint256();
        for (U256 jter; jter.lt(3); jter = jter.inc()) {
          uint j = jter.asUint256();
          multipleFullWords[i][j] = uint(
            _getRandomComponent(bytes32(multipleFullWords[i][j]), _skillEndTime, _playerId)
          );
          // XOR all the full words with the first fresh random number to give more randomness to the existing random words
          if (i != 0) {
            multipleFullWords[i][j] = multipleFullWords[i][j] ^ multipleFullWords[0][j];
          }
        }
      }

      b = abi.encodePacked(multipleFullWords);
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

  function _getRewardIndex(uint _playerId, uint _day, uint _length) private view returns (uint) {
    return uint(keccak256(abi.encodePacked(thisWeeksRandomWordSegment, _playerId)) >> (_day * 8)) % _length;
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
    WorldLibrary.setActionGuaranteedRewards(_action, actionReward);
    WorldLibrary.setActionRandomRewards(_action, actionReward);

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

  function _addActionChoice(uint16 _actionId, uint16 _actionChoiceId, ActionChoice memory _packedActionChoice) private {
    if (_actionChoiceId == 0) {
      revert ActionChoiceIdZeroNotAllowed();
    }
    if (actionChoices[_actionId][_actionChoiceId].skill != Skill.NONE) {
      revert ActionChoiceAlreadyExists();
    }
    WorldLibrary.checkActionChoice(_packedActionChoice);

    actionChoices[_actionId][_actionChoiceId] = _packedActionChoice;
  }

  function _editActionChoice(uint16 _actionId, uint16 _actionChoiceId, ActionChoice memory _actionChoice) private {
    if (actionChoices[_actionId][_actionChoiceId].skill == Skill.NONE) {
      revert ActionChoiceDoesNotExist();
    }

    WorldLibrary.checkActionChoice(_actionChoice);

    actionChoices[_actionId][_actionChoiceId] = _actionChoice;
  }

  function _getRandomComponent(bytes32 _word, uint _skillEndTime, uint _playerId) private pure returns (bytes32) {
    return keccak256(abi.encodePacked(_word, _skillEndTime, _playerId));
  }

  function _packActionChoice(
    ActionChoiceInput calldata _actionChoice
  ) private pure returns (ActionChoice memory actionChoice) {
    bytes1 packedData = bytes1(uint8(_actionChoice.isFullModeOnly ? 1 : 0 << 7));

    actionChoice = ActionChoice({
      skill: _actionChoice.skill,
      minXP: _actionChoice.minXP,
      skillDiff: _actionChoice.skillDiff,
      rate: _actionChoice.rate,
      xpPerHour: _actionChoice.xpPerHour,
      inputTokenId1: _actionChoice.inputTokenId1,
      inputAmount1: _actionChoice.inputAmount1,
      inputTokenId2: _actionChoice.inputTokenId2,
      inputAmount2: _actionChoice.inputAmount2,
      inputTokenId3: _actionChoice.inputTokenId3,
      inputAmount3: _actionChoice.inputAmount3,
      outputTokenId: _actionChoice.outputTokenId,
      outputAmount: _actionChoice.outputAmount,
      successPercent: _actionChoice.successPercent,
      handItemTokenIdRangeMin: _actionChoice.handItemTokenIdRangeMin,
      handItemTokenIdRangeMax: _actionChoice.handItemTokenIdRangeMax,
      packedData: packedData
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
      emit AddActionChoicesV2(actionId, _actionChoiceIds[i], _actionChoices[i]);

      U256 actionChoiceLength = _actionChoices[i].length.asU256();

      if (actionChoiceLength.neq(_actionChoiceIds[i].length)) {
        revert LengthMismatch();
      }

      for (U256 jter; jter < actionChoiceLength; jter = jter.inc()) {
        uint16 j = jter.asUint16();
        _addActionChoice(actionId, _actionChoiceIds[i][j], _packActionChoice(_actionChoices[i][j]));
      }
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
      _editActionChoice(_actionId, _actionChoiceIds[i], _packActionChoice(_actionChoices[i]));
    }

    emit EditActionChoicesV2(_actionId, _actionChoiceIds, _actionChoices);
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

  function setQuests(IQuests _quests) external onlyOwner {
    quests = _quests;
  }

  function setDailyRewardPool(uint _tier, Equipment[] calldata _dailyRewards) public onlyOwner {
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

  function setWeeklyRewardPool(uint _tier, Equipment[] calldata _weeklyRewards) public onlyOwner {
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

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
