// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IPaintSwapArtGallery {
  function unlock() external;

  function inspect(
    address _painter
  )
    external
    view
    returns (
      uint256 lockedCount,
      uint256 lockedAmount,
      uint256 unlockableCount,
      uint256 unlockableAmount,
      uint256 nextUnlockTime,
      uint256 nextUnlockAmount
    );
}
