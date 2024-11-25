// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IBrushToken} from "../interfaces/external/IBrushToken.sol";
import {IBank} from "../interfaces/IBank.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {ILockedBankVaults} from "../interfaces/ILockedBankVaults.sol";
import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";
import {ISamWitchVRF} from "../interfaces/ISamWitchVRF.sol";

import {AdminAccess} from "../AdminAccess.sol";
import {ItemNFT} from "../ItemNFT.sol";
import {VRFRequestInfo} from "../VRFRequestInfo.sol";

import {BattleResultEnum, ClanRank, CLAN_WARS_GAS_PRICE_WINDOW_SIZE, VaultClanInfo, Vault, ClanBattleInfo, XP_EMITTED_ELSEWHERE} from "../globals/clans.sol";
import {Item, EquipPosition} from "../globals/players.sol";
import {BoostType, Skill} from "../globals/misc.sol";
import {NONE} from "../globals/items.sol";

import {ClanBattleLibrary} from "./ClanBattleLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";
import {LockedBankVaultsLibrary} from "./LockedBankVaultsLibrary.sol";
import {BankRelay} from "./BankRelay.sol";

contract LockedBankVaults is UUPSUpgradeable, OwnableUpgradeable, ILockedBankVaults, IClanMemberLeftCB {
  event AttackVaults(
    uint256 clanId,
    uint256 defendingClanId,
    address from,
    uint256 leaderPlayerId,
    uint256 requestId,
    uint256 pendingAttackId,
    uint256 attackingCooldownTimestamp,
    uint256 reattackingCooldownTimestamp,
    uint256 itemTokenId
  );
  event SetComparableSkills(Skill[] skills);
  event BattleResult(
    uint256 requestId,
    uint64[] attackingPlayerIds,
    uint64[] defendingPlayerIds,
    uint256[] attackingRolls,
    uint256[] defendingRolls,
    uint8[] battleResults, // BattleResultEnum
    uint8[] randomSkills, // Skill
    bool didAttackersWin,
    uint256 attackingClanId,
    uint256 defendingClanId,
    uint256[] randomWords,
    uint256 percentageToTake,
    uint256 brushLost,
    int256 attackingMMRDiff,
    int256 defendingMMRDiff,
    uint256 clanXPGainedWinner
  );

  event AssignCombatants(
    uint256 clanId,
    uint64[] playerIds,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );
  event RemoveCombatant(uint256 playerId, uint256 clanId);
  event ClaimFunds(uint256 clanId, address from, uint256 playerId, uint256 amount, uint256 numLocksClaimed);
  event LockFunds(uint256 clanId, address from, uint256 playerId, uint256 amount, uint256 lockingTimestamp);
  event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
  event SetMaxLockedVaults(uint256 maxLockedVaults);
  event SetMaxClanCombatants(uint256 maxClanCombatants);
  event BlockingAttacks(
    uint256 clanId,
    uint256 itemTokenId,
    address from,
    uint256 leaderPlayerId,
    uint256 blockAttacksTimestamp,
    uint256 blockAttacksCooldownTimestamp
  );
  event SuperAttackCooldown(uint256 clanId, uint256 cooldownTimestamp);
  event SetMMRAttackDistance(uint256 mmrAttackDistance);
  event ForceMMRUpdate(uint256[] clanIdsToDelete);
  event SetMMRs(uint256[] clanIds, uint16[] mmrs);
  event SetKValues(uint256 Ka, uint256 Kd);
  event SetBrushDistributionPercentages(
    uint256 brushBurntPercentage,
    uint256 brushTreasuryPercentage,
    uint256 brushDevPercentage
  );
  event SetPreventAttacks(bool preventAttacks);

  error PlayerOnTerritory();
  error TooManyCombatants();
  error NotOwnerOfPlayerAndActive();
  error RankNotHighEnough();
  error InvalidSkill(Skill skill);
  error NotMemberOfClan();
  error LengthMismatch();
  error OnlyClans();
  error OnlyTerritories();
  error OnlyCombatantsHelper();
  error TransferFailed();
  error CannotChangeCombatantsDuringAttack();
  error NotAdminAndBeta();
  error InsufficientCost();
  error RequestIdNotKnown();
  error CallerNotSamWitchVRF();
  error AttacksPrevented();
  error PercentNotTotal100();

  struct PendingAttack {
    uint40 clanId;
    uint40 defendingClanId;
    bool attackInProgress;
    uint8 extraRollsAttacker;
    uint8 extraRollsDefender;
  }

  uint256 private constant NUM_WORDS = 7;
  uint256 private constant NUM_PACKED_VAULTS = 2;
  uint40 private constant CLAN_XP_GAINED_WIN = 10;

  Skill[] private _comparableSkills;
  uint64 private _nextPendingAttackId;
  bool private _preventAttacks;
  mapping(uint256 clanId => VaultClanInfo clanInfo) private _clanInfos;
  mapping(uint256 pendingAttackId => PendingAttack pendingAttack) private _pendingAttacks;
  mapping(bytes32 requestId => uint256 pendingAttackId) private _requestToPendingAttackIds;
  mapping(uint256 clanId => mapping(uint256 otherClanId => ClanBattleInfo battleInfo)) private _lastClanBattles; // Always ordered from lowest clanId to highest
  IClans private _clans;
  IPlayers private _players;
  IBrushToken private _brush;
  ITerritories private _territories;
  ItemNFT private _itemNFT;
  AdminAccess private _adminAccess;
  bool private _isBeta;
  IBankFactory private _bankFactory;
  BankRelay private _bankRelay;
  address private _combatantsHelper;
  uint24 private _combatantChangeCooldown;
  uint8 private _maxClanCombatants;
  address private _treasury;
  address private _dev;
  uint8 private _brushBurntPercentage;
  uint8 private _brushTreasuryPercentage;
  uint8 private _brushDevPercentage;

  VRFRequestInfo _vrfRequestInfo;
  address private _oracle;
  uint16 private _mmrAttackDistance;
  uint24 private _expectedGasLimitFulfill;
  uint24 private _attackingCooldown;
  uint24 private _reattackingCooldown;
  uint8 private _maxLockedVaults;
  ISamWitchVRF private _samWitchVRF;
  uint8 private _kA; // attacker K-factor
  uint8 private _kD; // defender K-factor
  uint24 private _lockFundsPeriod;
  // Clans are sorted as follows:
  // 1 - From lower MMR to higher MMR
  // 2 - If there are multiple clans with the same MMR, they are sorted by:
  //   2.1 - Whoever was there first gets a higher rank (higher index)
  //   2.2 - The attacker is always ranked higher than the defender whether they win or lose as they are placed in the array first
  uint48[] private _sortedClansByMMR; // Packed uint32 clanId | uint16 MMR

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  modifier isMinimumRank(uint256 clanId, uint256 playerId, ClanRank clanRank) {
    require(_clans.getRank(clanId, playerId) >= clanRank, RankNotHighEnough());
    _;
  }

  modifier isClanMember(uint256 clanId, uint256 playerId) {
    require(_clans.getRank(clanId, playerId) != ClanRank.NONE, NotMemberOfClan());
    _;
  }

  modifier onlyClans() {
    require(_msgSender() == address(_clans), OnlyClans());
    _;
  }

  modifier onlyTerritories() {
    require(_msgSender() == address(_territories), OnlyTerritories());
    _;
  }

  modifier isAdminAndBeta() {
    require(_adminAccess.isAdmin(_msgSender()) && _isBeta, NotAdminAndBeta());
    _;
  }

  modifier onlyCombatantsHelper() {
    require(_msgSender() == _combatantsHelper, OnlyCombatantsHelper());
    _;
  }

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    require(_msgSender() == address(_samWitchVRF), CallerNotSamWitchVRF());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPlayers players,
    IClans clans,
    IBrushToken brush,
    address bankRelay,
    ItemNFT itemNFT,
    address treasury,
    address dev,
    address oracle,
    ISamWitchVRF samWitchVRF,
    VRFRequestInfo vrfRequestInfo,
    Skill[] calldata comparableSkills,
    uint16 mmrAttackDistance,
    uint24 lockFundsPeriod,
    uint8 maxClanCombatants,
    uint8 maxLockedVaults,
    AdminAccess adminAccess,
    bool isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _players = players;
    _clans = clans;
    _brush = brush;
    _bankRelay = BankRelay(bankRelay);
    _itemNFT = itemNFT;
    _treasury = treasury;
    _dev = dev;
    _oracle = oracle;
    _samWitchVRF = samWitchVRF;
    _lockFundsPeriod = lockFundsPeriod;
    _adminAccess = adminAccess;
    _isBeta = isBeta;
    _attackingCooldown = isBeta ? 1 minutes + 30 seconds : 4 hours;
    _reattackingCooldown = isBeta ? 6 minutes : 1 days;
    _vrfRequestInfo = vrfRequestInfo;
    _combatantChangeCooldown = isBeta ? 5 minutes : 3 days;

    setExpectedGasLimitFulfill(3_500_000);
    setKValues(32, 32);
    setMaxClanCombatants(maxClanCombatants);
    setComparableSkills(comparableSkills);
    setMMRAttackDistance(mmrAttackDistance);
    setMaxLockedVaults(maxLockedVaults);
    _nextPendingAttackId = 1;
  }

  function assignCombatants(
    uint256 clanId,
    uint64[] calldata playerIds,
    uint256 combatantCooldownTimestamp,
    uint256 leaderPlayerId
  ) external override onlyCombatantsHelper {
    VaultClanInfo storage clanInfo = _clanInfos[clanId];
    LockedBankVaultsLibrary.checkCanAssignCombatants(clanInfo, playerIds, _maxClanCombatants);
    clanInfo.playerIds = playerIds;
    clanInfo.assignCombatantsCooldownTimestamp = uint40(block.timestamp + _combatantChangeCooldown);
    emit AssignCombatants(clanId, playerIds, _msgSender(), leaderPlayerId, combatantCooldownTimestamp);
  }

  // Some vaults may no longer be attackable if they don't have any funds, so force the MMR arrays to be re-calculated.
  function forceMMRUpdate(uint256[] calldata clanIds) external {
    uint256[] memory clanIdsToDelete = LockedBankVaultsLibrary.forceMMRUpdate(
      _sortedClansByMMR,
      _clans,
      _clanInfos,
      clanIds
    );
    if (clanIdsToDelete.length != 0) {
      emit ForceMMRUpdate(clanIdsToDelete);
    }
  }

  function getIdleClans() external view returns (uint256[] memory clanIds) {
    return LockedBankVaultsLibrary.getIdleClans(_sortedClansByMMR, _clanInfos, _clans);
  }

  // This needs to call the oracle VRF on-demand and calls the callback
  function attackVaults(
    uint256 clanId,
    uint256 defendingClanId,
    uint16 itemTokenId,
    uint256 leaderPlayerId
  ) external payable isOwnerOfPlayerAndActive(leaderPlayerId) isMinimumRank(clanId, leaderPlayerId, ClanRank.COLONEL) {
    require(!_preventAttacks, AttacksPrevented());
    // Check they are paying enough
    require(msg.value >= getAttackCost(), InsufficientCost());

    (bool success, ) = _oracle.call{value: msg.value}("");
    require(success, TransferFailed());

    (bool isReattacking, bool isUsingSuperAttack, uint256 superAttackCooldownTimestamp) = LockedBankVaultsLibrary
      .checkCanAttackVaults(
        clanId,
        defendingClanId,
        itemTokenId,
        _maxLockedVaults,
        NUM_PACKED_VAULTS,
        _itemNFT,
        _clanInfos,
        _lastClanBattles
      );
    if ((isReattacking || isUsingSuperAttack) && itemTokenId != NONE) {
      _itemNFT.burn(_msgSender(), itemTokenId, 1);
    }

    // Check MMRs are within the list, X ranks above and below. However at the extremes add it to the other end
    LockedBankVaultsLibrary.checkWithinRange(_sortedClansByMMR, clanId, defendingClanId, _clans, _mmrAttackDistance);

    VaultClanInfo storage clanInfo = _clanInfos[clanId];
    clanInfo.currentlyAttacking = true;

    uint64 nextPendingAttackId = _nextPendingAttackId++;

    uint40 attackingCooldownTimestamp = uint40(block.timestamp + _attackingCooldown);
    clanInfo.attackingCooldownTimestamp = attackingCooldownTimestamp;
    if (isUsingSuperAttack) {
      clanInfo.superAttackCooldownTimestamp = uint40(superAttackCooldownTimestamp);
    }

    // Don't change the attacking timestamp if re-attacking
    uint40 reattackingCooldownTimestamp = uint40(block.timestamp + _reattackingCooldown);
    uint256 lowerClanId = clanId < defendingClanId ? clanId : defendingClanId;
    uint256 higherClanId = clanId < defendingClanId ? defendingClanId : clanId;
    ClanBattleInfo storage battleInfo = _lastClanBattles[lowerClanId][higherClanId];
    if (lowerClanId == clanId) {
      if (isReattacking) {
        reattackingCooldownTimestamp = battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp;
        ++battleInfo.numReattacks;
      } else {
        battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp = reattackingCooldownTimestamp;
        battleInfo.numReattacks = 0;
      }
    } else {
      if (isReattacking) {
        reattackingCooldownTimestamp = battleInfo.lastOtherClanIdAttackClanIdCooldownTimestamp;
        ++battleInfo.numReattacksOtherClan;
      } else {
        battleInfo.lastOtherClanIdAttackClanIdCooldownTimestamp = reattackingCooldownTimestamp;
        battleInfo.numReattacksOtherClan = 0;
      }
    }

    _pendingAttacks[nextPendingAttackId] = PendingAttack({
      clanId: uint40(clanId),
      defendingClanId: uint40(defendingClanId),
      attackInProgress: true,
      extraRollsAttacker: isUsingSuperAttack ? 1 : 0,
      extraRollsDefender: 0
    });
    bytes32 requestId = _requestRandomWords();
    _requestToPendingAttackIds[requestId] = nextPendingAttackId;

    emit AttackVaults(
      clanId,
      defendingClanId,
      _msgSender(),
      leaderPlayerId,
      uint256(requestId),
      nextPendingAttackId,
      attackingCooldownTimestamp,
      reattackingCooldownTimestamp,
      itemTokenId
    );

    if (isUsingSuperAttack) {
      emit SuperAttackCooldown(clanId, superAttackCooldownTimestamp);
    }
  }

  /// @notice Called by the SamWitchVRF oracle contract to fulfill the request
  function fulfillRandomWords(bytes32 requestId, uint256[] calldata randomWords) external onlySamWitchVRF {
    require(randomWords.length == NUM_WORDS, LengthMismatch());

    PendingAttack storage pendingAttack = _pendingAttacks[_requestToPendingAttackIds[requestId]];
    require(pendingAttack.attackInProgress, RequestIdNotKnown());

    (uint40 attackingClanId, uint256 defendingClanId) = (pendingAttack.clanId, pendingAttack.defendingClanId);
    uint64[] memory attackingPlayerIds = _clanInfos[attackingClanId].playerIds;
    uint64[] memory defendingPlayerIds = _clanInfos[defendingClanId].playerIds;

    uint8[] memory randomSkills = new uint8[](Math.max(attackingPlayerIds.length, defendingPlayerIds.length));
    for (uint256 i; i < randomSkills.length; ++i) {
      randomSkills[i] = uint8(
        _comparableSkills[uint8(randomWords[NUM_WORDS - 1] >> (i * 8)) % _comparableSkills.length]
      );
    }

    (
      uint8[] memory battleResults,
      uint256[] memory attackingRolls,
      uint256[] memory defendingRolls,
      bool didAttackersWin
    ) = ClanBattleLibrary.determineBattleOutcome(
        address(_players),
        attackingPlayerIds,
        defendingPlayerIds,
        randomSkills,
        randomWords,
        pendingAttack.extraRollsAttacker,
        pendingAttack.extraRollsDefender
      );

    pendingAttack.attackInProgress = false;
    _clanInfos[attackingClanId].currentlyAttacking = false;

    uint256 losingClanId = didAttackersWin ? defendingClanId : attackingClanId;
    uint256 percentageToTake = didAttackersWin ? 10 : 5;

    // Go through all the defendingVaults of who ever lost and take a percentage from them
    uint256 totalWon;
    uint256 vaultOffset = _clanInfos[losingClanId].defendingVaultsOffset;
    uint256 length = _clanInfos[losingClanId].defendingVaults.length;
    for (uint256 i = vaultOffset; i < length; ++i) {
      Vault storage losersVault = _clanInfos[losingClanId].defendingVaults[i];
      totalWon += _stealFromVault(losersVault, losingClanId, percentageToTake);
    }

    _vrfRequestInfo.updateAverageGasPrice();

    (int256 attackingMMRDiff, int256 defendingMMRDiff) = LockedBankVaultsLibrary.fulfillUpdateMMR(
      _kA,
      _kD,
      _sortedClansByMMR,
      _clans,
      attackingClanId,
      defendingClanId,
      didAttackersWin,
      _clanInfos
    );

    uint256 brushLost;
    if (!didAttackersWin && totalWon != 0) {
      // Lost so take a percentage from the loser's vaults and distribute it
      uint256 amountToTreasure = (totalWon * _brushTreasuryPercentage) / 100;
      uint256 amountToDao = (totalWon * _brushDevPercentage) / 100;
      uint256 brushBurnt = (totalWon * _brushBurntPercentage) / 100;

      _brush.transfer(_treasury, amountToTreasure);
      _brush.transfer(_dev, amountToDao);
      _brush.burn(brushBurnt);

      brushLost = totalWon;
    }

    uint40 clanXPGainedWinner = didAttackersWin ? CLAN_XP_GAINED_WIN : 0;

    emit BattleResult(
      uint256(requestId),
      attackingPlayerIds,
      defendingPlayerIds,
      attackingRolls,
      defendingRolls,
      battleResults,
      randomSkills,
      didAttackersWin,
      attackingClanId,
      defendingClanId,
      randomWords,
      percentageToTake,
      brushLost,
      attackingMMRDiff,
      defendingMMRDiff,
      clanXPGainedWinner
    );

    if (didAttackersWin) {
      _clans.addXP(attackingClanId, clanXPGainedWinner, XP_EMITTED_ELSEWHERE);
      _lockFunds(attackingClanId, address(0), 0, totalWon);
    }
  }

  function claimFunds(uint256 clanId, uint256 playerId) external isOwnerOfPlayerAndActive(playerId) {
    VaultClanInfo storage clanInfo = _clanInfos[clanId];

    address bankAddress = address(_clanInfos[clanId].bank);
    if (bankAddress == address(0)) {
      bankAddress = _bankFactory.getBankAddress(clanId);
      _brush.approve(bankAddress, type(uint256).max);
      clanInfo.bank = IBank(bankAddress);
    }

    (uint256 total, uint256 numLocksClaimed) = LockedBankVaultsLibrary.claimFunds(_sortedClansByMMR, clanInfo, clanId);
    address sender = _msgSender();
    emit ClaimFunds(clanId, sender, playerId, total, numLocksClaimed);
    _bankRelay.depositTokenForAtBank(payable(address(clanInfo.bank)), sender, playerId, address(_brush), total);
  }

  function blockAttacks(
    uint256 clanId,
    uint16 itemTokenId,
    uint256 playerId
  ) external isOwnerOfPlayerAndActive(playerId) isClanMember(clanId, playerId) {
    uint256 blockAttacksTimestamp = LockedBankVaultsLibrary.blockAttacks(_itemNFT, itemTokenId, _clanInfos[clanId]);
    // TODO: Add blockAttacksCooldownHours to a BlockingAttacks
    emit BlockingAttacks(clanId, itemTokenId, _msgSender(), playerId, blockAttacksTimestamp, block.timestamp);
  }

  function lockFunds(uint256 clanId, address from, uint256 playerId, uint256 amount) external onlyTerritories {
    _lockFunds(clanId, from, playerId, amount);
    VaultClanInfo storage clanInfo = _clanInfos[clanId];
    if (!clanInfo.isInMMRArray) {
      LockedBankVaultsLibrary.insertMMRArray(_sortedClansByMMR, _clans.getMMR(clanId), uint32(clanId));
      clanInfo.isInMMRArray = true;
    }
    require(amount == 0 || _brush.transferFrom(_msgSender(), address(this), amount), TransferFailed());
  }

  function clanMemberLeft(uint256 clanId, uint256 playerId) external override onlyClans {
    // Remove a player combatant if they are currently assigned in this clan
    VaultClanInfo storage clanInfo = _clanInfos[clanId];
    if (clanInfo.playerIds.length != 0) {
      uint256 searchIndex = EstforLibrary.binarySearch(clanInfo.playerIds, playerId);
      if (searchIndex != type(uint256).max) {
        // Shift the whole array to delete the element
        for (uint256 i = searchIndex; i < clanInfo.playerIds.length - 1; ++i) {
          clanInfo.playerIds[i] = clanInfo.playerIds[i + 1];
        }
        clanInfo.playerIds.pop();
        emit RemoveCombatant(playerId, clanId);
      }
    }
  }

  function _stealFromVault(
    Vault storage losersVault,
    uint256 clanId,
    uint256 percentageToTake
  ) private returns (uint256 amountWon) {
    if (losersVault.timestamp > block.timestamp) {
      uint256 amount = losersVault.amount;
      uint256 stealAmount = (amount * percentageToTake) / 100;
      losersVault.amount = uint80(amount - stealAmount);
      _clanInfos[clanId].totalBrushLocked -= uint96(stealAmount);
      amountWon += stealAmount;
    }

    if (losersVault.timestamp1 > block.timestamp) {
      uint256 amount1 = losersVault.amount1;
      uint256 stealAmount1 = (amount1 * percentageToTake) / 100;
      losersVault.amount1 = uint80(amount1 - stealAmount1);
      _clanInfos[clanId].totalBrushLocked -= uint96(stealAmount1);
      amountWon += stealAmount1;
    }
  }

  function _lockFunds(uint256 clanId, address from, uint256 playerId, uint256 amount) private {
    if (amount == 0) {
      return;
    }
    VaultClanInfo storage clanInfo = _clanInfos[clanId];
    uint256 totalBrushLocked = clanInfo.totalBrushLocked;
    clanInfo.totalBrushLocked = uint96(totalBrushLocked + amount);
    uint40 lockingTimestamp = uint40(block.timestamp + _lockFundsPeriod);
    uint256 length = clanInfo.defendingVaults.length;
    if (length == 0 || (clanInfo.defendingVaults[length - 1].timestamp1 != 0)) {
      // Start a new one
      clanInfo.defendingVaults.push(
        Vault({claimed: false, timestamp: lockingTimestamp, amount: uint80(amount), timestamp1: 0, amount1: 0})
      );
    } else {
      // Update existing storage slot
      clanInfo.defendingVaults[length - 1].timestamp1 = lockingTimestamp;
      clanInfo.defendingVaults[length - 1].amount1 = uint80(amount);
    }

    emit LockFunds(clanId, from, playerId, amount, lockingTimestamp);
  }

  function _requestRandomWords() private returns (bytes32 requestId) {
    requestId = _samWitchVRF.requestRandomWords(NUM_WORDS, _expectedGasLimitFulfill);
  }

  function getAttackCost() public view returns (uint256) {
    (uint64 movingAverageGasPrice, uint88 baseRequestCost) = _vrfRequestInfo.get();
    return baseRequestCost + (movingAverageGasPrice * _expectedGasLimitFulfill);
  }

  function getClanInfo(uint256 clanId) external view returns (VaultClanInfo memory) {
    return _clanInfos[clanId];
  }

  function isCombatant(uint256 clanId, uint256 playerId) external view override returns (bool) {
    uint64[] storage playerIds = _clanInfos[clanId].playerIds;
    if (playerIds.length == 0) {
      return false;
    }

    uint256 searchIndex = EstforLibrary.binarySearch(playerIds, playerId);
    return searchIndex != type(uint256).max;
  }

  function getSortedClanIdsByMMR() external view returns (uint32[] memory) {
    return LockedBankVaultsLibrary.getSortedClanIdsByMMR(_sortedClansByMMR);
  }

  function getSortedMMR() external view returns (uint16[] memory) {
    return LockedBankVaultsLibrary.getSortedMMR(_sortedClansByMMR);
  }

  function getLastClanBattles(uint256 clanId, uint256 otherClanId) external view returns (ClanBattleInfo memory) {
    return _lastClanBattles[clanId][otherClanId];
  }

  function setComparableSkills(Skill[] calldata skills) public onlyOwner {
    for (uint256 i = 0; i < skills.length; ++i) {
      require(skills[i] != Skill.NONE && skills[i] != Skill.COMBAT, InvalidSkill(skills[i]));

      _comparableSkills.push(skills[i]);
    }
    emit SetComparableSkills(skills);
  }

  function setKValues(uint8 kA, uint8 kD) public onlyOwner {
    _kA = kA;
    _kD = kD;
    emit SetKValues(kA, kD);
  }

  function setMMRAttackDistance(uint16 mmrAttackDistance) public onlyOwner {
    _mmrAttackDistance = mmrAttackDistance;
    emit SetMMRAttackDistance(mmrAttackDistance);
  }

  function setMaxLockedVaults(uint8 maxLockedVaults) public onlyOwner {
    _maxLockedVaults = maxLockedVaults;
    emit SetMaxLockedVaults(maxLockedVaults);
  }

  function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) public onlyOwner {
    _expectedGasLimitFulfill = expectedGasLimitFulfill;
    emit SetExpectedGasLimitFulfill(expectedGasLimitFulfill);
  }

  function setBrushDistributionPercentages(
    uint8 brushBurntPercentage,
    uint8 brushTreasuryPercentage,
    uint8 brushDevPercentage
  ) external onlyOwner {
    require(brushBurntPercentage + brushTreasuryPercentage + brushDevPercentage == 100, PercentNotTotal100());

    _brushBurntPercentage = brushBurntPercentage;
    _brushTreasuryPercentage = brushTreasuryPercentage;
    _brushDevPercentage = brushDevPercentage;
    emit SetBrushDistributionPercentages(brushBurntPercentage, brushTreasuryPercentage, brushDevPercentage);
  }

  function setMaxClanCombatants(uint8 maxClanCombatants) public onlyOwner {
    _maxClanCombatants = maxClanCombatants;
    emit SetMaxClanCombatants(maxClanCombatants);
  }

  // TODO: Can delete if necessary
  function setPreventAttacks(bool preventAttacks) external onlyOwner {
    _preventAttacks = preventAttacks;
    emit SetPreventAttacks(preventAttacks);
  }

  // TODO Can delete after setting initial MMR
  function initializeMMR(uint256[] calldata clanIds, uint16[] calldata mmrs, bool clear) external onlyOwner {
    // First clean up any in it
    if (clear) {
      delete _sortedClansByMMR;
    }
    LockedBankVaultsLibrary.initializeMMR(_sortedClansByMMR, _clans, _clanInfos, clanIds, mmrs);
    emit SetMMRs(clanIds, mmrs);
  }

  function initializeAddresses(
    ITerritories territories,
    address combatantsHelper,
    IBankFactory bankFactory
  ) external onlyOwner {
    _territories = territories;
    _combatantsHelper = combatantsHelper;
    _bankFactory = bankFactory;
  }

  function clearCooldowns(uint256 clanId, uint256[] calldata otherClanIds) external isAdminAndBeta {
    LockedBankVaultsLibrary.clearCooldowns(clanId, otherClanIds, _clanInfos[clanId], _lastClanBattles);
  }

  // Useful to re-run a battle for testing
  function setAttackInProgress(uint256 requestId) external isAdminAndBeta {
    _pendingAttacks[_requestToPendingAttackIds[bytes32(requestId)]].attackInProgress = true;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
