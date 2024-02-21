// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISamWitchVRF {
  function requestRandomWords(uint numWords, uint callbackGasLimit) external returns (bytes32 requestId);
}
