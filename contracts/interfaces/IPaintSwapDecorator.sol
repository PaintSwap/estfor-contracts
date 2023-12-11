// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPaintSwapDecorator {
  function deposit(uint pid, uint _amount) external;

  function pendingBrush(uint pid, address _user) external view returns (uint);

  function updatePool(uint pid) external;

  function poolInfo(
    uint pid
  ) external view returns (address lpToken, uint allocPoint, uint lastRewardBlock, uint accBrushPerShare);
}
