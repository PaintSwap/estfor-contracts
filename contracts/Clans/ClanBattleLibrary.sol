// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {PlayersLibrary} from "../Players/PlayersLibrary.sol";

import {IPlayers} from "../interfaces/IPlayers.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

library ClanBattleLibrary {
  function shuffleArray(uint64[] memory _array, uint _randomNumber) public pure returns (uint64[] memory) {
    for (uint i; i < _array.length; ++i) {
      uint n = i + (_randomNumber % (_array.length - i));
      if (i != n) {
        uint64 temp = _array[n];
        _array[n] = _array[i];
        _array[i] = temp;
      }
    }
    return _array;
  }

  function doBattleLib(
    address _players,
    uint64[] memory _clanMembersA,
    uint64[] memory _clanMembersB,
    uint _randomWordA,
    uint _randomWordB,
    uint8 _skill
  ) external view returns (uint[] memory winners, uint[] memory losers, bool didAWin) {
    return doBattle(_players, _clanMembersA, _clanMembersB, _randomWordA, _randomWordB, Skill(_skill));
  }

  // winners & losers are always the same length, if there is not a valid playerId then it pushes 0
  function doBattle(
    address _players,
    uint64[] memory _clanMembersA,
    uint64[] memory _clanMembersB,
    uint _randomWordA,
    uint _randomWordB,
    Skill _skill
  ) public view returns (uint[] memory winners, uint[] memory losers, bool didAWin) {
    shuffleArray(_clanMembersA, _randomWordA);
    shuffleArray(_clanMembersB, _randomWordB);

    winners = new uint[](Math.max(_clanMembersA.length, _clanMembersB.length));
    losers = new uint[](Math.max(_clanMembersA.length, _clanMembersB.length));

    uint baseClanMembersCount = _clanMembersA.length > _clanMembersB.length
      ? _clanMembersB.length
      : _clanMembersA.length;

    uint numWinnersA;
    uint numWinnersB;
    for (uint i; i < baseClanMembersCount; ++i) {
      uint hitsA;
      uint hitsB;

      // It's possible that there are empty entries if they left the clan
      if (_clanMembersA[i] == 0 || _clanMembersB[i] == 0) {
        hitsA = _clanMembersA[i] == 0 ? 0 : 1;
        hitsB = _clanMembersB[i] == 0 ? 0 : 1;
      } else {
        uint levelA = PlayersLibrary.getLevel(IPlayers(_players).xp(_clanMembersA[i], _skill));
        uint levelB = PlayersLibrary.getLevel(IPlayers(_players).xp(_clanMembersB[i], _skill));

        // Each battle then roll dice where every 20 levels in the skill gets you a d20 dice.
        // The highest number rolled is the outcome.
        // So example skill level 39 vs 97, player 1 would have 2 dice and player 2 would roll 5.
        if (levelA > 20 * 8 || levelB > 20 * 8) {
          assert(false); // Unsupported
        }

        uint numRollsA = (levelA / 20) + 1;
        uint numRollsB = (levelB / 20) + 1;

        bytes1 byteA = bytes32(_randomWordA)[31 - i];
        // Check how many bits are set based on the number of rolls
        for (uint j; j < numRollsA; ++j) {
          hitsA += uint8(byteA >> j) & 1;
        }
        bytes1 byteB = bytes32(_randomWordB)[31 - i];
        for (uint j; j < numRollsB; ++j) {
          hitsB += uint8(byteB >> j) & 1;
        }
      }

      if (hitsA > hitsB) {
        ++numWinnersA;
        winners[i] = _clanMembersA[i];
        losers[i] = _clanMembersB[i];
      } else if (hitsB > hitsA) {
        ++numWinnersB;
        winners[i] = _clanMembersB[i];
        losers[i] = _clanMembersA[i];
      }
    }

    if (_clanMembersB.length > _clanMembersA.length) {
      numWinnersB += _clanMembersB.length - _clanMembersA.length;
      for (uint i = baseClanMembersCount; i < _clanMembersB.length; ++i) {
        winners[i] = _clanMembersB[i];
        losers[i] = 0;
      }
    } else if (_clanMembersA.length > _clanMembersB.length) {
      numWinnersA += _clanMembersA.length - _clanMembersB.length;
      for (uint i = baseClanMembersCount; i < _clanMembersB.length; ++i) {
        winners[i] = _clanMembersA[i];
        losers[i] = 0;
      }
    }

    didAWin = numWinnersA > numWinnersB;
  }
}
