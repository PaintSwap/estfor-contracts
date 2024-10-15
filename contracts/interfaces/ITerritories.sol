// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ICombatants} from "./ICombatants.sol";

interface ITerritories is ICombatants {
  function addUnclaimedEmissions(uint amount) external;
}
