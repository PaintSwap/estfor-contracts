import {EstforConstants} from "@paintswap/estfor-definitions";
import {ethers, upgrades} from "hardhat";
import {
  ItemNFT,
  MockBrushToken,
  MockOracleClient,
  MockRouter,
  MockWrappedFantom,
  PlayerNFT,
  Players,
  Shop,
} from "../typechain-types";
import {verifyContracts} from "./utils";
import {allItems} from "./data/items";
import {allActions} from "./data/actions";

import {
  allActionChoicesFiremaking,
  allActionChoicesCooking,
  allActionChoicesCrafting,
  allActionChoicesMagic,
  allActionChoicesMelee,
  allActionChoicesSmithing,
} from "./data/actionChoices";
import {
  allActionChoiceIdsFiremaking,
  allActionChoiceIdsCooking,
  allActionChoiceIdsCrafting,
  allActionChoiceIdsMagic,
  allActionChoiceIdsMelee,
  allActionChoiceIdsSmithing,
} from "./data/actionChoiceIds";
import {BRUSH_ADDRESS, WFTM_ADDRESS} from "./constants";
import {addTestData} from "./addTestData";
import {whitelistedAdmins, whitelistedSnapshot} from "@paintswap/estfor-definitions/constants";
import {MerkleTreeWhitelist} from "./MerkleTreeWhitelist";
import {BigNumber} from "ethers";
import {allShopItems} from "./data/shopItems";
import {allFullAttireBonuses} from "./data/fullAttireBonuses";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";
import {avatarInfos} from "./data/avatars";
import {allQuests, allQuestsRandomFlag} from "./data/quests";

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  let brush: MockBrushToken;
  let wftm: MockWrappedFantom;
  let oracle: MockOracleClient;
  let router: MockRouter;
  let tx;
  {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const MockWrappedFantom = await ethers.getContractFactory("MockWrappedFantom");
    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const MockRouter = await ethers.getContractFactory("MockRouter");
    if (network.chainId == 31337 || network.chainId == 1337) {
      brush = await MockBrushToken.deploy();
      await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      wftm = await MockWrappedFantom.deploy();
      console.log("Minted brush");
      oracle = await MockOracleClient.deploy();
      console.log(`mockOracleClient = "${oracle.address.toLowerCase()}"`);
      router = await MockRouter.deploy();
    } else if (network.chainId == 4002) {
      // Fantom testnet
      brush = await MockBrushToken.deploy();
      tx = await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      console.log("Minted brush");
      await tx.wait();
      wftm = await MockWrappedFantom.attach("0xf1277d1ed8ad466beddf92ef448a132661956621");
      oracle = await MockOracleClient.deploy();
      console.log(`mockOracleClient = "${oracle.address.toLowerCase()}"`);
      router = await MockRouter.attach("0xa6AD18C2aC47803E193F75c3677b14BF19B94883");
    } else if (network.chainId == 250) {
      // Fantom mainnet
      brush = await MockBrushToken.attach(BRUSH_ADDRESS);
      wftm = await MockWrappedFantom.attach(WFTM_ADDRESS);
      oracle = await MockOracleClient.attach("0xd5d517abe5cf79b7e95ec98db0f0277788aff634");
      router = await MockRouter.attach("0x31F63A33141fFee63D4B26755430a390ACdD8a4d");
    } else {
      throw Error("Not a supported network");
    }
  }

  // Create the world
  const subscriptionId = 62;
  const World = await ethers.getContractFactory("World");
  const world = await upgrades.deployProxy(World, [oracle.address, subscriptionId], {
    kind: "uups",
  });
  await world.deployed();
  console.log(`world = "${world.address.toLowerCase()}"`);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.deployProxy(Shop, [brush.address], {
    kind: "uups",
  })) as Shop;

  await shop.deployed();
  console.log(`shop = "${shop.address.toLowerCase()}"`);

  const buyPath: [string, string] = [wftm.address, brush.address];

  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = await upgrades.deployProxy(
    RoyaltyReceiver,
    [router.address, shop.address, brush.address, buyPath],
    {
      kind: "uups",
    }
  );
  await royaltyReceiver.deployed();
  console.log(`royaltyReceiver = "${royaltyReceiver.address.toLowerCase()}"`);

  const admins = whitelistedAdmins.map((el) => ethers.utils.getAddress(el));
  if (!admins.includes(owner.address)) {
    admins.push(owner.address);
  }

  const AdminAccess = await ethers.getContractFactory("AdminAccess");
  const adminAccess = await upgrades.deployProxy(AdminAccess, [admins], {
    kind: "uups",
  });
  await adminAccess.deployed();
  console.log(`adminAccess = "${adminAccess.address.toLowerCase()}"`);

  let itemsUri: string;
  let imageBaseUri: string;
  let editNameBrushPrice: BigNumber;
  const isAlpha = process.env.IS_ALPHA == "true";
  if (isAlpha) {
    itemsUri = "ipfs://QmYtVoXAGxN2pDxsx8hrgUgwUTvyj6wvoxxQt4s7QNgKf2/";
    imageBaseUri = "ipfs://Qmf6NMUSyG4FShVCyNYH4PzKyAWWh5qQvrNt1BXgU2eBre/";
    editNameBrushPrice = ethers.utils.parseEther("1");
  } else {
    // live version
    itemsUri = "ipfs://TODO/";
    imageBaseUri = "ipfs://QmNkgG8nfMvTgfKUQWRRXRBPTDVbcwgwHp7FcvFP91UgGs/";
    editNameBrushPrice = ethers.utils.parseEther("1000");
  }

  // Create NFT contract which contains all items
  const ItemNFT = await ethers.getContractFactory("ItemNFT");
  const itemNFT = (await upgrades.deployProxy(
    ItemNFT,
    [world.address, shop.address, royaltyReceiver.address, adminAccess.address, itemsUri, isAlpha],
    {
      kind: "uups",
    }
  )) as ItemNFT;
  await itemNFT.deployed();
  console.log(`itemNFT = "${itemNFT.address.toLowerCase()}"`);

  // Create NFT contract which contains all the players
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const playerNFT = (await upgrades.deployProxy(
    PlayerNFT,
    [
      brush.address,
      shop.address,
      royaltyReceiver.address,
      adminAccess.address,
      editNameBrushPrice,
      imageBaseUri,
      isAlpha,
    ],
    {
      kind: "uups",
    }
  )) as PlayerNFT;
  await playerNFT.deployed();
  console.log(`playerNFT = "${playerNFT.address.toLowerCase()}"`);

  const Quests = await ethers.getContractFactory("Quests");
  const quests = await upgrades.deployProxy(Quests, [playerNFT.address, world.address], {
    kind: "uups",
  });
  await quests.deployed();
  console.log(`quests = "${quests.address.toLowerCase()}"`);

  // This contains all the player data
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playerLibrary = await PlayersLibrary.deploy();
  await playerLibrary.deployed();
  console.log(`playersLibrary = "${playerLibrary.address.toLowerCase()}"`);

  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions");
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  await playersImplQueueActions.deployed();
  console.log(`playersImplQueueActions = "${playersImplQueueActions.address.toLowerCase()}"`);

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  await playersImplProcessActions.deployed();
  console.log(`playersImplProcessActions = "${playersImplProcessActions.address.toLowerCase()}"`);

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  await playersImplRewards.deployed();
  console.log(`playersImplRewards = "${playersImplRewards.address.toLowerCase()}"`);

  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });

  const players = (await upgrades.deployProxy(
    Players,
    [
      itemNFT.address,
      playerNFT.address,
      world.address,
      adminAccess.address,
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
      isAlpha,
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
    }
  )) as Players;
  await players.deployed();
  console.log(`players = "${players.address.toLowerCase()}"`);

  // Verify the contracts now, better to bail now before we start setting up the contract data
  if (network.chainId == 250) {
    try {
      const addresses = [
        players.address,
        playerNFT.address,
        itemNFT.address,
        adminAccess.address,
        shop.address,
        world.address,
        royaltyReceiver.address,
      ];
      console.log("Verifying contracts...");
      await verifyContracts(addresses);
    } catch (e) {
      console.log("Error verifying contracts", e);
      process.exit(99);
    }
  } else {
    console.log("Skipping verifying contracts");
  }

  await world.setQuests(quests.address);
  console.log("world setQueusts");
  tx = await itemNFT.setPlayers(players.address);
  await tx.wait();
  console.log("itemNFT setPlayers");
  tx = await playerNFT.setPlayers(players.address);
  await tx.wait();
  console.log("playerNFT setPlayers");
  tx = await shop.setItemNFT(itemNFT.address);
  await tx.wait();
  console.log("setItemNFT");

  tx = await players.setDailyRewardsEnabled(true);
  await tx.wait();
  console.log("Set daily rewards enabled");

  const startAvatarId = 1;
  tx = await playerNFT.setAvatars(startAvatarId, avatarInfos);
  await tx.wait();
  console.log("Add avatars");

  if (isAlpha) {
    // Calculate the merkle root
    const treeWhitelist = new MerkleTreeWhitelist(whitelistedSnapshot);
    const root = treeWhitelist.getRoot();
    // Set the merkle root on the nft contract
    tx = await playerNFT.setMerkleRoot(root);
    await tx.wait();
    console.log("Set merkle root");
  }

  tx = await players.addXPThresholdRewards(allXPThresholdRewards);
  await tx.wait();
  console.log("Add xp threshold rewards");

  const chunkSize = 100;
  for (let i = 0; i < allItems.length; i += chunkSize) {
    const tokenIds: number[] = [];
    const amounts: number[] = [];
    const chunk = allItems.slice(i, i + chunkSize);
    chunk.forEach((item) => {
      tokenIds.push(item.tokenId);
      amounts.push(200);
    });
    tx = await itemNFT.addItems(chunk);
    await tx.wait();
    console.log("Add items chunk ", i);
  }

  // Add full equipment bonuses
  tx = await players.addFullAttireBonuses(allFullAttireBonuses);
  await tx.wait();
  console.log("Add full attire bonuses");

  tx = await world.addActions(allActions);
  await tx.wait();
  console.log("Add actions");

  const fireMakingActionId = EstforConstants.ACTION_FIREMAKING_ITEM;
  const smithingActionId = EstforConstants.ACTION_SMITHING_ITEM;
  const cookingActionId = EstforConstants.ACTION_COOKING_ITEM;
  const craftingActionId = EstforConstants.ACTION_CRAFTING_ITEM;
  const genericCombatActionId = EstforConstants.NONE;

  tx = await world.addBulkActionChoices(
    [
      fireMakingActionId,
      smithingActionId,
      cookingActionId,
      craftingActionId,
      genericCombatActionId,
      genericCombatActionId,
    ],
    [
      allActionChoiceIdsFiremaking,
      allActionChoiceIdsSmithing,
      allActionChoiceIdsCooking,
      allActionChoiceIdsCrafting,
      allActionChoiceIdsMelee,
      allActionChoiceIdsMagic,
    ],
    [
      allActionChoicesFiremaking,
      allActionChoicesSmithing,
      allActionChoicesCooking,
      allActionChoicesCrafting,
      allActionChoicesMelee,
      allActionChoicesMagic,
    ]
  );

  await tx.wait();
  console.log("Add action choices");

  // Add shop items
  tx = await shop.addBuyableItems(allShopItems);
  await tx.wait();
  console.log("Add shopping items");

  // Add quests
  tx = await quests.addQuests(allQuests, allQuestsRandomFlags);
  await tx.wait();
  console.log("Add quests");

  // Add test data for the game
  if (isAlpha) {
    await addTestData(itemNFT, playerNFT, players, shop, brush);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
