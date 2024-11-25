// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract FakeDecoratorBrush is UUPSUpgradeable, ERC20Upgradeable, OwnableUpgradeable {
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() external initializer {
    __UUPSUpgradeable_init();
    __ERC20_init("FakeDecoratorBrush", "FAKEBRUSH");
    __Ownable_init(_msgSender());
  }

  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
  }

  function _update(address from, address to, uint256 amount) internal override {
    super._update(from, to, amount);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
