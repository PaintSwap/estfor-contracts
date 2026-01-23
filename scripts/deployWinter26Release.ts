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
} from "./contractAddresses";
import {
  initialiseSafe,
  sendTransactionSetToSafe,
  getSafeUpgradeTransaction,
  verifyContracts,
  deployPlayerImplementations,
} from "./utils";
import {OperationType, MetaTransactionData} from "@safe-global/types-kit";
import {Marketplace, Cosmetics, GlobalEvents, GlobalEvents__factory, Players__factory} from "../typechain-types";
import {cosmeticInfos} from "./data/cosmetics";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {parseEther} from "ethers";

async function main() {
  const [owner, , proposer] = await ethers.getSigners(); // 0 is old deployer, 2 is proposer for Safe (new deployer)
  const network = await ethers.provider.getNetwork();
  const {useSafe, apiKit, protocolKit} = await initialiseSafe(network);
  console.log(
    `Deploy marketplace using account: ${proposer.address} on chain id ${network.chainId}, useSafe: ${useSafe}`
  );

  const timeout = 60 * 1000; // 1 minute

  const playersIface = Players__factory.createInterface();
  const globalEventsIface = GlobalEvents__factory.createInterface();

  if (useSafe) {
    /* Marketplace Release */
    const Marketplace = await ethers.getContractFactory("Marketplace", proposer);
    const marketplace = (await upgrades.deployProxy(Marketplace, [
      BRUSH_ADDRESS,
      process.env.SAFE_ADDRESS,
    ])) as unknown as Marketplace;
    await marketplace.waitForDeployment();
    console.log(`marketplace = "${(await marketplace.getAddress()).toLowerCase()}"`);

    // can verify this immediately
    if (network.chainId == 146n) {
      await verifyContracts([await marketplace.getAddress()]);
    }

    const petNFTLibrary = await ethers.getContractAt("PetNFTLibrary", PET_NFT_LIBRARY_ADDRESS);
    const estforLibrary = await ethers.getContractAt("EstforLibrary", ESTFOR_LIBRARY_ADDRESS);
    const playersLibrary = await ethers.getContractAt("PlayersLibrary", PLAYERS_LIBRARY_ADDRESS);
    const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary", proposer);
    await itemNFTLibrary.waitForDeployment();
    console.log(`itemNFTLibrary = "${await itemNFTLibrary.getAddress()}"`);

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
    /* Marketplace Release */

    /* Cosmetic Release */
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()},
      signer: proposer,
    });
    const playerNFT = (await upgrades.prepareUpgrade(PLAYER_NFT_ADDRESS, PlayerNFT, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    })) as string;
    console.log(`playerNFT = "${playerNFT.toLowerCase()}"`);

    const Players = await ethers.getContractFactory("Players", proposer);
    const players = (await upgrades.prepareUpgrade(PLAYERS_ADDRESS, Players, {
      kind: "uups",
      unsafeAllow: ["delegatecall"],
      timeout,
    })) as string;
    console.log(`players = "${players.toLowerCase()}"`);

    const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
      await deployPlayerImplementations(await playersLibrary.getAddress(), proposer);

    const Cosmetics = await ethers.getContractFactory("Cosmetics", proposer);
    const cosmetics = (await upgrades.deployProxy(Cosmetics, [
      process.env.SAFE_ADDRESS,
      ITEM_NFT_ADDRESS,
      PLAYER_NFT_ADDRESS,
    ])) as unknown as Cosmetics;
    await cosmetics.waitForDeployment();
    console.log(`cosmetics = "${(await cosmetics.getAddress()).toLowerCase()}"`);
    // const cosmetics = (await upgrades.prepareUpgrade(COSMETICS_ADDRESS, Cosmetics, {
    //   kind: "uups",
    //   unsafeAllow: ["delegatecall"],
    //   timeout,
    // })) as string;
    // console.log(`cosmetics = "${cosmetics.toLowerCase()}"`);

    // Shop
    const Shop = await ethers.getContractFactory("Shop", proposer);
    const shop = (await upgrades.prepareUpgrade(SHOP_ADDRESS, Shop, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
      timeout,
    })) as string;
    console.log(`Shop new implementation = "${shop}"`);

    // ItemNFT
    const ItemNFT = await ethers.getContractFactory("ItemNFT", {
      libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()},
      signer: proposer,
    });
    const itemnft = (await upgrades.prepareUpgrade(ITEM_NFT_ADDRESS, ItemNFT, {
      kind: "uups",
      unsafeAllow: ["external-library-linking"],
    })) as string;
    console.log(`itemnft = "${itemnft.toLowerCase()}"`);

    // can verify this immediately
    if (network.chainId == 146n) {
      await verifyContracts([await cosmetics.getAddress()]);
    }
    /* Cosmetic Release */

    /* Global Events Release */
    const GlobalEvents = await ethers.getContractFactory("GlobalEvents", proposer);
    const globalEvents = (await upgrades.deployProxy(GlobalEvents, [
      process.env.SAFE_ADDRESS,
      PLAYERS_ADDRESS,
      ITEM_NFT_ADDRESS,
    ])) as unknown as GlobalEvents;
    await globalEvents.waitForDeployment();
    console.log(`globalEvents = "${(await globalEvents.getAddress()).toLowerCase()}"`);

    // can verify this immediately
    if (network.chainId == 146n) {
      await verifyContracts([await globalEvents.getAddress()]);
    }

    const transactionSet: MetaTransactionData[] = [];
    const iface = new ethers.Interface([
      "function setMarketplaceAddress(address marketplaceAddress)",
      "function setApprovalForAll(address operator, bool approved)",
      "function setCosmeticsAddress(address cosmeticsAddress)",
      "function setApproved(address[] operators, bool approved)",
      "function setAvatars(uint256[] avatarsIds, (string,string,string,uint8[2] )[] avatarInfos)",
      "function setCosmetics(uint16[] cosmeticIds, (uint8,uint16,uint24)[] cosmeticInfos)",
      "function setSupporterPacks(uint24[] packIds, (uint80,uint16[],uint16[],uint16,uint32,uint96)[] packs)",
      "function setSupporterPackToken(address supporterPackTokenAddress)",
      "function approve(address spender, uint256 amount)",
    ]);

    // transactionSet.push(getSafeUpgradeTransaction(COSMETICS_ADDRESS, cosmetics));
    transactionSet.push(getSafeUpgradeTransaction(PLAYER_NFT_ADDRESS, playerNFT));
    transactionSet.push(getSafeUpgradeTransaction(PET_NFT_ADDRESS, petNFT));
    transactionSet.push(getSafeUpgradeTransaction(PLAYERS_ADDRESS, players));
    transactionSet.push(getSafeUpgradeTransaction(SHOP_ADDRESS, shop));
    transactionSet.push(getSafeUpgradeTransaction(ITEM_NFT_ADDRESS, itemnft));

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

    // Set addresses and approvals
    transactionSet.push({
      to: ethers.getAddress(ITEM_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setApproved", [[await cosmetics.getAddress()], true]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(ITEM_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setApproved", [[await globalEvents.getAddress()], true]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setMarketplaceAddress", [await marketplace.getAddress()]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setCosmeticsAddress", [await cosmetics.getAddress()]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setApprovalForAll", [await marketplace.getAddress(), true]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setMarketplaceAddress", [await marketplace.getAddress()]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(PET_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setApprovalForAll", [await marketplace.getAddress(), true]),
      operation: OperationType.Call,
    });

    transactionSet.push({
      to: ethers.getAddress(SHOP_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setSupporterPackToken", [USDC_ADDRESS]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(BRUSH_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("approve", [SHOP_ADDRESS, ethers.MaxUint256]),
      operation: OperationType.Call,
    });

    // Change for live release
    transactionSet.push({
      to: ethers.getAddress(PLAYER_NFT_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setAvatars", [
        [9, 10009],
        [
          [
            "Chimp",
            "Chimpy is curious and quick-witted with a natural sensitivity to magic. Playful by nature but alert to danger, Chimpy thrives near sources of magic, where his latent power quietly grows.",
            "9.jpg",
            [Skill.ALCHEMY, Skill.FORGING],
          ],
          [
            "Primordius",
            "The magic that once stirred quietly now moves with intention. Primordius wields primal power with balance and control.",
            "10009.jpg",
            [Skill.ALCHEMY, Skill.FORGING],
          ],
        ],
      ]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: await cosmetics.getAddress(),
      value: "0",
      data: Cosmetics.interface.encodeFunctionData("setCosmetics", [
        cosmeticInfos.map((c) => c.itemTokenId),
        cosmeticInfos.map((c) => [c.cosmeticPosition, c.itemTokenId, c.avatarId]),
      ]),
      operation: OperationType.Call,
    });
    transactionSet.push({
      to: ethers.getAddress(SHOP_ADDRESS),
      value: "0",
      data: iface.encodeFunctionData("setSupporterPacks", [
        [1],
        [
          [
            15_000_000,
            [
              EstforConstants.AVATAR_001_CHIMP,
              EstforConstants.BORDER_001_ARCANE_PORTAL,
              EstforConstants.SUPPORT_001_TROPHY,
            ],
            [1, 1, 1],
            1000,
            Math.floor(Date.now() / 1000),
            parseEther("2000"),
          ],
        ],
      ]),
      operation: OperationType.Call,
    });

    transactionSet.push({
      to: ethers.getAddress(await globalEvents.getAddress()),
      // to: ethers.getAddress(GLOBAL_EVENT_ADDRESS),
      value: "0",
      data: globalEventsIface.encodeFunctionData("addGlobalEvents", [
        [1],
        [
          {
            startTime: Math.floor(Date.now() / 1000),
            endTime: 0,
            rewardItemTokenId: EstforConstants.RIFT_COIN,
            rewardItemAmountPerInput: 1,
            inputItemTokenId: EstforConstants.RIFT_CRYSTAL,
            inputItemMaxAmount: 150_000,
            totalInputAmount: 0,
          },
        ],
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
