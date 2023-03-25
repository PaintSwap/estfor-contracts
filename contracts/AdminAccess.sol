// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract AdminAccess is UUPSUpgradeable, OwnableUpgradeable {
  mapping(address admin => bool isAdmin) private admins;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address[] calldata _admins) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();
    for (uint i; i < _admins.length; ++i) {
      admins[_admins[i]] = true;
    }
  }

  function addAdmins(address[] calldata _admins) external onlyOwner {
    for (uint i = 0; i < _admins.length; ++i) {
      admins[_admins[i]] = true;
    }
  }

  function addAdmin(address _admin) external onlyOwner {
    admins[_admin] = true;
  }

  function removeAdmin(address _admin) external onlyOwner {
    admins[_admin] = false;
  }

  function isAdmin(address _admin) external view returns (bool) {
    return admins[_admin];
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
