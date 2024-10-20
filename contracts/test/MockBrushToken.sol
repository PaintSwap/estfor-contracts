//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockBrushToken is ERC20("PaintSwap Token", "BRUSH") {
  error LengthMismatch();

  uint256 public amountBurnt;

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }

  function burn(uint256 amount) external {
    amountBurnt += amount;
    _burn(msg.sender, amount);
  }

  function burnFrom(address account, uint256 amount) public virtual {
    amountBurnt += amount;
    _spendAllowance(account, _msgSender(), amount);
    _burn(account, amount);
  }

  // If to is address(0), it burns the tokens
  function transferFromBulk(address from, address[] calldata tos, uint256[] calldata amounts) external {
    require(tos.length == amounts.length, LengthMismatch());
    for (uint256 i = 0; i < tos.length; ++i) {
      uint256 amount = amounts[i];
      if (tos[i] == address(0)) {
        burnFrom(from, amount);
      } else {
        transferFrom(from, tos[i], amounts[i]);
      }
    }
  }
}
