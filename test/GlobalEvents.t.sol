// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EstforTest} from "./utils/EstforTest.sol";
import {GlobalEvents} from "../contracts/Events/GlobalEvent.sol";
import {IGlobalEventsGameData} from "../contracts/interfaces/IGameData.sol";
import {GlobalEventInfo} from "../contracts/globals/events.sol";
import {IPlayers} from "../contracts/interfaces/IPlayers.sol";
import {MockItemNFT} from "../contracts/test/MockItemNFT.sol";

contract GlobalEventsTest is EstforTest {
  event AddGlobalEvent(uint256 eventId, GlobalEventInfo globalEventInfo);
  event ContributeToGlobalEvent(address from, uint256 eventId, uint256 playerId, uint256 amount);
  event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);

  address private constant PLAYERS = address(0x1111);
  uint256 private constant EVENT_ID = 1;
  uint256 private constant PLAYER_ID = 1;
  uint24 private constant LOG = 10_496;
  uint24 private constant BRONZE_ARROW = 11_776;

  GlobalEvents private globalEvents;

  function setUp() public {
    vm.warp(1 days);
    mockItemNFT = new MockItemNFT();
    GlobalEvents implementation = new GlobalEvents();
    globalEvents = GlobalEvents(
      _deployUUPS(
        address(implementation),
        abi.encodeCall(implementation.initialize, (address(this), IPlayers(PLAYERS), mockItemNFT))
      )
    );
  }

  function testRevertsWhenNonOwnerTriesToCreateEvent() public {
    vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", BOB));
    vm.prank(BOB);
    globalEvents.addGlobalEvents(_eventIds(EVENT_ID), _eventInfos(_eventInfo(uint40(block.timestamp), 0, 1, 100)));
  }

  function testAddsAGlobalEvent() public {
    GlobalEventInfo memory eventInfo = _eventInfo(uint40(block.timestamp), 0, 2, 100);

    vm.expectEmit(false, false, false, true, address(globalEvents));
    emit AddGlobalEvent(EVENT_ID, eventInfo);
    globalEvents.addGlobalEvents(_eventIds(EVENT_ID), _eventInfos(eventInfo));
  }

  function testReadsConfiguredGlobalEvent() public {
    GlobalEventInfo memory eventInfo = _eventInfo(uint40(block.timestamp), uint40(block.timestamp + 1 days), 2, 100);
    globalEvents.addGlobalEvents(_eventIds(EVENT_ID), _eventInfos(eventInfo));

    GlobalEventInfo memory stored = IGlobalEventsGameData(address(globalEvents)).getGlobalEvent(EVENT_ID);
    assertEq(stored.startTime, eventInfo.startTime);
    assertEq(stored.endTime, eventInfo.endTime);
    assertEq(stored.rewardItemTokenId, BRONZE_ARROW);
    assertEq(stored.rewardItemAmountPerInput, 2);
    assertEq(stored.inputItemTokenId, LOG);
    assertEq(stored.inputItemMaxAmount, 100);
    assertEq(stored.totalInputAmount, 0);
  }

  function testRevertsIfEventInfoIsInvalid() public {
    GlobalEventInfo memory eventInfo = _eventInfo(uint40(block.timestamp), 0, 1, 100);

    vm.expectRevert(GlobalEvents.EventIdZero.selector);
    globalEvents.addGlobalEvents(_eventIds(0), _eventInfos(eventInfo));

    eventInfo.startTime = 0;
    vm.expectRevert(GlobalEvents.StartTimeZero.selector);
    globalEvents.addGlobalEvents(_eventIds(EVENT_ID), _eventInfos(eventInfo));

    eventInfo.startTime = uint40(block.timestamp);
    eventInfo.endTime = uint40(block.timestamp - 1);
    vm.expectRevert(GlobalEvents.EndTimeBeforeStartTime.selector);
    globalEvents.addGlobalEvents(_eventIds(EVENT_ID), _eventInfos(eventInfo));
  }

  function testRevertsOnContributeIfAmountIsZero() public {
    vm.expectRevert(GlobalEvents.AmountZero.selector);
    globalEvents.contribute(EVENT_ID, 0);
  }

  function testRevertsIfEventHasNotStarted() public {
    _addEvent(_eventInfo(uint40(block.timestamp + 100), 0, 1, 100));

    vm.expectRevert(GlobalEvents.EventNotStarted.selector);
    globalEvents.contribute(EVENT_ID, 10);
  }

  function testRevertsIfEventHasEnded() public {
    _addEvent(_eventInfo(uint40(block.timestamp), uint40(block.timestamp + 100), 1, 100));
    vm.warp(block.timestamp + 200);

    vm.expectRevert(GlobalEvents.EventEnded.selector);
    globalEvents.contribute(EVENT_ID, 10);
  }

  function testRevertsIfEventIsAtMaxCapacity() public {
    _addEvent(_eventInfo(uint40(block.timestamp), 0, 1, 100));
    _setActivePlayer(BOB, PLAYER_ID);
    mockItemNFT.mint(BOB, LOG, 101);

    vm.expectRevert(GlobalEvents.EventAtMaxCapacity.selector);
    vm.prank(BOB);
    globalEvents.contribute(EVENT_ID, 101);
  }

  function testRevertsIfUserHasNoActivePlayer() public {
    _addEvent(_eventInfo(uint40(block.timestamp), 0, 1, 100));
    _setActivePlayer(BOB, 0);
    mockItemNFT.mint(BOB, LOG, 10);

    vm.expectRevert(GlobalEvents.NoActivePlayer.selector);
    vm.prank(BOB);
    globalEvents.contribute(EVENT_ID, 10);
  }

  function testContributesToAGlobalEvent() public {
    uint256 amount = 10;
    uint24 rewardMultiplier = 2;
    _addEvent(_eventInfo(uint40(block.timestamp), 0, rewardMultiplier, 100));
    _setActivePlayer(BOB, PLAYER_ID);
    mockItemNFT.mint(BOB, LOG, amount);

    vm.expectEmit(false, true, true, true, address(mockItemNFT));
    emit TransferSingle(address(globalEvents), BOB, address(0), LOG, amount);
    vm.expectEmit(false, true, true, true, address(mockItemNFT));
    emit TransferSingle(address(globalEvents), address(0), BOB, BRONZE_ARROW, amount * rewardMultiplier);
    vm.expectEmit(false, false, false, true, address(globalEvents));
    emit ContributeToGlobalEvent(BOB, EVENT_ID, PLAYER_ID, amount);
    vm.prank(BOB);
    globalEvents.contribute(EVENT_ID, amount);

    assertEq(mockItemNFT.balanceOf(BOB, LOG), 0);
    assertEq(mockItemNFT.balanceOf(BOB, BRONZE_ARROW), amount * rewardMultiplier);
  }

  function testContributesMultipleTimes() public {
    _addEvent(_eventInfo(uint40(block.timestamp), 0, 1, 100));
    _setActivePlayer(BOB, PLAYER_ID);
    mockItemNFT.mint(BOB, LOG, 30);

    vm.startPrank(BOB);
    globalEvents.contribute(EVENT_ID, 10);
    globalEvents.contribute(EVENT_ID, 20);
    vm.stopPrank();

    assertEq(mockItemNFT.balanceOf(BOB, LOG), 0);
    assertEq(mockItemNFT.balanceOf(BOB, BRONZE_ARROW), 30);
  }

  function _addEvent(GlobalEventInfo memory eventInfo) private {
    globalEvents.addGlobalEvents(_eventIds(EVENT_ID), _eventInfos(eventInfo));
  }

  function _setActivePlayer(address account, uint256 playerId) private {
    vm.mockCall(PLAYERS, abi.encodeCall(IPlayers.getActivePlayer, (account)), abi.encode(playerId));
  }

  function _eventInfo(
    uint40 startTime,
    uint40 endTime,
    uint24 rewardMultiplier,
    uint24 maxAmount
  ) private pure returns (GlobalEventInfo memory) {
    return
      GlobalEventInfo({
        startTime: startTime,
        endTime: endTime,
        rewardItemTokenId: BRONZE_ARROW,
        rewardItemAmountPerInput: rewardMultiplier,
        inputItemTokenId: LOG,
        inputItemMaxAmount: maxAmount,
        totalInputAmount: 0
      });
  }

  function _eventIds(uint256 eventId) private pure returns (uint256[] memory eventIds) {
    eventIds = new uint256[](1);
    eventIds[0] = eventId;
  }

  function _eventInfos(GlobalEventInfo memory eventInfo) private pure returns (GlobalEventInfo[] memory eventInfos) {
    eventInfos = new GlobalEventInfo[](1);
    eventInfos[0] = eventInfo;
  }
}
