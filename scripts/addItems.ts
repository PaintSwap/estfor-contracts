import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers} from "hardhat";
import {ITEM_NFT_ADDRESS} from "./contractAddresses";
import {allItems} from "./data/items";
import {initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Add shop items using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  const itemIds = new Set([EstforConstants.COSMETIC_001_AVATAR, EstforConstants.COSMETIC_002_AVATAR_BORDER]);

  const items = allItems.filter((item) => itemIds.has(item.tokenId));
  if (items.length !== itemIds.size) {
    console.log("Cannot find all items");
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const iface = new ethers.Interface([
        "function addItems(((int16 meleeAttack,int16 magicAttack,int16 rangedAttack,int16 health, int16 meleeDefence, int16 magicDefence, int16 rangedDefence) combatStats, uint16 tokenId, uint8 equipPosition, bool isTransferable, bool isFullModeOnly, bool isAvailable, uint16 questPrerequisiteId, uint8 skill, uint32 minXP, uint16 healthRestored, uint8 boostType, uint16 boostValue, uint24 boostDuration, string metadataURI, string name)[])",
      ]);
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
