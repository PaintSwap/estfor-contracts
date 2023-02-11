// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./VRFConsumerBaseV2Upgradeable.sol";
import "./types.sol";

// Fantom VRF
// VRF 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634
// LINK token 0x6F43FF82CCA38001B6699a8AC47A2d0E66939407
// PREMIUM 0.0005 LINK
contract World is VRFConsumerBaseV2Upgradeable, UUPSUpgradeable, OwnableUpgradeable {
  event RequestSent(uint256 requestId, uint32 numWords);
  event RequestFulfilled(uint256 requestId, uint256 randomWord);
  event AddAction(uint actionId, Action action);
  event EditAction(uint actionId, Action action);
  event SetAvailableAction(uint actionId, bool available);
  event AddDynamicActions(uint[] actionIds);
  event RemoveDynamicActions(uint[] actionIds);
  event AddActionChoice(uint actionId, uint actionChoiceId, ActionChoice choice);
  event AddActionChoices(uint actionId, uint startActionChoice, ActionChoice[] choices);

  struct Action {
    ActionInfo info;
    ActionReward[] dropRewards;
    ActionLoot[] lootChances;
    CombatStats combatStats;
  }

  VRFCoordinatorV2Interface COORDINATOR;

  // Your subscription ID.
  uint64 subscriptionId;

  // Past request ids
  uint[] public requestIds; // Each one is a seed for a day
  mapping(uint requestId => uint randomWord) public randomWords; /* requestId --> random word */
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
  uint public lastActionId;
  uint public actionChoiceId;
  uint[] private lastAddedDynamicActions;
  uint public lastDynamicUpdatedTime;

  mapping(uint actionId => mapping(uint choiceId => ActionChoice)) public actionChoices; // action id => (choice id => Choice)
  mapping(uint actionId => ActionReward[] dropRewards) dropRewards; // action id => dropRewards
  mapping(uint actionId => ActionLoot[] lootChance) lootChances; // action id => loot chances
  mapping(uint actionId => CombatStats combatStats) actionCombatStats; // action id => combat stats

  function initialize(VRFCoordinatorV2Interface _coordinator, uint64 _subscriptionId) public initializer {
    __VRFConsumerBaseV2_init(address(_coordinator));
    __Ownable_init();
    __UUPSUpgradeable_init();

    COORDINATOR = _coordinator;
    subscriptionId = _subscriptionId;
    lastActionId = 1;
    actionChoiceId = 1;
    startTime = block.timestamp;
  }

  function requestSeedUpdate() external returns (uint256 requestId) {
    // Last one has not been fulfilled yet
    if (requestIds.length > 0) {
      require(requestIds[requestIds.length - 1] != 0, "Seed can't be updated");
    }

    require(lastSeedUpdatedTime + MIN_SEED_UPDATE_TIME <= block.timestamp, "Can only request after 1 day has passed");

    // Will revert if subscription is not set and funded.
    requestId = COORDINATOR.requestRandomWords(
      keyHash,
      subscriptionId,
      requestConfirmations,
      callbackGasLimit,
      numWords
    );

    requestIds.push(requestId);
    lastSeedUpdatedTime = lastSeedUpdatedTime == 0 ? block.timestamp : lastSeedUpdatedTime + MIN_SEED_UPDATE_TIME;
    emit RequestSent(requestId, numWords);
    return requestId;
  }

  function fulfillRandomWords(uint256 _requestId, uint256[] memory _randomWords) internal override {
    require(_requestId == requestIds[requestIds.length - 1], "request not found");
    require(randomWords[_requestId] == 0, "Request already been satisfied");

    uint random = _randomWords[0];
    if (random == 0) {
      // Not sure if 0 can be selected, but in case use previous block hash as pseudo random number
      random = uint(blockhash(block.number - 1));
    }

    randomWords[_requestId] = random;
    emit RequestFulfilled(_requestId, random);
  }

  function hasSeed(uint timestamp) external view returns (bool) {
    uint offset = (timestamp - startTime) / MIN_SEED_UPDATE_TIME;
    return offset > 0 && requestIds.length >= offset;
  }

  function getSeed(uint timestamp) public view returns (uint seed) {
    uint offset = (timestamp - startTime) / MIN_SEED_UPDATE_TIME;
    seed = randomWords[requestIds[offset - 1]];
    require(seed > 0, "No valid seed");
  }

  // Can be called by anyone as long as over 1 day has passed since the last call
  function updateDynamicActions() external {
    require(
      (lastDynamicUpdatedTime + MIN_DYNAMIC_ACTION_UPDATE_TIME) <= block.timestamp,
      "Can only request after 1 day has passed"
    );

    emit RemoveDynamicActions(lastAddedDynamicActions);

    // These are no longer available as existing actions
    for (uint i = 0; i < lastAddedDynamicActions.length; ++i) {
      actions[lastAddedDynamicActions[i]].isAvailable = false;
    }

    delete lastAddedDynamicActions;
    uint seed = getSeed(block.timestamp);

    uint[] memory actionIdsToAdd = new uint[](1);

    if (seed % 2 == 0) {
      // If it's even do X
      actionIdsToAdd[0] = 1; // ?
    } else {
      actionIdsToAdd[0] = 2; // ?
    }

    lastAddedDynamicActions = actionIdsToAdd;

    for (uint i; i < actionIdsToAdd.length; ++i) {
      actions[actionIdsToAdd[i]].isAvailable = false;
    }

    lastDynamicUpdatedTime = block.timestamp;
    emit AddDynamicActions(actionIdsToAdd);
  }

  function getSkill(uint _actionId) external view returns (Skill) {
    return actions[_actionId].skill;
  }

  function getDropAndLoot(uint _actionId) external view returns (ActionReward[] memory, ActionLoot[] memory) {
    return (dropRewards[_actionId], lootChances[_actionId]);
  }

  function getPermissibleItemsForAction(
    uint _actionId
  )
    external
    view
    returns (
      uint16 itemTokenIdRangeMin,
      uint16 itemTokenIdRangeMax,
      uint16 auxItemTokenIdRangeMin,
      uint16 auxItemTokenIdRangeMax
    )
  {
    ActionInfo storage actionInfo = actions[_actionId];
    return (
      actionInfo.itemTokenIdRangeMin,
      actionInfo.itemTokenIdRangeMax,
      actionInfo.auxItemTokenIdRangeMin,
      actionInfo.auxItemTokenIdRangeMax
    );
  }

  function getXPPerHour(uint16 _actionId, uint16 _actionChoiceId) external view returns (uint16 xpPerHour) {
    return
      _actionChoiceId != 0 ? actionChoices[_actionId][_actionChoiceId].baseXPPerHour : actions[_actionId].baseXPPerHour;
  }

  function _setAction(uint _actionId, Action calldata _action) private {
    require(_action.info.itemTokenIdRangeMin <= _action.info.itemTokenIdRangeMax);
    actions[_actionId] = _action.info;
    if (_action.dropRewards.length > 0) {
      dropRewards[_actionId] = _action.dropRewards;
    }
    if (_action.lootChances.length > 0) {
      lootChances[_actionId] = _action.lootChances;
    }
    if (_action.info.isCombat) {
      actionCombatStats[_actionId] = _action.combatStats;
    }
  }

  function _addAction(uint _actionId, Action calldata _action) private {
    require(!_action.info.isDynamic, "Action is dynamic");
    _setAction(_actionId, _action);
    emit AddAction(_actionId, _action);
  }

  function addActions(Action[] calldata _actions) external onlyOwner {
    uint currentActionId = lastActionId;
    for (uint i; i < _actions.length; ++i) {
      _addAction(currentActionId + i, _actions[i]);
    }
    lastActionId += _actions.length;
  }

  function addAction(Action calldata _action) external onlyOwner {
    _addAction(lastActionId, _action);
    ++lastActionId;
  }

  function editAction(uint _actionId, Action calldata _action) external onlyOwner {
    _setAction(_actionId, _action);
    emit EditAction(_actionId, _action);
  }

  // actionId of 0 means it is not tied to a specific action
  function addActionChoice(uint _actionId, ActionChoice calldata _actionChoice) external onlyOwner {
    uint currentActionChoiceId = actionChoiceId;
    actionChoices[_actionId][currentActionChoiceId] = _actionChoice;
    emit AddActionChoice(_actionId, currentActionChoiceId, _actionChoice);
    actionChoiceId = currentActionChoiceId + 1;
  }

  function addActionChoices(uint _actionId, ActionChoice[] calldata _actionChoices) external onlyOwner {
    require(_actionChoices.length > 0);
    uint currentActionChoiceId = actionChoiceId;
    for (uint i; i < _actionChoices.length; ++i) {
      actionChoices[_actionId][currentActionChoiceId + i] = _actionChoices[i];
    }
    emit AddActionChoices(_actionId, currentActionChoiceId, _actionChoices);
    actionChoiceId = currentActionChoiceId + _actionChoices.length;
  }

  function addBulkActionChoices(
    uint[] calldata _actionIds,
    ActionChoice[][] calldata _actionChoices
  ) external onlyOwner {
    require(_actionChoices.length > 0);
    uint currentActionChoiceId = actionChoiceId;
    uint count;
    for (uint i; i < _actionIds.length; ++i) {
      uint actionId = _actionIds[i];
      emit AddActionChoices(actionId, currentActionChoiceId + count, _actionChoices[i]);
      for (uint j; j < _actionChoices[i].length; ++j) {
        actionChoices[actionId][currentActionChoiceId + count] = _actionChoices[i][j];
        ++count;
      }
    }
    actionChoiceId = currentActionChoiceId + count;
  }

  function setAvailable(uint _actionId, bool _isAvailable) external onlyOwner {
    require(actions[_actionId].skill != Skill.NONE, "Action does not exist");
    require(!actions[_actionId].isDynamic, "Action is dynamic");
    actions[_actionId].isAvailable = _isAvailable;
    emit SetAvailableAction(_actionId, _isAvailable);
  }

  function actionIsAvailable(uint _actionId) external view returns (bool) {
    return actions[_actionId].isAvailable;
  }

  function getCombatStats(uint _actionId) external view returns (bool isCombat, CombatStats memory stats) {
    isCombat = actions[_actionId].isCombat;
    if (isCombat) {
      stats = actionCombatStats[_actionId];
    }
  }

  function getActionChoice(uint _actionId, uint _choiceId) external view returns (ActionChoice memory) {
    return actionChoices[_actionId][_choiceId];
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
