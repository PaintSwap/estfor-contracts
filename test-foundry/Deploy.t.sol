// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Deploy} from "../scripts/Deploy.s.sol";

contract DeployTest is Deploy {
    function testDeploy() public {
        deploy();
    }
}
