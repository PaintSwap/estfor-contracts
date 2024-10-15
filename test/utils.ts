import {EstforTypes} from "@paintswap/estfor-definitions";
import {BaseContract, Block, ContractTransactionReceipt, ContractTransactionResponse} from "ethers";
import {MockVRF, World} from "../typechain-types";
import {expect} from "chai";
import {ethers} from "hardhat";

export const getRequestId = async (tx: ContractTransactionResponse, contract: BaseContract): Promise<number> => {
  return Number((await getEventLog(tx, contract, "RequestSent")).requestId);
};

export const getActionId = async (tx: ContractTransactionResponse, contract: BaseContract): Promise<number> => {
  return Number((await getEventLog(tx, contract, "AddActionsV2")).actions[0].actionId);
};

export const getActionChoiceId = async (tx: ContractTransactionResponse, contract: BaseContract): Promise<number> => {
  return Number((await getEventLog(tx, contract, "AddActionChoicesV4")).actionChoiceIds[0]);
};

export const getActionChoiceIds = async (
  tx: ContractTransactionResponse,
  contract: BaseContract
): Promise<number[]> => {
  return (await getEventLog(tx, contract, "AddActionChoicesV4")).actionChoiceIds;
};

export const requestAndFulfillRandomWords = async (world: World, mockVRF: MockVRF) => {
  const tx = await world.requestRandomWords();
  let requestId = await getRequestId(tx, world);
  expect(requestId).to.not.eq(null);
  expect(requestId).to.not.eq(0);
  await fulfillRandomWords(requestId as number, world, mockVRF);
};

export const fulfillRandomWords = async (
  requestId: number,
  contract: BaseContract,
  mockVRF: MockVRF,
  gasPrice = 0n
): Promise<ContractTransactionResponse> => {
  return mockVRF.fulfill(requestId, await contract.getAddress(), {gasPrice});
};

export const bronzeHelmetStats: EstforTypes.CombatStats = {
  melee: 1,
  magic: 0,
  ranged: 0,
  meleeDefence: 4,
  magicDefence: 0,
  rangedDefence: 1,
  health: 1,
};

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

export const timeTravel = async (seconds: number) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
};
