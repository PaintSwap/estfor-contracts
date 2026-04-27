import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, upgrades} from "hardhat";
import {ITEM_NFT_ADDRESS, ITEM_NFT_LIBRARY_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {ItemNFT__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Add items using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  const itemIds = new Set([
    EstforConstants.TITLE_WQ1_TOP5,
    EstforConstants.TITLE_WQ1_TOP50,
    EstforConstants.TITLE_WQ1_ALL,
    EstforConstants.MOUNTAIN_ROOT_SHIELD,
    EstforConstants.PET_SHARD,
    EstforConstants.BOOST_STABLILIZER_10,
    EstforConstants.COSMETIC_RIFT_HAT,
  ]);

  const items = allItems.filter((item) => itemIds.has(item.tokenId));
  if (items.length !== itemIds.size) {
    console.log("Cannot find all items");
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const iface = ItemNFT__factory.createInterface();

      transactionSet.push({
        to: ethers.getAddress(ITEM_NFT_ADDRESS),
        value: "0",
        data: iface.encodeFunctionData("addItems", [items]),
        operation: OperationType.Call,
      });
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
    } else {
      await itemNFT.addItems(items);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
