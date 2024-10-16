// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IFulfillRandomWords {
  function fulfillRandomWords(bytes32 requestId, uint256[] calldata randomWords) external;
}

contract MockVRF {
  uint256 counter = 1;
  uint256 randomWord = 1;
  uint256 numWords;
  uint256 constant SEED = 777_666_555;

  function requestRandomWords(uint256 _numWords, uint256) external returns (uint256 requestId) {
    requestId = counter;
    ++counter;
    numWords = _numWords;
  }

  function fulfill(uint256 _requestId, address _consumer) external {
    return fulfillSeeded(_requestId, _consumer, SEED);
  }

  function fulfillSeeded(uint256 _requestId, address _consumer, uint256 _seed) public {
    IFulfillRandomWords consumer = IFulfillRandomWords(_consumer);
    uint256[] memory randomWords = new uint256[](numWords);
    for (uint256 i = 0; i < numWords; ++i) {
      randomWords[i] = uint256(keccak256(abi.encodePacked(_seed + randomWord++)));
    }
    consumer.fulfillRandomWords(bytes32(_requestId), randomWords);
  }
}
