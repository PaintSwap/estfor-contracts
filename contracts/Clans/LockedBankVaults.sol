// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {RrpRequesterV0Upgradeable} from "../legacy/RrpRequesterV0Upgradeable.sol";

import {IClans} from "../interfaces/IClans.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {IBank} from "../interfaces/IBank.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {ILockedBankVaults} from "../interfaces/ILockedBankVaults.sol";
import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";
import {ISamWitchVRF} from "../interfaces/ISamWitchVRF.sol";

import {AdminAccess} from "../AdminAccess.sol";
import {ItemNFT} from "../ItemNFT.sol";

import {BattleResultEnum, ClanRank, MAX_CLAN_COMBATANTS, CLAN_WARS_GAS_PRICE_WINDOW_SIZE, VaultClanInfo, Vault, ClanBattleInfo} from "../globals/clans.sol";
import {Item, EquipPosition} from "../globals/players.sol";
import {BoostType, Skill} from "../globals/misc.sol";
import {NONE} from "../globals/items.sol";

import {ClanBattleLibrary} from "./ClanBattleLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";
import {LockedBankVaultsLibrary} from "./LockedBankVaultsLibrary.sol";

contract LockedBankVaults is
  RrpRequesterV0Upgradeable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  ILockedBankVaults,
  IClanMemberLeftCB
{
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
    uint48[] attackingPlayerIds,
    uint48[] defendingPlayerIds,
    uint256[] attackingRolls,
    uint256[] defendingRolls,
    BattleResultEnum[] battleResults,
    Skill[] randomSkills,
    bool didAttackersWin,
    uint256 attackingClanId,
    uint256 defendingClanId,
    uint256[] randomWords,
    uint256 percentageToTake,
    uint256 brushBurnt
  );

  event AssignCombatants(
    uint256 clanId,
    uint48[] playerIds,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );
  event RemoveCombatant(uint256 playerId, uint256 clanId);
  event ClaimFunds(uint256 clanId, address from, uint256 playerId, uint256 amount, uint256 numLocksClaimed);
  event LockFunds(uint256 clanId, address from, uint256 playerId, uint256 amount, uint256 lockingTimestamp);
  event UpdateMovingAverageGasPrice(uint256 movingAverage);
  event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
  event SetBaseAttackCost(uint256 baseAttackCost);
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
  event UpdateMMR(uint256 requestId, int attackingMMRDiff, int defendingMMRDiff);
  event SetMMRs(uint256[] clanIds, uint16[] mmrs);
  event SetKValues(uint256 Ka, uint256 Kd);

  error PlayerOnTerritory();
  error TooManyCombatants();
  error NotOwnerOfPlayerAndActive();
  error NotLeader();
  error InvalidSkill(Skill skill);
  error NotMemberOfClan();
  error LengthMismatch();
  error OnlyClans();
  error OnlyTerritories();
  error OnlyCombatantsHelper();
  error TransferFailed();
  error CannotChangeCombatantsDuringAttack();
  error NotAdminAndBeta();
  error NotEnoughFTM();
  error RequestIdNotKnown();
  error CallerNotSamWitchVRF();
  error AttacksPrevented();

  struct PendingAttack {
    uint40 clanId;
    uint40 defendingClanId;
    bool attackInProgress;
    uint8 extraRollsAttacker;
    uint8 extraRollsDefender;
  }

  Skill[] private comparableSkills;
  uint64 private nextPendingAttackId;
  bool private preventAttacks;
  mapping(uint256 clanId => VaultClanInfo clanInfo) private clanInfos;
  mapping(uint256 pendingAttackId => PendingAttack pendingAttack) private pendingAttacks;
  mapping(bytes32 requestId => uint256 pendingAttackId) private requestToPendingAttackIds;
  mapping(uint256 clanId => mapping(uint256 otherClanId => ClanBattleInfo battleInfo)) public lastClanBattles; // Always ordered from lowest clanId to highest
  IClans private clans;
  IPlayers private players;
  IBrushToken private brush;
  ITerritories private territories;
  ItemNFT private itemNFT;
  AdminAccess private adminAccess;
  bool private isBeta;
  IBankFactory private bankFactory;
  address private combatantsHelper;
  uint24 private combatantChangeCooldown;
  address private pool;
  address private dev;

  // These 4 are no longer used
  address private airnode; // The address of the QRNG Airnode
  address private sponsorWallet; // The wallet that will cover the gas costs of the request
  bytes32 private endpointIdUint256; // The endpoint ID for requesting a single random number
  bytes32 private endpointIdUint256Array; // The endpoint ID for requesting an array of random numbers

  uint8 private indexGasPrice;
  uint64 private movingAverageGasPrice;
  uint88 private baseAttackCost; // To offset gas costs in response
  uint24 private expectedGasLimitFulfill;
  uint64[CLAN_WARS_GAS_PRICE_WINDOW_SIZE] private prices;

  address private oracle;
  uint16 private mmrAttackDistance;
  uint8 private Ka; // attacker K-factor
  uint8 private Kd; // defender K-factor
  uint24 private attackingCooldown;
  uint24 private reattackingCooldown;

  ISamWitchVRF private samWitchVRF;
  uint24 private lockFundsPeriod;
  // Clans are sorted as follows:
  // 1 - From lower MMR to higher MMR
  // 2 - If there are multiple clans with the same MMR, they are sorted by:
  //   2.1 - Whoever was there first gets a higher rank (higher index)
  //   2.2 - The attacker is always ranked higher than the defender whether they win or lose as they are placed in the array first
  uint48[] private sortedClansByMMR; // Packed uint32 clanId | uint16 MMR

  uint256 private constant NUM_WORDS = 3;
  uint256 private constant CALLBACK_GAS_LIMIT = 3_500_000;
  uint256 private constant MAX_LOCKED_VAULTS = 100;
  uint256 private constant NUM_PACKED_VAULTS = 2;

  modifier isOwnerOfPlayerAndActive(uint256 _playerId) {
    if (!players.isOwnerOfPlayerAndActive(_msgSender(), _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isAtLeastLeaderOfClan(uint256 _clanId, uint256 _playerId) {
    if (clans.getRank(_clanId, _playerId) < ClanRank.LEADER) {
      revert NotLeader();
    }
    _;
  }

  modifier isClanMember(uint256 _clanId, uint256 _playerId) {
    if (clans.getRank(_clanId, _playerId) == ClanRank.NONE) {
      revert NotMemberOfClan();
    }
    _;
  }

  modifier onlyClans() {
    if (_msgSender() != address(clans)) {
      revert OnlyClans();
    }
    _;
  }

  modifier onlyTerritories() {
    if (_msgSender() != address(territories)) {
      revert OnlyTerritories();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(adminAccess.isAdmin(_msgSender()) && isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  modifier onlyCombatantsHelper() {
    if (_msgSender() != combatantsHelper) {
      revert OnlyCombatantsHelper();
    }
    _;
  }

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    if (_msgSender() != address(samWitchVRF)) {
      revert CallerNotSamWitchVRF();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPlayers _players,
    IClans _clans,
    IBrushToken _brush,
    IBankFactory _bankFactory,
    ItemNFT _itemNFT,
    address _pool,
    address _dev,
    address _oracle,
    ISamWitchVRF _samWitchVRF,
    Skill[] calldata _comparableSkills,
    uint16 _mmrAttackDistance,
    uint24 _lockFundsPeriod,
    AdminAccess _adminAccess,
    bool _isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    players = _players;
    clans = _clans;
    brush = _brush;
    bankFactory = _bankFactory;
    itemNFT = _itemNFT;
    pool = _pool;
    dev = _dev;
    oracle = _oracle;
    samWitchVRF = _samWitchVRF;
    lockFundsPeriod = _lockFundsPeriod;
    adminAccess = _adminAccess;
    isBeta = _isBeta;
    attackingCooldown = _isBeta ? 1 minutes + 30 seconds : 4 hours;
    reattackingCooldown = _isBeta ? 6 minutes : 1 days;
    combatantChangeCooldown = _isBeta ? 5 minutes : 3 days;

    for (uint256 i; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      prices[i] = uint64(tx.gasprice);
    }
    _updateMovingAverageGasPrice(uint64(tx.gasprice));
    setBaseAttackCost(0.01 ether);
    _setExpectedGasLimitFulfill(1_500_000);

    setKValues(32, 32);
    setComparableSkills(_comparableSkills);
    setMMRAttackDistance(_mmrAttackDistance);
    nextPendingAttackId = 1;
  }

  function assignCombatants(
    uint256 _clanId,
    uint48[] calldata _playerIds,
    uint256 _combatantCooldownTimestamp,
    uint256 _leaderPlayerId
  ) external override onlyCombatantsHelper {
    VaultClanInfo storage clanInfo = clanInfos[_clanId];
    LockedBankVaultsLibrary.checkCanAssignCombatants(clanInfo, _playerIds);
    clanInfo.playerIds = _playerIds;
    clanInfo.assignCombatantsCooldownTimestamp = uint40(block.timestamp + combatantChangeCooldown);
    emit AssignCombatants(_clanId, _playerIds, _msgSender(), _leaderPlayerId, _combatantCooldownTimestamp);
  }

  // Some vaults may no longer be attackable if they don't have any funds, so force the MMR arrays to be re-calculated.
  function forceMMRUpdate(uint256[] calldata _clanIds) external {
    uint256[] memory clanIdsToDelete = LockedBankVaultsLibrary.forceMMRUpdate(
      sortedClansByMMR,
      clans,
      clanInfos,
      _clanIds
    );
    if (clanIdsToDelete.length != 0) {
      emit ForceMMRUpdate(clanIdsToDelete);
    }
  }

  function getIdleClans() external view returns (uint256[] memory clanIds) {
    return LockedBankVaultsLibrary.getIdleClans(sortedClansByMMR, clanInfos, clans);
  }

  // This needs to call the oracle VRF on-demand and calls the callback
  function attackVaults(
    uint256 _clanId,
    uint256 _defendingClanId,
    uint16 _itemTokenId,
    uint256 _leaderPlayerId
  ) external payable isOwnerOfPlayerAndActive(_leaderPlayerId) isAtLeastLeaderOfClan(_clanId, _leaderPlayerId) {
    if (preventAttacks) {
      revert AttacksPrevented();
    }

    // Check they are paying enough
    if (msg.value < getAttackCost()) {
      revert NotEnoughFTM();
    }

    (bool success, ) = oracle.call{value: msg.value}("");
    if (!success) {
      revert TransferFailed();
    }

    (bool isReattacking, bool isUsingSuperAttack, uint256 superAttackCooldownTimestamp) = LockedBankVaultsLibrary
      .checkCanAttackVaults(
        _clanId,
        _defendingClanId,
        _itemTokenId,
        MAX_LOCKED_VAULTS,
        NUM_PACKED_VAULTS,
        itemNFT,
        clanInfos,
        lastClanBattles
      );
    if ((isReattacking || isUsingSuperAttack) && _itemTokenId != NONE) {
      itemNFT.burn(_msgSender(), _itemTokenId, 1);
    }

    // Check MMRs are within the list, X ranks above and below. However at the extremes add it to the other end
    LockedBankVaultsLibrary.checkWithinRange(sortedClansByMMR, _clanId, _defendingClanId, clans, mmrAttackDistance);

    VaultClanInfo storage clanInfo = clanInfos[_clanId];
    clanInfo.currentlyAttacking = true;

    uint64 _nextPendingAttackId = nextPendingAttackId++;

    uint40 attackingCooldownTimestamp = uint40(block.timestamp + attackingCooldown);
    clanInfo.attackingCooldownTimestamp = attackingCooldownTimestamp;
    if (isUsingSuperAttack) {
      clanInfo.superAttackCooldownTimestamp = uint40(superAttackCooldownTimestamp);
    }

    // Don't change the attacking timestamp if re-attacking
    uint40 reattackingCooldownTimestamp = uint40(block.timestamp + reattackingCooldown);
    uint256 lowerClanId = _clanId < _defendingClanId ? _clanId : _defendingClanId;
    uint256 higherClanId = _clanId < _defendingClanId ? _defendingClanId : _clanId;
    ClanBattleInfo storage battleInfo = lastClanBattles[lowerClanId][higherClanId];
    if (lowerClanId == _clanId) {
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

    pendingAttacks[_nextPendingAttackId] = PendingAttack({
      clanId: uint40(_clanId),
      defendingClanId: uint40(_defendingClanId),
      attackInProgress: true,
      extraRollsAttacker: isUsingSuperAttack ? 1 : 0,
      extraRollsDefender: 0
    });
    bytes32 requestId = _requestRandomWords();
    requestToPendingAttackIds[requestId] = _nextPendingAttackId;

    emit AttackVaults(
      _clanId,
      _defendingClanId,
      _msgSender(),
      _leaderPlayerId,
      uint256(requestId),
      _nextPendingAttackId,
      attackingCooldownTimestamp,
      reattackingCooldownTimestamp,
      _itemTokenId
    );

    if (isUsingSuperAttack) {
      emit SuperAttackCooldown(_clanId, superAttackCooldownTimestamp);
    }
  }

  /// @notice Called by the SamWitchVRF oracle contract to fulfill the request
  function fulfillRandomWords(bytes32 _requestId, uint256[] calldata _randomWords) external onlySamWitchVRF {
    if (_randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    PendingAttack storage pendingAttack = pendingAttacks[requestToPendingAttackIds[_requestId]];
    if (!pendingAttack.attackInProgress) {
      revert RequestIdNotKnown();
    }

    uint40 attackingClanId = pendingAttack.clanId;
    uint48[] memory attackingPlayerIds = clanInfos[attackingClanId].playerIds;

    uint256 defendingClanId = pendingAttack.defendingClanId;
    uint48[] memory defendingPlayerIds = clanInfos[defendingClanId].playerIds;

    Skill[] memory randomSkills = new Skill[](Math.max(attackingPlayerIds.length, defendingPlayerIds.length));
    for (uint256 i; i < randomSkills.length; ++i) {
      randomSkills[i] = comparableSkills[uint8(_randomWords[2] >> (i * 8)) % comparableSkills.length];
    }

    (
      BattleResultEnum[] memory battleResults,
      uint256[] memory attackingRolls,
      uint256[] memory defendingRolls,
      bool didAttackersWin
    ) = ClanBattleLibrary.doBattle(
        address(players),
        attackingPlayerIds,
        defendingPlayerIds,
        randomSkills,
        [_randomWords[0], _randomWords[1]],
        pendingAttack.extraRollsAttacker,
        pendingAttack.extraRollsDefender
      );

    pendingAttack.attackInProgress = false;
    clanInfos[attackingClanId].currentlyAttacking = false;

    uint256 losingClanId = didAttackersWin ? defendingClanId : attackingClanId;
    uint256 percentageToTake = didAttackersWin ? 10 : 5;

    // Go through all the defendingVaults of who ever lost and take a percentage from them
    uint256 totalWon;
    uint256 vaultOffset = clanInfos[losingClanId].defendingVaultsOffset;
    uint256 length = clanInfos[losingClanId].defendingVaults.length;
    for (uint256 i = vaultOffset; i < length; ++i) {
      Vault storage losersVault = clanInfos[losingClanId].defendingVaults[i];
      totalWon += _stealFromVault(losersVault, losingClanId, percentageToTake);
    }

    _updateAverageGasPrice();

    (int256 attackingMMRDiff, int256 defendingMMRDiff) = LockedBankVaultsLibrary.fulfillUpdateMMR(
      Ka,
      Kd,
      sortedClansByMMR,
      clans,
      attackingClanId,
      defendingClanId,
      didAttackersWin,
      clanInfos
    );

    uint256 brushBurnt;
    if (!didAttackersWin && totalWon != 0) {
      // Lost so take a percentage from the loser's vaults
      uint256 amountToTreasure = totalWon / 2;
      uint256 amountToDao = totalWon / 4;
      brushBurnt = totalWon - (amountToTreasure + amountToDao);

      // Send to the treasure
      brush.transfer(pool, amountToTreasure);
      brush.transfer(dev, amountToDao);
      brush.burn(brushBurnt);
    }

    emit BattleResult(
      uint256(_requestId),
      attackingPlayerIds,
      defendingPlayerIds,
      attackingRolls,
      defendingRolls,
      battleResults,
      randomSkills,
      didAttackersWin,
      attackingClanId,
      defendingClanId,
      _randomWords,
      percentageToTake,
      brushBurnt
    );

    emit UpdateMMR(uint256(_requestId), attackingMMRDiff, defendingMMRDiff);

    if (didAttackersWin) {
      _lockFunds(attackingClanId, address(0), 0, totalWon);
    }
  }

  function claimFunds(uint256 _clanId, uint256 _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    (uint256 total, uint256 numLocksClaimed) = LockedBankVaultsLibrary.claimFunds(
      sortedClansByMMR,
      clanInfos[_clanId],
      _clanId
    );
    emit ClaimFunds(_clanId, _msgSender(), _playerId, total, numLocksClaimed);
    address bankAddress = _getBankAddress(_clanId);
    IBank(bankAddress).depositToken(_msgSender(), _playerId, address(brush), total);
  }

  function blockAttacks(
    uint256 _clanId,
    uint16 _itemTokenId,
    uint256 _playerId
  ) external isOwnerOfPlayerAndActive(_playerId) isClanMember(_clanId, _playerId) {
    uint256 blockAttacksTimestamp = LockedBankVaultsLibrary.blockAttacks(itemNFT, _itemTokenId, clanInfos[_clanId]);
    // TODO: Add blockAttacksCooldownHours to a BlockingAttacks
    emit BlockingAttacks(_clanId, _itemTokenId, _msgSender(), _playerId, blockAttacksTimestamp, block.timestamp);
  }

  function lockFunds(uint256 _clanId, address _from, uint256 _playerId, uint256 _amount) external onlyTerritories {
    _lockFunds(_clanId, _from, _playerId, _amount);
    VaultClanInfo storage clanInfo = clanInfos[_clanId];
    if (!clanInfo.isInMMRArray) {
      LockedBankVaultsLibrary.insertMMRArray(sortedClansByMMR, clans.getMMR(_clanId), uint32(_clanId));
      clanInfo.isInMMRArray = true;
    }
    if (_amount != 0 && !brush.transferFrom(_msgSender(), address(this), _amount)) {
      revert TransferFailed();
    }
  }

  function clanMemberLeft(uint256 _clanId, uint256 _playerId) external override onlyClans {
    // Remove a player combatant if they are currently assigned in this clan
    VaultClanInfo storage clanInfo = clanInfos[_clanId];
    if (clanInfo.playerIds.length != 0) {
      uint256 searchIndex = EstforLibrary.binarySearch(clanInfo.playerIds, _playerId);
      if (searchIndex != type(uint256).max) {
        // Shift the whole array to delete the element
        for (uint256 i = searchIndex; i < clanInfo.playerIds.length - 1; ++i) {
          clanInfo.playerIds[i] = clanInfo.playerIds[i + 1];
        }
        clanInfo.playerIds.pop();
        emit RemoveCombatant(_playerId, _clanId);
      }
    }
  }

  function _stealFromVault(
    Vault storage _losersVault,
    uint256 _clanId,
    uint256 _percentageToTake
  ) private returns (uint256 amountWon) {
    if (_losersVault.timestamp > block.timestamp) {
      uint256 amount = _losersVault.amount;
      uint256 stealAmount = (amount * _percentageToTake) / 100;
      _losersVault.amount = uint80(amount - stealAmount);
      clanInfos[_clanId].totalBrushLocked -= uint96(stealAmount);
      amountWon += stealAmount;
    }

    if (_losersVault.timestamp1 > block.timestamp) {
      uint256 amount1 = _losersVault.amount1;
      uint256 stealAmount1 = (amount1 * _percentageToTake) / 100;
      _losersVault.amount1 = uint80(amount1 - stealAmount1);
      clanInfos[_clanId].totalBrushLocked -= uint96(stealAmount1);
      amountWon += stealAmount1;
    }
  }

  function _getBankAddress(uint256 _clanId) private returns (address bankAddress) {
    bankAddress = address(clanInfos[_clanId].bank);
    if (bankAddress == address(0)) {
      bankAddress = bankFactory.bankAddress(_clanId);
      brush.approve(bankAddress, type(uint256).max);
      clanInfos[_clanId].bank = IBank(bankAddress);
    }
  }

  function _updateAverageGasPrice() private {
    uint256 sum = 0;
    prices[indexGasPrice] = uint64(tx.gasprice);
    indexGasPrice = uint8((indexGasPrice + 1) % CLAN_WARS_GAS_PRICE_WINDOW_SIZE);

    for (uint256 i = 0; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      sum += prices[i];
    }

    _updateMovingAverageGasPrice(uint64(sum / CLAN_WARS_GAS_PRICE_WINDOW_SIZE));
  }

  function _updateMovingAverageGasPrice(uint64 _movingAverageGasPrice) private {
    movingAverageGasPrice = _movingAverageGasPrice;
    emit UpdateMovingAverageGasPrice(_movingAverageGasPrice);
  }

  function _lockFunds(uint256 _clanId, address _from, uint256 _playerId, uint256 _amount) private {
    if (_amount == 0) {
      return;
    }
    VaultClanInfo storage clanInfo = clanInfos[_clanId];
    uint256 totalBrushLocked = clanInfo.totalBrushLocked;
    clanInfo.totalBrushLocked = uint96(totalBrushLocked + _amount);
    uint40 lockingTimestamp = uint40(block.timestamp + lockFundsPeriod);
    uint256 length = clanInfo.defendingVaults.length;
    if (length == 0 || (clanInfo.defendingVaults[length - 1].timestamp1 != 0)) {
      // Start a new one
      clanInfo.defendingVaults.push(
        Vault({claimed: false, timestamp: lockingTimestamp, amount: uint80(_amount), timestamp1: 0, amount1: 0})
      );
    } else {
      // Update existing storage slot
      clanInfo.defendingVaults[length - 1].timestamp1 = lockingTimestamp;
      clanInfo.defendingVaults[length - 1].amount1 = uint80(_amount);
    }

    emit LockFunds(_clanId, _from, _playerId, _amount, lockingTimestamp);
  }

  function _requestRandomWords() private returns (bytes32 requestId) {
    requestId = samWitchVRF.requestRandomWords(NUM_WORDS, CALLBACK_GAS_LIMIT);
  }

  function _setExpectedGasLimitFulfill(uint24 _expectedGasLimitFulfill) private {
    expectedGasLimitFulfill = _expectedGasLimitFulfill;
    emit SetExpectedGasLimitFulfill(_expectedGasLimitFulfill);
  }

  function getAttackCost() public view returns (uint256) {
    return baseAttackCost + (movingAverageGasPrice * expectedGasLimitFulfill);
  }

  function getClanInfo(uint256 _clanId) external view returns (VaultClanInfo memory) {
    return clanInfos[_clanId];
  }

  function isCombatant(uint256 _clanId, uint256 _playerId) external view override returns (bool) {
    uint48[] storage playerIds = clanInfos[_clanId].playerIds;
    if (playerIds.length == 0) {
      return false;
    }

    uint256 searchIndex = EstforLibrary.binarySearch(playerIds, _playerId);
    return searchIndex != type(uint256).max;
  }

  function getSortedClanIdsByMMR() external view returns (uint32[] memory) {
    return LockedBankVaultsLibrary.getSortedClanIdsByMMR(sortedClansByMMR);
  }

  function getSortedMMR() external view returns (uint16[] memory) {
    return LockedBankVaultsLibrary.getSortedMMR(sortedClansByMMR);
  }

  function setComparableSkills(Skill[] calldata _skills) public onlyOwner {
    for (uint256 i = 0; i < _skills.length; ++i) {
      if (_skills[i] == Skill.NONE || _skills[i] == Skill.COMBAT) {
        revert InvalidSkill(_skills[i]);
      }

      comparableSkills.push(_skills[i]);
    }
    emit SetComparableSkills(_skills);
  }

  function setKValues(uint8 _Ka, uint8 _Kd) public onlyOwner {
    Ka = _Ka;
    Kd = _Kd;
    emit SetKValues(_Ka, _Kd);
  }

  function setAddresses(ITerritories _territories, address _combatantsHelper) external onlyOwner {
    territories = _territories;
    combatantsHelper = _combatantsHelper;
  }

  function setMMRAttackDistance(uint16 _mmrAttackDistance) public onlyOwner {
    mmrAttackDistance = _mmrAttackDistance;
    emit SetMMRAttackDistance(_mmrAttackDistance);
  }

  function setBaseAttackCost(uint88 _baseAttackCost) public onlyOwner {
    baseAttackCost = _baseAttackCost;
    emit SetBaseAttackCost(_baseAttackCost);
  }

  function setExpectedGasLimitFulfill(uint24 _expectedGasLimitFulfill) public onlyOwner {
    _setExpectedGasLimitFulfill(_expectedGasLimitFulfill);
  }

  // TODO: Can delete if necessary
  function setPreventAttacks(bool _preventAttacks) external onlyOwner {
    preventAttacks = _preventAttacks;
  }

  // TODO Can delete after setting initial MMR
  function initializeMMR(uint256[] calldata _clanIds, uint16[] calldata _mmrs, bool _clear) external onlyOwner {
    // First clean up any in it
    if (_clear) {
      delete sortedClansByMMR;
    }
    LockedBankVaultsLibrary.initializeMMR(sortedClansByMMR, clans, clanInfos, _clanIds, _mmrs);
    emit SetMMRs(_clanIds, _mmrs);
  }

  function clearCooldowns(uint256 _clanId, uint256[] calldata _otherClanIds) external isAdminAndBeta {
    LockedBankVaultsLibrary.clearCooldowns(_clanId, _otherClanIds, clanInfos[_clanId], lastClanBattles);
  }

  // Useful to re-run a battle for testing
  function setAttackInProgress(uint256 _requestId) external isAdminAndBeta {
    pendingAttacks[requestToPendingAttackIds[bytes32(_requestId)]].attackInProgress = true;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
