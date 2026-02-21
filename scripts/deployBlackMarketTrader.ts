import {ethers, upgrades} from "hardhat";
import {
  BRUSH_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PET_NFT_LIBRARY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  SHOP_ADDRESS,
  USDC_ADDRESS,
  GLOBAL_EVENT_ADDRESS,
  ITEM_NFT_ADDRESS,
  COSMETICS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  VRF_ADDRESS,
  BAZAAR_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
} from "./contractAddresses";
import {
  initialiseSafe,
  sendTransactionSetToSafe,
  getSafeUpgradeTransaction,
  verifyContracts,
  deployPlayerImplementations,
} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {
  Marketplace,
  Cosmetics,
  GlobalEvents,
  BlackMarketTrader,
  BlackMarketTrader__factory,
  Players__factory,
  ItemNFT__factory,
  OrderBook__factory,
  PetNFT__factory,
  InstantVRFActions__factory,
  PassiveActions__factory,
  Cosmetics__factory,
} from "../typechain-types";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {parseEther} from "ethers";
import {allItems} from "./data/items";
import {allBlackMarketItems} from "./data/blackMarketItems";
import {allOrderBookTokenIdInfos} from "./data/orderbookTokenIdInfos";
import {allBasePets} from "./data/pets";
import {allInstantVRFActions} from "./data/instantVRFActions";
import {allPassiveActions} from "./data/passiveActions";
import {cosmeticInfos, cosmeticTokenIds} from "./data/cosmetics";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Deploy blackMarketTrader using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  const timeout = 60 * 1000; // 1 minute

  const blackMarketTraderIface = BlackMarketTrader__factory.createInterface();
  const itemIface = ItemNFT__factory.createInterface();
  const orderbookIface = OrderBook__factory.createInterface();
  const petIface = PetNFT__factory.createInterface();
  const instantVRFActionIface = InstantVRFActions__factory.createInterface();
  const passiveActionIface = PassiveActions__factory.createInterface();
  const playersIface = Players__factory.createInterface();
  const cosmeticsIface = Cosmetics__factory.createInterface();

  if (useSafe) {
    /* BlackMarketTrader Release */
    const BlackMarketTrader = await ethers.getContractFactory("BlackMarketTrader", proposer);
    const blackMarketTrader = (await upgrades.deployProxy(BlackMarketTrader, [
      process.env.SAFE_ADDRESS,
      ITEM_NFT_ADDRESS,
      VRF_ADDRESS,
    ])) as unknown as BlackMarketTrader;
    await blackMarketTrader.waitForDeployment();
    console.log(`blackMarketTrader = "${(await blackMarketTrader.getAddress()).toLowerCase()}"`);

    // can verify this immediately
    if (network.chainId == 146n) {
      await verifyContracts([await blackMarketTrader.getAddress()]);
    }

    const estforLibrary = await ethers.getContractAt("EstforLibrary", ESTFOR_LIBRARY_ADDRESS);
    const petNFTLibrary = await ethers.deployContract("PetNFTLibrary", proposer);
    await petNFTLibrary.waitForDeployment();
    console.log(`petNFTLibrary = "${await petNFTLibrary.getAddress()}"`);
    const playersLibrary = await ethers.deployContract("PlayersLibrary", proposer);
    await playersLibrary.waitForDeployment();
    console.log(`playersLibrary = "${await playersLibrary.getAddress()}"`);

    const Players = await ethers.getContractFactory("Players", proposer);
    const players = (await upgrades.prepareUpgrade(PLAYERS_ADDRESS, Players, {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
      timeout,
    })) as string;
    console.log(`players = "${players.toLowerCase()}"`);

    const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
      await deployPlayerImplementations(await playersLibrary.getAddress(), proposer);

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

    const transactionSet: MetaTransactionData[] = [];
    const itemSet = new Set([
      EstforConstants.XP_BOOST_XL_UNSTABLE,
      EstforConstants.GATHERING_BOOST_XL_UNSTABLE,
      EstforConstants.RIFT_EGG_TIER1,
      EstforConstants.RIFT_EGG_TIER2,
      EstforConstants.RIFT_EGG_TIER3,
      EstforConstants.RIFT_EGG_TIER4,
      EstforConstants.RIFT_EGG_TIER5,
      EstforConstants.BORDER_002_RIFT,
      EstforConstants.ALCHEMY_HAT,
      EstforConstants.ALCHEMY_BODY,
      EstforConstants.ALCHEMY_TROUSERS,
      EstforConstants.ALCHEMY_BOOTS,
      EstforConstants.ALCHEMY_BRACERS,
    ]);
    const basePetIds = new Set([
      EstforConstants.PET_RIFT_ALCHEMY_TIER1,
      EstforConstants.PET_RIFT_ALCHEMY_TIER2,
      EstforConstants.PET_RIFT_ALCHEMY_TIER3,
      EstforConstants.PET_RIFT_ALCHEMY_TIER4,
      EstforConstants.PET_RIFT_ALCHEMY_TIER5,
    ]);
    const editBasePetIds = new Set([
      EstforConstants.PET_ANNIV1_MELEE_TIER1,
      EstforConstants.PET_ANNIV1_MELEE_TIER2,
      EstforConstants.PET_ANNIV1_MELEE_TIER3,
      EstforConstants.PET_ANNIV1_MELEE_TIER4,
      EstforConstants.PET_ANNIV1_MELEE_TIER5,
      EstforConstants.PET_ANNIV1_MAGIC_TIER1,
      EstforConstants.PET_ANNIV1_MAGIC_TIER2,
      EstforConstants.PET_ANNIV1_MAGIC_TIER3,
      EstforConstants.PET_ANNIV1_MAGIC_TIER4,
      EstforConstants.PET_ANNIV1_MAGIC_TIER5,
      EstforConstants.PET_ANNIV1_RANGED_TIER1,
      EstforConstants.PET_ANNIV1_RANGED_TIER2,
      EstforConstants.PET_ANNIV1_RANGED_TIER3,
      EstforConstants.PET_ANNIV1_RANGED_TIER4,
      EstforConstants.PET_ANNIV1_RANGED_TIER5,
      EstforConstants.PET_ANNIV1_DEFENCE_TIER1,
      EstforConstants.PET_ANNIV1_DEFENCE_TIER2,
      EstforConstants.PET_ANNIV1_DEFENCE_TIER3,
      EstforConstants.PET_ANNIV1_DEFENCE_TIER4,
      EstforConstants.PET_ANNIV1_DEFENCE_TIER5,
      EstforConstants.PET_ANNIV1_HEALTH_TIER1,
      EstforConstants.PET_ANNIV1_HEALTH_TIER2,
      EstforConstants.PET_ANNIV1_HEALTH_TIER3,
      EstforConstants.PET_ANNIV1_HEALTH_TIER4,
      EstforConstants.PET_ANNIV1_HEALTH_TIER5,
      EstforConstants.PET_ANNIV1_MELEE_AND_DEFENCE_TIER1,
      EstforConstants.PET_ANNIV1_MELEE_AND_DEFENCE_TIER2,
      EstforConstants.PET_ANNIV1_MELEE_AND_DEFENCE_TIER3,
      EstforConstants.PET_ANNIV1_MELEE_AND_DEFENCE_TIER4,
      EstforConstants.PET_ANNIV1_MELEE_AND_DEFENCE_TIER5,
      EstforConstants.PET_ANNIV1_MAGIC_AND_DEFENCE_TIER1,
      EstforConstants.PET_ANNIV1_MAGIC_AND_DEFENCE_TIER2,
      EstforConstants.PET_ANNIV1_MAGIC_AND_DEFENCE_TIER3,
      EstforConstants.PET_ANNIV1_MAGIC_AND_DEFENCE_TIER4,
      EstforConstants.PET_ANNIV1_MAGIC_AND_DEFENCE_TIER5,
      EstforConstants.PET_ANNIV1_RANGED_AND_DEFENCE_TIER1,
      EstforConstants.PET_ANNIV1_RANGED_AND_DEFENCE_TIER2,
      EstforConstants.PET_ANNIV1_RANGED_AND_DEFENCE_TIER3,
      EstforConstants.PET_ANNIV1_RANGED_AND_DEFENCE_TIER4,
      EstforConstants.PET_ANNIV1_RANGED_AND_DEFENCE_TIER5,
    ]);
    const instantVRFActions = new Set([
      EstforConstants.INSTANT_VRF_ACTION_RIFT_EGG_TIER1,
      EstforConstants.INSTANT_VRF_ACTION_RIFT_EGG_TIER2,
      EstforConstants.INSTANT_VRF_ACTION_RIFT_EGG_TIER3,
      EstforConstants.INSTANT_VRF_ACTION_RIFT_EGG_TIER4,
      EstforConstants.INSTANT_VRF_ACTION_RIFT_EGG_TIER5,
    ]);
    const passiveActions = new Set([
      EstforConstants.PASSIVE_ACTION_RIFT_EGG_TIER2,
      EstforConstants.PASSIVE_ACTION_RIFT_EGG_TIER3,
      EstforConstants.PASSIVE_ACTION_RIFT_EGG_TIER4,
      EstforConstants.PASSIVE_ACTION_RIFT_EGG_TIER5,
    ]);
    const cosmetics = new Set([EstforConstants.BORDER_002_RIFT]);
    const orderBookTokenIdInfos = allOrderBookTokenIdInfos.filter((tokenIdInfo) => itemSet.has(tokenIdInfo.tokenId));

    // Set addresses and approvals
    transactionSet.push(getSafeUpgradeTransaction(PLAYERS_ADDRESS, players));
    transactionSet.push(getSafeUpgradeTransaction(PET_NFT_ADDRESS, petNFT));
    transactionSet.push({
      to: ethers.getAddress(ITEM_NFT_ADDRESS),
      value: "0",
      data: itemIface.encodeFunctionData("setApproved", [[await blackMarketTrader.getAddress()], true]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(ITEM_NFT_ADDRESS),
      value: "0",
      data: itemIface.encodeFunctionData("addItems", [allItems.filter((item) => itemSet.has(item.tokenId))]),
      operation: OperationType.Call,
    });
    transactionSet.push({
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
    });
    transactionSet.push({
      to: await blackMarketTrader.getAddress(),
      value: "0",
      data: blackMarketTraderIface.encodeFunctionData("addShopItems", [allBlackMarketItems, 1n]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: await blackMarketTrader.getAddress(),
      value: "0",
      data: blackMarketTraderIface.encodeFunctionData("setAcceptedItemId", [1n, EstforConstants.RIFT_COIN]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(BAZAAR_ADDRESS),
      value: "0",
      data: orderbookIface.encodeFunctionData("setTokenIdInfos", [
        orderBookTokenIdInfos.map((info) => info.tokenId),
        orderBookTokenIdInfos,
      ]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: petIface.encodeFunctionData("addBasePets", [
        allBasePets.filter((basePet) => basePetIds.has(basePet.baseId)),
      ]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: petIface.encodeFunctionData("editBasePets", [
        allBasePets.filter((basePet) => editBasePetIds.has(basePet.baseId)),
      ]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(INSTANT_VRF_ACTIONS_ADDRESS),
      value: "0",
      data: instantVRFActionIface.encodeFunctionData("addActions", [
        allInstantVRFActions.filter((instantVRFAction) => instantVRFActions.has(instantVRFAction.actionId)),
      ]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PASSIVE_ACTIONS_ADDRESS),
      value: "0",
      data: passiveActionIface.encodeFunctionData("addActions", [
        allPassiveActions.filter((passiveAction) => passiveActions.has(passiveAction.actionId)),
      ]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(COSMETICS_ADDRESS),
      value: "0",
      data: cosmeticsIface.encodeFunctionData("setCosmetics", [
        cosmeticTokenIds.filter((tokenId) => cosmetics.has(tokenId)),
        cosmeticInfos.filter((cosmetic) => cosmetics.has(cosmetic.itemTokenId)),
      ]),
      operation: OperationType.Call,
    });
    await sendTransactionSetToSafe(network, protocolKit, apiKit, transactionSet, proposer);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
