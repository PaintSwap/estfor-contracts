import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {BaseContract, Block, ContractTransactionReceipt, ContractTransactionResponse} from "ethers";
import {MockBrushToken, MockVRF, PlayerNFT, Players, Quests, RandomnessBeacon} from "../typechain-types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {allQuests, defaultMinRequirements, QuestInput} from "../scripts/data/quests";
import {SignerWithAddress} from "@nomicfoundation/hardhat-ethers/signers";

export const getRequestId = async (tx: ContractTransactionResponse, contract: BaseContract): Promise<number> => {
  return Number((await getEventLog(tx, contract, "RequestSent")).requestId);
};

export const getActionId = async (tx: ContractTransactionResponse, contract: BaseContract): Promise<number> => {
  return Number((await getEventLog(tx, contract, "AddActions")).actions[0].actionId);
};

export const getActionChoiceId = async (tx: ContractTransactionResponse, contract: BaseContract): Promise<number> => {
  return Number((await getEventLog(tx, contract, "AddActionChoices")).actionChoiceIds[0]);
};

export const getActionChoiceIds = async (
  tx: ContractTransactionResponse,
  contract: BaseContract
): Promise<number[]> => {
  return (await getEventLog(tx, contract, "AddActionChoices")).actionChoiceIds;
};

export const requestAndFulfillRandomWords = async (randomnessBeacon: RandomnessBeacon, mockVRF: MockVRF) => {
  const tx = await randomnessBeacon.requestRandomWords();
  let requestId = await getRequestId(tx, randomnessBeacon);
  expect(requestId).to.not.eq(null);
  expect(requestId).to.not.eq(0);
  return fulfillRandomWords(requestId as number, randomnessBeacon, mockVRF);
};

export const fulfillRandomWords = async (
  requestId: number | bigint,
  contract: BaseContract,
  mockVRF: MockVRF,
  gasPrice = 0n
): Promise<ContractTransactionResponse> => {
  return mockVRF.fulfill(requestId, contract, {gasPrice});
};

export const requestAndFulfillRandomWordsSeeded = async (
  randomnessBeacon: RandomnessBeacon,
  mockVRF: MockVRF,
  seed: bigint
) => {
  const tx = await randomnessBeacon.requestRandomWords();
  let requestId = await getRequestId(tx, randomnessBeacon);
  expect(requestId).to.not.eq(null);
  expect(requestId).to.not.eq(0);
  return fulfillRandomWordsSeeded(requestId as number, randomnessBeacon, mockVRF, seed, 0n);
};

export const fulfillRandomWordsSeeded = async (
  requestId: number | bigint,
  contract: BaseContract,
  mockVRF: MockVRF,
  seed: bigint,
  gasPrice = 0n
): Promise<ContractTransactionResponse> => {
  return mockVRF.fulfillSeeded(requestId, contract, seed, {gasPrice});
};

export const upgradePlayer = async (
  playerNFT: PlayerNFT,
  playerId: bigint,
  brush: MockBrushToken,
  upgradePlayerBrushPrice: bigint,
  signer: SignerWithAddress
) => {
  await brush.connect(signer).approve(playerNFT, upgradePlayerBrushPrice);
  await brush.mint(signer, upgradePlayerBrushPrice);
  // Upgrade player
  const upgrade = true;
  const name = await playerNFT.getName(playerId);
  await playerNFT.connect(signer).editPlayer(playerId, name, "", "", "", upgrade);
};

export const bronzeHelmetStats: EstforTypes.CombatStats = {
  meleeAttack: 1,
  magicAttack: 0,
  rangedAttack: 0,
  meleeDefence: 4,
  magicDefence: 0,
  rangedDefence: 1,
  health: 1
};

// Helper function to retrieve the event and return the desired property (e.g., actionId)
export const getEventLog = async (
  tx: ContractTransactionResponse,
  contract: BaseContract,
  eventName: string
): Promise<any> => {
  const receipt = (await tx.wait()) as ContractTransactionReceipt; // Wait for the transaction receipt
  return receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log); // Parse the log using the contract ABI
      } catch (error) {
        return null; // Ignore logs that don't match the contract ABI
      }
    })
    .find((parsedLog) => parsedLog && parsedLog.name === eventName)?.args; // Filter for the specific event
};
export const timeTravelToNextCheckpoint = async () => {
  const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
  return timeTravel(Math.floor(timestamp / 86400) * 86400 + 86400 - timestamp + 1);
};

export const timeTravel24Hours = async () => {
  return timeTravel(86400);
};

export const timeTravel = async (seconds: number | bigint) => {
  seconds = Number(seconds);
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
};

export const createAndDoPurseStringsQuest = async (
  players: Players,
  quests: Quests,
  signer: SignerWithAddress,
  playerId: bigint
) => {
  const quest = allQuests.find((q) => q.questId === EstforConstants.QUEST_PURSE_STRINGS) as QuestInput;
  await quests.addQuests([quest], [defaultMinRequirements]);
  const questId = quest.questId;
  await players.connect(signer).activateQuest(playerId, questId);
  await players.connect(signer).buyBrushQuest(signer, playerId, 0, true, {value: 10});
};

/**
 * Generates unique bit positions for each item in the Bloom filter.
 * @param items Array of items to add to the Bloom filter (strings).
 * @param existing Set of unique bit positions for the Bloom filter.
 * @param bitCount Number of bits in the Bloom filter.
 * @returns Set of unique bit positions for the Bloom filter.
 */
export function generateUniqueBitPositions(
  items: string[],
  existing: bigint[] = [],
  bitCount: bigint = 65536n
): bigint[] {
  const positions = new Set<bigint>(existing);
  const calculatedHashCount = (bitCount * 144n) / (BigInt(items.length) * 100n) + 1n;
  const hashCount = calculatedHashCount < 256n ? calculatedHashCount : 255n;

  for (const item of items) {
    const itemHash = ethers.solidityPackedKeccak256(["string"], [item.trim().toLowerCase()]);

    for (let i = 0n; i < hashCount; i++) {
      const position = BigInt(ethers.solidityPackedKeccak256(["bytes32", "uint8"], [itemHash, i])) % bitCount;
      positions.add(position); // Automatically prevents duplicate entries
    }
  }

  return [...positions];
}

export enum BattleResult {
  DRAW,
  WIN,
  LOSE
}

// see Initilizable.sol. keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Initializable")) - 1)) & ~bytes32(uint256(0xff))
export const initializerSlot = "0xf0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00";

// Should match the PlayersBase contract constants
export const MAX_TIME = 86400n; // 1 day
export const START_XP = 374n;
// 90%, used for actions/actionChoices which can have a failure rate like thieving/cooking
export const MAX_SUCCESS_PERCENT_CHANCE = 90n;
export const MAX_UNIQUE_TICKETS = 64; // This also affects passive action max days

export const SPAWN_MUL = 1000;
export const RATE_MUL = 1000;
export const GUAR_MUL = 10;
export const NO_DONATION_AMOUNT = 0n;
