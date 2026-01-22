// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Enum} from "../interfaces/external/Enum.sol";
import {ISafe} from "../interfaces/external/ISafe.sol";
import {IGameSubsidisationRegistry} from "../interfaces/IGameSubsidisationRegistry.sol";

/// @title UsageBasedSessionModule
/// @notice A module for Gnosis Safe that allows for session keys with rate-limited actions
contract UsageBasedSessionModule is UUPSUpgradeable, OwnableUpgradeable, EIP712Upgradeable {
  error ExistingSessionActive();
  error NoSessionKey();
  error ActionNotPermitted();
  error GroupLimitReached();
  error InvalidSignature();
  error SessionExpired();
  error InvalidSessionDuration();
  error ZeroSessionKey();
  error InvalidCallData();
  error ModuleCallFailed();
  error UnauthorizedSigner();
  error RefundFailed();

  event SessionEnabled(address indexed safe, address indexed sessionKey, uint48 deadline);
  event SessionRevoked(address indexed safe);
  event SessionNonceIncremented(address indexed safe, uint256 newNonce);
  event WhitelistedSignersUpdated(address[] signers, bool whitelisted);

  uint48 public constant MAX_SESSION_DURATION = 30 days;
  uint256 public constant GAS_OVERHEAD = 30000; // 21000 base tx + 9k transfer
  bytes32 private constant SESSION_TYPEHASH = keccak256(
    "UsageBasedSession(address safe,address target,bytes data,uint256 nonce,uint48 sessionDeadline)"
  );

  struct GroupUsage {
    uint40 day; // day number (UTC)
    uint40 count; // usage count for that day
  }

  struct UserUsage {
    mapping(uint256 => GroupUsage) groupUsage; // GroupID => usage for current day
    uint256 nonce;
  }

  struct Session {
    address sessionKey;
    uint48 deadline;
  }

  IGameSubsidisationRegistry private _registry;
  mapping(address => Session) private _sessions; // Safe => Session
  mapping(address => UserUsage) private _usage; // Safe => Usage
  mapping(address => bool) private _whitelistedSigners;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address owner, IGameSubsidisationRegistry registry) public initializer {
    __Ownable_init(owner);
    __EIP712_init("UsageBasedSessionModule", "1");
    _registry = registry;
  }

  /**
   * @notice Enables a session. Must be called BY THE SAFE
   */
  function enableSession(address _sessionKey, uint48 _duration) external {
    require(_sessionKey != address(0), ZeroSessionKey());
    require(_duration > 0 && _duration <= MAX_SESSION_DURATION, InvalidSessionDuration());
    require(_sessions[msg.sender].deadline < block.timestamp, ExistingSessionActive());

    _sessions[msg.sender] = Session({sessionKey: _sessionKey, deadline: uint48(block.timestamp) + _duration});

    emit SessionEnabled(msg.sender, _sessionKey, _sessions[msg.sender].deadline);
  }

  /**
   * @notice Explicitly revoke the current session early. Must be called BY THE SAFE
   */
  function revokeSession() external {
    delete _sessions[msg.sender];
    emit SessionRevoked(msg.sender);
  }

  function execute(address safe, address target, bytes calldata data, bytes calldata signature) external {
    uint256 startGas = gasleft();
    require(_whitelistedSigners[msg.sender], UnauthorizedSigner());
    require(data.length >= 4, InvalidCallData());

    // 1. Basic Session Check
    Session memory session = _sessions[safe];
    require(session.sessionKey != address(0), NoSessionKey());
    require(session.deadline >= block.timestamp, SessionExpired());

    // 2. Identify the action (extract selector from data)
    bytes4 selector = bytes4(data[0:4]);
    uint256 groupId = _registry.functionToLimitGroup(target, selector);
    require(groupId > 0, ActionNotPermitted());

    uint256 currentDay = block.timestamp / 1 days;
    UserUsage storage user = _usage[safe];
    GroupUsage storage group = user.groupUsage[groupId];
    if (group.day != uint40(currentDay)) {
      group.day = uint40(currentDay);
      group.count = 0;
    }
    uint256 currentUsage = group.count;

    uint256 limit = _registry.groupDailyLimits(groupId);
    require(currentUsage < limit, GroupLimitReached());

    uint256 currentNonce = user.nonce;
    bytes32 digest = _hashTypedDataV4(
      keccak256(
        abi.encode(
          SESSION_TYPEHASH,
          safe,
          target,
          keccak256(data),
          currentNonce,
          session.deadline
        )
      )
    );
    require(ECDSA.recover(digest, signature) == session.sessionKey, InvalidSignature());

    // 3. Increment for TODAY
    user.nonce = currentNonce + 1;
    group.count = uint40(currentUsage + 1);

    // 4. Verify Signature & Execute via Safe
    bool success = ISafe(safe).execTransactionFromModule(target, 0, data, Enum.Operation.Call);
    require(success, ModuleCallFailed());

    emit SessionNonceIncremented(safe, user.nonce);

    uint256 gasUsed = startGas - gasleft() + GAS_OVERHEAD + (data.length * 16) + (signature.length * 16);
    uint256 refundAmount = gasUsed * tx.gasprice;
    if (refundAmount > 0) {
      (bool refundSuccess, ) = msg.sender.call{value: refundAmount}(""); // Refund the relayer directly
      require(refundSuccess, RefundFailed());
    }
  }

  function setWhitelistedSigner(address[] calldata signers, bool whitelisted) external onlyOwner {
    for (uint256 i = 0; i < signers.length; i++) {
      _whitelistedSigners[signers[i]] = whitelisted;
    }
    emit WhitelistedSignersUpdated(signers, whitelisted);
  }

  function getSession(address safe) external view returns (Session memory) {
    return _sessions[safe];
  }

  receive() external payable {}
  fallback() external payable {}

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
