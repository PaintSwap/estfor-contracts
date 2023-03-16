import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {ethers, upgrades} from "hardhat";
import {MockBrushToken, MockWrappedFantom, PlayerNFT} from "../typechain-types";
import {
  allActions,
  allItems,
  allShopItems,
  allXPThresholdRewards,
  AvatarInfo,
  createPlayer,
  firemakingChoices,
  magicChoices,
  meleeChoices,
  smithingChoices,
} from "./utils";

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
      brush = await MockBrushToken.attach("0x85dec8c4B2680793661bCA91a8F129607571863d");
      wftm = await MockWrappedFantom.attach("0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83");
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
  const shop = await upgrades.deployProxy(Shop, [brush.address], {
    kind: "uups",
    unsafeAllow: ["delegatecall"],
  });

  await shop.deployed();
  console.log(`Shop deployed at ${shop.address.toLowerCase()}`);

  const MockRouter = await ethers.getContractFactory("MockRouter");
  const router = await MockRouter.deploy();
  const RoyaltyReceiver = await ethers.getContractFactory("RoyaltyReceiver");
  const royaltyReceiver = await RoyaltyReceiver.deploy(router.address, shop.address, brush.address, [
    wftm.address,
    brush.address,
  ]);
  await royaltyReceiver.deployed();
  console.log(`RoyaltyReceiver deployed at ${royaltyReceiver.address.toLowerCase()}`);

  // Create NFT contract which contains all items
  const ItemNFT = await ethers.getContractFactory("ItemNFT");
  const itemNFT = await upgrades.deployProxy(ItemNFT, [world.address, shop.address, royaltyReceiver.address], {
    kind: "uups",
    unsafeAllow: ["delegatecall"],
  });
  await itemNFT.deployed();
  console.log(`Item NFT deployed at ${itemNFT.address.toLowerCase()}`);

  // Create NFT contract which contains all the players
  const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
  const EDIT_NAME_BRUSH_PRICE = ethers.utils.parseEther("1");
  const imageBaseUri = "ipfs://QmNkgG8nfMvTgfKUQWRRXRBPTDVbcwgwHp7FcvFP91UgGs/"; // live
  //  const imageBaseUri = "ipfs://"; // alpha
  const playerNFT = (await upgrades.deployProxy(
    PlayerNFT,
    [brush.address, shop.address, royaltyReceiver.address, EDIT_NAME_BRUSH_PRICE, imageBaseUri],
    {
      kind: "uups",
    }
  )) as PlayerNFT;

  console.log(`Player NFT deployed at ${playerNFT.address.toLowerCase()}`);

  // This contains all the player data
  const PlayerLibrary = await ethers.getContractFactory("PlayerLibrary");
  const playerLibrary = await PlayerLibrary.deploy();
  await playerLibrary.deployed();
  console.log(`PlayerLibrary deployed at ${playerLibrary.address.toLowerCase()}`);

  const PlayersImplQueueActions = await ethers.getContractFactory("PlayersImplQueueActions");
  const playersImplQueueActions = await PlayersImplQueueActions.deploy();
  console.log(`PlayersImplQueueActions deployed at ${playersImplQueueActions.address.toLowerCase()}`);

  const PlayersImplProcessActions = await ethers.getContractFactory("PlayersImplProcessActions", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });
  const playersImplProcessActions = await PlayersImplProcessActions.deploy();
  console.log(`PlayersImplProcessActions deployed at ${playersImplProcessActions.address.toLowerCase()}`);

  const PlayersImplRewards = await ethers.getContractFactory("PlayersImplRewards", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });
  const playersImplRewards = await PlayersImplRewards.deploy();
  console.log(`PlayersImplRewards deployed at ${playersImplRewards.address.toLowerCase()}`);

  const Players = await ethers.getContractFactory("Players", {
    libraries: {PlayerLibrary: playerLibrary.address},
  });

  const players = await upgrades.deployProxy(
    Players,
    [
      itemNFT.address,
      playerNFT.address,
      world.address,
      playersImplQueueActions.address,
      playersImplProcessActions.address,
      playersImplRewards.address,
    ],
    {
      kind: "uups",
      unsafeAllow: ["delegatecall", "external-library-linking"],
    }
  );
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

  // Create player
  const makeActive = true;
  const playerId = await createPlayer(
    playerNFT,
    startAvatarId,
    owner,
    ethers.utils.formatBytes32String("0xSamWitch"),
    makeActive
  );
  console.log("createPlayer");

  //  tx = await players.setActivePlayer(playerId);
  //  await tx.wait();
  //  console.log("Set active player");

  // === Test stuff ===
  tx = await players.addXPThresholdRewards(allXPThresholdRewards);
  await tx.wait();
  console.log("add xp threshold rewards");

  const tokenIds: number[] = [];
  const amounts: number[] = [];
  allItems.forEach((item) => {
    tokenIds.push(item.tokenId);
    amounts.push(200);
  });

  tx = await itemNFT.addItems(allItems);
  await tx.wait();
  console.log("add items");

  // Batch mint all the items
  if (network.chainId == 31337) {
    tx = await itemNFT.testOnlyMints(owner.address, tokenIds, amounts);
  } else {
    // TODO: This should fail when we go live
    tx = await itemNFT.testMints(owner.address, tokenIds, amounts);
  }
  await tx.wait();
  console.log("batch mint");

  tx = await world.addActions(allActions);
  await tx.wait();
  console.log("Add actions");

  const fireMakingActionId = EstforConstants.ACTION_FIREMAKING_ITEM;
  const smithMakingActionId = EstforConstants.ACTION_SMITHING_ITEM;

  tx = await world.addBulkActionChoices(
    [fireMakingActionId, smithMakingActionId, EstforConstants.NONE, EstforConstants.NONE],
    [
      [EstforConstants.ACTIONCHOICE_FIREMAKING_LOG, EstforConstants.ACTIONCHOICE_FIREMAKING_OAK],
      [EstforConstants.ACTIONCHOICE_SMITHING_BRONZE_BAR, EstforConstants.ACTIONCHOICE_SMITHING_IRON_BAR],
      [EstforConstants.ACTIONCHOICE_MELEE_MONSTER],
      [EstforConstants.ACTIONCHOICE_MAGIC_SHADOW_BLAST],
    ],
    [firemakingChoices, smithingChoices, meleeChoices, magicChoices]
  );

  await tx.wait();
  console.log("Add action choices");

  // First woodcutting
  const queuedAction: EstforTypes.QueuedAction = {
    attire: EstforTypes.noAttire,
    actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
    combatStyle: EstforTypes.CombatStyle.NONE,
    choiceId: EstforConstants.NONE,
    choiceId1: EstforConstants.NONE,
    choiceId2: EstforConstants.NONE,
    regenerateId: EstforConstants.NONE,
    timespan: 3600,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    startTime: "0",
    isValid: true,
  };

  let gasLimit = await players.estimateGas.startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
  tx = await players.startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });

  await tx.wait();
  console.log("start actions");

  tx = await players.setSpeedMultiplier(playerId, 60); // Turns 1 hour into 1 second
  await tx.wait();
  console.log("Set speed multiiplier");

  if (network.chainId == 31337 || network.chainId == 1337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [1]);
  }

  // Because of the speed multiplier, gas estimates may not be accurate as other things could be minted by the time the tx is executed,
  // so adding 300k gas to be safe
  gasLimit = await players.estimateGas.processActions(playerId);
  tx = await players.processActions(playerId, {gasLimit: gasLimit.add(300000)});
  await tx.wait();
  console.log("process actions");

  console.log("Number of logs ", (await itemNFT.balanceOf(owner.address, EstforConstants.LOG)).toNumber());

  // Next firemaking
  const queuedActionFiremaking: EstforTypes.QueuedAction = {
    attire: {...EstforTypes.noAttire},
    actionId: EstforConstants.ACTION_FIREMAKING_ITEM,
    combatStyle: EstforTypes.CombatStyle.NONE,
    choiceId: EstforConstants.ACTIONCHOICE_FIREMAKING_LOG,
    choiceId1: EstforConstants.NONE,
    choiceId2: EstforConstants.NONE,
    regenerateId: EstforConstants.NONE,
    timespan: 3600,
    rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    startTime: "0",
    isValid: true,
  };

  gasLimit = await players.estimateGas.startAction(
    playerId,
    queuedActionFiremaking,
    EstforTypes.ActionQueueStatus.NONE
  );
  tx = await players.startAction(playerId, queuedActionFiremaking, EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("start firemaking action");

  if (network.chainId == 31337 || network.chainId == 1337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [1]);
  }

  gasLimit = await players.estimateGas.processActions(playerId);
  tx = await players.processActions(playerId, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("process actions (firemaking)");

  console.log("Number of logs ", (await itemNFT.balanceOf(owner.address, EstforConstants.LOG)).toNumber());

  // Start another action
  gasLimit = await players.estimateGas.startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
  tx = await players.startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("start an unprocessed action");

  if (network.chainId == 31337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [1000000]);
  }

  // Start a combat action
  const queuedActionCombat: EstforTypes.QueuedAction = {
    attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET},
    actionId: EstforConstants.ACTION_COMBAT_NATUOW,
    combatStyle: EstforTypes.CombatStyle.MELEE,
    choiceId: EstforConstants.ACTIONCHOICE_MELEE_MONSTER,
    choiceId1: EstforConstants.NONE,
    choiceId2: EstforConstants.NONE,
    regenerateId: EstforConstants.NONE,
    timespan: 7200,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
    leftHandEquipmentTokenId: EstforConstants.NONE,
    startTime: "0",
    isValid: true,
  };

  gasLimit = await players.estimateGas.startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
  tx = await players.startAction(playerId, queuedActionCombat, EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("start a combat action");

  if (network.chainId == 31337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [10]);
  }

  gasLimit = await players.estimateGas.processActions(playerId);
  tx = await players.processActions(playerId, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("process actions (melee combat)");

  // Add shop item
  tx = await shop.addBuyableItems(allShopItems);
  await tx.wait();
  console.log("add shop");

  // Buy from shop
  tx = await brush.approve(shop.address, ethers.utils.parseEther("100"));
  await tx.wait();
  console.log("Approve brush");

  tx = await shop.buy(EstforConstants.BRONZE_HELMET, 1);
  await tx.wait();
  console.log("buy from shop");

  // Transfer some brush to the pool so we can sell something
  tx = await brush.transfer(shop.address, "100000");
  await tx.wait();
  console.log("Transfer some brush");

  // Sell to shop (can be anything)
  tx = await shop.sell(EstforConstants.BRONZE_HELMET, 1, 1);
  await tx.wait();
  console.log("Sell");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
