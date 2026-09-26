// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Completeness is intrinsic only for proxies initialized with indexed writes.
/// LegacyAttested means the owner asserts that all legacy keys were registered or cleared.
/// The contract cannot verify that assertion over an arbitrary mapping keyspace.
enum DiscoveryStatus {
  Incomplete,
  Complete,
  LegacyAttested
}

interface IReconciliationDiscovery {
  error InvalidDiscoveryRange();
  error InvalidDiscoveryAttestation();

  event LegacyDiscoveryAttested(bytes32 indexed evidenceHash);

  function discoveryStatus() external view returns (DiscoveryStatus);

  /// @notice Attest after registering or clearing EVERY legacy configured key.
  /// @param evidenceHash Nonzero hash of the externally verified legacy inventory and its provenance.
  /// @dev Owner trust is required. This does not prove that omitted mapping keys are empty.
  function attestLegacyDiscovery(bytes32 evidenceHash) external;
}

interface IAvatarDiscovery is IReconciliationDiscovery {
  /// @notice Read index positions [start, end), not avatar ID ranges. Maximum page size is 1,024.
  /// @dev Pin all pages and the status to one block. Order can change on removal.
  /// Empty avatar structs are excluded; any nonzero field makes an avatar configured.
  function getAvatarIds(uint256 start, uint256 end) external view returns (uint256[] memory);
  function getAvatarCount() external view returns (uint256);

  /// @notice Index existing records without changing them. Duplicate and empty keys are harmless.
  /// @dev Registration alone never changes discoveryStatus.
  function registerLegacyAvatarIds(uint256[] calldata avatarIds) external;
}

interface IRewardTierDiscovery is IReconciliationDiscovery {
  /// @notice Read index positions [start, end), with a maximum page size of 1,024.
  /// @dev Pin counts, pages and status to one block. Order can change on removal.
  /// Daily and weekly indexes are independent. Only nonempty pools are configured.
  function getDailyRewardTiers(uint256 start, uint256 end) external view returns (uint256[] memory);
  function getWeeklyRewardTiers(uint256 start, uint256 end) external view returns (uint256[] memory);
  function getDailyRewardTierCount() external view returns (uint256);
  function getWeeklyRewardTierCount() external view returns (uint256);

  /// @notice Index existing pools without changing rewards or randomness.
  /// @dev Registration alone never changes discoveryStatus. Attestation covers BOTH indexes.
  function registerLegacyRewardTiers(uint256[] calldata dailyTiers, uint256[] calldata weeklyTiers) external;
}

interface ISubsidyFunctionDiscovery is IReconciliationDiscovery {
  /// @notice Read index positions [start, end), with a maximum page size of 1,024.
  /// @dev Pin count, pages and status to one block. Order can change on removal.
  /// Only nonzero function groups are configured, even if their daily limit is zero.
  /// Discovery status covers function mappings only, not the independent group-limit mapping.
  function getSubsidisedFunctions(
    uint256 start,
    uint256 end
  ) external view returns (address[] memory contracts_, bytes4[] memory selectors);
  function getSubsidisedFunctionCount() external view returns (uint256);

  /// @notice Index existing mappings without changing groups or limits.
  /// @dev Registration alone never changes discoveryStatus.
  function registerLegacyFunctions(address[] calldata contracts_, bytes4[] calldata selectors) external;
}
