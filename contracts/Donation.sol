// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IOracleRewardCB} from "./interfaces/IOracleRewardCB.sol";
import {PlayerNFT} from "./PlayerNFT.sol";

// solhint-disable-next-line no-global-import
import {Equipment, EXTRA_XP_BOOST, EXTRA_HALF_XP_BOOST, PRAY_TO_THE_BEARDIE, LotteryWinnerInfo} from "./globals/all.sol";

contract Donation is UUPSUpgradeable, OwnableUpgradeable, IOracleRewardCB {
  event Donate(address from, uint playerId, uint amount, uint lotteryId, uint raffleId);
  event WinnerAndNewLottery(uint lotteryId, uint raffleId, uint16 rewardItemTokenId, uint rewardAmount);
  event SetRaffleEntryCost(uint brushAmount);
  event NextDonationThreshold(uint amount, uint16 rewardItemTokenId);
  event ClaimedLotteryWinnings(uint lotteryId, uint raffleId, uint itemTokenId, uint amount);

  error NotOwnerOfPlayer();
  error NotEnoughBrush();
  error OracleNotCalledYet();
  error AlreadyEnteredRaffle();
  error OnlyPlayers();
  error OnlyWorld();

  using BitMaps for BitMaps.BitMap;

  IBrushToken public brush;
  PlayerNFT public playerNFT;
  address shop;
  mapping(uint lotteryId => BitMaps.BitMap) private playersEntered;
  mapping(uint lotteryId => mapping(uint raffleId => uint playerId)) public raffleIdToPlayerId; // So that we can work out the playerId winner from the raffle
  mapping(uint lotteryId => LotteryWinnerInfo winner) public winners;
  BitMaps.BitMap private claimedRewards;
  address private players;
  address private world;
  uint16 public donationRewardItemTokenId;
  uint40 private totalDonated; // In BRUSH ether (no wei decimals)
  uint40 private nextThreshold; // In BRUSH ether (no wei decimals)
  uint16 public nextRewardItemTokenId;
  uint16 public nextRewardAmount;
  bool public instantConsume;
  uint16 public lastLotteryId;
  uint24 public lastRaffleId; // Relative to each lottery
  uint40 public lastOracleRandomWordTimestamp;
  uint16 private raffleEntryCost; // In BRUSH ether (no wei decimals)
  bool public isBeta;
  uint40[6] public lastUnclaimedWinners; // 1 storage slot to keep track of the last 3 winning playerId & lotteryId, stored as [playerId, lotteryId, playerId, lotteryId, playerId, lotteryId]

  modifier onlyPlayers() {
    if (players != msg.sender) {
      revert OnlyPlayers();
    }
    _;
  }

  modifier onlyWorld() {
    if (world != msg.sender) {
      revert OnlyWorld();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken _brush,
    PlayerNFT _playerNFT,
    address _shop,
    address _world,
    uint _raffleEntryCost,
    uint _startThreshold,
    bool _isBeta
  ) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();

    brush = _brush;
    playerNFT = _playerNFT;
    shop = _shop;
    world = _world;

    raffleEntryCost = uint16(_raffleEntryCost / 1 ether);
    donationRewardItemTokenId = EXTRA_HALF_XP_BOOST;
    nextThreshold = uint40(_startThreshold / 1 ether);
    isBeta = _isBeta;
    nextRewardItemTokenId = EXTRA_XP_BOOST;
    nextRewardAmount = 1;

    emit SetRaffleEntryCost(_raffleEntryCost);
    emit NextDonationThreshold(nextThreshold, PRAY_TO_THE_BEARDIE);
    emit WinnerAndNewLottery(0, 0, nextRewardItemTokenId, nextRewardAmount);
  }

  // _playerId can be 0 to ignore it, otherwise sender must own it
  // Cannot donate until the oracle has finished being called if using a player
  function donate(
    address _from,
    uint _playerId,
    uint _amount
  ) external onlyPlayers returns (uint16 itemTokenId, uint16 globalItemTokenId) {
    if (!brush.transferFrom(_from, shop, _amount)) {
      revert NotEnoughBrush();
    }

    bool isNonRaffleDonation = true;

    if (_playerId != 0) {
      bool hasEnoughForRaffle = (_amount / 1 ether) >= raffleEntryCost;
      if (hasEnoughForRaffle) {
        uint _lastLotteryId = lastLotteryId;
        uint flooredTime = lastOracleRandomWordTimestamp;
        if (flooredTime != 0 && flooredTime < (block.timestamp / 1 days) * 1 days) {
          revert OracleNotCalledYet();
        }

        bool hasEnteredAlready = playersEntered[_lastLotteryId].get(_playerId);
        if (hasEnteredAlready) {
          revert AlreadyEnteredRaffle();
        }

        raffleIdToPlayerId[_lastLotteryId][++lastRaffleId] = _playerId;
        itemTokenId = donationRewardItemTokenId;
        playersEntered[_lastLotteryId].set(_playerId);
        isNonRaffleDonation = false;
        emit Donate(_from, _playerId, _amount, _lastLotteryId, lastRaffleId);
      }
    }

    if (isNonRaffleDonation) {
      emit Donate(_from, _playerId, _amount, 0, 0);
    }

    totalDonated += uint40(_amount / 1 ether);

    // Is a donation threshold hit?
    if (nextThreshold != 0 && totalDonated >= nextThreshold) {
      globalItemTokenId = PRAY_TO_THE_BEARDIE;
      nextThreshold = totalDonated + (isBeta ? 1000 : 100_000);
      emit NextDonationThreshold(uint(nextThreshold) * 1 ether, PRAY_TO_THE_BEARDIE);
    }
  }

  function _awaitingClaim(uint _playerId) private view returns (uint lotteryId) {
    for (uint i = 0; i < lastUnclaimedWinners.length; i += 2) {
      if (lastUnclaimedWinners[i] == _playerId) {
        lotteryId = lastUnclaimedWinners[i + 1];
        break;
      }
    }
  }

  function newOracleRandomWords(uint[3] calldata randomWords) external onlyWorld {
    uint16 _lastLotteryId = lastLotteryId;
    if (lastRaffleId != 0) {
      // Decide the winner
      uint24 raffleIdWinner = uint24(randomWords[0] % lastRaffleId) + 1;
      winners[_lastLotteryId] = LotteryWinnerInfo({
        lotteryId: _lastLotteryId,
        raffleId: raffleIdWinner,
        itemTokenId: nextRewardItemTokenId,
        amount: nextRewardAmount,
        instantConsume: instantConsume,
        playerId: uint40(raffleIdToPlayerId[_lastLotteryId][raffleIdWinner])
      });

      lastRaffleId = 0;
      // Currently not set as will be used: nextRewardItemTokenId, nextRewardAmount, instantConsume;
      emit WinnerAndNewLottery(_lastLotteryId, raffleIdWinner, nextRewardItemTokenId, nextRewardAmount);

      // Add to the last 3 unclaimed winners queue
      bool added;
      for (uint i = 0; i < lastUnclaimedWinners.length; i += 2) {
        if (lastUnclaimedWinners[i] == 0) {
          lastUnclaimedWinners[i] = winners[_lastLotteryId].playerId;
          lastUnclaimedWinners[i + 1] = _lastLotteryId;
          added = true;
          break;
        }
      }

      if (!added) {
        // Shift the remaining ones down and add it to the end
        for (uint i = 2; i < lastUnclaimedWinners.length; i += 2) {
          lastUnclaimedWinners[i - 2] = lastUnclaimedWinners[i];
          lastUnclaimedWinners[i - 1] = lastUnclaimedWinners[i + 1];
        }
        lastUnclaimedWinners[lastUnclaimedWinners.length - 2] = winners[_lastLotteryId].playerId;
        lastUnclaimedWinners[lastUnclaimedWinners.length - 1] = _lastLotteryId;
      }
    }

    // Start new lottery
    lastLotteryId = _lastLotteryId + 1;
    lastOracleRandomWordTimestamp = uint40((block.timestamp / 1 days) * 1 days);
  }

  function claimedLotteryWinnings(uint _lotteryId) external onlyPlayers {
    LotteryWinnerInfo storage lotteryWinner = winners[_lotteryId];
    emit ClaimedLotteryWinnings(
      lotteryWinner.lotteryId,
      lotteryWinner.raffleId,
      lotteryWinner.itemTokenId,
      lotteryWinner.amount
    );

    delete winners[_lotteryId];
    claimedRewards.set(_lotteryId);

    // Shift the remaining ones down
    for (uint i = 0; i < lastUnclaimedWinners.length; i += 2) {
      if (lastUnclaimedWinners[i + 1] == _lotteryId) {
        // Shift the rest if there are any
        for (uint j = i + 2; j < lastUnclaimedWinners.length; j += 2) {
          lastUnclaimedWinners[j - 2] = lastUnclaimedWinners[j];
          lastUnclaimedWinners[j - 1] = lastUnclaimedWinners[j + 1];
        }
        break;
      }
    }
    // Delete last ones
    delete lastUnclaimedWinners[lastUnclaimedWinners.length - 2];
    delete lastUnclaimedWinners[lastUnclaimedWinners.length - 1];
  }

  // Scans the last 3 unclaimed winners to see if this playerId belongs there.
  function getUnclaimedLotteryWinnings(uint _playerId) external view returns (LotteryWinnerInfo memory winner) {
    uint _lotteryId = _awaitingClaim(_playerId);
    if (_lotteryId != 0) {
      winner = winners[_lotteryId];
    }
  }

  function getTotalDonated() external view returns (uint) {
    return uint(totalDonated) * 1 ether;
  }

  function getNextThreshold() external view returns (uint) {
    return uint(nextThreshold) * 1 ether;
  }

  function getRaffleEntryCost() external view returns (uint) {
    return uint(raffleEntryCost) * 1 ether;
  }

  function hasClaimedReward(uint _lotteryId) external view returns (bool) {
    return claimedRewards.get(_lotteryId);
  }

  function hasPlayerEntered(uint _lotteryId, uint _playerId) external view returns (bool) {
    return playersEntered[_lotteryId].get(_playerId);
  }

  function setPlayers(address _players) external onlyOwner {
    players = _players;
  }

  function setRaffleEntryCost(uint _raffleEntryCost) external onlyOwner {
    raffleEntryCost = uint16(_raffleEntryCost / 1 ether);
    emit SetRaffleEntryCost(_raffleEntryCost);
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
