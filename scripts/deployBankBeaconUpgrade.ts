import {ethers, upgrades} from "hardhat";
import {BANK_ADDRESS, BANK_REGISTRY_ADDRESS} from "./contractAddresses";
import {getChainId, isBeta, verifyContracts} from "./utils";
import {BankRegistry} from "../typechain-types";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Deploying upgradeable bank beacon contract with the account: ${
      owner.address
    } on chain id ${await getChainId(owner)}`,
  );

  const Bank = await ethers.getContractFactory("Bank");
  const bank = await upgrades.upgradeBeacon(BANK_ADDRESS, Bank);
  console.log("Deployed bank beacon", await bank.getAddress());
  await bank.waitForDeployment();

  const bankImplAddress = await upgrades.beacon.getImplementationAddress(BANK_ADDRESS);
  console.log("bankImplAddress", bankImplAddress);
  await verifyContracts([bankImplAddress, await bank.getAddress()]);

  if (isBeta) {
    // Also update the old first week's beta clans
    const bankRegistry = (await ethers.getContractAt("BankRegistry", BANK_REGISTRY_ADDRESS)) as BankRegistry;
    await bankRegistry.setBankImpl(bankImplAddress);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
