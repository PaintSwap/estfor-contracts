import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {QUEST_BURN_BAN} from "@paintswap/estfor-definitions/constants";
import {ClanRank, OrderSide, TokenIdInfo} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {
  Bank,
  BankFactory,
  Clans,
  ItemNFT,
  MockBrushToken,
  OrderBook,
  PlayerNFT,
  Players,
  Quests,
  Shop
} from "../typechain-types";
import {createPlayer, isDevNetwork} from "./utils";
import {parseEther} from "ethers";
import {timeTravel} from "../test/utils";
import {calculateClanBankAddress} from "../test/Clans/utils";
import {allOrderBookTokenIdInfos} from "./data/orderbookTokenIdInfos";

export const addTestData = async (
  itemNFT: ItemNFT,
  playerNFT: PlayerNFT,
  players: Players,
  shop: Shop,
  brush: MockBrushToken,
  clans: Clans,
  bankFactory: BankFactory,
  bank: Bank,
  minItemQuantityBeforeSellsAllowed: bigint,
  orderBook: OrderBook,
  quests: Quests,
  startClanId: number
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
    petId: EstforConstants.NONE
  };

  let gasLimit = await players.startActions.estimateGas(
    playerId,
    [queuedActionWoodcutting],
    EstforTypes.ActionQueueStrategy.OVERWRITE
  );
  let tx = await players.startActions(playerId, [queuedActionWoodcutting], EstforTypes.ActionQueueStrategy.OVERWRITE, {
    gasLimit: gasLimit + 300000n
  });

  await tx.wait();
  console.log("Start woodcutting action");

  if (isDevNetwork(network)) {
    console.log("Increase time");
    await timeTravel(10000);
  } else {
    // Wait 1 minute till you get some
    await new Promise((r) => setTimeout(r, 60 * 1000));
  }

  // Because of the speed multiplier, gas estimates may not be accurate as other things could be minted by the time the tx is executed,
  // so adding 300k gas to be safe
  gasLimit = await players.processActions.estimateGas(playerId);
  tx = await players.processActions(playerId, {gasLimit: gasLimit + 300000n});
  await tx.wait();
  console.log("Process woodcutting action");

  console.log("Number of logs ", (await itemNFT.balanceOf(owner, EstforConstants.LOG)).toString());

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
    petId: EstforConstants.NONE
  };

  gasLimit = await players.startActions.estimateGas(
    playerId,
    [queuedActionFiremaking],
    EstforTypes.ActionQueueStrategy.OVERWRITE
  );
  tx = await players.startActions(playerId, [queuedActionFiremaking], EstforTypes.ActionQueueStrategy.OVERWRITE, {
    gasLimit: gasLimit + 300000n
  });
  await tx.wait();
  console.log("Start firemaking action");

  if (isDevNetwork(network)) {
    console.log("Increase time 2");
    await timeTravel(300);
  }

  gasLimit = await players.processActions.estimateGas(playerId);
  tx = await players.processActions(playerId, {
    gasLimit: gasLimit + 300000n
  });
  await tx.wait();
  console.log("Process actions (firemaking)");

  console.log("Number of logs after firemaking ", (await itemNFT.balanceOf(owner, EstforConstants.LOG)).toString());

  // Start another action
  gasLimit = await players.startActions.estimateGas(
    playerId,
    [queuedActionWoodcutting],
    EstforTypes.ActionQueueStrategy.OVERWRITE
  );
  tx = await players.startActions(playerId, [queuedActionWoodcutting], EstforTypes.ActionQueueStrategy.OVERWRITE, {
    gasLimit: gasLimit + 300000n
  });
  await tx.wait();
  console.log("Start an unprocessed action");

  if (isDevNetwork(network)) {
    console.log("Increase time 3");
    await ethers.provider.send("evm_increaseTime", [1000000]);
    await ethers.provider.send("evm_mine", []);
  }

  tx = await itemNFT.mint(owner, EstforConstants.BRONZE_HELMET, 1);
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
    petId: EstforConstants.NONE
  };

  gasLimit = await players.startActions.estimateGas(
    playerId,
    [queuedActionCombat],
    EstforTypes.ActionQueueStrategy.OVERWRITE
  );
  tx = await players.startActions(playerId, [queuedActionCombat], EstforTypes.ActionQueueStrategy.OVERWRITE, {
    gasLimit: gasLimit + 300000n
  });
  await tx.wait();
  console.log("Start a combat action");

  if (network.chainId == 31337n) {
    console.log("Increase time 4");
    await timeTravel(10);
  }

  gasLimit = await players.processActions.estimateGas(playerId);
  console.log("Gas limit", gasLimit.toString());
  tx = await players.processActions(playerId, {
    gasLimit: gasLimit + 600000n
  });
  await tx.wait();
  console.log("Process actions (melee combat)");

  // Buy from shop
  tx = await brush.approve(shop, parseEther("100"));
  await tx.wait();
  console.log("Approve brush for buying in the shop");

  tx = await shop.buy(owner, EstforConstants.MAGIC_FIRE_STARTER, 1);
  await tx.wait();
  console.log("Buy from shop");

  // Transfer some brush to the pool so we can sell something
  tx = await brush.transfer(shop, "100000");
  await tx.wait();
  console.log("Transfer some brush");

  tx = await itemNFT.mintBatch(
    owner,
    [EstforConstants.MAGIC_FIRE_STARTER, EstforConstants.TITANIUM_ARMOR],
    [minItemQuantityBeforeSellsAllowed, 1n]
  );
  await tx.wait();
  console.log("Mint enough magic fire starters that they can be sold");

  // Sell to shop (can be anything)
  if (isDevNetwork(network)) {
    try {
      tx = await shop.sell(EstforConstants.TITANIUM_ARMOR, 1, 1);
      process.exit(100); // This shouldn't happen as those can't be sold yet
    } catch {
      console.log("Increase time 5");
      await ethers.provider.send("evm_increaseTime", [86400 * 2]);
      await ethers.provider.send("evm_mine", []);
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
    await players.startActions(playerId, [queuedActionFiremaking], EstforTypes.ActionQueueStrategy.OVERWRITE);
    console.log("Number of logs before quest", (await itemNFT.balanceOf(owner, EstforConstants.LOG)).toString());
    await ethers.provider.send("evm_increaseTime", [1000]);
    await ethers.provider.send("evm_mine", []);
    await players.deactivateQuest(playerId); // Deactivate the quest so we can activate it again
    console.log("Number of logs after quest", (await itemNFT.balanceOf(owner, EstforConstants.LOG)).toString());
    await players.activateQuest(playerId, QUEST_BURN_BAN); // Deactivate the quest so we can activate it again
    console.log("Make progress on the quest");
  }

  // Create a clan
  tx = await brush.approve(clans, parseEther("1000"));
  await tx.wait();
  console.log("Approve brush for clan creation");

  const imageId = 2;
  const tierId = 1;
  tx = await clans.createClan(playerId, "Sam test clan", "G4ZgtP52JK", "soniclabs", "0xSonicLabs", imageId, tierId);
  await tx.wait();
  console.log("Create clan");

  const clanId = startClanId;
  const clanBankAddress = await calculateClanBankAddress(
    clanId,
    await bankFactory.getAddress(),
    await bank.getAddress()
  );

  // Send some item to the bank
  tx = await itemNFT.safeTransferFrom(owner, clanBankAddress, EstforConstants.BRONZE_HELMET, 1, "0x");
  await tx.wait();
  console.log("Send an item to the bank");

  // Invite new member
  const alicePlayerId = await createPlayer(playerNFT, startAvatarId, alice, "Alice", makeActive);
  console.log("create Alice");
  tx = await clans.inviteMembers(clanId, [alicePlayerId], playerId);
  await tx.wait();
  console.log("Invite Alice");
  tx = await clans.connect(alice).acceptInvite(clanId, alicePlayerId, 0);
  await tx.wait();
  console.log("Accept invite");

  // Leave clan
  tx = await clans.connect(alice).changeRank(clanId, alicePlayerId, ClanRank.NONE, alicePlayerId);
  await tx.wait();
  console.log("Leave clan");

  tx = await clans.inviteMembers(clanId, [alicePlayerId], playerId);
  await tx.wait();
  console.log("Re-invite Alice");

  tx = await clans.connect(alice).requestToJoin(clanId, alicePlayerId, 0);
  await tx.wait();
  console.log("Request to join as well");

  // Remove invition via player
  tx = await clans.connect(alice).deleteInvitesAsPlayer([clanId], alicePlayerId);
  await tx.wait();
  console.log("Delete invites as player");

  tx = await clans.inviteMembers(clanId, [alicePlayerId], playerId);
  await tx.wait();
  console.log("Re-invite Alice1");

  // Remove invitiation via clan
  tx = await clans.deleteInvitesAsClan(clanId, [alicePlayerId], playerId);
  await tx.wait();
  console.log("Delete invites as clan");

  tx = await clans.inviteMembers(clanId, [alicePlayerId], playerId);
  await tx.wait();
  console.log("Re-invite Alice2");

  // Make an orderbook update
  const tokenId = EstforConstants.MAGIC_FIRE_STARTER;
  const price = (allOrderBookTokenIdInfos.find((info) => info.tokenId === tokenId) as TokenIdInfo).tick;
  const quantity = 1;
  tx = await orderBook.connect(alice).limitOrders([
    {
      side: OrderSide.SELL,
      tokenId,
      price,
      quantity
    }
  ]);
  await tx.wait();
  console.log("Make a limit order");

  // Buy some brush
  tx = await quests.buyBrush(owner, 1, true, {value: ethers.parseEther("0.001")});
  await tx.wait();
  console.log("Bought some brush");

  // Sell some brush
  tx = await brush.approve(quests, ethers.parseEther("1"));
  await tx.wait();
  console.log("Approve brush for selling in quests");

  tx = await quests.sellBrush(owner, ethers.parseEther("0.001"), 0, false);
  await tx.wait();
  console.log("Sold brush");
};
