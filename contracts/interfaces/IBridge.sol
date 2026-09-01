// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IBridge {
  error InvalidInputLength();
  error MessageAlreadyProcessed();
  error InvalidSourceChain();
  error UnknownMessageType();
  error PlayerAlreadyExists();

  function initialize(uint32 srcEid) external;

  function initializeAddresses(
    address petNFT,
    address itemNFT,
    address playerNFT,
    address players,
    address clans,
    address quests,
    address passiveActions
  ) external;
}
