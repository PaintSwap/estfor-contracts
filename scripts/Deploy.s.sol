// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../test-foundry/utils/FullGameStack.sol";

/// @notice Deploys and wires the local game stack as a Foundry deployment smoke check.
abstract contract Deploy is FullGameStack {
    function deploy() internal {
        deployFullGame();
    }
}
