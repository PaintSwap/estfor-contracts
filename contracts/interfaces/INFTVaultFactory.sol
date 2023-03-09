// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface INFTVaultFactory {
  struct CreationInfo {
    bool createdHere;
    uint16 version;
  }

  function creationInfo(address) external view returns (CreationInfo memory);

  function vaultAddresses(address, uint16) external view returns (address);

  function version() external view returns (uint16);
}
