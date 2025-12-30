// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IFulfillRandomWords {
  function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}

contract MockVRF {
  uint256 private _counter = 1;
  uint256 private _randomWord = 1;
  uint256 private _numWords;
  uint256 constant SEED = 777_666_555;

  error InsufficientGasPayment(uint256 provided, uint256 required);

  function fulfill(uint256 requestId, address consumerAddress) external {
    return fulfillSeeded(requestId, consumerAddress, SEED);
  }

  function fulfillSeeded(uint256 requestId, address consumerAddress, uint256 seed) public {
    IFulfillRandomWords consumer = IFulfillRandomWords(consumerAddress);
    uint256[] memory randomWords = new uint256[](_numWords);
    for (uint256 i = 0; i < _numWords; ++i) {
      randomWords[i] = uint256(keccak256(abi.encodePacked(seed + _randomWord++)));
    }
    consumer.rawFulfillRandomWords(requestId, randomWords);
  }

  // Calculate the cost of a request
  function calculateRequestPriceNative(uint256 callbackGasLimit) public view returns (uint256 requestPrice) {
    return callbackGasLimit;
  }

  function requestRandomnessPayInNative(
    uint256 callbackGasLimit,
    uint256 numWords,
    address /*refundee*/
  ) external payable returns (uint256 requestId) {
    uint256 requiredPayment = calculateRequestPriceNative(callbackGasLimit);
    require(requiredPayment <= msg.value, InsufficientGasPayment(msg.value, requiredPayment));

    requestId = _counter;
    ++_counter;
    _numWords = numWords;
  }
}
