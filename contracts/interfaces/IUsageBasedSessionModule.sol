// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IGameSubsidisationRegistry} from "./IGameSubsidisationRegistry.sol";

interface IUsageBasedSessionModule {
  struct ExecuteParams {
    address safe;
    address target;
    bytes data;
    uint256 value;
    bytes signature;
  }

  struct Session {
    address sessionKey;
    uint48 deadline;
    uint32 opDay;
    uint16 opCount;
  }

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
  error OnlyInternal();
  error NoBatchItems();
  error BatchTooLarge();
  error ZeroAddress();
  error SessionOpsPerDayLimitReached();
  error AllItemsFailed();

  event SessionEnabled(address indexed safe, address indexed sessionKey, uint48 deadline);
  event SessionRevoked(address indexed safe);
  event SessionNonceIncremented(
    address indexed safe,
    uint256 newNonce,
    uint256 groupId,
    uint256 groupUsageCount,
    uint256 groupUsageDay,
    uint256 groupUsageLimit
  );
  event WhitelistedSignersUpdated(address[] signers, bool whitelisted);
  event BatchItemFailed(address indexed safe, bytes4 selector, bytes errorData);
  event RelayerRefundFailed(address indexed relayer, uint256 amount);
  event GasOverheadUpdated(uint256 newOverhead);
  event RegistryUpdated(address indexed newRegistry);
  event ETHWithdrawn(address indexed to, uint256 amount);
  event SessionOpsPerDayUpdated(uint16 newLimit);

  function MAX_SESSION_DURATION() external view returns (uint48);
  function MAX_BATCH_SIZE() external view returns (uint256);
  function DEFAULT_SESSION_OPS_PER_DAY() external view returns (uint16);
  function initialize(address owner, IGameSubsidisationRegistry registry) external;
  function enableSession(address sessionKey, uint48 duration) external;
  function revokeSession() external;
  function executeBatch(ExecuteParams[] calldata params) external;
  function simulateBatch(
    ExecuteParams[] calldata params
  ) external returns (uint256 gasUsed, uint256 successCount, bytes[] memory errors);
  function executeSingle(ExecuteParams calldata params) external;
  function setWhitelistedSigner(address[] calldata signers, bool whitelisted) external;
  function withdrawETH(address to, uint256 amount) external;
  function setRegistry(IGameSubsidisationRegistry registry) external;
  function setGasOverhead(uint256 overhead) external;
  function setSessionOpsPerDay(uint16 limit) external;
  function pause() external;
  function unpause() external;
  function registerFeeM() external;
  function getGasOverhead() external view returns (uint256);
  function getSessionOpsPerDay() external view returns (uint16);
  function getSession(address safe) external view returns (Session memory);
}
