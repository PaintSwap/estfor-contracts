import {ethers} from "hardhat";
import {allOrderBookTokenIdInfos} from "./data/orderbookTokenIdInfos";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {BAZAAR_ADDRESS} from "./contractAddresses";
import {getSafeUpgradeTransaction, initialiseSafe, sendTransactionSetToSafe} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {OrderBook__factory} from "../typechain-types";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Setting token id infos with the account: ${owner.address} on chain id: ${network.chainId}, useSafe: ${useSafe}`
  );

  const orderBook = await ethers.getContractAt("OrderBook", BAZAAR_ADDRESS);
  const chunkSize = 100;

  const newTokenIds = new Set([
    EstforConstants.AVATAR_001_CHIMP,
    EstforConstants.BORDER_001_ARCANE_PORTAL,
    EstforConstants.SUPPORT_001_TROPHY,
    EstforConstants.WQ1_LORE_PAGE_1,
    EstforConstants.WQ1_LORE_PAGE_2,
    EstforConstants.WQ1_LORE_PAGE_3,
    EstforConstants.WQ1_LORE_PAGE_4,
    EstforConstants.WQ1_LORE_PAGE_5,
  ]);

  const orderBookTokenIdInfos = allOrderBookTokenIdInfos.filter((tokenIdInfo) => newTokenIds.has(tokenIdInfo.tokenId));

  for (let i = 0; i < orderBookTokenIdInfos.length; i += chunkSize) {
    const tokenIds: number[] = [];
    const tokenIdInfos: {tick: string; minQuantity: string}[] = [];
    const chunk = orderBookTokenIdInfos.slice(i, i + chunkSize);
    chunk.forEach((tokenIdInfo) => {
      tokenIds.push(tokenIdInfo.tokenId);
      tokenIdInfos.push({tick: tokenIdInfo.tick, minQuantity: tokenIdInfo.minQuantity});
    });
    if (useSafe) {
      const transactionSet: MetaTransactionData[] = [];
      const iface = OrderBook__factory.createInterface();

      transactionSet.push({
        to: ethers.getAddress(BAZAAR_ADDRESS),
        value: "0",
        data: iface.encodeFunctionData("setTokenIdInfos", [tokenIds, tokenIdInfos]),
        operation: OperationType.Call,
      });
      await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
    } else {
      const tx = await orderBook.setTokenIdInfos(tokenIds, tokenIdInfos);
      await tx.wait();
    }
    console.log("orderBook.setTokenIdInfos");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
