import {ethers, upgrades} from "hardhat";
import {
  ITEM_NFT_ADDRESS,
  WORLD_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  CLANS_ADDRESS,
  PLAYER_NFT_ADDRESS,
} from "./contractAddresses";
import {deployPlayerImplementations, setDailyAndWeeklyRewards, verifyContracts} from "./utils";
import {Players, World} from "../typechain-types";
import {allXPThresholdRewards} from "./data/xpThresholdRewards";
import {Skill} from "@paintswap/estfor-definitions/types";

async function main() {
  //  const [owner] = await ethers.getSigners();

  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  console.log(`Large upgrade using account: ${owner.address}`);

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const timeout = 600 * 1000; // 10 minutes

  /* Overhaul upgrade #1

  const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
  const playersLibrary = await PlayersLibrary.deploy();
  console.log(`playersLibrary = "${playersLibrary.address.toLowerCase()}"`);

  const Players = (await ethers.getContractFactory("Players")).connect(owner);
  let players = Players.attach(PLAYERS_ADDRESS);
  await players.pauseGame(true);
  players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
  })) as Players;
  await players.deployed();
  console.log("Deployed Players");

  // Update player impls
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(playersLibrary.address);
  let tx = await players.setImpls(
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address,
    playersImplMisc1.address
  );
  await tx.wait();
  console.log("setImpls");

  // Update absence boost in xp threshold
  const thresholdRewards = allXPThresholdRewards.find((reward) => reward.xpThreshold === 2700000);
  if (!thresholdRewards) {
    throw new Error("Reward not found");
  }
  tx = await players.editXPThresholdRewards([thresholdRewards]);
  await tx.wait();
  console.log("editXPThresholdRewards");

  // Update daily reward pools
  const WorldLibrary = await ethers.getContractFactory("WorldLibrary");
  const worldLibrary = await WorldLibrary.deploy();
  console.log(`worldLibrary = "${worldLibrary.address.toLowerCase()}"`);

  const World = (await ethers.getContractFactory("World", {libraries: {WorldLibrary: worldLibrary.address}})).connect(
    owner
  );
  const world = (await upgrades.upgradeProxy(WORLD_ADDRESS, World, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  })) as World;
  await world.deployed();
  console.log("world upgraded");

  await setDailyAndWeeklyRewards(world);
  console.log("setDailyAndWeeklyRewards");

  // ItemNFT
  const ItemNFTLibrary = await ethers.getContractFactory("ItemNFTLibrary");
  const itemNFTLibrary = await ItemNFTLibrary.deploy();
  await itemNFTLibrary.deployed();
  console.log(`itemNFTLibrary = "${itemNFTLibrary.address.toLowerCase()}"`);

  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {libraries: {ItemNFTLibrary: itemNFTLibrary.address}})
  ).connect(owner);
  const itemNFT = await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
  });
  await itemNFT.deployed();
  console.log(`itemNFT deployed`);
  */

  // Overhaul upgrade #1
  const estforLibrary = await ethers.deployContract("EstforLibrary");
  console.log(`estforLibrary = "${estforLibrary.address.toLowerCase()}"`);

  const playersLibrary = await ethers.deployContract("PlayersLibrary");
  console.log(`playersLibrary = "${playersLibrary.address.toLowerCase()}"`);

  const Players = (await ethers.getContractFactory("Players")).connect(owner);
  const players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "external-library-linking"],
    timeout,
  })) as Players;
  await players.deployed();
  console.log("Deployed Players");

  // Update player impls
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(playersLibrary.address);
  let tx = await players.setImpls(
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address,
    playersImplMisc1.address
  );
  await tx.wait();
  console.log("setImpls");

  const Clans = (
    await ethers.getContractFactory("Clans", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const clans = await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await clans.deployed();
  console.log(`clans = "${clans.address.toLowerCase()}"`);

  const psMarketplaceWhitelist = "0x7559038535f3d6ed6BAc5a54Ab4B69DA827F44BD";
  tx = await clans.setPaintSwapMarketplaceWhitelist(psMarketplaceWhitelist);
  await tx.wait();
  console.log("setPaintSwapMarketplaceWhitelist");

  const PlayerNFT = (
    await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    })
  ).connect(owner);
  const playerNFT = await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout,
  });
  await playerNFT.deployed();
  console.log("Deployed");
  tx = await playerNFT.setUpgradeCost(ethers.utils.parseEther("1208924")); // To prevent anyone doing it early
  await tx.wait();

  // Check a clan leader
  const clanId = (await clans.nextClanId()).add(1);
  console.log("Before clan rank", (await clans.playerInfo(2258)).rank);
  for (let i = ethers.BigNumber.from(1); i.lt(clanId); i = i.add(100)) {
    const tx = await clans.tempUpdateClanRankLeaders(i, i.add(99));
    await tx.wait();
    console.log("clans.tempUpdateClanRankLeaders", i.toString());
  }
  console.log("After clan rank (should be 1 more)", (await clans.playerInfo(2258)).rank);

  // Update max level flags
  console.log("before");
  let packedXP = await players.packedXP(69);
  console.log(packedXP.magic);
  console.log(packedXP.melee);
  console.log(packedXP.defence);
  console.log(Number(packedXP.packedDataIsMaxed).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed1).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed2).toString(2));

  // Tiam
  packedXP = await players.packedXP(465);
  console.log(packedXP.magic);
  console.log(Number(packedXP.packedDataIsMaxed).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed1).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed2).toString(2));
  tx = await players.tempSetPackedMaxLevelFlag(69, Skill.MAGIC); // Xardas
  tx = await players.tempSetPackedMaxLevelFlag(465, Skill.MAGIC); // Tiam
  await tx.wait();
  console.log("Update tempSetPackedMaxLevelFlag");

  packedXP = await players.packedXP(69);
  console.log(packedXP.magic);
  console.log(packedXP.melee);
  console.log(packedXP.defence);
  console.log(Number(packedXP.packedDataIsMaxed).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed1).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed2).toString(2));
  // Tiam
  packedXP = await players.packedXP(465);
  console.log(packedXP.magic);
  console.log(Number(packedXP.packedDataIsMaxed).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed1).toString(2));
  console.log(Number(packedXP.packedDataIsMaxed2).toString(2));

  // verify all the contracts
  await verifyContracts([
    players.address,
    playerNFT.address,
    clans.address,
    playersImplQueueActions.address,
    playersImplProcessActions.address,
    playersImplRewards.address,
    playersImplMisc.address,
    playersImplMisc1.address,
    estforLibrary.address,
    playersLibrary.address,
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
