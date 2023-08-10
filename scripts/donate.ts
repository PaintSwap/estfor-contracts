import {ethers} from "hardhat";
import {BRUSH_ADDRESS, WISHING_WELL_ADDRESS, PLAYERS_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Donating using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Players = await ethers.getContractFactory("Players");
  const players = Players.attach(PLAYERS_ADDRESS);

  const WishingWell = await ethers.getContractFactory("WishingWell");
  const wishingWell = WishingWell.attach(WISHING_WELL_ADDRESS);

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
