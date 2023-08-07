// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BitMaps} from "@openzeppelin/contracts/utils/structs/BitMaps.sol";

import {UUPSUpgradeable} from "./ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ozUpgradeable/access/OwnableUpgradeable.sol";

import {IBrushToken} from "./interfaces/IBrushToken.sol";
import {IOracleRewardCB} from "./interfaces/IOracleRewardCB.sol";
import {IPlayers} from "./interfaces/IPlayers.sol";
import {PlayerNFT} from "./PlayerNFT.sol";
import {Clans} from "./Clans/Clans.sol";

// solhint-disable-next-line no-global-import
import {Equipment, LUCKY_POTION, LUCK_OF_THE_DRAW, PRAY_TO_THE_BEARDIE, PRAY_TO_THE_BEARDIE_2, PRAY_TO_THE_BEARDIE_3, CLAN_BOOSTER, CLAN_BOOSTER_2, CLAN_BOOSTER_3, LotteryWinnerInfo} from "./globals/all.sol";

contract Donation is UUPSUpgradeable, OwnableUpgradeable, IOracleRewardCB {
  event Donate(address from, uint playerId, uint amount, uint lotteryId, uint raffleId);
  event DonateToClan(address from, uint playerId, uint amount, uint clanId);
  event WinnerAndNewLottery(uint lotteryId, uint raffleId, uint16 rewardItemTokenId, uint rewardAmount);
  event SetRaffleEntryCost(uint brushAmount);
  event NextGlobalDonationThreshold(uint amount, uint16 rewardItemTokenId);
  event ClaimedLotteryWinnings(uint lotteryId, uint raffleId, uint itemTokenId, uint amount);
  event ClanDonationThreshold(uint thresholdIncrement, uint16 rewardItemTokenId);
  event LastClanDonationThreshold(uint clanId, uint lastThreshold, uint16 rewardItemTokenId);

  error NotOwnerOfPlayer();
  error NotEnoughBrush();
  error OracleNotCalledYet();
  error OnlyPlayers();
  error OnlyWorld();

  struct ClanInfo {
    uint40 totalDonated;
    uint40 lastThreshold;
    uint40 numDonationsToday; // (Unused)
    uint40 lastDonationTimestamp; // (Unused)
    uint16 nextReward;
  }

  using BitMaps for BitMaps.BitMap;

  IBrushToken public brush;
  PlayerNFT public playerNFT;
  address public shop;
  mapping(uint lotteryId => BitMaps.BitMap) private playersEntered;
  mapping(uint lotteryId => mapping(uint raffleId => uint playerId)) public raffleIdToPlayerId; // So that we can work out the playerId winner from the raffle
  mapping(uint lotteryId => LotteryWinnerInfo winner) public winners;
  BitMaps.BitMap private claimedRewards;
  IPlayers private players;
  address private world;
  mapping(uint clanId => ClanInfo clanInfo) public clanDonationInfo;
  uint16 public donationRewardItemTokenId;
  uint40 private totalDonated; // In BRUSH ether (no wei decimals)
  uint40 private nextGlobalThreshold; // In BRUSH ether (no wei decimals)
  uint16 public nextGlobalRewardItemTokenId;
  uint16 public nextLotteryWinnerRewardItemTokenId;
  /// @custom:oz-renamed-from instantConsume
  bool public nextLotteryWinnerRewardInstantConsume;
  uint16 public lastLotteryId;
  uint24 public lastRaffleId; // Relative to each lottery
  uint40 public lastOracleRandomWordTimestamp;
  uint16 private raffleEntryCost; // In BRUSH ether (no wei decimals)
  uint40[6] public lastUnclaimedWinners; // 1 storage slot to keep track of the last 3 winning playerId & lotteryId, stored as [playerId, lotteryId, playerId, lotteryId, playerId, lotteryId]
  Clans private clans;
  uint40 public clanThresholdIncrement;
  bool public isBeta;
  uint16[3] private globalBoostRewardItemTokenIds;
  uint16[3] private clanBoostRewardItemTokenIds;

  modifier onlyPlayers() {
    if (address(players) != msg.sender) {
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
    Clans _clans,
    uint _raffleEntryCost,
    uint _startGlobalThreshold,
    uint _clanThresholdIncrement,
    bool _isBeta
  ) public initializer {
    __Ownable_init();
    __UUPSUpgradeable_init();

    brush = _brush;
    playerNFT = _playerNFT;
    shop = _shop;
    world = _world;
    clans = _clans;

    globalBoostRewardItemTokenIds = [PRAY_TO_THE_BEARDIE, PRAY_TO_THE_BEARDIE_2, PRAY_TO_THE_BEARDIE_3];
    clanBoostRewardItemTokenIds = [CLAN_BOOSTER, CLAN_BOOSTER_2, CLAN_BOOSTER_3];

    raffleEntryCost = uint16(_raffleEntryCost / 1 ether);
    donationRewardItemTokenId = LUCK_OF_THE_DRAW;
    nextGlobalThreshold = uint40(_startGlobalThreshold / 1 ether);
    nextGlobalRewardItemTokenId = globalBoostRewardItemTokenIds[0];
    isBeta = _isBeta;
    lastLotteryId = 1;
    clanThresholdIncrement = uint40(_clanThresholdIncrement / 1 ether);
    nextLotteryWinnerRewardItemTokenId = LUCKY_POTION;
    nextLotteryWinnerRewardInstantConsume = true;

    emit SetRaffleEntryCost(_raffleEntryCost);
    emit NextGlobalDonationThreshold(_startGlobalThreshold, globalBoostRewardItemTokenIds[0]);
    emit ClanDonationThreshold(_clanThresholdIncrement, clanBoostRewardItemTokenIds[0]);
    emit WinnerAndNewLottery(0, 0, nextLotteryWinnerRewardItemTokenId, 1);
  }

  // _playerId can be 0 to ignore it, otherwise sender must own it
  // Cannot donate until the oracle has finished being called if using a player
  function donate(
    address _from,
    uint _playerId,
    uint _amount
  ) external onlyPlayers returns (uint16 itemTokenId, uint16 globalItemTokenId, uint clanId, uint16 clanItemTokenId) {
    if (!brush.transferFrom(_from, shop, _amount)) {
      revert NotEnoughBrush();
    }

    bool isRaffleDonation = false;

    if (_playerId != 0) {
      bool hasEnoughForRaffle = (_amount / 1 ether) >= raffleEntryCost;
      uint _lastLotteryId = lastLotteryId;
      bool hasEnteredAlready = playersEntered[_lastLotteryId].get(_playerId);

      if (hasEnoughForRaffle && !hasEnteredAlready) {
        uint flooredTime = lastOracleRandomWordTimestamp;
        if (flooredTime != 0 && flooredTime < (block.timestamp / 1 days) * 1 days) {
          revert OracleNotCalledYet();
        }

        raffleIdToPlayerId[_lastLotteryId][++lastRaffleId] = _playerId;

        // Do not override this boost if you have one that started at this timestamp already (i.e winning lottery boost)
        // Note: Ideally this would be set inside Players but contract size issues....
        if (players.activeBoost(_playerId).extraOrLastStartTime != uint40(block.timestamp)) {
          itemTokenId = donationRewardItemTokenId;
        }
        playersEntered[_lastLotteryId].set(_playerId);
        isRaffleDonation = true;
      }

      clanId = clans.getClanId(_playerId);
      if (clanId != 0) {
        // Add raffle donation amount only to the clan reward reward to prevent them reaching it too quickly.
        // Note: Make sure no important state is set before the max donations check
        if (clanDonationInfo[clanId].nextReward == 0) {
          // First time this clan has been donated to
          clanDonationInfo[clanId].nextReward = clanBoostRewardItemTokenIds[0];
        }

        uint40 totalDonatedToClan = clanDonationInfo[clanId].totalDonated;
        totalDonatedToClan += uint40(_amount / 1 ether);

        uint nextClanThreshold = (clanDonationInfo[clanId].lastThreshold + clanThresholdIncrement);
        if (totalDonatedToClan >= nextClanThreshold) {
          // Give the whole clan a reward
          clanItemTokenId = clanDonationInfo[clanId].nextReward;
          uint remainder = (totalDonatedToClan - nextClanThreshold);
          uint numThresholdIncrements = (remainder / clanThresholdIncrement) + 1;
          clanDonationInfo[clanId].lastThreshold += uint40(numThresholdIncrements * clanThresholdIncrement);

          // Cycle through them
          uint16 nextReward;
          if (clanItemTokenId == clanBoostRewardItemTokenIds[clanBoostRewardItemTokenIds.length - 1]) {
            // Reached the end so start again
            nextReward = clanBoostRewardItemTokenIds[0];
          } else {
            // They just happen to be id'ed sequentially. If this changes then this logic will need to change
            nextReward = clanItemTokenId + 1;
          }
          emit LastClanDonationThreshold(clanId, uint(clanDonationInfo[clanId].lastThreshold) * 1 ether, nextReward);
          clanDonationInfo[clanId].nextReward = nextReward;
        }

        clanDonationInfo[clanId].totalDonated = totalDonatedToClan;
        emit DonateToClan(_from, _playerId, _amount * 1 ether, clanId);
      }
      emit Donate(_from, _playerId, _amount, _lastLotteryId, lastRaffleId);
    }

    if (!isRaffleDonation) {
      emit Donate(_from, _playerId, _amount, 0, 0);
    }

    totalDonated += uint40(_amount / 1 ether);

    // Is a donation threshold hit?
    if (nextGlobalThreshold != 0 && totalDonated >= nextGlobalThreshold) {
      globalItemTokenId = nextGlobalRewardItemTokenId;
      uint nextIncrement = isBeta ? 1000 : 100_000;
      uint remainder = (totalDonated - nextGlobalThreshold);
      uint numThresholdIncrements = (remainder / nextIncrement) + 1;
      nextGlobalThreshold += uint40(numThresholdIncrements * nextIncrement);

      // Cycle through them
      uint16 nextReward;
      if (globalItemTokenId == globalBoostRewardItemTokenIds[globalBoostRewardItemTokenIds.length - 1]) {
        // Reached the end so start again
        nextReward = globalBoostRewardItemTokenIds[0];
      } else {
        // They just happen to be id'ed sequentially. If this changes then this logic will need to change
        nextReward = globalItemTokenId + 1;
      }

      nextGlobalRewardItemTokenId = nextReward;

      emit NextGlobalDonationThreshold(uint(nextGlobalThreshold) * 1 ether, nextReward);
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

    bool hasDonations = lastRaffleId != 0;
    if (!hasDonations && _lastLotteryId == 1) {
      // No raffle winner and this is the first one so do nothing as sometimes
      // this callback can be called many times
      return;
    }

    if (hasDonations) {
      // Decide the winner
      uint24 raffleIdWinner = uint24(randomWords[0] % lastRaffleId) + 1;
      winners[_lastLotteryId] = LotteryWinnerInfo({
        lotteryId: _lastLotteryId,
        raffleId: raffleIdWinner,
        itemTokenId: nextLotteryWinnerRewardItemTokenId,
        amount: 1,
        instantConsume: nextLotteryWinnerRewardInstantConsume,
        playerId: uint40(raffleIdToPlayerId[_lastLotteryId][raffleIdWinner])
      });

      lastRaffleId = 0;
      // Currently not set as currently the same each time: nextLotteryWinnerRewardItemTokenId & nextLotteryWinnerRewardInstantConsume;
      emit WinnerAndNewLottery(_lastLotteryId, raffleIdWinner, nextLotteryWinnerRewardItemTokenId, 1);

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
    } else {
      emit WinnerAndNewLottery(_lastLotteryId, 0, nextLotteryWinnerRewardItemTokenId, 1);
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

  function getNextGlobalThreshold() external view returns (uint) {
    return uint(nextGlobalThreshold) * 1 ether;
  }

  function getNextClanThreshold(uint _clanId) external view returns (uint) {
    return (uint(clanDonationInfo[_clanId].lastThreshold) + clanThresholdIncrement) * 1 ether;
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

  function setPlayers(IPlayers _players) external onlyOwner {
    players = _players;
  }

  function setRaffleEntryCost(uint _raffleEntryCost) external onlyOwner {
    raffleEntryCost = uint16(_raffleEntryCost / 1 ether);
    emit SetRaffleEntryCost(_raffleEntryCost);
  }

  function setClanThresholdIncrement(uint _clanThresholdIncrement) external onlyOwner {
    clanThresholdIncrement = uint40(_clanThresholdIncrement / 1 ether);
    emit ClanDonationThreshold(_clanThresholdIncrement, clanBoostRewardItemTokenIds[0]);
  }

  function setNextGlobalDonationThreshold(uint _nextGlobalDonationThreshold) external onlyOwner {
    nextGlobalThreshold = uint40(_nextGlobalDonationThreshold / 1 ether);

    emit NextGlobalDonationThreshold(_nextGlobalDonationThreshold, nextGlobalRewardItemTokenId); // re-use current reward
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
