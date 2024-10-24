// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {PlayersLibrary} from "../Players/PlayersLibrary.sol";

import {IPlayers} from "../interfaces/IPlayers.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

library ClanBattleLibrary {
  function shuffleArray(uint48[] memory array, uint256 randomNumber) public pure returns (uint48[] memory output) {
    for (uint256 i; i < array.length; ++i) {
      uint256 n = i + (randomNumber % (array.length - i));
      if (i != n) {
        uint48 temp = array[n];
        array[n] = array[i];
        array[i] = temp;
      }
    }
    return array;
  }

  function doBattleLib(
    address players,
    uint48[] memory clanMembersA,
    uint48[] memory clanMembersB,
    uint8[] memory skillIds,
    uint256 randomWordA,
    uint256 randomWordB,
    uint256 extraRollsA,
    uint256 extraRollsB
  )
    external
    view
    returns (
      uint8[] memory battleResults,
      uint48[] memory shuffledClanMembersA,
      uint48[] memory shuffledClanMembersB,
      bool didAWin
    )
  {
    Skill[] memory skills = new Skill[](skillIds.length);
    for (uint256 i; i < skillIds.length; ++i) {
      skills[i] = Skill(skillIds[i]);
    }

    BattleResultEnum[] memory battleResultsEnum;
    uint256[] memory rollsA;
    uint256[] memory rollsB;
    (battleResultsEnum, rollsA, rollsB, didAWin) = doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [randomWordA, randomWordB],
      extraRollsA,
      extraRollsB
    );

    battleResults = new uint8[](battleResultsEnum.length);
    for (uint256 i; i < battleResultsEnum.length; ++i) {
      battleResults[i] = uint8(battleResultsEnum[i]);
    }

    shuffledClanMembersA = clanMembersA;
    shuffledClanMembersB = clanMembersB;
  }

  function doBattle(
    address players,
    uint48[] memory clanMembersA, // [In/Out] gets shuffled
    uint48[] memory clanMembersB, // [In/Out] gets shuffled
    Skill[] memory skills,
    uint256[2] memory randomWords,
    uint256 extraRollsA,
    uint256 extraRollsB
  )
    internal
    view
    returns (BattleResultEnum[] memory battleResults, uint256[] memory rollsA, uint256[] memory rollsB, bool didAWin)
  {
    shuffleArray(clanMembersA, randomWords[0]);
    shuffleArray(clanMembersB, randomWords[1]);

    uint256 baseClanMembersCount = clanMembersA.length > clanMembersB.length
      ? clanMembersB.length
      : clanMembersA.length;

    battleResults = new BattleResultEnum[](Math.max(clanMembersA.length, clanMembersB.length));
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
          {
            uint256 levelA = PlayersLibrary._getLevel(IPlayers(players).getPlayerXP(clanMembersA[i], skills[i]));
            uint256 levelB = PlayersLibrary._getLevel(IPlayers(players).getPlayerXP(clanMembersB[i], skills[i]));
            if (levelA > 20 * 6 || levelB > 20 * 6) {
              assert(false); // Unsupported
            }

            uint256 numRollsA = (levelA / 20) +
              (IPlayers(players).isPlayerUpgraded(clanMembersA[i]) ? 2 : 1) +
              extraRollsA;
            uint256 numRollsB = (levelB / 20) +
              (IPlayers(players).isPlayerUpgraded(clanMembersB[i]) ? 2 : 1) +
              extraRollsB;
            bytes1 byteA = bytes32(randomWords[0])[31 - i];
            // Check how many bits are set based on the number of rolls
            for (uint256 j; j < numRollsA; ++j) {
              rollsA[i] += uint8(byteA >> j) & 1;
            }
            bytes1 byteB = bytes32(randomWords[1])[31 - i];
            for (uint256 j; j < numRollsB; ++j) {
              rollsB[i] += uint8(byteB >> j) & 1;
            }
          }
        }
        if (rollsA[i] > rollsB[i]) {
          ++numWinnersA;
          battleResults[i] = BattleResultEnum.WIN;
        } else if (rollsB[i] > rollsA[i]) {
          ++numWinnersB;
          battleResults[i] = BattleResultEnum.LOSE;
        } else {
          battleResults[i] = BattleResultEnum.DRAW;
        }
      }
    }

    if (clanMembersB.length > clanMembersA.length) {
      numWinnersB += clanMembersB.length - clanMembersA.length;
      for (uint256 i = baseClanMembersCount; i < clanMembersB.length; ++i) {
        battleResults[i] = BattleResultEnum.LOSE;
      }
    } else if (clanMembersA.length > clanMembersB.length) {
      numWinnersA += clanMembersA.length - clanMembersB.length;
      for (uint256 i = baseClanMembersCount; i < clanMembersA.length; ++i) {
        battleResults[i] = BattleResultEnum.WIN;
      }
    }

    didAWin = numWinnersA >= numWinnersB;
  }
}
