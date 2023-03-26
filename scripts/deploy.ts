import {EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {ethers, upgrades} from "hardhat";
import {ItemNFT, MockBrushToken, MockWrappedFantom, PlayerNFT, Players, Shop} from "../typechain-types";
import {allFullAttireBonuses, allShopItems, allXPThresholdRewards, AvatarInfo, verifyContracts} from "./utils";
import adminAddresses from "../whitelist/admins.json";
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

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(`Deploying contracts with the account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  let brush: MockBrushToken;
  let wftm: MockWrappedFantom;
  let tx;
  {
    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const MockWrappedFantom = await ethers.getContractFactory("MockWrappedFantom");
    if (network.chainId == 31337 || network.chainId == 1337) {
      brush = await MockBrushToken.deploy();
      await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      wftm = await MockWrappedFantom.deploy();
      await wftm.deployed();
    } else if (network.chainId == 4002) {
      // Fantom testnet
      brush = await MockBrushToken.deploy();
      tx = await brush.mint(owner.address, ethers.utils.parseEther("1000"));
      console.log("Minted brush");
      await tx.wait();
      wftm = await MockWrappedFantom.attach("0xf1277d1ed8ad466beddf92ef448a132661956621");
    } else if (network.chainId == 250) {
      // Fantom mainnet
      brush = await MockBrushToken.attach(BRUSH_ADDRESS);
      wftm = await MockWrappedFantom.attach(WFTM_ADDRESS);
    } else {
      throw Error("Not a supported network");
    }
  }

  console.log(`Before calling MockOracleClient`);
  const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
  const mockOracleClient = await MockOracleClient.deploy();
  await mockOracleClient.deployed();
  console.log(`MockOracleClient deployed at ${mockOracleClient.address.toLowerCase()}`);

  // Create the world
  const subscriptionId = 62;
  const World = await ethers.getContractFactory("World");
  const world = await upgrades.deployProxy(World, [mockOracleClient.address, subscriptionId], {
    kind: "uups",
  });
  await world.deployed();
  console.log(`World deployed at ${world.address.toLowerCase()}`);

  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.deployProxy(Shop, [brush.address], {
    kind: "uups",
  })) as Shop;

  await shop.deployed();
  console.log(`Shop deployed at ${shop.address.toLowerCase()}`);

  const buyPath: [string, string] = [wftm.address, brush.address];
  const MockRouter = await ethers.getContractFactory("MockRouter");
  const router = await MockRouter.deploy();
  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = await upgrades.deployProxy(
    RoyaltyReceiver,
    [router.address, shop.address, brush.address, buyPath],
    {
      kind: "uups",
    }
  );
  await royaltyReceiver.deployed();
  console.log(`RoyaltyReceiver deployed at ${royaltyReceiver.address.toLowerCase()}`);

  const admins = adminAddresses.map((el) => ethers.utils.getAddress(el.address));
  if (!admins.includes(owner.address)) {
    admins.push(owner.address);
  }

  const AdminAccess = await ethers.getContractFactory("AdminAccess");
  const adminAccess = await upgrades.deployProxy(AdminAccess, [admins], {
    kind: "uups",
  });
  await adminAccess.deployed();
  console.log(`AdminAccess deployed at ${adminAccess.address.toLowerCase()}`);

  //  const itemsUri = "ipfs:// /"; //
  const itemsUri = "ipfs://Qmdhaz6jRnpQjvzzJB1PuN2Y33Nc1hAKg1sCMVc18ftcAL/"; // alpha

  // Create NFT contract which contains all items
  const ItemNFT = await ethers.getContractFactory("ItemNFT");
  const itemNFT = (await upgrades.deployProxy(
    ItemNFT,
    [world.address, shop.address, royaltyReceiver.address, adminAccess.address, itemsUri],
    {
      kind: "uups",
    }
  )) as ItemNFT;
  await itemNFT.deployed();
  console.log(`Item NFT deployed at ${itemNFT.address.toLowerCase()}`);

  // Create NFT contract which contains all the players
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const EDIT_NAME_BRUSH_PRICE = ethers.utils.parseEther("1");
  //  const imageBaseUri = "ipfs://QmNkgG8nfMvTgfKUQWRRXRBPTDVbcwgwHp7FcvFP91UgGs/"; // live
  const imageBaseUri = "ipfs://Qmf6NMUSyG4FShVCyNYH4PzKyAWWh5qQvrNt1BXgU2eBre/"; // alpha
  const playerNFT = (await upgrades.deployProxy(
    PlayerNFT,
    [brush.address, shop.address, royaltyReceiver.address, adminAccess.address, EDIT_NAME_BRUSH_PRICE, imageBaseUri],
    {
      kind: "uups",
    }
  )) as PlayerNFT;

  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`);

  // This contains all the player data
  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playerLibrary = await PlayersLibrary.deploy();
  await playerLibrary.deployed();
  console.log(`PlayersLibrary deployed at ${playerLibrary.address.toLowerCase()}`);

  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions");
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  console.log(`PlayersImplQueueActions deployed at ${playersImplQueueActions.address.toLowerCase()}`);

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  console.log(`PlayersImplProcessActions deployed at ${playersImplProcessActions.address.toLowerCase()}`);

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayersLibrary: playerLibrary.address},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  console.log(`PlayersImplRewards deployed at ${playersImplRewards.address.toLowerCase()}`);

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
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
    }
  )) as Players;
  await players.deployed();
  console.log(`Players deployed at ${players.address.toLowerCase()}`);

  tx = await itemNFT.setPlayers(players.address);
  await tx.wait();
  console.log("itemNFT setPlayers");
  tx = await playerNFT.setPlayers(players.address);
  await tx.wait();
  console.log("playerNFT setPlayers");
  await shop.setItemNFT(itemNFT.address);
  console.log("setItemNFT");

  tx = await players.setDailyRewardsEnabled(true);
  await tx.wait();
  console.log("Set daily rewards enabled");

  const startAvatarId = 1;
  const avatarInfos: AvatarInfo[] = [
    {
      name: ethers.utils.formatBytes32String("Kittie Mage"),
      description:
        "Kittie Mage is a wise and thoughtful mage, skilled in the Arcane arts. A researcher, she is always eager to learn more about the world of magic.",
      imageURI: "1.jpg",
      startSkills: [Skill.MAGIC, Skill.NONE],
    },
    {
      name: ethers.utils.formatBytes32String("Itchy Lizzy"),
      description:
        "Itchy Lizzy is skilled in stealth and deception. She prefers to work alone but will team up with others if it serves her ultimate goal.",
      imageURI: "2.jpg",
      startSkills: [Skill.THIEVING, Skill.NONE],
    },
    {
      name: ethers.utils.formatBytes32String("Polar Ace"),
      description:
        "Polar Ace is a resourceful bard who is skilled in music and performance. He is highly charismatic and always knows how to put on a good show.",
      imageURI: "3.jpg",
      startSkills: [Skill.MAGIC, Skill.DEFENCE],
    },
    {
      name: ethers.utils.formatBytes32String("King Lionel"),
      description:
        "King Lionel is a powerful warrior who is skilled in swordplay and hand-to-hand combat. A natural leader, he inspires confidence in all those around him.",
      imageURI: "4.jpg",
      startSkills: [Skill.MELEE, Skill.NONE],
    },
    {
      name: ethers.utils.formatBytes32String("Raging Ears"),
      description:
        "Raging Ears is a kind wizard skilled in the healing arts. She is a deeply spiritual person who always puts the needs of others before her own.",
      imageURI: "5.jpg",
      startSkills: [Skill.MAGIC, Skill.HEALTH],
    },
    {
      name: ethers.utils.formatBytes32String("Sleepless Piggy"),
      description:
        "Sleepless Piggy is a brawny and powerful barbarian who is skilled in hard combat. He is quick to anger and fiercely protective of his friends and allies.",
      imageURI: "6.jpg",
      startSkills: [Skill.MELEE, Skill.DEFENCE],
    },
    {
      name: ethers.utils.formatBytes32String("Wolfgang Companion"),
      description:
        "Wolfgang Companion is a fierce ranger, skilled in trapping as well as archery. With a strong sense of justice, she will always defend the weak and innocent.",
      imageURI: "7.jpg",
      startSkills: [Skill.RANGE, Skill.NONE],
    },
    {
      name: ethers.utils.formatBytes32String("Slaying Doggo"),
      description:
        "Slaying Doggo is a proud, ambitious warrior who is skilled in close combat and magic. His unshakable sense of duty makes him a powerful ally in battle.",
      imageURI: "8.jpg",
      startSkills: [Skill.MELEE, Skill.MAGIC],
    },
  ];

  tx = await playerNFT.setAvatars(startAvatarId, avatarInfos);
  await tx.wait();
  console.log("addAvatars");

  tx = await players.addXPThresholdRewards(allXPThresholdRewards);
  await tx.wait();
  console.log("add xp threshold rewards");

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
    console.log("add items chunk ", i);

    // Batch mint all the items (testing)
    if (network.chainId == 31337) {
      tx = await itemNFT.testMints(owner.address, tokenIds, amounts);
    } else {
      // TODO: This should fail when we go live
      tx = await itemNFT.testMints(owner.address, tokenIds, amounts);
    }
    await tx.wait();
    console.log("batch mint");
  }

  // Add full equipment bonuses (TODO: Only enable once we have all these items added)
  tx = await players.addFullAttireBonuses(allFullAttireBonuses);
  await tx.wait();
  console.log("add full attire bonuses");

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
  console.log("add shop");

  // Try to verify the contracts now, but often you'll get an error with build-info not matching
  // Delete cache/artifacts and call yarn verifyContracts script
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
    }
  } else {
    console.log("Skipping verifying contracts");
  }

  // Add test data for the game (don't use in live release)
  await addTestData(itemNFT, playerNFT, players, shop, brush);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
