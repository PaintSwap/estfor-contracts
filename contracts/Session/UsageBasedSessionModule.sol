// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Enum} from "../interfaces/external/Enum.sol";
import {ISafe} from "../interfaces/external/ISafe.sol";
import {IGameRegistry} from "../interfaces/IGameRegistry.sol";

/// @title UsageBasedSessionModule
/// @notice A module for Gnosis Safe that allows for session keys with rate-limited actions
contract UsageBasedSessionModule is UUPSUpgradeable, OwnableUpgradeable {
  error ExistingSessionActive();
  error NoSessionKey();
  error ActionNotPermitted();
  error GroupLimitReached();
  error InvalidSignature();
  error SessionExpired();

  event SessionEnabled(address indexed safe, address indexed sessionKey, uint48 deadline);

  struct UserUsage {
    // Day => GroupID => Count
    mapping(uint256 => mapping(uint256 => uint256)) epochGroupCounts;
  }

  struct Session {
    address sessionKey;
    uint48 deadline;
  }

  IGameRegistry public registry;
  mapping(address => Session) public sessions; // Safe => Session
  mapping(address => UserUsage) private usage;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address owner, IGameRegistry _registry) public initializer {
    __Ownable_init(owner);
    registry = _registry;
  }

  /**
   * @notice Enables a session. Must be called BY THE SAFE
   */
  function enableSession(address _sessionKey, uint48 _duration) external {
    require(sessions[msg.sender].deadline < block.timestamp, ExistingSessionActive());

    sessions[msg.sender] = Session({sessionKey: _sessionKey, deadline: uint48(block.timestamp) + _duration});

    emit SessionEnabled(msg.sender, _sessionKey, sessions[msg.sender].deadline);
  }

  function execute(address safe, address target, bytes calldata data, bytes calldata signature) external {
    // 1. Basic Session Check
    require(sessions[safe].sessionKey != address(0), NoSessionKey());
    require(sessions[safe].deadline >= block.timestamp, SessionExpired());

    // 2. Identify the action (extract selector from data)
    bytes4 selector = bytes4(data[0:4]);
    uint256 groupId = registry.functionToLimitGroup(target, selector);
    require(groupId > 0, ActionNotPermitted());

    uint256 currentDay = block.timestamp / 1 days;
    UserUsage storage user = usage[safe];
    uint256 currentUsage = user.epochGroupCounts[currentDay][groupId];

    uint256 limit = registry.groupDailyLimits(groupId);
    require(currentUsage < limit, GroupLimitReached());

    // 3. Increment for TODAY
    user.epochGroupCounts[currentDay][groupId] = currentUsage + 1;

    // 4. Verify Signature & Execute via Safe
    bytes32 msgHash = keccak256(abi.encodePacked(safe, target, data));
    require(recoverSigner(msgHash, signature) == sessions[safe].sessionKey, InvalidSignature());

    ISafe(safe).execTransactionFromModule(target, 0, data, Enum.Operation.Call);
  }

  // Standard ECDSA recovery helper
  function recoverSigner(bytes32 _hash, bytes memory _sig) internal pure returns (address) {
    bytes32 r;
    bytes32 s;
    uint8 v;
    if (_sig.length != 65) return address(0);
    assembly {
      r := mload(add(_sig, 32))
      s := mload(add(_sig, 64))
      v := byte(0, mload(add(_sig, 96)))
    }
    if (v < 27) v += 27;
    return ecrecover(_hash, v, r, s);
  }

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
