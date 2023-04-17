import {ethers} from "hardhat";
import {WORLD_ADDRESS, WORLD_LIBRARY_ADDRESS} from "./constants";

async function main() {
  const World = await ethers.getContractFactory("World", {libraries: {WorldLibrary: WORLD_LIBRARY_ADDRESS}});
  const world = await World.attach(WORLD_ADDRESS);
  const lastRandomWordsUpdatedTime = await world.lastRandomWordsUpdatedTime();
  if (lastRandomWordsUpdatedTime + 86400 < Math.floor(Date.now() / 1000)) {
    await world.requestRandomWords();
  } else {
    console.log("Cannot request random words yet");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
