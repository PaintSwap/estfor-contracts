import {ethers} from "hardhat";
import {BRUSH_ADDRESS, WISHING_WELL_ADDRESS, PLAYERS_ADDRESS} from "./contractAddresses";
import {Players, WishingWell} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Donating using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const players = (await ethers.getContractAt("Players", PLAYERS_ADDRESS)) as Players;

  const wishingWell = (await ethers.getContractAt("WishingWell", WISHING_WELL_ADDRESS)) as WishingWell;
  const raffleCost = await wishingWell.getRaffleEntryCost();
  const brush = await ethers.getContractAt("IERC20", BRUSH_ADDRESS);
  let tx = await brush.approve(wishingWell.address, ethers.utils.parseEther("1000"));
  await tx.wait();
  const playerId = 1;
  await players.donate(playerId, raffleCost);
  await players.donate(0, raffleCost.add(ethers.utils.parseEther("1")));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
