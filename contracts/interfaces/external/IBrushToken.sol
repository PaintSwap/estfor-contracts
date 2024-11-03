// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBrushToken is IERC20 {
  function burn(uint256 amount) external;

  function burnFrom(address account, uint256 amount) external;

  function transferFromBulk(address from, address[] calldata tos, uint256[] calldata amounts) external;

  function transferOwnership(address newOwner) external;
}
