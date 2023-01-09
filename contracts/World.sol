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

  constructor(VRFCoordinatorV2Interface coordinator, uint64 _subscriptionId) VRFConsumerBaseV2(address(coordinator)) {
    COORDINATOR = coordinator;
    subscriptionId = _subscriptionId;
  }

  function requestSeedUpdate() external returns (uint256 requestId) {
    // Can only request if there has
    // Last one has not been fulfilled yet
    if (requestIds.length > 0) {
      require(requestIds[requestIds.length - 1] != 0);
    }

    require(
      (lastSeedUpdatedTime + MIN_SEED_UPDATE_TIME <= block.timestamp) ||
        (block.timestamp - startTime) / MIN_SEED_UPDATE_TIME >= requestIds.length,
      "Can only request after 1 day has passed or the random seeds have fallen too far behind"
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
    lastSeedUpdatedTime = block.timestamp;
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

  function getSeed(uint timestamp) public view returns (uint seed) {
    uint offset = (timestamp - startTime) / MIN_SEED_UPDATE_TIME;
    seed = randomWords[requestIds[offset]];
    require(seed > 0);
  }

  mapping(uint => ActionInfo) public actions; // action id => action info
  uint public lastActionId = 1;
  mapping(uint => bool) public availableActions; // action id => available
  uint[] private lastAddedDynamicActions;
  uint public lastDynamicUpdatedTime;

  event AddAction(uint _actionId, ActionInfo actionInfo);
  event EditAction(uint _actionId, ActionInfo actionInfo);

  event AddAvailableAction(uint actionId);
  event RemoveAvailabelAction(uint actionId);

  event AddDynamicActions(uint[] actionIds);
  event RemoveDynamicActions(uint[] actionIds);

  function addAction(ActionInfo calldata _actionInfo) external onlyOwner {
    _setAction(lastActionId, _actionInfo);
    emit AddAction(lastActionId, _actionInfo);
    ++lastActionId;
  }

  function editAction(uint _actionId, ActionInfo calldata _actionInfo) external onlyOwner {
    _setAction(_actionId, _actionInfo);
    emit EditAction(_actionId, _actionInfo);
  }

  function _setAction(uint _actionId, ActionInfo calldata _actionInfo) private {
    require(_actionInfo.itemTokenIdRangeMax < 256);
    require(_actionInfo.itemTokenIdRangeMin < _actionInfo.itemTokenIdRangeMax);
    actions[_actionId] = _actionInfo;
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
      delete availableActions[lastAddedDynamicActions[i]];
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
      availableActions[actionIdsToAdd[i]] = true;
    }

    lastDynamicUpdatedTime = block.timestamp;
    emit AddDynamicActions(actionIdsToAdd);
  }

  function getSkill(uint _actionId) external view returns (Skill) {
    return actions[_actionId].skill;
  }

  // What things are available to do?

  /* Raids */
  /*  event NewRaid(uint raidId);
  event JoinedRaid(address player, uint raidId);
  event LeaveRaid(address player, uint raidId);

  // Up to 100 people can join a raid, level difficulty (easy, medium, hard)

  // A share of the spoils
  uint raidId = 1;

  mapping(uint => RaidInfo) raids; // Raid id

  function newRaid(uint40 _startTime, uint40 _timespan) external onlyOwner {
    require(_startTime > block.timestamp);
    require(_timespan <= 12 hours);

    uint _raidId = raidId;
    RaidInfo storage raidInfo = raids[_raidId];
    raidInfo.startTime = _startTime;
    raidInfo.timespan = _timespan;

    emit NewRaid(raidId);
    unchecked {
      raidId = _raidId + 1;
    }
  }

  uint public constant MAX_MEMBERS = 1000;

  struct RaidInfo {
    uint40 startTime;
    uint40 timespan;
    uint numMembers;
    //    uint totalAttack;
    //    uint totalDefence;
    mapping(address => bool) members;
  } */
}
