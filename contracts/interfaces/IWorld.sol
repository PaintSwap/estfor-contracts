// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IWorld {
  function getXPPerHour(uint16 actionId, uint16 actionChoiceId) external view returns (uint24 xpPerHour);

  function getNumSpawn(uint16 actionId) external view returns (uint256 numSpawned);

  function getActionSuccessPercentAndMinXP(uint16 actionId) external view returns (uint8 successPercent, uint32 minXP);
}
