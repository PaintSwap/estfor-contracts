//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BankProxy {
  // We use this so that we can update the implementation for all that uses the minimal proxy
  address immutable bankProxyImpl;

  constructor(address _bankProxyImpl) {
    bankProxyImpl = _bankProxyImpl;
  }

  fallback() external payable {
    address addr = bankProxyImpl;
    assembly {
      calldatacopy(0x0, 0x0, calldatasize())
      let result := delegatecall(gas(), addr, 0x0, calldatasize(), 0x0, 0)
      returndatacopy(0x0, 0x0, returndatasize())
      switch result
      case 0 {
        revert(0, returndatasize())
      }
      default {
        return(0, returndatasize())
      }
    }
  }
}
