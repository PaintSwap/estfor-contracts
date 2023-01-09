import {ethers} from "hardhat";
import {createPlayer, Items} from "./utils";

async function main() {
  const [owner, alice] = await ethers.getSigners();

  const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
  const mockBrushToken = await MockBrushToken.deploy();

  // Create NFT contract which contains all items & players
  const NFT = await ethers.getContractFactory("TestPaintScapeNFT");
  const nft = await NFT.deploy(mockBrushToken.address);
  await nft.deployed();
  console.log(`NFT deployed at ${nft.address.toLowerCase()}`);

  // Create player
  const player = await createPlayer(nft, alice);
  console.log(`Player deployed at ${player.address.toLowerCase()}`);

  const maxTime = await player.MAX_TIME();
  const maxWeight = await player.MAX_WEIGHT_PER_SLOT();

  // Test stuff
  await player.connect(alice).paint();
  await ethers.provider.send("evm_increaseTime", [1]);
  await player.connect(alice).consumeLastSkill();
  await player.connect(alice).paint();

  await nft.testMint(alice.address, Items.SHIELD, 1);
  await player.connect(alice).addToInventory(Items.SHIELD, 1);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
