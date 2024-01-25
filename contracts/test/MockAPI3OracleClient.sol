// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFulfillRandomWords {
  function fulfillRandomWords(bytes32 requestId, bytes memory data) external;
}

contract MockAPI3OracleClient {
  uint counter = 1;
  uint randomWord = 1;
  uint numWords;

  function makeFullRequest(
    address,
    bytes32,
    address,
    address,
    address,
    bytes4,
    bytes memory _data
  ) external returns (uint256 requestId) {
    requestId = counter;
    ++counter;

    (, , uint _numWords) = abi.decode(_data, (bytes32, bytes32, uint));
    numWords = _numWords;
  }

  function fulfill(uint _requestId, address _consumer) external {
    IFulfillRandomWords consumer = IFulfillRandomWords(_consumer);
    uint256[] memory randomWords = new uint256[](numWords);
    for (uint i = 0; i < numWords; ++i) {
      randomWords[i] = uint(blockhash(block.number - (i + 1)) | bytes32(randomWord));
      ++randomWord;
    }
    bytes memory data = abi.encode(randomWords);
    consumer.fulfillRandomWords(bytes32(_requestId), data);
  }

  function setSponsorshipStatus(address, bool) external {}
}
