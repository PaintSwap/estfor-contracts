pragma solidity ^0.8.0;
//SPDX-License-Identifier: MIT
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockWrappedFantom {
  event Approval(address indexed src, address indexed guy, uint wad);
  event Transfer(address indexed src, address indexed dst, uint wad);
  event Deposit(address indexed dst, uint wad);
  event Withdrawal(address indexed src, uint wad);

  error InsufficientBalance();
  error InsufficientAllowance();

  string public name = "Wrapped Ftm";
  string public symbol = "WFTM";
  uint8 public decimals = 18;

  mapping(address user => uint balance) public balanceOf;
  mapping(address => mapping(address => uint)) public allowance;

  receive() external payable {
    deposit();
  }

  function deposit() public payable {
    balanceOf[msg.sender] += msg.value;
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint wad) public {
    if (balanceOf[msg.sender] < wad) {
      revert InsufficientBalance();
    }
    balanceOf[msg.sender] -= wad;
    payable(msg.sender).transfer(wad);
    emit Withdrawal(msg.sender, wad);
  }

  function totalSupply() public view returns (uint) {
    return address(this).balance;
  }

  function approve(address guy, uint wad) public returns (bool) {
    allowance[msg.sender][guy] = wad;
    emit Approval(msg.sender, guy, wad);
    return true;
  }

  function transfer(address dst, uint wad) public returns (bool) {
    return transferFrom(msg.sender, dst, wad);
  }

  function transferFrom(address src, address dst, uint wad) public returns (bool) {
    if (balanceOf[src] < wad) {
      revert InsufficientBalance();
    }

    if (src != msg.sender && allowance[src][msg.sender] != type(uint).max) {
      if (allowance[src][msg.sender] < wad) {
        revert InsufficientAllowance();
      }
      allowance[src][msg.sender] -= wad;
    }

    balanceOf[src] -= wad;
    balanceOf[dst] += wad;

    emit Transfer(src, dst, wad);

    return true;
  }
}
