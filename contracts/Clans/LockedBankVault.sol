// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import {VRFConsumerBaseV2Upgradeable} from "../VRFConsumerBaseV2Upgradeable.sol";
import {IClans} from "../interfaces/IClans.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {IBank} from "../interfaces/IBank.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";

import {ClanRank, MAX_CLAN_COMBATANTS} from "../globals/clans.sol";
import {Skill} from "../globals/misc.sol";

import {ClanBattleLibrary} from "./ClanBattleLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";

contract LockedBankVault is VRFConsumerBaseV2Upgradeable, UUPSUpgradeable, OwnableUpgradeable, IClanMemberLeftCB {
  event SetComparableSkills(Skill[] skills);
  event BattleResult(
    uint requestId,
    uint[] winnerPlayerIds,
    uint[] loserPlayerIds,
    Skill[] skills,
    bool didAttackersWin,
    uint attackingClanId,
    uint defendingClanId,
    uint[] randomWords,
    uint attackingTimestamp
  );
  event AttackVault(
    uint clanId,
    uint64[] playerIds,
    uint defendingClanId,
    uint leaderPlayerId,
    uint requestId,
    uint pendingAttackId
  );
  event RequestSent(uint requestId, uint numWords);
  event RemoveDefender(uint playerId, uint clanId);
  event ClaimFunds(uint clanId, uint amount, uint numLocksClaimed);
  event AssignCombatants(uint clanId, uint64[] playerIds, uint leaderPlayerId, uint combatantCooldownTimestamp);

  error PlayerDefendingTerritory();
  error TooManyAttackers();
  error NoDefenders();
  error NoAttackers();
  error TooManyCombatants();
  error NotOwnerOfPlayerAndActive();
  error NotLeader();
  error InvalidSkill(Skill skill);
  error ClanAttackingCooldown();
  error ClanAttackingSameClanCooldown();
  error PlayerIdsNotSortedOrDuplicates();
  error NotMemberOfClan();
  error PlayerAttackingCooldown();
  error PlayerCombatantCooldownTimestamp();
  error LengthMismatch();
  error NoBrushToAttack();
  error CannotAttackSelf();
  error OnlyClans();
  error TransferFailed();
  error ClanCombatantsChangeCooldown();
  error CannotChangeCombatantsDuringAttack();
  error NothingToClaim();

  struct ClanBattleInfo {
    uint40 lastClanIdAttackOtherClanIdCooldownTimestamp;
    uint40 lastOtherClanIdAttackClanIdCooldownTimestamp;
  }

  // TODO Can store multiple in this
  struct DefendingData {
    uint40 timestamp;
    uint80 amount;
  }

  struct ClanInfo {
    IBank bank;
    uint96 totalBrushLocked;
    uint40 attackingCooldownTimestamp;
    uint40 assignCombatantsCooldownTimestamp;
    bool currentlyAttacking;
    uint64[] playerIds;
    DefendingData[] defendingData; // TODO may need to update this. Have a max of 30? What about slicing?
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
  mapping(uint requestId => uint64 pendingAttackId) public requestToPendingAttackIds;
  mapping(uint playerId => PlayerInfo playerInfos) public playerInfos;
  mapping(uint clanId => mapping(uint otherClanId => ClanBattleInfo battleInfo)) public lastClanBattles; // Always ordered from smallest to largest
  IClans public clans;
  IPlayers public players;
  IBrushToken public brush;
  ITerritories public territories;
  IBankFactory public bankFactory;

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

  uint public constant ATTACKING_COOLDOWN = 4 hours;
  uint public constant MIN_REATTACKING_COOLDOWN = 1 days;
  uint public constant MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN = 3 days;
  uint public constant COMBATANT_COOLDOWN = MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN;

  uint public constant LOCK_PERIOD = 7 days;

  modifier isOwnerOfPlayerAndActive(uint _playerId) {
    if (!players.isOwnerOfPlayerAndActive(msg.sender, _playerId)) {
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
    VRFCoordinatorV2Interface _coordinator,
    uint64 _subscriptionId
  ) external initializer {
    __VRFConsumerBaseV2_init(address(_coordinator));
    __UUPSUpgradeable_init();
    __Ownable_init();
    players = _players;
    brush = _brush;
    bankFactory = _bankFactory;
    clans = _clans;

    COORDINATOR = _coordinator;
    subscriptionId = _subscriptionId;
    callbackGasLimit = 400_000; // TODO: See how much this actually costs

    setComparableSkills(_comparableSkills);
  }

  function lockFunds(uint _clanId, uint _amount) external {
    // TODO: Have a minimum unless it's from territories?
    //    if (address(territories) == msg.sender) {
    //    }

    // Start the 7 day cooldown
    clanInfos[_clanId].totalBrushLocked += uint96(_amount);

    if (!brush.transferFrom(msg.sender, address(this), _amount)) {
      revert TransferFailed();
    }

    clanInfos[_clanId].defendingData.push(
      DefendingData({timestamp: uint40(block.timestamp + LOCK_PERIOD), amount: uint32(_amount)})
    );
  }

  function claimFunds(uint _clanId) external {
    // Cache some values for next time
    address bankAddress = address(clanInfos[_clanId].bank);
    if (bankAddress == address(0)) {
      bankAddress = bankFactory.bankAddress(_clanId);
      brush.approve(bankAddress, type(uint).max);
      clanInfos[_clanId].bank = IBank(bankAddress);
    }

    uint total;
    uint numLocksClaimed;
    for (uint i; i < clanInfos[_clanId].defendingData.length; ++i) {
      uint defendingTimestamp = clanInfos[_clanId].defendingData[i].timestamp;
      if (defendingTimestamp > block.timestamp) {
        break;
      }

      total += clanInfos[_clanId].defendingData[i].amount;
      delete clanInfos[_clanId].defendingData[i];
      ++numLocksClaimed;
    }

    if (total == 0) {
      revert NothingToClaim();
    }

    clanInfos[_clanId].totalBrushLocked -= uint96(total);

    if (!brush.transfer(bankAddress, total)) {
      revert TransferFailed();
    }
    emit ClaimFunds(_clanId, total, numLocksClaimed);
  }

  function clanMemberLeft(uint _clanId, uint _playerId) external override onlyClans {
    // Remove from the player defenders if they are in there
    uint64[] storage playerIds = clanInfos[_clanId].playerIds;
    if (playerIds.length > 0) {
      uint searchIndex = EstforLibrary.binarySearch(clanInfos[_clanId].playerIds, _playerId);
      if (searchIndex != type(uint).max) {
        // Not shifting it for gas reasons
        delete clanInfos[_clanId].playerIds[searchIndex];
        emit RemoveDefender(_playerId, _clanId);
      }
    }
  }

  function _checkCanAssignCombatants(uint _clanId, uint64[] calldata _playerIds) private view {
    // Check this clan exists
    //    if (territories[_territoryId].territoryId != _territoryId) {
    //      revert InvalidTerritory();
    //    }

    if (clanInfos[_clanId].currentlyAttacking) {
      revert CannotChangeCombatantsDuringAttack();
    }

    if (_playerIds.length == 0) {
      revert NoDefenders();
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

      // Check they are not defending a territory
      bool isDefendingATerritory = territories.isDefendingATerritoryOrInAPendingAttack(_clanId, _playerIds[i]);
      if (isDefendingATerritory) {
        revert PlayerDefendingTerritory();
      }

      if (i != _playerIds.length - 1 && _playerIds[i] >= _playerIds[i + 1]) {
        revert PlayerIdsNotSortedOrDuplicates();
      }
    }
  }

  function assignCombatants(
    uint _clanId,
    uint64[] calldata _playerIds,
    uint _leaderPlayerId
  ) external isOwnerOfPlayerAndActive(_leaderPlayerId) isLeaderOfClan(_clanId, _leaderPlayerId) {
    _checkCanAssignCombatants(_clanId, _playerIds);

    for (uint i; i < _playerIds.length; ++i) {
      playerInfos[_playerIds[i]].combatantCooldownTimestamp = uint40(block.timestamp + COMBATANT_COOLDOWN);
    }

    clanInfos[_clanId].playerIds = _playerIds;
    clanInfos[_clanId].assignCombatantsCooldownTimestamp = uint40(
      block.timestamp + MIN_PLAYER_COMBANTANTS_CHANGE_COOLDOWN
    );
    emit AssignCombatants(_clanId, _playerIds, _leaderPlayerId, block.timestamp + COMBATANT_COOLDOWN);
  }

  // This needs to call the oracle VRF on-demand and costs some brush
  function attackVault(
    uint _clanId,
    uint _defendingClanId,
    uint _leaderPlayerId
  ) external isOwnerOfPlayerAndActive(_leaderPlayerId) isLeaderOfClan(_clanId, _leaderPlayerId) {
    // Get all the defenders
    uint64[] memory _playerIds = clanInfos[_clanId].playerIds;

    _checkCanAttackVault(_clanId, _defendingClanId);

    clanInfos[_clanId].currentlyAttacking = true;

    uint64 _nextPendingAttackId = nextPendingAttackId++;

    clanInfos[_clanId].attackingCooldownTimestamp = uint40(block.timestamp + ATTACKING_COOLDOWN);

    uint lowerClanId = _clanId < _defendingClanId ? _clanId : _defendingClanId;
    if (lowerClanId == _clanId) {
      lastClanBattles[lowerClanId][_defendingClanId].lastClanIdAttackOtherClanIdCooldownTimestamp = uint40(
        block.timestamp + MIN_REATTACKING_COOLDOWN
      );
    } else {
      lastClanBattles[lowerClanId][_defendingClanId].lastOtherClanIdAttackClanIdCooldownTimestamp = uint40(
        block.timestamp + MIN_REATTACKING_COOLDOWN
      );
    }

    // In theory this could be done in the fulfill callback, but it's easier to do it here and be consistent witht he player defenders/
    // which are set here to reduce amount of gas used by oracle callback

    pendingAttacks[_nextPendingAttackId] = PendingAttack({
      clanId: uint40(_clanId),
      defendingClanId: uint40(_defendingClanId),
      timestamp: uint40(block.timestamp),
      attackInProgress: true
    });
    uint requestId = _requestRandomWords();
    requestToPendingAttackIds[requestId] = _nextPendingAttackId;

    emit AttackVault(_clanId, _playerIds, _defendingClanId, _leaderPlayerId, requestId, _nextPendingAttackId);
  }

  function fulfillRandomWords(uint _requestId, uint[] memory _randomWords) internal override {
    // TODO: Check if this request id has already been handled

    if (_randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    PendingAttack storage pendingAttack = pendingAttacks[requestToPendingAttackIds[_requestId]];
    uint40 attackingClanId = pendingAttack.clanId;
    uint64[] storage playerIdAttackers = clanInfos[attackingClanId].playerIds;
    uint defendingClanId = pendingAttack.defendingClanId;

    uint64[] storage playerIdDefenders = clanInfos[defendingClanId].playerIds;

    Skill[] memory randomSkills = new Skill[](Math.max(playerIdAttackers.length, playerIdDefenders.length));
    for (uint i; i < randomSkills.length; ++i) {
      randomSkills[i] = comparableSkills[uint8(_randomWords[0] >> (i * 8)) % comparableSkills.length];
    }

    (uint[] memory winners, uint[] memory losers, bool didAttackersWin) = ClanBattleLibrary.doBattle(
      address(players),
      playerIdAttackers,
      playerIdDefenders,
      randomSkills,
      _randomWords[0],
      _randomWords[1]
    );

    uint timestamp = pendingAttack.timestamp;
    pendingAttack.attackInProgress = false;
    clanInfos[attackingClanId].currentlyAttacking = false;

    if (didAttackersWin) {
      // Go through all the defendingData
      for (uint i; i < clanInfos[defendingClanId].defendingData.length; ++i) {
        uint defendingTimestamp = clanInfos[defendingClanId].defendingData[i].timestamp;
        if (defendingTimestamp <= block.timestamp) {
          // This one is safe
          continue;
        }

        // How much to take? 10-15% (TODO)
        uint amount = clanInfos[defendingClanId].defendingData[i].amount;
        uint stealAmount = amount / 10;
        clanInfos[defendingClanId].defendingData[i].amount = uint80(amount - stealAmount);
        clanInfos[defendingClanId].totalBrushLocked -= uint96(stealAmount);

        // Create a new one for the attacking clan
        clanInfos[attackingClanId].defendingData.push(
          DefendingData({timestamp: uint40(block.timestamp + LOCK_PERIOD), amount: uint32(stealAmount)})
        );
        clanInfos[attackingClanId].totalBrushLocked += uint96(stealAmount);
      }
    }

    emit BattleResult(
      _requestId,
      winners,
      losers,
      randomSkills,
      didAttackersWin,
      attackingClanId,
      defendingClanId,
      _randomWords,
      timestamp
    );
  }

  function _checkCanAttackVault(uint _clanId, uint _defendingClanId) private view {
    // Check this clan exists?
    //    if (territories[_territoryId].territoryId != _territoryId) {
    //      revert InvalidTerritory();
    //    }

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

    // Cannot attack same clan within the timeframe (TODO: Unless they have an item?)
    uint lowerClanId = _clanId < _defendingClanId ? _clanId : _defendingClanId;
    if (lowerClanId == _clanId) {
      if (
        lastClanBattles[lowerClanId][_defendingClanId].lastClanIdAttackOtherClanIdCooldownTimestamp > block.timestamp
      ) {
        revert ClanAttackingSameClanCooldown();
      }
    } else {
      if (
        lastClanBattles[lowerClanId][_defendingClanId].lastOtherClanIdAttackClanIdCooldownTimestamp > block.timestamp
      ) {
        revert ClanAttackingSameClanCooldown();
      }
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

  function getClanInfo(uint _clanId) external view returns (ClanInfo memory) {
    return clanInfos[_clanId];
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

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
