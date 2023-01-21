// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./enums.sol";

// Fantom VRF
// VRF 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634
// LINK token 0x6F43FF82CCA38001B6699a8AC47A2d0E66939407
// PREMIUM 0.0005 LINK
contract World is VRFConsumerBaseV2, Ownable {
  event RequestSent(uint256 requestId, uint32 numWords);
  event RequestFulfilled(uint256 requestId, uint256 randomWord);

  event AddAction(uint actionId, ActionInfo actionInfo, ActionReward[] dropRewards, ActionLoot[] lootChances);
  event EditAction(uint actionId, ActionInfo actionInfo, ActionReward[] dropRewards, ActionLoot[] lootChances);

  event SetAvailableAction(uint actionId, bool available);

  event AddDynamicActions(uint[] actionIds);
  event RemoveDynamicActions(uint[] actionIds);

  event AddIO(uint actionId, uint ioId, NonCombat craftDetails);
  event AddIOs(uint actionId, uint startIoId, NonCombat[] craftDetails);

  VRFCoordinatorV2Interface COORDINATOR;

  // Your subscription ID.
  uint64 subscriptionId;

  // Past request ids
  uint[] public requestIds; // Each one is a seed for a day
  mapping(uint256 => uint) public randomWords; /* requestId --> random word */
  uint public lastSeedUpdatedTime;

  uint immutable startTime = block.timestamp;

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

  mapping(uint => ActionInfo) public actions; // action id => base action info
  uint public lastActionId = 1;
  uint public ioId = 1;
  uint[] private lastAddedDynamicActions;
  uint public lastDynamicUpdatedTime;

  mapping(uint => mapping(uint => NonCombat)) public ios; // action id => (craft id => craft details). Crafting isn't the skill but general
  mapping(uint => ActionReward[]) dropRewards; // action id => dropRewards
  mapping(uint => ActionLoot[]) lootChances; // action id => loot chances

  constructor(VRFCoordinatorV2Interface coordinator, uint64 _subscriptionId) VRFConsumerBaseV2(address(coordinator)) {
    COORDINATOR = coordinator;
    subscriptionId = _subscriptionId;
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

  function getXPPerHour(uint16 _actionId, uint16 _ioId, bool fromIoId) external view returns (uint16 xpPerHour) {
    return fromIoId ? ios[_actionId][_ioId].baseXPPerHour : actions[_actionId].baseXPPerHour;
  }

  function _setAction(
    uint _actionId,
    ActionInfo calldata _actionInfo,
    ActionReward[] calldata _dropRewards,
    ActionLoot[] calldata _lootChances
  ) private {
    require(_actionInfo.itemTokenIdRangeMin <= _actionInfo.itemTokenIdRangeMax);
    actions[_actionId] = _actionInfo;
    if (_dropRewards.length > 0) {
      dropRewards[_actionId] = _dropRewards;
    }
    if (_lootChances.length > 0) {
      lootChances[_actionId] = _lootChances;
    }
  }

  function _addAction(
    ActionInfo calldata _actionInfo,
    uint _actionId,
    ActionReward[] calldata _dropRewards,
    ActionLoot[] calldata _lootChances
  ) private {
    _setAction(_actionId, _actionInfo, _dropRewards, _lootChances);
    emit AddAction(_actionId, _actionInfo, _dropRewards, _lootChances);
    require(!_actionInfo.isDynamic, "Action is dynamic");
  }

  function addActions(
    ActionInfo[] calldata _actionInfos,
    ActionReward[][] calldata _dropRewards,
    ActionLoot[][] calldata _lootChances
  ) external onlyOwner {
    uint currentActionId = lastActionId;
    for (uint i; i < _actionInfos.length; ++i) {
      _addAction(_actionInfos[i], currentActionId + i, _dropRewards[i], _lootChances[i]);
    }
    lastActionId += _actionInfos.length;
  }

  function addAction(
    ActionInfo calldata _actionInfo,
    ActionReward[] calldata _dropRewards,
    ActionLoot[] calldata _lootChances
  ) external onlyOwner {
    _addAction(_actionInfo, lastActionId, _dropRewards, _lootChances);
    ++lastActionId;
  }

  function editAction(
    uint _actionId,
    ActionInfo calldata _actionInfo,
    ActionReward[] calldata _dropRewards,
    ActionLoot[] calldata _lootChances
  ) external onlyOwner {
    _setAction(_actionId, _actionInfo, _dropRewards, _lootChances);
    emit EditAction(_actionId, _actionInfo, _dropRewards, _lootChances);
  }

  function addIO(uint _actionId, NonCombat calldata _craftDetails) external onlyOwner {
    uint currentIoId = ioId;
    ios[_actionId][currentIoId] = _craftDetails;
    emit AddIO(_actionId, currentIoId, _craftDetails);
    ioId = currentIoId + 1;
  }

  function addIOs(uint _actionId, NonCombat[] calldata _craftingDetails) external onlyOwner {
    require(_craftingDetails.length > 0);
    uint currentIoId = ioId;
    for (uint i; i < _craftingDetails.length; ++i) {
      ios[_actionId][currentIoId] = _craftingDetails[i];
    }
    emit AddIOs(_actionId, currentIoId, _craftingDetails);
    ioId = currentIoId + _craftingDetails.length;
  }

  /*
  function removeCrafting(uint _actionId, uint16 _craftId) external onlyOwner {
  } */

  // function addMagicAttack

  function setAvailable(uint _actionId, bool _isAvailable) external onlyOwner {
    require(actions[_actionId].skill != Skill.NONE, "Action does not exist");
    require(!actions[_actionId].isDynamic, "Action is dynamic");
    actions[_actionId].isAvailable = _isAvailable;
    emit SetAvailableAction(_actionId, _isAvailable);
  }

  function actionIsAvailable(uint _actionId) external view returns (bool) {
    return actions[_actionId].isAvailable;
  }
}
