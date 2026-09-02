// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Vm} from "forge-std/Vm.sol";

import {FullGameStack} from "./utils/FullGameStack.sol";
import {IOwnable} from "../contracts/interfaces/IOwnable.sol";
import {Cosmetics} from "../contracts/Cosmetics.sol";
import {IPlayerNFT as PlayerNFT} from "../contracts/interfaces/IPlayerNFT.sol";
import {Skill, Attire, CombatStats} from "../contracts/globals/misc.sol";
import {AvatarInfo, CosmeticInfo, EquipPosition, ItemInput, PendingQueuedActionState} from "../contracts/globals/players.sol";
import {ActionInput, ActionInfo, ActionQueueStrategy, QueuedActionInput} from "../contracts/globals/actions.sol";
import {GuaranteedReward, RandomReward} from "../contracts/globals/rewards.sol";
import {BRONZE_AXE} from "../contracts/globals/items.sol";

contract CosmeticsTest is FullGameStack {
  uint16 private constant TEST_COSMETIC = 2;
  uint16 private constant WOODCUTTING_ACTION = 1;
  uint16 private constant LOG = 10_496;
  uint16 private constant WOODCUTTING_MAX = 3_071;
  uint24 private constant ACTION_TIMESPAN = 3_600;

  function setUp() public {
    deployFullGame();
    brush.mint(ALICE, 100 ether);
  }

  function testShouldNotAllowMintingOfACosmeticOnlyAvatar() public {
    vm.prank(BOB);
    vm.expectRevert(PlayerNFT.BaseAvatarNotExists.selector);
    playerNFT.mint(9, "New name", "", "", "", false, true);
  }

  function testShouldNotLetNonOwnersSetCosmetics() public {
    vm.prank(BOB);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, BOB));
    cosmetics.setCosmetics(_tokenIds(1), _cosmeticInfos(1, EquipPosition.AVATAR, 9));
  }

  function testShouldRevertWhenSettingCosmeticsIncorrectly() public {
    uint16[] memory tokenIds = new uint16[](2);
    tokenIds[0] = 1;
    tokenIds[1] = 2;
    vm.expectRevert(Cosmetics.LengthMismatch.selector);
    cosmetics.setCosmetics(tokenIds, _cosmeticInfos(1, EquipPosition.AVATAR, 9));
  }

  function testShouldEmitEventWhenSettingCosmetics() public {
    uint16[] memory tokenIds = _tokenIds(1);
    CosmeticInfo[] memory infos = _cosmeticInfos(1, EquipPosition.AVATAR, 9);
    vm.expectEmit(address(cosmetics));
    emit Cosmetics.SetCosmetics(tokenIds, infos);
    cosmetics.setCosmetics(tokenIds, infos);
  }

  function testShouldOverwriteExistingCosmetics() public {
    uint16[] memory tokenIds = _tokenIds(1);
    CosmeticInfo[] memory infos = _cosmeticInfos(1, EquipPosition.AVATAR, 9);
    vm.expectEmit(address(cosmetics));
    emit Cosmetics.SetCosmetics(tokenIds, infos);
    cosmetics.setCosmetics(tokenIds, infos);
    vm.expectEmit(address(cosmetics));
    emit Cosmetics.SetCosmetics(tokenIds, infos);
    cosmetics.setCosmetics(tokenIds, infos);
  }

  function testShouldNotLetNonOwnersRemoveCosmetics() public {
    _setTwoCosmetics();
    vm.prank(BOB);
    vm.expectRevert(abi.encodeWithSelector(IOwnable.OwnableUnauthorizedAccount.selector, BOB));
    cosmetics.removeCosmeticItems(_tokenIds(1));
  }

  function testShouldRemoveCosmeticItemsAndEmitEvent() public {
    _setTwoCosmetics();
    uint16[] memory tokenIds = new uint16[](2);
    tokenIds[0] = 1;
    tokenIds[1] = 2;
    vm.expectEmit(address(cosmetics));
    emit Cosmetics.RemoveCosmetics(tokenIds);
    cosmetics.removeCosmeticItems(tokenIds);

    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    itemNFT.mint(BOB, 1, 1);
    vm.prank(BOB);
    vm.expectRevert(Cosmetics.NotEquippableCosmetic.selector);
    cosmetics.applyCosmetic(newPlayerId, 1);
  }

  function testShouldRevertApplyingCosmeticWhenNotOwnerOfPlayer() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    vm.prank(CHARLIE);
    vm.expectRevert(Cosmetics.NotOwnerOfPlayer.selector);
    cosmetics.applyCosmetic(newPlayerId, AVATAR_001_CHIMP);
  }

  function testShouldRevertWhenApplyingItemThatIsNotACosmetic() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    vm.prank(BOB);
    vm.expectRevert(Cosmetics.NotEquippableCosmetic.selector);
    cosmetics.applyCosmetic(newPlayerId, 1);
  }

  function testShouldRevertWhenACosmeticIsAlreadyEquipped() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    itemNFT.mint(BOB, AVATAR_001_CHIMP, 1);
    vm.startPrank(BOB);
    cosmetics.applyCosmetic(newPlayerId, AVATAR_001_CHIMP);
    vm.expectRevert(Cosmetics.CosmeticSlotOccupied.selector);
    cosmetics.applyCosmetic(newPlayerId, AVATAR_001_CHIMP);
    vm.stopPrank();
  }

  function testShouldRevertIfUserDoesNotHaveTheCosmeticItem() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    vm.prank(BOB);
    vm.expectRevert();
    cosmetics.applyCosmetic(newPlayerId, AVATAR_001_CHIMP);
  }

  function testShouldBurnItemAndEmitEventsWhenApplyingCosmeticItem() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    itemNFT.mint(BOB, AVATAR_001_CHIMP, 1);

    vm.recordLogs();
    vm.prank(BOB);
    cosmetics.applyCosmetic(newPlayerId, AVATAR_001_CHIMP);
    Vm.Log[] memory logs = vm.getRecordedLogs();
    assertTrue(
      _hasLog(
        logs,
        address(cosmetics),
        keccak256("CosmeticApplied(uint256,uint16,uint8)"),
        bytes32(newPlayerId),
        bytes32(uint256(AVATAR_001_CHIMP)),
        bytes32(0),
        3,
        abi.encode(EquipPosition.AVATAR)
      )
    );
    assertTrue(
      _hasLog(
        logs,
        address(itemNFT),
        keccak256("TransferSingle(address,address,address,uint256,uint256)"),
        bytes32(uint256(uint160(address(cosmetics)))),
        bytes32(uint256(uint160(BOB))),
        bytes32(0),
        4,
        abi.encode(uint256(AVATAR_001_CHIMP), uint256(1))
      )
    );
    assertTrue(
      _hasLog(
        logs,
        address(playerNFT),
        keccak256("EditAvatar(uint256,uint256)"),
        bytes32(0),
        bytes32(0),
        bytes32(0),
        1,
        abi.encode(newPlayerId, uint256(9))
      )
    );
    assertEq(itemNFT.balanceOf(BOB, AVATAR_001_CHIMP), 0);
  }

  function testShouldGetItemBackWhenRemovingCosmeticItem() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    brush.mint(BOB, 100 ether);
    itemNFT.mint(BOB, AVATAR_001_CHIMP, 1);
    vm.startPrank(BOB);
    brush.approve(address(playerNFT), 100 ether);
    cosmetics.applyCosmetic(newPlayerId, AVATAR_001_CHIMP);

    vm.recordLogs();
    cosmetics.removeCosmetic(newPlayerId, EquipPosition.AVATAR);
    Vm.Log[] memory logs = vm.getRecordedLogs();
    vm.stopPrank();

    assertTrue(
      _hasLog(
        logs,
        address(cosmetics),
        keccak256("CosmeticRemoved(uint256,uint8)"),
        bytes32(newPlayerId),
        bytes32(0),
        bytes32(0),
        2,
        abi.encode(EquipPosition.AVATAR)
      )
    );
    assertTrue(
      _hasLog(
        logs,
        address(itemNFT),
        keccak256("TransferSingle(address,address,address,uint256,uint256)"),
        bytes32(uint256(uint160(address(cosmetics)))),
        bytes32(0),
        bytes32(uint256(uint160(BOB))),
        4,
        abi.encode(uint256(AVATAR_001_CHIMP), uint256(1))
      )
    );
    assertTrue(
      _hasLog(
        logs,
        address(playerNFT),
        keccak256("EditAvatar(uint256,uint256)"),
        bytes32(0),
        bytes32(0),
        bytes32(0),
        1,
        abi.encode(newPlayerId, uint256(1))
      )
    );
    assertEq(itemNFT.balanceOf(BOB, AVATAR_001_CHIMP), 1);
    assertLt(brush.balanceOf(BOB), 100 ether);
  }

  function testShouldRevertRemovingAvatarCosmeticWithoutEnoughBrush() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    itemNFT.mint(BOB, AVATAR_001_CHIMP, 1);
    vm.startPrank(BOB);
    brush.approve(address(playerNFT), 100 ether);
    cosmetics.applyCosmetic(newPlayerId, AVATAR_001_CHIMP);
    vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, BOB, 0, 0.5 ether));
    cosmetics.removeCosmetic(newPlayerId, EquipPosition.AVATAR);
    vm.stopPrank();
  }

  function testShouldRevertRemovingCosmeticWhenNotOwnerOfPlayer() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    brush.mint(BOB, 100 ether);
    itemNFT.mint(BOB, AVATAR_001_CHIMP, 1);
    vm.startPrank(BOB);
    brush.approve(address(playerNFT), 100 ether);
    cosmetics.applyCosmetic(newPlayerId, AVATAR_001_CHIMP);
    vm.stopPrank();
    vm.prank(CHARLIE);
    vm.expectRevert(Cosmetics.NotOwnerOfPlayer.selector);
    cosmetics.removeCosmetic(newPlayerId, EquipPosition.AVATAR);
  }

  function testShouldGetBonusXPWhenEquippingNewAvatar() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    _addWoodcuttingAvatar(false);
    _equipTestCosmetic(BOB, newPlayerId);
    QueuedActionInput memory queuedAction = _setupBasicWoodcutting();
    _startAndWarp(BOB, newPlayerId, queuedAction);
    assertEq(_pendingXP(BOB, newPlayerId), (ACTION_TIMESPAN * 110) / 100);
    vm.prank(BOB);
    players.processActions(newPlayerId);
    assertEq(players.getPlayerXP(newPlayerId, Skill.WOODCUTTING), (ACTION_TIMESPAN * 110) / 100);
  }

  function testShouldGetBonusXPWhenEquippingNewEvolvedAvatar() public {
    brush.mint(BOB, 100 ether);
    vm.prank(BOB);
    brush.approve(address(playerNFT), 100 ether);
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true, true);
    _addWoodcuttingAvatar(true);
    _equipTestCosmetic(BOB, newPlayerId);
    QueuedActionInput memory queuedAction = _setupBasicWoodcutting();
    _startAndWarp(BOB, newPlayerId, queuedAction);
    assertEq(_pendingXP(BOB, newPlayerId), (ACTION_TIMESPAN * 120) / 100);
    vm.prank(BOB);
    players.processActions(newPlayerId);
    assertEq(players.getPlayerXP(newPlayerId, Skill.WOODCUTTING), (ACTION_TIMESPAN * 120) / 100);
  }

  function testShouldRevertToNormalXPAfterUnequippingCosmeticAvatar() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    _addWoodcuttingAvatar(false);
    _equipTestCosmetic(BOB, newPlayerId);
    QueuedActionInput memory queuedAction = _setupBasicWoodcutting();
    _startAndWarp(BOB, newPlayerId, queuedAction);
    assertEq(_pendingXP(BOB, newPlayerId), (ACTION_TIMESPAN * 110) / 100);
    vm.prank(BOB);
    players.processActions(newPlayerId);
    uint256 xp = players.getPlayerXP(newPlayerId, Skill.WOODCUTTING);
    assertEq(xp, (ACTION_TIMESPAN * 110) / 100);

    brush.mint(BOB, 100 ether);
    vm.startPrank(BOB);
    brush.approve(address(playerNFT), 100 ether);
    cosmetics.removeCosmetic(newPlayerId, EquipPosition.AVATAR);
    vm.stopPrank();
    _startAndWarp(BOB, newPlayerId, queuedAction);
    assertEq(_pendingXP(BOB, newPlayerId), ACTION_TIMESPAN);
    vm.prank(BOB);
    players.processActions(newPlayerId);
    assertEq(players.getPlayerXP(newPlayerId, Skill.WOODCUTTING), xp + ACTION_TIMESPAN);
  }

  function testShouldProcessActionsWhenApplyingNewCosmetic() public {
    uint256 newPlayerId = _createPlayer(BOB, 1, "New name", true);
    _addWoodcuttingAvatar(false);
    itemNFT.mint(BOB, TEST_COSMETIC, 1);
    QueuedActionInput memory queuedAction = _setupBasicWoodcutting();
    _startAndWarp(BOB, newPlayerId, queuedAction);
    assertEq(_pendingXP(BOB, newPlayerId), ACTION_TIMESPAN);
    vm.prank(BOB);
    cosmetics.applyCosmetic(newPlayerId, TEST_COSMETIC);
    assertEq(players.getPlayerXP(newPlayerId, Skill.WOODCUTTING), ACTION_TIMESPAN);
  }

  function _setTwoCosmetics() private {
    uint16[] memory tokenIds = new uint16[](2);
    tokenIds[0] = 1;
    tokenIds[1] = 2;
    CosmeticInfo[] memory infos = new CosmeticInfo[](2);
    infos[0] = CosmeticInfo(EquipPosition.AVATAR, 1, 9);
    infos[1] = CosmeticInfo(EquipPosition.AVATAR_BORDER, 2, 0);
    cosmetics.setCosmetics(tokenIds, infos);
  }

  function _addWoodcuttingAvatar(bool includeEvolved) private {
    uint256 count = includeEvolved ? 2 : 1;
    uint256[] memory avatarIds = new uint256[](count);
    AvatarInfo[] memory avatars = new AvatarInfo[](count);
    avatarIds[0] = 10;
    avatars[0] = AvatarInfo(
      "Woodcutting champ",
      "",
      includeEvolved ? "10.jpg" : "10010.jpg",
      [Skill.WOODCUTTING, Skill.NONE]
    );
    if (includeEvolved) {
      avatarIds[1] = 10_010;
      avatars[1] = AvatarInfo("Woodcutting champ evolved", "", "10010.jpg", [Skill.WOODCUTTING, Skill.NONE]);
    }
    playerNFT.setAvatars(avatarIds, avatars);
    cosmetics.setCosmetics(_tokenIds(TEST_COSMETIC), _cosmeticInfos(TEST_COSMETIC, EquipPosition.AVATAR, 10));
  }

  function _equipTestCosmetic(address account, uint256 id) private {
    itemNFT.mint(account, TEST_COSMETIC, 1);
    vm.prank(account);
    cosmetics.applyCosmetic(id, TEST_COSMETIC);
  }

  function _setupBasicWoodcutting() private returns (QueuedActionInput memory queuedAction) {
    GuaranteedReward[] memory rewards = new GuaranteedReward[](1);
    rewards[0] = GuaranteedReward(LOG, 1_000);
    ActionInput[] memory actions = new ActionInput[](1);
    actions[0] = ActionInput({
      actionId: WOODCUTTING_ACTION,
      info: ActionInfo(
        uint8(Skill.WOODCUTTING),
        false,
        3_600,
        0,
        0,
        BRONZE_AXE,
        WOODCUTTING_MAX,
        100,
        0,
        false,
        true,
        0
      ),
      guaranteedRewards: rewards,
      randomRewards: new RandomReward[](0),
      combatStats: CombatStats(0, 0, 0, 0, 0, 0, 0)
    });
    worldActions.addActions(actions);
    ItemInput[] memory items = new ItemInput[](1);
    items[0].tokenId = BRONZE_AXE;
    items[0].equipPosition = EquipPosition.RIGHT_HAND;
    items[0].isAvailable = true;
    itemNFT.addItems(items);
    queuedAction = QueuedActionInput(
      Attire(0, 0, 0, 0, 0, 0, 0, 0),
      WOODCUTTING_ACTION,
      0,
      0,
      BRONZE_AXE,
      0,
      ACTION_TIMESPAN,
      0,
      0
    );
  }

  function _startAndWarp(address account, uint256 id, QueuedActionInput memory queuedAction) private {
    QueuedActionInput[] memory actions = new QueuedActionInput[](1);
    actions[0] = queuedAction;
    vm.prank(account);
    players.startActions(id, actions, ActionQueueStrategy.OVERWRITE);
    vm.warp(block.timestamp + queuedAction.timespan);
  }

  function _pendingXP(address account, uint256 id) private view returns (uint256) {
    PendingQueuedActionState memory state = players.getPendingQueuedActionState(account, id);
    return state.actionMetadatas[0].xpGained;
  }

  function _tokenIds(uint16 tokenId) private pure returns (uint16[] memory tokenIds) {
    tokenIds = new uint16[](1);
    tokenIds[0] = tokenId;
  }

  function _hasLog(
    Vm.Log[] memory logs,
    address emitter,
    bytes32 topic0,
    bytes32 topic1,
    bytes32 topic2,
    bytes32 topic3,
    uint256 expectedTopics,
    bytes memory data
  ) private pure returns (bool) {
    for (uint256 i; i < logs.length; ++i) {
      if (logs[i].emitter != emitter || logs[i].topics.length != expectedTopics || logs[i].topics[0] != topic0)
        continue;
      if (expectedTopics > 1 && logs[i].topics[1] != topic1) continue;
      if (expectedTopics > 2 && logs[i].topics[2] != topic2) continue;
      if (expectedTopics > 3 && logs[i].topics[3] != topic3) continue;
      if (keccak256(logs[i].data) == keccak256(data)) return true;
    }
    return false;
  }

  function _cosmeticInfos(
    uint16 tokenId,
    EquipPosition position,
    uint24 avatarId
  ) private pure returns (CosmeticInfo[] memory infos) {
    infos = new CosmeticInfo[](1);
    infos[0] = CosmeticInfo(position, tokenId, avatarId);
  }
}
