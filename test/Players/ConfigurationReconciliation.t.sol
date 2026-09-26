// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FullGameStack} from "../utils/FullGameStack.sol";
import {IPlayersConfiguration} from "../../contracts/interfaces/IPlayersConfiguration.sol";
import {IPlayersGameData} from "../../contracts/interfaces/IGameData.sol";
import {IPlayersBase} from "../../contracts/interfaces/IPlayersBase.sol";
import {IOwnable} from "../../contracts/interfaces/IOwnable.sol";
import {IUUPSUpgradeable} from "../../contracts/interfaces/IUUPSUpgradeable.sol";
import {Skill, Equipment, Attire} from "../../contracts/globals/misc.sol";
import {ActionInput, ActionQueueStrategy, QueuedActionInput, GUAR_MUL} from "../../contracts/globals/actions.sol";
import {EquipPosition, FullAttireBonusInput, ItemInput, PendingQueuedActionState} from "../../contracts/globals/players.sol";
import {GuaranteedReward, XPThresholdReward} from "../../contracts/globals/rewards.sol";

contract ConfigurationReconciliationTest is FullGameStack {
  uint16 private constant LOG = 10_496;
  uint16 private constant REWARD = 10_240;
  IPlayersConfiguration private configuration;
  IPlayersGameData private data;

  function setUp() public {
    deployFullGame();
    configuration = IPlayersConfiguration(address(players));
    data = IPlayersGameData(address(players));
  }

  function testRemoveThresholdsAndReAdd() public {
    players.addXPThresholdRewards(_threshold(500));
    players.addXPThresholdRewards(_threshold(1000));
    vm.expectEmit(address(players));
    emit IPlayersConfiguration.RemoveXPThresholdReward(500);
    configuration.removeXPThresholdRewards(_keys(500));
    XPThresholdReward[] memory remaining = data.getXPThresholdRewards();
    assertEq(remaining.length, 1);
    assertEq(remaining[0].xpThreshold, 1000);
    players.addXPThresholdRewards(_threshold(500));
    assertEq(data.getXPThresholdRewards().length, 2);
  }

  function testRemoveThresholdsRejectsMissingAndDuplicateAtomically() public {
    players.addXPThresholdRewards(_threshold(500));
    uint32[] memory keys = new uint32[](2);
    keys[0] = 500;
    keys[1] = 499;
    vm.expectRevert(IPlayersBase.XPThresholdDoesNotExist.selector);
    configuration.removeXPThresholdRewards(keys);
    assertEq(data.getXPThresholdRewards().length, 1);
    keys[1] = 500;
    vm.expectRevert(IPlayersBase.XPThresholdDoesNotExist.selector);
    configuration.removeXPThresholdRewards(keys);
    assertEq(data.getXPThresholdRewards().length, 1);
  }

  function testOnlyOwnerCanClearConfiguration() public {
    vm.startPrank(ALICE);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    configuration.removeXPThresholdRewards(_keys(500));
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, ALICE));
    configuration.clearFullAttireBonuses(_skills(Skill.WOODCUTTING));
    vm.stopPrank();
  }

  function testEmptyBatchesAreNoOps() public {
    configuration.removeXPThresholdRewards(new uint32[](0));
    configuration.clearFullAttireBonuses(new Skill[](0));
  }

  function testClearFullAttireAndReAdd() public {
    _addAttireItems();
    _addBonus(Skill.WOODCUTTING);
    _addBonus(Skill.MINING);
    vm.expectEmit(address(players));
    emit IPlayersConfiguration.ClearFullAttireBonus(Skill.WOODCUTTING);
    configuration.clearFullAttireBonuses(_skills(Skill.WOODCUTTING));
    IPlayersBase.FullAttireBonus memory bonus = data.getFullAttireBonus(Skill.WOODCUTTING);
    assertEq(bonus.bonusXPPercent, 0);
    assertEq(bonus.bonusRewardsPercent, 0);
    for (uint256 i; i < 5; ++i) assertEq(bonus.itemTokenIds[i], 0);
    assertEq(data.getFullAttireBonus(Skill.MINING).bonusXPPercent, 10);
    // A repeated clear, including duplicates, is safe.
    Skill[] memory skills = new Skill[](2);
    skills[0] = Skill.WOODCUTTING;
    skills[1] = Skill.WOODCUTTING;
    configuration.clearFullAttireBonuses(skills);
    _addBonus(Skill.WOODCUTTING);
    assertEq(data.getFullAttireBonus(Skill.WOODCUTTING).bonusRewardsPercent, 20);
  }

  function testClearFullAttireRejectsNoneAtomically() public {
    _addAttireItems();
    _addBonus(Skill.WOODCUTTING);
    Skill[] memory skills = new Skill[](2);
    skills[0] = Skill.WOODCUTTING;
    skills[1] = Skill.NONE;
    vm.expectRevert(IPlayersBase.InvalidSkill.selector);
    configuration.clearFullAttireBonuses(skills);
    assertEq(data.getFullAttireBonus(Skill.WOODCUTTING).bonusXPPercent, 10);
  }

  function testClearPreservesQueuedActionsAndUsesSettlementTimeConfiguration() public {
    _addAttireItems();
    _addBonus(Skill.WOODCUTTING);
    players.addXPThresholdRewards(_threshold(500));
    _startWoodcutting();
    vm.warp(block.timestamp + 3601);
    PendingQueuedActionState memory beforeState = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(beforeState.xpRewardItemTokenIds.length, 1);
    assertEq(beforeState.actionMetadatas[0].xpGained, 3960);
    // The attire reward percentage affects random reward chance, not guaranteed quantities.
    assertEq(beforeState.equipmentStates[0].producedAmounts[0], 100);
    bytes32 queueHash = keccak256(abi.encode(players.getActionQueue(playerId)));
    bytes32 activeHash = keccak256(abi.encode(players.getActivePlayerInfo(ALICE)));
    configuration.removeXPThresholdRewards(_keys(500));
    configuration.clearFullAttireBonuses(_skills(Skill.WOODCUTTING));
    assertEq(keccak256(abi.encode(players.getActionQueue(playerId))), queueHash);
    assertEq(keccak256(abi.encode(players.getActivePlayerInfo(ALICE))), activeHash);
    PendingQueuedActionState memory afterState = players.getPendingQueuedActionState(ALICE, playerId);
    assertEq(afterState.xpRewardItemTokenIds.length, 0);
    assertEq(afterState.actionMetadatas[0].xpGained, 3600);
    assertEq(afterState.equipmentStates[0].producedAmounts[0], 100);
    vm.prank(ALICE);
    players.processActions(playerId);
    assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 3600);
    assertEq(itemNFT.balanceOf(ALICE, LOG), 100);
    assertEq(itemNFT.balanceOf(ALICE, REWARD), 0);
  }

  function testClearAndReAddDoesNotReplayAlreadyAwardedThreshold() public {
    players.addXPThresholdRewards(_threshold(500));
    players.modifyXP(ALICE, playerId, Skill.WOODCUTTING, 1000, false);
    assertEq(itemNFT.balanceOf(ALICE, REWARD), 3);
    configuration.removeXPThresholdRewards(_keys(500));
    assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 1000);
    assertEq(itemNFT.balanceOf(ALICE, REWARD), 3);
    players.addXPThresholdRewards(_threshold(500));
    players.modifyXP(ALICE, playerId, Skill.WOODCUTTING, 2000, false);
    assertEq(itemNFT.balanceOf(ALICE, REWARD), 3);
  }

  function testUpgradeFromArchivePreservesConfigurationAndPlayerState() public {
    // Install the beta-baseline artifact, populate it, then upgrade to the new implementation.
    IUUPSUpgradeable proxy = IUUPSUpgradeable(address(players));
    proxy.upgradeToAndCall(vm.deployCode("contracts/old/PlayersV2.sol:PlayersV2:via-ir"), "");
    _addAttireItems();
    _addBonus(Skill.WOODCUTTING);
    players.addXPThresholdRewards(_threshold(500));
    _startWoodcutting();
    bytes32 queueHash = keccak256(abi.encode(players.getActionQueue(playerId)));
    proxy.upgradeToAndCall(vm.deployCode("contracts/Players/Players.sol:Players:via-ir"), "");
    assertEq(data.getXPThresholdRewards().length, 1);
    assertEq(data.getFullAttireBonus(Skill.WOODCUTTING).bonusXPPercent, 10);
    configuration.removeXPThresholdRewards(_keys(500));
    configuration.clearFullAttireBonuses(_skills(Skill.WOODCUTTING));
    assertEq(keccak256(abi.encode(players.getActionQueue(playerId))), queueHash);
    vm.warp(block.timestamp + 3601);
    vm.prank(ALICE);
    players.processActions(playerId);
    assertEq(players.getPlayerXP(playerId, Skill.WOODCUTTING), 3600);
  }

  function _threshold(uint32 xp) private pure returns (XPThresholdReward[] memory thresholds) {
    thresholds = new XPThresholdReward[](1);
    Equipment[] memory rewards = new Equipment[](1);
    rewards[0] = Equipment(REWARD, 3);
    thresholds[0] = XPThresholdReward(xp, rewards);
  }

  function _keys(uint32 key) private pure returns (uint32[] memory keys) {
    keys = new uint32[](1);
    keys[0] = key;
  }

  function _skills(Skill skill) private pure returns (Skill[] memory skills) {
    skills = new Skill[](1);
    skills[0] = skill;
  }

  function _addAttireItems() private {
    EquipPosition[5] memory positions = [
      EquipPosition.HEAD,
      EquipPosition.BODY,
      EquipPosition.ARMS,
      EquipPosition.LEGS,
      EquipPosition.FEET
    ];
    ItemInput[] memory items = new ItemInput[](5);
    for (uint16 i; i < 5; ++i) {
      items[i].tokenId = i + 100;
      items[i].equipPosition = positions[i];
      items[i].isAvailable = true;
      items[i].isTransferable = true;
    }
    itemNFT.addItems(items);
    for (uint16 i; i < 5; ++i) itemNFT.mint(ALICE, i + 100, 1);
  }

  function _addBonus(Skill skill) private {
    FullAttireBonusInput[] memory bonuses = new FullAttireBonusInput[](1);
    bonuses[0] = FullAttireBonusInput(skill, 10, 20, [uint16(100), 101, 102, 103, 104]);
    players.addFullAttireBonuses(bonuses);
  }

  function _startWoodcutting() private {
    ActionInput[] memory actions = new ActionInput[](1);
    actions[0].actionId = 1;
    actions[0].info.skill = uint8(Skill.WOODCUTTING);
    actions[0].info.xpPerHour = 3600;
    actions[0].info.successPercent = 100;
    actions[0].info.isAvailable = true;
    actions[0].guaranteedRewards = new GuaranteedReward[](1);
    actions[0].guaranteedRewards[0] = GuaranteedReward(LOG, uint16(100 * GUAR_MUL));
    worldActions.addActions(actions);
    QueuedActionInput[] memory queue = new QueuedActionInput[](1);
    queue[0].actionId = 1;
    queue[0].timespan = 3600;
    queue[0].attire = Attire(100, 0, 101, 102, 103, 104, 0, 0);
    vm.prank(ALICE);
    players.startActions(playerId, queue, ActionQueueStrategy.OVERWRITE);
  }
}
