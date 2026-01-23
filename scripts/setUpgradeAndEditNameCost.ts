import {ethers} from "hardhat";
import {
  CLANS_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYER_NFT_ADDRESS,
  WISHING_WELL_ADDRESS,
  WORLD_ACTIONS_ADDRESS,
} from "./contractAddresses";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe, isBeta} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {parseEther} from "ethers";
import {
  Clans__factory,
  PetNFT__factory,
  PlayerNFT__factory,
  WishingWell__factory,
  WorldActions__factory,
} from "../typechain-types";
import {allClanTiers, allClanTiersBeta} from "./data/clans";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Set upgrade/edit player costs on PlayerNFT using account: ${proposer.address} on chain id  ${network.chainId}, useSafe: ${useSafe}`
  );

  const playerNFT = await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS);
  const upgradeCost = isBeta ? parseEther("10") : parseEther("800");
  const editNameCost = isBeta ? parseEther("1") : parseEther("100");
  const editPetNameCost = isBeta ? parseEther("1") : parseEther("10");
  const wishingWellCost = isBeta ? parseEther("1") : parseEther("10");
  const clanTiers = isBeta ? allClanTiersBeta : allClanTiers;

  if (useSafe) {
    const transactionSet: MetaTransactionData[] = [];
    const iface = PlayerNFT__factory.createInterface();
    const clanIface = Clans__factory.createInterface();
    const petIface = PetNFT__factory.createInterface();
    const wishingWellIface = WishingWell__factory.createInterface();

    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setUpgradeCost", [upgradeCost]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setEditNameCost", [editNameCost]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(CLANS_ADDRESS),
      value: "0",
      data: clanIface.encodeFunctionData("setEditNameCost", [editNameCost]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(CLANS_ADDRESS),
      value: "0",
      data: clanIface.encodeFunctionData("editTiers", [clanTiers]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: petIface.encodeFunctionData("setEditNameCost", [editPetNameCost]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(WISHING_WELL_ADDRESS),
      value: "0",
      data: wishingWellIface.encodeFunctionData("setRaffleEntryCost", [wishingWellCost]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  } else {
    {
      const tx = await playerNFT.setUpgradeCost(upgradeCost);
      await tx.wait();
    }
    {
      let tx = await playerNFT.setEditNameCost(editNameCost);
      await tx.wait();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
