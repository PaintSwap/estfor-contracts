// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IGameRegistry {

  function functionToLimitGroup(address _contract, bytes4 _selector) external view returns (uint256);
  function groupDailyLimits(uint256 _groupId) external view returns (uint256);

  function setFunctionGroup(address _contract, bytes4 _selector, uint256 _groupId) external;
  function setGroupLimit(uint256 _groupId, uint256 _limit) external;
}
