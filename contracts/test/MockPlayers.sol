//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockPlayers {
  function beforeItemNFTTransfer(
    address from,
    address to,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) external {}
}
