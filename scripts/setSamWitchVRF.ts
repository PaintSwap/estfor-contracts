import {ethers} from "hardhat";
import {LOCKED_BANK_VAULT_ADDRESS, SAMWITCH_VRF_ADDRESS, TERRITORIES_ADDRESS} from "./contractAddresses";
import {LockedBankVaults, Territories} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Set setSamWitchVRF using account: ${owner.address} on chain id ${await owner.getChainId()}`);

  const lockedBankVaults = (await ethers.getContractAt(
    "LockedBankVaults",
    LOCKED_BANK_VAULT_ADDRESS
  )) as LockedBankVaults;
  let tx = await lockedBankVaults.setSamWitchVRF(SAMWITCH_VRF_ADDRESS);
  await tx.wait();

  const territories = (await ethers.getContractAt("Territories", TERRITORIES_ADDRESS)) as Territories;
  tx = await territories.setSamWitchVRF(SAMWITCH_VRF_ADDRESS);
  await tx.wait();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
