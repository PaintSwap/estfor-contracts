// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

import {UnsafeU256, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeU256.sol";
import {VRFConsumerBaseV2Upgradeable} from "./VRFConsumerBaseV2Upgradeable.sol";

/* solhint-disable no-global-import */
import "./globals/players.sol";
import "./globals/actions.sol";
import "./globals/items.sol";
import "./globals/rewards.sol";

/* solhint-enable no-global-import */

// Fantom VRF
// VRF 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634
// LINK token 0x6F43FF82CCA38001B6699a8AC47A2d0E66939407
// PREMIUM 0.0005 LINK
contract World is VRFConsumerBaseV2Upgradeable, UUPSUpgradeable, OwnableUpgradeable, Multicall {
  using UnsafeU256 for U256;

  event RequestSent(uint256 requestId, uint32 numWords);
  event RequestFulfilled(uint256 requestId, uint256 randomWord);
  event AddAction(Action action);
  event EditAction(Action action);
  event SetAvailableAction(uint16 actionId, bool available);
  event AddDynamicActions(uint16[] actionIds);
  event RemoveDynamicActions(uint16[] actionIds);
  event AddActionChoice(uint16 actionId, uint16 actionChoiceId, ActionChoice choice);
  event AddActionChoices(uint16 actionId, uint16[] actionChoiceIds, ActionChoice[] choices);
  event NewDailyRewards(Equipment[8] dailyRewards);

  error SeedCannotBeUpdatedYet();
  error CanOnlyRequestAfterTheNextCheckpoint();
  error RequestAlreadyFulfilled();
  error NoValidSeed();
  error CanOnlyRequestAfter1DayHasPassed();
  error ActionIdZeroNotAllowed();
  error MinCannotBeGreaterThanMax();
  error DynamicActionsCannotBeAdded();
  error ActionAlreadyExists();
  error ActionDoesNotExist();
  error ActionChoiceIdZeroNotAllowed();
  error OnlySupportingMax1Output();
  error DynamicActionsCannotBeSet();
  error LengthMismatch();
  error NoActionChoices();
  error ActionChoiceAlreadyExists();
  error GuaranteedRewardsNoDuplicates();
  error RandomRewardsMustBeInOrder();
  error RandomRewardNoDuplicates();

  // This is only used as an input arg
  struct Action {
    uint16 actionId;
    ActionInfo info;
    ActionReward[] guaranteedRewards;
    ActionReward[] randomRewards;
    CombatStats combatStats;
  }

  // solhint-disable-next-line var-name-mixedcase
  VRFCoordinatorV2Interface public COORDINATOR;

  // Your subscription ID.
  uint64 public subscriptionId;

  // Past request ids
  uint[] public requestIds; // Each one is a seed for a day
  mapping(uint requestId => uint randomWord) public randomWords;
  uint40 public lastSeedUpdatedTime;
  uint40 public startTime;
  uint40 public nextCheckpoint;

  // The gas lane to use, which specifies the maximum gas price to bump to.
  // For a list of available gas lanes on each network, this is 10000gwei
  // see https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/#configurations
  bytes32 public constant KEY_HASH = 0x5881eea62f9876043df723cf89f0c2bb6f950da25e9dfe66995c24f919c8f8ab;

  uint32 public constant CALLBACK_GAS_LIMIT = 100000;
  // The default is 3, but you can set this higher.
  uint16 public constant REQUEST_CONFIRMATIONS = 1;
  // For this example, retrieve 1 random value in one request.
  // Cannot exceed VRFCoordinatorV2.MAX_NUM_WORDS.
  uint32 public constant NUM_WORDS = 1;

  uint32 public constant MIN_SEED_UPDATE_TIME = 1 days;
  uint32 public constant MIN_DYNAMIC_ACTION_UPDATE_TIME = 1 days;

  mapping(uint actionId => ActionInfo actionInfo) public actions;
  uint16[] private lastAddedDynamicActions;
  uint public lastDynamicUpdatedTime;

  bytes32 public dailyRewards; // Effectively stores Equipment[8] which is packed, first 7 are daily, last one is weekly reward

  mapping(uint actionId => mapping(uint16 choiceId => ActionChoice actionChoice)) private actionChoices;
  mapping(uint actionId => CombatStats combatStats) private actionCombatStats;

  mapping(uint actionId => ActionRewards actionRewards) private actionRewards;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(VRFCoordinatorV2Interface _coordinator, uint64 _subscriptionId) public initializer {
    __VRFConsumerBaseV2_init(address(_coordinator));
    __Ownable_init();
    __UUPSUpgradeable_init();

    COORDINATOR = _coordinator;
    subscriptionId = _subscriptionId;
    startTime = uint40((block.timestamp / MIN_SEED_UPDATE_TIME) * MIN_SEED_UPDATE_TIME); // Floor to the nearest day 00:00 UTC
    lastSeedUpdatedTime = startTime;
    nextCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;

    // Issue new daily rewards
    Equipment[8] memory rewards = [
      Equipment(COPPER_ORE, 100),
      Equipment(COAL_ORE, 200),
      Equipment(RUBY, 100),
      Equipment(MITHRIL_BAR, 200),
      Equipment(COOKED_BOWFISH, 100),
      Equipment(LEAF_FRAGMENTS, 20),
      Equipment(HELL_SCROLL, 300),
      Equipment(XP_BOOST, 1)
    ];

    _storeDailyRewards(rewards);
    emit NewDailyRewards(rewards);
  }

  function _getDailyReward(uint256 _day) private view returns (Equipment memory equipment) {
    bytes32 rewardItemTokenId = (dailyRewards & ((bytes32(hex"ffff0000") >> (_day * 32)))) >> ((7 - _day) * 32 + 16);
    bytes32 rewardAmount = (dailyRewards & ((bytes32(hex"0000ffff") >> (_day * 32)))) >> ((7 - _day) * 32);
    assembly ("memory-safe") {
      mstore(equipment, rewardItemTokenId)
      mstore(add(equipment, 32), rewardAmount)
    }
  }

  function _getUpdatedDailyReward(
    uint _index,
    Equipment memory _equipment,
    bytes32 _rewards
  ) private pure returns (bytes32) {
    bytes32 rewardItemTokenId;
    bytes32 rewardAmount;
    assembly ("memory-safe") {
      rewardItemTokenId := mload(_equipment)
      rewardAmount := mload(add(_equipment, 32))
    }

    _rewards = _rewards | (rewardItemTokenId << ((7 - _index) * 32 + 16));
    _rewards = _rewards | (rewardAmount << ((7 - _index) * 32));
    return _rewards;
  }

  function _storeDailyRewards(Equipment[8] memory equipments) private {
    bytes32 rewards;
    for (uint i = 0; i < equipments.length; ++i) {
      rewards = _getUpdatedDailyReward(i, equipments[i], rewards);
    }
    dailyRewards = rewards;
  }

  function requestSeedUpdate() external returns (uint256 requestId) {
    // Last one has not been fulfilled yet
    if (requestIds.length != 0 && randomWords[requestIds[requestIds.length - 1]] == 0) {
      revert SeedCannotBeUpdatedYet();
    }
    if (lastSeedUpdatedTime + MIN_SEED_UPDATE_TIME > block.timestamp) {
      revert CanOnlyRequestAfterTheNextCheckpoint();
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
    lastSeedUpdatedTime += MIN_SEED_UPDATE_TIME;
    emit RequestSent(requestId, NUM_WORDS);
    return requestId;
  }

  function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
    //    require(_requestId == requestIds[requestIds.length - 1], "request not found");
    if (randomWords[_requestId] != 0) {
      revert RequestAlreadyFulfilled();
    }

    uint random = _randomWords[0];
    if (random == 0) {
      // Not sure if 0 can be selected, but in case use previous block hash as pseudo random number
      random = uint(blockhash(block.number - 1));
    }

    randomWords[_requestId] = random;
    emit RequestFulfilled(_requestId, random);

    // Are we at the threshold for a new week
    if (nextCheckpoint <= ((block.timestamp) / 1 days) * 1 days) {
      // Issue new daily rewards based on the new seed (TODO)
      Equipment[8] memory rewards = [
        Equipment(COPPER_ORE, 100),
        Equipment(COAL_ORE, 200),
        Equipment(RUBY, 100),
        Equipment(MITHRIL_BAR, 200),
        Equipment(COOKED_BOWFISH, 100),
        Equipment(LEAF_FRAGMENTS, 20),
        Equipment(HELL_SCROLL, 300),
        Equipment(XP_BOOST, 1)
      ];
      _storeDailyRewards(rewards);
      emit NewDailyRewards(rewards);
      nextCheckpoint = uint40((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days + 1 weeks;
    }
  }

  function getDailyReward() external view returns (Equipment memory equipment) {
    uint checkpoint = ((block.timestamp - 4 days) / 1 weeks) * 1 weeks + 4 days;
    uint day = ((block.timestamp / 1 days) * 1 days - checkpoint) / 1 days;
    equipment = _getDailyReward(day);
  }

  function getWeeklyReward() external view returns (Equipment memory equipment) {
    equipment = _getDailyReward(7);
  }

  function _getSeed(uint _timestamp) private view returns (uint) {
    uint offset = (_timestamp - startTime) / MIN_SEED_UPDATE_TIME;
    if (requestIds.length <= offset) {
      return 0;
    }
    return randomWords[requestIds[offset]];
  }

  function hasSeed(uint _timestamp) external view returns (bool) {
    return _getSeed(_timestamp) != 0;
  }

  function getSeed(uint _timestamp) public view returns (uint seed) {
    seed = _getSeed(_timestamp);
    if (seed == 0) {
      revert NoValidSeed();
    }
  }

  // Can be called by anyone as long as over 1 day has passed since the last call
  function updateDynamicActions() external {
    if ((lastDynamicUpdatedTime + MIN_DYNAMIC_ACTION_UPDATE_TIME) > block.timestamp) {
      revert CanOnlyRequestAfter1DayHasPassed();
    }

    emit RemoveDynamicActions(lastAddedDynamicActions);

    // These are no longer available as existing actions
    U256 iter = U256.wrap(lastAddedDynamicActions.length);
    while (iter.neq(0)) {
      iter = iter.dec();
      actions[lastAddedDynamicActions[iter.asUint256()]].isAvailable = false;
    }

    delete lastAddedDynamicActions;
    uint seed = getSeed(block.timestamp);

    uint16[] memory actionIdsToAdd = new uint16[](1);

    if (seed % 2 == 0) {
      // If it's even do X
      actionIdsToAdd[0] = 1; // ?
    } else {
      actionIdsToAdd[0] = 2; // ?
    }

    lastAddedDynamicActions = actionIdsToAdd;
    iter = U256.wrap(actionIdsToAdd.length);
    while (iter.neq(0)) {
      iter = iter.dec();
      actions[actionIdsToAdd[iter.asUint256()]].isAvailable = true;
    }

    lastDynamicUpdatedTime = block.timestamp;
    emit AddDynamicActions(actionIdsToAdd);
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

  function getXPPerHour(uint16 _actionId, uint16 _actionChoiceId) external view returns (uint16 xpPerHour) {
    return _actionChoiceId != 0 ? actionChoices[_actionId][_actionChoiceId].xpPerHour : actions[_actionId].xpPerHour;
  }

  function getNumSpawn(uint16 _actionId) external view returns (uint numSpawn) {
    return actions[_actionId].numSpawn;
  }

  function getCombatStats(uint16 _actionId) external view returns (CombatStats memory stats) {
    stats = actionCombatStats[_actionId];
  }

  function getActionChoice(uint16 _actionId, uint16 _choiceId) external view returns (ActionChoice memory) {
    return actionChoices[_actionId][_choiceId];
  }

  function getActionSuccessPercent(uint16 _actionId) external view returns (uint8) {
    return actions[_actionId].successPercent;
  }

  function _setAction(Action calldata _action) private {
    if (_action.actionId == 0) {
      revert ActionIdZeroNotAllowed();
    }
    if (_action.info.handItemTokenIdRangeMin > _action.info.handItemTokenIdRangeMax) {
      revert MinCannotBeGreaterThanMax();
    }
    actions[_action.actionId] = _action.info;

    // Set the rewards
    ActionRewards storage actionReward = actionRewards[_action.actionId];
    _setActionGuaranteedRewards(_action, actionReward);
    // Now do the same for randomRewards
    _setActionRandomRewards(_action, actionReward);

    if (_action.info.skill == Skill.COMBAT) {
      actionCombatStats[_action.actionId] = _action.combatStats;
    }
  }

  function _setActionGuaranteedRewards(Action calldata _action, ActionRewards storage actionReward) private {
    if (_action.guaranteedRewards.length != 0) {
      actionReward.guaranteedRewardTokenId1 = _action.guaranteedRewards[0].itemTokenId;
      actionReward.guaranteedRewardRate1 = _action.guaranteedRewards[0].rate;
    }
    if (_action.guaranteedRewards.length > 1) {
      actionReward.guaranteedRewardTokenId2 = _action.guaranteedRewards[1].itemTokenId;
      actionReward.guaranteedRewardRate2 = _action.guaranteedRewards[1].rate;
      if (actionReward.guaranteedRewardTokenId1 == actionReward.guaranteedRewardTokenId2) {
        revert GuaranteedRewardsNoDuplicates();
      }
    }
    if (_action.guaranteedRewards.length > 2) {
      actionReward.guaranteedRewardTokenId3 = _action.guaranteedRewards[2].itemTokenId;
      actionReward.guaranteedRewardRate3 = _action.guaranteedRewards[2].rate;

      for (uint i; i < _action.guaranteedRewards.length; ++i) {
        if (
          _action.guaranteedRewards[i].itemTokenId ==
          _action.guaranteedRewards[_action.guaranteedRewards.length - 1].itemTokenId
        ) {
          revert GuaranteedRewardsNoDuplicates();
        }
      }
    }
  }

  // Random rewards but have most common one first
  function _setActionRandomRewards(Action calldata _action, ActionRewards storage actionReward) private {
    if (_action.randomRewards.length != 0) {
      actionReward.randomRewardTokenId1 = _action.randomRewards[0].itemTokenId;
      actionReward.randomRewardChance1 = uint16(_action.randomRewards[0].rate);
    }
    if (_action.randomRewards.length > 1) {
      actionReward.randomRewardTokenId2 = _action.randomRewards[1].itemTokenId;
      actionReward.randomRewardChance2 = uint16(_action.randomRewards[1].rate);
      if (actionReward.randomRewardChance2 > actionReward.randomRewardChance1) {
        revert RandomRewardsMustBeInOrder();
      }
      if (actionReward.randomRewardTokenId1 == actionReward.randomRewardTokenId2) {
        revert RandomRewardNoDuplicates();
      }
    }
    if (_action.randomRewards.length > 2) {
      actionReward.randomRewardTokenId3 = _action.randomRewards[2].itemTokenId;
      actionReward.randomRewardChance3 = uint16(_action.randomRewards[2].rate);
      if (actionReward.randomRewardChance3 > actionReward.randomRewardChance2) {
        revert RandomRewardsMustBeInOrder();
      }
      for (uint i; i < _action.randomRewards.length; ++i) {
        if (
          _action.randomRewards[i].itemTokenId == _action.randomRewards[_action.randomRewards.length - 1].itemTokenId
        ) {
          revert RandomRewardNoDuplicates();
        }
      }
    }
    if (_action.randomRewards.length > 3) {
      actionReward.randomRewardTokenId4 = _action.randomRewards[3].itemTokenId;
      actionReward.randomRewardChance4 = uint16(_action.randomRewards[3].rate);
      for (uint i; i < _action.randomRewards.length; ++i) {
        if (
          _action.randomRewards[i].itemTokenId == _action.randomRewards[_action.randomRewards.length - 1].itemTokenId
        ) {
          revert RandomRewardNoDuplicates();
        }
      }
    }
  }

  function _addAction(Action calldata _action) private {
    if (_action.info.isDynamic) {
      revert DynamicActionsCannotBeAdded();
    }
    if (actions[_action.actionId].skill != Skill.NONE) {
      revert ActionAlreadyExists();
    }
    _setAction(_action);
    emit AddAction(_action);
  }

  function addActions(Action[] calldata _actions) external onlyOwner {
    U256 iter = U256.wrap(_actions.length);
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      _addAction(_actions[i]);
    }
  }

  function addAction(Action calldata _action) external onlyOwner {
    _addAction(_action);
  }

  function editAction(Action calldata _action) external onlyOwner {
    if (actions[_action.actionId].skill == Skill.NONE) {
      revert ActionDoesNotExist();
    }
    _setAction(_action);
    emit EditAction(_action);
  }

  function _addActionChoice(uint16 _actionId, uint16 _actionChoiceId, ActionChoice calldata _actionChoice) private {
    if (_actionChoiceId == 0) {
      revert ActionChoiceIdZeroNotAllowed();
    }
    if (_actionChoice.outputTokenId != 0 && _actionChoice.outputNum != 1) {
      revert OnlySupportingMax1Output();
    }
    if (actionChoices[_actionId][_actionChoiceId].skill != Skill.NONE) {
      revert ActionChoiceAlreadyExists();
    }
    actionChoices[_actionId][_actionChoiceId] = _actionChoice;
  }

  // actionId of 0 means it is not tied to a specific action (combat)
  function addActionChoice(
    uint16 _actionId,
    uint16 _actionChoiceId,
    ActionChoice calldata _actionChoice
  ) external onlyOwner {
    _addActionChoice(_actionId, _actionChoiceId, _actionChoice);
    emit AddActionChoice(_actionId, _actionChoiceId, _actionChoice);
  }

  function addActionChoices(
    uint16 _actionId,
    uint16[] calldata _actionChoiceIds,
    ActionChoice[] calldata _actionChoices
  ) external onlyOwner {
    if (_actionChoiceIds.length != _actionChoices.length) {
      revert LengthMismatch();
    }
    U256 iter = U256.wrap(_actionChoices.length);
    if (iter.eq(0)) {
      revert NoActionChoices();
    }
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      _addActionChoice(_actionId, _actionChoiceIds[i], _actionChoices[i]);
    }
    emit AddActionChoices(_actionId, _actionChoiceIds, _actionChoices);
  }

  function addBulkActionChoices(
    uint16[] calldata _actionIds,
    uint16[][] calldata _actionChoiceIds,
    ActionChoice[][] calldata _actionChoices
  ) external onlyOwner {
    U256 iter = U256.wrap(0);
    if (_actionIds.length != _actionChoices.length) {
      revert LengthMismatch();
    }
    if (_actionIds.length == 0) {
      revert NoActionChoices();
    }

    while (iter.lt(_actionIds.length)) {
      uint16 i = iter.asUint16();
      uint16 actionId = _actionIds[i];
      emit AddActionChoices(actionId, _actionChoiceIds[i], _actionChoices[i]);
      U256 iter2 = U256.wrap(0);
      if (_actionChoiceIds[i].length != _actionChoices[i].length) {
        revert LengthMismatch();
      }

      while (iter2.lt(_actionChoices[i].length)) {
        uint16 j = iter2.asUint16();
        _addActionChoice(actionId, _actionChoiceIds[i][j], _actionChoices[i][j]);
        iter2 = iter2.inc();
      }
      iter = iter.inc();
    }
  }

  function setAvailable(uint16 _actionId, bool _isAvailable) external onlyOwner {
    if (actions[_actionId].skill == Skill.NONE) {
      revert ActionDoesNotExist();
    }
    if (actions[_actionId].isDynamic) {
      revert DynamicActionsCannotBeSet();
    }
    actions[_actionId].isAvailable = _isAvailable;
    emit SetAvailableAction(_actionId, _isAvailable);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
