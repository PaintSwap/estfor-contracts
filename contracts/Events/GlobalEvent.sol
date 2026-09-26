// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IPlayers} from "../interfaces/IPlayers.sol";
import {IItemNFT} from "../interfaces/IItemNFT.sol";

// solhint-disable-next-line no-global-import
import "../globals/all.sol";

/// @custom:oz-upgrades-from GlobalEventsV2
contract GlobalEvents is UUPSUpgradeable, OwnableUpgradeable {
  error EventIdZero();
  error StartTimeZero();
  error EndTimeBeforeStartTime();
  error LengthMismatch();
  error EventNotStarted();
  error EventEnded();
  error EventAtMaxCapacity();
  error NoActivePlayer();
  error AmountZero();
  error InvalidStateReadRange();
  error EventDoesNotExist();
  error ContributedEventIdentityChange();

  event AddGlobalEvent(uint256 eventId, GlobalEventInfo globalEventInfo);
  event ContributeToGlobalEvent(address from, uint256 eventId, uint256 playerId, uint256 amount);
  event SetGlobalEventDisabled(uint256 eventId, bool disabled);

  IPlayers private _players;
  IItemNFT private _itemNFT;

  mapping(uint256 eventId => GlobalEventInfo) private _globalEvents;
  mapping(uint256 eventId => mapping(uint256 playerId => uint256 amount)) private _playerContributions;
  mapping(uint256 eventId => bool disabled) public globalEventDisabled;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address owner, IPlayers players, IItemNFT itemNFT) external initializer {
    __Ownable_init(owner);
    __UUPSUpgradeable_init();

    _players = players;
    _itemNFT = itemNFT;
  }

  function contribute(uint256 eventId, uint256 amount) external {
    require(amount != 0, AmountZero());
    GlobalEventInfo storage eventInfo = _globalEvents[eventId];
    require(!globalEventDisabled[eventId], EventNotStarted());
    require(eventInfo.startTime != 0 && block.timestamp >= eventInfo.startTime, EventNotStarted());
    require(eventInfo.endTime == 0 || block.timestamp <= eventInfo.endTime, EventEnded());

    uint256 newTotalInputAmount = eventInfo.totalInputAmount + amount;
    if (eventInfo.inputItemMaxAmount != 0) {
      require(newTotalInputAmount <= eventInfo.inputItemMaxAmount, EventAtMaxCapacity());
    } else {
      // Must still fit in the uint24 storage
      require(newTotalInputAmount <= type(uint24).max, EventAtMaxCapacity());
    }

    uint256 playerId = _players.getActivePlayer(_msgSender());
    require(playerId != 0, NoActivePlayer());

    // Update state before external calls to prevent reentrancy
    eventInfo.totalInputAmount = uint24(newTotalInputAmount);
    _playerContributions[eventId][playerId] += amount;

    _itemNFT.burn(_msgSender(), eventInfo.inputItemTokenId, amount);

    uint256 rewardAmount = amount * eventInfo.rewardItemAmountPerInput;
    _itemNFT.mint(_msgSender(), eventInfo.rewardItemTokenId, rewardAmount);

    emit ContributeToGlobalEvent(_msgSender(), eventId, playerId, amount);
  }

  function getGlobalEvent(uint256 eventId) external view returns (GlobalEventInfo memory) {
    return _globalEvents[eventId];
  }

  /// @notice Scan at most 1024 keys, including disabled events. This is not complete uint256 discovery.
  /// @dev start/count permits reading type(uint256).max without an overflowing exclusive end.
  function getGlobalEventIds(uint256 start, uint256 count) external view returns (uint256[] memory ids) {
    require(count <= 1024 && (count == 0 || start <= type(uint256).max - (count - 1)), InvalidStateReadRange());
    ids = new uint256[](count);
    uint256 length;
    for (uint256 i; i < count; ++i) {
      if (_globalEvents[start + i].startTime != 0) ids[length++] = start + i;
    }
    assembly ("memory-safe") {
      mstore(ids, length)
    }
  }

  /// @notice Disable rather than delete historical configuration and contribution records.
  function setGlobalEventDisabled(uint256 eventId, bool disabled) external onlyOwner {
    require(_globalEvents[eventId].startTime != 0, EventDoesNotExist());
    globalEventDisabled[eventId] = disabled;
    emit SetGlobalEventDisabled(eventId, disabled);
  }

  function _addGlobalEvent(uint256 eventId, GlobalEventInfo calldata globalEventInfo) private {
    require(eventId != 0, EventIdZero());
    require(globalEventInfo.startTime != 0, StartTimeZero());
    require(
      globalEventInfo.endTime == 0 || globalEventInfo.endTime > globalEventInfo.startTime,
      EndTimeBeforeStartTime()
    );

    GlobalEventInfo storage previous = _globalEvents[eventId];
    require(
      globalEventInfo.inputItemMaxAmount == 0 || globalEventInfo.inputItemMaxAmount >= previous.totalInputAmount,
      EventAtMaxCapacity()
    );
    if (previous.totalInputAmount != 0) {
      require(
        previous.inputItemTokenId == globalEventInfo.inputItemTokenId &&
          previous.rewardItemTokenId == globalEventInfo.rewardItemTokenId,
        ContributedEventIdentityChange()
      );
    }

    _globalEvents[eventId].startTime = globalEventInfo.startTime;
    _globalEvents[eventId].endTime = globalEventInfo.endTime;
    _globalEvents[eventId].inputItemTokenId = globalEventInfo.inputItemTokenId;
    _globalEvents[eventId].inputItemMaxAmount = globalEventInfo.inputItemMaxAmount;
    _globalEvents[eventId].rewardItemTokenId = globalEventInfo.rewardItemTokenId;
    _globalEvents[eventId].rewardItemAmountPerInput = globalEventInfo.rewardItemAmountPerInput;
    emit AddGlobalEvent(eventId, globalEventInfo);
  }

  function addGlobalEvents(
    uint256[] calldata eventIds,
    GlobalEventInfo[] calldata globalEventInfos
  ) external onlyOwner {
    require(eventIds.length == globalEventInfos.length, LengthMismatch());
    for (uint256 i = 0; i < eventIds.length; ++i) {
      _addGlobalEvent(eventIds[i], globalEventInfos[i]);
    }
  }

  // solhint-disable-next-line no-empty-blocks
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
