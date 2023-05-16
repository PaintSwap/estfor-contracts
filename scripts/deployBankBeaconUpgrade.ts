import {ethers, upgrades} from "hardhat";
import {BANK_REGISTRY_ADDRESS, BANK_ADDRESS} from "./contractAddresses";
import {verifyContracts} from "./utils";

// Just to test that verifying the bank contract after an upgrade works ok
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

  // if is beta, then upgrade
  const isBeta = process.env.IS_BETA == "true";
  if (isBeta) {
    const BankRegistry = await ethers.getContractFactory("BankRegistry");
    const bankRegistry = BankRegistry.attach(BANK_REGISTRY_ADDRESS);
    await bankRegistry.setBankImpl(bankImplAddress);
    console.log("Upgraded beta bank implementation in registry");
  }
  await verifyContracts([bankImplAddress]);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
