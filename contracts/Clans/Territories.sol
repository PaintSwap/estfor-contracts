// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import {VRFConsumerBaseV2Upgradeable} from "../VRFConsumerBaseV2Upgradeable.sol";
import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {IClans} from "../interfaces/IClans.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IBank} from "../interfaces/IBank.sol";

import {AdminAccess} from "../AdminAccess.sol";

import {ClanRank} from "../globals/clans.sol";
import {Skill} from "../globals/misc.sol";

import {ClanBattleLibrary} from "./ClanBattleLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";

contract Territories is
  VRFConsumerBaseV2Upgradeable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  ITerritories,
  IClanMemberLeftCB
{
  event AddTerritories(TerritoryInput[] territories);
  event EditTerritories(TerritoryInput[] territories);
  event RemoveTerritories(uint[] territoryIds);
  event Deposit(uint amount);
  event BrushAttackingCost(uint brushCost);
  event SetComparableSkills(Skill[] skills);
  event RequestFulfilled(uint requestId, uint[] randomWords);
  event AttackTerritory(
    uint clanId,
    uint64[] playerIds,
    uint territoryId,
    uint leaderPlayerId,
    uint requestId,
    uint pendingAttackId
  );
  event BattleResult(
    uint requestId,
    uint[] winnerPlayerIds,
    uint[] loserPlayerIds,
    bool didAttackersWin,
    uint attackingClanId,
    uint defendingClanId,
    uint[] randomWords,
    uint attackingTimestamp
  );
  event ClaimUnoccupiedTerritory(uint territoryId, uint clanId, uint64[] playerIds);
  event RemoveDefender(uint playerId, uint clanId, uint territoryId);
  event SetBrushAttackingCost(uint brushAttackingCost);
  event RequestSent(uint requestId, uint numWords);

  error InvalidTerritory();
  error InvalidTerritoryId();
  error InvalidEmissionPercentage();
  error NoOccupier();
  error TransferFailed();
  error AlreadyOwnATerritory();
  error NotLeader();
  error PlayerAttackingCooldown();
  error ClanAttackingCooldown();
  error NotMemberOfClan();
  error InvalidBrushCost();
  error InvalidSkill(Skill skill);
  error LengthMismatch();
  error OnlyClans();
  error PlayerIdsNotSortedOrDuplicates();
  error NotOwnerOfPlayerAndActive();
  error HarvestingTooSoon();
  error NotAdminAndBeta();

  struct TerritoryInput {
    uint16 territoryId;
    uint16 percentageEmissions; // Is multiplied by PERCENTAGE_EMISSION_MUL
  }

  struct Territory {
    uint16 territoryId; // TODO: Could be removed if necessary
    uint16 percentageEmissions; // Is multiplied by PERCENTAGE_EMISSION_MUL
    uint32 clanIdOccupier;
    uint88 unclaimedEmissions;
    uint40 lastClaimTime;
    uint64[] playerIdDefenders;
  }

  struct ClanInfo {
    uint16 ownsTerritoryId;
    uint40 attackingCooldownTimestamp;
    address bank;
  }

  struct PlayerInfo {
    uint40 attackingCooldownTimestamp;
    uint16 lastAttackingTerritoryId; // May or may not be actively defending this (only if they actually won)
    uint64 lastPendingAttackId;
  }

  struct PendingAttack {
    uint64[] playerIds;
    uint32 clanId;
    uint16 territoryId;
    uint40 timestamp;
    bool attackInProgress;
  }

  mapping(uint pendingAttackId => PendingAttack pendingAttack) private pendingAttacks;
  mapping(uint requestId => uint pendingAttackId) public requestToPendingAttackIds;
  mapping(uint territoryId => Territory territory) public territories;
  uint64 nextTerritoryId;
  address public players;
  uint64 nextPendingAttackId;
  IClans public clans;
  address public dev;
  IBankFactory public bankFactory;
  AdminAccess public adminAccess;
  bool isBeta;

  mapping(uint clanId => ClanInfo clanInfo) public clanInfos;
  uint16 public totalEmissionPercentage; // Multiplied by PERCENTAGE_EMISSION_MUL
  IBrushToken public brush;

  mapping(uint playerId => PlayerInfo playerInfo) public playerInfos;

  // solhint-disable-next-line var-name-mixedcase
  VRFCoordinatorV2Interface private COORDINATOR;

  // Your subscription ID.
  uint64 private subscriptionId;

  uint24 private callbackGasLimit;

  // The gas lane to use, which specifies the maximum gas price to bump to.
  // For a list of available gas lanes on each network, this is 10000gwei
  // see https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/#configurations
  bytes32 private constant KEY_HASH = 0x5881eea62f9876043df723cf89f0c2bb6f950da25e9dfe66995c24f919c8f8ab;

  uint16 private constant REQUEST_CONFIRMATIONS = 1;
  // Cannot exceed VRFCoordinatorV2.MAX_NUM_WORDS.
  uint32 private constant NUM_WORDS = 2;

  uint16 public brushAttackingCost; // In ether (max 65535)
  Skill[] private comparableSkills;

  uint public constant MAX_DAILY_EMISSIONS = 10000 ether;
  uint public constant TERRITORY_ATTACKED_COOLDOWN_PLAYER = 24 * 3600;

  uint constant PERCENTAGE_EMISSION_MUL = 10;
  uint public constant HARVESTING_COOLDOWN = 8 hours;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!IPlayers(players).isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
      revert NotOwnerOfPlayerAndActive();
    }
    _;
  }

  modifier isLeaderOfClan(uint _clanId, uint _playerId) {
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

  modifier isAdminAndBeta() {
    if (!(adminAccess.isAdmin(_msgSender()) && isBeta)) {
      revert NotAdminAndBeta();
    }
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    TerritoryInput[] calldata _territories,
    address _players,
    IClans _clans,
    IBrushToken _brush,
    IBankFactory _bankFactory,
    uint _brushAttackingCost,
    Skill[] calldata _comparableSkills,
    address _dev,
    VRFCoordinatorV2Interface _coordinator,
    uint64 _subscriptionId,
    AdminAccess _adminAccess,
    bool _isBeta
  ) external initializer {
    __VRFConsumerBaseV2_init(address(_coordinator));
    __UUPSUpgradeable_init();
    __Ownable_init();
    clans = _clans;
    brush = _brush;
    bankFactory = _bankFactory;
    players = _players;
    dev = _dev;
    nextTerritoryId = 1;
    nextPendingAttackId = 1;
    adminAccess = _adminAccess;
    isBeta = _isBeta;

    COORDINATOR = _coordinator;
    subscriptionId = _subscriptionId;
    callbackGasLimit = 400_000; // TODO: See how much this actually costs

    setComparableSkills(_comparableSkills);
    setBrushAttackingCost(_brushAttackingCost);
    _addTerritories(_territories);
  }

  // This needs to call the oracle VRF on-demand and costs some brush
  function attackTerritory(
    uint _clanId,
    uint64[] calldata _playerIds,
    uint _territoryId,
    uint _leaderPlayerId
  ) external isOwnerOfPlayerAndActive(_leaderPlayerId) isLeaderOfClan(_clanId, _leaderPlayerId) {
    _checkCanAttackTerritory(_clanId, _playerIds, _territoryId);

    uint64 _nextPendingAttackId = nextPendingAttackId++;
    uint clanIdOccupier = territories[_territoryId].clanIdOccupier;
    bool clanUnoccupied = clanIdOccupier == 0;

    for (uint i; i < _playerIds.length; ++i) {
      playerInfos[_playerIds[i]].attackingCooldownTimestamp = uint40(
        block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER
      );
      if (!clanUnoccupied) {
        playerInfos[_playerIds[i]].lastAttackingTerritoryId = uint16(_territoryId);
        playerInfos[_playerIds[i]].lastPendingAttackId = _nextPendingAttackId;
      }
    }

    for (uint i; i < territories[_territoryId].playerIdDefenders.length; ++i) {
      playerInfos[territories[_territoryId].playerIdDefenders[i]].attackingCooldownTimestamp = uint40(
        block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER
      );
    }

    clanInfos[_clanId].attackingCooldownTimestamp = uint40(block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER);

    // In theory this could be done in the fulfill callback, but it's easier to do it here and be consistent witht he player defenders/
    // which are set here to reduce amount of gas used by oracle callback

    // TODO take it from the clan bank later
    brush.transferFrom(msg.sender, dev, uint(brushAttackingCost) * 1 ether);

    if (clanUnoccupied) {
      _claimTerritory(_territoryId, _clanId, _playerIds);
      emit ClaimUnoccupiedTerritory(_territoryId, _clanId, _playerIds);
    } else {
      clanInfos[clanIdOccupier].attackingCooldownTimestamp = uint40(
        block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER
      );

      pendingAttacks[_nextPendingAttackId] = PendingAttack({
        playerIds: _playerIds,
        clanId: uint32(_clanId),
        territoryId: uint16(_territoryId),
        timestamp: uint40(block.timestamp),
        attackInProgress: true
      });
      uint requestId = _requestRandomWords();
      requestToPendingAttackIds[requestId] = _nextPendingAttackId;

      emit AttackTerritory(_clanId, _playerIds, _territoryId, _leaderPlayerId, requestId, _nextPendingAttackId);
    }
  }

  function clanMemberLeft(uint _clanId, uint _playerId) external override onlyClans {
    // Remove from the player defenders if they are in there
    if (playerInfos[_playerId].lastAttackingTerritoryId != 0) {
      Territory storage territory = territories[playerInfos[_playerId].lastAttackingTerritoryId];
      // Does this territory still have the same clan defending it?
      if (territory.clanIdOccupier == _clanId) {
        // Check if this player is in the defenders list and remove him if so
        uint searchIndex = EstforLibrary.binarySearch(territory.playerIdDefenders, _playerId);
        if (searchIndex != type(uint).max) {
          // Not shifting it for gas reasons
          delete territory.playerIdDefenders[searchIndex];
          emit RemoveDefender(_playerId, _clanId, territory.territoryId);
        }
      }

      uint pendingAttackId = playerInfos[_playerId].lastPendingAttackId;
      if (
        pendingAttackId != 0 &&
        pendingAttacks[pendingAttackId].attackInProgress &&
        pendingAttacks[pendingAttackId].clanId == _clanId
      ) {
        // Remove from the pending attack
        uint searchIndex = EstforLibrary.binarySearch(pendingAttacks[pendingAttackId].playerIds, _playerId);
        if (searchIndex != type(uint).max) {
          // Not shifting it for gas reasons
          delete pendingAttacks[pendingAttackId].playerIds[searchIndex];
        }
      }
    }
  }

  function _checkCanAttackTerritory(uint _clanId, uint64[] calldata _playerIds, uint _territoryId) private view {
    if (territories[_territoryId].territoryId != _territoryId) {
      revert InvalidTerritory();
    }

    if (clanInfos[_clanId].ownsTerritoryId != 0) {
      revert AlreadyOwnATerritory();
    }

    // Check the cooldown periods on attacking (because they might have just joined another clan)
    for (uint i; i < _playerIds.length; ++i) {
      if (playerInfos[_playerIds[i]].attackingCooldownTimestamp > block.timestamp) {
        revert PlayerAttackingCooldown();
      }

      // Check they are part of the clan
      if (clans.getRank(_clanId, _playerIds[i]) == ClanRank.NONE) {
        revert NotMemberOfClan();
      }
    }

    if (clanInfos[_clanId].attackingCooldownTimestamp > block.timestamp) {
      revert ClanAttackingCooldown();
    }

    for (uint i; i < _playerIds.length; ++i) {
      if (i != _playerIds.length - 1 && _playerIds[i] >= _playerIds[i + 1]) {
        revert PlayerIdsNotSortedOrDuplicates();
      }
    }

    if (territories[_territoryId].clanIdOccupier == 0) {
      return;
    }
  }

  function _requestRandomWords() private returns (uint requestId) {
    requestId = COORDINATOR.requestRandomWords(
      KEY_HASH,
      subscriptionId,
      REQUEST_CONFIRMATIONS,
      callbackGasLimit,
      NUM_WORDS
    );

    emit RequestSent(requestId, NUM_WORDS);
  }

  function _claimTerritory(uint _territoryId, uint _attackingClanId, uint64[] memory _playerIdAttackers) private {
    // Assign them the new stuff
    territories[_territoryId].clanIdOccupier = uint32(_attackingClanId);
    territories[_territoryId].playerIdDefenders = _playerIdAttackers;
    clanInfos[_attackingClanId].ownsTerritoryId = uint16(_territoryId);
  }

  function fulfillRandomWords(uint _requestId, uint[] memory _randomWords) internal override {
    if (_randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    // Read defending players
    PendingAttack storage pendingAttack = pendingAttacks[requestToPendingAttackIds[_requestId]];
    uint64[] storage playerIdAttackers = pendingAttack.playerIds;
    uint16 territoryId = pendingAttack.territoryId;
    uint64[] storage playerIdDefenders = territories[territoryId].playerIdDefenders;

    // Does this territory still have the same clan defenders?
    uint32 attackingClanId = pendingAttack.clanId;
    uint defendingClanId = territories[territoryId].clanIdOccupier;

    uint randomSkillIndex = _randomWords[0] % comparableSkills.length;
    (uint[] memory winners, uint[] memory losers, bool didAttackersWin) = ClanBattleLibrary.doBattle(
      players,
      playerIdAttackers,
      playerIdDefenders,
      _randomWords[0],
      _randomWords[1],
      comparableSkills[randomSkillIndex]
    );

    uint timestamp = pendingAttack.timestamp;
    pendingAttack.attackInProgress = false;

    if (didAttackersWin) {
      _claimTerritory(territoryId, attackingClanId, playerIdAttackers);
      // Update old clan
      clanInfos[defendingClanId].ownsTerritoryId = 0;
    }
    emit BattleResult(
      _requestId,
      winners,
      losers,
      didAttackersWin,
      attackingClanId,
      defendingClanId,
      _randomWords,
      timestamp
    );
  }

  // Any harvest automatically does a claim as well beforehand
  function harvest(uint _territoryId) external {
    //    _callAddUnclaimedEmissions();

    Territory storage territory = territories[_territoryId];
    uint clanId = territory.clanIdOccupier;
    if (clanId == 0) {
      revert NoOccupier();
    }

    uint unclaimedEmissions = territory.unclaimedEmissions;

    // Cache some values for next time
    if (clanInfos[clanId].bank == address(0)) {
      address bankAddress = bankFactory.bankAddress(clanId);
      brush.approve(bankAddress, type(uint).max);
      clanInfos[clanId].bank = bankAddress;
    }

    if (territory.lastClaimTime + HARVESTING_COOLDOWN > block.timestamp) {
      revert HarvestingTooSoon();
    }

    territory.lastClaimTime = uint40(block.timestamp);

    // TODO: Deposting directly to the bank, but the idea is to freeze the funds first.
    IBank(clanInfos[clanId].bank).depositToken(0, address(brush), unclaimedEmissions);

    // TODO Frozen funds, here or in bank?
    //    clans.;
  }

  function pendingEmissions(uint _territoryId) external {
    // get pending from masterchef * 2 ?
  }

  // If a transfer of assets
  //  function _callAddUnclaimedEmissions() private {
  //    _artGallery.
  //  }

  function addUnclaimedEmissions(uint _amount) external {
    if (!brush.transferFrom(msg.sender, address(this), _amount)) {
      revert TransferFailed();
    }
    for (uint i = 1; i < nextTerritoryId; ++i) {
      territories[i].unclaimedEmissions += uint88(
        (_amount * territories[i].percentageEmissions) / totalEmissionPercentage
      );
    }
    emit Deposit(_amount);
  }

  function _checkTerritory(TerritoryInput calldata _territory) private pure {
    if (_territory.territoryId == 0 || _territory.percentageEmissions == 0) {
      revert InvalidTerritory();
    }
  }

  function _addTerritories(TerritoryInput[] calldata _territories) private {
    uint _totalEmissionPercentage = totalEmissionPercentage;
    uint64[] memory playerIdDefenders;
    uint _nextTerritoryId = nextTerritoryId;
    for (uint i; i < _territories.length; ++i) {
      TerritoryInput calldata territoryInput = _territories[i];
      _checkTerritory(_territories[i]);
      if (i + _nextTerritoryId != territoryInput.territoryId) {
        revert InvalidTerritoryId();
      }

      territories[territoryInput.territoryId] = Territory({
        territoryId: territoryInput.territoryId,
        clanIdOccupier: 0,
        percentageEmissions: territoryInput.percentageEmissions,
        unclaimedEmissions: 0,
        lastClaimTime: 0,
        playerIdDefenders: playerIdDefenders
      });
      _totalEmissionPercentage += territoryInput.percentageEmissions;
    }

    nextTerritoryId = uint64(_nextTerritoryId + _territories.length);

    if (_totalEmissionPercentage > 100 * PERCENTAGE_EMISSION_MUL) {
      revert InvalidEmissionPercentage();
    }

    totalEmissionPercentage = uint16(_totalEmissionPercentage);
    emit AddTerritories(_territories);
  }

  function getTerrorities() external view returns (Territory[] memory) {
    Territory[] memory _territories = new Territory[](nextTerritoryId - 1);
    for (uint i; i < _territories.length; ++i) {
      _territories[i] = territories[i + 1];
    }
    return _territories;
  }

  function getPendingAttack(uint _pendingAttackId) external view returns (PendingAttack memory pendingAttack) {
    return pendingAttacks[_pendingAttackId];
  }

  function addTerritories(TerritoryInput[] calldata _territories) external onlyOwner {
    _addTerritories(_territories);
  }

  function editTerritories(TerritoryInput[] calldata _territories) external onlyOwner {
    uint _totalEmissionPercentage = totalEmissionPercentage;
    for (uint i; i < _territories.length; ++i) {
      _checkTerritory(_territories[i]);
      _totalEmissionPercentage -= territories[_territories[i].territoryId].percentageEmissions;
      _totalEmissionPercentage += _territories[i].percentageEmissions;
      territories[_territories[i].territoryId].percentageEmissions = _territories[i].percentageEmissions;
    }

    if (_totalEmissionPercentage > 100 * PERCENTAGE_EMISSION_MUL) {
      revert InvalidEmissionPercentage();
    }
    totalEmissionPercentage = uint8(_totalEmissionPercentage);
    emit EditTerritories(_territories);
  }

  function removeTerritories(uint[] calldata _territoryIds) external onlyOwner {
    uint _totalEmissionPercentage = totalEmissionPercentage;
    for (uint i; i < _territoryIds.length; ++i) {
      if (territories[_territoryIds[i]].territoryId == 0) {
        revert InvalidTerritoryId();
      }

      _totalEmissionPercentage -= territories[_territoryIds[i]].percentageEmissions;
      delete territories[_territoryIds[i]];
    }

    totalEmissionPercentage = uint16(_totalEmissionPercentage);
    emit RemoveTerritories(_territoryIds);
  }

  function setBrushAttackingCost(uint _brushAttackingCost) public onlyOwner {
    if (_brushAttackingCost % 1 ether != 0) {
      revert InvalidBrushCost();
    }
    brushAttackingCost = uint16(_brushAttackingCost / 1 ether);
    emit SetBrushAttackingCost(_brushAttackingCost);
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

  function clearAttackingCooldown(uint _clanId, uint[] memory _playerIds) public isAdminAndBeta {
    for (uint i; i < _playerIds.length; ++i) {
      playerInfos[_playerIds[i]].attackingCooldownTimestamp = 0;
    }
    clanInfos[_clanId].attackingCooldownTimestamp = 0;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
