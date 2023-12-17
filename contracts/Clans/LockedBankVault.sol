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
import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";

import {AdminAccess} from "../AdminAccess.sol";

import {ClanRank, MAX_CLAN_COMBATANTS, CLAN_WARS_GAS_PRICE_WINDOW_SIZE} from "../globals/clans.sol";
import {Skill} from "../globals/misc.sol";

import {ClanBattleLibrary} from "./ClanBattleLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";

contract LockedBankVault is RrpRequesterV0Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IClanMemberLeftCB {
  event AttackVaults(
    uint clanId,
    uint defendingClanId,
    address from,
    uint leaderPlayerId,
    uint requestId,
    uint pendingAttackId,
    uint attackingCooldownTimestamp,
    uint reattackingCooldownTimestamp
  );
  event SetComparableSkills(Skill[] skills);
  event BattleResult(
    uint requestId,
    uint[] winnerPlayerIds,
    uint[] loserPlayerIds,
    Skill[] randomSkills,
    bool didAttackersWin,
    uint attackingClanId,
    uint defendingClanId,
    uint[] randomWords,
    uint attackingTimestamp,
    uint percentageToTake
  );

  event AssignCombatants(uint clanId, uint48[] playerIds, address from, uint leaderPlayerId, uint cooldownTimestamp);
  event RemoveCombatant(uint playerId, uint clanId);
  event ClaimFunds(uint clanId, address from, uint playerId, uint amount, uint numLocksClaimed);
  event LockFunds(uint clanId, address from, uint playerId, uint amount, uint lockingTimestamp);
  event UpdateMovingAverageGasPrice(uint movingAverage);
  event SetExpectedGasLimitFulfill(uint expectedGasLimitFulfill);
  event SetBaseAttackCost(uint baseAttackCost);

  error PlayerOnTerritory();
  error NoCombatants();
  error TooManyCombatants();
  error NotOwnerOfPlayerAndActive();
  error NotLeader();
  error InvalidSkill(Skill skill);
  error ClanAttackingCooldown();
  error ClanAttackingSameClanCooldown();
  error PlayerIdsNotSortedOrDuplicates();
  error NotMemberOfClan();
  error PlayerCombatantCooldownTimestamp();
  error LengthMismatch();
  error NoBrushToAttack();
  error CannotAttackSelf();
  error OnlyClans();
  error OnlyTerritories();
  error OnlyCombatantsHelper();
  error TransferFailed();
  error ClanCombatantsChangeCooldown();
  error CannotChangeCombatantsDuringAttack();
  error NothingToClaim();
  error CannotAttackWhileStillAttacking();
  error NotAdminAndBeta();
  error NotEnoughFTM();

  struct ClanBattleInfo {
    uint40 lastClanIdAttackOtherClanIdCooldownTimestamp;
    uint40 lastOtherClanIdAttackClanIdCooldownTimestamp;
  }

  // TODO Can store multiple in this
  struct Vault {
    uint40 timestamp;
    uint80 amount;
  }

  struct ClanInfo {
    IBank bank;
    uint96 totalBrushLocked;
    uint40 attackingCooldownTimestamp;
    uint40 assignCombatantsCooldownTimestamp;
    bool currentlyAttacking;
    uint88 gasPaid;
    uint48[] playerIds;
    Vault[] defendingVaults; // TODO may need to update this. Have a max of 30? What about slicing?
  }

  struct PlayerInfo {
    uint40 combatantCooldownTimestamp;
  }

  struct PendingAttack {
    uint40 clanId;
    uint40 defendingClanId;
    uint40 timestamp;
    bool attackInProgress;
  }

  Skill[] private comparableSkills;
  uint64 public nextPendingAttackId;
  mapping(uint clanId => ClanInfo clanInfo) private clanInfos;
  mapping(uint pendingAttackId => PendingAttack pendingAttack) public pendingAttacks;
  mapping(bytes32 requestId => uint pendingAttackId) public requestToPendingAttackIds;
  mapping(uint playerId => PlayerInfo playerInfos) public playerInfos;
  mapping(uint clanId => mapping(uint otherClanId => ClanBattleInfo battleInfo)) public lastClanBattles; // Always ordered from smallest to largest
  IClans public clans;
  IPlayers public players;
  IBrushToken public brush;
  ITerritories public territories;
  AdminAccess public adminAccess;
  bool public isBeta;
  IBankFactory public bankFactory;
  address public combatantsHelper;

  address public airnode; // The address of the QRNG Airnode
  address public sponsorWallet; // The wallet that will cover the gas costs of the request
  bytes32 public endpointIdUint256; // The endpoint ID for requesting a single random number
  bytes32 public endpointIdUint256Array; // The endpoint ID for requesting an array of random numbers

  uint8 public indexGasPrice;
  uint64 public movingAverageGasPrice;
  uint88 public baseAttackCost; // To offset gas costs in response
  uint24 public expectedGasLimitFulfill;
  uint64[CLAN_WARS_GAS_PRICE_WINDOW_SIZE] private prices;

  uint private constant NUM_WORDS = 2;
  uint public constant ATTACKING_COOLDOWN = 4 hours;
  uint public constant MIN_REATTACKING_COOLDOWN = 1 days;
  uint public constant MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN = 3 days;
  uint public constant COMBATANT_COOLDOWN = MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN;
  uint public constant MAX_VAULTS = 100;
  uint public constant LOCK_PERIOD = 7 days;

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

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPlayers _players,
    IClans _clans,
    IBrushToken _brush,
    IBankFactory _bankFactory,
    Skill[] calldata _comparableSkills,
    address _airnodeRrp,
    address _airnode,
    bytes32 _endpointIdUint256,
    bytes32 _endpointIdUint256Array,
    AdminAccess _adminAccess,
    bool _isBeta
  ) external initializer {
    __RrpRequesterV0_init(_airnodeRrp);
    __UUPSUpgradeable_init();
    __Ownable_init();
    players = _players;
    brush = _brush;
    bankFactory = _bankFactory;
    clans = _clans;

    adminAccess = _adminAccess;
    isBeta = _isBeta;

    airnode = _airnode;
    endpointIdUint256 = _endpointIdUint256;
    endpointIdUint256Array = _endpointIdUint256Array;

    for (uint i; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      prices[i] = uint64(tx.gasprice);
    }
    _updateMovingAverageGasPrice(uint64(tx.gasprice));
    setBaseAttackCost(0.05 ether);
    setExpectedGasLimitFulfill(300_000);

    setComparableSkills(_comparableSkills);
  }

  function assignCombatants(
    uint _clanId,
    uint48[] calldata _playerIds,
    uint _leaderPlayerId
  ) external onlyCombatantsHelper {
    _checkCanAssignCombatants(_clanId, _playerIds);

    for (uint i; i < _playerIds.length; ++i) {
      playerInfos[_playerIds[i]].combatantCooldownTimestamp = uint40(block.timestamp + COMBATANT_COOLDOWN);
    }

    clanInfos[_clanId].playerIds = _playerIds;
    clanInfos[_clanId].assignCombatantsCooldownTimestamp = uint40(
      block.timestamp + MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN
    );
    emit AssignCombatants(_clanId, _playerIds, msg.sender, _leaderPlayerId, block.timestamp + COMBATANT_COOLDOWN);
  }

  // This needs to call the oracle VRF on-demand and costs some brush
  function attackVaults(
    uint _clanId,
    uint _defendingClanId,
    uint _leaderPlayerId
  ) external payable isOwnerOfPlayerAndActive(_leaderPlayerId) isAtLeastLeaderOfClan(_clanId, _leaderPlayerId) {
    // Check they are paying enough
    if (msg.value < attackCost()) {
      revert NotEnoughFTM();
    }

    (bool success, ) = sponsorWallet.call{value: msg.value}("");
    if (!success) {
      revert TransferFailed();
    }

    // Get all the defenders
    _checkCanAttackVaults(_clanId, _defendingClanId);

    clanInfos[_clanId].currentlyAttacking = true;

    uint64 _nextPendingAttackId = nextPendingAttackId++;

    uint40 attackingCooldownTimestamp = uint40(block.timestamp + ATTACKING_COOLDOWN);
    clanInfos[_clanId].attackingCooldownTimestamp = attackingCooldownTimestamp;
    clanInfos[_clanId].gasPaid = uint88(msg.value);

    uint lowerClanId = _clanId < _defendingClanId ? _clanId : _defendingClanId;
    uint40 reattackingCooldown = uint40(block.timestamp + MIN_REATTACKING_COOLDOWN);
    ClanBattleInfo storage battleInfo = lastClanBattles[lowerClanId][_defendingClanId];
    if (lowerClanId == _clanId) {
      battleInfo.lastClanIdAttackOtherClanIdCooldownTimestamp = reattackingCooldown;
    } else {
      battleInfo.lastOtherClanIdAttackClanIdCooldownTimestamp = reattackingCooldown;
    }

    // In theory this could be done in the fulfill callback, but it's easier to do it here and be consistent witht he player defenders/
    // which are set here to reduce amount of gas used by oracle callback

    pendingAttacks[_nextPendingAttackId] = PendingAttack({
      clanId: uint40(_clanId),
      defendingClanId: uint40(_defendingClanId),
      timestamp: uint40(block.timestamp),
      attackInProgress: true
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
      reattackingCooldown
    );
  }

  /// @notice Called by the Airnode through the AirnodeRrp contract to fulfill the request
  function fulfillRandomWords(bytes32 _requestId, bytes calldata _data) external onlyAirnodeRrp {
    uint[] memory randomWords = abi.decode(_data, (uint[]));
    if (randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    PendingAttack storage pendingAttack = pendingAttacks[requestToPendingAttackIds[_requestId]];
    uint40 attackingClanId = pendingAttack.clanId;
    uint48[] storage playerIdAttackers = clanInfos[attackingClanId].playerIds;
    uint defendingClanId = pendingAttack.defendingClanId;

    uint48[] storage playerIdDefenders = clanInfos[defendingClanId].playerIds;

    Skill[] memory randomSkills = new Skill[](Math.max(playerIdAttackers.length, playerIdDefenders.length));
    for (uint i; i < randomSkills.length; ++i) {
      randomSkills[i] = comparableSkills[uint8(randomWords[0] >> (i * 8)) % comparableSkills.length];
    }

    (uint[] memory winners, uint[] memory losers, bool didAttackersWin) = ClanBattleLibrary.doBattle(
      address(players),
      playerIdAttackers,
      playerIdDefenders,
      randomSkills,
      randomWords[0],
      randomWords[1]
    );

    uint timestamp = pendingAttack.timestamp;
    pendingAttack.attackInProgress = false;
    clanInfos[attackingClanId].currentlyAttacking = false;

    uint percentageToTake = 10;
    if (didAttackersWin) {
      // Go through all the defendingData
      uint totalWon;
      for (uint i; i < clanInfos[defendingClanId].defendingVaults.length; ++i) {
        uint defendingTimestamp = clanInfos[defendingClanId].defendingVaults[i].timestamp;
        if (defendingTimestamp <= block.timestamp) {
          // This one is safe
          continue;
        }

        // How much to take? 10-15% (TODO)
        uint amount = clanInfos[defendingClanId].defendingVaults[i].amount;
        uint stealAmount = amount / percentageToTake;
        clanInfos[defendingClanId].defendingVaults[i].amount = uint80(amount - stealAmount);
        clanInfos[defendingClanId].totalBrushLocked -= uint96(stealAmount);
        totalWon += stealAmount;
      }

      _lockFunds(attackingClanId, address(0), 0, totalWon);
    }

    _updateAverageGasPrice();

    emit BattleResult(
      uint(_requestId),
      winners,
      losers,
      randomSkills,
      didAttackersWin,
      attackingClanId,
      defendingClanId,
      randomWords,
      timestamp,
      percentageToTake
    );
  }

  function claimFunds(uint _clanId, uint _playerId) external isOwnerOfPlayerAndActive(_playerId) {
    // Cache some values for next time if not called already
    address bankAddress = address(clanInfos[_clanId].bank);
    if (bankAddress == address(0)) {
      bankAddress = bankFactory.bankAddress(_clanId);
      brush.approve(bankAddress, type(uint).max);
      clanInfos[_clanId].bank = IBank(bankAddress);
    }

    uint total;
    uint numLocksClaimed;
    for (uint i; i < clanInfos[_clanId].defendingVaults.length; ++i) {
      uint defendingTimestamp = clanInfos[_clanId].defendingVaults[i].timestamp;
      if (defendingTimestamp > block.timestamp) {
        break;
      }

      total += clanInfos[_clanId].defendingVaults[i].amount;
      delete clanInfos[_clanId].defendingVaults[i];
      ++numLocksClaimed;
    }

    if (total == 0) {
      revert NothingToClaim();
    }

    clanInfos[_clanId].totalBrushLocked -= uint96(total);

    IBank(bankAddress).depositToken(msg.sender, _playerId, address(brush), total);
    emit ClaimFunds(_clanId, msg.sender, _playerId, total, numLocksClaimed);
  }

  function lockFunds(uint _clanId, address _from, uint _playerId, uint _amount) external onlyTerritories {
    _lockFunds(_clanId, _from, _playerId, _amount);
    if (!brush.transferFrom(msg.sender, address(this), _amount)) {
      revert TransferFailed();
    }
  }

  function clanMemberLeft(uint _clanId, uint _playerId) external override onlyClans {
    // Remove from the player defenders if they are in there
    uint48[] storage playerIds = clanInfos[_clanId].playerIds;
    if (playerIds.length > 0) {
      uint searchIndex = EstforLibrary.binarySearch(clanInfos[_clanId].playerIds, _playerId);
      if (searchIndex != type(uint).max) {
        // Not shifting it for gas reasons
        delete clanInfos[_clanId].playerIds[searchIndex];
        emit RemoveCombatant(_playerId, _clanId);
      }
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

  function _lockFunds(uint _clanId, address _from, uint _playerId, uint _amount) private {
    clanInfos[_clanId].totalBrushLocked += uint96(_amount);
    uint40 lockingTimestamp = uint40(block.timestamp + LOCK_PERIOD);
    clanInfos[_clanId].defendingVaults.push(Vault({timestamp: lockingTimestamp, amount: uint80(_amount)}));
    emit LockFunds(_clanId, _from, _playerId, _amount, lockingTimestamp);
  }

  function _updateMovingAverageGasPrice(uint64 _movingAverageGasPrice) private {
    movingAverageGasPrice = _movingAverageGasPrice;
    emit UpdateMovingAverageGasPrice(_movingAverageGasPrice);
  }

  function _checkCanAssignCombatants(uint _clanId, uint48[] calldata _playerIds) private view {
    if (clanInfos[_clanId].currentlyAttacking) {
      revert CannotChangeCombatantsDuringAttack();
    }

    if (_playerIds.length == 0) {
      revert NoCombatants();
    }

    if (_playerIds.length > MAX_CLAN_COMBATANTS) {
      revert TooManyCombatants();
    }

    // Can only change defenders every so often
    if (clanInfos[_clanId].assignCombatantsCooldownTimestamp > block.timestamp) {
      revert ClanCombatantsChangeCooldown();
    }

    // Check the cooldown periods on attacking (because they might have just joined from another clan)
    for (uint i; i < _playerIds.length; ++i) {
      if (playerInfos[_playerIds[i]].combatantCooldownTimestamp > block.timestamp) {
        revert PlayerCombatantCooldownTimestamp();
      }

      // Check they are part of the clan
      if (clans.getRank(_clanId, _playerIds[i]) == ClanRank.NONE) {
        revert NotMemberOfClan();
      }

      if (i != _playerIds.length - 1 && _playerIds[i] >= _playerIds[i + 1]) {
        revert PlayerIdsNotSortedOrDuplicates();
      }
    }
  }

  function _checkCanAttackVaults(uint _clanId, uint _defendingClanId) private view {
    // Must have at least 1 combatant
    if (clanInfos[_clanId].playerIds.length == 0) {
      revert NoCombatants();
    }

    if (_clanId == _defendingClanId) {
      revert CannotAttackSelf();
    }

    // Does this clan have any brush to even attack?
    if (clanInfos[_defendingClanId].totalBrushLocked == 0) {
      revert NoBrushToAttack();
    }

    if (clanInfos[_clanId].attackingCooldownTimestamp > block.timestamp) {
      revert ClanAttackingCooldown();
    }

    if (clanInfos[_clanId].currentlyAttacking) {
      revert CannotAttackWhileStillAttacking();
    }

    // Cannot attack same clan within the timeframe (TODO: Unless they have an item?)
    uint lowerClanId = _clanId < _defendingClanId ? _clanId : _defendingClanId;
    if (lowerClanId == _clanId) {
      if (
        lastClanBattles[lowerClanId][_defendingClanId].lastClanIdAttackOtherClanIdCooldownTimestamp > block.timestamp
      ) {
        revert ClanAttackingSameClanCooldown();
      }
    } else {
      if (lastClanBattles[lowerClanId][_clanId].lastOtherClanIdAttackClanIdCooldownTimestamp > block.timestamp) {
        revert ClanAttackingSameClanCooldown();
      }
    }
  }

  function _requestRandomWords() private returns (bytes32 requestId) {
    requestId = airnodeRrp.makeFullRequest(
      airnode,
      endpointIdUint256Array,
      address(this),
      sponsorWallet,
      address(this),
      this.fulfillRandomWords.selector,
      // Using Airnode ABI to encode the parameters
      abi.encode(bytes32("1u"), bytes32("size"), NUM_WORDS)
    );
  }

  function attackCost() public view returns (uint) {
    return baseAttackCost + (movingAverageGasPrice * expectedGasLimitFulfill);
  }

  function getClanInfo(uint _clanId) external view returns (ClanInfo memory) {
    return clanInfos[_clanId];
  }

  function isCombatant(uint _clanId, uint _playerId) external view returns (bool) {
    uint48[] storage playerIds = clanInfos[_clanId].playerIds;
    if (playerIds.length == 0) {
      return false;
    }

    uint searchIndex = EstforLibrary.binarySearch(playerIds, _playerId);
    return searchIndex != type(uint).max;
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

  function setTerritories(ITerritories _territories) external onlyOwner {
    territories = _territories;
  }

  function setCombatantsHelper(address _combatantsHelper) external onlyOwner {
    combatantsHelper = _combatantsHelper;
  }

  function setSponsorWallet(address _sponsorWallet) external onlyOwner {
    sponsorWallet = _sponsorWallet;
  }

  function setBaseAttackCost(uint88 _baseAttackCost) public onlyOwner {
    baseAttackCost = _baseAttackCost;
    emit SetBaseAttackCost(_baseAttackCost);
  }

  function setExpectedGasLimitFulfill(uint24 _expectedGasLimitFulfill) public onlyOwner {
    expectedGasLimitFulfill = _expectedGasLimitFulfill;
    emit SetExpectedGasLimitFulfill(_expectedGasLimitFulfill);
  }

  function clearCooldowns(uint _clanId, uint[] calldata _otherClanIds) public isAdminAndBeta {
    clanInfos[_clanId].attackingCooldownTimestamp = 0;
    clanInfos[_clanId].assignCombatantsCooldownTimestamp = 0;
    for (uint i; i < clanInfos[_clanId].playerIds.length; ++i) {
      playerInfos[clanInfos[_clanId].playerIds[i]].combatantCooldownTimestamp = 0;
    }

    for (uint i; i < _otherClanIds.length; ++i) {
      uint lowerClanId = _clanId < _otherClanIds[i] ? _clanId : _otherClanIds[i];
      uint higherClanId = _clanId < _otherClanIds[i] ? _otherClanIds[i] : _clanId;
      delete lastClanBattles[lowerClanId][higherClanId];
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
