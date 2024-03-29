// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {IPaintSwapDecorator} from "../interfaces/IPaintSwapDecorator.sol";

contract BrushNonTransferrable is ERC20Upgradeable, UUPSUpgradeable, OwnableUpgradeable {
  error TransferFailed();

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() external initializer {
    __ERC20_init("BrushNonTransferrable", "FAKEBRUSH");
    __UUPSUpgradeable_init();
    __Ownable_init();
  }

  function mint(address _to, uint256 _amount) external onlyOwner {
    _mint(_to, _amount);
  }

  function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
    if (from != address(0) && from != owner() && to != owner()) {
      revert TransferFailed();
    }
    super._beforeTokenTransfer(from, to, amount);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
