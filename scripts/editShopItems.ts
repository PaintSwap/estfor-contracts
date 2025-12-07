import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {allShopItems, allShopItemsBeta} from "./data/shopItems";
import {initialiseSafe, sendTransactionSetToSafe, isBeta} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Edit shop items using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
  const _allShopItems = isBeta ? allShopItemsBeta : allShopItems;
  const items = new Set([..._allShopItems.map((item) => item.tokenId)]);
  const shopItems = _allShopItems.filter((shopItem) => items.has(shopItem.tokenId));

  if (shopItems.length !== items.size) {
    console.log("Cannot find shop items");
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const shopIface = new ethers.Interface(["function editItems((uint16 tokenId,uint128 price)[])"]);
      transactionSet.push({
        to: ethers.getAddress(SHOP_ADDRESS),
        value: "0",
        data: shopIface.encodeFunctionData("editItems", [shopItems]),
        operation: OperationType.Call
      });
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
    } else {
      await shop.editItems(shopItems);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
