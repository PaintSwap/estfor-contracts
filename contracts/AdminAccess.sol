// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {UnsafeMath, U256} from "@0xdoublesharp/unsafe-math/contracts/UnsafeMath.sol";

contract AdminAccess is UUPSUpgradeable, OwnableUpgradeable {
  using UnsafeMath for U256;
  using UnsafeMath for uint256;

  mapping(address admin => bool isAdmin) private _admins;
  mapping(address admin => bool isAdmin) private _promotionalAdmins;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address[] calldata admins, address[] calldata promotionalAdmins) public initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    _updateAdmins(admins, true);
    _updatePromotionalAdmins(promotionalAdmins, true);
  }

  function _updateAdmins(address[] calldata admins, bool hasAdmin) internal {
    U256 bounds = admins.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      _admins[admins[iter.asUint256()]] = hasAdmin;
    }
  }

  function _updatePromotionalAdmins(address[] calldata promotionalAdmins, bool hasAdmin) internal {
    U256 bounds = promotionalAdmins.length.asU256();
    for (U256 iter; iter < bounds; iter = iter.inc()) {
      _promotionalAdmins[promotionalAdmins[iter.asUint256()]] = hasAdmin;
    }
  }

  function isAdmin(address admin) external view returns (bool) {
    return _admins[admin];
  }

  function addAdmins(address[] calldata admins) external onlyOwner {
    _updateAdmins(admins, true);
  }

  function removeAdmins(address[] calldata admins) external onlyOwner {
    _updateAdmins(admins, false);
  }

  function isPromotionalAdmin(address admin) external view returns (bool) {
    return _promotionalAdmins[admin];
  }

  function addPromotionalAdmins(address[] calldata admins) external onlyOwner {
    _updatePromotionalAdmins(admins, true);
  }

  function removePromotionalAdmins(address[] calldata admins) external onlyOwner {
    _updatePromotionalAdmins(admins, false);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
