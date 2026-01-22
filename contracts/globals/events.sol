// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct GlobalEventInfo {
  uint40 startTime;
  uint40 endTime; // if 0, then no end time
  uint24 rewardItemTokenId; // item to be rewarded for for sending in input items (usually an event-specific coin)
  uint24 rewardItemAmountPerInput; // amount of reward items given per input item
  uint24 inputItemTokenId; // item to be collected for the event
  uint24 inputItemMaxAmount; // when filled, the event ends. if 0, then no max amount
  uint24 totalInputAmount; // amount of input items collected so far
}