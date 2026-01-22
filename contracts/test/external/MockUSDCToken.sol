//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDCToken is ERC20("USD Coin", "USDC") {
  error LengthMismatch();

  uint256 public amountBurnt;

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function burn(uint256 amount) external {
    amountBurnt += amount;
    _burn(_msgSender(), amount);
  }

  function decimals() public view override returns (uint8) {
    return 6;
  }
}
