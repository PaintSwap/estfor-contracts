import {ethers, upgrades} from "hardhat";
import {
  deployPlayerImplementations,
  getSafeUpgradeTransaction,
  initialiseSafe,
  sendTransactionSetToSafe,
  verifyContracts,
} from "./utils";
import {MetaTransactionData, OperationType} from "@safe-global/types-kit";
import {
  BRUSH_ADDRESS,
  DEV_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  ITEM_NFT_ADDRESS,
  PET_NFT_ADDRESS,
  PET_NFT_LIBRARY_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  VRF_ADDRESS,
} from "./contractAddresses";
import {allOrderBookTokenIdInfos} from "./data/orderbookTokenIdInfos";
import {ItemNFT__factory, OrderBook__factory, PetNFT__factory, Players__factory} from "../typechain-types";

const DAO_MULTISIG_ADDRESS = "0xC7073F6317813C3EDB09FA2d19A6cA259A9d4aD9";
const MAX_ORDERS_PER_PRICE = 100;
const ORDERBOOK_TOKEN_INFO_CHUNK_SIZE = 100;

async function main() {
  const [, , proposer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  const timeout = 60 * 1000; // 1 minute

  console.log(
    `Deploy PetNFTReroll using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  if (!useSafe) {
    return;
  }

  if (
    process.env.SAFE_ADDRESS &&
    ethers.getAddress(process.env.SAFE_ADDRESS) !== ethers.getAddress(DAO_MULTISIG_ADDRESS)
  ) {
    throw new Error("SAFE_ADDRESS must match the DAO multisig address for this deployment");
  }

  const itemNFTIface = ItemNFT__factory.createInterface();
  const orderBookIface = OrderBook__factory.createInterface();
  const petNFTIface = PetNFT__factory.createInterface();
  const playersIface = Players__factory.createInterface();

  const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary", proposer);
  await itemNFTLibrary.waitForDeployment();
  console.log(`itemNFTLibrary = "${(await itemNFTLibrary.getAddress()).toLowerCase()}"`);

  const ItemNFT = await ethers.getContractFactory("ItemNFT", {
    libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()},
    signer: proposer,
  });
  const itemNFT = (await upgrades.prepareUpgrade(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as string;
  console.log(`itemNFT = "${itemNFT.toLowerCase()}"`);

  const PetNFT = await ethers.getContractFactory("PetNFT", {
    libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS, PetNFTLibrary: PET_NFT_LIBRARY_ADDRESS},
    signer: proposer,
  });
  const petNFT = (await upgrades.prepareUpgrade(PET_NFT_ADDRESS, PetNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  })) as string;
  console.log(`petNFT = "${petNFT.toLowerCase()}"`);

  const Players = await ethers.getContractFactory("Players", proposer);
  const players = (await upgrades.prepareUpgrade(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall"],
    timeout,
  })) as string;
  console.log(`players = "${players.toLowerCase()}"`);

  const playersLibrary = await ethers.getContractAt("PlayersLibrary", PLAYERS_LIBRARY_ADDRESS);
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(await playersLibrary.getAddress(), proposer);

  const PetNFTReroll = await ethers.getContractFactory("PetNFTReroll", proposer);
  const petNFTReroll = await upgrades.deployProxy(
    PetNFTReroll,
    [DAO_MULTISIG_ADDRESS, ITEM_NFT_ADDRESS, PET_NFT_ADDRESS, VRF_ADDRESS],
    {
      kind: "uups",
    }
  );
  await petNFTReroll.waitForDeployment();

  const petNFTRerollAddress = await petNFTReroll.getAddress();
  console.log(`petNFTReroll = "${petNFTRerollAddress.toLowerCase()}"`);

  // Price compression changes the stored order price representation, so existing live orders must stay on the old book.
  // Deploy a brand new OrderBook and seed it separately rather than upgrading the existing bazaar proxy in place.
  const OrderBook = await ethers.getContractFactory("OrderBook", proposer);
  const orderBook = await upgrades.deployProxy(
    OrderBook,
    [ITEM_NFT_ADDRESS, BRUSH_ADDRESS, DEV_ADDRESS, 30, 30, MAX_ORDERS_PER_PRICE],
    {
      kind: "uups",
      timeout,
    }
  );
  await orderBook.waitForDeployment();

  const orderBookAddress = await orderBook.getAddress();
  console.log(`orderBook = "${orderBookAddress.toLowerCase()}"`);

  const transferOwnershipTx = await orderBook.transferOwnership(DAO_MULTISIG_ADDRESS);
  await transferOwnershipTx.wait();
  console.log(`orderBook ownership transferred to "${DAO_MULTISIG_ADDRESS.toLowerCase()}"`);

  if (network.chainId == 146n) {
    await verifyContracts([await itemNFTLibrary.getAddress()]);
    await verifyContracts([petNFTRerollAddress, orderBookAddress]);
  }

  const transactionSet: MetaTransactionData[] = [
    getSafeUpgradeTransaction(ITEM_NFT_ADDRESS, itemNFT),
    getSafeUpgradeTransaction(PET_NFT_ADDRESS, petNFT),
    getSafeUpgradeTransaction(PLAYERS_ADDRESS, players),
    {
      to: ethers.getAddress(PLAYERS_ADDRESS),
      value: "0",
      data: playersIface.encodeFunctionData("setImpls", [
        await playersImplQueueActions.getAddress(),
        await playersImplProcessActions.getAddress(),
        await playersImplRewards.getAddress(),
        await playersImplMisc.getAddress(),
        await playersImplMisc1.getAddress(),
      ]),
      operation: OperationType.Call,
    },
    {
      to: ethers.getAddress(ITEM_NFT_ADDRESS),
      value: "0",
      data: itemNFTIface.encodeFunctionData("setApprovedBurners", [[petNFTRerollAddress], true]),
      operation: OperationType.Call,
    },
    {
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: petNFTIface.encodeFunctionData("setApprovedBurners", [[petNFTRerollAddress], true]),
      operation: OperationType.Call,
    },
    {
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: petNFTIface.encodeFunctionData("setApprovedMinters", [[petNFTRerollAddress], true]),
      operation: OperationType.Call,
    },
  ];

  for (let i = 0; i < allOrderBookTokenIdInfos.length; i += ORDERBOOK_TOKEN_INFO_CHUNK_SIZE) {
    const tokenIds: number[] = [];
    const tokenIdInfos: {tick: string; minQuantity: string}[] = [];
    const chunk = allOrderBookTokenIdInfos.slice(i, i + ORDERBOOK_TOKEN_INFO_CHUNK_SIZE);

    chunk.forEach((tokenIdInfo) => {
      tokenIds.push(tokenIdInfo.tokenId);
      tokenIdInfos.push({
        tick: tokenIdInfo.tick,
        minQuantity: tokenIdInfo.minQuantity,
      });
    });

    transactionSet.push({
      to: ethers.getAddress(orderBookAddress),
      value: "0",
      data: orderBookIface.encodeFunctionData("setTokenIdInfos", [tokenIds, tokenIdInfos]),
      operation: OperationType.Call,
    });
  }

  await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
