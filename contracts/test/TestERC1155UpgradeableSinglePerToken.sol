//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155UpgradeableSinglePerToken} from "../ozUpgradeable/token/ERC1155/ERC1155UpgradeableSinglePerToken.sol";
import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

contract TestERC1155UpgradeableSinglePerToken is UUPSUpgradeable, OwnableUpgradeable, ERC1155UpgradeableSinglePerToken {
  function initialize() external initializer {
    __ERC1155_init("");
    __UUPSUpgradeable_init();
    __Ownable_init();
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
