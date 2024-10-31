// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/structs/BitMaps.sol";

library BloomFilter {
  using BitMaps for BitMaps.BitMap;

  struct Filter {
    uint8 hashCount; // Number of hash functions to use
    uint64 bitCount; // Number of bits in the bitmap
    BitMaps.BitMap bitmap; // Bitmap using OpenZeppelin’s BitMaps library to support up to 65,536 bits
  }

  error ZeroHashCount();

  /**
   * @notice Calculates the optimal number of hash functions based on the expected number of items.
   * @param expectedItems Expected number of items to be added to the filter.
   * @param bitCount Number of bits in the bitmap.
   * @return hashCount The number of hash functions to be used.
   */
  function _getOptimalHashCount(uint256 expectedItems, uint64 bitCount) internal pure returns (uint8 hashCount) {
    uint256 calculatedHashCount = (bitCount * 144) / (expectedItems * 100) + 1;
    hashCount = calculatedHashCount < 256 ? uint8(calculatedHashCount) : 255;
  }

  /**
   * @notice Adds a `bytes32` item to the filter by setting bits in the bitmap.
   * @param filter The Bloom filter to update.
   * @param item Hash value of the item to add.
   */
  function _add(Filter storage filter, bytes32 item) internal {
    if (filter.hashCount == 0) revert ZeroHashCount();
    uint64 bitCount = filter.bitCount;
    for (uint8 i = 0; i < filter.hashCount; i++) {
      uint256 position = uint256(keccak256(abi.encodePacked(item, i))) % bitCount;
      filter.bitmap.set(position); // Set the bit in the bitmap at the calculated position
    }
  }

  /**
   * @notice Adds a string to the filter by hashing it and setting bits in the bitmap.
   * @param filter The Bloom filter to update.
   * @param item String to add to the filter.
   */
  function _addString(Filter storage filter, string memory item) internal {
    bytes32 itemHash = keccak256(abi.encodePacked(item));
    _add(filter, itemHash);
  }

  /**
   * @notice Checks if a `bytes32` item is probably present in the filter or definitely not present.
   * @param filter The Bloom filter to check.
   * @param item Hash value of the item to check.
   * @return probablyPresent True if the item may exist, false if it definitely does not exist.
   */
  function _probablyContains(Filter storage filter, bytes32 item) internal view returns (bool probablyPresent) {
    if (filter.hashCount == 0) revert ZeroHashCount();
    uint64 bitCount = filter.bitCount;
    for (uint8 i = 0; i < filter.hashCount; i++) {
      uint256 position = uint256(keccak256(abi.encodePacked(item, i))) % bitCount;
      if (!filter.bitmap.get(position)) return false; // If any bit is not set, item is not present
    }
    return true;
  }

  /**
   * @notice Checks if a string is probably present in the filter or definitely not present.
   * @param filter The Bloom filter to check.
   * @param item String to check in the filter.
   * @return probablyPresent True if the item may exist, false if it definitely does not exist.
   */
  function _probablyContainsString(
    Filter storage filter,
    string memory item
  ) internal view returns (bool probablyPresent) {
    bytes32 itemHash = keccak256(abi.encodePacked(item));
    return _probablyContains(filter, itemHash);
  }

  function _defaults(Filter storage filter) internal {
    filter.hashCount = 8;
    filter.bitCount = 65536; // Default to 65,536 bits
    delete filter.bitmap; // Clear the bitmap
  }

  /**
   * @notice Initializes a Bloom filter with a specified hash count.
   * @param filter The Bloom filter to initialize.
   */
  function _initialize(Filter storage filter) internal {
    _defaults(filter);
  }

  /**
   * @notice Initializes a Bloom filter with a specified hash count.
   * @param filter The Bloom filter to initialize.
   * @param itemCount The number of expected items.
   */
  function _initialize(Filter storage filter, uint256 itemCount) internal {
    _defaults(filter);
    filter.hashCount = _getOptimalHashCount(itemCount, filter.bitCount);
  }

  /**
   * @notice Initializes a Bloom filter with a specified hash count.
   * @param filter The Bloom filter to initialize.
   * @param itemCount The number of expected items.
   * @param bitCount The number of bits in the bitmap.
   */
  function _initialize(Filter storage filter, uint256 itemCount, uint64 bitCount) internal {
    _defaults(filter);
    filter.bitCount = bitCount;
    filter.hashCount = _getOptimalHashCount(itemCount, bitCount);
  }

  /**
   * @notice Initializes a Bloom filter with a specified hash count and clears the bitmap.
   * @param filter The Bloom filter to initialize.
   * @param itemCount The number of expected items.
   * @param positions Array of positions to set in the bitmap.
   */
  function _initialize(Filter storage filter, uint256 itemCount, uint256[] calldata positions) internal {
    _initialize(filter, itemCount);
    for (uint256 i = 0; i < positions.length; i++) {
      filter.bitmap.set(positions[i]);
    }
  }

  /**
   * @notice Initializes a Bloom filter with a specified hash count and clears the bitmap.
   * @param filter The Bloom filter to initialize.
   * @param itemCount The number of hash functions to use.
   * @param bitCount The number of bits in the bitmap.
   * @param positions Array of positions to set in the bitmap.
   */
  function _initialize(
    Filter storage filter,
    uint256 itemCount,
    uint64 bitCount,
    uint256[] calldata positions
  ) internal {
    _initialize(filter, itemCount, bitCount);
    for (uint256 i = 0; i < positions.length; i++) {
      filter.bitmap.set(positions[i]);
    }
  }
}
