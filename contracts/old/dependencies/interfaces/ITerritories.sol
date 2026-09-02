// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ICombatants} from "../../../interfaces/ICombatants.sol";

interface ITerritories is ICombatants {
  function addUnclaimedEmissions(uint256 amount) external;
}
