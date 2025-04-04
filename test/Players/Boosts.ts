import {getStorageAt, loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {NO_DONATION_AMOUNT, getActionId, requestAndFulfillRandomWords, timeTravel, timeTravel24Hours} from "../utils";
import {playersFixture} from "./PlayersFixture";
import {
  setupBasicMeleeCombat,
  setupBasicWoodcutting,
  setupBasicCooking,
  setupBasicAlchemy,
  BOOST_START_NOW,
  setupBasicFishing,
  setupBasicMining,
  getPlayersHelper,
  setupBasicFarming
} from "./utils";
import {defaultActionInfo, noAttire} from "@paintswap/estfor-definitions/types";
import {createPlayer} from "../../scripts/utils";
import {Block, keccak256, parseEther, zeroPadValue} from "ethers";
import {GUAR_MUL, RATE_MUL} from "@paintswap/estfor-definitions/constants";

const abiCoder = new ethers.AbiCoder();

describe("Boosts", function () {
  it("Add Boost, Full consume", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, worldActions);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
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
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, worldActions);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
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
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.XP_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
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
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
      const queuedActionFinishAfterBoost = {...queuedAction};
      queuedActionFinishAfterBoost.timespan = 86400 - queuedAction.timespan;

      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.XP_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      await players
        .connect(alice)
        .startActions(playerId, [queuedActionFinishAfterBoost], EstforTypes.ActionQueueStrategy.OVERWRITE);
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
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.XP_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      await ethers.provider.send("evm_increaseTime", [120]);
      await ethers.provider.send("evm_mine", []);
      const slot = 17;
      const encoding = abiCoder.encode(["uint256", "uint256"], [playerId, slot]);
      const hash = keccak256(encoding);
      let boostInfoStorage = await getStorageAt(await players.getAddress(), hash);
      expect(boostInfoStorage).to.not.eq(zeroPadValue("0x00", 32));

      await players.connect(alice).processActions(playerId);
      boostInfoStorage = await getStorageAt(await players.getAddress(), hash);
      expect(boostInfoStorage).to.eq(zeroPadValue("0x00", 32));
    });
  });

  it("Combat XP Boost", async function () {
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

    await itemNFT.mint(alice, EstforConstants.COMBAT_BOOST, 1);
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.COMBAT_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
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
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
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
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

    const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, worldActions);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
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
    const {playerId, players, itemNFT, worldActions, wishingWell, brush, alice} = await loadFixture(playersFixture);

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

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        0,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
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
    const {playerId, players, itemNFT, worldActions, wishingWell, brush, alice} = await loadFixture(playersFixture);

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

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        0,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
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
    const {playerId, players, itemNFT, worldActions, wishingWell, clans, brush, alice, playerNFT, avatarId, bob} =
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

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        0,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
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
    const {playerId, players, itemNFT, worldActions, wishingWell, clans, brush, alice} = await loadFixture(
      playersFixture
    );

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

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);
    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
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

  it("Extra XP (Wishing well) boost override, long farming actions", async function () {
    const {playerId, players, itemNFT, worldActions, wishingWell, randomnessBeacon, mockVRF, brush, alice} =
      await loadFixture(playersFixture);

    const boostValue = 50;
    const boostDuration = 3600 * 12; // 12 hours to check overlaps
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

    // 8 hour queues
    const {queuedAction} = await setupBasicFarming(itemNFT, worldActions);
    queuedAction.timespan = 3600 * 24; // 24 hours

    const startingAmount = 10000;
    await itemNFT.mintBatch(
      alice,
      [EstforConstants.PLOT_001_SMALL, EstforConstants.SEED_001_WILD],
      [startingAmount, startingAmount]
    );

    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

    // Start at 3am UTC
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await timeTravel(86400 - (NOW % 86400) + 1);

    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    await timeTravel(3600 * 15); // 15 hours into the day, leaves 9 hours left

    await brush.mint(alice, parseEther("10000"));
    await brush.connect(alice).approve(wishingWell, parseEther("10000"));
    const raffleCost = await wishingWell.getRaffleEntryCost();

    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.NONE,
        0,
        0,
        raffleCost,
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );

    const {timestamp: donationTimestamp} = (await ethers.provider.getBlock("latest")) as Block;

    await wishingWell.setNextLotteryWinnerRewardItemTokenId(EstforConstants.NONE);

    await timeTravel(3600 * 10); // 01:00am UTC
    await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
    let extraBoostedTime = NOW1 - donationTimestamp;
    // Enter raffle again
    await expect(players.connect(alice).donate(playerId, raffleCost))
      .to.emit(players, "UpdateLastExtraBoost")
      .withArgs(playerId, [
        donationTimestamp,
        extraBoostedTime + 1,
        boostValue,
        EstforConstants.LUCK_OF_THE_DRAW,
        EstforTypes.BoostType.ANY_XP
      ]);
    let playerBoost = await players.getActiveBoost(playerId);

    expect(playerBoost.lastExtraStartTime).to.eq(donationTimestamp);
    expect(playerBoost.lastExtraDuration).to.eq(extraBoostedTime + 1);
    expect(playerBoost.lastExtraValue).to.eq(boostValue);
    expect(playerBoost.lastExtraItemTokenId).to.eq(EstforConstants.LUCK_OF_THE_DRAW);
    expect(playerBoost.lastExtraBoostType).to.eq(EstforTypes.BoostType.ANY_XP);

    await timeTravel(3600 * 14); // 14 hours, so all farming actions done. But 2 hours won't have a boost

    // 24 hours base XP
    const baseXP = queuedAction.timespan; // 24 hours * 3600 = 86400

    // First boost active for 10 hours
    const firstBoostTime = 10 * 3600;
    const firstBoostXP = (firstBoostTime * boostValue) / 100;

    // Second boost active for 12 hours
    const secondBoostTime = 12 * 3600;
    const secondBoostXP = (secondBoostTime * boostValue) / 100;

    const farmingXP = baseXP + firstBoostXP + secondBoostXP;

    const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(farmingXP),
      BigInt(farmingXP + 1),
      BigInt(farmingXP + 2)
    ]);

    await timeTravel24Hours();

    // Clear it both should be cleared
    await players.connect(alice).processActions(playerId);

    playerBoost = await players.getActiveBoost(playerId);
    expect(playerBoost.extraStartTime).to.eq(0);
    expect(playerBoost.extraDuration).to.eq(0);
    expect(playerBoost.extraValue).to.eq(0);
    expect(playerBoost.extraItemTokenId).to.eq(0);
    expect(playerBoost.extraBoostType).to.eq(0);
    expect(playerBoost.lastExtraStartTime).to.eq(0);
    expect(playerBoost.lastExtraDuration).to.eq(0);
    expect(playerBoost.lastExtraValue).to.eq(0);
    expect(playerBoost.lastExtraItemTokenId).to.eq(0);
    expect(playerBoost.lastExtraBoostType).to.eq(0);
  });

  // If a clan boost is active, and another one comes it should still count for actions queued up to this time.
  // TODO: Use secondBoostValue like the global boost test does
  it("Clan boost override", async function () {
    const {playerId, players, itemNFT, worldActions, wishingWell, clans, brush, alice, playerNFT, avatarId, bob} =
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

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

    await brush.mint(alice, parseEther("100000"));
    await brush.connect(alice).approve(wishingWell, parseEther("100000"));

    const clanId = 1;
    const raffleCost = await wishingWell.getRaffleEntryCost();
    await wishingWell.setClanDonationThresholdIncrement(raffleCost);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await expect(
      players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.NONE,
          0,
          0,
          raffleCost,
          EstforTypes.ActionQueueStrategy.OVERWRITE
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

    const clanBoost = await (await getPlayersHelper(players)).getClanBoost(clanId);
    expect(clanBoost.startTime).to.eq(NOW1);
    expect(clanBoost.duration).to.eq(boostDuration);
    expect(clanBoost.value).to.eq(boostValue);
    expect(clanBoost.itemTokenId).to.eq(EstforConstants.CLAN_BOOSTER_2);
    expect(clanBoost.boostType).to.eq(EstforTypes.BoostType.COMBAT_XP);

    expect(clanBoost.lastStartTime).to.eq(NOW + 1);
    expect(clanBoost.lastDuration).to.eq(boostDuration / 2 + extraBoostedTime);
    expect(clanBoost.lastValue).to.eq(boostValue);
    expect(clanBoost.lastItemTokenId).to.eq(EstforConstants.CLAN_BOOSTER);
    expect(clanBoost.lastBoostType).to.eq(EstforTypes.BoostType.ANY_XP);

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

  it("Global boost override with overlapping boosts", async function () {
    const {playerId, players, itemNFT, worldActions, wishingWell, brush, alice} = await loadFixture(playersFixture);

    // Use different durations
    const firstBoostDuration = 720;
    const secondBoostDuration = 360;
    const anyXPValue = 50;
    const combatXPValue = 30;

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: anyXPValue,
        boostDuration: firstBoostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.PRAY_TO_THE_BEARDIE_2,
        equipPosition: EstforTypes.EquipPosition.GLOBAL_BOOST_VIAL,
        boostType: EstforTypes.BoostType.COMBAT_XP,
        boostValue: combatXPValue,
        boostDuration: secondBoostDuration,
        isTransferable: false
      },
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.LUCK_OF_THE_DRAW,
        equipPosition: EstforTypes.EquipPosition.EXTRA_BOOST_VIAL,
        boostType: EstforTypes.BoostType.ANY_XP,
        boostValue: 0,
        boostDuration: 720,
        isTransferable: false
      }
    ]);

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);
    await brush.mint(alice, parseEther("10000"));
    await brush.connect(alice).approve(wishingWell, parseEther("10000"));

    const nextGlobalThreshold = await wishingWell.getNextGlobalThreshold();
    expect(nextGlobalThreshold).to.be.gt(0);

    // Start with ANY_XP boost
    await expect(
      players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.NONE,
          0,
          0,
          nextGlobalThreshold,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        )
    )
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(nextGlobalThreshold, EstforConstants.PRAY_TO_THE_BEARDIE_2)
      .and.to.emit(players, "ConsumeGlobalBoostVial");
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

    // Move time to middle of first boost
    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + firstBoostDuration / 2 + 1]);
    await ethers.provider.send("evm_mine", []);

    // Calculations
    const baseXP = firstBoostDuration / 2 + secondBoostDuration;
    const anyXPBoost = Math.floor((360 * anyXPValue) / 100);
    const combatXPBoost = Math.floor((360 * combatXPValue) / 100);

    // Check initial period with just ANY_XP boost
    let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    let meleeXP = baseXP + anyXPBoost + combatXPBoost;
    let healthXP = Math.floor(meleeXP / 3);

    // Add COMBAT_XP boost halfway through ANY_XP boost
    await expect(players.connect(alice).donate(0, nextGlobalThreshold))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(nextGlobalThreshold * 2n, EstforConstants.PRAY_TO_THE_BEARDIE_3)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    // Move time to where both boosts will be active
    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + firstBoostDuration / 2 + secondBoostDuration]);
    await ethers.provider.send("evm_mine", []);

    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
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

  it("Global boost override, current is non-combat and last is combat, only uses last", async function () {
    const {playerId, players, itemNFT, worldActions, wishingWell, brush, alice} = await loadFixture(playersFixture);

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

    const {queuedAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

    // Currently only minted through donation thresholds
    await brush.mint(alice, parseEther("10000"));
    await brush.connect(alice).approve(wishingWell, parseEther("10000"));

    const nextGlobalThreshold = await wishingWell.getNextGlobalThreshold();
    expect(nextGlobalThreshold).to.be.gt(0);

    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    await expect(
      players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.NONE,
          0,
          0,
          nextGlobalThreshold,
          EstforTypes.ActionQueueStrategy.OVERWRITE
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

    const globalBoost = await (await getPlayersHelper(players)).getGlobalBoost();
    expect(globalBoost.startTime).to.eq(NOW1);
    expect(globalBoost.duration).to.eq(boostDuration);
    expect(globalBoost.value).to.eq(nonCombatBoostValue);
    expect(globalBoost.itemTokenId).to.eq(EstforConstants.PRAY_TO_THE_BEARDIE_2);
    expect(globalBoost.boostType).to.eq(EstforTypes.BoostType.NON_COMBAT_XP);

    expect(globalBoost.lastStartTime).to.eq(NOW + 1);
    expect(globalBoost.lastDuration).to.eq(boostDuration / 2 + extraBoostedTime);
    expect(globalBoost.lastValue).to.eq(boostValue);
    expect(globalBoost.lastItemTokenId).to.eq(EstforConstants.PRAY_TO_THE_BEARDIE);
    expect(globalBoost.lastBoostType).to.eq(EstforTypes.BoostType.ANY_XP);

    // Current NON_COMBAT_XP boost has no effect, but we still use the LAST boost (saved from first ANY_XP boost)
    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
    meleeXP = Math.floor(boostDuration + boostDuration + ((boostDuration / 2 + extraBoostedTime) * boostValue) / 100); // No extra
    healthXP = Math.floor(meleeXP / 3);
    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP),
      BigInt(meleeXP + healthXP - 1)
    ]);

    // The next global boost should have an effect but previous one doesn't.
    await expect(players.connect(alice).donate(0, nextGlobalThreshold))
      .to.emit(wishingWell, "LastGlobalDonationThreshold")
      .withArgs(nextGlobalThreshold * 3n, EstforConstants.PRAY_TO_THE_BEARDIE)
      .and.to.emit(players, "ConsumeGlobalBoostVial");

    await ethers.provider.send("evm_setNextBlockTimestamp", [NOW + boostDuration + boostDuration + boostDuration + 1]);
    await ethers.provider.send("evm_mine", []);

    pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);

    // Base XP is 3 full periods
    const baseXP = boostDuration * 3; // 720 * 3 = 2160

    // Combat boost (10%) for the last period
    // Note that it gets 719 seconds instead of 720 due to timing
    const actualBoostSeconds = 719; // From the timing logs
    const combatBoostXP = Math.floor((actualBoostSeconds * nextBoostValue) / 100); // 71

    meleeXP = baseXP + combatBoostXP; // 2160 + 71 = 2231
    healthXP = Math.floor(meleeXP / 3); // 743

    expect(pendingQueuedActionState.equipmentStates.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas.length).to.eq(1);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.be.oneOf([
      BigInt(meleeXP + healthXP), // 2974
      BigInt(meleeXP + healthXP - 1) // 2973
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
    const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

    const {queuedAction: queuedActionWoodcutting, rate} = await setupBasicWoodcutting(itemNFT, worldActions);
    const queuedAction = {...queuedActionWoodcutting, timespan: 3600 * 8};

    await itemNFT.mintBatch(alice, [EstforConstants.XP_BOOST, EstforConstants.GATHERING_BOOST], [2, 2]);
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );
    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine", []);

    // Change to gathering boost
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.GATHERING_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.APPEND
      );
    await ethers.provider.send("evm_increaseTime", [3600 * 6]);
    await ethers.provider.send("evm_mine", []);
    // Back to XP boost
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.APPEND
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

  it("Clear everything, check boost is minted if it's not been used yet", async function () {
    const {playerId, players, alice, itemNFT, worldActions, playerNFT, avatarId} = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

    const boostValue = 10;
    const boostDuration = 3600;
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

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);

    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction, queuedAction],
        EstforConstants.XP_BOOST,
        0,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(0);

    // Make a new player active so the old one is cleared
    const makeActive = true;

    await expect(playerNFT.connect(alice).mint(avatarId, "noname", "", "", "", false, makeActive))
      .to.emit(players, "BoostFinished")
      .and.to.not.emit(players, "UpdateLastBoost");

    // Gets the boost back
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);
  });

  it("Clear everything, check boost is minted and check last boost is correctly cleared too", async function () {
    const {playerId, players, alice, itemNFT, worldActions, playerNFT, avatarId} = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

    const boostValue = 10;
    const boostDuration = 3600;
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

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 2);

    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        0,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);
    await timeTravel(1800);

    await expect(
      players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.XP_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        )
    ).to.emit(players, "UpdateLastBoost");
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(0);

    await timeTravel(1800);

    let playerBoost = await players.getActiveBoost(playerId);
    expect(playerBoost.startTime).to.eq(NOW + 1800 + 1);
    expect(playerBoost.duration).to.eq(boostDuration);
    expect(playerBoost.lastStartTime).to.eq(NOW);
    expect(playerBoost.lastDuration).to.eq(boostDuration / 2 + 1);

    // Make a new player active so the old one is cleared
    const makeActive = true;
    await expect(playerNFT.connect(alice).mint(avatarId, "noname", "", "", "", false, makeActive))
      .and.to.emit(players, "BoostFinished")
      .and.to.not.emit(players, "ExtraBoostFinished");

    // Boost is used so nothing back
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(0);
    playerBoost = await players.getActiveBoost(playerId);
    expect(playerBoost.duration).to.eq(0);
    expect(playerBoost.lastStartTime).to.eq(0);
    expect(playerBoost.lastDuration).to.eq(0);
  });

  it("Queueing a boost in future and queuing others should update last boost correctly", async function () {
    const {playerId, players, alice, itemNFT, worldActions} = await loadFixture(playersFixture);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

    const boostValue = 10;
    const boostDuration = 3600;
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

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 2);
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(2);

    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.OVERWRITE
      );
    const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);
    await timeTravel(1800);

    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        BOOST_START_NOW,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
      );
    const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(0);

    let playerBoost = await players.getActiveBoost(playerId);
    expect(playerBoost.duration).to.eq(boostDuration);
    expect(playerBoost.lastDuration).to.eq(boostDuration / 2 + 1);

    await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
    await players.connect(alice).startActionsAdvanced(
      playerId,
      [queuedAction],
      EstforConstants.XP_BOOST,
      0, // start boost at the end
      0,
      NO_DONATION_AMOUNT,
      EstforTypes.ActionQueueStrategy.APPEND
    );
    expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(0);

    playerBoost = await players.getActiveBoost(playerId);
    expect(playerBoost.startTime).to.eq(NOW + queuedAction.timespan * 2);
    expect(playerBoost.duration).to.eq(boostDuration);
    expect(playerBoost.lastStartTime).to.eq(NOW1);
    expect(playerBoost.lastDuration).to.eq(boostDuration);

    // Queue another one should update the last boost again and re-use unused boost from before without error
    await players
      .connect(alice)
      .startActionsAdvanced(
        playerId,
        [queuedAction],
        EstforConstants.XP_BOOST,
        0,
        0,
        NO_DONATION_AMOUNT,
        EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
      );
    playerBoost = await players.getActiveBoost(playerId);
    expect(playerBoost.startTime).to.eq(NOW + queuedAction.timespan);
    expect(playerBoost.duration).to.eq(boostDuration);
    expect(playerBoost.lastStartTime).to.eq(NOW1);
    expect(playerBoost.lastDuration).to.eq(boostDuration / 2 - 1);
  });

  describe("Gathering boost", async function () {
    it("Simple", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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

      const {queuedAction, rate} = await setupBasicWoodcutting(itemNFT, worldActions);
      await itemNFT.mint(alice, EstforConstants.GATHERING_BOOST, 1);
      expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(1);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.GATHERING_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
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

    it("Cooking with successPercent", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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
      const {queuedAction, rate} = await setupBasicCooking(itemNFT, worldActions, successPercent, minLevel);
      await itemNFT.mint(alice, EstforConstants.GATHERING_BOOST, 1);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.GATHERING_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
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

    it("Random rewards obtain same day", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

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
      let tx = await worldActions.addActions([
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

      const actionId = await getActionId(tx, worldActions);

      const numHours = 2;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.GATHERING_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor(numHours * amount + (boostDuration * boostValue * amount) / (100 * 3600))
      );
    });

    it("Check boosted time over multiple queued actions is correct", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

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
      let tx = await worldActions.addActions([
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

      const actionId = await getActionId(tx, worldActions);

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction, queuedAction, queuedAction],
          EstforConstants.GATHERING_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
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
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.GATHERING_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(0);
    });

    it("Check boosted production with significant boost overrides", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      // First boost: 100% boost for clarity
      const boostValue = 100;
      const boostDuration = 3600 * 3; // 3 hours to check longer overlap
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.GATHERING_BOOST,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          boostType: EstforTypes.BoostType.GATHERING,
          boostValue,
          boostDuration,
          isTransferable: false
        }
      ]);

      // Second boost: 25% for better verification
      const boostValue1 = 25;
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          tokenId: EstforConstants.BOOK_001_BRONZE,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          boostType: EstforTypes.BoostType.GATHERING,
          boostValue: boostValue1,
          boostDuration,
          isTransferable: false
        }
      ]);

      // Setup farming with higher base production
      const {queuedAction, rate} = await setupBasicFarming(
        itemNFT,
        worldActions,
        undefined, // use default rate
        100 // 100 seeds in 8 hours for clearer math
      );

      await itemNFT.mintBatch(alice, [EstforConstants.GATHERING_BOOST, EstforConstants.BOOK_001_BRONZE], [1, 1]);

      const startingAmount = 10000;
      await itemNFT.mintBatch(
        alice,
        [EstforConstants.PLOT_001_SMALL, EstforConstants.SEED_001_WILD],
        [startingAmount, startingAmount]
      );

      // Start first boost
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.GATHERING_BOOST,
          BOOST_START_NOW,
          EstforConstants.NONE,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;

      // Go forward 2 hours with 100% boost
      await ethers.provider.send("evm_increaseTime", [3600 * 2]);
      await ethers.provider.send("evm_mine", []);

      // Override with 25% boost
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [],
          EstforConstants.BOOK_001_BRONZE,
          BOOST_START_NOW,
          EstforConstants.NONE,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );
      const {timestamp: NOW1} = (await ethers.provider.getBlock("latest")) as Block;

      let playerBoost = await players.getActiveBoost(playerId);
      expect(playerBoost.startTime).to.eq(NOW1);
      expect(playerBoost.duration).to.eq(boostDuration);
      expect(playerBoost.value).to.eq(boostValue1);
      expect(playerBoost.itemTokenId).to.eq(EstforConstants.BOOK_001_BRONZE);
      expect(playerBoost.boostType).to.eq(EstforTypes.BoostType.GATHERING);

      expect(playerBoost.lastStartTime).to.eq(NOW);
      expect(playerBoost.lastDuration).to.not.eq(boostDuration);
      expect(playerBoost.lastDuration).to.not.eq(3600);
      expect(playerBoost.lastValue).to.eq(boostValue);
      expect(playerBoost.lastItemTokenId).to.eq(EstforConstants.GATHERING_BOOST);
      expect(playerBoost.lastBoostType).to.eq(EstforTypes.BoostType.GATHERING);

      // Go forward remaining 6 hours
      await ethers.provider.send("evm_increaseTime", [3600 * 6]);
      await ethers.provider.send("evm_mine", []);

      // Calculate expected production
      const baseSecondsTotal = queuedAction.timespan;
      const seedsPerSecond = 100 / baseSecondsTotal; // 100 seeds over 8 hours base

      // First boost active for 2 hours at 100%
      const firstBoostTime = 3600 * 2;
      const firstBoostOutput = seedsPerSecond * firstBoostTime * (boostValue / 100);

      // Second boost active for next 3 hours at 25% (limited by boostDuration)
      const secondBoostTime = 3600 * 3;
      const secondBoostOutput = seedsPerSecond * secondBoostTime * (boostValue1 / 100);

      // Should produce:
      // - Base: 100 seeds
      // - First 2 hours (100% boost): 25 extra seeds
      // - Next 3 hours (25% boost): ~9.375 extra seeds
      // Total: ~134.375 seeds
      const seedsProduced = 100 + firstBoostOutput + secondBoostOutput;

      const pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.equipmentStates[0].producedAmounts[0]).to.eq(Math.floor(seedsProduced));
      expect(Math.floor(seedsProduced)).to.eq(134);

      await timeTravel24Hours();

      // Both should be cleared
      await players.connect(alice).processActions(playerId);

      playerBoost = await players.getActiveBoost(playerId);
      expect(playerBoost.startTime).to.eq(0);
      expect(playerBoost.duration).to.eq(0);
      expect(playerBoost.value).to.eq(0);
      expect(playerBoost.itemTokenId).to.eq(0);
      expect(playerBoost.boostType).to.eq(0);
      expect(playerBoost.lastStartTime).to.eq(0);
      expect(playerBoost.lastDuration).to.eq(0);
      expect(playerBoost.lastValue).to.eq(0);
      expect(playerBoost.lastItemTokenId).to.eq(0);
      expect(playerBoost.lastBoostType).to.eq(0);
    });

    // TODO a test for boosts starting the future, check the other one sufficiently covers it (set the duration to be up to when the next boost starts)

    it("Random rewards, obtain next day", async function () {
      const {playerId, players, itemNFT, worldActions, randomnessBeacon, alice, mockVRF} = await loadFixture(
        playersFixture
      );

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
      let tx = await worldActions.addActions([
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

      const actionId = await getActionId(tx, worldActions);

      const numHours = 2;

      // Make sure it passes the next checkpoint so there are no issues running
      const {timestamp} = (await ethers.provider.getBlock("latest")) as Block;
      const nextCheckpoint = Math.floor(timestamp / 86400) * 86400 + 86400;
      const durationToNextCheckpoint = nextCheckpoint - timestamp + 1;
      await ethers.provider.send("evm_increaseTime", [durationToNextCheckpoint]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);

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
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.GATHERING_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      expect(await itemNFT.balanceOf(alice, EstforConstants.GATHERING_BOOST)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);

      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(0);

      await ethers.provider.send("evm_increaseTime", [24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await requestAndFulfillRandomWords(randomnessBeacon, mockVRF);
      await players.connect(alice).processActions(playerId);
      expect(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_ARROW)).to.eq(
        Math.floor(numHours * amount + (boostDuration * boostValue * amount) / (100 * 3600))
      );
    });

    it("Output > 65535", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

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
      const {queuedAction} = await setupBasicAlchemy(itemNFT, worldActions, rate, outputAmount);

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

      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.GATHERING_BOOST,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
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

  describe("Combat stats boost", async function () {
    it("Should only give boost to the whole actions only", async function () {
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const boostValue = 0;
      const boostDuration = 3600;
      await itemNFT.addItems([
        {
          ...EstforTypes.defaultItemInput,
          combatStats: {
            meleeAttack: 1000,
            meleeDefence: 1000,
            magicAttack: 1000,
            magicDefence: 1000,
            rangedAttack: 1000,
            rangedDefence: 1000,
            health: 1000
          },
          tokenId: EstforConstants.POTION_005_SMALL_MELEE,
          equipPosition: EstforTypes.EquipPosition.BOOST_VIAL,
          // Boost
          boostType: EstforTypes.BoostType.COMBAT_FIXED,
          boostValue,
          boostDuration,
          isTransferable: false
        }
      ]);

      await itemNFT.mint(alice, EstforConstants.POTION_005_SMALL_MELEE, 2);

      const monsterCombatStats: EstforTypes.CombatStats = {
        meleeAttack: 80,
        magicAttack: 80,
        rangedAttack: 80,
        meleeDefence: 80,
        magicDefence: 80,
        rangedDefence: 80,
        health: 1200
      };

      const {queuedAction, combatAction} = await setupBasicMeleeCombat(itemNFT, worldActions);

      // Update monster
      await worldActions.editActions([{...combatAction, combatStats: monsterCombatStats}]);

      // Start an action
      await players.connect(alice).startActions(playerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);

      // Add the boost after it started
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.POTION_005_SMALL_MELEE,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.KEEP_LAST_IN_PROGRESS
        );

      // Combat boost should have no affect, check that you died
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      let pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.true;

      // Now start the action again fully encapulating it and check you don't die
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction],
          EstforConstants.POTION_005_SMALL_MELEE,
          BOOST_START_NOW,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );

      // Combat boost should have no affect, check that you died
      await ethers.provider.send("evm_increaseTime", [queuedAction.timespan]);
      await ethers.provider.send("evm_mine", []);
      pendingQueuedActionState = await players.getPendingQueuedActionState(alice, playerId);
      expect(pendingQueuedActionState.actionMetadatas[0].died).to.be.false;
    });
  });

  describe("Boosts in the future", function () {
    it("Boost should be minted if it hasn't been used yet and another one is used", async function () {
      // Check that they are minted/consumed as expected
      const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

      const boostValue = 10;
      const boostDuration = 3600 * 24;
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

      const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);

      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);
      const boostStartReverseIndex = 0; // Starts at the second action
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction, queuedAction],
          EstforConstants.XP_BOOST,
          boostStartReverseIndex,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(0);
      await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
      await players
        .connect(alice)
        .startActionsAdvanced(
          playerId,
          [queuedAction, queuedAction],
          EstforConstants.XP_BOOST,
          boostStartReverseIndex,
          0,
          NO_DONATION_AMOUNT,
          EstforTypes.ActionQueueStrategy.OVERWRITE
        );
      expect(await itemNFT.balanceOf(alice, EstforConstants.XP_BOOST)).to.eq(1);
    });

    describe("3 action queues", function () {
      it("Start boost from last action only and check that it extends to future actions", async function () {
        const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

        const boostValue = 10;
        const boostDuration = 3600 * 24;
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

        const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
        queuedActionWoodcutting.timespan = 3600 * 8;
        const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
        queuedActionFishing.timespan = 3600 * 8;
        const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);
        queuedActionMining.timespan = 3600 * 8;

        await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
        const boostStartReverseIndex = 0;
        await players
          .connect(alice)
          .startActionsAdvanced(
            playerId,
            [queuedActionWoodcutting, queuedActionFishing, queuedActionMining],
            EstforConstants.XP_BOOST,
            boostStartReverseIndex,
            0,
            NO_DONATION_AMOUNT,
            EstforTypes.ActionQueueStrategy.OVERWRITE
          );
        // Complete all actions
        await ethers.provider.send("evm_increaseTime", [
          queuedActionWoodcutting.timespan + queuedActionFishing.timespan + queuedActionMining.timespan
        ]);
        await players.connect(alice).processActions(playerId);
        // First 2 actions should not have the boost applied
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
          queuedActionWoodcutting.timespan
        );
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FISHING)).to.eq(queuedActionFishing.timespan);
        // Last action should have the boost applied
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MINING)).to.eq(
          queuedActionMining.timespan + (queuedActionMining.timespan * boostValue) / 100
        );

        // Start more actions and the boost should be applied for the first 2 actions and not the last
        await players
          .connect(alice)
          .startActions(
            playerId,
            [queuedActionWoodcutting, queuedActionFishing, queuedActionMining],
            EstforTypes.ActionQueueStrategy.OVERWRITE
          );
        // Complete all actions
        await ethers.provider.send("evm_increaseTime", [
          queuedActionWoodcutting.timespan + queuedActionFishing.timespan + queuedActionMining.timespan
        ]);
        await players.connect(alice).processActions(playerId);

        // First 2 actions should now have the boost applied
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
          queuedActionWoodcutting.timespan +
            queuedActionWoodcutting.timespan +
            (queuedActionWoodcutting.timespan * boostValue) / 100
        );
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FISHING)).to.be.oneOf([
          BigInt(
            queuedActionFishing.timespan +
              queuedActionFishing.timespan +
              (queuedActionFishing.timespan * boostValue) / 100
          ),

          BigInt(
            queuedActionFishing.timespan +
              queuedActionFishing.timespan +
              (queuedActionFishing.timespan * boostValue) / 100 -
              1
          )
        ]);
        // Last action should not have another boost period applied
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MINING)).to.eq(
          queuedActionMining.timespan + (queuedActionMining.timespan * boostValue) / 100 + queuedActionMining.timespan
        );
      });

      it("Start boost from middle action only", async function () {
        const {playerId, players, itemNFT, worldActions, alice} = await loadFixture(playersFixture);

        const boostValue = 10;
        const boostDuration = 3300; // 1 hour
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

        const {queuedAction: queuedActionWoodcutting} = await setupBasicWoodcutting(itemNFT, worldActions);
        const {queuedAction: queuedActionFishing} = await setupBasicFishing(itemNFT, worldActions);
        const {queuedAction: queuedActionMining} = await setupBasicMining(itemNFT, worldActions);

        await itemNFT.mint(alice, EstforConstants.XP_BOOST, 1);
        const boostStartReverseIndex = 1;
        await players
          .connect(alice)
          .startActionsAdvanced(
            playerId,
            [queuedActionWoodcutting, queuedActionFishing, queuedActionMining],
            EstforConstants.XP_BOOST,
            boostStartReverseIndex,
            0,
            NO_DONATION_AMOUNT,
            EstforTypes.ActionQueueStrategy.OVERWRITE
          );
        // Complete all actions
        await ethers.provider.send("evm_increaseTime", [
          queuedActionWoodcutting.timespan + queuedActionFishing.timespan + queuedActionMining.timespan
        ]);
        await players.connect(alice).processActions(playerId);
        // First and last action should not have the boost applied
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
          queuedActionWoodcutting.timespan
        );
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.FISHING)).to.eq(
          queuedActionFishing.timespan + (boostDuration * boostValue) / 100
        );
        expect(await players.getPlayerXP(playerId, EstforTypes.Skill.MINING)).to.eq(queuedActionMining.timespan);
      });
    });
  });
});
