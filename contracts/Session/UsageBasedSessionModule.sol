// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Enum} from "../interfaces/external/Enum.sol";
import {ISafe} from "../interfaces/external/ISafe.sol";
import {IGameSubsidisationRegistry} from "../interfaces/IGameSubsidisationRegistry.sol";
import {IUsageBasedSessionModule} from "../interfaces/IUsageBasedSessionModule.sol";

/// @title UsageBasedSessionModule
/// @notice A module for Gnosis Safe that allows for session keys with rate-limited actions
contract UsageBasedSessionModule is UUPSUpgradeable, OwnableUpgradeable, EIP712Upgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, IUsageBasedSessionModule {
  uint48 public constant override MAX_SESSION_DURATION = 30 days;
  uint256 public constant override MAX_BATCH_SIZE = 50;
  uint16 public constant override DEFAULT_SESSION_OPS_PER_DAY = 5;
  bytes32 private constant SESSION_TYPEHASH = keccak256(
    "UsageBasedSession(address safe,address target,bytes data,uint256 value,uint256 nonce,uint48 sessionDeadline)"
  );
  uint256 private constant FEEM_PROJECT_ID = 15;

  struct GroupUsage {
    uint40 day; // day number (UTC)
    uint40 count; // usage count for that day
  }

  struct UserUsage {
    mapping(uint256 => GroupUsage) groupUsage; // GroupID => usage for current day
    uint256 nonce;
  }

  IGameSubsidisationRegistry private _registry;
  mapping(address => Session) private _sessions; // Safe => Session
  mapping(address => UserUsage) private _usage; // Safe => Usage
  mapping(address => bool) private _whitelistedSigners;
  uint256 private _gasOverhead;
  uint16 private _sessionOpsPerDay;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(address owner, IGameSubsidisationRegistry registry) public override initializer {
    __Ownable_init(owner);
    __EIP712_init("UsageBasedSessionModule", "1");
    __ReentrancyGuard_init();
    __Pausable_init();
    _registry = registry;
    _gasOverhead = 30000; // 21000 base tx + 9k transfer
    _sessionOpsPerDay = DEFAULT_SESSION_OPS_PER_DAY;
  }

  /**
   * @notice Enables a session. Must be called BY THE SAFE
   */
  function enableSession(address _sessionKey, uint48 _duration) external override {
    require(_sessionKey != address(0), ZeroSessionKey());
    require(_duration > 0 && _duration <= MAX_SESSION_DURATION, InvalidSessionDuration());

    Session storage session = _sessions[msg.sender];

    uint32 today = uint32(block.timestamp / 1 days);
    if (session.opDay == today) {
      require(session.opCount < _sessionOpsPerDay, SessionOpsPerDayLimitReached());
      session.opCount += 1;
    } else {
      session.opDay = today;
      session.opCount = 1;
    }

    session.sessionKey = _sessionKey;
    session.deadline = uint48(block.timestamp) + _duration;

    emit SessionEnabled(msg.sender, _sessionKey, session.deadline);
  }

  /**
   * @notice Explicitly revoke the current session early. Must be called BY THE SAFE
   */
  function revokeSession() external override {
    uint32 today = uint32(block.timestamp / 1 days);
    Session storage session = _sessions[msg.sender];
    uint16 newOpCount;
    if (session.opDay == today) {
      require(session.opCount < _sessionOpsPerDay, SessionOpsPerDayLimitReached());
      newOpCount = session.opCount + 1;
    } else {
      newOpCount = 1;
    }

    delete _sessions[msg.sender];
    // Preserve daily op tracking so the delete doesn't reset the protection
    _sessions[msg.sender].opDay = today;
    _sessions[msg.sender].opCount = newOpCount;

    emit SessionRevoked(msg.sender);
  }

  function executeBatch(ExecuteParams[] calldata params) external override nonReentrant whenNotPaused {
    uint256 startGas = gasleft();
    require(_whitelistedSigners[msg.sender], UnauthorizedSigner());
    require(params.length > 0, NoBatchItems());
    require(params.length <= MAX_BATCH_SIZE, BatchTooLarge());

    uint256 successCount;
    for (uint256 i = 0; i < params.length; i++) {
      try this.executeSingle(params[i]) {
        ++successCount;
      } catch (bytes memory reason) {
        bytes4 selector = params[i].data.length >= 4 ? bytes4(params[i].data[0:4]) : bytes4(0);
        emit BatchItemFailed(params[i].safe, selector, reason);
      }
    }

    require(successCount > 0, AllItemsFailed()); // Prevent submission of single batch items that fail and waste gas repeatedly

    // Only refund if at least one item succeeded (prevents drain via all-failing batches)
    uint256 gasUsed = startGas - gasleft() + _gasOverhead + msg.data.length * 16;
    uint256 refundAmount = gasUsed * tx.gasprice;
    if (refundAmount > 0) {
      (bool refundSuccess, ) = msg.sender.call{value: refundAmount}(""); // Refund the relayer directly
      if (!refundSuccess) {
        emit RelayerRefundFailed(msg.sender, refundAmount);
      }
    }
  }

  /**
   * @notice Simulate executeBatch and return the gas consumed without committing state.
   * Intended to be called via eth_call (staticcall at the JSON-RPC level) by the relayer
   * to obtain an accurate gas estimate.
   *
   * Why this is needed: estimateGas binary-searches for the minimum gas at which the
   * outer function does not revert.  Because executeBatch wraps every sub-call in
   * try/catch, a probe with insufficient gas causes all sub-calls to silently OOG —
   * the outer function still returns normally — so the search converges on a value that
   * is many times too low (typically ~7× for a 7-item batch).  Calling simulateBatch
   * via eth_call runs the actual execution path with the full block gas budget and
   * returns the true gas consumed, which the relayer then uses as the gas limit.
   */
  function simulateBatch(ExecuteParams[] calldata params) external override nonReentrant whenNotPaused returns (uint256 gasUsed, uint256 successCount, bytes[] memory errors) {
    require(_whitelistedSigners[msg.sender], UnauthorizedSigner());
    require(params.length > 0, NoBatchItems());
    require(params.length <= MAX_BATCH_SIZE, BatchTooLarge());
    errors = new bytes[](params.length);
    uint256 startGas = gasleft();
    for (uint256 i = 0; i < params.length; i++) {
      try this.executeSingle(params[i]) {
        ++successCount;
      } catch (bytes memory reason) {
        errors[i] = reason;
      }
    }
    gasUsed = startGas - gasleft();
  }

  /**
   * @notice Helper to allow try/catch within executeBatch via an external call
  */
  function executeSingle(ExecuteParams calldata params) external override {
    require(msg.sender == address(this), OnlyInternal());
    _execute(params.safe, params.target, params.data, params.value, params.signature);
  }

  function _execute(address safe, address target, bytes calldata data, uint256 value, bytes calldata signature) internal {
    require(data.length >= 4, InvalidCallData());

    // 1. Basic Session Check
    Session memory session = _sessions[safe];
    require(session.sessionKey != address(0), NoSessionKey());
    require(session.deadline >= block.timestamp, SessionExpired());

    // 2. Identify the action (extract selector from data) — single registry call (M2 optimisation)
    bytes4 selector = bytes4(data[0:4]);
    (uint256 groupId, uint256 limit) = _registry.getGroupAndLimit(target, selector);
    require(groupId > 0, ActionNotPermitted());

    uint256 currentDay;
    unchecked {
      currentDay = block.timestamp / 1 days;
    }
    UserUsage storage user = _usage[safe];
    GroupUsage storage group = user.groupUsage[groupId];
    if (group.day != uint40(currentDay)) {
      group.day = uint40(currentDay);
      group.count = 0;
    }
    uint256 currentUsage = group.count;

    require(currentUsage < limit, GroupLimitReached());

    uint256 currentNonce = user.nonce;
    bytes32 digest = _hashTypedDataV4(
      keccak256(
        abi.encode(
          SESSION_TYPEHASH,
          safe,
          target,
          keccak256(data),
          value,
          currentNonce,
          session.deadline
        )
      )
    );
    require(ECDSA.recover(digest, signature) == session.sessionKey, InvalidSignature());

    // 3. Increment for TODAY
    user.nonce = currentNonce + 1;
    group.count = uint40(currentUsage + 1);

    // 4. Fund Safe with required value, then execute via Safe
    if (value > 0) {
      (bool funded, ) = safe.call{value: value}("");
      require(funded, ModuleCallFailed());
    }
    bool success = ISafe(safe).execTransactionFromModule(target, value, data, Enum.Operation.Call);
    require(success, ModuleCallFailed());

    emit SessionNonceIncremented(safe, user.nonce, groupId, group.count, group.day, limit);
  }

  function setWhitelistedSigner(address[] calldata signers, bool whitelisted) external override onlyOwner {
    for (uint256 i = 0; i < signers.length; i++) {
      require(signers[i] != address(0), ZeroAddress());
      _whitelistedSigners[signers[i]] = whitelisted;
    }
    emit WhitelistedSignersUpdated(signers, whitelisted);
  }

  function withdrawETH(address to, uint256 amount) external override onlyOwner {
    require(to != address(0), ZeroAddress());
    emit ETHWithdrawn(to, amount);
    (bool success, ) = to.call{value: amount}("");
    require(success, ModuleCallFailed());
  }

  function setRegistry(IGameSubsidisationRegistry registry) external override onlyOwner {
    require(address(registry) != address(0), ZeroAddress());
    _registry = registry;
    emit RegistryUpdated(address(registry));
  }

  function setGasOverhead(uint256 overhead) external override onlyOwner {
    _gasOverhead = overhead;
    emit GasOverheadUpdated(overhead);
  }

  function setSessionOpsPerDay(uint16 limit) external override onlyOwner {
    require(limit > 0, InvalidSessionDuration());
    _sessionOpsPerDay = limit;
    emit SessionOpsPerDayUpdated(limit);
  }

  function pause() external override onlyOwner {
    _pause();
  }

  function unpause() external override onlyOwner {
    _unpause();
  }

  function registerFeeM() external override {
    (bool _success,) = address(0xDC2B0D2Dd2b7759D97D50db4eabDC36973110830).call(
        abi.encodeWithSignature("selfRegister(uint256)", FEEM_PROJECT_ID)
    );
    require(_success, "FeeM registration failed");
  }

  function getGasOverhead() external view override returns (uint256) {
    return _gasOverhead;
  }

  function getSessionOpsPerDay() external view override returns (uint16) {
    return _sessionOpsPerDay;
  }

  function getSession(address safe) external view override returns (Session memory) {
    return _sessions[safe];
  }

  receive() external payable {}
  fallback() external payable {}

  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
