import {ethers, upgrades} from "hardhat";
import {BANK_ADDRESS, BANK_REGISTRY_ADDRESS} from "./contractAddresses";
import {isBeta, verifyContracts} from "./utils";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying upgradeable contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const Bank = await ethers.getContractFactory("Bank");
  const bank = await upgrades.upgradeBeacon(BANK_ADDRESS, Bank);
  console.log("Deployed bank beacon", bank.address);
  await bank.deployed();

  const bankImplAddress = await upgrades.beacon.getImplementationAddress(BANK_ADDRESS);
  console.log("bankImplAddress", bankImplAddress);
  await verifyContracts([bankImplAddress]);

  if (isBeta) {
    // Also update the old first week's beta clans
    const BankRegistry = await ethers.getContractFactory("BankRegistry");
    const bankRegistry = await BankRegistry.attach(BANK_REGISTRY_ADDRESS);
    await bankRegistry.setBankImpl(bankImplAddress);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
