import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {ethers} from "hardhat";
import {ItemNFT, MockBrushToken, PlayerNFT, Players, Shop} from "../typechain-types";
import {createPlayer} from "./utils";

export const addTestData = async (
  itemNFT: ItemNFT,
  playerNFT: PlayerNFT,
  players: Players,
  shop: Shop,
  brush: MockBrushToken
) => {
  const [owner] = await ethers.getSigners();

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
  const queuedAction: EstforTypes.QueuedActionInput = {
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

  let gasLimit = await players.estimateGas.startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE);
  let tx = await players.startAction(playerId, queuedAction, EstforTypes.ActionQueueStatus.NONE, {
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
  console.log("start firemaking action");

  if (network.chainId == 31337 || network.chainId == 1337) {
    console.log("Increase time");
    await ethers.provider.send("evm_increaseTime", [3]);
  }

  gasLimit = await players.estimateGas.processActions(playerId);
  tx = await players.processActions(playerId, {
    gasLimit: gasLimit.add(300000),
  });
  await tx.wait();
  console.log("process actions (firemaking)");

  console.log(
    "Number of logs after firemaking ",
    (await itemNFT.balanceOf(owner.address, EstforConstants.LOG)).toNumber()
  );

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

  // Buy from shop
  tx = await brush.approve(shop.address, ethers.utils.parseEther("100"));
  await tx.wait();
  console.log("Approve brush");

  tx = await shop.buy(EstforConstants.MAGIC_FIRE_STARTER, 1);
  await tx.wait();
  console.log("buy from shop");

  // Transfer some brush to the pool so we can sell something
  tx = await brush.transfer(shop.address, "100000");
  await tx.wait();
  console.log("Transfer some brush");

  // Sell to shop (can be anything)
  tx = await shop.sell(EstforConstants.MAGIC_FIRE_STARTER, 1, 1);
  await tx.wait();
  console.log("Sell");
};
