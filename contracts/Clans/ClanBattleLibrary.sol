// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {PlayersLibrary} from "../Players/PlayersLibrary.sol";

import {IPlayers} from "../interfaces/IPlayers.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

library ClanBattleLibrary {
  function shuffleArray(uint48[] memory _array, uint _randomNumber) public pure returns (uint48[] memory) {
    for (uint i; i < _array.length; ++i) {
      uint n = i + (_randomNumber % (_array.length - i));
      if (i != n) {
        uint48 temp = _array[n];
        _array[n] = _array[i];
        _array[i] = temp;
      }
    }
    return _array;
  }

  function doBattleLib(
    address _players,
    uint48[] memory _clanMembersA,
    uint48[] memory _clanMembersB,
    uint8[] memory _skills,
    uint _randomWordA,
    uint _randomWordB,
    uint _extraRollsA,
    uint _extraRollsB
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
    Skill[] memory skills = new Skill[](_skills.length);
    for (uint i; i < _skills.length; ++i) {
      skills[i] = Skill(_skills[i]);
    }

    BattleResultEnum[] memory battleResultsEnum;
    uint[] memory rollsA;
    uint[] memory rollsB;
    (battleResultsEnum, rollsA, rollsB, didAWin) = doBattle(
      _players,
      _clanMembersA,
      _clanMembersB,
      skills,
      _randomWordA,
      _randomWordB,
      _extraRollsA,
      _extraRollsB
    );

    battleResults = new uint8[](battleResultsEnum.length);
    for (uint i; i < battleResultsEnum.length; ++i) {
      battleResults[i] = uint8(battleResultsEnum[i]);
    }

    shuffledClanMembersA = _clanMembersA;
    shuffledClanMembersB = _clanMembersB;
  }

  function doBattle(
    address _players,
    uint48[] memory _clanMembersA, // [In/Out] gets shuffled
    uint48[] memory _clanMembersB, // [In/Out] gets shuffled
    Skill[] memory _skills,
    uint _randomWordA,
    uint _randomWordB,
    uint _extraRollsA,
    uint _extraRollsB
  )
    internal
    view
    returns (BattleResultEnum[] memory battleResults, uint[] memory rollsA, uint[] memory rollsB, bool didAWin)
  {
    shuffleArray(_clanMembersA, _randomWordA);
    shuffleArray(_clanMembersB, _randomWordB);

    uint baseClanMembersCount = _clanMembersA.length > _clanMembersB.length
      ? _clanMembersB.length
      : _clanMembersA.length;

    battleResults = new BattleResultEnum[](Math.max(_clanMembersA.length, _clanMembersB.length));
    rollsA = new uint[](Math.max(_clanMembersA.length, _clanMembersB.length));
    rollsB = new uint[](Math.max(_clanMembersA.length, _clanMembersB.length));

    uint numWinnersA;
    uint numWinnersB;
    for (uint i; i < baseClanMembersCount; ++i) {
      Skill skill = _skills[i];

      // It's possible that there are empty entries if they left the clan
      if (_clanMembersA[i] == 0 || _clanMembersB[i] == 0) {
        rollsA[i] = _clanMembersA[i] == 0 ? 0 : 1;
        rollsB[i] = _clanMembersB[i] == 0 ? 0 : 1;
      } else {
        uint levelA = PlayersLibrary._getLevel(IPlayers(_players).xp(_clanMembersA[i], skill));
        uint levelB = PlayersLibrary._getLevel(IPlayers(_players).xp(_clanMembersB[i], skill));

        if (levelA > 20 * 6 || levelB > 20 * 6) {
          assert(false); // Unsupported
        }

        uint numRollsA = (levelA / 20) + (IPlayers(_players).isPlayerUpgraded(_clanMembersA[i]) ? 2 : 1) + _extraRollsA;
        uint numRollsB = (levelB / 20) + (IPlayers(_players).isPlayerUpgraded(_clanMembersB[i]) ? 2 : 1) + _extraRollsB;

        bytes1 byteA = bytes32(_randomWordA)[31 - i];
        // Check how many bits are set based on the number of rolls
        for (uint j; j < numRollsA; ++j) {
          rollsA[i] += uint8(byteA >> j) & 1;
        }
        bytes1 byteB = bytes32(_randomWordB)[31 - i];
        for (uint j; j < numRollsB; ++j) {
          rollsB[i] += uint8(byteB >> j) & 1;
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

    if (_clanMembersB.length > _clanMembersA.length) {
      numWinnersB += _clanMembersB.length - _clanMembersA.length;
      for (uint i = baseClanMembersCount; i < _clanMembersB.length; ++i) {
        battleResults[i] = BattleResultEnum.LOSE;
      }
    } else if (_clanMembersA.length > _clanMembersB.length) {
      numWinnersA += _clanMembersA.length - _clanMembersB.length;
      for (uint i = baseClanMembersCount; i < _clanMembersA.length; ++i) {
        battleResults[i] = BattleResultEnum.WIN;
      }
    }

    didAWin = numWinnersA >= numWinnersB;
  }
}
