// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IAvatarDiscovery, IRewardTierDiscovery, ISubsidyFunctionDiscovery, IReconciliationDiscovery, DiscoveryStatus} from "../contracts/interfaces/IReconciliationDiscovery.sol";
import {IPlayerNFT} from "../contracts/interfaces/IPlayerNFT.sol";
import {IPlayers} from "../contracts/interfaces/IPlayers.sol";
import {IPlayerNFTGameData, IDailyRewardsSchedulerGameData} from "../contracts/interfaces/IGameData.sol";
import {IGameSubsidisationRegistry} from "../contracts/interfaces/IGameSubsidisationRegistry.sol";
import {IUUPSUpgradeable} from "../contracts/interfaces/IUUPSUpgradeable.sol";
import {IOwnable} from "../contracts/interfaces/IOwnable.sol";
import {IBrushToken} from "../contracts/interfaces/external/IBrushToken.sol";
import {AvatarInfo} from "../contracts/globals/players.sol";
import {Equipment, Skill} from "../contracts/globals/misc.sol";

interface IDiscoveryScheduler is IRewardTierDiscovery, IDailyRewardsSchedulerGameData {
  error InvalidReward();
  function initialize(address randomnessBeacon) external;
  function setDailyRewardPool(uint256 tier, Equipment[] calldata rewards) external;
  function setWeeklyRewardPool(uint256 tier, Equipment[] calldata rewards) external;
  function newOracleRandomWords(uint256 randomWord) external;
  function getThisWeeksRandomWordSegment() external view returns (bytes8);
  function getActiveDailyAndWeeklyRewards(uint256 tier, uint256 playerId) external view returns (Equipment[8] memory);
}

interface IDiscoveryRegistry is ISubsidyFunctionDiscovery, IGameSubsidisationRegistry {
  function initialize(address owner) external;
}

contract DiscoveryPlayerHooks {
  function mintedPlayer(address, uint256, Skill[2] calldata, bool, uint256[] calldata, uint256[] calldata) external {}
}

