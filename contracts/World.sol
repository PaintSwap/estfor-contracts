// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import {Player} from "./Player.sol";

// Fantom VRF
// VRF 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634
// LINK token 0x6F43FF82CCA38001B6699a8AC47A2d0E66939407
// PREMIUM 0.0005 LINK
contract World is VRFConsumerBaseV2 {
  event RequestSent(uint256 requestId, uint32 numWords);
  event RequestFulfilled(uint256 requestId, uint256 randomWord);

  VRFCoordinatorV2Interface COORDINATOR;

  // Your subscription ID.
  uint64 subscriptionId;

  // Past request ids
  uint[] public requestIds; // Each one is a seed for a day
  mapping(uint256 => uint) public randomWords; /* requestId --> random word */
  uint public lastUpdatedTime;

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
      (lastUpdatedTime + MIN_SEED_UPDATE_TIME <= block.timestamp) ||
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
    lastUpdatedTime = block.timestamp;
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

  function getSeed(uint timestamp) external view {
    uint offset = (timestamp - startTime) / MIN_SEED_UPDATE_TIME;
    requestIds[offset];
  }

  function spawnRaid() external {}
}
