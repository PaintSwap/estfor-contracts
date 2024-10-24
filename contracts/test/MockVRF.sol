// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IFulfillRandomWords {
  function fulfillRandomWords(bytes32 requestId, uint256[] calldata randomWords) external;
}

contract MockVRF {
  uint256 private _counter = 1;
  uint256 private _randomWord = 1;
  uint256 private _numWords;
  uint256 constant SEED = 777_666_555;

  function requestRandomWords(uint256 numWords, uint256) external returns (uint256 requestId) {
    requestId = _counter;
    ++_counter;
    _numWords = numWords;
  }

  function fulfill(uint256 requestId, address consumerAddress) external {
    return fulfillSeeded(requestId, consumerAddress, SEED);
  }

  function fulfillSeeded(uint256 requestId, address consumerAddress, uint256 seed) public {
    IFulfillRandomWords consumer = IFulfillRandomWords(consumerAddress);
    uint256[] memory randomWords = new uint256[](_numWords);
    for (uint256 i = 0; i < _numWords; ++i) {
      randomWords[i] = uint256(keccak256(abi.encodePacked(seed + _randomWord++)));
    }
    consumer.fulfillRandomWords(bytes32(requestId), randomWords);
  }
}
