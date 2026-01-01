import {ethers, upgrades} from "hardhat";
import {
  BRUSH_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PET_NFT_LIBRARY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
} from "./contractAddresses";
import {initialiseSafe, sendTransactionSetToSafe, getSafeUpgradeTransaction, verifyContracts} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {Marketplace} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Deploy marketplace using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  const timeout = 300 * 1000; // 5 minutes

  if (useSafe) {
    const Marketplace = await ethers.getContractFactory("Marketplace", proposer);
    const marketplace = (await upgrades.deployProxy(Marketplace, [
      BRUSH_ADDRESS,
      process.env.SAFE_ADDRESS,
    ])) as unknown as Marketplace;
    await marketplace.waitForDeployment();
    console.log(`marketplace = "${(await marketplace.getAddress()).toLowerCase()}"`);

    // can verify this immediately
    if (network.chainId == 146n) {
      await verifyContracts([await marketplace.getAddress()]);
    }

    const petNFTLibrary = await ethers.getContractAt("PetNFTLibrary", PET_NFT_LIBRARY_ADDRESS);
    const estforLibrary = await ethers.getContractAt("EstforLibrary", ESTFOR_LIBRARY_ADDRESS);

    const PetNFT = await ethers.getContractFactory("PetNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress(), PetNFTLibrary: await petNFTLibrary.getAddress()},
      signer: proposer,
    });
    const petNFT = (await upgrades.prepareUpgrade(PET_NFT_ADDRESS, PetNFT, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    })) as string;
    console.log(`petNFT = "${petNFT.toLowerCase()}"`);

    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()},
      signer: proposer,
    });
    const playerNFT = (await upgrades.prepareUpgrade(PLAYER_NFT_ADDRESS, PlayerNFT, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    })) as string;
    console.log(`playerNFT = "${playerNFT.toLowerCase()}"`);

    const transactionSet: MetaTransactionData[] = [];
    const iface = new ethers.Interface([
      "function setMarketplaceAddress(address marketplaceAddress)",
      "function setApprovalForAll(address operator, bool approved)",
    ]);

    transactionSet.push(getSafeUpgradeTransaction(PLAYER_NFT_ADDRESS, playerNFT));
    transactionSet.push(getSafeUpgradeTransaction(PET_NFT_ADDRESS, petNFT));
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setMarketplaceAddress", [await marketplace.getAddress()]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setApprovalForAll", [await marketplace.getAddress(), true]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setMarketplaceAddress", [await marketplace.getAddress()]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setApprovalForAll", [await marketplace.getAddress(), true]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
