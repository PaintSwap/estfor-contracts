// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {PlayersLibrary} from "../Players/PlayersLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";

import {IPlayers} from "../interfaces/IPlayers.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

library ClanBattleLibrary {
  error TooManyAttackers();
  error TooManyDefenders();
  error NotEnoughRandomWords();

  function determineBattleOutcome(
    address players,
    uint64[] memory clanMembersA,
    uint64[] memory clanMembersB,
    uint8[] memory skills,
    uint256[] memory randomWords, // 0 is for shuffling attacker, 1 & 2 for the dice rolls, 3 is for shuffling the defenders, 4 & 5 for the dice rolls
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
    )
  {
    (battleResults, rollsA, rollsB, didAWin) = _determineBattleOutcome(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      randomWords,
      extraRollsA,
      extraRollsB
    );
    // These have now been shuffled, so return them to the caller
    shuffledClanMembersA = clanMembersA;
    shuffledClanMembersB = clanMembersB;
  }

  function _determineBattleOutcome(
    address players,
    uint64[] memory clanMembersA, // [In/Out] gets shuffled
    uint64[] memory clanMembersB, // [In/Out] gets shuffled
    uint8[] memory skills,
    uint256[] memory randomWords,
    uint256 extraRollsA,
    uint256 extraRollsB
  )
    internal
    view
    returns (uint8[] memory battleResults, uint256[] memory rollsA, uint256[] memory rollsB, bool didAWin)
  {
    require(clanMembersA.length <= 32, TooManyAttackers());
    require(clanMembersB.length <= 32, TooManyDefenders());
    require(randomWords.length >= 6, NotEnoughRandomWords());

    EstforLibrary._shuffleArray(clanMembersA, randomWords[0]);
    EstforLibrary._shuffleArray(clanMembersB, randomWords[3]);

    uint256 baseClanMembersCount = clanMembersA.length > clanMembersB.length
      ? clanMembersB.length
      : clanMembersA.length;

    battleResults = new uint8[](Math.max(clanMembersA.length, clanMembersB.length));
    rollsA = new uint256[](Math.max(clanMembersA.length, clanMembersB.length));
    rollsB = new uint256[](Math.max(clanMembersA.length, clanMembersB.length));

    uint256 numWinnersA;
    uint256 numWinnersB;
    {
      for (uint256 i; i < baseClanMembersCount; ++i) {
        // It's possible that there are empty entries if they left the clan
        if (clanMembersA[i] == 0 || clanMembersB[i] == 0) {
          rollsA[i] = clanMembersA[i] == 0 ? 0 : 1;
          rollsB[i] = clanMembersB[i] == 0 ? 0 : 1;
        } else {
          uint256 levelA = PlayersLibrary._getLevel(IPlayers(players).getPlayerXP(clanMembersA[i], Skill(skills[i])));
          uint256 levelB = PlayersLibrary._getLevel(IPlayers(players).getPlayerXP(clanMembersB[i], Skill(skills[i])));
          if (levelA > 20 * 13 || levelB > 20 * 13) {
            assert(false); // Unsupported
          }

          // Get two consecutive bytes for each player's rolls
          bytes2 bytesA;
          bytes2 bytesB;

          // Handle up to 32 players:
          // Players 0-15 from randomWords[1]
          // Players 16-31 from randomWords[2]
          if (i < 16) {
            // Shift right to get the bytes we want and mask to get 2 bytes
            // For i=0, we want bytes 31,30
            // For i=1, we want bytes 29,28
            // etc.
            bytesA = bytes2(uint16(randomWords[1] >> (i * 16)));
            bytesB = bytes2(uint16(randomWords[4] >> (i * 16)));
          } else {
            // For players 16-31, use the second word of each pair
            uint256 j = i - 16;
            bytesA = bytes2(uint16(randomWords[2] >> (j * 16)));
            bytesB = bytes2(uint16(randomWords[5] >> (j * 16)));
          }

          uint256 numRollsA = (levelA / 20) + 1 + extraRollsA;
          // If the user has not used the character in 2 weeks, they forfeit
          uint256 lastActiveTimestampA = IPlayers(players).getLastActiveTimestamp(clanMembersA[i]);
          if (lastActiveTimestampA < block.timestamp - 2 weeks) {
            numRollsA = 0;
          }

          // Check how many bits are set based on the number of rolls
          for (uint256 j; j < numRollsA; ++j) {
            rollsA[i] += uint16(bytesA >> j) & 1;
          }

          uint256 numRollsB = (levelB / 20) + 1 + extraRollsB;
          uint256 lastActiveTimestampB = IPlayers(players).getLastActiveTimestamp(clanMembersB[i]);
          if (lastActiveTimestampB < block.timestamp - 2 weeks) {
            numRollsB = 0;
          }
          for (uint256 j; j < numRollsB; ++j) {
            rollsB[i] += uint16(bytesB >> j) & 1;
          }
        }

        if (rollsA[i] > rollsB[i]) {
          ++numWinnersA;
          battleResults[i] = uint8(BattleResultEnum.WIN);
        } else if (rollsB[i] > rollsA[i]) {
          ++numWinnersB;
          battleResults[i] = uint8(BattleResultEnum.LOSE);
        } else {
          battleResults[i] = uint8(BattleResultEnum.DRAW);
        }
      }
    }

    if (clanMembersB.length > clanMembersA.length) {
      numWinnersB += clanMembersB.length - clanMembersA.length;
      for (uint256 i = baseClanMembersCount; i < clanMembersB.length; ++i) {
        battleResults[i] = uint8(BattleResultEnum.LOSE);
      }
    } else if (clanMembersA.length > clanMembersB.length) {
      numWinnersA += clanMembersA.length - clanMembersB.length;
      for (uint256 i = baseClanMembersCount; i < clanMembersA.length; ++i) {
        battleResults[i] = uint8(BattleResultEnum.WIN);
      }
    }

    didAWin = numWinnersA >= numWinnersB;
  }
}
