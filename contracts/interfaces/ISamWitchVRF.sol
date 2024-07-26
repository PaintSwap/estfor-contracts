// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISamWitchVRF {
  function requestRandomWords(uint numWords, uint callbackGasLimit) external returns (bytes32 requestId);

  function fulfillRandomWords(
    bytes32 requestId,
    address oracle,
    address fulfillAddress,
    uint256 callbackGasLimit,
    uint256 numWords,
    uint256[2] calldata publicKey,
    uint256[4] calldata proof,
    uint256[2] calldata uPoint,
    uint256[4] calldata vComponents
  ) external returns (bool callSuccess);
}
