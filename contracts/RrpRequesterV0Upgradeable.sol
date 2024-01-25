// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@api3/airnode-protocol/contracts/rrp/interfaces/IAirnodeRrpV0.sol";

/// @title The contract to be inherited to make Airnode RRP requests
contract RrpRequesterV0Upgradeable {
  IAirnodeRrpV0 public airnodeRrp;

  error CallerNotAirnodeRRP();

  /// @dev Reverts if the caller is not the Airnode RRP contract.
  /// Use it as a modifier for fulfill and error callback methods, but also
  /// check `requestId`.
  modifier onlyAirnodeRrp() {
    if (msg.sender != address(airnodeRrp)) {
      revert CallerNotAirnodeRRP();
    }
    _;
  }

  /// @dev Airnode RRP address is set at initialization
  /// RrpRequester is made its own sponsor by default. RrpRequester can also
  /// be sponsored by others and use these sponsorships while making
  /// requests, i.e., using this default sponsorship is optional.
  function __RrpRequesterV0_init(address _airnodeRrp) internal {
    airnodeRrp = IAirnodeRrpV0(_airnodeRrp);
    IAirnodeRrpV0(_airnodeRrp).setSponsorshipStatus(address(this), true);
  }
}
