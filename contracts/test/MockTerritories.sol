//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IBrushToken} from "../interfaces/external/IBrushToken.sol";

contract MockTerritories {
  uint256 public addUnclaimedEmissionsCBCount;
  IBrushToken _brush;

  constructor(IBrushToken brush) {
    _brush = brush;
  }

  function addUnclaimedEmissions(uint256 amount) external {
    _brush.transferFrom(msg.sender, address(this), amount);
    ++addUnclaimedEmissionsCBCount;
  }

  function isCombatant(uint256 /* _clanId */, uint256 /* _playerId */) external pure returns (bool) {
    return false;
  }

  function assignCombatants(
    uint256 clanId,
    uint64[] calldata playerIds,
    uint256 combatantCooldownTimestamp,
    uint256 leaderPlayerId
  ) external {}
}
