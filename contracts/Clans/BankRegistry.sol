// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract BankRegistry is UUPSUpgradeable, OwnableUpgradeable {
  error LengthMismatch();

  mapping(address depositor => bool allowed) private _forceItemDepositors;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() external initializer {
    __Ownable_init(_msgSender());
    __UUPSUpgradeable_init();
  }

  function setForceItemDepositors(address[] calldata depositors, bool[] calldata allowed) external onlyOwner {
    require(depositors.length == allowed.length, LengthMismatch());
    for (uint256 i = 0; i < depositors.length; i++) {
      _forceItemDepositors[depositors[i]] = allowed[i];
    }
  }

  function isForceItemDepositor(address depositor) external view returns (bool) {
    return _forceItemDepositors[depositor];
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
