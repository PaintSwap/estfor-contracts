// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

import {Unsafe256, U256} from "./lib/Unsafe256.sol";
import {VRFConsumerBaseV2Upgradeable} from "./VRFConsumerBaseV2Upgradeable.sol";

import "./types.sol";

// Fantom VRF
// VRF 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634
// LINK token 0x6F43FF82CCA38001B6699a8AC47A2d0E66939407
// PREMIUM 0.0005 LINK
contract World is VRFConsumerBaseV2Upgradeable, UUPSUpgradeable, OwnableUpgradeable, Multicall {
  using Unsafe256 for U256;

  event RequestSent(uint256 requestId, uint32 numWords);
  event RequestFulfilled(uint256 requestId, uint256 randomWord);
  event AddAction(uint16 actionId, Action action);
  event EditAction(uint16 actionId, Action action);
  event SetAvailableAction(uint16 actionId, bool available);
  event AddDynamicActions(uint16[] actionIds);
  event RemoveDynamicActions(uint16[] actionIds);
  event AddActionChoice(uint16 actionId, uint16 actionChoiceId, ActionChoice choice);
  event AddActionChoices(uint16 actionId, uint16 startActionChoice, ActionChoice[] choices);

  struct Action {
    ActionInfo info;
    ActionReward[] guaranteedRewards;
    ActionReward[] randomRewards;
    CombatStats combatStats;
  }

  VRFCoordinatorV2Interface COORDINATOR;

  // Your subscription ID.
  uint64 subscriptionId;

  // Past request ids
  uint[] public requestIds; // Each one is a seed for a day
  mapping(uint requestId => uint randomWord) public randomWords;
  uint public lastSeedUpdatedTime;

  uint startTime;

  // The gas lane to use, which specifies the maximum gas price to bump to.
  // For a list of available gas lanes on each network, this is 10000gwei
  // see https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/#configurations
  bytes32 constant keyHash = 0x5881eea62f9876043df723cf89f0c2bb6f950da25e9dfe66995c24f919c8f8ab;

  uint32 constant callbackGasLimit = 100000;
  // The default is 3, but you can set this higher.
  uint16 constant requestConfirmations = 3;
  // For this example, retrieve 1 random value in one request.
  // Cannot exceed VRFCoordinatorV2.MAX_NUM_WORDS.
  uint32 constant numWords = 1;

  uint32 public constant MIN_SEED_UPDATE_TIME = 1 days;
  uint32 public constant MIN_DYNAMIC_ACTION_UPDATE_TIME = 1 days;

  mapping(uint actionId => ActionInfo actionInfo) public actions;
  uint16 public nextActionId;
  uint16 public nextActionChoiceId;
  uint16[] private lastAddedDynamicActions;
  uint public lastDynamicUpdatedTime;

  mapping(uint actionId => mapping(uint16 choiceId => ActionChoice actionChoice)) public actionChoices;
  mapping(uint actionId => CombatStats combatStats) actionCombatStats;

  mapping(uint actionId => ActionRewards actionRewards) private actionRewards;

  function initialize(VRFCoordinatorV2Interface _coordinator, uint64 _subscriptionId) public initializer {
    __VRFConsumerBaseV2_init(address(_coordinator));
    __Ownable_init();
    __UUPSUpgradeable_init();

    COORDINATOR = _coordinator;
    subscriptionId = _subscriptionId;
    nextActionId = 1;
    nextActionChoiceId = 1;
    startTime = (block.timestamp / MIN_SEED_UPDATE_TIME) * MIN_SEED_UPDATE_TIME; // Floor to the nearest day 00:00 UTC
    lastSeedUpdatedTime = startTime;
  }

  function requestSeedUpdate() external returns (uint256 requestId) {
    // Last one has not been fulfilled yet
    if (requestIds.length != 0) {
      require(randomWords[requestIds[requestIds.length - 1]] != 0, "Seed can't be updated");
    }

    require(
      lastSeedUpdatedTime + MIN_SEED_UPDATE_TIME <= block.timestamp,
      "Can only request after the next checkpoint"
    );

    // Will revert if subscription is not set and funded.
    requestId = COORDINATOR.requestRandomWords(
      keyHash,
      subscriptionId,
      requestConfirmations,
      callbackGasLimit,
      numWords
    );

    requestIds.push(requestId);
    lastSeedUpdatedTime += MIN_SEED_UPDATE_TIME;
    emit RequestSent(requestId, numWords);
    return requestId;
  }

  function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
    //    require(_requestId == requestIds[requestIds.length - 1], "request not found");
    require(randomWords[_requestId] == 0, "Request already been satisfied");

    uint random = _randomWords[0];
    if (random == 0) {
      // Not sure if 0 can be selected, but in case use previous block hash as pseudo random number
      random = uint(blockhash(block.number - 1));
    }

    randomWords[_requestId] = random;
    emit RequestFulfilled(_requestId, random);
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
    require(seed != 0, "No valid seed");
  }

  // Can be called by anyone as long as over 1 day has passed since the last call
  function updateDynamicActions() external {
    require(
      (lastDynamicUpdatedTime + MIN_DYNAMIC_ACTION_UPDATE_TIME) <= block.timestamp,
      "Can only request after 1 day has passed"
    );

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
      uint32 minSkillPoints,
      bool actionAvailable
    )
  {
    ActionInfo storage actionInfo = actions[_actionId];
    return (
      actionInfo.handItemTokenIdRangeMin,
      actionInfo.handItemTokenIdRangeMax,
      actionInfo.actionChoiceRequired,
      actionInfo.skill,
      actionInfo.minSkillPoints,
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

  function _setAction(uint _actionId, Action calldata _action) private {
    require(_action.info.handItemTokenIdRangeMin <= _action.info.handItemTokenIdRangeMax);
    actions[_actionId] = _action.info;

    // Set the rewards
    ActionRewards storage actionReward = actionRewards[_actionId];
    if (_action.guaranteedRewards.length != 0) {
      actionReward.guaranteedRewardTokenId1 = _action.guaranteedRewards[0].itemTokenId;
      actionReward.guaranteedRewardRate1 = _action.guaranteedRewards[0].rate;
    }
    if (_action.guaranteedRewards.length > 1) {
      actionReward.guaranteedRewardTokenId2 = _action.guaranteedRewards[1].itemTokenId;
      actionReward.guaranteedRewardRate2 = _action.guaranteedRewards[1].rate;
    }
    if (_action.guaranteedRewards.length > 2) {
      actionReward.guaranteedRewardTokenId3 = _action.guaranteedRewards[2].itemTokenId;
      actionReward.guaranteedRewardRate3 = _action.guaranteedRewards[2].rate;
    }
    // Now do the same for randomRewards
    if (_action.randomRewards.length != 0) {
      actionReward.randomRewardTokenId1 = _action.randomRewards[0].itemTokenId;
      actionReward.randomRewardChance1 = uint16(_action.randomRewards[0].rate);
    }
    if (_action.randomRewards.length > 1) {
      actionReward.randomRewardTokenId2 = _action.randomRewards[1].itemTokenId;
      actionReward.randomRewardChance2 = uint16(_action.randomRewards[1].rate);
    }
    if (_action.randomRewards.length > 2) {
      actionReward.randomRewardTokenId3 = _action.randomRewards[2].itemTokenId;
      actionReward.randomRewardChance3 = uint16(_action.randomRewards[2].rate);
    }
    if (_action.randomRewards.length > 3) {
      actionReward.randomRewardTokenId4 = _action.randomRewards[3].itemTokenId;
      actionReward.randomRewardChance4 = uint16(_action.randomRewards[3].rate);
    }

    if (_action.info.skill == Skill.COMBAT) {
      actionCombatStats[_actionId] = _action.combatStats;
    }
  }

  function _addAction(uint16 _actionId, Action calldata _action) private {
    require(!_action.info.isDynamic, "Action is dynamic");
    _setAction(_actionId, _action);
    emit AddAction(_actionId, _action);
  }

  function addActions(Action[] calldata _actions) external onlyOwner {
    uint16 actionId = nextActionId;
    U256 iter = U256.wrap(_actions.length);
    nextActionId = actionId + iter.asUint16();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      _addAction(actionId + i, _actions[i]);
    }
  }

  function addAction(Action calldata _action) external onlyOwner {
    uint16 actionId = nextActionId;
    _addAction(actionId, _action);
    nextActionId = actionId + 1;
  }

  function editAction(uint16 _actionId, Action calldata _action) external onlyOwner {
    _setAction(_actionId, _action);
    emit EditAction(_actionId, _action);
  }

  // actionId of 0 means it is not tied to a specific action
  function addActionChoice(uint16 _actionId, ActionChoice calldata _actionChoice) external onlyOwner {
    uint16 actionChoiceId = nextActionChoiceId;
    if (_actionChoice.outputTokenId != 0) {
      require(_actionChoice.outputNum == 1); // Only supporting max 1 for now
    }
    actionChoices[_actionId][actionChoiceId] = _actionChoice;
    emit AddActionChoice(_actionId, actionChoiceId, _actionChoice);
    nextActionChoiceId = actionChoiceId + 1;
  }

  function addActionChoices(uint16 _actionId, ActionChoice[] calldata _actionChoices) external onlyOwner {
    U256 iter = U256.wrap(_actionChoices.length);
    require(iter.neq(0));
    uint16 actionChoiceId = nextActionChoiceId;
    nextActionChoiceId = actionChoiceId + iter.asUint16();
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      actionChoices[_actionId][actionChoiceId + i] = _actionChoices[i];
    }
    emit AddActionChoices(_actionId, actionChoiceId, _actionChoices);
  }

  function addBulkActionChoices(
    uint16[] calldata _actionIds,
    ActionChoice[][] calldata _actionChoices
  ) external onlyOwner {
    U256 iter = U256.wrap(_actionIds.length);
    require(iter.neq(0));
    require(iter.eq(_actionChoices.length));
    U256 actionChoiceId = U256.wrap(nextActionChoiceId);
    U256 count;
    while (iter.neq(0)) {
      iter = iter.dec();
      uint16 i = iter.asUint16();
      uint16 actionId = _actionIds[i];
      emit AddActionChoices(actionId, (actionChoiceId + count).asUint16(), _actionChoices[i]);
      U256 iter2 = U256.wrap(_actionChoices[i].length);
      while (iter2.neq(0)) {
        iter2 = iter2.dec();
        uint16 j = iter2.asUint16();
        actionChoices[actionId][(actionChoiceId + count).asUint16()] = _actionChoices[i][j];
        count = count.inc();
      }
    }
    nextActionChoiceId = (actionChoiceId + count).asUint16();
  }

  function setAvailable(uint16 _actionId, bool _isAvailable) external onlyOwner {
    require(actions[_actionId].skill != Skill.NONE, "Action does not exist");
    require(!actions[_actionId].isDynamic, "Action is dynamic");
    actions[_actionId].isAvailable = _isAvailable;
    emit SetAvailableAction(_actionId, _isAvailable);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
