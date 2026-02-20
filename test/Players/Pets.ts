import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {playersFixture} from "./PlayersFixture";
import {setupBasicPetMeleeCombat, setupBasicAlchemy, getXPFromLevel, BOOST_START_NOW} from "./utils";
import {PetSkin, Skill} from "@paintswap/estfor-definitions/types";
import {allBasePets} from "../../scripts/data/pets";
import {NO_DONATION_AMOUNT} from "../utils";
import {Block} from "ethers";
import {SKIP_XP_THRESHOLD_EFFECTS} from "../../scripts/utils";

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
      alice,
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5), SKIP_XP_THRESHOLD_EFFECTS);
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
      alice,
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5), SKIP_XP_THRESHOLD_EFFECTS);
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
      alice,
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5), SKIP_XP_THRESHOLD_EFFECTS);
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
      alice,
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5), SKIP_XP_THRESHOLD_EFFECTS);
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
      alice,
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [0, 0];
    basePet.skillPercentageMins = [100, 0];
    basePet.skillPercentageMaxs = [101, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5), SKIP_XP_THRESHOLD_EFFECTS);
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
      alice,
    } = await loadFixture(playersFixture);

    const basePet = {...allBasePets[0]};
    basePet.skillFixedMins = [2, 0];
    basePet.skillFixedMaxs = [2, 0];
    basePet.skillPercentageMins = [60, 0];
    basePet.skillPercentageMaxs = [60, 0];
    await petNFT.addBasePets([basePet]);
    await petNFT.mintBatch(alice, [basePet.baseId], 0);

    await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5), SKIP_XP_THRESHOLD_EFFECTS);
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

  // it("Cannot transfer an anniversary pet", async function () {
  //   const {petNFT, owner, alice} = await loadFixture(playersFixture);

  //   const basePet = allBasePets.find((pet) => pet.skin === PetSkin.ANNIV1) as EstforTypes.BasePetInput;
  //   expect(basePet.skin).to.eq(PetSkin.ANNIV1);
  //   await petNFT.addBasePets([basePet]);
  //   await petNFT.mintBatch(alice, [basePet.baseId], 0);

  //   const petId = 1;
  //   await expect(petNFT.connect(alice).safeTransferFrom(alice, owner, petId, 1, "0x"))
  //     .to.be.revertedWithCustomError(petNFT, "CannotTransferThisPet")
  //     .withArgs(petId);
  // });

  describe("Non-combat pets with actions", function () {
    it("Queue a pet with alchemy action, should give XP bonus", async function () {
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
        alice,
      } = await loadFixture(playersFixture);

      // Use the PET_RIFT_ALCHEMY_TIER1 pet which has alchemy skill enhancement
      const basePet = allBasePets.find(
        (pet) => pet.baseId === EstforConstants.PET_RIFT_ALCHEMY_TIER1
      ) as EstforTypes.BasePetInput;
      expect(basePet).to.not.be.undefined;
      expect(basePet.skillEnhancements[0]).to.eq(Skill.ALCHEMY);

      // Modify the pet to have a fixed percentage bonus for easier testing
      const testPet = {...basePet};
      testPet.skillPercentageMins = [5, 0]; // 5% XP bonus
      testPet.skillPercentageMaxs = [5, 0]; // Max 5% to ensure we get 5%
      await petNFT.addBasePets([testPet]);
      await petNFT.mintBatch(alice, [testPet.baseId], 0);

      const petId = 1;
      const {queuedAction, choiceId} = await setupBasicAlchemy(itemNFT, worldActions);

      // Upgrade player so they can use pets
      await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
      await brush.mint(alice, upgradePlayerBrushPrice);
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

      // Mint alchemy materials
      await itemNFT.mint(alice, EstforConstants.SHADOW_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.NATURE_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.PAPER, 200);

      // Queue action with pet
      const queuedActionWithPet: EstforTypes.QueuedActionInput = {
        ...queuedAction,
        petId,
      };

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionWithPet], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);

      // Base XP is 3600 for 1 hour at 3600 xp/hr. With 5% bonus = 3600 * 1.05 = 3780
      const expectedXP = 3780;
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(expectedXP);
    });

    it("Pet bonus should not apply if pet skill doesn't match action skill", async function () {
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
        alice,
      } = await loadFixture(playersFixture);

      // Use a melee pet for an alchemy action - should give no bonus
      const basePet = {...allBasePets[0]}; // Default melee pet
      expect(basePet.skillEnhancements[0]).to.eq(Skill.MELEE);
      basePet.skillPercentageMins = [50, 0];
      basePet.skillPercentageMaxs = [51, 0];
      await petNFT.addBasePets([basePet]);
      await petNFT.mintBatch(alice, [basePet.baseId], 0);

      const petId = 1;
      const {queuedAction} = await setupBasicAlchemy(itemNFT, worldActions);

      await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
      await brush.mint(alice, upgradePlayerBrushPrice);
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

      await itemNFT.mint(alice, EstforConstants.SHADOW_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.NATURE_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.PAPER, 200);

      const queuedActionWithPet: EstforTypes.QueuedActionInput = {
        ...queuedAction,
        petId,
      };

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionWithPet], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);

      // Should get base XP only (3600) since melee pet doesn't boost alchemy
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(3600);
    });

    it("Pet with alchemy skill should not give bonus for combat actions", async function () {
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
        alice,
        playersLibrary,
      } = await loadFixture(playersFixture);

      // Use the alchemy pet for a melee combat action - should give no bonus
      const basePet = allBasePets.find(
        (pet) => pet.baseId === EstforConstants.PET_RIFT_ALCHEMY_TIER1
      ) as EstforTypes.BasePetInput;
      const testPet = {...basePet};
      testPet.skillPercentageMins = [50, 0];
      testPet.skillPercentageMaxs = [51, 0];
      await petNFT.addBasePets([testPet]);
      await petNFT.mintBatch(alice, [testPet.baseId], 0);

      await players.modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(5), SKIP_XP_THRESHOLD_EFFECTS);

      const petId = 1;
      const {queuedAction} = await setupBasicPetMeleeCombat(itemNFT, worldActions, petId);

      await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
      await brush.mint(alice, upgradePlayerBrushPrice);
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      await ethers.provider.send("evm_increaseTime", [72]);
      await ethers.provider.send("evm_mine", []);

      await expect(players.connect(alice).processActions(playerId)).to.revertedWithCustomError(
        playersLibrary,
        "SkillForPetNotHandledYet"
      );
    });

    it("Non-combat pet bonus should not apply if pet is transferred away after action started", async function () {
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
        alice,
      } = await loadFixture(playersFixture);

      const basePet = allBasePets.find(
        (pet) => pet.baseId === EstforConstants.PET_RIFT_ALCHEMY_TIER1
      ) as EstforTypes.BasePetInput;
      const testPet = {...basePet};
      testPet.skillPercentageMins = [5, 0];
      testPet.skillPercentageMaxs = [5, 0];
      await petNFT.addBasePets([testPet]);
      await petNFT.mintBatch(alice, [testPet.baseId], 0);

      const petId = 1;
      const {queuedAction} = await setupBasicAlchemy(itemNFT, worldActions);

      await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
      await brush.mint(alice, upgradePlayerBrushPrice);
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

      await itemNFT.mint(alice, EstforConstants.SHADOW_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.NATURE_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.PAPER, 200);

      const queuedActionWithPet: EstforTypes.QueuedActionInput = {
        ...queuedAction,
        petId,
      };

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionWithPet], EstforTypes.ActionQueueStrategy.OVERWRITE);

      // Transfer pet away
      await petNFT.connect(alice).safeTransferFrom(alice, owner, petId, 1, "0x");

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);

      // Should get base XP only (3600) since pet was transferred away
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(3600);
    });

    it("Non-combat pet bonus should still apply after pet is transferred back if action started before", async function () {
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
        alice,
      } = await loadFixture(playersFixture);

      const basePet = allBasePets.find(
        (pet) => pet.baseId === EstforConstants.PET_RIFT_ALCHEMY_TIER1
      ) as EstforTypes.BasePetInput;
      const testPet = {...basePet};
      testPet.skillPercentageMins = [5, 0];
      testPet.skillPercentageMaxs = [5, 0];
      await petNFT.addBasePets([testPet]);
      await petNFT.mintBatch(alice, [testPet.baseId], 0);

      const petId = 1;
      const {queuedAction} = await setupBasicAlchemy(itemNFT, worldActions);

      await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
      await brush.mint(alice, upgradePlayerBrushPrice);
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

      await itemNFT.mint(alice, EstforConstants.SHADOW_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.NATURE_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.PAPER, 200);

      const queuedActionWithPet: EstforTypes.QueuedActionInput = {
        ...queuedAction,
        petId,
      };

      // Queue two identical actions
      await players
        .connect(alice)
        .startActions(playerId, [queuedActionWithPet, queuedActionWithPet], EstforTypes.ActionQueueStrategy.OVERWRITE);

      // Transfer pet away and back - should invalidate it due to new assignment timestamp
      await petNFT.connect(alice).safeTransferFrom(alice, owner, petId, 1, "0x");
      await petNFT.safeTransferFrom(owner, alice, petId, 1, "0x");

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);

      // First action should have no bonus since pet was transferred away (lastAssignmentTimestamp updated)
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(3600);

      // Second action should have the bonus since pet is now owned before it started
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);

      // 3600 (first action without bonus) + 3780 (second action with 5% bonus)
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(3600 + 3780);
    });

    it("Non-combat pet with startActionsAdvanced", async function () {
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
        alice,
      } = await loadFixture(playersFixture);

      const basePet = allBasePets.find(
        (pet) => pet.baseId === EstforConstants.PET_RIFT_ALCHEMY_TIER1
      ) as EstforTypes.BasePetInput;
      const testPet = {...basePet};
      testPet.skillPercentageMins = [5, 0];
      testPet.skillPercentageMaxs = [5, 0];
      await petNFT.addBasePets([testPet]);
      await petNFT.mintBatch(alice, [testPet.baseId], 0);

      const petId = 1;
      const {queuedAction} = await setupBasicAlchemy(itemNFT, worldActions);

      await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
      await brush.mint(alice, upgradePlayerBrushPrice);
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

      await itemNFT.mint(alice, EstforConstants.SHADOW_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.NATURE_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.PAPER, 200);

      const queuedActionWithPet: EstforTypes.QueuedActionInput = {
        ...queuedAction,
        petId,
      };

      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedActionWithPet],
          EstforConstants.NONE,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);

      // 3600 * 1.05 = 3780
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(3780);
    });

    it("Non-combat pet bonus with partial action consumption", async function () {
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
        alice,
      } = await loadFixture(playersFixture);

      const basePet = allBasePets.find(
        (pet) => pet.baseId === EstforConstants.PET_RIFT_ALCHEMY_TIER1
      ) as EstforTypes.BasePetInput;
      const testPet = {...basePet};
      testPet.skillPercentageMins = [5, 0];
      testPet.skillPercentageMaxs = [5, 0];
      await petNFT.addBasePets([testPet]);
      await petNFT.mintBatch(alice, [testPet.baseId], 0);

      const petId = 1;
      const {queuedAction} = await setupBasicAlchemy(itemNFT, worldActions, 2000, 2);

      await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
      await brush.mint(alice, upgradePlayerBrushPrice);
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", true);

      await itemNFT.mint(alice, EstforConstants.SHADOW_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.NATURE_SCROLL, 100);
      await itemNFT.mint(alice, EstforConstants.PAPER, 200);

      const queuedActionWithPet: EstforTypes.QueuedActionInput = {
        ...queuedAction,
        petId,
      };

      await players
        .connect(alice)
        .startActions(playerId, [queuedActionWithPet], EstforTypes.ActionQueueStrategy.OVERWRITE);

      // Process after half an hour
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);

      // Half hour: 1800 * 1.05 = 1890
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(1890);

      // Process the remaining half hour
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine", []);

      await players.connect(alice).processActions(playerId);

      // Full hour: 3600 * 1.05 = 3780
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(3780);
    });
  });
});
