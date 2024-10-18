import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforTypes, EstforConstants, NONE} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {playersFixture} from "./PlayersFixture";
import {allActions} from "../../scripts/data/actions";
import {
  allActionChoiceIdsCooking,
  allActionChoiceIdsCrafting,
  allActionChoiceIdsFiremaking,
  allActionChoiceIdsMagic,
  allActionChoiceIdsMelee,
  allActionChoiceIdsRanged,
  allActionChoiceIdsSmithing
} from "../../scripts/data/actionChoiceIds";
import {
  allActionChoicesCooking,
  allActionChoicesCrafting,
  allActionChoicesFiremaking,
  allActionChoicesMagic,
  allActionChoicesMelee,
  allActionChoicesRanged,
  allActionChoicesSmithing
} from "../../scripts/data/actionChoices";
import {avatarIds, avatarInfos} from "../../scripts/data/avatars";
import {allXPThresholdRewards} from "../../scripts/data/xpThresholdRewards";
import {allItems} from "../../scripts/data/items";
import {allFullAttireBonuses} from "../../scripts/data/fullAttireBonuses";
import {Block} from "ethers";

describe("Fuzz testing", async function () {
  // TODO - Add fuzz testing for clans
  // TODO - Add fuzz testing for world
  // TODO - Add fuzz testing for items
  // TODO - Add fuzz testing for playerNFT
  // This doesn't handle everything, but it's a good start
  it.skip("Simulate whole game", async function () {
    this.timeout(1000 * 1000); // 1000 seconds
    const numActions = 1000;

    // Uses all sorts of random values to try and find bugs
    const {playerId, players, playerNFT, itemNFT, world, alice} = await loadFixture(playersFixture);

    await players.setDailyRewardsEnabled(true);
    await playerNFT.setAvatars(avatarIds, avatarInfos);
    await players.addXPThresholdRewards(allXPThresholdRewards);
    const chunkSize = 100;
    for (let i = 0; i < allItems.length; i += chunkSize) {
      const chunk = allItems.slice(i, i + chunkSize);
      await itemNFT.addItems(chunk);
    }

    // Add full equipment bonuses
    await players.addFullAttireBonuses(allFullAttireBonuses);
    await world.addActions(allActions);

    const fireMakingActionId = EstforConstants.ACTION_FIREMAKING_ITEM;
    const smithingActionId = EstforConstants.ACTION_SMITHING_ITEM;
    const cookingActionId = EstforConstants.ACTION_COOKING_ITEM;
    const craftingActionId = EstforConstants.ACTION_CRAFTING_ITEM;
    const genericCombatActionId = EstforConstants.NONE;

    await world.addBulkActionChoices(
      [
        fireMakingActionId,
        smithingActionId,
        cookingActionId,
        craftingActionId,
        genericCombatActionId,
        genericCombatActionId,
        genericCombatActionId
      ],
      [
        allActionChoiceIdsFiremaking,
        allActionChoiceIdsSmithing,
        allActionChoiceIdsCooking,
        allActionChoiceIdsCrafting,
        allActionChoiceIdsMelee,
        allActionChoiceIdsMagic,
        allActionChoiceIdsRanged
      ],
      [
        allActionChoicesFiremaking,
        allActionChoicesSmithing,
        allActionChoicesCooking,
        allActionChoicesCrafting,
        allActionChoicesMelee,
        allActionChoicesMagic,
        allActionChoicesRanged
      ]
    );

    const boosts = [
      EstforConstants.NONE,
      EstforConstants.COMBAT_BOOST,
      EstforConstants.XP_BOOST,
      EstforConstants.GATHERING_BOOST,
      EstforConstants.SKILL_BOOST
    ];

    // Pick a random action
    for (let i = 0; i < numActions; ++i) {
      const action = allActions[Math.floor(Math.random() * allActions.length)];
      const isCombat = action.info.numSpawned != 0;

      const combatStyles = [
        EstforTypes.CombatStyle.NONE,
        EstforTypes.CombatStyle.ATTACK,
        EstforTypes.CombatStyle.DEFENCE
      ];
      let choiceId = EstforConstants.NONE;
      const combatStyle = combatStyles[Math.floor(Math.random() * combatStyles.length)];
      let rightHandEquipmentTokenId = EstforConstants.NONE;
      let leftHandEquipmentTokenId = EstforConstants.NONE;
      let actionChoice = null;
      let minXP = 0n;
      if (action.info.actionChoiceRequired) {
        if (isCombat) {
          const choiceIds = [
            EstforConstants.NONE,
            ...allActionChoiceIdsMelee,
            ...allActionChoiceIdsRanged,
            ...allActionChoiceIdsMagic
          ];
          choiceId = choiceIds[Math.floor(Math.random() * choiceIds.length)];
          actionChoice = await world.getActionChoice(NONE, choiceId);
          minXP = actionChoice.minXP;
          // Sometimes equip food (or scrolls/arrows if magic/ranged)
        } else {
          if (action.info.skill == EstforTypes.Skill.COOKING) {
            const index = Math.floor(Math.random() * allActionChoicesCooking.length);
            choiceId = allActionChoiceIdsCooking[index];
            actionChoice = allActionChoicesCooking[index];
            minXP = actionChoice.minXPs[0];
          } else if (action.info.skill == EstforTypes.Skill.CRAFTING) {
            const index = Math.floor(Math.random() * allActionChoicesCrafting.length);
            choiceId = allActionChoiceIdsCrafting[index];
            actionChoice = allActionChoicesCrafting[index];
            minXP = actionChoice.minXPs[0];
          } else if (action.info.skill == EstforTypes.Skill.SMITHING) {
            const index = Math.floor(Math.random() * allActionChoicesSmithing.length);
            choiceId = allActionChoiceIdsSmithing[index];
            actionChoice = allActionChoicesSmithing[index];
            minXP = actionChoice.minXPs[0];
          } else if (action.info.skill == EstforTypes.Skill.FIREMAKING) {
            const index = Math.floor(Math.random() * allActionChoicesFiremaking.length);
            choiceId = allActionChoiceIdsFiremaking[index];
            actionChoice = allActionChoicesFiremaking[index];
            minXP = actionChoice.minXPs[0];
          }
        }
      } else {
        // No actionChoice required
        const randomBoost = boosts[Math.floor(Math.random() * boosts.length)]; // Can be NONE

        if (action.info.handItemTokenIdRangeMin == EstforConstants.NONE) {
          // Don't need to equip anything
        } else {
          // Need to equip something
          const handItems: number[] = [];
          for (let i = action.info.handItemTokenIdRangeMin; i <= action.info.handItemTokenIdRangeMax; ++i) {
            handItems.push(i);
          }

          // Pick a random one
          rightHandEquipmentTokenId = handItems[Math.floor(Math.random() * handItems.length)];

          if (rightHandEquipmentTokenId == 0) {
            console.log("WTF!!!!");
          }

          await itemNFT.testMint(alice.address, rightHandEquipmentTokenId, 1); // mint 1
        }
      }

      let rightHandItem;
      let leftHandItem;
      let hasItemMinimumRequirements = true;
      if (rightHandEquipmentTokenId != EstforConstants.NONE) {
        console.log(rightHandEquipmentTokenId);
        rightHandItem = allItems.find((inputItem) => inputItem.tokenId == rightHandEquipmentTokenId);
        if (
          rightHandItem &&
          rightHandItem.skill != Skill.NONE &&
          rightHandItem.minXP != 0 &&
          hasItemMinimumRequirements
        ) {
          hasItemMinimumRequirements =
            (await players.getPlayerXP(playerId, rightHandItem.skill)) >= rightHandItem.minXP;
        } else if (!rightHandItem) {
          hasItemMinimumRequirements = false;
        }
      }
      if (leftHandEquipmentTokenId != EstforConstants.NONE) {
        leftHandItem = allItems.find((inputItem) => inputItem.tokenId == leftHandEquipmentTokenId);
        if (leftHandItem && leftHandItem.skill != Skill.NONE && leftHandItem.minXP != 0 && hasItemMinimumRequirements) {
          hasItemMinimumRequirements = (await players.getPlayerXP(playerId, leftHandItem.skill)) >= leftHandItem.minXP;
        } else if (!leftHandItem) {
          hasItemMinimumRequirements = false;
        }
      }

      const timespan = Math.floor(Math.random() * 24 * 3601); // Up to 24 hours
      let hasActionMinimumRequirements = true;
      if (!isCombat) {
        hasActionMinimumRequirements = (await players.getPlayerXP(playerId, action.info.skill)) >= action.info.minXP;
      }
      const correctChoiceId =
        (!action.info.actionChoiceRequired && choiceId == EstforConstants.NONE) ||
        (action.info.actionChoiceRequired && choiceId != EstforConstants.NONE);
      let hasActionChoiceMinimumRequirements = true;
      if (actionChoice != null) {
        hasActionChoiceMinimumRequirements = (await players.getPlayerXP(playerId, actionChoice.skill)) >= minXP;
      }

      const correctCombatStyle = (combatStyle == EstforTypes.CombatStyle.NONE) !== isCombat;

      const regenerateId = EstforConstants.NONE;

      // Start a combat action
      const queuedAction: EstforTypes.QueuedActionInput = {
        attire: {...EstforTypes.noAttire},
        actionId: action.actionId,
        combatStyle,
        choiceId,
        regenerateId,
        timespan,
        rightHandEquipmentTokenId,
        leftHandEquipmentTokenId
      };

      const shouldRevert =
        !hasItemMinimumRequirements ||
        !hasActionMinimumRequirements ||
        !hasActionChoiceMinimumRequirements ||
        !correctCombatStyle ||
        !correctChoiceId;

      // If there are 3 actions and the first one has finished then increase time some more
      const actionQueueLength = (await players.getActionQueue(playerId)).length;
      if (actionQueueLength == 3) {
        // Check if the first action has finished
        const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
        const firstAction = (await players.getActionQueue(playerId))[0];
        if ((await players.players(playerId)).currentActionStartTime + firstAction.timespan >= NOW) {
          await ethers.provider.send("evm_increaseTime", [
            (await players.players(playerId)).currentActionStartTime + firstAction.timespan - BigInt(NOW)
          ]);
          await ethers.provider.send("evm_mine", []);
        }
      }

      if (shouldRevert) {
        console.log(
          hasItemMinimumRequirements,
          hasActionMinimumRequirements,
          hasActionChoiceMinimumRequirements,
          correctCombatStyle,
          correctChoiceId
        );
        if (!hasActionMinimumRequirements) {
          console.log(action);
          console.log("Action Min XP", await players.getPlayerXP(playerId, action.info.skill), action.info.minXP);
        }

        await expect(
          players
            .connect(alice)
            .startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS)
        ).to.be.reverted;
      } else {
        console.log("Right hand", rightHandEquipmentTokenId);

        await players
          .connect(alice)
          .startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.KEEP_LAST_IN_PROGRESS);
        console.log("Not reverted");
      }

      await ethers.provider.send("evm_increaseTime", [Math.floor(Math.random() * 24 * 3600)]);
      await ethers.provider.send("evm_mine", []);
    }

    // Confirm Level 100 of all skills are reached
  });
});
