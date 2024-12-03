import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {playersFixture} from "./PlayersFixture";
import {setupBasicPetMeleeCombat, getXPFromLevel, BOOST_START_NOW} from "./utils";
import {PetSkin, Skill} from "@paintswap/estfor-definitions/types";
import {allBasePets} from "../../scripts/data/pets";
import {NO_DONATION_AMOUNT} from "../utils";
import {Block} from "ethers";

describe("Pets", function () {
  it("Queue a pet which you don't have a balance for", async function () {
    const {players, playerId, itemNFT, worldActions, brush, playerNFT, upgradePlayerBrushPrice, origName, alice} =
      await loadFixture(playersFixture);
    const petId = 1;
    const {queuedAction} = await setupBasicPetMeleeCombat(itemNFT, worldActions, petId);
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);
    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "PetNotOwned");
  });

  it("Queue a pet with combat, should revert if you are not evolved", async function () {
    const {
      players,
      playerId,
      petNFT,
      itemNFT,
      worldActions,
      brush,
      playerNFT,
      upgradePlayerBrushPrice,
      origName,
      alice
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5));
    const petId = 1;
    const {queuedAction} = await setupBasicPetMeleeCombat(itemNFT, worldActions, petId);

    await expect(
      players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE)
    ).to.be.revertedWithCustomError(players, "PlayerNotUpgraded");

    // Upgrade player, can now equip pet
    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

    // Should be killing 1 every 72 seconds when you have 6 melee. So a melee of 3 with a 100% multiplier will be enough
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

    await ethers.provider.send("evm_increaseTime", [72]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(getXPFromLevel(5) + 36);
  });

  it("Queue a pet with combat, partial action consumption", async function () {
    const {
      players,
      playerId,
      petNFT,
      itemNFT,
      worldActions,
      brush,
      playerNFT,
      upgradePlayerBrushPrice,
      origName,
      alice
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5));
    const petId = 1;
    const {queuedAction} = await setupBasicPetMeleeCombat(itemNFT, worldActions, petId);

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

    // Should be killing 1 every 72 seconds when you have 6 melee. So a melee of 3 with a 100% multiplier will be enough
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [62]);
    await ethers.provider.send("evm_mine", []);

    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(getXPFromLevel(5));

    await ethers.provider.send("evm_increaseTime", [10]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(getXPFromLevel(5) + 36);
  });

  it("Transfer away and back and the pet should no longer be used", async function () {
    const {
      players,
      playerId,
      petNFT,
      itemNFT,
      worldActions,
      brush,
      playerNFT,
      upgradePlayerBrushPrice,
      origName,
      owner,
      alice
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5));
    const petId = 1;
    const {queuedAction} = await setupBasicPetMeleeCombat(itemNFT, worldActions, petId);

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    let pet = await petNFT.getPet(petId);
    expect(pet.lastAssignmentTimestamp).to.eq(NOW);
    await petNFT.connect(alice).safeTransferFrom(alice, owner, petId, 1, "0x");
    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
    pet = await petNFT.getPet(petId);
    expect(pet.owner).to.eq(owner);
    expect(pet.lastAssignmentTimestamp).to.eq(NOW1);
    await petNFT.safeTransferFrom(owner, alice, petId, 1, "0x");
    await ethers.provider.send("evm_increaseTime", [72]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(getXPFromLevel(5)); // No XP gained
  });

  it("Transfer away and back and the pet can should still be used for later queued actions", async function () {
    const {
      players,
      playerId,
      petNFT,
      itemNFT,
      worldActions,
      brush,
      playerNFT,
      upgradePlayerBrushPrice,
      origName,
      owner,
      alice
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5));
    const petId = 1;
    const {queuedAction} = await setupBasicPetMeleeCombat(itemNFT, worldActions, petId);

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

    await players
      .connect(alice)
      .startActions(playerId, [queuedAction, queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await petNFT.connect(alice).safeTransferFrom(alice, owner, petId, 1, "0x");
    await petNFT.safeTransferFrom(owner, alice, petId, 1, "0x");
    await itemNFT
      .connect(alice)
      .burn(alice, EstforConstants.COOKED_MINNUS, await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS));
    // Died so no XP gained
    expect((await players.getActionQueue(playerId)).length).to.eq(2);
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);

    expect((await players.getActionQueue(playerId)).length).to.eq(1);
    await itemNFT.mint(alice, EstforConstants.COOKED_MINNUS, 20000);
    await ethers.provider.send("evm_increaseTime", [72]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(getXPFromLevel(5) + 36); // Now gain some XP
  });

  it("Queue a pet with combat and startActionsAdvanced", async function () {
    const {
      players,
      playerId,
      petNFT,
      itemNFT,
      worldActions,
      brush,
      playerNFT,
      upgradePlayerBrushPrice,
      origName,
      alice
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5));
    const petId = 1;
    const {queuedAction} = await setupBasicPetMeleeCombat(itemNFT, worldActions, petId);

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    await ethers.provider.send("evm_increaseTime", [72]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(getXPFromLevel(5) + 36);
  });

  it("Queue a pet with combat, percentage + fixed", async function () {
    const {
      players,
      playerId,
      petNFT,
      itemNFT,
      worldActions,
      brush,
      playerNFT,
      upgradePlayerBrushPrice,
      origName,
      alice
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [2, 0];
    basePet.skillFixedMaxs = [2, 0];
    basePet.skillPercentageMins = [60, 0];
    basePet.skillPercentageMaxs = [60, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5));
    const petId = 1;
    const {queuedAction} = await setupBasicPetMeleeCombat(itemNFT, worldActions, petId);

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

    // Should be killing 1 every 72 seconds when you have 6 melee. So a melee of 3 with a 100% multiplier will be enough
    await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await ethers.provider.send("evm_increaseTime", [72]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(getXPFromLevel(5) + 36);
  });

  it("Cannot transfer an anniversary pet", async function () {
    const {petNFT, owner, alice} = await loadFixture(playersFixture);

    const basePet = allBasePets.find((pet) => pet.skin === PetSkin.ANNIV1) as EstforTypes.BasePetInput;
    expect(basePet.skin).to.eq(PetSkin.ANNIV1);
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    const petId = 1;
    await expect(petNFT.connect(alice).safeTransferFrom(alice, owner, petId, 1, "0x"))
      .to.be.revertedWithCustomError(petNFT, "CannotTransferThisPet")
      .withArgs(petId);
  });
});
