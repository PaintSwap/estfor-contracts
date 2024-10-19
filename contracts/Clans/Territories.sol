// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UUPSUpgradeable} from "../ozUpgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "../ozUpgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {RrpRequesterV0Upgradeable} from "../legacy/RrpRequesterV0Upgradeable.sol";
import {IBrushToken} from "../interfaces/IBrushToken.sol";
import {IClans} from "../interfaces/IClans.sol";
import {ITerritories} from "../interfaces/ITerritories.sol";
import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IBank} from "../interfaces/IBank.sol";
import {ISamWitchVRF} from "../interfaces/ISamWitchVRF.sol";

import {LockedBankVaults} from "./LockedBankVaults.sol";
import {AdminAccess} from "../AdminAccess.sol";
import {ItemNFT} from "../ItemNFT.sol";

import {ClanRank, MAX_CLAN_COMBATANTS, CLAN_WARS_GAS_PRICE_WINDOW_SIZE} from "../globals/clans.sol";
import {Item, EquipPosition} from "../globals/players.sol";
import {BoostType, Skill} from "../globals/misc.sol";
import {BattleResultEnum} from "../globals/clans.sol";

import {ClanBattleLibrary} from "./ClanBattleLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";

contract Territories is
  RrpRequesterV0Upgradeable,
  UUPSUpgradeable,
  OwnableUpgradeable,
  ITerritories,
  IClanMemberLeftCB
{
  event AddTerritories(TerritoryInput[] territories);
  event EditTerritories(TerritoryInput[] territories);
  event RemoveTerritories(uint256[] territoryIds);
  event SetMinimumMMRs(uint256[] territoryIds, uint16[] minimumMMRs);
  event AttackTerritory(
    uint256 clanId,
    uint256 territoryId,
    address from,
    uint256 leaderPlayerId,
    uint256 requestId,
    uint256 pendingAttackId,
    uint256 attackingCooldownTimestamp
  );
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
    uint256 territoryId
  );
  event Deposit(uint256 amount);
  event SetComparableSkills(Skill[] skills);
  event ClaimUnoccupiedTerritoryV2(
    uint256 territoryId,
    uint256 clanId,
    address from,
    uint256 leaderPlayerId,
    uint256 requestId
  );
  event AssignCombatants(
    uint256 clanId,
    uint48[] playerIds,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );
  event RemoveCombatant(uint256 playerId, uint256 clanId);
  event Harvest(uint256 territoryId, address from, uint256 playerId, uint256 cooldownTimestamp, uint256 amount);
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

  // Legacy for ABI/old event purposes
  event ClaimUnoccupiedTerritory(
    uint256 territoryId,
    uint256 clanId,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );

  error InvalidTerritory();
  error InvalidTerritoryId();
  error InvalidEmissionPercentage();
  error TransferFailed();
  error NotLeader();
  error ClanAttackingCooldown();
  error NotMemberOfClan();
  error InvalidSkill(Skill skill);
  error LengthMismatch();
  error OnlyClans();
  error OnlyCombatantsHelper();
  error NotOwnerOfPlayerAndActive();
  error HarvestingTooSoon();
  error NotAdminAndBeta();
  error NoCombatants();
  error TooManyCombatants();
  error PlayerDefendingLockedVaults();
  error CannotChangeCombatantsDuringAttack();
  error NoEmissionsToHarvest();
  error CannotAttackWhileStillAttacking();
  error AmountTooLow();
  error ClanCombatantsChangeCooldown();
  error NotEnoughFTM();
  error RequestIdNotKnown();
  error ClanIsBlockingAttacks();
  error NotATerritoryDefenceItem();
  error BlockAttacksCooldown();
  error CannotAttackSelf();
  error CallerNotSamWitchVRF();
  error NotEnoughMMR(uint256 minimumMMR);

  struct TerritoryInput {
    uint16 territoryId;
    uint16 percentageEmissions; // Is multiplied by PERCENTAGE_EMISSION_MUL
  }

  struct Territory {
    uint16 territoryId; // TODO: Could be removed if necessary
    uint16 percentageEmissions; // Is multiplied by PERCENTAGE_EMISSION_MUL
    uint40 clanIdOccupier;
    uint88 unclaimedEmissions;
    uint40 lastClaimTimestamp;
    uint16 minimumMMR;
  }

  struct ClanInfo {
    uint16 ownsTerritoryId;
    uint40 attackingCooldownTimestamp;
    uint40 assignCombatantsCooldownTimestamp;
    bool currentlyAttacking;
    uint88 gasPaid; // TODO remove in migration
    uint40 blockAttacksTimestamp;
    uint8 blockAttacksCooldownHours; // Have many hours after blockAttacksTimestamp there is a cooldown for
    uint48[] playerIds;
  }

  struct PendingAttack {
    uint40 clanId;
    uint16 territoryId;
    bool attackInProgress;
    uint40 leaderPlayerId;
    address from;
  }

  mapping(uint256 pendingAttackId => PendingAttack pendingAttack) private pendingAttacks;
  mapping(bytes32 requestId => uint256 pendingAttackId) public requestToPendingAttackIds;
  mapping(uint256 territoryId => Territory territory) public territories;
  address private players;
  uint16 public nextTerritoryId;
  uint64 public nextPendingAttackId;
  IClans public clans;
  AdminAccess private adminAccess;
  bool private isBeta;
  LockedBankVaults private lockedBankVaults;
  ItemNFT private itemNFT;

  mapping(uint256 clanId => ClanInfo clanInfo) private clanInfos;
  uint16 public totalEmissionPercentage; // Multiplied by PERCENTAGE_EMISSION_MUL
  IBrushToken private brush;

  Skill[] private comparableSkills;

  address private combatantsHelper;

  // These 4 are no longer used
  address public airnode; // The address of the QRNG Airnode
  address public sponsorWallet; // The wallet that will cover the gas costs of the request
  bytes32 public endpointIdUint256; // The endpoint ID for requesting a single random number
  bytes32 public endpointIdUint256Array; // The endpoint ID for requesting an array of random numbers

  uint8 public indexGasPrice;
  uint64 public movingAverageGasPrice;
  uint88 public baseAttackCost; // To offset gas costs in response
  uint24 public expectedGasLimitFulfill;
  uint64[CLAN_WARS_GAS_PRICE_WINDOW_SIZE] private prices;

  address private oracle;
  uint24 private combatantChangeCooldown;
  ISamWitchVRF private samWitchVRF;

  uint256 private constant NUM_WORDS = 3;
  uint256 private constant CALLBACK_GAS_LIMIT = 3_000_000;
  uint256 public constant MAX_DAILY_EMISSIONS = 10000 ether;
  uint256 public constant TERRITORY_ATTACKED_COOLDOWN_PLAYER = 24 * 3600;
  uint256 public constant PERCENTAGE_EMISSION_MUL = 10;
  uint256 public constant HARVESTING_COOLDOWN = 8 hours;

  modifier isOwnerOfPlayerAndActive(uint256 _playerId) {
    if (!IPlayers(players).isOwnerOfPlayerAndActive(_msgSender(), _playerId)) {
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
    TerritoryInput[] calldata _territories,
    address _players,
    IClans _clans,
    IBrushToken _brush,
    LockedBankVaults _lockedBankVaults,
    ItemNFT _itemNFT,
    address _oracle,
    ISamWitchVRF _samWitchVRF,
    Skill[] calldata _comparableSkills,
    AdminAccess _adminAccess,
    bool _isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init();
    players = _players;
    clans = _clans;
    brush = _brush;
    lockedBankVaults = _lockedBankVaults;
    itemNFT = _itemNFT;
    oracle = _oracle;
    samWitchVRF = _samWitchVRF;
    nextTerritoryId = 1;
    nextPendingAttackId = 1;
    adminAccess = _adminAccess;
    isBeta = _isBeta;

    for (uint256 i; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      prices[i] = uint64(tx.gasprice);
    }
    _updateMovingAverageGasPrice(uint64(tx.gasprice));
    setBaseAttackCost(0.01 ether);
    _setExpectedGasLimitFulfill(1_500_000);

    setComparableSkills(_comparableSkills);

    brush.approve(address(_lockedBankVaults), type(uint256).max);
    combatantChangeCooldown = _isBeta ? 5 minutes : 3 days;

    _addTerritories(_territories);
  }

  function assignCombatants(
    uint256 _clanId,
    uint48[] calldata _playerIds,
    uint256 _combatantCooldownTimestamp,
    uint256 _leaderPlayerId
  ) external override onlyCombatantsHelper {
    _checkCanAssignCombatants(_clanId, _playerIds);

    clanInfos[_clanId].playerIds = _playerIds;
    clanInfos[_clanId].assignCombatantsCooldownTimestamp = uint40(block.timestamp + combatantChangeCooldown);
    emit AssignCombatants(_clanId, _playerIds, _msgSender(), _leaderPlayerId, _combatantCooldownTimestamp);
  }

  // This needs to call the oracle VRF on-demand and calls the callback
  function attackTerritory(
    uint256 _clanId,
    uint256 _territoryId,
    uint256 _leaderPlayerId
  ) external payable isOwnerOfPlayerAndActive(_leaderPlayerId) isAtLeastLeaderOfClan(_clanId, _leaderPlayerId) {
    uint256 clanIdOccupier = territories[_territoryId].clanIdOccupier;

    _checkCanAttackTerritory(_clanId, clanIdOccupier, _territoryId);

    // Check they are paying enough
    if (msg.value < attackCost()) {
      revert NotEnoughFTM();
    }

    (bool success, ) = oracle.call{value: msg.value}("");
    if (!success) {
      revert TransferFailed();
    }

    uint64 _nextPendingAttackId = nextPendingAttackId++;
    uint40 attackingCooldownTimestamp = uint40(block.timestamp + TERRITORY_ATTACKED_COOLDOWN_PLAYER);
    ClanInfo storage clanInfo = clanInfos[_clanId];
    clanInfo.attackingCooldownTimestamp = attackingCooldownTimestamp;

    clanInfo.currentlyAttacking = true;

    pendingAttacks[_nextPendingAttackId] = PendingAttack({
      clanId: uint40(_clanId),
      territoryId: uint16(_territoryId),
      attackInProgress: true,
      leaderPlayerId: uint40(_leaderPlayerId),
      from: _msgSender()
    });
    bytes32 requestId = _requestRandomWords();
    requestToPendingAttackIds[requestId] = _nextPendingAttackId;

    emit AttackTerritory(
      _clanId,
      _territoryId,
      _msgSender(),
      _leaderPlayerId,
      uint256(requestId),
      _nextPendingAttackId,
      attackingCooldownTimestamp
    );
  }

  /// @notice Called by the SamWitchVRF contract to fulfill the request
  function fulfillRandomWords(bytes32 _requestId, uint256[] calldata _randomWords) external onlySamWitchVRF {
    if (_randomWords.length != NUM_WORDS) {
      revert LengthMismatch();
    }

    PendingAttack storage pendingAttack = pendingAttacks[requestToPendingAttackIds[_requestId]];
    if (!pendingAttack.attackInProgress) {
      revert RequestIdNotKnown();
    }

    uint256 attackingClanId = pendingAttack.clanId;
    uint16 territoryId = pendingAttack.territoryId;
    uint256 defendingClanId = territories[territoryId].clanIdOccupier;

    _updateAverageGasPrice();
    clanInfos[attackingClanId].currentlyAttacking = false;
    pendingAttack.attackInProgress = false;

    bool clanUnoccupied = defendingClanId == 0;
    if (clanUnoccupied) {
      _claimTerritory(territoryId, attackingClanId);
      emit ClaimUnoccupiedTerritoryV2(
        territoryId,
        attackingClanId,
        pendingAttack.from,
        pendingAttack.leaderPlayerId,
        uint256(_requestId)
      );
      return;
    }

    // If the defenders happened to apply a block attacks item before the attack was fulfilled, then the attack is cancelled
    uint48[] memory attackingPlayerIds;
    uint48[] memory defendingPlayerIds;
    BattleResultEnum[] memory battleResults;
    uint256[] memory attackingRolls;
    uint256[] memory defendingRolls;
    Skill[] memory randomSkills;
    bool didAttackersWin;
    if (clanInfos[defendingClanId].blockAttacksTimestamp <= block.timestamp) {
      attackingPlayerIds = clanInfos[attackingClanId].playerIds;
      defendingPlayerIds = clanInfos[defendingClanId].playerIds;

      randomSkills = new Skill[](Math.max(attackingPlayerIds.length, defendingPlayerIds.length));
      for (uint256 i; i < randomSkills.length; ++i) {
        randomSkills[i] = comparableSkills[uint8(_randomWords[2] >> (i * 8)) % comparableSkills.length];
      }

      (battleResults, attackingRolls, defendingRolls, didAttackersWin) = ClanBattleLibrary.doBattle(
        players,
        attackingPlayerIds,
        defendingPlayerIds,
        randomSkills,
        [_randomWords[0], _randomWords[1]],
        0,
        0
      );
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
      territoryId
    );

    if (didAttackersWin) {
      _claimTerritory(territoryId, attackingClanId);
      // Update old clan
      clanInfos[defendingClanId].ownsTerritoryId = 0;
    }
  }

  function harvest(
    uint256 _territoryId,
    uint256 _playerId
  ) external isOwnerOfPlayerAndActive(_playerId) isClanMember(territories[_territoryId].clanIdOccupier, _playerId) {
    Territory storage territory = territories[_territoryId];
    uint256 unclaimedEmissions = territory.unclaimedEmissions;

    if (territory.lastClaimTimestamp + HARVESTING_COOLDOWN > block.timestamp) {
      revert HarvestingTooSoon();
    }

    territory.lastClaimTimestamp = uint40(block.timestamp);
    territory.unclaimedEmissions = 0;
    if (unclaimedEmissions == 0) {
      revert NoEmissionsToHarvest();
    }

    lockedBankVaults.lockFunds(territory.clanIdOccupier, _msgSender(), _playerId, unclaimedEmissions);
    emit Harvest(_territoryId, _msgSender(), _playerId, block.timestamp + HARVESTING_COOLDOWN, unclaimedEmissions);
  }

  function addUnclaimedEmissions(uint256 _amount) external {
    if (_amount < totalEmissionPercentage) {
      revert AmountTooLow();
    }

    for (uint256 i = 1; i < nextTerritoryId; ++i) {
      territories[i].unclaimedEmissions += uint88(
        (_amount * territories[i].percentageEmissions) / totalEmissionPercentage
      );
    }

    if (!brush.transferFrom(_msgSender(), address(this), _amount)) {
      revert TransferFailed();
    }
    emit Deposit(_amount);
  }

  function blockAttacks(
    uint256 _clanId,
    uint16 _itemTokenId,
    uint256 _playerId
  ) external isOwnerOfPlayerAndActive(_playerId) isClanMember(_clanId, _playerId) {
    Item memory item = itemNFT.getItem(_itemTokenId);
    if (item.equipPosition != EquipPosition.TERRITORY || item.boostType != BoostType.PVP_BLOCK) {
      revert NotATerritoryDefenceItem();
    }

    if (
      (clanInfos[_clanId].blockAttacksTimestamp + uint256(clanInfos[_clanId].blockAttacksCooldownHours) * 3600) >
      block.timestamp
    ) {
      revert BlockAttacksCooldown();
    }

    uint256 blockAttacksTimestamp = block.timestamp + item.boostDuration;
    clanInfos[_clanId].blockAttacksTimestamp = uint40(blockAttacksTimestamp);
    clanInfos[_clanId].blockAttacksCooldownHours = uint8(item.boostValue);

    itemNFT.burn(_msgSender(), _itemTokenId, 1);

    emit BlockingAttacks(
      _clanId,
      _itemTokenId,
      _msgSender(),
      _playerId,
      blockAttacksTimestamp,
      blockAttacksTimestamp + uint256(item.boostValue) * 3600
    );
  }

  function clanMemberLeft(uint256 _clanId, uint256 _playerId) external override onlyClans {
    // Remove a player combatant if they are currently assigned in this clan
    ClanInfo storage clanInfo = clanInfos[_clanId];
    if (clanInfo.playerIds.length != 0) {
      uint256 searchIndex = EstforLibrary._binarySearch(clanInfo.playerIds, _playerId);
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

  function _updateAverageGasPrice() private {
    uint256 sum = 0;
    prices[indexGasPrice] = uint64(tx.gasprice);
    indexGasPrice = uint8((indexGasPrice + 1) % CLAN_WARS_GAS_PRICE_WINDOW_SIZE);

    for (uint256 i = 0; i < CLAN_WARS_GAS_PRICE_WINDOW_SIZE; ++i) {
      sum += prices[i];
    }

    _updateMovingAverageGasPrice(uint64(sum / CLAN_WARS_GAS_PRICE_WINDOW_SIZE));
  }

  function _checkCanAssignCombatants(uint256 _clanId, uint48[] calldata _playerIds) private view {
    if (_playerIds.length > MAX_CLAN_COMBATANTS) {
      revert TooManyCombatants();
    }

    // Can only change combatants every so often
    if (clanInfos[_clanId].assignCombatantsCooldownTimestamp > block.timestamp) {
      revert ClanCombatantsChangeCooldown();
    }
  }

  function _checkCanAttackTerritory(uint256 _clanId, uint256 _defendingClanId, uint256 _territoryId) private view {
    if (_clanId == _defendingClanId) {
      revert CannotAttackSelf();
    }

    Territory storage territory = territories[_territoryId];
    if (territory.territoryId != _territoryId) {
      revert InvalidTerritory();
    }

    if (territory.minimumMMR > clans.getMMR(_clanId)) {
      revert NotEnoughMMR(territory.minimumMMR);
    }

    ClanInfo storage clanInfo = clanInfos[_clanId];
    // Must have at least 1 combatant
    if (clanInfo.playerIds.length == 0) {
      revert NoCombatants();
    }

    if (clanInfo.currentlyAttacking) {
      revert CannotChangeCombatantsDuringAttack();
    }

    if (clanInfo.attackingCooldownTimestamp > block.timestamp) {
      revert ClanAttackingCooldown();
    }

    if (clanInfos[_defendingClanId].blockAttacksTimestamp > block.timestamp) {
      revert ClanIsBlockingAttacks();
    }

    if (clanInfo.currentlyAttacking) {
      revert CannotAttackWhileStillAttacking();
    }
  }

  function _requestRandomWords() private returns (bytes32 requestId) {
    requestId = samWitchVRF.requestRandomWords(NUM_WORDS, CALLBACK_GAS_LIMIT);
  }

  function _updateMovingAverageGasPrice(uint64 _movingAverageGasPrice) private {
    movingAverageGasPrice = _movingAverageGasPrice;
    emit UpdateMovingAverageGasPrice(_movingAverageGasPrice);
  }

  function _claimTerritory(uint256 _territoryId, uint256 _attackingClanId) private {
    territories[_territoryId].clanIdOccupier = uint32(_attackingClanId);

    if (clanInfos[_attackingClanId].ownsTerritoryId != 0) {
      // This clan already owns a territory, so unclaim that one
      territories[clanInfos[_attackingClanId].ownsTerritoryId].clanIdOccupier = 0;
    }

    clanInfos[_attackingClanId].ownsTerritoryId = uint16(_territoryId);
  }

  function _checkTerritory(TerritoryInput calldata _territory) private pure {
    if (_territory.territoryId == 0 || _territory.percentageEmissions == 0) {
      revert InvalidTerritory();
    }
  }

  function _addTerritories(TerritoryInput[] calldata _territories) private {
    uint256 _totalEmissionPercentage = totalEmissionPercentage;
    uint256 _nextTerritoryId = nextTerritoryId;
    for (uint256 i; i < _territories.length; ++i) {
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
        lastClaimTimestamp: 0,
        minimumMMR: 0
      });
      _totalEmissionPercentage += territoryInput.percentageEmissions;
    }

    nextTerritoryId = uint16(_nextTerritoryId + _territories.length);

    if (_totalEmissionPercentage > 100 * PERCENTAGE_EMISSION_MUL) {
      revert InvalidEmissionPercentage();
    }

    totalEmissionPercentage = uint16(_totalEmissionPercentage);
    emit AddTerritories(_territories);
  }

  function _setExpectedGasLimitFulfill(uint24 _expectedGasLimitFulfill) private {
    expectedGasLimitFulfill = _expectedGasLimitFulfill;
    emit SetExpectedGasLimitFulfill(_expectedGasLimitFulfill);
  }

  function attackCost() public view returns (uint256) {
    return baseAttackCost + (movingAverageGasPrice * expectedGasLimitFulfill);
  }

  function getTerrorities() external view returns (Territory[] memory) {
    Territory[] memory _territories = new Territory[](nextTerritoryId - 1);
    for (uint256 i; i < _territories.length; ++i) {
      _territories[i] = territories[i + 1];
    }
    return _territories;
  }

  function getClanInfo(uint256 _clanId) external view returns (ClanInfo memory clanInfo) {
    return clanInfos[_clanId];
  }

  function getPendingAttack(uint256 _pendingAttackId) external view returns (PendingAttack memory pendingAttack) {
    return pendingAttacks[_pendingAttackId];
  }

  function isCombatant(uint256 _clanId, uint256 _playerId) external view override returns (bool combatant) {
    // Check if this player is in the defenders list and remove them if so
    if (clanInfos[_clanId].playerIds.length != 0) {
      uint256 searchIndex = EstforLibrary._binarySearch(clanInfos[_clanId].playerIds, _playerId);
      combatant = searchIndex != type(uint256).max;
    }
  }

  function addTerritories(TerritoryInput[] calldata _territories) external onlyOwner {
    _addTerritories(_territories);
  }

  function editTerritories(TerritoryInput[] calldata _territories) external onlyOwner {
    uint256 _totalEmissionPercentage = totalEmissionPercentage;
    for (uint256 i; i < _territories.length; ++i) {
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

  function removeTerritories(uint256[] calldata _territoryIds) external onlyOwner {
    uint256 _totalEmissionPercentage = totalEmissionPercentage;
    for (uint256 i; i < _territoryIds.length; ++i) {
      if (territories[_territoryIds[i]].territoryId == 0) {
        revert InvalidTerritoryId();
      }

      _totalEmissionPercentage -= territories[_territoryIds[i]].percentageEmissions;
      delete territories[_territoryIds[i]];
    }

    totalEmissionPercentage = uint16(_totalEmissionPercentage);
    emit RemoveTerritories(_territoryIds);
  }

  function setMinimumMMRs(uint256[] calldata _territoryIds, uint16[] calldata _minimumMMRs) external onlyOwner {
    if (_territoryIds.length != _minimumMMRs.length) {
      revert LengthMismatch();
    }

    for (uint256 i; i < _territoryIds.length; ++i) {
      territories[_territoryIds[i]].minimumMMR = _minimumMMRs[i];
    }
    emit SetMinimumMMRs(_territoryIds, _minimumMMRs); // TODO: Currently not used elsewhere
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

  function setCombatantsHelper(address _combatantsHelper) external onlyOwner {
    combatantsHelper = _combatantsHelper;
  }

  function setBaseAttackCost(uint88 _baseAttackCost) public onlyOwner {
    baseAttackCost = _baseAttackCost;
    emit SetBaseAttackCost(_baseAttackCost);
  }

  function setExpectedGasLimitFulfill(uint24 _expectedGasLimitFulfill) public onlyOwner {
    _setExpectedGasLimitFulfill(_expectedGasLimitFulfill);
  }

  function clearCooldowns(uint256 _clanId) external isAdminAndBeta {
    ClanInfo storage clanInfo = clanInfos[_clanId];
    clanInfo.attackingCooldownTimestamp = 0;
    clanInfo.assignCombatantsCooldownTimestamp = 0;
    clanInfo.blockAttacksTimestamp = 0;
    clanInfo.blockAttacksCooldownHours = 0;
  }

  // Useful to re-run a battle for testing
  function setAttackInProgress(uint256 _requestId) external isAdminAndBeta {
    pendingAttacks[requestToPendingAttackIds[bytes32(_requestId)]].attackInProgress = true;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
