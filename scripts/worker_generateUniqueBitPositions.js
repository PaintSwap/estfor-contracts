const {ethers} = require("ethers");
const {parentPort, workerData} = require("worker_threads");

/**
 * Generates unique bit positions for each item in the Bloom filter.
 * @param {string[]} items Array of items to add to the Bloom filter (strings).
 * @param {number} hashCount Number of hash functions to use.
 * @param {bigint} bitCount Number of bits in the Bloom filter.
 * @returns {bigint[]} Set of unique bit positions for the Bloom filter.
 */
function generateUniqueBitPositions(items, hashCount, bitCount) {
  const positions = new Set();
  // console.log(`Worker thread using hash count: ${hashCount} and bit count: ${bitCount}`);

  for (const item of items) {
    const itemHash = ethers.solidityPackedKeccak256(["string"], [item.trim().toLowerCase()]);

    for (let i = 0n; i < hashCount; i++) {
      const position = BigInt(ethers.solidityPackedKeccak256(["bytes32", "uint8"], [itemHash, i])) % bitCount;
      positions.add(position); // Automatically prevents duplicate entries
    }
  }

  const positionsArray = [...positions];
  positionsArray.sort((a, b) => Number(a) - Number(b));
  return positionsArray;
}

if (parentPort) {
  const {items, hashCount, bitCount, existing} = workerData;
  const positions = generateUniqueBitPositions(items, hashCount, bitCount, existing);
  parentPort.postMessage(positions);
}
