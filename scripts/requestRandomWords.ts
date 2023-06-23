import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Request random words using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);
  const lastRandomWordsUpdatedTime = await world.lastRandomWordsUpdatedTime();
  if (lastRandomWordsUpdatedTime + 86400 < Math.floor(Date.now() / 1000)) {
    await world.requestRandomWords();
  } else {
    console.log("Cannot request random words yet");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
