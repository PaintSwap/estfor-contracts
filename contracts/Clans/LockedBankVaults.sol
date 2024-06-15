// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {RrpRequesterV0Upgradeable} from "../RrpRequesterV0Upgradeable.sol";

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

import {BattleResultEnum, ClanRank, MAX_CLAN_COMBATANTS, CLAN_WARS_GAS_PRICE_WINDOW_SIZE, ClanInfo, Vault, ClanBattleInfo} from "../globals/clans.sol";
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
    uint clanId,
    uint defendingClanId,
    address from,
    uint leaderPlayerId,
    uint requestId,
    uint pendingAttackId,
    uint attackingCooldownTimestamp,
    uint reattackingCooldownTimestamp,
    uint itemTokenId
  );
  event SetComparableSkills(Skill[] skills);
  event BattleResult(
    uint requestId,
    uint48[] attackingPlayerIds,
    uint48[] defendingPlayerIds,
    uint[] attackingRolls,
    uint[] defendingRolls,
    BattleResultEnum[] battleResults,
    Skill[] randomSkills,
    bool didAttackersWin,
    uint attackingClanId,
    uint defendingClanId,
    uint[] randomWords,
    uint percentageToTake,
    uint brushBurnt
  );

  event AssignCombatants(uint clanId, uint48[] playerIds, address from, uint leaderPlayerId, uint cooldownTimestamp);
  event RemoveCombatant(uint playerId, uint clanId);
  event ClaimFunds(uint clanId, address from, uint playerId, uint amount, uint numLocksClaimed);
  event LockFunds(uint clanId, address from, uint playerId, uint amount, uint lockingTimestamp);
  event UpdateMovingAverageGasPrice(uint movingAverage);
  event SetExpectedGasLimitFulfill(uint expectedGasLimitFulfill);
  event SetBaseAttackCost(uint baseAttackCost);
  event BlockingAttacks(
    uint clanId,
    uint itemTokenId,
    address from,
    uint leaderPlayerId,
    uint blockAttacksTimestamp,
    uint blockAttacksCooldownTimestamp
  );
  event SuperAttackCooldown(uint clanId, uint cooldownTimestamp);
  event SetMMRAttackDistance(uint256 mmrAttackDistance);
  event ForceMMRUpdate(uint256[] clanIdsToDelete);
  event UpdateMMR(uint requestId, int attackingMMRDiff, int defendingMMRDiff);
  event SetMMRs(uint256[] clanId, uint16[] mmr);

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
  error ClanCombatantsChangeCooldown();
  error CannotChangeCombatantsDuringAttack();
  error NotAdminAndBeta();
  error NotEnoughFTM();
  error RequestIdNotKnown();
  error CallerNotSamWitchVRF();

  struct PendingAttack {
    uint40 clanId;
    uint40 defendingClanId;
    bool attackInProgress;
    uint8 extraRollsAttacker;
    uint8 extraRollsDefender;
  }

  Skill[] private comparableSkills;
  uint64 private nextPendingAttackId;
  mapping(uint clanId => ClanInfo clanInfo) private clanInfos;
  mapping(uint pendingAttackId => PendingAttack pendingAttack) private pendingAttacks;
  mapping(bytes32 requestId => uint pendingAttackId) private requestToPendingAttackIds;
  mapping(uint clanId => mapping(uint otherClanId => ClanBattleInfo battleInfo)) public lastClanBattles; // Always ordered from lowest clanId to highest
  IClans private clans;
  IPlayers private players;
  IBrushToken private brush;
  ITerritories private territories;
  ItemNFT private itemNFT;
  AdminAccess private adminAccess;
  bool private isBeta;
  IBankFactory private bankFactory;
  address private combatantsHelper;
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
  ISamWitchVRF private samWitchVRF;
  uint48[] private sortedClansByMMR; // Packed uint32 clanId | uint16 MMR

  uint private constant NUM_WORDS = 3;
  uint private constant CALLBACK_GAS_LIMIT = 3_000_000;
  uint private constant ATTACKING_COOLDOWN = 4 hours;
  uint private constant MIN_REATTACKING_COOLDOWN = 1 days;
  uint private constant MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN = 3 days;
  uint private constant MAX_LOCKED_VAULTS = 100;
  uint private constant LOCK_PERIOD = 7 days;
  uint private constant NUM_PACKED_VAULTS = 2;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isAtLeastLeaderOfClan(uint _clanId, uint _playerId) {
    if (clans.getRank(_clanId, _playerId) < ClanRank.LEADER) {
      revert NotLeader();
    }
    _;
  }

  modifier isClanMember(uint _clanId, uint _playerId) {
    if (clans.getRank(_clanId, _playerId) == ClanRank.NONE) {
      revert NotMemberOfClan();
    }
    _;
  }

  modifier onlyClans() {
    if (msg.sender != address(clans)) {
      revert OnlyClans();
    }
    _;
  }

  modifier onlyTerritories() {
    if (msg.sender != address(territories)) {
      revert OnlyTerritories();
    }
    _;
  }

  modifier isAdminAndBeta() {
    if (!(adminAccess.isAdmin(msg.sender) && isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  modifier onlyCombatantsHelper() {
    if (msg.sender != combatantsHelper) {
      revert OnlyCombatantsHelper();
    }
    _;
  }

  /// @dev Reverts if the caller is not the SamWitchVRF contract.
  modifier onlySamWitchVRF() {
    if (msg.sender != address(samWitchVRF)) {
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

    adminAccess = _adminAccess;
    isBeta = _isBeta;

    for (uint i; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      prices[i] = uint64(tx.gasprice);
    }
    _updateMovingAverageGasPrice(uint64(tx.gasprice));
    setBaseAttackCost(0.01 ether);
    _setExpectedGasLimitFulfill(1_500_000);

    setComparableSkills(_comparableSkills);
    setMMRAttackDistance(_mmrAttackDistance);
    nextPendingAttackId = 1;
  }

  function assignCombatants(
    uint _clanId,
    uint48[] calldata _playerIds,
    uint _combatantCooldownTimestamp,
    uint _leaderPlayerId
  ) external override onlyCombatantsHelper {
    ClanInfo storage clanInfo = clanInfos[_clanId];
    LockedBankVaultsLibrary.checkCanAssignCombatants(clanInfo, _playerIds);
    clanInfo.playerIds = _playerIds;
    clanInfo.assignCombatantsCooldownTimestamp = uint40(block.timestamp + MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN);
    emit AssignCombatants(_clanId, _playerIds, msg.sender, _leaderPlayerId, _combatantCooldownTimestamp);
  }

  // Some vaults may no longer be attackable if they don't have any funds, so force the MMR to be re-calculated.
  function forceMMRUpdate(uint[] calldata _clanIds) external {
    uint[] memory clanIdsToDelete = LockedBankVaultsLibrary.forceMMRUpdate(
      sortedClansByMMR,
      clans,
      clanInfos,
      _clanIds
    );
    if (clanIdsToDelete.length != 0) {
      emit ForceMMRUpdate(clanIdsToDelete);
    }
  }

  // This needs to call the oracle VRF on-demand and calls the callback
  function attackVaults(
    uint _clanId,
    uint _defendingClanId,
    uint16 _itemTokenId,
    uint _leaderPlayerId
  ) external payable isOwnerOfPlayerAndActive(_leaderPlayerId) isAtLeastLeaderOfClan(_clanId, _leaderPlayerId) {
    // Check they are paying enough
    if (msg.value < attackCost()) {
      revert NotEnoughFTM();
    }

    (bool success, ) = oracle.call{value: msg.value}("");
    if (!success) {
      revert TransferFailed();
    }

    (bool isReattacking, bool isUsingSuperAttack, uint superAttackCooldownTimestamp) = LockedBankVaultsLibrary
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
      itemNFT.burn(msg.sender, _itemTokenId, 1);
    }

    // Check MMRs are within the list, 4 above and 4 below. However at the extremes add it to the other end
    LockedBankVaultsLibrary.updateMMRArray(
      sortedClansByMMR,
      _clanId,
      _defendingClanId,
      clans,
      mmrAttackDistance,
      clanInfos
    );

    ClanInfo storage clanInfo = clanInfos[_clanId];
    clanInfo.currentlyAttacking = true;

    uint64 _nextPendingAttackId = nextPendingAttackId++;

    uint40 attackingCooldownTimestamp = uint40(block.timestamp + ATTACKING_COOLDOWN);
    clanInfo.attackingCooldownTimestamp = attackingCooldownTimestamp;
    clanInfo.gasPaid = uint88(msg.value);
    if (isUsingSuperAttack) {
      clanInfo.superAttackCooldownTimestamp = uint40(superAttackCooldownTimestamp);
    }

    // Don't change the attacking timestamp if re-attacking
    uint40 reattackingCooldownTimestamp = uint40(block.timestamp + MIN_REATTACKING_COOLDOWN);
    uint lowerClanId = _clanId < _defendingClanId ? _clanId : _defendingClanId;
    uint higherClanId = _clanId < _defendingClanId ? _defendingClanId : _clanId;
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
      msg.sender,
      _leaderPlayerId,
      uint(requestId),
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
  function fulfillRandomWords(bytes32 _requestId, uint[] calldata _randomWords) external onlySamWitchVRF {
    if (_randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    PendingAttack storage pendingAttack = pendingAttacks[requestToPendingAttackIds[_requestId]];
    if (!pendingAttack.attackInProgress) {
      revert RequestIdNotKnown();
    }

    uint40 attackingClanId = pendingAttack.clanId;
    uint48[] memory attackingPlayerIds = clanInfos[attackingClanId].playerIds;

    uint defendingClanId = pendingAttack.defendingClanId;
    uint48[] memory defendingPlayerIds = clanInfos[defendingClanId].playerIds;

    Skill[] memory randomSkills = new Skill[](Math.max(attackingPlayerIds.length, defendingPlayerIds.length));
    for (uint i; i < randomSkills.length; ++i) {
      randomSkills[i] = comparableSkills[uint8(_randomWords[2] >> (i * 8)) % comparableSkills.length];
    }

    (
      BattleResultEnum[] memory battleResults,
      uint[] memory attackingRolls,
      uint[] memory defendingRolls,
      bool didAttackersWin
    ) = ClanBattleLibrary.doBattle(
        address(players),
        attackingPlayerIds,
        defendingPlayerIds,
        randomSkills,
        _randomWords[0],
        _randomWords[1],
        pendingAttack.extraRollsAttacker,
        pendingAttack.extraRollsDefender
      );

    pendingAttack.attackInProgress = false;
    clanInfos[attackingClanId].currentlyAttacking = false;

    uint losingClanId = didAttackersWin ? defendingClanId : attackingClanId;
    uint percentageToTake = didAttackersWin ? 10 : 5;

    // Go through all the defendingVaults of who ever lost and take a percentage from them
    uint totalWon;
    uint vaultOffset = clanInfos[losingClanId].defendingVaultsOffset;
    uint length = clanInfos[losingClanId].defendingVaults.length;
    for (uint i = vaultOffset; i < length; ++i) {
      Vault storage losersVault = clanInfos[losingClanId].defendingVaults[i];
      totalWon += _stealFromVault(losersVault, losingClanId, percentageToTake);
    }

    _updateAverageGasPrice();

    (int256 attackingMMRDiff, int256 defendingMMRDiff) = LockedBankVaultsLibrary.fulfillUpdateMMR(
      sortedClansByMMR,
      clans,
      attackingClanId,
      defendingClanId,
      didAttackersWin,
      clanInfos
    );

    uint brushBurnt;
    if (!didAttackersWin && totalWon != 0) {
      // Lost so take a percentage from the loser's vaults
      uint amountToTreasure = totalWon / 2;
      uint amountToDao = totalWon / 4;
      brushBurnt = totalWon - (amountToTreasure + amountToDao);

      // Send to the treasure
      brush.transfer(pool, amountToTreasure);
      brush.transfer(dev, amountToDao);
      brush.burn(brushBurnt);
    }

    emit BattleResult(
      uint(_requestId),
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

    emit UpdateMMR(uint(_requestId), attackingMMRDiff, defendingMMRDiff);

    if (didAttackersWin) {
      _lockFunds(attackingClanId, address(0), 0, totalWon, LOCK_PERIOD);
    }
  }

  function claimFunds(uint _clanId, uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    (uint256 total, uint256 numLocksClaimed) = LockedBankVaultsLibrary.claimFunds(
      sortedClansByMMR,
      clanInfos[_clanId],
      _clanId
    );
    emit ClaimFunds(_clanId, msg.sender, _playerId, total, numLocksClaimed);
    address bankAddress = _getBankAddress(_clanId);
    IBank(bankAddress).depositToken(msg.sender, _playerId, address(brush), total);
  }

  function blockAttacks(
    uint _clanId,
    uint16 _itemTokenId,
    uint _playerId
  ) external isOwnerOfPlayerAndActive(_playerId) isClanMember(_clanId, _playerId) {
    uint256 blockAttacksTimestamp = LockedBankVaultsLibrary.blockAttacks(itemNFT, _itemTokenId, clanInfos[_clanId]);
    // TODO: Add blockAttacksCooldownHours to a BlockingAttacksV2
    emit BlockingAttacks(_clanId, _itemTokenId, msg.sender, _playerId, blockAttacksTimestamp, block.timestamp);
  }

  function lockFunds(uint _clanId, address _from, uint _playerId, uint _amount) external onlyTerritories {
    _lockFunds(_clanId, _from, _playerId, _amount, LOCK_PERIOD);
    ClanInfo storage clanInfo = clanInfos[_clanId];
    if (!clanInfo.isInMMRArray) {
      LockedBankVaultsLibrary.insertMMRArray(sortedClansByMMR, clans.getMMR(_clanId), uint32(_clanId));
      clanInfo.isInMMRArray = true;
    }
    if (_amount != 0 && !brush.transferFrom(msg.sender, address(this), _amount)) {
      revert TransferFailed();
    }
  }

  function clanMemberLeft(uint _clanId, uint _playerId) external override onlyClans {
    // Remove a player combatant if they are currently assigned in this clan
    ClanInfo storage clanInfo = clanInfos[_clanId];
    if (clanInfo.playerIds.length != 0) {
      uint searchIndex = EstforLibrary.binarySearch(clanInfo.playerIds, _playerId);
      if (searchIndex != type(uint).max) {
        // Shift the whole array to delete the element
        for (uint i = searchIndex; i < clanInfo.playerIds.length - 1; ++i) {
          clanInfo.playerIds[i] = clanInfo.playerIds[i + 1];
        }
        clanInfo.playerIds.pop();
        emit RemoveCombatant(_playerId, _clanId);
      }
    }
  }

  function _stealFromVault(
    Vault storage _losersVault,
    uint _clanId,
    uint _percentageToTake
  ) private returns (uint amountWon) {
    if (_losersVault.timestamp > block.timestamp) {
      uint amount = _losersVault.amount;
      uint stealAmount = (amount * _percentageToTake) / 100;
      _losersVault.amount = uint80(amount - stealAmount);
      clanInfos[_clanId].totalBrushLocked -= uint96(stealAmount);
      amountWon += stealAmount;
    }

    if (_losersVault.timestamp1 > block.timestamp) {
      uint amount1 = _losersVault.amount1;
      uint stealAmount1 = (amount1 * _percentageToTake) / 100;
      _losersVault.amount1 = uint80(amount1 - stealAmount1);
      clanInfos[_clanId].totalBrushLocked -= uint96(stealAmount1);
      amountWon += stealAmount1;
    }
  }

  function _getBankAddress(uint _clanId) private returns (address bankAddress) {
    bankAddress = address(clanInfos[_clanId].bank);
    if (bankAddress == address(0)) {
      bankAddress = bankFactory.bankAddress(_clanId);
      brush.approve(bankAddress, type(uint).max);
      clanInfos[_clanId].bank = IBank(bankAddress);
    }
  }

  function _updateAverageGasPrice() private {
    uint sum = 0;
    prices[indexGasPrice] = uint64(tx.gasprice);
    indexGasPrice = uint8((indexGasPrice + 1) % CLAN_WARS_GAS_PRICE_WINDOW_SIZE);

    for (uint i = 0; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      sum += prices[i];
    }

    _updateMovingAverageGasPrice(uint64(sum / CLAN_WARS_GAS_PRICE_WINDOW_SIZE));
  }

  function _updateMovingAverageGasPrice(uint64 _movingAverageGasPrice) private {
    movingAverageGasPrice = _movingAverageGasPrice;
    emit UpdateMovingAverageGasPrice(_movingAverageGasPrice);
  }

  function _lockFunds(uint _clanId, address _from, uint _playerId, uint _amount, uint _lockPeriod) private {
    if (_amount == 0) {
      return;
    }
    ClanInfo storage clanInfo = clanInfos[_clanId];
    uint totalBrushLocked = clanInfo.totalBrushLocked;
    clanInfo.totalBrushLocked = uint96(totalBrushLocked + _amount);
    uint40 lockingTimestamp = uint40(block.timestamp + _lockPeriod);
    uint length = clanInfo.defendingVaults.length;
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

  function attackCost() public view returns (uint) {
    return baseAttackCost + (movingAverageGasPrice * expectedGasLimitFulfill);
  }

  function getClanInfo(uint _clanId) external view returns (ClanInfo memory) {
    return clanInfos[_clanId];
  }

  function isCombatant(uint _clanId, uint _playerId) external view override returns (bool) {
    uint48[] storage playerIds = clanInfos[_clanId].playerIds;
    if (playerIds.length == 0) {
      return false;
    }

    uint searchIndex = EstforLibrary.binarySearch(playerIds, _playerId);
    return searchIndex != type(uint).max;
  }

  function getSortedClanIdsByMMR() external view returns (uint32[] memory) {
    return LockedBankVaultsLibrary.getSortedClanIdsByMMR(sortedClansByMMR);
  }

  function getSortedMMR() external view returns (uint16[] memory) {
    return LockedBankVaultsLibrary.getSortedMMR(sortedClansByMMR);
  }

  function setComparableSkills(Skill[] calldata _skills) public onlyOwner {
    for (uint i = 0; i < _skills.length; ++i) {
      if (_skills[i] == Skill.NONE || _skills[i] == Skill.COMBAT) {
        revert InvalidSkill(_skills[i]);
      }

      comparableSkills.push(_skills[i]);
    }
    emit SetComparableSkills(_skills);
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

  // TODO Can delete after setting initial MMR
  function initializeMMR(uint[] calldata clanIds, uint16[] calldata mmrs) external onlyOwner {
    LockedBankVaultsLibrary.initializeMMR(sortedClansByMMR, clans, clanInfos, clanIds, mmrs);
    emit SetMMRs(clanIds, mmrs);
  }

  function clearCooldowns(uint _clanId, uint[] calldata _otherClanIds) external isAdminAndBeta {
    LockedBankVaultsLibrary.clearCooldowns(_clanId, _otherClanIds, clanInfos[_clanId], lastClanBattles);
  }

  // Useful to re-run a battle for testing
  function setAttackInProgress(uint _requestId) external isAdminAndBeta {
    pendingAttacks[requestToPendingAttackIds[bytes32(_requestId)]].attackInProgress = true;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
