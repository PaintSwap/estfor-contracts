// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum BridgeableType {
  Player, // + Clan
  Pet,
  Item
}

interface IBridgeable {
  function getBridgeableType() external pure returns (BridgeableType);

  /**
   * @notice Returns the bytes representation of the token to be bridged.
   * @param tokenId The token ID to bridge.
   */
  function getBridgeableBytes(uint256 tokenId) external view returns (bytes memory);
}
