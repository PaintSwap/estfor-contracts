//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITerritories} from "../interfaces/ITerritories.sol";
import {IBrushToken} from "../interfaces/IBrushToken.sol";

contract MockTerritories is ITerritories {
  uint public addUnclaimedEmissionsCBCount;
  IBrushToken brush;

  constructor(IBrushToken _brush) {
    brush = _brush;
  }

  function addUnclaimedEmissions(uint _amount) external {
    brush.transferFrom(msg.sender, address(this), _amount);
    ++addUnclaimedEmissionsCBCount;
  }
}
