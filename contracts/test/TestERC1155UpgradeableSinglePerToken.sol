//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1155UpgradeableSinglePerToken} from "../ozUpgradeable/token/ERC1155/ERC1155UpgradeableSinglePerToken.sol";
import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

contract TestERC1155UpgradeableSinglePerToken is UUPSUpgradeable, OwnableUpgradeable, ERC1155UpgradeableSinglePerToken {
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() external initializer {
    __ERC1155_init("");
    __UUPSUpgradeable_init();
    __Ownable_init();
  }

  function mint(address account, uint256 id, uint256 amount, bytes memory data) external {
    _mint(account, id, amount, data);
  }

  function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external {
    _mintBatch(to, ids, amounts, data);
  }

  function burn(address account, uint256 id, uint256 amount) external {
    _burn(account, id, amount);
  }

  function burnBatch(address account, uint256[] memory ids, uint256[] memory amounts) external {
    _burnBatch(account, ids, amounts);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
