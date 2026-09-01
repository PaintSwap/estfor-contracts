// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../contracts/globals/actions.sol";
import "../../contracts/globals/clans.sol";
import "../../contracts/globals/items.sol";
import "../../contracts/globals/misc.sol";
import "../../contracts/globals/pets.sol";
import "../../contracts/globals/players.sol";
import "../../contracts/globals/promotions.sol";
import "../../contracts/globals/quests.sol";
import "../../contracts/globals/rewards.sol";

interface UsageBasedSessionModule {
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
    function DEFAULT_SESSION_OPS_PER_DAY() external view returns (uint16);
    function MAX_BATCH_SIZE() external view returns (uint256);
    function MAX_SESSION_DURATION() external view returns (uint48);
    function UPGRADE_INTERFACE_VERSION() external view returns (string memory);
    function eip712Domain()
        external
        view
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        );
    function enableSession(address _sessionKey, uint48 _duration) external;
    function executeBatch(UsageBasedSessionModule.ExecuteParams[] calldata params) external;
    function executeSingle(UsageBasedSessionModule.ExecuteParams calldata params) external;
    function getGasOverhead() external view returns (uint256);
    function getSession(address safe) external view returns (UsageBasedSessionModule.Session memory);
    function getSessionOpsPerDay() external view returns (uint16);
    function initialize(address owner, address registry) external;
    function owner() external view returns (address);
    function pause() external;
    function paused() external view returns (bool);
    function proxiableUUID() external view returns (bytes32);
    function registerFeeM() external;
    function renounceOwnership() external;
    function revokeSession() external;
    function setGasOverhead(uint256 overhead) external;
    function setRegistry(address registry) external;
    function setSessionOpsPerDay(uint16 limit) external;
    function setWhitelistedSigner(address[] calldata signers, bool whitelisted) external;
    function simulateBatch(UsageBasedSessionModule.ExecuteParams[] calldata params)
        external
        returns (uint256 gasUsed, uint256 successCount, bytes[] memory errors);
    function transferOwnership(address newOwner) external;
    function unpause() external;
    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
    function withdrawETH(address to, uint256 amount) external;
    event BatchItemFailed(address indexed safe, bytes4 selector, bytes errorData);
    event EIP712DomainChanged();
    event ETHWithdrawn(address indexed to, uint256 amount);
    event GasOverheadUpdated(uint256 newOverhead);
    event Initialized(uint64 version);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event RegistryUpdated(address indexed newRegistry);
    event RelayerRefundFailed(address indexed relayer, uint256 amount);
    event SessionEnabled(address indexed safe, address indexed sessionKey, uint48 deadline);
    event SessionNonceIncremented(
        address indexed safe,
        uint256 newNonce,
        uint256 groupId,
        uint256 groupUsageCount,
        uint256 groupUsageDay,
        uint256 groupUsageLimit
    );
    event SessionOpsPerDayUpdated(uint16 newLimit);
    event SessionRevoked(address indexed safe);
    event Unpaused(address account);
    event Upgraded(address indexed implementation);
    event WhitelistedSignersUpdated(address[] signers, bool whitelisted);
    error ActionNotPermitted();
    error AddressEmptyCode(address target);
    error AllItemsFailed();
    error BatchTooLarge();
    error ECDSAInvalidSignature();
    error ECDSAInvalidSignatureLength(uint256 length);
    error ECDSAInvalidSignatureS(bytes32 s);
    error ERC1967InvalidImplementation(address implementation);
    error ERC1967NonPayable();
    error EnforcedPause();
    error ExpectedPause();
    error FailedCall();
    error GroupLimitReached();
    error InvalidCallData();
    error InvalidInitialization();
    error InvalidSessionDuration();
    error InvalidSignature();
    error ModuleCallFailed();
    error NoBatchItems();
    error NoSessionKey();
    error NotInitializing();
    error OnlyInternal();
    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error ReentrancyGuardReentrantCall();
    error SessionExpired();
    error SessionOpsPerDayLimitReached();
    error UUPSUnauthorizedCallContext();
    error UUPSUnsupportedProxiableUUID(bytes32 slot);
    error UnauthorizedSigner();
    error ZeroAddress();
    error ZeroSessionKey();
}
