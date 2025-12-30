import {ethers} from "hardhat";
import {SHOP_ADDRESS} from "./contractAddresses";
import {allShopItems, allShopItemsBeta} from "./data/shopItems";
import {isBeta} from "./utils";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(`Add shop items using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`);

  const _allShopItems = isBeta ? allShopItemsBeta : allShopItems;
  const items = new Set([
    EstforConstants.XP_BOOST_M,
    EstforConstants.COMBAT_BOOST_M,
    EstforConstants.SKILL_BOOST_M,
    EstforConstants.GATHERING_BOOST_M,
    EstforConstants.XP_BOOST_L,
    EstforConstants.COMBAT_BOOST_L,
    EstforConstants.SKILL_BOOST_L,
    EstforConstants.GATHERING_BOOST_L,
    EstforConstants.XP_BOOST_XL,
    EstforConstants.COMBAT_BOOST_XL,
    EstforConstants.SKILL_BOOST_XL,
    EstforConstants.GATHERING_BOOST_XL
  ]);
  const shopItems = _allShopItems.filter((shopItem) => items.has(shopItem.tokenId));

  if (shopItems.length !== items.size) {
    console.log("Cannot find shop items");
  } else {
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const shopIface = new ethers.Interface(["function addBuyableItems((uint16 tokenId,uint128 price)[])"]);
      transactionSet.push({
        to: ethers.getAddress(SHOP_ADDRESS),
        value: "0",
        data: shopIface.encodeFunctionData("addBuyableItems", [shopItems]),
        operation: OperationType.Call
      });
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
    } else {
      const shop = await ethers.getContractAt("Shop", SHOP_ADDRESS);
      const tx = await shop.addBuyableItems(shopItems);
      await tx.wait();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
