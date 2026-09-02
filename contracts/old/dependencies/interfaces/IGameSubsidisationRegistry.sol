// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IGameSubsidisationRegistry {
  error LengthMismatch();

  function functionToLimitGroup(address _contract, bytes4 _selector) external view returns (uint256);
  function groupDailyLimits(uint256 _groupId) external view returns (uint256);
  function getGroupAndLimit(address _contract, bytes4 _selector) external view returns (uint256 groupId, uint256 limit);

  function setFunctionGroup(address _contract, bytes4 _selector, uint256 _groupId) external;
  function setFunctionGroups(
    address[] calldata _contracts,
    bytes4[] calldata _selectors,
    uint256[] calldata _groupIds
  ) external;
  function setGroupLimit(uint256 _groupId, uint256 _limit) external;
  function setGroupLimits(uint256[] calldata _groupIds, uint256[] calldata _limits) external;
}
