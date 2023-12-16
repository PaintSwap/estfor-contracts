// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ICombatants} from "./ICombatants.sol";

interface ITerritories is ICombatants {
  function addUnclaimedEmissions(uint amount) external;
}
