import {ethers, upgrades} from "hardhat";
import {
  BRIDGE_ADDRESS,
  BRUSH_ADDRESS,
  CLANS_ADDRESS,
  ITEM_NFT_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  QUESTS_ADDRESS,
} from "./contractAddresses";
import {createPlayer} from "./utils";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {getXPFromLevel} from "../test/Players/utils";
import {defaultAttire, QueuedActionInput} from "@paintswap/estfor-definitions/types";

async function main() {
  const [owner, alice] = await ethers.getSigners();
  //  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");
  //  const alice = await ethers.getImpersonatedSigner("0xBa00694692267ed0B5154d48Fcb4D435D0B24d3F");

  console.log(`Bridge a player from ${alice.address} on chain: ${await owner.getChainId()}`);
  const bridge = (await ethers.getContractAt("Bridge", BRIDGE_ADDRESS)).connect(alice);

  const playerNFT = (await ethers.getContractAt("PlayerNFT", PLAYER_NFT_ADDRESS)).connect(alice);

  // Create player
  const brush = (await ethers.getContractAt("MockBrushToken", BRUSH_ADDRESS)).connect(alice);
  let tx = await brush.approve(playerNFT.address, ethers.utils.parseEther("10000"));
  await tx.wait();
  console.log("Approve brush for upgrading");

  const playerId = await createPlayer(
    playerNFT,
    1,
    alice,
    "SamTester" + Math.floor(Math.random() * 100000),
    true,
    "discord",
    "twitter",
    "telegram",
    true
  );
  console.log("Created player", playerId);

  const clans = (await ethers.getContractAt("Clans", CLANS_ADDRESS)).connect(alice);

  // Create a clan
  tx = await brush.approve(clans.address, ethers.utils.parseEther("10000"));
  await tx.wait();
  console.log("Approve brush for clans");
  tx = await clans.connect(owner).setBridge(ethers.constants.AddressZero);
  await tx.wait();
  console.log("Set bridge to zero address");

  const clanId = await clans.nextClanId();
  console.log("Next clan id", clanId);
  const imageId = 2;
  const tierId = 3;
  tx = await clans.createClan(playerId, "Sam bridge test" + playerId, "G4ZgtP52JK", "paint", "paint", imageId, tierId);
  await tx.wait();
  console.log("Create clan");

  tx = await clans.connect(owner).setBridge(BRIDGE_ADDRESS);
  await tx.wait();
  console.log("Set bridge back");

  // Do the buy brush quest
  const players = await ethers.getContractAt("Players", PLAYERS_ADDRESS);
  tx = await players.pauseGame(false);
  await tx.wait();
  console.log("Pause game");

  tx = await players.connect(alice).activateQuest(playerId, EstforConstants.QUEST_PURSE_STRINGS);
  await tx.wait();
  console.log("Activate quest");
  tx = await players
    .connect(alice)
    .buyBrushQuest(alice.address, playerId, 0, true, {value: ethers.utils.parseEther("0.001")});
  await tx.wait();
  console.log("Buy brush quest");

  tx = await players.connect(alice).activateQuest(playerId, EstforConstants.QUEST_NYMPTH_WATCH);
  await tx.wait();
  console.log("Activate quest QUEST_NYMPTH_WATCH");

  const queuedAction: QueuedActionInput = {
    actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
    choiceId: 0,
    combatStyle: EstforTypes.CombatStyle.NONE,
    attire: {...defaultAttire},
    leftHandEquipmentTokenId: 0,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
    regenerateId: 0,
    timespan: 3600,
  };

  tx = await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
  await tx.wait();
  console.log("Start actions for woodcutting the quest");

  // sleep for 5 minutes seconds to make some progress on it
  await new Promise((r) => setTimeout(r, 5 * 60000));

  tx = await players.connect(alice).processActions(playerId);
  await tx.wait();
  console.log("Process actions for woodcutting the quest");

  const quests = await ethers.getContractAt("Quests", QUESTS_ADDRESS);
  const bridgeableQuests = await quests.getBridgeableQuests(playerId);
  console.log("Get bridgeable quests:", bridgeableQuests);

  tx = await players.pauseGame(true);
  await tx.wait();
  console.log("Pause game");

  // Start a passive action
  const passiveActions = await ethers.getContractAt("PassiveActions", PASSIVE_ACTIONS_ADDRESS);
  const itemNFT = await ethers.getContractAt("ItemNFT", ITEM_NFT_ADDRESS);

  tx = await itemNFT.testMint(alice.address, EstforConstants.EGG_TIER1, 5);
  await tx.wait();
  console.log("Mint item");

  tx = await passiveActions.setBridge(ethers.constants.AddressZero);
  await tx.wait();
  console.log("Set bridge");

  tx = await players.testModifyXP(alice.address, playerId, EstforTypes.Skill.ALCHEMY, getXPFromLevel(25), true);
  await tx.wait();
  console.log("Modify XP");
  tx = await players.testModifyXP(alice.address, playerId, EstforTypes.Skill.FISHING, getXPFromLevel(30), true);
  await tx.wait();
  console.log("Modify XP1");
  tx = await players.testModifyXP(alice.address, playerId, EstforTypes.Skill.COOKING, getXPFromLevel(30), true);
  await tx.wait();
  console.log("Modify XP2");

  tx = await passiveActions.connect(alice).startAction(playerId, EstforConstants.PASSIVE_ACTION_EGG_TIER2, 0);
  await tx.wait();
  console.log("Start passive action");

  tx = await passiveActions.setBridge(BRIDGE_ADDRESS);
  await tx.wait();
  console.log("Set bridge");

  //  const playerId = 954; // Update as necessary
  const discord = "9999999999999999";
  const twitter = "999999999999999";
  const telegram = "999999999999999";

  const clanDiscord = "paint";
  const clanTelegram = "G4ZgtP52JK";
  const clanTwitter = "paint";

  const bridgeFee = await bridge.quoteSendPlayer(
    playerId,
    discord,
    twitter,
    telegram,
    clanId,
    clanDiscord,
    clanTelegram,
    clanTwitter
  );

  console.log("bridgeFee quoteSendPlayer", ethers.utils.formatEther(bridgeFee.toString()));
  tx = await bridge.sendPlayer(playerId, discord, twitter, telegram, clanId, clanDiscord, clanTelegram, clanTwitter, {
    value: bridgeFee,
  });
  const receipt = await tx.wait();
  console.log(`hash: ${receipt.transactionHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
