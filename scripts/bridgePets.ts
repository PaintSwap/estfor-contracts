import {ethers} from "hardhat";
import {BRIDGE_ADDRESS, PET_NFT_ADDRESS} from "./contractAddresses";

async function main() {
  const [owner] = await ethers.getSigners();

  console.log(`Bridge some pets from ${owner.address} on chain: ${await owner.getChainId()}`);
  const bridge = (await ethers.getContractAt("Bridge", BRIDGE_ADDRESS)).connect(owner);

  const petNFT = (await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS)).connect(owner);
  const petIdStart = await petNFT.nextPetId();

  let tx = await petNFT.mintBatch(
    owner.address,
    [1, 4, 5],
    [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)]
  );
  await tx.wait();

  console.log(
    await petNFT.getOwner(petIdStart),
    await petNFT.getOwner(petIdStart + 1),
    await petNFT.getOwner(petIdStart + 2)
  );

  const bridgeFee = await bridge.quoteSendPets([petIdStart, petIdStart + 1, petIdStart + 2]);
  console.log(`Bridge fee: ${ethers.utils.formatEther(bridgeFee)}`);
  tx = await bridge.sendPets([petIdStart, petIdStart + 1, petIdStart + 2], {value: bridgeFee});
  const receipt = await tx.wait();
  console.log(`hash: ${receipt.transactionHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
