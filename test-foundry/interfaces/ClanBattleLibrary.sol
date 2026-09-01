// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../contracts/globals/actions.sol";
import "../../contracts/globals/clans.sol";
import "../../contracts/globals/items.sol";
import "../../contracts/globals/misc.sol";
import "../../contracts/globals/pets.sol";
import "../../contracts/globals/players.sol";
import "../../contracts/globals/promotions.sol";
import "../../contracts/globals/quests.sol";
import "../../contracts/globals/rewards.sol";

interface ClanBattleLibrary {
    function determineBattleOutcome(
        address players,
        uint64[] calldata clanMembersA,
        uint64[] calldata clanMembersB,
        uint8[] calldata skills,
        uint256[] calldata randomWords,
        uint256 extraRollsA,
        uint256 extraRollsB
    )
        external
        view
        returns (
            uint8[] memory battleResults,
            uint256[] memory rollsA,
            uint256[] memory rollsB,
            bool didAWin,
            uint64[] memory shuffledClanMembersA,
            uint64[] memory shuffledClanMembersB
        );
    error NotEnoughRandomWords();
    error TooManyAttackers();
    error TooManyDefenders();
}
