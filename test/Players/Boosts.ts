import {getStorageAt, loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {GUAR_MUL, NO_DONATION_AMOUNT, RATE_MUL, getActionId, requestAndFulfillRandomWords} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {setupBasicMeleeCombat, setupBasicWoodcutting, setupBasicCooking, setupBasicAlchemy} from "./utils";
import {defaultActionInfo, noAttire} from "@paintswap/estfor-definitions/types";
import {createPlayer} from "../../scripts/utils";
import {Block, keccak256, parseEther, zeroPadBytes, zeroPadValue} from "ethers";

const abiCoder = new ethers.AbiCoder();

describe("Boosts", function () {
  it("Add Boost, Full consume", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3300;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (boostDuration * boostValue) / 100
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL))
    );
  });

  it("Add Boost, partial consume", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue,
        boostDuration: 7200,
        isTransferable: false
      }
    ]);

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan + 2]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (queuedAction.timespan * boostValue) / 100
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL))
    );
  });

  describe("Boost overlaps", function () {
    it("Expired boost", async function () {
      // Expired boost should not affect XP
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const boostValue = 50;
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.XP_BOOST,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          // Boost
          boostType: EstforTypes.BoostType.NON_COMBAT_XP,
          boostValue,
          boostDuration: 86400,
          isTransferable: false
        }
      ]);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      await players
        .connect(alice)
        .startActionsExtra(
          playerId,
          [queuedAction],
          EstforConstants.XP_BOOST,
          NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStatus.NONE
        );
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [86400]); // boost has expired
      await ethers.provider.send("evm_mine", []);

      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(queuedAction.timespan);

      await players.connect(alice).processActions(playerId);
      expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        queuedAction.timespan + (queuedAction.timespan * boostValue) / 100 + queuedAction.timespan
      );
    });

    it("Boost end finishes in-between action start and end", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const boostValue = 50;
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.XP_BOOST,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          // Boost
          boostType: EstforTypes.BoostType.NON_COMBAT_XP,
          boostValue,
          boostDuration: 86400,
          isTransferable: false
        }
      ]);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);
      const queuedActionFinishAfterBoost = {...queuedAction};
      queuedActionFinishAfterBoost.timespan = 86400 - queuedAction.timespan;

      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      await players
        .connect(alice)
        .startActionsExtra(
          playerId,
          [queuedAction],
          EstforConstants.XP_BOOST,
          NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStatus.NONE
        );
      await players
        .connect(alice)
        .startActions(playerId, [queuedActionFinishAfterBoost], EstforTypes.ActionQueueStatus.NONE);
      await ethers.provider.send("evm_increaseTime", [queuedActionFinishAfterBoost.timespan]); // boost has expired inside action
      await ethers.provider.send("evm_mine", []);
      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
        BigInt(
          queuedActionFinishAfterBoost.timespan + Math.floor((queuedActionFinishAfterBoost.timespan * boostValue) / 100)
        ),
        BigInt(
          queuedActionFinishAfterBoost.timespan +
            Math.floor((queuedActionFinishAfterBoost.timespan * boostValue) / 100) +
            1
        )
      ]);
    });

    it("Check boost is removed from being active when processing", async function () {
      const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

      const boostValue = 50;
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.XP_BOOST,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          // Boost
          boostType: EstforTypes.BoostType.NON_COMBAT_XP,
          boostValue,
          boostDuration: 100,
          isTransferable: false
        }
      ]);

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, world);

      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      await players
        .connect(alice)
        .startActionsExtra(
          playerId,
          [queuedAction],
          EstforConstants.XP_BOOST,
          NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStatus.NONE
        );
      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);
      const slot = 16;
      const encoding = abiCoder.encode(["uint256", "uint256"], [playerId, slot]);
      const hash = keccak256(encoding);
      let boostInfoStorage = await getStorageAt(await players.getAddress(), hash);
      expect(boostInfoStorage).to.not.eq(zeroPadValue("0x00", 32));

      await players.connect(alice).processActions(playerId);
      boostInfoStorage = await getStorageAt(await players.getAddress(), hash);
      expect(boostInfoStorage).to.eq(zeroPadValue("0x00", 32));
    });
  });

  it("Combat Boost", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 50;
    const boostDuration = 120;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.COMBAT_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.COMBAT_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);

    await itemNFT.mint(alice, EstforConstants.COMBAT_BOOST, 1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.COMBAT_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    const meleeXP = queuedAction.timespan + (boostDuration * boostValue) / 100;
    const healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(meleeXP);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
      BigInt(healthXP),
      BigInt(healthXP - 1)
    ]);
  });

  it("Any XP Boost (combat)", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 50;
    const boostDuration = 120;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    const meleeXP = queuedAction.timespan + (boostDuration * boostValue) / 100;
    const healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(meleeXP);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
      BigInt(healthXP),
      BigInt(healthXP - 1)
    ]);
  });

  it("Any XP Boost (non combat)", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 50;
    const boostDuration = 120;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(
      queuedAction.timespan + (boostDuration * boostValue) / 100
    );
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      queuedAction.timespan + (boostDuration * boostValue) / 100
    );
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      Math.floor((queuedAction.timespan * rate) / (3600 * GUAR_MUL))
    );
  });

  it("Extra XP Boost", async function () {
    const {playerId, players, itemNFT, world, wishingWell, brush, alice} = await loadFixture(playersFixture);

    const boostValue = 50;
    const boostDuration = 120;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LUCK_OF_THE_DRAW,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );

    // Currently only minted through donation thresholds
    await brush.mint(alice, parseEther("10000"));
    await brush.connect(alice).approve(wishingWell, parseEther("10000"));

    const raffleCost = await wishingWell.getRaffleEntryCost();
    expect(raffleCost).to.be.gt(0);

    expect(await players.connect(alice).donate(playerId, raffleCost)).to.not.emit(
      wishingWell,
      "LastGlobalDonationThreshold"
    );

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    const meleeXP = queuedAction.timespan + (boostDuration * boostValue) / 100;
    const healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(meleeXP);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
      BigInt(healthXP),
      BigInt(healthXP - 1)
    ]);
  });

  it("Global XP Boost", async function () {
    const {playerId, players, itemNFT, world, wishingWell, brush, alice} = await loadFixture(playersFixture);

    const boostDuration = 120;
    const boostValue = 50;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );

    // Currently only minted through donation thresholds
    await brush.mint(alice, parseEther("10000"));
    await brush.connect(alice).approve(wishingWell, parseEther("10000"));

    const nextGlobalThreshold = await wishingWell.getNextGlobalThreshold();
    expect(nextGlobalThreshold).to.be.gt(0);

    await players.connect(alice).donate(0, nextGlobalThreshold - parseEther("1"));
    await expect(players.connect(alice).donate(playerId, parseEther("2")))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(parseEther("1000"), EstforConstants.PRAY_TO_THE_BEARDIE_2)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    const meleeXP = queuedAction.timespan + (boostDuration * boostValue) / 100;
    const healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(meleeXP);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
      BigInt(healthXP),
      BigInt(healthXP - 1)
    ]);
  });

  it("Clan XP Boost", async function () {
    const {playerId, players, itemNFT, world, wishingWell, clans, brush, alice, playerNFT, avatarId, bob} =
      await loadFixture(playersFixture);

    const boostDuration = 120;
    const boostValue = 50;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LUCK_OF_THE_DRAW,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 0,
        boostDuration,
        isTransferable: false
      }
    ]);

    // Be a member of a clan
    await clans.addTiers([
      {
        id: 1,
        maxMemberCapacity: 3,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);

    let tierId = 1;
    const imageId = 1;
    await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );

    // Currently only minted through donation thresholds
    await brush.mint(alice, parseEther("100000"));
    await brush.connect(alice).approve(wishingWell, parseEther("100000"));

    const clanId = 1;
    const clanDonationInfo = await wishingWell.getClanDonationInfo(clanId);
    expect(clanDonationInfo.totalDonated).to.be.eq(0);
    expect(clanDonationInfo.lastThreshold).to.be.eq(0);

    const raffleCost = await wishingWell.getRaffleEntryCost();
    expect(raffleCost).to.be.gt(0);

    await wishingWell.setClanDonationThresholdIncrement(raffleCost * 2n);

    await expect(players.connect(alice).donate(playerId, raffleCost)).to.not.emit(
      wishingWell,
      "LastClanDonationThreshold"
    );

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
    await clans.connect(alice).inviteMembers(clanId, [bobPlayerId], playerId);
    await clans.connect(bob).acceptInvite(clanId, bobPlayerId, 0);

    await brush.mint(bob, parseEther("100000"));
    await brush.connect(bob).approve(wishingWell, parseEther("100000"));

    await expect(players.connect(bob).donate(bobPlayerId, raffleCost))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleCost * 2n, EstforConstants.CLAN_BOOSTER_2)
      .and.to.emit(players, "ConsumeClanBoostVial");

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    const meleeXP = queuedAction.timespan + (boostDuration * boostValue) / 100;
    const healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(meleeXP);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
      BigInt(healthXP),
      BigInt(healthXP - 1)
    ]);
  });

  it("Normal, extra, clan & global XP Boosts", async function () {
    const {playerId, players, itemNFT, world, wishingWell, clans, brush, alice} = await loadFixture(playersFixture);

    const boostDuration = 120;
    const boostValue1 = 20;
    const boostValue2 = 15;
    const boostValue3 = 10;
    const boostValue4 = 5;
    const boostValue = boostValue1 + boostValue2 + boostValue3 + boostValue4; // total
    expect(boostValue).to.eq(50);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: boostValue1,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LUCK_OF_THE_DRAW,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: boostValue2,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: boostValue3,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: boostValue4,
        boostDuration,
        isTransferable: false
      }
    ]);

    // Be a member of a clan
    await clans.addTiers([
      {
        id: 1,
        maxMemberCapacity: 3,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);

    let tierId = 1;
    const imageId = 1;
    await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);
    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );

    // Currently only minted through donation thresholds
    await brush.mint(alice, parseEther("100000"));
    await brush.connect(alice).approve(wishingWell, parseEther("100000"));

    const clanId = 1;
    const nextGlobalThreshold = await wishingWell.getNextGlobalThreshold();
    const nextClanThreshold = await wishingWell.getNextClanThreshold(clanId);

    const maxThreshold = nextClanThreshold > nextGlobalThreshold ? nextClanThreshold : nextGlobalThreshold;

    const raffleCost = await wishingWell.getRaffleEntryCost();
    expect(raffleCost).to.be.gt(0n);

    await wishingWell.setClanDonationThresholdIncrement(raffleCost);

    await players.connect(alice).donate(0, maxThreshold - parseEther("1"));
    await expect(players.connect(alice).donate(playerId, raffleCost))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(parseEther("1000").toString(), EstforConstants.PRAY_TO_THE_BEARDIE_2)
      .and.to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleCost, EstforConstants.CLAN_BOOSTER_2);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    const meleeXP = queuedAction.timespan + (boostDuration * boostValue) / 100;
    const healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(meleeXP);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
      BigInt(healthXP),
      BigInt(healthXP - 1)
    ]);
  });

  // If a clan boost is active, and another one comes it should still count for actions queued up to this time.
  // TODO: Use secondBoostValue like the global boost test does
  it("Clan boost override", async function () {
    const {playerId, players, itemNFT, world, wishingWell, clans, brush, alice, playerNFT, avatarId, bob} =
      await loadFixture(playersFixture);

    const boostDuration = 720; // 2 kills worth
    const boostValue = 50;
    //    const secondBoostValue = 10;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER_2,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.COMBAT_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.CLAN_BOOSTER_3,
        equipPosition: EstforTypes.EquipPosition.CLAN_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LUCK_OF_THE_DRAW,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 0,
        boostDuration: 0,
        isTransferable: false
      }
    ]);

    // Be a member of a clan
    await clans.addTiers([
      {
        id: 1,
        maxMemberCapacity: 3,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);

    let tierId = 1;
    const imageId = 1;
    await clans.connect(alice).createClan(playerId, "Clan name", "discord", "telegram", "twitter", imageId, tierId);

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);

    await brush.mint(alice, parseEther("100000"));
    await brush.connect(alice).approve(wishingWell, parseEther("100000"));

    const clanId = 1;
    const raffleCost = await wishingWell.getRaffleEntryCost();
    await wishingWell.setClanDonationThresholdIncrement(raffleCost);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await expect(
      players
        .connect(alice)
        .startActionsExtra(
          playerId,
          [queuedAction],
          EstforConstants.NONE,
          NOW,
          0,
          raffleCost,
          EstforTypes.ActionQueueStatus.NONE
        )
    )
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleCost, EstforConstants.CLAN_BOOSTER_2)
      .and.to.emit(players, "ConsumeClanBoostVial");

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + boostDuration / 2 + 1]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    let meleeXP = boostDuration / 2 + ((boostDuration / 2) * boostValue) / 100;

    let healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);

    // Change to the next booster. This is combat XP, so it should give the same overall boost
    // Add bob
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
    await clans.connect(alice).inviteMembers(clanId, [bobPlayerId], playerId);
    await clans.connect(bob).acceptInvite(clanId, bobPlayerId, 0);

    await brush.mint(bob, parseEther("100000"));
    await brush.connect(bob).approve(wishingWell, parseEther("100000"));

    await expect(players.connect(bob).donate(bobPlayerId, raffleCost))
      .to.emit(wishingWell, "LastClanDonationThreshold")
      .withArgs(clanId, raffleCost * 2n, EstforConstants.CLAN_BOOSTER_3)
      .and.to.emit(players, "ConsumeClanBoostVial");

    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
    const extraBoostedTime = NOW1 - NOW - boostDuration / 2 - 1;

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + boostDuration + 1]);
    await ethers.provider.send("evm_mine", []);

    const clanBoost = await players.getClanBoost(clanId);
    expect(clanBoost.startTime).to.eq(NOW1);
    expect(clanBoost.duration).to.eq(boostDuration);
    expect(clanBoost.value).to.eq(boostValue);
    expect(clanBoost.itemTokenId).to.eq(EstforConstants.CLAN_BOOSTER_2);
    expect(clanBoost.boostType).to.eq(EstforTypes.BoostType.COMBAT_XP);

    expect(clanBoost.extraOrLastStartTime).to.eq(NOW + 1);
    expect(clanBoost.extraOrLastDuration).to.eq(boostDuration / 2 + extraBoostedTime);
    expect(clanBoost.extraOrLastValue).to.eq(boostValue);
    expect(clanBoost.extraOrLastItemTokenId).to.eq(EstforConstants.CLAN_BOOSTER);
    expect(clanBoost.extraOrLastBoostType).to.eq(EstforTypes.BoostType.ANY_XP);

    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    meleeXP = boostDuration + (boostDuration * boostValue) / 100;
    healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);

    // The new boost should be valid from the current time and not include anymore of the old one. So 1.5 boostDuration's worth
    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + boostDuration + boostDuration + 1]);
    await ethers.provider.send("evm_mine", []);

    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    meleeXP = Math.floor(boostDuration + boostDuration + ((boostDuration + extraBoostedTime) * 1.5 * boostValue) / 100);
    healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);

    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(meleeXP - 1);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
      BigInt(healthXP),
      BigInt(healthXP - 1)
    ]);
  });

  it("Global boost override", async function () {
    const {playerId, players, itemNFT, world, wishingWell, brush, alice} = await loadFixture(playersFixture);

    const boostDuration = 720;
    const boostValue = 50;
    const nonCombatBoostValue = 30;
    const nextBoostValue = 10;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE_2,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.NON_COMBAT_XP,
        boostValue: nonCombatBoostValue,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE_3,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.COMBAT_XP,
        boostValue: nextBoostValue,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LUCK_OF_THE_DRAW,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 0,
        boostDuration,
        isTransferable: false
      }
    ]);

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, world);

    // Currently only minted through donation thresholds
    await brush.mint(alice, parseEther("10000"));
    await brush.connect(alice).approve(wishingWell, parseEther("10000"));

    const nextGlobalThreshold = await wishingWell.getNextGlobalThreshold();
    expect(nextGlobalThreshold).to.be.gt(0);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await expect(
      players
        .connect(alice)
        .startActionsExtra(
          playerId,
          [queuedAction],
          EstforConstants.NONE,
          NOW,
          0,
          nextGlobalThreshold,
          EstforTypes.ActionQueueStatus.NONE
        )
    )
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(nextGlobalThreshold, EstforConstants.PRAY_TO_THE_BEARDIE_2)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + boostDuration / 2 + 1]);
    await ethers.provider.send("evm_mine", []);
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    let meleeXP = boostDuration / 2 + ((boostDuration / 2) * boostValue) / 100;
    let healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);

    await expect(players.connect(alice).donate(0, nextGlobalThreshold))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(nextGlobalThreshold * 2n, EstforConstants.PRAY_TO_THE_BEARDIE_3)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
    let extraBoostedTime = NOW1 - NOW - boostDuration / 2 - 1;

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + boostDuration + boostDuration + 1]);
    await ethers.provider.send("evm_mine", []);

    const globalBoost = await players.getGlobalBoost();
    expect(globalBoost.startTime).to.eq(NOW1);
    expect(globalBoost.duration).to.eq(boostDuration);
    expect(globalBoost.value).to.eq(nonCombatBoostValue);
    expect(globalBoost.itemTokenId).to.eq(EstforConstants.PRAY_TO_THE_BEARDIE_2);
    expect(globalBoost.boostType).to.eq(EstforTypes.BoostType.NON_COMBAT_XP);

    expect(globalBoost.extraOrLastStartTime).to.eq(NOW + 1);
    expect(globalBoost.extraOrLastDuration).to.eq(boostDuration / 2 + extraBoostedTime);
    expect(globalBoost.extraOrLastValue).to.eq(boostValue);
    expect(globalBoost.extraOrLastItemTokenId).to.eq(EstforConstants.PRAY_TO_THE_BEARDIE);
    expect(globalBoost.extraOrLastBoostType).to.eq(EstforTypes.BoostType.ANY_XP);

    // This global boost has no effect because it is a non-combat boost.
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    meleeXP = Math.floor(boostDuration + boostDuration + ((boostDuration / 2 + extraBoostedTime) * boostValue) / 100); // No extra
    healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);

    // The next global boost should have an effect
    await expect(players.connect(alice).donate(0, nextGlobalThreshold))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(nextGlobalThreshold * 3n, EstforConstants.PRAY_TO_THE_BEARDIE)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + boostDuration + boostDuration + boostDuration + 1]);
    await ethers.provider.send("evm_mine", []);

    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    meleeXP =
      Math.floor(
        boostDuration +
          boostDuration +
          boostDuration +
          ((boostDuration / 2 + extraBoostedTime) * boostValue) / 100 +
          (boostDuration * nextBoostValue) / 100
      ) - 1;
    healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);

    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MELEE)).to.eq(meleeXP);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.HEALTH)).to.be.deep.oneOf([
      BigInt(healthXP),
      BigInt(healthXP - 1)
    ]);
  });

  // XP boost for 1 hour, no XP boost (uses gathering boost) for 6 hours, XP boost for 1 hour.
  it("Any XP Boost, check multiple boost consumptions and period without XP boost", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 50;
    const boostDuration = 7200;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.XP_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue,
        boostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.GATHERING_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.GATHERING,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const {queuedAction: queuedActionWoodcutting, rate} = await setupBasicWoodcutting(itemNFT, world);
    const queuedAction = {...queuedActionWoodcutting, timespan: 3600 * 8};

    await itemNFT.mintBatch(alice, [EstforConstants.XP_BOOST, EstforConstants.GATHERING_BOOST], [2, 2]);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);

    // Change to gathering boost
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.APPEND
      );
    await ethers.provider.send("evm_increaseTime", [3600 * 6]);
    await ethers.provider.send("evm_mine", []);
    // Back to XP boost
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.APPEND
      );
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);

    // 2 hours boosted XP, 6 hours not boosted in total
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.deep.oneOf([
      BigInt(8 * 3600 + (2 * 3600 * boostValue) / 100),
      BigInt(8 * 3600 + (2 * 3600 * boostValue) / 100 - 1),
      BigInt(8 * 3600 + (2 * 3600 * boostValue) / 100 - 2)
    ]);

    // 2 hours gathering boost, check drops are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      Math.floor((8 * 3600 * rate) / (3600 * GUAR_MUL)) +
        Math.floor((2 * 3600 * rate * boostValue) / (3600 * GUAR_MUL * 100))
    );
  });

  it("TODO, swap boost", async function () {
    // Check that they are minted/consumed as expected
  });

  it("TODO Clear everything, check boost", async function () {
    // Check that they are
  });

  it("Gathering boost", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.GATHERING_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.GATHERING,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, world);
    await itemNFT.mint(alice, EstforConstants.GATHERING_BOOST, 1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.LOG)).to.eq(
      Math.floor(
        (queuedAction.timespan * rate) / (3600 * GUAR_MUL) +
          (boostDuration * boostValue * rate) / (100 * GUAR_MUL * 3600)
      )
    );
  });

  it("Gathering boost, cooking with successPercent", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.GATHERING_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.GATHERING,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const successPercent = 50;
    const minLevel = 1;
    const {queuedAction, rate} = await setupBasicCooking(itemNFT, world, successPercent, minLevel);
    await itemNFT.mint(alice, EstforConstants.GATHERING_BOOST, 1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    const foodCooked =
      (successPercent / 100) *
      ((queuedAction.timespan * rate) / (3600 * RATE_MUL) +
        (boostDuration * boostValue * rate) / (100 * RATE_MUL * 3600));
    expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(foodCooked);

    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.COOKING)).to.eq(queuedAction.timespan);
    // Check the drops are as expected
    expect(await itemNFT.balanceOf(alice, EstforConstants.COOKED_MINNUS)).to.eq(foodCooked);
  });

  it("Gathering boost, random rewards obtain same day", async function () {
    const {playerId, players, itemNFT, world, alice, mockVRF} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.GATHERING_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.GATHERING,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const randomChance = 65535;
    const xpPerHour = 50;
    const amount = 100;
    let tx = await world.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.THIEVING,
          xpPerHour,
          minXP: 0,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount}],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    const actionId = await getActionId(tx, world);

    const numHours = 2;

    // Make sure it passes the next checkpoint so there are no issues running
    const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
    const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
    const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
    await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);

    const timespan = 3600 * numHours;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.mint(alice, EstforConstants.GATHERING_BOOST, 1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);
    await players.connect(alice).processActions(playerId);

    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
      Math.floor(numHours * amount + (boostDuration * boostValue * amount) / (100 * 3600))
    );
  });

  it("Gathering boost, check boosted time over multiple queued actions is correct", async function () {
    const {playerId, players, itemNFT, world, alice, mockVRF} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 12600; // 3 hour 30 mins
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.GATHERING_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.GATHERING,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const randomChance = 65535;
    const xpPerHour = 50;
    const amount = 100;
    let tx = await world.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.THIEVING,
          xpPerHour,
          minXP: 0,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount}],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    const actionId = await getActionId(tx, world);

    // Make sure it passes the next checkpoint so there are no issues running
    const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
    const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
    const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
    await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);

    const timespan = 3600 * 2;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.mint(alice, EstforConstants.GATHERING_BOOST, 2);
    expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(2);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction, queuedAction, queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(1);

    await ethers.provider.send("evm_increaseTime", [3600 + 60]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    let pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(1);
    expect(pendingRandomRewards[0].xpElapsedTime).to.eq(3600);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour);
    await ethers.provider.send("evm_increaseTime", [3600 + 60]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId); // Still in same action
    pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(2);
    expect(pendingRandomRewards[1].xpElapsedTime).to.eq(3600);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * 2);
    await ethers.provider.send("evm_increaseTime", [100]); // Next action
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * 2); // Thieving is untouched
    pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(2); // Not added as there was no xp time Action still going so no pending random rewards
    await ethers.provider.send("evm_increaseTime", [7200]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.THIEVING)).to.eq(xpPerHour * 4);
    pendingRandomRewards = await players.getPendingRandomRewards(playerId);
    expect(pendingRandomRewards.length).to.eq(3); // Action still going so no pending random rewards
    expect(pendingRandomRewards[2].xpElapsedTime).to.eq(7200);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);

    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(0);
  });

  it("Gathering boost, random rewards, obtain next day", async function () {
    const {playerId, players, itemNFT, world, alice, mockVRF} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.GATHERING_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.GATHERING,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const randomChance = 65535;
    const xpPerHour = 50;
    const amount = 100;
    let tx = await world.addActions([
      {
        actionId: 1,
        info: {
          ...defaultActionInfo,
          skill: EstforTypes.Skill.THIEVING,
          xpPerHour,
          minXP: 0,
          numSpawned: 0,
          handItemTokenIdRangeMin: EstforConstants.NONE,
          handItemTokenIdRangeMax: EstforConstants.NONE,
          isAvailable: true,
          actionChoiceRequired: false,
          successPercent: 100
        },
        guaranteedRewards: [],
        randomRewards: [{itemTokenId: EstforConstants.BRONZE_ARROW, chance: randomChance, amount}],
        combatStats: EstforTypes.emptyCombatStats
      }
    ]);

    const actionId = await getActionId(tx, world);

    const numHours = 2;

    // Make sure it passes the next checkpoint so there are no issues running
    const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
    const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
    const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
    await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);
    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);

    const timespan = 3600 * numHours;
    const queuedAction: EstforTypes.QueuedActionInput = {
      attire: noAttire,
      actionId,
      combatStyle: EstforTypes.CombatStyle.NONE,
      choiceId: EstforConstants.NONE,
      regenerateId: EstforConstants.NONE,
      timespan,
      rightHandEquipmentTokenId: EstforConstants.NONE,
      leftHandEquipmentTokenId: EstforConstants.NONE,
      petId: EstforConstants.NONE
    };

    await itemNFT.mint(alice, EstforConstants.GATHERING_BOOST, 1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(1);
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );
    expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);
    await players.connect(alice).processActions(playerId);

    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0);

    await ethers.provider.send("evm_increaseTime", [24 * 3600]);
    await ethers.provider.send("evm_mine", []);
    await requestAndFulfillRandomWords(world, mockVRF);
    await players.connect(alice).processActions(playerId);
    expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
      Math.floor(numHours * amount + (boostDuration * boostValue * amount) / (100 * 3600))
    );
  });

  it("Gathering boost, output > 65535", async function () {
    const {playerId, players, itemNFT, world, alice} = await loadFixture(playersFixture);

    const boostValue = 10;
    const boostDuration = 3600;
    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.GATHERING_BOOST,
        equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
        // Boost
        boostType: EstforTypes.BoostType.GATHERING,
        boostValue,
        boostDuration,
        isTransferable: false
      }
    ]);

    const outputAmount = 255;
    const rate = 300 * RATE_MUL;
    const {queuedAction} = await setupBasicAlchemy(itemNFT, world, rate, outputAmount);

    const startingAmount = 1000000;
    await itemNFT.mintBatch(
      alice,
      [
        EstforConstants.SHADOW_SCROLL,
        EstforConstants.NATURE_SCROLL,
        EstforConstants.PAPER,
        EstforConstants.GATHERING_BOOST
      ],
      [startingAmount, startingAmount, startingAmount, 1]
    );

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await players
      .connect(alice)
      .startActionsExtra(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStatus.NONE
      );

    await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
    await ethers.provider.send("evm_mine", []);
    await players.connect(alice).processActions(playerId);
    expect(await players.getPlayerXP(playerId, EstforTypes.Skill.ALCHEMY)).to.eq(queuedAction.timespan);

    const outputBalance = await itemNFT.balanceOf(alice, EstforConstants.ANCIENT_SCROLL);
    expect(await itemNFT.balanceOf(alice, EstforConstants.ANCIENT_SCROLL)).to.eq(
      Math.floor(
        (queuedAction.timespan * rate * outputAmount) / (3600 * RATE_MUL) +
          (boostDuration * boostValue * rate * outputAmount) / (100 * RATE_MUL * 3600)
      )
    );
    expect(outputBalance).to.be.greaterThan(65535);
  });
});
