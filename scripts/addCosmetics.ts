import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, upgrades} from "hardhat";
import {COSMETICS_ADDRESS} from "./contractAddresses";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {Cosmetics__factory, ItemNFT__factory} from "../typechain-types";
import {cosmeticInfos, cosmeticTokenIds} from "./data/cosmetics";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Add cosmetics using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const cosmetics = await ethers.getContractAt("Cosmetics", COSMETICS_ADDRESS);

  const cosmeticIdsSet = new Set([EstforConstants.BORDER_002_RIFT]);

  const cosmeticItems = cosmeticTokenIds.filter((id) => cosmeticIdsSet.has(id));
  if (cosmeticItems.length !== cosmeticIdsSet.size) {
    console.log("Cannot find all items");
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const iface = Cosmetics__factory.createInterface();

      transactionSet.push({
        to: ethers.getAddress(COSMETICS_ADDRESS),
        value: "0",
        data: iface.encodeFunctionData("setCosmetics", [
          cosmeticItems,
          cosmeticInfos.filter((cosmetic) => cosmeticIdsSet.has(cosmetic.itemTokenId)),
        ]),
        operation: OperationType.Call,
      });
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
    } else {
      await cosmetics.setCosmetics(
        cosmeticItems,
        cosmeticInfos.filter((cosmetic) => cosmeticIdsSet.has(cosmetic.itemTokenId))
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
