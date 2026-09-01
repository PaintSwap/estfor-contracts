// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Supply ABI supplied by OpenZeppelin ERC1155Supply implementations.
interface IERC1155Supply {
  function totalSupply(uint256 id) external view returns (uint256);
  function totalSupply() external view returns (uint256);
}
