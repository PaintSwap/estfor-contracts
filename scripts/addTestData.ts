import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {QUEST_BURN_BAN} from "@paintswap/estfor-definitions/constants";
import {ClanRank} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {BankFactory, Clans, ItemNFT, MockBrushToken, PlayerNFT, Players, Quests, Shop} from "../typechain-types";
import {createPlayer, isDevNetwork} from "./utils";

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
  const playerId = await createPlayer(playerNFT, startAvatarId, owner, "0xSamWitch", makeActive);
  console.log("createPlayer");

  // First woodcutting
  const queuedActionWoodcutting: EstforTypes.QueuedActionInput = {
    attire: EstforTypes.noAttire,
    actionId: EstforConstants.ACTION_WOODCUTTING_LOG,
    combatStyle: EstforTypes.CombatStyle.NONE,
    choiceId: EstforConstants.NONE,
    regenerateId: EstforConstants.NONE,
    timespan: 3600,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_AXE,
    leftHandEquipmentTokenId: EstforConstants.NONE,
  };

  let gasLimit = await players.estimateGas.startActions(
    playerId,
    [queuedActionWoodcutting],
    EstforTypes.ActionQueueStatus.NONE
  );
  let tx = await players.startActions(playerId, [queuedActionWoodcutting], EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });

  await tx.wait();
  console.log("Start woodcutting action");

  if (isDevNetwork(network)) {
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
    regenerateId: EstforConstants.NONE,
    timespan: 3600,
    rightHandEquipmentTokenId: EstforConstants.MAGIC_FIRE_STARTER,
    leftHandEquipmentTokenId: EstforConstants.NONE,
  };

  gasLimit = await players.estimateGas.startActions(
    playerId,
    [queuedActionFiremaking],
    EstforTypes.ActionQueueStatus.NONE
  );
  tx = await players.startActions(playerId, [queuedActionFiremaking], EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("Start firemaking action");

  if (isDevNetwork(network)) {
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
  gasLimit = await players.estimateGas.startActions(
    playerId,
    [queuedActionWoodcutting],
    EstforTypes.ActionQueueStatus.NONE
  );
  tx = await players.startActions(playerId, [queuedActionWoodcutting], EstforTypes.ActionQueueStatus.NONE, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("Start an unprocessed action");

  if (isDevNetwork(network)) {
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
    regenerateId: EstforConstants.NONE,
    timespan: 7200,
    rightHandEquipmentTokenId: EstforConstants.BRONZE_SWORD,
    leftHandEquipmentTokenId: EstforConstants.NONE,
  };

  gasLimit = await players.estimateGas.startActions(playerId, [queuedActionCombat], EstforTypes.ActionQueueStatus.NONE);
  tx = await players.startActions(playerId, [queuedActionCombat], EstforTypes.ActionQueueStatus.NONE, {
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

  tx = await itemNFT.testMints(
    owner.address,
    [EstforConstants.MAGIC_FIRE_STARTER, EstforConstants.TITANIUM_ARMOR],
    [100, 1]
  );
  await tx.wait();
  console.log("Mint enough magic fire starters that they can be sold");

  // Sell to shop (can be anything)
  if (isDevNetwork(network)) {
    try {
      tx = await shop.sell(EstforConstants.TITANIUM_ARMOR, 1, 1);
      process.exit(100); // This shouldn't happen as those can't be sold yet
    } catch {
      console.log("Increase time");
      await ethers.provider.send("evm_increaseTime", [86400 * 2]);
      tx = await shop.sell(EstforConstants.MAGIC_FIRE_STARTER, 1, 1);
      await tx.wait();
      console.log("Sell");
    }
  } else {
    // Sell should revert
    try {
      tx = await shop.sell(EstforConstants.MAGIC_FIRE_STARTER, 1, 1);
      process.exit(101); // This shouldn't happen
    } catch {}
  }

  // Activate a quest
  tx = await players.activateQuest(playerId, QUEST_BURN_BAN);
  await tx.wait();
  console.log("Activate quest");

  if (isDevNetwork(network)) {
    // Make some progress on the quest and process the action
    await players.startActions(playerId, [queuedActionFiremaking], EstforTypes.ActionQueueStatus.NONE);
    await ethers.provider.send("evm_increaseTime", [100]);
    await players.deactivateQuest(playerId); // Deactivate the quest so we can activate it again
    await players.activateQuest(playerId, QUEST_BURN_BAN); // Deactivate the quest so we can activate it again
    console.log("Make progress on the quest");
  }

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
  const alicePlayerId = await createPlayer(playerNFT, startAvatarId, alice, "Alice", makeActive);
  console.log("create Alice");
  tx = await clans.inviteMember(clanId, alicePlayerId, playerId);
  await tx.wait();
  console.log("Invite Alice");
  tx = await clans.connect(alice).acceptInvite(clanId, alicePlayerId);
  await tx.wait();
  console.log("Accept invite");

  // Leave clan
  tx = await clans.connect(alice).changeRank(clanId, alicePlayerId, ClanRank.NONE, alicePlayerId);
  await tx.wait();
  console.log("Leave clan");

  tx = await clans.inviteMember(clanId, alicePlayerId, playerId);
  await tx.wait();
  console.log("Re-invite Alice");

  tx = await clans.connect(alice).requestToJoin(clanId, alicePlayerId);
  await tx.wait();
  console.log("Request to join as well");

  // Remove invition via player
  tx = await clans.connect(alice).deleteInvitesAsPlayer([clanId], alicePlayerId);
  await tx.wait();
  console.log("Delete invites as player");

  tx = await clans.inviteMember(clanId, alicePlayerId, playerId);
  await tx.wait();
  console.log("Re-invite Alice1");

  // Remove invitiation via clan
  tx = await clans.deleteInvitesAsClan(clanId, [alicePlayerId], playerId);
  await tx.wait();
  console.log("Delete invites as clan");

  tx = await clans.inviteMember(clanId, alicePlayerId, playerId);
  await tx.wait();
  console.log("Re-invite Alice2");
};
