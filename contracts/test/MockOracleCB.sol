// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IOracleCB} from "../interfaces/IOracleCB.sol";

contract MockOracleCB is IOracleCB {
  function newOracleRandomWords(uint256 _randomWord) external override {}
}
