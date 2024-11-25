import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS, PASSIVE_ACTIONS_ADDRESS, PLAYERS_ADDRESS} from "./contractAddresses";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {getXPFromLevel} from "../test/Players/utils";
import {getChainId} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Deploying passive action test data using account: ${owner.address} on chain id ${await getChainId(owner)}`
  );

  const passiveActions = await ethers.getContractAt("PassiveActions", PASSIVE_ACTIONS_ADDRESS);
  const playerId = 1;
  const players = await ethers.getContractAt("Players", PLAYERS_ADDRESS);
  let tx = await players.modifyXP(owner.address, playerId, EstforTypes.Skill.ALCHEMY, getXPFromLevel(20));
  await tx.wait();

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);
  tx = await itemNFT.mintBatch(
    owner.address,
    [EstforConstants.PAPER, EstforConstants.BONEMEAL, EstforConstants.ASH],
    [10000, 100000, 100000]
  );
  await tx.wait();
  console.log("test Mint");

  tx = await passiveActions.startAction(playerId, EstforConstants.PASSIVE_ACTION_EGG_TIER1, 0);
  await tx.wait();
  console.log("Start action");

  tx = await passiveActions.claim(playerId);
  await tx.wait();
  console.log("Claim action");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
