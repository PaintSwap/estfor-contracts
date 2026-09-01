// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct LockedBankVaultsBattleResultData {
    uint256 requestId;
    uint64[] attackingPlayerIds;
    uint64[] defendingPlayerIds;
    uint256[] attackingRolls;
    uint256[] defendingRolls;
    uint8[] battleResults;
    uint8[] randomSkills;
    bool didAttackersWin;
    uint256 attackingClanId;
    uint256 defendingClanId;
    uint256[] randomWords;
    uint256 percentageToTake;
    uint256 brushLost;
    int256 attackingMMRDiff;
    int256 defendingMMRDiff;
    uint256 clanXPGainedWinner;
}

struct RaidBattleOutcomeData {
    uint256 clanId;
    uint256 raidId;
    uint256 requestId;
    uint256 regenerateId;
    uint256 regenerateAmountUsed;
    uint16[] choiceIds;
    uint256 bossChoiceId;
    bool defeatedRaid;
    uint256[] lootTokenIds;
    uint256[] lootTokenAmounts;
}

struct TerritoryBattleResultData {
    uint256 requestId;
    uint64[] attackingPlayerIds;
    uint64[] defendingPlayerIds;
    uint256[] attackingRolls;
    uint256[] defendingRolls;
    uint8[] battleResults;
    uint8[] randomSkills;
    bool didAttackersWin;
    uint256 attackingClanId;
    uint256 defendingClanId;
    uint256[] randomWords;
    uint256 territoryId;
    uint256 clanXPGainedWinner;
}

interface ILockedBankVaultsBattleResultDecoder {
    function decode(bytes calldata data) external pure returns (LockedBankVaultsBattleResultData memory result);
    function decodeRaidOutcome(bytes calldata data) external pure returns (RaidBattleOutcomeData memory result);
    function decodeTerritoryBattleResult(bytes calldata data)
        external
        pure
        returns (TerritoryBattleResultData memory result);
}
