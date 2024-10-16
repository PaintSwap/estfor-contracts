// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IPaintSwapDecorator {
  function deposit(uint256 pid, uint256 _amount) external;

  function pendingBrush(uint256 pid, address _user) external view returns (uint256);

  function updatePool(uint256 pid) external;

  function poolInfo(
    uint256 pid
  ) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accBrushPerShare);
}
