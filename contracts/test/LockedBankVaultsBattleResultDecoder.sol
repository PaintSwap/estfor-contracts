// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {
    ILockedBankVaultsBattleResultDecoder,
    LockedBankVaultsBattleResultData,
    RaidBattleOutcomeData,
    TerritoryBattleResultData
} from "./interfaces/LockedBankVaultsBattleResultDecoder.sol";

contract LockedBankVaultsBattleResultDecoder is ILockedBankVaultsBattleResultDecoder {
    function decode(bytes calldata data) external pure returns (LockedBankVaultsBattleResultData memory result) {
        (
            result.requestId,
            result.attackingPlayerIds,
            result.defendingPlayerIds,
            result.attackingRolls,
            result.defendingRolls,
            result.battleResults,
            result.randomSkills,
            result.didAttackersWin,
            result.attackingClanId,
            result.defendingClanId,
            result.randomWords,
            result.percentageToTake,
            result.brushLost,
            result.attackingMMRDiff,
            result.defendingMMRDiff,
            result.clanXPGainedWinner
        ) =
            abi.decode(
                data,
                (
                    uint256,
                    uint64[],
                    uint64[],
                    uint256[],
                    uint256[],
                    uint8[],
                    uint8[],
                    bool,
                    uint256,
                    uint256,
                    uint256[],
                    uint256,
                    uint256,
                    int256,
                    int256,
                    uint256
                )
            );
    }

    function decodeRaidOutcome(bytes calldata data) external pure returns (RaidBattleOutcomeData memory result) {
        (
            result.clanId,
            result.raidId,
            result.requestId,
            result.regenerateId,
            result.regenerateAmountUsed,
            result.choiceIds,
            result.bossChoiceId,
            result.defeatedRaid,
            result.lootTokenIds,
            result.lootTokenAmounts
        ) =
            abi.decode(
                data, (uint256, uint256, uint256, uint256, uint256, uint16[], uint256, bool, uint256[], uint256[])
            );
    }

    function decodeTerritoryBattleResult(bytes calldata data)
        external
        pure
        returns (TerritoryBattleResultData memory result)
    {
        (
            result.requestId,
            result.attackingPlayerIds,
            result.defendingPlayerIds,
            result.attackingRolls,
            result.defendingRolls,
            result.battleResults,
            result.randomSkills,
            result.didAttackersWin,
            result.attackingClanId,
            result.defendingClanId,
            result.randomWords,
            result.territoryId,
            result.clanXPGainedWinner
        ) =
            abi.decode(
                data,
                (
                    uint256,
                    uint64[],
                    uint64[],
                    uint256[],
                    uint256[],
                    uint8[],
                    uint8[],
                    bool,
                    uint256,
                    uint256,
                    uint256[],
                    uint256,
                    uint256
                )
            );
    }
}
