// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

contract MockOracleClient {
  uint counter = 1;
  uint randomWord = 1;
  uint numWords;

  function requestRandomWords(bytes32, uint64, uint16, uint32, uint32 _numWords) external returns (uint256 requestId) {
    requestId = counter;
    ++counter;
    if (numWords == 0) {
      numWords = _numWords;
    }
  }

  function fulfill(uint _requestId, address _consumer) external {
    VRFConsumerBaseV2 consumer = VRFConsumerBaseV2(_consumer);
    uint256[] memory randomWords = new uint256[](numWords);
    for (uint i = 0; i < numWords; ++i) {
      randomWords[i] = uint(blockhash(block.number - (i + 1)) | bytes32(randomWord));
      ++randomWord;
    }
    consumer.rawFulfillRandomWords(_requestId, randomWords);
  }
}
