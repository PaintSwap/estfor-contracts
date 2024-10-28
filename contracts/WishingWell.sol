// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IOracleRewardCB} from "./interfaces/IOracleRewardCB.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {PlayerNFT} from "./PlayerNFT.sol";
import {Clans} from "./Clans/Clans.sol";

// solhint-disable-next-line no-global-import
import {Equipment, LUCKY_POTION, LUCK_OF_THE_DRAW, PRAY_TO_THE_BEARDIE, PRAY_TO_THE_BEARDIE_2, PRAY_TO_THE_BEARDIE_3, CLAN_BOOSTER, CLAN_BOOSTER_2, CLAN_BOOSTER_3, LotteryWinnerInfo} from "./globals/all.sol";

contract WishingWell is UUPSUpgradeable, OwnableUpgradeable, IOracleRewardCB {
  event Donate(address from, uint256 playerId, uint256 amount, uint256 lotteryId, uint256 raffleId);
  event DonateToClan(address from, uint256 playerId, uint256 amount, uint256 clanId);
  event WinnerAndNewLottery(uint256 lotteryId, uint256 raffleId, uint16 rewardItemTokenId, uint256 rewardAmount);
  event SetRaffleEntryCost(uint256 brushAmount);
  event GlobalDonationThreshold(uint256 thresholdIncrement);
  event LastGlobalDonationThreshold(uint256 lastThreshold, uint16 rewardItemTokenId);
  event ClaimedLotteryWinnings(uint256 lotteryId, uint256 raffleId, uint256 itemTokenId, uint256 amount);
  event ClanDonationThreshold(uint256 thresholdIncrement, uint16 rewardItemTokenId);
  event LastClanDonationThreshold(uint256 clanId, uint256 lastThreshold, uint16 rewardItemTokenId);

  error NotOwnerOfPlayer();
  error NotEnoughBrush();
  error OracleNotCalledYet();
  error MinimumOneBrush();
  error NotPlayers();
  error OnlyWorld();
  error NoDecimalsAllowed(uint256 invalidAmount);

  struct ClanInfo {
    uint40 totalDonated;
    uint40 lastThreshold;
    uint16 nextReward;
  }

  using BitMaps for BitMaps.BitMap;

  IBrushToken private _brush;
  PlayerNFT private _playerNFT;
  address private _shop;
  mapping(uint256 lotteryId => BitMaps.BitMap) private _playersEntered;
  mapping(uint256 lotteryId => mapping(uint256 raffleId => uint256 playerId)) private _raffleIdToPlayerId; // So that we can work out the playerId winner from the raffle
  mapping(uint256 lotteryId => LotteryWinnerInfo winner) private _winners;
  BitMaps.BitMap private _claimedRewards;
  IPlayers private _players;
  address private _world;
  mapping(uint256 clanId => ClanInfo clanInfo) private _clanDonationInfo;
  uint16 private _donationRewardItemTokenId;
  uint40 private _totalDonated; // In BRUSH ether (no wei decimals)
  uint40 private _lastGlobalThreshold; // In BRUSH ether (no wei decimals)
  uint16 private _nextGlobalRewardItemTokenId;
  uint16 private _nextLotteryWinnerRewardItemTokenId;
  /// @custom:oz-renamed-from instantConsume
  bool private _nextLotteryWinnerRewardInstantConsume;
  uint16 private _lastLotteryId;
  uint24 private _lastRaffleId; // Relative to each lottery
  uint40 private _lastOracleRandomWordTimestamp;
  uint16 private _raffleEntryCost; // In BRUSH ether (no wei decimals)
  uint24 private _globalThresholdIncrement;
  uint40[6] private _lastUnclaimedWinners; // 1 storage slot to keep track of the last 3 winning playerId & lotteryId, stored as [playerId, lotteryId, playerId, lotteryId, playerId, lotteryId]
  Clans private _clans;
  uint24 private _clanThresholdIncrement;
  uint16[3] private _globalBoostRewardItemTokenIds;
  uint16[3] private _clanBoostRewardItemTokenIds;

  modifier onlyPlayers() {
    require(address(_players) == msg.sender, NotPlayers());
    _;
  }

  modifier onlyWorld() {
    require(_world == msg.sender, OnlyWorld());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IBrushToken brush,
    PlayerNFT playerNFT,
    address shop,
    address world,
    Clans clans,
    uint256 raffleEntryCost,
    uint256 globalThresholdIncrement,
    uint256 clanThresholdIncrement
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _brush = brush;
    _playerNFT = playerNFT;
    _shop = shop;
    _world = world;
    _clans = clans;

    setRaffleEntryCost(raffleEntryCost);
    setGlobalDonationThresholdIncrement(globalThresholdIncrement);
    setClanDonationThresholdIncrement(clanThresholdIncrement);

    _globalBoostRewardItemTokenIds = [PRAY_TO_THE_BEARDIE, PRAY_TO_THE_BEARDIE_2, PRAY_TO_THE_BEARDIE_3];
    _clanBoostRewardItemTokenIds = [CLAN_BOOSTER, CLAN_BOOSTER_2, CLAN_BOOSTER_3];

    _donationRewardItemTokenId = LUCK_OF_THE_DRAW;
    _nextGlobalRewardItemTokenId = _globalBoostRewardItemTokenIds[0];
    _lastLotteryId = 1;
    _nextLotteryWinnerRewardItemTokenId = LUCKY_POTION;
    _nextLotteryWinnerRewardInstantConsume = true;

    emit LastGlobalDonationThreshold(0, _globalBoostRewardItemTokenIds[0]);
    emit WinnerAndNewLottery(0, 0, _nextLotteryWinnerRewardItemTokenId, 1);
  }

  // playerId can be 0 to ignore it, otherwise sender must own it
  // Cannot donate until the oracle has finished being called if using a player
  function donate(
    address from,
    uint256 playerId,
    uint256 amount
  )
    external
    onlyPlayers
    returns (uint16 itemTokenId, uint16 globalItemTokenId, uint256 clanId, uint16 clanItemTokenId)
  {
    require(_brush.transferFrom(from, _shop, amount), NotEnoughBrush());

    bool isRaffleDonation = false;

    uint256 flooredAmountWei = (amount / 1 ether) * 1 ether;
    require(flooredAmountWei != 0, MinimumOneBrush());

    if (playerId != 0) {
      bool hasEnoughForRaffle = (amount / 1 ether) >= _raffleEntryCost;
      uint256 lastLotteryId = _lastLotteryId;
      bool hasEnteredAlready = _playersEntered[lastLotteryId].get(playerId);

      if (hasEnoughForRaffle && !hasEnteredAlready) {
        uint256 flooredTime = _lastOracleRandomWordTimestamp;
        require(flooredTime == 0 || flooredTime >= (block.timestamp / 1 days) * 1 days, OracleNotCalledYet());

        _raffleIdToPlayerId[lastLotteryId][++_lastRaffleId] = playerId;

        // Do not override this boost if you have one that started at this timestamp already (i.e winning lottery boost)
        // Note: Ideally this would be set inside Players but contract size issues....
        if (_players.getActiveBoost(playerId).extraOrLastStartTime != uint40(block.timestamp)) {
          itemTokenId = _donationRewardItemTokenId;
        }
        _playersEntered[lastLotteryId].set(playerId);
        isRaffleDonation = true;
      }

      clanId = _clans.getClanId(playerId);
      if (clanId != 0) {
        if (_clanDonationInfo[clanId].nextReward == 0) {
          // First time this clan has been donated to
          _clanDonationInfo[clanId].nextReward = _clanBoostRewardItemTokenIds[0];
        }

        uint40 totalDonatedToClan = _clanDonationInfo[clanId].totalDonated;
        totalDonatedToClan += uint40(amount / 1 ether);

        uint40 clanThresholdIncrement = _clanThresholdIncrement;
        uint256 nextClanThreshold = _clanDonationInfo[clanId].lastThreshold + clanThresholdIncrement;
        if (totalDonatedToClan >= nextClanThreshold) {
          // Give the whole clan a reward
          clanItemTokenId = _clanDonationInfo[clanId].nextReward;
          uint256 numThresholdIncrements = ((totalDonatedToClan - nextClanThreshold) / clanThresholdIncrement) + 1;
          _clanDonationInfo[clanId].lastThreshold += uint40(numThresholdIncrements * clanThresholdIncrement);

          // Cycle through them
          uint16 nextReward = clanItemTokenId == _clanBoostRewardItemTokenIds[_clanBoostRewardItemTokenIds.length - 1] // Reached the end so start again
            ? _clanBoostRewardItemTokenIds[0] // They just happen to be id'ed sequentially. If this changes then this logic will need to change
            : clanItemTokenId + 1;

          emit LastClanDonationThreshold(
            clanId,
            uint256(_clanDonationInfo[clanId].lastThreshold) * 1 ether,
            nextReward
          );
          _clanDonationInfo[clanId].nextReward = nextReward;
        }

        _clanDonationInfo[clanId].totalDonated = totalDonatedToClan;
        emit DonateToClan(from, playerId, flooredAmountWei, clanId);
      }
    }

    if (isRaffleDonation) {
      emit Donate(from, playerId, flooredAmountWei, _lastLotteryId, _lastRaffleId);
    } else {
      emit Donate(from, playerId, flooredAmountWei, 0, 0);
    }

    _totalDonated += uint40(amount / 1 ether);

    // Is a global donation threshold hit?
    uint256 nextGlobalThreshold = _lastGlobalThreshold + _globalThresholdIncrement;
    if (_totalDonated >= nextGlobalThreshold) {
      globalItemTokenId = _nextGlobalRewardItemTokenId;
      uint256 remainder = (_totalDonated - nextGlobalThreshold);
      uint256 numThresholdIncrements = (remainder / _globalThresholdIncrement) + 1;
      _lastGlobalThreshold += uint40(numThresholdIncrements * _globalThresholdIncrement);

      // Cycle through them
      uint16 nextReward;
      if (globalItemTokenId == _globalBoostRewardItemTokenIds[_globalBoostRewardItemTokenIds.length - 1]) {
        // Reached the end so start again
        nextReward = _globalBoostRewardItemTokenIds[0];
      } else {
        // They just happen to be id'ed sequentially. If this changes then this logic will need to change
        nextReward = globalItemTokenId + 1;
      }

      _nextGlobalRewardItemTokenId = nextReward;

      emit LastGlobalDonationThreshold(uint256(_lastGlobalThreshold) * 1 ether, nextReward);
    }
  }

  function newOracleRandomWords(uint256 randomWord) external onlyWorld {
    uint16 lastLotteryId = _lastLotteryId;
    uint24 lastRaffleId = _lastRaffleId;
    bool _hasDonations = lastRaffleId != 0;
    if (!_hasDonations && lastLotteryId == 1) {
      // No raffle winner and this is the first one so do nothing as sometimes
      // this callback can be called many times
      return;
    }

    if (_hasDonations) {
      // Decide the winner
      uint24 _raffleIdWinner = uint24(randomWord % lastRaffleId) + 1;
      _winners[lastLotteryId] = LotteryWinnerInfo({
        lotteryId: lastLotteryId,
        raffleId: _raffleIdWinner,
        itemTokenId: _nextLotteryWinnerRewardItemTokenId,
        amount: 1,
        instantConsume: _nextLotteryWinnerRewardInstantConsume,
        playerId: uint40(_raffleIdToPlayerId[lastLotteryId][_raffleIdWinner])
      });

      _lastRaffleId = 0;
      // Currently not set as currently the same each time: nextLotteryWinnerRewardItemTokenId & nextLotteryWinnerRewardInstantConsume;
      emit WinnerAndNewLottery(lastLotteryId, _raffleIdWinner, _nextLotteryWinnerRewardItemTokenId, 1);

      // Add to the last 3 unclaimed winners queue
      bool added;
      for (uint256 i = 0; i < _lastUnclaimedWinners.length; i += 2) {
        if (_lastUnclaimedWinners[i] == 0) {
          _lastUnclaimedWinners[i] = _winners[lastLotteryId].playerId;
          _lastUnclaimedWinners[i + 1] = lastLotteryId;
          added = true;
          break;
        }
      }

      if (!added) {
        // Shift the remaining ones down and add it to the end
        for (uint256 i = 2; i < _lastUnclaimedWinners.length; i += 2) {
          _lastUnclaimedWinners[i - 2] = _lastUnclaimedWinners[i];
          _lastUnclaimedWinners[i - 1] = _lastUnclaimedWinners[i + 1];
        }
        _lastUnclaimedWinners[_lastUnclaimedWinners.length - 2] = _winners[lastLotteryId].playerId;
        _lastUnclaimedWinners[_lastUnclaimedWinners.length - 1] = lastLotteryId;
      }
    } else {
      emit WinnerAndNewLottery(lastLotteryId, 0, _nextLotteryWinnerRewardItemTokenId, 1);
    }

    // Start new lottery
    _lastLotteryId = lastLotteryId + 1;
    _lastOracleRandomWordTimestamp = uint40((block.timestamp / 1 days) * 1 days);
  }

  function claimedLotteryWinnings(uint256 lotteryId) external onlyPlayers {
    LotteryWinnerInfo storage _lotteryWinner = _winners[lotteryId];
    emit ClaimedLotteryWinnings(
      _lotteryWinner.lotteryId,
      _lotteryWinner.raffleId,
      _lotteryWinner.itemTokenId,
      _lotteryWinner.amount
    );

    delete _winners[lotteryId];
    _claimedRewards.set(lotteryId);

    // Shift the remaining ones down
    for (uint256 i = 0; i < _lastUnclaimedWinners.length; i += 2) {
      if (_lastUnclaimedWinners[i + 1] == lotteryId) {
        // Shift the rest if there are any
        for (uint256 j = i + 2; j < _lastUnclaimedWinners.length; j += 2) {
          _lastUnclaimedWinners[j - 2] = _lastUnclaimedWinners[j];
          _lastUnclaimedWinners[j - 1] = _lastUnclaimedWinners[j + 1];
        }
        break;
      }
    }
    // Delete last ones
    delete _lastUnclaimedWinners[_lastUnclaimedWinners.length - 2];
    delete _lastUnclaimedWinners[_lastUnclaimedWinners.length - 1];
  }

  function _awaitingClaim(uint256 playerId) private view returns (uint256 lotteryId) {
    for (uint256 i = 0; i < _lastUnclaimedWinners.length; i += 2) {
      if (_lastUnclaimedWinners[i] == playerId) {
        lotteryId = _lastUnclaimedWinners[i + 1];
        break;
      }
    }
  }

  // Scans the last 3 unclaimed winners to see if this playerId belongs there.
  function getUnclaimedLotteryWinnings(uint256 playerId) external view returns (LotteryWinnerInfo memory winner) {
    uint256 _lotteryId = _awaitingClaim(playerId);
    if (_lotteryId != 0) {
      winner = _winners[_lotteryId];
    }
  }

  function getTotalDonated() external view returns (uint256) {
    return uint256(_totalDonated) * 1 ether;
  }

  function getClanTotalDonated(uint256 clanId) external view returns (uint256) {
    return uint256(_clanDonationInfo[clanId].totalDonated) * 1 ether;
  }

  function getNextGlobalThreshold() external view returns (uint256) {
    return uint256(_lastGlobalThreshold + _globalThresholdIncrement) * 1 ether;
  }

  function getNextClanThreshold(uint256 clanId) external view returns (uint256) {
    return (uint256(_clanDonationInfo[clanId].lastThreshold) + _clanThresholdIncrement) * 1 ether;
  }

  function getRaffleEntryCost() external view returns (uint256) {
    return uint256(_raffleEntryCost) * 1 ether;
  }

  function hasClaimedReward(uint256 lotteryId) external view returns (bool) {
    return _claimedRewards.get(lotteryId);
  }

  function hasPlayerEntered(uint256 lotteryId, uint256 playerId) external view returns (bool) {
    return _playersEntered[lotteryId].get(playerId);
  }

  function getLastLotteryId() external view returns (uint256) {
    return uint256(_lastLotteryId);
  }

  function getWinner(uint256 lotteryId) external view returns (LotteryWinnerInfo memory) {
    return _winners[lotteryId];
  }

  function getClanDonationInfo(uint256 clanId) external view returns (ClanInfo memory) {
    return _clanDonationInfo[clanId];
  }

  function getLastUnclaimedWinner(uint256 index) external view returns (uint256) {
    return uint256(_lastUnclaimedWinners[index]);
  }

  function setPlayers(IPlayers players) external onlyOwner {
    _players = players;
  }

  function setRaffleEntryCost(uint256 raffleEntryCost) public onlyOwner {
    require(raffleEntryCost % 1 ether == 0, NoDecimalsAllowed(raffleEntryCost));
    _raffleEntryCost = uint16(raffleEntryCost / 1 ether);
    emit SetRaffleEntryCost(raffleEntryCost);
  }

  function setGlobalDonationThresholdIncrement(uint256 globalThresholdIncrement) public onlyOwner {
    require(globalThresholdIncrement % 1 ether == 0, NoDecimalsAllowed(globalThresholdIncrement));
    _globalThresholdIncrement = uint24(globalThresholdIncrement / 1 ether);
    emit GlobalDonationThreshold(globalThresholdIncrement);
  }

  function setClanDonationThresholdIncrement(uint256 clanThresholdIncrement) public onlyOwner {
    require(clanThresholdIncrement % 1 ether == 0, NoDecimalsAllowed(clanThresholdIncrement));

    _clanThresholdIncrement = uint24(clanThresholdIncrement / 1 ether);
    emit ClanDonationThreshold(clanThresholdIncrement, _clanBoostRewardItemTokenIds[0]); // This passes in the first reward
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
