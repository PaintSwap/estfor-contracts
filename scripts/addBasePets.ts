import {ethers, upgrades} from "hardhat";
import {PET_NFT_ADDRESS, ESTFOR_LIBRARY_ADDRESS, PET_NFT_LIBRARY_ADDRESS} from "./contractAddresses";
import {allBasePets} from "./data/pets";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe, verifyContracts} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {PetNFT__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Add base pets using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const petNFT = await ethers.getContractAt("PetNFT", PET_NFT_ADDRESS);
  const basePetIds = new Set([
    EstforConstants.PET_ANNIV3_MELEE_TIER1,
    EstforConstants.PET_ANNIV3_MELEE_TIER2,
    EstforConstants.PET_ANNIV3_MELEE_TIER3,
    EstforConstants.PET_ANNIV3_MELEE_TIER4,
    EstforConstants.PET_ANNIV3_MELEE_TIER5,
    EstforConstants.PET_ANNIV3_MAGIC_TIER1,
    EstforConstants.PET_ANNIV3_MAGIC_TIER2,
    EstforConstants.PET_ANNIV3_MAGIC_TIER3,
    EstforConstants.PET_ANNIV3_MAGIC_TIER4,
    EstforConstants.PET_ANNIV3_MAGIC_TIER5,
    EstforConstants.PET_ANNIV3_RANGED_TIER1,
    EstforConstants.PET_ANNIV3_RANGED_TIER2,
    EstforConstants.PET_ANNIV3_RANGED_TIER3,
    EstforConstants.PET_ANNIV3_RANGED_TIER4,
    EstforConstants.PET_ANNIV3_RANGED_TIER5,
    EstforConstants.PET_ANNIV3_DEFENCE_TIER1,
    EstforConstants.PET_ANNIV3_DEFENCE_TIER2,
    EstforConstants.PET_ANNIV3_DEFENCE_TIER3,
    EstforConstants.PET_ANNIV3_DEFENCE_TIER4,
    EstforConstants.PET_ANNIV3_DEFENCE_TIER5,
    EstforConstants.PET_ANNIV3_HEALTH_TIER1,
    EstforConstants.PET_ANNIV3_HEALTH_TIER2,
    EstforConstants.PET_ANNIV3_HEALTH_TIER3,
    EstforConstants.PET_ANNIV3_HEALTH_TIER4,
    EstforConstants.PET_ANNIV3_HEALTH_TIER5,
    EstforConstants.PET_ANNIV3_MELEE_AND_DEFENCE_TIER1,
    EstforConstants.PET_ANNIV3_MELEE_AND_DEFENCE_TIER2,
    EstforConstants.PET_ANNIV3_MELEE_AND_DEFENCE_TIER3,
    EstforConstants.PET_ANNIV3_MELEE_AND_DEFENCE_TIER4,
    EstforConstants.PET_ANNIV3_MELEE_AND_DEFENCE_TIER5,
    EstforConstants.PET_ANNIV3_MAGIC_AND_DEFENCE_TIER1,
    EstforConstants.PET_ANNIV3_MAGIC_AND_DEFENCE_TIER2,
    EstforConstants.PET_ANNIV3_MAGIC_AND_DEFENCE_TIER3,
    EstforConstants.PET_ANNIV3_MAGIC_AND_DEFENCE_TIER4,
    EstforConstants.PET_ANNIV3_MAGIC_AND_DEFENCE_TIER5,
    EstforConstants.PET_ANNIV3_RANGED_AND_DEFENCE_TIER1,
    EstforConstants.PET_ANNIV3_RANGED_AND_DEFENCE_TIER2,
    EstforConstants.PET_ANNIV3_RANGED_AND_DEFENCE_TIER3,
    EstforConstants.PET_ANNIV3_RANGED_AND_DEFENCE_TIER4,
    EstforConstants.PET_ANNIV3_RANGED_AND_DEFENCE_TIER5,
  ]);

  const basePets = allBasePets.filter((basePet) => basePetIds.has(basePet.baseId));
  const chunkSize = 20;
  for (let i = 0; i < basePets.length; i += chunkSize) {
    const chunk = basePets.slice(i, i + chunkSize);
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const iface = PetNFT__factory.createInterface();

      transactionSet.push({
        to: ethers.getAddress(PET_NFT_ADDRESS),
        value: "0",
        data: iface.encodeFunctionData("addBasePets", [chunk]),
        operation: OperationType.Call,
      });
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
    } else {
      const tx = await petNFT.addBasePets(chunk);
      await tx.wait();
    }
    console.log("Add base pets chunk ", i);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
