// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

import {IBrushToken} from "./interfaces/external/IBrushToken.sol";

contract Treasury is UUPSUpgradeable, OwnableUpgradeable {
  using EnumerableMap for EnumerableMap.AddressToUintMap;

  event SetFundAllocationPercentages(address[] accounts, uint256[] percentages);

  error OnlyTerritories();
  error OnlySpenders();
  error LengthMismatch();
  error TotalPercentageNot100(uint percent);

  EnumerableMap.AddressToUintMap private _accountsToPercentage;
  IBrushToken private _brush;
  address private _territories;
  mapping(address spender => bool) private _spenders;

  modifier onlySpenders() {
    require(_isSpender(_msgSender()), OnlySpenders());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(IBrushToken brush) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());
    _brush = brush;
  }

  function _isSpender(address operator) private view returns (bool) {
    return _spenders[operator];
  }

  function totalClaimable(address account) public view returns (uint256 total) {
    (bool success, uint256 percent) = _accountsToPercentage.tryGet(account);
    if (!success) {
      return 0;
    }
    return (_brush.balanceOf(address(this)) * percent) / 100;
  }

  function spend(address to, uint256 amountBrush) external onlySpenders {
    _brush.transfer(to, amountBrush);
  }

  // What accounts are given access to what funds of the treasury
  function setFundAllocationPercentages(
    address[] calldata accounts,
    uint256[] calldata percentages
  ) external onlyOwner {
    require(accounts.length == percentages.length, LengthMismatch());
    uint256 totalPercentage;

    // Clear the old accounts
    uint256 length = _accountsToPercentage.length();
    for (uint256 i = 0; i < length; ++i) {
      (address account, ) = _accountsToPercentage.at(0);
      _accountsToPercentage.remove(account);
    }

    for (uint256 i = 0; i < accounts.length; ++i) {
      _accountsToPercentage.set(accounts[i], percentages[i]);
      totalPercentage += percentages[i];
    }
    require(totalPercentage == 100, TotalPercentageNot100(totalPercentage));
    emit SetFundAllocationPercentages(accounts, percentages);
  }

  function setSpenders(address[] calldata spenders, bool isSpender) external onlyOwner {
    for (uint256 i; i < spenders.length; ++i) {
      _spenders[spenders[i]] = isSpender;
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
