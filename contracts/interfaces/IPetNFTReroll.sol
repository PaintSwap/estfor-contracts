// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ItemNFT} from "../ItemNFT.sol";
import {IPetNFT} from "./IPetNFT.sol";

interface IPetNFTReroll {
  event CompletePetReroll(address indexed user, uint256 indexed originalPetTokenId, uint256 indexed newPetTokenId, uint256 requestId);
  event RequestPetReroll(address indexed user, uint256 indexed petTokenId, uint256 requestId);
  error InvalidAddress(); error NotOwnerOfPet(); error NotOwnerOfPetShard(); error RequestDoesNotExist(); error NoRandomWords();
  function initialize(address owner, ItemNFT itemNFT, IPetNFT petNFT, address paintswapVRFConsumer) external;
  function rerollPet(uint256 petTokenId) external payable;
  function requestCost(uint256 numActions) external view returns (uint256);
}
