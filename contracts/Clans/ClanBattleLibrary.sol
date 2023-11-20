// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PlayersLibrary} from "../Players/PlayersLibrary.sol";

import {IPlayers} from "../interfaces/IPlayers.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

library ClanBattleLibrary {
  function shuffleArray(uint256[] memory _array, uint256 _randomNumber) public pure returns (uint256[] memory) {
    for (uint256 i = 0; i < _array.length; ++i) {
      uint256 n = i + (_randomNumber % (_array.length - i));
      if (i != n) {
        uint256 temp = _array[n];
        _array[n] = _array[i];
        _array[i] = temp;
      }
    }
    return _array;
  }

  function doBattleLib(
    address _players,
    uint[] memory _clanMembersA,
    uint[] memory _clanMembersB,
    uint _randomWordA,
    uint _randomWordB,
    uint8 _skill
  ) external view returns (int) {
    return doBattle(_players, _clanMembersA, _clanMembersB, _randomWordA, _randomWordB, Skill(_skill));
  }

  // Returns 1 if A beats B, 0 if B beats A, 2 if tie
  function doBattle(
    address _players,
    uint[] memory _clanMembersA,
    uint[] memory _clanMembersB,
    uint _randomWordA,
    uint _randomWordB,
    Skill _skill
  ) public view returns (int) {
    shuffleArray(_clanMembersA, _randomWordA);
    shuffleArray(_clanMembersB, _randomWordB);

    uint baseClanMembersCount = _clanMembersA.length > _clanMembersB.length
      ? _clanMembersB.length
      : _clanMembersA.length;

    uint numWinnersA;
    uint numWinnersB;
    for (uint i; i < baseClanMembersCount; ++i) {
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
      uint hitsA;
      for (uint j; j < numRollsA; ++j) {
        hitsA += uint8(byteA >> j) & 1;
      }
      bytes1 byteB = bytes32(_randomWordB)[31 - i];
      uint hitsB;
      for (uint j; j < numRollsB; ++j) {
        hitsB += uint8(byteB >> j) & 1;
      }

      if (hitsA > hitsB) {
        ++numWinnersA;
      } else if (hitsB > hitsA) {
        ++numWinnersB;
      }
    }

    if (_clanMembersB.length > _clanMembersA.length) {
      numWinnersB += _clanMembersB.length - _clanMembersA.length;
    } else if (_clanMembersA.length > _clanMembersB.length) {
      numWinnersA += _clanMembersA.length - _clanMembersB.length;
    }

    if (numWinnersA > numWinnersB) {
      return 1;
    } else if (numWinnersB > numWinnersA) {
      return -1;
    } else {
      return 0;
    }
  }
}
