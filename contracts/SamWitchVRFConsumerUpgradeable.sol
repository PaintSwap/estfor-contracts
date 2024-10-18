// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "./ozUpgradeable/proxy/utils/Initializable.sol";
import {ISamWitchVRF} from "./interfaces/ISamWitchVRF.sol";

// This is useful as a drop in replacement for the VRFConsumerBaseV2Upgradeable from Chainlink keeping storage compatibility
abstract contract SamWitchVRFConsumerUpgradeable is Initializable {
  ISamWitchVRF internal _samWitchVRF;
  error CallerNotSamWitchVRF();

  /**
   * @dev Initializes the contract setting the deployer as the initial owner.
   */
  // solhint-disable-next-line func-name-mixedcase
  function __SamWitchVRFConsumerUpgradeable_init(ISamWitchVRF samWitchVRF) internal onlyInitializing {
    _samWitchVRF = samWitchVRF;
  }

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    if (msg.sender != address(_samWitchVRF)) {
      revert CallerNotSamWitchVRF();
    }
    _;
  }
}
