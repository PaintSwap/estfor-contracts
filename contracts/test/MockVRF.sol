// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IFulfillRandomWords {
  function fulfillRandomWords(bytes32 requestId, uint[] calldata randomWords) external;
}

contract MockVRF {
  uint counter = 1;
  uint randomWord = 1;
  uint numWords;

  function requestRandomWords(uint _numWords, uint) external returns (uint256 requestId) {
    requestId = counter;
    ++counter;
    numWords = _numWords;
  }

  function fulfill(uint _requestId, address _consumer) external {
    return this.fulfillSeeded(_requestId, _consumer, 777_666_555);
  }

  function fulfillSeeded(uint _requestId, address _consumer, uint _seed) external {
    IFulfillRandomWords consumer = IFulfillRandomWords(_consumer);
    uint256[] memory randomWords = new uint256[](numWords);
    for (uint i = 0; i < numWords; ++i) {
      randomWords[i] = uint(bytes32(_seed - i * i) | bytes32(_seed * i) | bytes32(randomWord++));
    }
    consumer.fulfillRandomWords(bytes32(_requestId), randomWords);
  }
}
