// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

contract MockOracleClient {
  uint counter = 1;

  function requestRandomWords(bytes32, uint64, uint16, uint32, uint32) external returns (uint256 requestId) {
    requestId = counter;
    ++counter;
  }

  function fulfill(uint _requestId, address _consumer) external {
    VRFConsumerBaseV2 consumer = VRFConsumerBaseV2(_consumer);
    uint256[] memory randomWords = new uint256[](1);
    randomWords[0] = uint(blockhash(block.number - 1) | bytes32(counter));
    consumer.rawFulfillRandomWords(_requestId, randomWords);
  }
}
