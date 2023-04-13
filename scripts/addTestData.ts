import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {QUEST_STARTER_FIREMAKING} from "@paintswap/estfor-definitions/constants";
import {ethers} from "hardhat";
import {BankFactory, Clans, ItemNFT, MockBrushToken, PlayerNFT, Players, Quests, Shop} from "../typechain-types";
import {createPlayer} from "./utils";

export const addTestData = async (
  itemNFT: ItemNFT,
  playerNFT: PlayerNFT,
  players: Players,
  shop: Shop,
  brush: MockBrushToken,
  quests: Quests,
  clans: Clans,
  bankFactory: BankFactory
) => {
  const [owner, alice] = await ethers.getSigners();

  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const startAvatarId = 1;

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

  // First woodcutting
  const queuedActionWoodcutting: EstforTypes.QueuedActionInput = {
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
  };

  let gasLimit = await players.estimateGas.startAction(
    playerId,
    queuedActionWoodcutting,
    EstforTypes.ActionQueueStatus.NONE
  );
  let tx = await players.startAction(playerId, queuedActionWoodcutting, EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });

  await tx.wait();
  console.log("Start woodcutting action");

  tx = await players.setSpeedMultiplier(playerId, 60); // Turns 1 second into 1 minute
  await tx.wait();
  console.log("Set speed multiiplier");

  if (network.chainId == 31337 || network.chainId == 1337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [10000]);
  }

  // Because of the speed multiplier, gas estimates may not be accurate as other things could be minted by the time the tx is executed,
  // so adding 300k gas to be safe
  gasLimit = await players.estimateGas.processActions(playerId);
  tx = await players.processActions(playerId, {gasLimit: gasLimit.add(300000)});
  await tx.wait();
  console.log("Process woodcutting action");

  console.log("Number of logs ", (await itemNFT.balanceOf(owner.address, EstforConstants.LOG)).toNumber());

  // Next firemaking
  const queuedActionFiremaking: EstforTypes.QueuedActionInput = {
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
  console.log("Start firemaking action");

  if (network.chainId == 31337 || network.chainId == 1337) {
    console.log("Increase time 2");
    await ethers.provider.send("evm_increaseTime", [3]);
  }

  gasLimit = await players.estimateGas.processActions(playerId);
  tx = await players.processActions(playerId, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("Process actions (firemaking)");

  console.log(
    "Number of logs after firemaking ",
    (await itemNFT.balanceOf(owner.address, EstforConstants.LOG)).toNumber()
  );

  // Start another action
  gasLimit = await players.estimateGas.startAction(
    playerId,
    queuedActionWoodcutting,
    EstforTypes.ActionQueueStatus.NONE
  );
  tx = await players.startAction(playerId, queuedActionWoodcutting, EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("Start an unprocessed action");

  if (network.chainId == 31337 || network.chainId == 1337) {
    console.log("Increase time 3");
    await ethers.provider.send("evm_increaseTime", [1000000]);
  }

  tx = await itemNFT.testMint(owner.address, EstforConstants.BRONZE_HELMET, 1);
  await tx.wait();
  console.log("Minted Bronze Helmet");

  // Start a combat action
  const queuedActionCombat: EstforTypes.QueuedActionInput = {
    attire: {...EstforTypes.noAttire, head: EstforConstants.BRONZE_HELMET},
    actionId: EstforConstants.ACTION_COMBAT_NATUOW,
    combatStyle: EstforTypes.CombatStyle.ATTACK,
    choiceId: EstforConstants.ACTIONCHOICE_MELEE_MONSTER,
    choiceId1: EstforConstants.NONE,
    choiceId2: EstforConstants.NONE,
    regenerateId: EstforConstants.NONE,
    timespan: 7200,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
    leftHandEquipmentTokenId: EstforConstants.NONE,
  };

  gasLimit = await players.estimateGas.startAction(playerId, queuedActionCombat, EstforTypes.ActionQueueStatus.NONE);
  tx = await players.startAction(playerId, queuedActionCombat, EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("Start a combat action");

  if (network.chainId == 31337) {
    console.log("Increase time 4");
    await ethers.provider.send("evm_increaseTime", [10]);
  }

  gasLimit = await players.estimateGas.processActions(playerId);
  tx = await players.processActions(playerId, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("Process actions (melee combat)");

  // Buy from shop
  tx = await brush.approve(shop.address, ethers.utils.parseEther("100"));
  await tx.wait();
  console.log("Approve brush");

  tx = await shop.buy(EstforConstants.MAGIC_FIRE_STARTER, 1);
  await tx.wait();
  console.log("Buy from shop");

  // Transfer some brush to the pool so we can sell something
  tx = await brush.transfer(shop.address, "100000");
  await tx.wait();
  console.log("Transfer some brush");

  tx = await itemNFT.testMint(owner.address, EstforConstants.MAGIC_FIRE_STARTER, 100);
  await tx.wait();
  console.log("Mint enough magic fire starters that they can be sold");

  // Sell to shop (can be anything)
  tx = await shop.sell(EstforConstants.MAGIC_FIRE_STARTER, 1, 1);
  await tx.wait();
  console.log("Sell");

  // Activate a quest
  tx = await quests.activateQuest(playerId, QUEST_STARTER_FIREMAKING);
  await tx.wait();
  console.log("Activate quest");

  // Create a clan
  const imageId = 2;
  const tierId = 1;
  tx = await clans.createClan(playerId, "Sam test clan", imageId, tierId);
  await tx.wait();
  console.log("Create clan");

  const clanId = 1;
  const clanBankAddress = ethers.utils.getContractAddress({
    from: bankFactory.address,
    nonce: clanId,
  });
  // Send some to the bank
  tx = await itemNFT.safeTransferFrom(owner.address, clanBankAddress, EstforConstants.BRONZE_HELMET, 1, "0x");
  await tx.wait();
  console.log("Send an item to the bank");

  // Invite new member
  const newPlayerId = await createPlayer(
    playerNFT,
    startAvatarId,
    alice,
    ethers.utils.formatBytes32String("Alice"),
    makeActive
  );
  console.log("create Alice");
  tx = await clans.inviteMember(clanId, newPlayerId, playerId);
  await tx.wait();
  console.log("Invite Alice");
  tx = await clans.connect(alice).acceptInvite(clanId, newPlayerId);
  await tx.wait();
  console.log("Accept invite");

  // Leave clan
  tx = await clans.connect(alice).leaveClan(clanId, newPlayerId);
  await tx.wait();
  console.log("Leave clan");

  tx = await clans.inviteMember(clanId, newPlayerId, playerId);
  await tx.wait();
  console.log("Re-invite Alice");

  tx = await clans.connect(alice).requestToJoin(clanId, newPlayerId);
  await tx.wait();
  console.log("Request to join as well");
};
