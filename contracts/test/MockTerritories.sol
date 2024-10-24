//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITerritories} from "../interfaces/ITerritories.sol";
import {IBrushToken} from "../interfaces/IBrushToken.sol";

contract MockTerritories is ITerritories {
  uint256 public addUnclaimedEmissionsCBCount;
  IBrushToken _brush;

  constructor(IBrushToken brush) {
    _brush = brush;
  }

  function addUnclaimedEmissions(uint256 amount) external override {
    _brush.transferFrom(msg.sender, address(this), amount);
    ++addUnclaimedEmissionsCBCount;
  }

  function isCombatant(uint256 /* _clanId */, uint256 /* _playerId */) external pure override returns (bool) {
    return false;
  }

  function assignCombatants(
    uint256 clanId,
    uint48[] calldata playerIds,
    uint256 combatantCooldownTimestamp,
    uint256 leaderPlayerId
  ) external override {}
}
