import {ethers} from "hardhat";
import {
  BANK_FACTORY_ADDRESS,
  CLANS_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  PAINTSWAP_MARKETPLACE_WHITELIST,
  PLAYERS_ADDRESS,
  TERRITORIES_ADDRESS,
  RAIDS_ADDRESS
} from "./contractAddresses";
import {getChainId} from "./utils";
import {Clans} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Set PaintSwapMarketplaceWhitelist on Clans using account: ${owner.address} on chain id ${await getChainId(owner)}`
  );

  const clans = (await ethers.getContractAt("Clans", CLANS_ADDRESS)) as Clans;
  const tx = await clans.initializeAddresses(
    PLAYERS_ADDRESS,
    BANK_FACTORY_ADDRESS,
    TERRITORIES_ADDRESS,
    LOCKED_BANK_VAULTS_ADDRESS,
    RAIDS_ADDRESS,
    PAINTSWAP_MARKETPLACE_WHITELIST
  );
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
