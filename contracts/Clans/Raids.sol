// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {ItemNFT} from "../ItemNFT.sol";
import {VRFRequestInfo} from "../VRFRequestInfo.sol";

import {IClanMemberLeftCB} from "../interfaces/IClanMemberLeftCB.sol";
import {ICombatants} from "../interfaces/ICombatants.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IWorld} from "../interfaces/IWorld.sol";
import {ISamWitchVRF} from "../interfaces/ISamWitchVRF.sol";
import {IClans} from "../interfaces/IClans.sol";
import {IBankFactory} from "../interfaces/IBankFactory.sol";
import {IBrushToken} from "../interfaces/external/IBrushToken.sol";

import {SkillLibrary} from "../libraries/SkillLibrary.sol";
import {EstforLibrary} from "../EstforLibrary.sol";
import {PlayersLibrary} from "../Players/PlayersLibrary.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

// Randomly spawn raid monsters and bosses
// Colonel can decide to fight in raids
// Spawning needs calling manually (every 8 hours or w.e it is set to)
// 1-3 Random spawn with different stats, you can pick one to kill. Loot is given based on total rolls of the monster?
contract Raids is UUPSUpgradeable, OwnableUpgradeable, ICombatants, IClanMemberLeftCB {
  using SkillLibrary for uint8;
  using SkillLibrary for Skill;

  event AssignCombatants(
    uint256 clanId,
    uint64[] playerIds,
    address from,
    uint256 leaderPlayerId,
    uint256 cooldownTimestamp
  );
  event RequestFightRaid(uint256 playerId, uint56 clanId, uint256 raidId, uint256 requestId);
  event SetExpectedGasLimitFulfill(uint256 expectedGasLimitFulfill);
  event SetSpawnRaidCooldown(uint256 spawnRaidCooldown);
  event SpawnRaid(uint256 playerId, uint256 requestId);
  event AddBaseRaids(uint256[] baseRaidIds, BaseRaid[] baseRaids);
  event EditBaseRaids(uint256[] baseRaidIds, BaseRaid[] baseRaids);
  event RemoveCombatant(uint256 playerId, uint256 clanId);
  event NewRaidsSpawned(uint40 raidId, RaidInfo[] raidInfos);
  event RaidBattleOutcome(
    uint256 clanId,
    uint256 raidId,
    uint256 requestId,
    uint256 regenerateId,
    uint256 regenerateAmountUsed,
    uint16[] choiceIds,
    uint256 bossChoiceId,
    bool defeatedRaid,
    uint256[] lootTokenIds,
    uint256[] lootTokenAmounts
  );
  event SetPreventRaids(bool preventRaids);
  event SetMaxClanCombatants(uint256 maxClanCombatants);
  event SetCombatActions(uint16[] combatActionIds);

  error NotOwnerOfPlayerAndActive();
  error RequestDoesNotExist();
  error CallerNotSamWitchVRF();
  error RankNotHighEnough();
  error RaidInProgress();
  error LengthMismatch();
  error OnlyCombatantsHelper();
  error OnlyClans();
  error PreviousRaidNotSpawnedYet();
  error TooManyCombatants();
  error ClanCombatantsChangeCooldown();
  error RaidAlreadyExists();
  error RaidDoesNotExist();
  error NotInRange();
  error RaidsPrevented();
  error NoCombatants();

  struct BaseRaid {
    uint8 tier;
    // Boss stats
    int16 minHealth;
    int16 maxHealth;
    int16 minMeleeAttack;
    int16 maxMeleeAttack;
    int16 minMagicAttack;
    int16 maxMagicAttack;
    int16 minRangedAttack;
    int16 maxRangedAttack;
    int16 minMeleeDefence;
    int16 maxMeleeDefence;
    int16 minMagicDefence;
    int16 maxMagicDefence;
    int16 minRangedDefence;
    int16 maxRangedDefence;
    uint16[16] randomLootTokenIds; // 1 slot
    uint32[16] randomLootTokenAmounts; // 2 slots
    uint16[16] randomChances; // 1 slot
  }

  struct ClanInfo {
    IBank bank;
    uint40 attackingCooldownTimestamp;
    uint40 assignCombatantsCooldownTimestamp;
    bool currentlyAttacking;
    uint64[] playerIds;
    uint96 totalBrushClaimable; // TODO Needed?
  }

  struct RaidInfo {
    uint16 baseRaidId;
    int16 health;
    int16 meleeAttack;
    int16 magicAttack;
    int16 rangedAttack;
    int16 meleeDefence;
    int16 magicDefence;
    int16 rangedDefence;
    uint8 tier;
    uint16[5] combatActionIds;
  }

  struct PendingRaidAttack {
    uint40 clanId;
    uint40 raidId;
    uint16 regenerateId; // Food from the bank to use for the current combat
  }

  uint256 private constant NUM_WORDS = 3;
  uint256 private constant CALLBACK_GAS_LIMIT_SPAWN = 500_000;

  uint40 private _nextRaidId;
  uint40 private _currentRaidExpireTime;
  uint256 private _raidSpawnRequestId;
  IPlayers private _players;
  IClans private _clans;
  bool private _preventRaids;
  VRFRequestInfo _vrfRequestInfo;
  address private _oracle;
  ItemNFT private _itemNFT;
  ISamWitchVRF private _samWitchVRF;
  uint24 private _expectedGasLimitFulfill;
  uint16 private _maxBaseRaidId;
  address private _combatantsHelper;
  uint24 private _combatantChangeCooldown;
  uint8 private _maxClanCombatants;
  uint24 private _spawnRaidCooldown;
  IBankFactory private _bankFactory;
  IBrushToken private _brush;
  IWorld private _world;

  uint16[] private _combatActionIds; // Small monsters that might spawn
  mapping(uint256 clanId => ClanInfo clanInfo) private _clanInfos;
  mapping(uint256 baseRaidId => BaseRaid baseRaid) private _baseRaids;
  mapping(uint256 raidId => RaidInfo) private _raidInfos;
  mapping(bytes32 requestId => PendingRaidAttack pendingRaidAttack) private _requestIdToPendingRaidAttack;

  modifier isOwnerOfPlayerAndActive(uint256 playerId) {
    require(_players.isOwnerOfPlayerAndActive(_msgSender(), playerId), NotOwnerOfPlayerAndActive());
    _;
  }

  modifier isMinimumRank(uint256 clanId, uint256 playerId, ClanRank clanRank) {
    require(_clans.getRank(clanId, playerId) >= clanRank, RankNotHighEnough());
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

  modifier onlyClans() {
    require(_msgSender() == address(_clans), OnlyClans());
    _;
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    IPlayers players,
    ItemNFT itemNFT,
    IClans clans,
    address oracle,
    ISamWitchVRF samWitchVRF,
    VRFRequestInfo vrfRequestInfo,
    uint24 spawnRaidCooldown,
    IBrushToken brush,
    IWorld world,
    uint8 maxClanCombatants,
    uint16[] calldata combatActionIds,
    bool isBeta
  ) external initializer {
    __UUPSUpgradeable_init();
    __Ownable_init(_msgSender());

    _players = players;
    _itemNFT = itemNFT;
    _clans = clans;
    _oracle = oracle;
    _brush = brush;
    _samWitchVRF = samWitchVRF;
    _vrfRequestInfo = vrfRequestInfo;
    _combatantChangeCooldown = isBeta ? 5 minutes : 3 days;
    _world = world;
    _nextRaidId = 1;
    setMaxClanCombatants(maxClanCombatants);
    setSpawnRaidCooldown(spawnRaidCooldown);
    setExpectedGasLimitFulfill(2_000_000);
    setCombatActions(combatActionIds);
  }

  function spawnRaid(uint64 playerId) external isOwnerOfPlayerAndActive(playerId) {
    // Spawn a random monster
    // Must be after the last raid is finished
    require(_raidSpawnRequestId == 0, PreviousRaidNotSpawnedYet());
    require(_currentRaidExpireTime <= block.timestamp, RaidInProgress());
    require(!_preventRaids, RaidsPrevented());

    _raidSpawnRequestId = uint256(_samWitchVRF.requestRandomWords(NUM_WORDS, CALLBACK_GAS_LIMIT_SPAWN));
    _currentRaidExpireTime = uint40(block.timestamp + _spawnRaidCooldown);

    emit SpawnRaid(playerId, _raidSpawnRequestId);
  }

  function fightRaid(
    uint64 playerId,
    uint40 clanId,
    uint40 raidId,
    uint16 regenerateId
  ) external isOwnerOfPlayerAndActive(playerId) isMinimumRank(clanId, playerId, ClanRank.COLONEL) {
    require(!_preventRaids, RaidsPrevented());
    uint256 playerLength = _clanInfos[clanId].playerIds.length;
    require(playerLength != 0, NoCombatants());
    address bankAddress = address(_clanInfos[clanId].bank);
    if (bankAddress == address(0)) {
      bankAddress = _bankFactory.getBankAddress(clanId);
      _clanInfos[clanId].bank = IBank(bankAddress);
    }

    // Requires raid passes taken from the bank
    _itemNFT.burn(bankAddress, RAID_PASS, playerLength);

    uint40 currentRaid = _nextRaidId;
    require(raidId < currentRaid && raidId >= currentRaid - NUM_WORDS, RaidDoesNotExist());

    bytes32 requestId = _samWitchVRF.requestRandomWords(NUM_WORDS, _expectedGasLimitFulfill);
    _requestIdToPendingRaidAttack[requestId].raidId = raidId;
    _requestIdToPendingRaidAttack[requestId].clanId = clanId;
    _requestIdToPendingRaidAttack[requestId].regenerateId = regenerateId;
    emit RequestFightRaid(playerId, clanId, raidId, uint256(requestId));
  }

  /// @notice Called by the SamWitchVRF contract to fulfill the request
  function fulfillRandomWords(bytes32 requestId, uint256[] calldata randomWords) external onlySamWitchVRF {
    require(randomWords.length == NUM_WORDS, LengthMismatch());

    if (_raidSpawnRequestId == uint256(requestId)) {
      uint40 currentRaidId = _nextRaidId;

      // Spawn A few raid monsters
      RaidInfo[] memory raidInfos = new RaidInfo[](NUM_WORDS);
      uint16 maxBaseRaidId = _maxBaseRaidId;
      for (uint256 i; i < NUM_WORDS; ++i) {
        // Spawn a raid monster (first 2 bytes for the base raid id)
        uint256 randomWord = randomWords[i];
        uint16 baseRaidId = uint16(randomWord % maxBaseRaidId) + 1;
        BaseRaid storage baseRaid = _baseRaids[baseRaidId];

        uint256 combatActionIdsLength = _combatActionIds.length;
        uint16[5] memory combatActionIds = [
          EstforLibrary._getRandomFromArray16(randomWord, 128, _combatActionIds, combatActionIdsLength),
          EstforLibrary._getRandomFromArray16(randomWord, 144, _combatActionIds, combatActionIdsLength),
          EstforLibrary._getRandomFromArray16(randomWord, 160, _combatActionIds, combatActionIdsLength),
          EstforLibrary._getRandomFromArray16(randomWord, 176, _combatActionIds, combatActionIdsLength),
          EstforLibrary._getRandomFromArray16(randomWord, 192, _combatActionIds, combatActionIdsLength)
        ];

        RaidInfo memory raidInfo = RaidInfo({
          baseRaidId: baseRaidId,
          health: EstforLibrary._getRandomInRange16(randomWord, 16, baseRaid.minHealth, baseRaid.maxHealth),
          meleeAttack: EstforLibrary._getRandomInRange16(
            randomWord,
            32,
            baseRaid.minMeleeAttack,
            baseRaid.maxMeleeAttack
          ),
          magicAttack: EstforLibrary._getRandomInRange16(
            randomWord,
            48,
            baseRaid.minMagicAttack,
            baseRaid.maxMagicAttack
          ),
          rangedAttack: EstforLibrary._getRandomInRange16(
            randomWord,
            64,
            baseRaid.minRangedAttack,
            baseRaid.maxRangedAttack
          ),
          meleeDefence: EstforLibrary._getRandomInRange16(
            randomWord,
            80,
            baseRaid.minMeleeDefence,
            baseRaid.maxMeleeDefence
          ),
          magicDefence: EstforLibrary._getRandomInRange16(
            randomWord,
            96,
            baseRaid.minMagicDefence,
            baseRaid.maxMagicDefence
          ),
          rangedDefence: EstforLibrary._getRandomInRange16(
            randomWord,
            112,
            baseRaid.minRangedDefence,
            baseRaid.maxRangedDefence
          ),
          combatActionIds: combatActionIds,
          tier: baseRaid.tier
        });

        _raidInfos[uint40(currentRaidId + i)] = raidInfo;
        raidInfos[i] = raidInfo;
      }

      _nextRaidId = uint40(currentRaidId + NUM_WORDS);

      delete _raidSpawnRequestId;
      emit NewRaidsSpawned(currentRaidId, raidInfos); // These raids are spawned for everyone
    } else {
      // Actually doing the raid
      uint256 clanId = _requestIdToPendingRaidAttack[requestId].clanId;
      require(clanId != 0, RequestDoesNotExist());

      uint256 raidId = _requestIdToPendingRaidAttack[requestId].raidId;

      uint256 randomWord = randomWords[0];

      // Food to use
      uint16 regenerateId = _requestIdToPendingRaidAttack[requestId].regenerateId;

      uint256 lootLength;
      bool defeatedRaid = true;

      address bank = address(_clanInfos[clanId].bank);
      uint256 elapsedTime = 7 hours; // of combat with the small monsters

      CombatStats memory combatStats; // All combatants
      ClanInfo storage clanInfo = _clanInfos[clanId];
      uint64[] memory playerIds = clanInfo.playerIds;
      for (uint256 i; i < playerIds.length; ++i) {
        uint64 playerId = playerIds[i];
        combatStats.health += int16(int256(_players.getLevel(playerId, Skill.HEALTH)));
        combatStats.meleeAttack += int16(int256(_players.getLevel(playerId, Skill.MELEE)));
        combatStats.magicAttack += int16(int256(_players.getLevel(playerId, Skill.MAGIC)));
        combatStats.rangedAttack += int16(int256(_players.getLevel(playerId, Skill.RANGED)));
        int16 defence = int16(int256(_players.getLevel(playerId, Skill.DEFENCE)));
        combatStats.meleeDefence += defence;
        combatStats.magicDefence += defence;
        combatStats.rangedDefence += defence;
      }

      PendingQueuedActionEquipmentState[] memory pendingQueuedActionEquipmentStates;

      (uint8 alphaCombat, uint8 betaCombat, uint8 alphaCombatHealing) = _players.getAlphaCombatParams();

      // Pick a random actionChoice, if you aren't high enough you don't count
      // Pick a random one of these
      uint16[3] memory actionChoiceIds = [
        ACTIONCHOICE_MELEE_BASIC_SWORD,
        ACTIONCHOICE_RANGED_BASIC_BOW,
        ACTIONCHOICE_MAGIC_SHADOW_BLAST
      ];

      RaidInfo storage raidInfo = _raidInfos[raidId];
      uint16[5] memory combatActionIds = raidInfo.combatActionIds;
      uint256 numRaidBossRolls = 32;
      uint256 maxLootLength = MAX_GUARANTEED_REWARDS_PER_ACTION * combatActionIds.length + numRaidBossRolls;

      uint256[] memory lootTokenIds = new uint256[](maxLootLength);
      uint256[] memory lootTokenAmounts = new uint256[](maxLootLength);

      uint256 totalFoodConsumed;
      uint256 choiceIdsLength = combatActionIds.length;
      uint16[] memory choiceIds = new uint16[](choiceIdsLength);
      uint16 bossChoiceId;
      for (uint256 i = 0; i < choiceIdsLength; ++i) {
        // Random actionChoiceIds
        uint16 actionId = combatActionIds[i];
        uint16 choiceId = EstforLibrary._getRandomFrom3ElementArray16(randomWord, i * 16, actionChoiceIds);
        choiceIds[i] = choiceId;

        CombatStats memory enemyCombatStats = _world.getCombatStats(actionId);
        ActionChoice memory actionChoice = _world.getActionChoice(NONE, choiceId);

        (ActionRewards memory actionRewards, Skill actionSkill, uint256 numSpawnedPerHour, ) = _world.getRewardsHelper(
          actionId
        );

        numSpawnedPerHour *= 5 ** raidInfo.tier; // 5, 25, 125

        // Fight the smaller monsters
        (
          uint256 xpElapsedTime,
          uint256 combatElapsedTime,
          uint16 baseInputItemsConsumedNum,
          uint16 foodConsumed,
          bool died
        ) = PlayersLibrary._determineBattleOutcome(
            bank,
            address(_itemNFT),
            elapsedTime,
            actionChoice,
            regenerateId,
            numSpawnedPerHour,
            combatStats,
            enemyCombatStats,
            alphaCombat,
            betaCombat,
            alphaCombatHealing,
            pendingQueuedActionEquipmentStates
          );

        totalFoodConsumed += foodConsumed;

        if (died) {
          defeatedRaid = false;
          break;
        }

        bool isCombat = true; //
        uint16 monstersKilled = uint16((numSpawnedPerHour * xpElapsedTime) / (SPAWN_MUL * 3600));
        uint8 successPercent = 100;
        (uint256[] memory newIds, uint256[] memory newAmounts) = _getGuaranteedRewards(
          xpElapsedTime,
          actionRewards,
          monstersKilled,
          isCombat,
          successPercent
        );

        for (uint256 j = 0; j < newIds.length; ++j) {
          lootTokenIds[lootLength] = newIds[j];
          lootTokenAmounts[lootLength++] = newAmounts[j];
        }
      }

      if (defeatedRaid) {
        // Now do raid boss battle
        uint256 numSpawnedPerHour = 1 * SPAWN_MUL; // 1 per hour
        bossChoiceId = EstforLibrary._getRandomFrom3ElementArray16(randomWord, 0, actionChoiceIds);

        CombatStats memory enemyCombatStats = CombatStats({
          health: raidInfo.health,
          meleeAttack: raidInfo.meleeAttack,
          magicAttack: raidInfo.magicAttack,
          rangedAttack: raidInfo.rangedAttack,
          meleeDefence: raidInfo.meleeDefence,
          magicDefence: raidInfo.magicDefence,
          rangedDefence: raidInfo.rangedDefence
        });

        uint256 elapsedTimeBoss = 1 hours; // of combat
        ActionChoice memory actionChoice = _world.getActionChoice(NONE, bossChoiceId);
        // Fight the raid boss (must kill within 1 hour)
        (
          uint256 xpElapsedTime,
          uint256 combatElapsedTime,
          uint16 baseInputItemsConsumedNum,
          uint16 foodConsumed,
          bool died
        ) = PlayersLibrary._determineBattleOutcome(
            bank,
            address(_itemNFT),
            elapsedTimeBoss,
            actionChoice,
            regenerateId,
            numSpawnedPerHour,
            combatStats,
            enemyCombatStats,
            alphaCombat,
            betaCombat,
            alphaCombatHealing,
            pendingQueuedActionEquipmentStates
          );

        totalFoodConsumed += foodConsumed;
        defeatedRaid = !died;
        if (defeatedRaid) {
          uint16 raidBossesKilled = uint16((numSpawnedPerHour * xpElapsedTime) / (SPAWN_MUL * 3600));
          defeatedRaid = !died && raidBossesKilled == 1;
          if (defeatedRaid) {
            // Give 32 rolls for the raid boss and get the random rewards
            BaseRaid storage baseRaid = _baseRaids[raidInfo.baseRaidId];
            uint256 numWords = numRaidBossRolls / 16; // 16 per word
            uint256 length = baseRaid.randomLootTokenIds.length;
            bytes memory randomBytes = abi.encodePacked(randomWords[1:1 + numWords]); // we use randomWords[0] above already
            for (uint256 i; i < numRaidBossRolls; ++i) {
              uint16 rand = _getSlice(randomBytes, i);
              uint16 itemTokenId;
              uint32 amount;
              uint16[16] memory randomLootTokenIds = baseRaid.randomLootTokenIds;
              uint32[16] memory randomLootTokenAmounts = baseRaid.randomLootTokenAmounts;
              uint16[16] memory randomChances = baseRaid.randomChances;
              for (uint256 j; j < length; ++j) {
                if (rand > randomChances[j]) {
                  break;
                }
                itemTokenId = randomLootTokenIds[j];
                amount = randomLootTokenAmounts[j];
              }

              lootTokenIds[lootLength] = itemTokenId;
              lootTokenAmounts[lootLength++] = amount;
            }
          }
        }
      }

      defeatedRaid = defeatedRaid && _itemNFT.balanceOf(bank, regenerateId) >= totalFoodConsumed;

      if (!defeatedRaid) {
        lootLength = 0;
      } else {
        // If they don't have enough in the bank then use the maximum possible
        totalFoodConsumed = Math.min(totalFoodConsumed, _itemNFT.balanceOf(bank, regenerateId));
      }

      assembly ("memory-safe") {
        mstore(lootTokenIds, lootLength)
        mstore(lootTokenAmounts, lootLength)
      }

      if (totalFoodConsumed != 0) {
        _itemNFT.burn(bank, regenerateId, totalFoodConsumed);
      }

      // Mint to the bank
      if (lootTokenIds.length != 0) {
        IBank(bank).setAllowBreachedCapacity(true);
        _itemNFT.mintBatch(bank, lootTokenIds, lootTokenAmounts);
        IBank(bank).setAllowBreachedCapacity(false);
      }

      emit RaidBattleOutcome(
        clanId,
        _requestIdToPendingRaidAttack[requestId].raidId,
        uint256(requestId),
        regenerateId,
        totalFoodConsumed,
        choiceIds,
        bossChoiceId,
        defeatedRaid,
        lootTokenIds,
        lootTokenAmounts
      );
    }
  }

  function _getSlice(bytes memory b, uint256 index) private pure returns (uint16) {
    uint256 key = index * 2;
    return uint16(b[key] | (bytes2(b[key + 1]) >> 8));
  }

  function _getGuaranteedRewards(
    uint256 xpElapsedTime,
    ActionRewards memory actionRewards,
    uint16 monstersKilled,
    bool isCombat,
    uint8 successPercent
  ) private pure returns (uint256[] memory ids, uint256[] memory amounts) {
    ids = new uint256[](MAX_GUARANTEED_REWARDS_PER_ACTION);
    amounts = new uint256[](MAX_GUARANTEED_REWARDS_PER_ACTION);

    uint256 length = PlayersLibrary._appendGuaranteedRewards(
      ids,
      amounts,
      xpElapsedTime,
      actionRewards,
      monstersKilled,
      isCombat,
      successPercent
    );

    assembly ("memory-safe") {
      mstore(ids, length)
      mstore(amounts, length)
    }
  }

  function assignCombatants(
    uint256 clanId,
    uint64[] calldata playerIds,
    uint256 combatantCooldownTimestamp,
    uint256 leaderPlayerId
  ) external override onlyCombatantsHelper {
    _checkCanAssignCombatants(clanId, playerIds);

    _clanInfos[clanId].playerIds = playerIds;
    _clanInfos[clanId].assignCombatantsCooldownTimestamp = uint40(block.timestamp + _combatantChangeCooldown);
    emit AssignCombatants(clanId, playerIds, _msgSender(), leaderPlayerId, combatantCooldownTimestamp);
  }

  function _checkCanAssignCombatants(uint256 clanId, uint64[] calldata playerIds) private view {
    require(playerIds.length <= _maxClanCombatants, TooManyCombatants());
    // Can only change combatants every so often
    require(_clanInfos[clanId].assignCombatantsCooldownTimestamp <= block.timestamp, ClanCombatantsChangeCooldown());
  }

  function clanMemberLeft(uint256 clanId, uint256 playerId) external override onlyClans {
    // Remove a player combatant if they are currently assigned in this clan
    ClanInfo storage clanInfo = _clanInfos[clanId];
    if (clanInfo.playerIds.length != 0) {
      uint256 searchIndex = EstforLibrary._binarySearch(clanInfo.playerIds, playerId);
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

  function _setRaid(BaseRaid calldata baseRaid, uint256 baseId) private {
    require(
      baseRaid.randomLootTokenIds.length == baseRaid.randomLootTokenAmounts.length &&
        baseRaid.randomLootTokenIds.length == baseRaid.randomChances.length,
      LengthMismatch()
    );
    require(baseRaid.minHealth > 0 && baseRaid.minHealth <= baseRaid.maxHealth, NotInRange());
    require(baseRaid.minMeleeAttack <= baseRaid.maxMeleeAttack, NotInRange());
    require(baseRaid.minMagicAttack <= baseRaid.maxMagicAttack, NotInRange());
    require(baseRaid.minRangedAttack <= baseRaid.maxRangedAttack, NotInRange());
    require(baseRaid.minMeleeDefence <= baseRaid.maxMeleeDefence, NotInRange());
    require(baseRaid.minMagicDefence <= baseRaid.maxMagicDefence, NotInRange());
    require(baseRaid.minRangedDefence <= baseRaid.maxRangedDefence, NotInRange());
    _baseRaids[baseId] = baseRaid;
  }

  function _checkBaseRaid(BaseRaid calldata baseRaid, uint256 id) private pure {}

  function _baseRaidExists(uint256 baseId) private view returns (bool) {
    return _baseRaids[baseId].minHealth != 0;
  }

  function isCombatant(uint256 clanId, uint256 playerId) external view override returns (bool) {
    uint64[] storage playerIds = _clanInfos[clanId].playerIds;
    if (playerIds.length == 0) {
      return false;
    }

    uint256 searchIndex = EstforLibrary._binarySearch(playerIds, playerId);
    return searchIndex != type(uint256).max;
  }

  function getRaidInfo(uint256 raidId) external view returns (RaidInfo memory) {
    return _raidInfos[raidId];
  }

  function setExpectedGasLimitFulfill(uint24 expectedGasLimitFulfill) public onlyOwner {
    _expectedGasLimitFulfill = expectedGasLimitFulfill;
    emit SetExpectedGasLimitFulfill(expectedGasLimitFulfill);
  }

  function addBaseRaids(uint256[] calldata baseRaidIds, BaseRaid[] calldata baseRaids) external onlyOwner {
    require(baseRaids.length == baseRaidIds.length, LengthMismatch());
    for (uint256 i; i < baseRaids.length; ++i) {
      BaseRaid calldata baseRaid = baseRaids[i];
      uint256 baseRaidId = baseRaidIds[i];
      require(!_baseRaidExists(baseRaidId), RaidAlreadyExists());
      _setRaid(baseRaid, baseRaidId);
    }
    _maxBaseRaidId = uint16(baseRaidIds.length);
    emit AddBaseRaids(baseRaidIds, baseRaids);
  }

  function editBaseRaids(uint256[] calldata baseRaidIds, BaseRaid[] calldata baseRaids) external onlyOwner {
    require(baseRaids.length == baseRaidIds.length, LengthMismatch());
    for (uint256 i = 0; i < baseRaids.length; ++i) {
      BaseRaid calldata baseRaid = baseRaids[i];
      uint256 baseRaidId = baseRaidIds[i];
      require(_baseRaidExists(baseRaidId), RaidDoesNotExist());
      _setRaid(baseRaid, baseRaidId);
    }
    emit EditBaseRaids(baseRaidIds, baseRaids);
  }

  function setSpawnRaidCooldown(uint24 spawnRaidCooldown) public onlyOwner {
    _spawnRaidCooldown = spawnRaidCooldown;
    emit SetSpawnRaidCooldown(spawnRaidCooldown);
  }

  function setMaxClanCombatants(uint8 maxClanCombatants) public onlyOwner {
    _maxClanCombatants = maxClanCombatants;
    emit SetMaxClanCombatants(maxClanCombatants);
  }

  function setPreventRaids(bool preventRaids) external onlyOwner {
    _preventRaids = preventRaids;
    emit SetPreventRaids(preventRaids);
  }

  function setCombatActions(uint16[] calldata combatActionIds) public onlyOwner {
    _combatActionIds = combatActionIds;
    emit SetCombatActions(combatActionIds);
  }

  function initializeAddresses(address combatantsHelper, IBankFactory bankFactory) external onlyOwner {
    _combatantsHelper = combatantsHelper;
    _bankFactory = bankFactory;
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