contract ReconciliationDiscoveryTest is Test {
  address private constant USER = address(0x1234);
  uint256 private constant HIGH_KEY = type(uint256).max;

  function setUp() public {
    vm.warp(20 weeks);
    vm.etch(address(0x1001), vm.getDeployedCode("contracts/EstforLibrary.sol:EstforLibrary:via-ir"));
  }

  function _player(bool legacy) private returns (IPlayerNFT player) {
    address implementation = vm.deployCode(
      legacy ? "contracts/old/PlayerNFTV2.sol:PlayerNFTV2:via-ir" : "contracts/PlayerNFT.sol:PlayerNFT:via-ir"
    );
    player = IPlayerNFT(
      address(
        new ERC1967Proxy(
          implementation,
          abi.encodeCall(
            IPlayerNFT.initialize,
            (
              IBrushToken(address(0)),
              address(this),
              address(this),
              USER,
              uint72(0),
              uint72(0),
              "ipfs://",
              uint64(1),
              false,
              address(0)
            )
          )
        )
      )
    );
  }

  function _scheduler(bool legacy) private returns (IDiscoveryScheduler scheduler) {
    address implementation = vm.deployCode(
      legacy
        ? "contracts/old/DailyRewardsSchedulerV2.sol:DailyRewardsSchedulerV2"
        : "contracts/DailyRewardsScheduler.sol:DailyRewardsScheduler"
    );
    scheduler = IDiscoveryScheduler(
      address(new ERC1967Proxy(implementation, abi.encodeCall(IDiscoveryScheduler.initialize, (address(this)))))
    );
  }

  function _registry(bool legacy) private returns (IDiscoveryRegistry registry) {
    address implementation = vm.deployCode(
      legacy
        ? "contracts/old/GameSubsidisationRegistryV2.sol:GameSubsidisationRegistryV2"
        : "contracts/Session/GameSubsidisationRegistry.sol:GameSubsidisationRegistry"
    );
    registry = IDiscoveryRegistry(
      address(new ERC1967Proxy(implementation, abi.encodeCall(IDiscoveryRegistry.initialize, (address(this)))))
    );
  }

  function _upgrade(address proxy, string memory artifact) private {
    IUUPSUpgradeable(proxy).upgradeToAndCall(vm.deployCode(artifact), "");
  }

  function _ids(uint256 id) private pure returns (uint256[] memory ids) {
    ids = new uint256[](1);
    ids[0] = id;
  }

  function _avatar(IPlayerNFT player, uint256 id, AvatarInfo memory info) private {
    AvatarInfo[] memory infos = new AvatarInfo[](1);
    infos[0] = info;
    player.setAvatars(_ids(id), infos);
  }

  function _rewards() private pure returns (Equipment[] memory rewards) {
    rewards = new Equipment[](1);
    rewards[0] = Equipment({itemTokenId: 1, amount: 10});
  }

  function _assertStatus(IReconciliationDiscovery discovery, DiscoveryStatus status) private view {
    assertEq(uint256(discovery.discoveryStatus()), uint256(status));
  }

  function _attest(IReconciliationDiscovery discovery) private {
    bytes32 evidence = keccak256("externally verified complete legacy inventory");
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryAttestation.selector);
    discovery.attestLegacyDiscovery(bytes32(0));
    vm.prank(USER);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, USER));
    discovery.attestLegacyDiscovery(evidence);
    vm.expectEmit(true, false, false, true, address(discovery));
    emit IReconciliationDiscovery.LegacyDiscoveryAttested(evidence);
    discovery.attestLegacyDiscovery(evidence);
    _assertStatus(discovery, DiscoveryStatus.LegacyAttested);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryAttestation.selector);
    discovery.attestLegacyDiscovery(evidence);
  }

  function testAvatarFreshIndexIncludesEveryFieldAndFullWidthKeys() public {
    IPlayerNFT player = _player(false);
    IAvatarDiscovery discovery = IAvatarDiscovery(address(player));
    _assertStatus(discovery, DiscoveryStatus.Complete);
    AvatarInfo[] memory infos = new AvatarInfo[](5);
    infos[0].name = "name only";
    infos[1].description = "description only";
    infos[2].imageURI = "image only";
    infos[3].startSkills[0] = Skill.MELEE;
    infos[4].startSkills[1] = Skill.MAGIC;
    uint256[] memory ids = new uint256[](5);
    ids[0] = 0;
    ids[1] = HIGH_KEY;
    ids[2] = 1 << 200;
    ids[3] = 10_001;
    ids[4] = 42;
    player.setAvatars(ids, infos);
    player.setAvatars(ids, infos);
    assertEq(discovery.getAvatarCount(), 5);
    assertEq(discovery.getAvatarIds(0, 5), ids);
    assertEq(discovery.getAvatarIds(1, 2)[0], HIGH_KEY);
    assertEq(discovery.getAvatarIds(5, 5).length, 0);
    AvatarInfo memory empty;
    _avatar(player, HIGH_KEY, empty);
    assertEq(discovery.getAvatarCount(), 4);
    assertEq(discovery.getAvatarIds(1, 2)[0], 42); // swap-and-pop
    _avatar(player, HIGH_KEY, infos[0]);
    assertEq(discovery.getAvatarCount(), 5);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    discovery.getAvatarIds(2, 1);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    discovery.getAvatarIds(0, 6);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryAttestation.selector);
    discovery.attestLegacyDiscovery(bytes32(uint256(1)));
  }

  function testAvatarLegacyRegistrationPreservesRecordsAndPlayerRuntime() public {
    IPlayerNFT player = _player(true);
    AvatarInfo memory info;
    info.description = "legacy";
    _avatar(player, HIGH_KEY, info);
    _avatar(player, 1, info);
    player.setPlayers(IPlayers(address(new DiscoveryPlayerHooks())));
    vm.prank(USER);
    player.mint(1, "Legacy Hero", "", "", "", false, false);
    bytes32 playerState = keccak256(abi.encode(player.getPlayerInfo(1)));
    _upgrade(address(player), "contracts/PlayerNFT.sol:PlayerNFT:via-ir");
    IAvatarDiscovery discovery = IAvatarDiscovery(address(player));
    _assertStatus(discovery, DiscoveryStatus.Incomplete);
    assertEq(discovery.getAvatarCount(), 0);
    assertEq(IPlayerNFTGameData(address(player)).getAvatar(HIGH_KEY).description, "legacy");
    discovery.registerLegacyAvatarIds(_ids(HIGH_KEY));
    discovery.registerLegacyAvatarIds(_ids(HIGH_KEY));
    discovery.registerLegacyAvatarIds(_ids(999));
    assertEq(discovery.getAvatarCount(), 1);
    _assertStatus(discovery, DiscoveryStatus.Incomplete); // omitted key 1 is still present
    vm.prank(USER);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, USER));
    discovery.registerLegacyAvatarIds(_ids(1));
    discovery.registerLegacyAvatarIds(_ids(1));
    _attest(discovery);
    AvatarInfo memory empty;
    _avatar(player, HIGH_KEY, empty);
    assertEq(discovery.getAvatarIds(0, 1)[0], 1);
    assertEq(keccak256(abi.encode(player.getPlayerInfo(1))), playerState);
    assertEq(player.ownerOf(1), USER);
    assertEq(player.balanceOf(USER, 1), 1);
    assertEq(player.getName(1), "Legacy Hero");
    assertEq(IOwnable(address(player)).owner(), address(this));
  }

  function testRewardIndexesAreIndependentAndWritesAreAtomic() public {
    IDiscoveryScheduler scheduler = _scheduler(false);
    _assertStatus(scheduler, DiscoveryStatus.Complete);
    scheduler.setDailyRewardPool(0, _rewards());
    scheduler.setDailyRewardPool(HIGH_KEY, _rewards());
    scheduler.setWeeklyRewardPool(HIGH_KEY, _rewards());
    scheduler.setWeeklyRewardPool(HIGH_KEY, _rewards());
    assertEq(scheduler.getDailyRewardTierCount(), 2);
    assertEq(scheduler.getWeeklyRewardTierCount(), 1);
    scheduler.setDailyRewardPool(HIGH_KEY, new Equipment[](0));
    assertEq(scheduler.getDailyRewardTiers(0, 1)[0], 0);
    assertEq(scheduler.getWeeklyRewardTiers(0, 1)[0], HIGH_KEY);
    Equipment[] memory invalid = _rewards();
    invalid[0].amount = 11;
    vm.expectRevert(IDiscoveryScheduler.InvalidReward.selector);
    scheduler.setDailyRewardPool(0, invalid);
    assertEq(scheduler.getDailyRewardPool(0)[0].amount, 10);
    assertEq(scheduler.getDailyRewardTierCount(), 1);
    scheduler.setWeeklyRewardPool(HIGH_KEY, new Equipment[](0));
    assertEq(scheduler.getWeeklyRewardTierCount(), 0);
    scheduler.setWeeklyRewardPool(HIGH_KEY, _rewards());
    assertEq(scheduler.getWeeklyRewardTierCount(), 1);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    scheduler.getDailyRewardTiers(1, 0);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    scheduler.getWeeklyRewardTiers(0, 2);
    assertEq(scheduler.getWeeklyRewardTiers(1, 1).length, 0);
  }

  function testRewardLegacyRegistrationPreservesRandomnessAndPools() public {
    IDiscoveryScheduler scheduler = _scheduler(true);
    scheduler.setDailyRewardPool(HIGH_KEY, _rewards());
    scheduler.setWeeklyRewardPool(HIGH_KEY, _rewards());
    vm.warp(block.timestamp + 1 weeks);
    scheduler.newOracleRandomWords(0x12345678);
    bytes8 randomSegment = scheduler.getThisWeeksRandomWordSegment();
    bytes32 rewards = keccak256(abi.encode(scheduler.getActiveDailyAndWeeklyRewards(HIGH_KEY, 123)));
    _upgrade(address(scheduler), "contracts/DailyRewardsScheduler.sol:DailyRewardsScheduler");
    _assertStatus(scheduler, DiscoveryStatus.Incomplete);
    assertEq(scheduler.getDailyRewardTierCount(), 0);
    assertEq(scheduler.getWeeklyRewardTierCount(), 0);
    scheduler.registerLegacyRewardTiers(_ids(HIGH_KEY), new uint256[](0));
    _assertStatus(scheduler, DiscoveryStatus.Incomplete);
    scheduler.registerLegacyRewardTiers(_ids(HIGH_KEY), _ids(HIGH_KEY));
    scheduler.registerLegacyRewardTiers(_ids(0), _ids(0));
    assertEq(scheduler.getDailyRewardTierCount(), 1);
    assertEq(scheduler.getWeeklyRewardTierCount(), 1);
    vm.prank(USER);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, USER));
    scheduler.registerLegacyRewardTiers(_ids(0), _ids(0));
    _attest(scheduler);
    assertEq(bytes32(scheduler.getThisWeeksRandomWordSegment()), bytes32(randomSegment));
    assertEq(keccak256(abi.encode(scheduler.getActiveDailyAndWeeklyRewards(HIGH_KEY, 123))), rewards);
    // The checkpoint was not reset by migration: another word in this week is ignored.
    scheduler.newOracleRandomWords(0xabcdef);
    assertEq(bytes32(scheduler.getThisWeeksRandomWordSegment()), bytes32(randomSegment));
    scheduler.setWeeklyRewardPool(HIGH_KEY, new Equipment[](0));
    assertEq(scheduler.getWeeklyRewardTierCount(), 0);
    assertEq(scheduler.getDailyRewardTierCount(), 1);
  }

  function testSubsidySingleBatchDuplicateClearAndZeroKeys() public {
    IDiscoveryRegistry registry = _registry(false);
    _assertStatus(registry, DiscoveryStatus.Complete);
    address[] memory contracts_ = new address[](3);
    bytes4[] memory selectors = new bytes4[](3);
    uint256[] memory groups = new uint256[](3);
    contracts_[0] = address(0);
    contracts_[1] = address(type(uint160).max);
    contracts_[2] = contracts_[1];
    selectors[1] = bytes4(0xffffffff);
    selectors[2] = selectors[1];
    groups[0] = 1;
    groups[1] = 2;
    groups[2] = HIGH_KEY;
    registry.setFunctionGroups(contracts_, selectors, groups);
    assertEq(registry.getSubsidisedFunctionCount(), 2);
    (address[] memory found, bytes4[] memory foundSelectors) = registry.getSubsidisedFunctions(0, 2);
    assertEq(found[0], address(0));
    assertEq(foundSelectors[0], bytes4(0));
    assertEq(found[1], address(type(uint160).max));
    assertEq(foundSelectors[1], bytes4(0xffffffff));
    assertEq(registry.functionToLimitGroup(found[1], foundSelectors[1]), HIGH_KEY);
    registry.setGroupLimit(HIGH_KEY, 0);
    assertEq(registry.getSubsidisedFunctionCount(), 2); // group assignment still configured
    registry.setFunctionGroup(address(0), bytes4(0), 0);
    assertEq(registry.getSubsidisedFunctionCount(), 1);
    groups[0] = 0;
    groups[1] = 7;
    groups[2] = 0;
    registry.setFunctionGroups(contracts_, selectors, groups);
    assertEq(registry.getSubsidisedFunctionCount(), 0);
    registry.setFunctionGroup(address(0), bytes4(0), 9);
    assertEq(registry.getSubsidisedFunctionCount(), 1);
    vm.expectRevert(IGameSubsidisationRegistry.LengthMismatch.selector);
    registry.setFunctionGroups(contracts_, selectors, new uint256[](0));
    assertEq(registry.getSubsidisedFunctionCount(), 1);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    registry.getSubsidisedFunctions(1, 0);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    registry.getSubsidisedFunctions(0, 2);
  }

  function testSubsidyLegacyRegistrationPreservesGroupsAndLimits() public {
    IDiscoveryRegistry registry = _registry(true);
    registry.setFunctionGroup(USER, bytes4(0x12345678), HIGH_KEY);
    registry.setFunctionGroup(USER, bytes4(0), 1);
    registry.setGroupLimit(HIGH_KEY, 987);
    _upgrade(address(registry), "contracts/Session/GameSubsidisationRegistry.sol:GameSubsidisationRegistry");
    _assertStatus(registry, DiscoveryStatus.Incomplete);
    assertEq(registry.getSubsidisedFunctionCount(), 0);
    address[] memory contracts_ = new address[](2);
    bytes4[] memory selectors = new bytes4[](2);
    contracts_[0] = USER;
    contracts_[1] = USER;
    selectors[0] = bytes4(0x12345678);
    selectors[1] = bytes4(0x12345678);
    registry.registerLegacyFunctions(contracts_, selectors);
    assertEq(registry.getSubsidisedFunctionCount(), 1);
    _assertStatus(registry, DiscoveryStatus.Incomplete);
    registry.setFunctionGroup(USER, bytes4(0), 0); // clear omitted legacy key without registering it
    selectors[1] = bytes4(0);
    registry.registerLegacyFunctions(contracts_, selectors);
    assertEq(registry.getSubsidisedFunctionCount(), 1);
    vm.prank(USER);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, USER));
    registry.registerLegacyFunctions(contracts_, selectors);
    vm.expectRevert(IGameSubsidisationRegistry.LengthMismatch.selector);
    registry.registerLegacyFunctions(contracts_, new bytes4[](0));
    _attest(registry);
    (uint256 group, uint256 limit) = registry.getGroupAndLimit(USER, selectors[0]);
    assertEq(group, HIGH_KEY);
    assertEq(limit, 987);
    registry.setFunctionGroup(USER, selectors[0], 0);
    assertEq(registry.getSubsidisedFunctionCount(), 0);
    assertEq(registry.groupDailyLimits(HIGH_KEY), 987);
  }

  function testAllPageLimitsAreBoundedAt1024() public {
    IPlayerNFT player = _player(false);
    IAvatarDiscovery avatars = IAvatarDiscovery(address(player));
    IDiscoveryScheduler scheduler = _scheduler(false);
    IDiscoveryRegistry registry = _registry(false);
    AvatarInfo memory info;
    info.name = "configured";
    for (uint256 i; i < 1025; ++i) {
      _avatar(player, i, info);
      scheduler.setDailyRewardPool(i, _rewards());
      scheduler.setWeeklyRewardPool(i, _rewards());
      registry.setFunctionGroup(address(uint160(i)), bytes4(0), 1);
    }
    assertEq(avatars.getAvatarIds(0, 1024).length, 1024);
    assertEq(scheduler.getDailyRewardTiers(0, 1024).length, 1024);
    assertEq(scheduler.getWeeklyRewardTiers(0, 1024).length, 1024);
    (address[] memory contracts_, ) = registry.getSubsidisedFunctions(0, 1024);
    assertEq(contracts_.length, 1024);
    assertEq(avatars.getAvatarIds(1024, 1025)[0], 1024);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    avatars.getAvatarIds(0, 1025);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    scheduler.getDailyRewardTiers(0, 1025);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    scheduler.getWeeklyRewardTiers(0, 1025);
    vm.expectRevert(IReconciliationDiscovery.InvalidDiscoveryRange.selector);
    registry.getSubsidisedFunctions(0, 1025);
  }

  function testFuzzSubsidyKeyEncoding(address contract_, bytes4 selector, uint256 group) public {
    vm.assume(group != 0);
    IDiscoveryRegistry registry = _registry(false);
    registry.setFunctionGroup(contract_, selector, group);
    (address[] memory contracts_, bytes4[] memory selectors) = registry.getSubsidisedFunctions(0, 1);
    assertEq(contracts_[0], contract_);
    assertEq(selectors[0], selector);
    registry.setFunctionGroup(contract_, selector, 0);
    assertEq(registry.getSubsidisedFunctionCount(), 0);
  }
}
