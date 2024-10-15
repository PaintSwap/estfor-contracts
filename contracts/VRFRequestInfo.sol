// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

/// @notice This contract is used to store the gas price required to maintain VRF oracle balance used for VRF callbacks
contract VRFRequestInfo is UUPSUpgradeable, OwnableUpgradeable {
  event UpdateMovingAverageGasPrice(uint movingAverageGasPrice);
  event SetBaseRequestCost(uint baseRequestCost);

  uint constant GAS_PRICE_WINDOW_SIZE = 4;

  uint8 private indexGasPrice;
  uint64 private movingAverageGasPrice;
  uint88 private baseRequestCost;
  uint64[GAS_PRICE_WINDOW_SIZE] private prices;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize() external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();

    setBaseAttackCost(0.01 ether);
    _updateMovingAverageGasPrice(uint64(tx.gasprice));
    for (uint i; i < GAS_PRICE_WINDOW_SIZE; ++i) {
      prices[i] = uint64(tx.gasprice);
    }
  }

  function get() external view returns (uint64, uint88) {
    return (movingAverageGasPrice, baseRequestCost);
  }

  function updateAverageGasPrice() external {
    uint sum = 0;
    prices[indexGasPrice] = uint64(tx.gasprice);
    indexGasPrice = uint8((indexGasPrice + 1) % GAS_PRICE_WINDOW_SIZE);

    for (uint i = 0; i < GAS_PRICE_WINDOW_SIZE; ++i) {
      sum += prices[i];
    }

    _updateMovingAverageGasPrice(uint64(sum / GAS_PRICE_WINDOW_SIZE));
  }

  function _updateMovingAverageGasPrice(uint64 _movingAverageGasPrice) private {
    movingAverageGasPrice = _movingAverageGasPrice;
    emit UpdateMovingAverageGasPrice(_movingAverageGasPrice);
  }

  function setBaseAttackCost(uint _baseRequestCost) public onlyOwner {
    baseRequestCost = uint88(_baseRequestCost);
    emit SetBaseRequestCost(_baseRequestCost);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
