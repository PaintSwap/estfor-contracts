import {ethers, upgrades} from "hardhat";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ActivityPoints} from "../typechain-types";
import {ContractTransactionResponse} from "ethers";
import {ACTIVITY_TICKET, SONIC_GEM_TICKET} from "@paintswap/estfor-definitions/constants";

// ALERT: must match the enum in IActivityPoints.sol
enum ActivityType {
  NONE,
  // BLUE TICKETS
  instantactions_evt_doinstantactions,
  instantvrfactions_evt_doinstantvrfactions,
  passiveactions_evt_claimpassiveaction,
  quests_evt_questcompleted,
  shop_evt_buy, // + shop_evt_buybatch,
  shop_evt_sell, // + shop_evt_sellbatch,
  wishingwell_evt_donate,
  wishingwell_evt_donatetoclan,
  orderbook_evt_ordersmatched,
  orderbook_evt_claimedtokens,
  orderbook_evt_claimednfts,
  // players
  players_evt_actionfinished,
  players_evt_addxp,
  players_evt_levelup,
  players_evt_boostfinished,
  players_evt_dailyreward,
  players_evt_weeklyreward,
  players_evt_claimedxpthresholdrewards,
  // clans
  clans_evt_clancreated, // _isClanActivityType
  lockedbankvaults_evt_attackvaults, // _isClanActivityType
  territories_evt_attackterritory, // _isClanActivityType
  territories_evt_claimunoccupiedterritory, // _isClanActivityType
  // GREEN TICKETS
  players_dailyreward, // = 8
  wishingwell_luckofthedraw, // = 3
  wishingwell_luckypotion // = 50
}

export async function getTokenId(
  tx: Promise<ContractTransactionResponse> | ContractTransactionResponse
): Promise<bigint> {
  const _tx = tx instanceof Promise ? await tx : tx;
  const receipt = await _tx.wait();
  const _interface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
  ]);
  const data = receipt?.logs[0].data;
  const topics = receipt?.logs[0].topics;
  const event = _interface.decodeEventLog("Transfer", data || ethers.ZeroHash, topics);
  return event.tokenId as bigint;
}

describe("ActivityPoints", function () {
  async function deployActivityPointsFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const mockItemNFT = await ethers.deployContract("MockItemNFT");

    const ActivityPoints = await ethers.getContractFactory("ActivityPoints");
    const activityPoints = (await upgrades.deployProxy(
      ActivityPoints,
      [await mockItemNFT.getAddress(), ACTIVITY_TICKET, SONIC_GEM_TICKET],
      {
        kind: "uups"
      }
    )) as unknown as ActivityPoints;
    await activityPoints.waitForDeployment();

    const testERC721 = await ethers.deployContract("TestERC721");
    const otherERC721 = await ethers.deployContract("TestERC721");
    const unboostedERC721 = await ethers.deployContract("TestERC721");
    await activityPoints.updateBoostedNFT(testERC721, true);
    await activityPoints.updateBoostedNFT(otherERC721, true);

    return {activityPoints, mockItemNFT, testERC721, otherERC721, unboostedERC721, owner, alice, bob};
  }

  describe("Initialization", function () {
    it("Should set the right owner", async function () {
      const {activityPoints, owner} = await loadFixture(deployActivityPointsFixture);
      expect(await activityPoints.owner()).to.equal(owner.address);
    });
  });

  describe("Blue Point Calculation", function () {
    it("Should get activity points for instantactions_evt_doinstantactions", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const instantActionsAP = 200;
      await expect(
        activityPoints.rewardBlueTickets(ActivityType.instantactions_evt_doinstantactions, alice.address, true, 0)
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(
          ActivityType.instantactions_evt_doinstantactions,
          0,
          alice.address,
          ACTIVITY_TICKET,
          instantActionsAP
        );
    });

    it("Should get activity points for shop_evt_buy", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const brush0 = 1;
      const brushAP0 = 63;
      await expect(activityPoints.rewardBlueTickets(ActivityType.shop_evt_buy, alice.address, true, brush0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.shop_evt_buy, brush0, alice.address, ACTIVITY_TICKET, brushAP0);
      // .withArgs(alice.address, brush0, ActivityType.shop_evt_buy, ACTIVITY_TICKET, brushAP0);

      const brush = 100;
      const brushAP = 189;
      await expect(activityPoints.rewardBlueTickets(ActivityType.shop_evt_buy, alice.address, true, brush))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.shop_evt_buy, brush, alice.address, ACTIVITY_TICKET, brushAP);
      // .withArgs(alice.address, brush, ActivityType.shop_evt_buy, ACTIVITY_TICKET, brushAP);

      const brush2 = 4000;
      const brushAP2 = 315;
      await expect(activityPoints.rewardBlueTickets(ActivityType.shop_evt_buy, alice.address, true, brush2))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.shop_evt_buy, brush2, alice.address, ACTIVITY_TICKET, brushAP2);
      // .withArgs(alice.address, ActivityType.shop_evt_buy, brush2, ACTIVITY_TICKET, brushAP2);

      const brush3 = 40000;
      const brushAP3 = 378;
      await expect(activityPoints.rewardBlueTickets(ActivityType.shop_evt_buy, alice.address, true, brush3))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.shop_evt_buy, brush3, alice.address, ACTIVITY_TICKET, brushAP3);
      // .withArgs(alice.address, ActivityType.shop_evt_buy, brush3, ACTIVITY_TICKET, brushAP3);
    });

    it("Should get activity points for players_evt_addxp", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const xp = 1;
      const xpAP = 0;
      await expect(
        activityPoints.rewardBlueTickets(ActivityType.players_evt_addxp, alice.address, true, xp)
      ).to.not.emit(activityPoints, "ActivityPointsEarned");

      const xp2 = 3;
      const xpAP2 = 15;
      await expect(activityPoints.rewardBlueTickets(ActivityType.players_evt_addxp, alice.address, true, xp2))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_evt_addxp, xp2, alice.address, ACTIVITY_TICKET, xpAP2);
      // .withArgs(alice.address, ActivityType.players_evt_addxp, xp2, ACTIVITY_TICKET, xpAP2);

      const xp3 = 966;
      const xpAP3 = 135;
      await expect(activityPoints.rewardBlueTickets(ActivityType.players_evt_addxp, alice.address, true, xp3))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_evt_addxp, xp3, alice.address, ACTIVITY_TICKET, xpAP3);
      // .withArgs(alice.address, ActivityType.players_evt_addxp, xp3, ACTIVITY_TICKET, xpAP3);

      const xp4 = 10000;
      const xpAP4 = 180;
      await expect(activityPoints.rewardBlueTickets(ActivityType.players_evt_addxp, alice.address, true, xp4))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_evt_addxp, xp4, alice.address, ACTIVITY_TICKET, xpAP4);
      // .withArgs(alice.address, ActivityType.players_evt_addxp, xp4, ACTIVITY_TICKET, xpAP4);
    });

    it("Should get activity points for players_evt_levelup", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const level1 = 1;
      const levelAP1 = 0;
      await expect(
        activityPoints.rewardBlueTickets(ActivityType.players_evt_levelup, alice.address, true, level1)
      ).not.to.emit(activityPoints, "ActivityPointsEarned");

      const level3 = 4;
      const levelAP3 = 65;
      await expect(activityPoints.rewardBlueTickets(ActivityType.players_evt_levelup, alice.address, true, level3))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_evt_levelup, level3, alice.address, ACTIVITY_TICKET, levelAP3);
      // .withArgs(alice.address, ActivityType.players_evt_levelup, level3, ACTIVITY_TICKET, levelAP3);

      const level10 = 10;
      const levelAP10 = 130;
      await expect(activityPoints.rewardBlueTickets(ActivityType.players_evt_levelup, alice.address, true, level10))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_evt_levelup, level10, alice.address, ACTIVITY_TICKET, levelAP10);
      // .withArgs(alice.address, ActivityType.players_evt_levelup, level10, ACTIVITY_TICKET, levelAP10);

      const level25 = 25;
      const levelAP25 = 195;
      await expect(activityPoints.rewardBlueTickets(ActivityType.players_evt_levelup, alice.address, true, level25))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_evt_levelup, level25, alice.address, ACTIVITY_TICKET, levelAP25);
      // .withArgs(alice.address, ActivityType.players_evt_levelup, level25, ACTIVITY_TICKET, levelAP25);

      const level89 = 89;
      const levelAP89 = 325;
      await expect(activityPoints.rewardBlueTickets(ActivityType.players_evt_levelup, alice.address, true, level89))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_evt_levelup, level89, alice.address, ACTIVITY_TICKET, levelAP89);
      // .withArgs(alice.address, ActivityType.players_evt_levelup, level89, ACTIVITY_TICKET, levelAP89);

      const level130 = 130;
      const levelAP130 = 390;
      await expect(activityPoints.rewardBlueTickets(ActivityType.players_evt_levelup, alice.address, true, level130))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_evt_levelup, level130, alice.address, ACTIVITY_TICKET, levelAP130);
      // .withArgs(alice.address, ActivityType.players_evt_levelup, level130, ACTIVITY_TICKET, levelAP130);

      //add 140
      const level140 = 140;
      const levelAP140 = 390;
      await expect(activityPoints.rewardBlueTickets(ActivityType.players_evt_levelup, alice.address, true, level140))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_evt_levelup, level140, alice.address, ACTIVITY_TICKET, levelAP140);
      // .withArgs(alice.address, ActivityType.players_evt_levelup, level140, ACTIVITY_TICKET, levelAP140);
    });

    it("Should get activity points for players_evt_claimedxpthresholdrewards", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const xpThreshold = 1;
      const xpThresholdAP = 100;
      await expect(
        activityPoints.rewardBlueTickets(
          ActivityType.players_evt_claimedxpthresholdrewards,
          alice.address,
          true,
          xpThreshold
        )
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(
          ActivityType.players_evt_claimedxpthresholdrewards,
          xpThreshold,
          alice.address,
          ACTIVITY_TICKET,
          xpThresholdAP
        );

      // at the max so no more points
      const xpThreshold2 = 1;
      await expect(
        activityPoints.rewardBlueTickets(
          ActivityType.players_evt_claimedxpthresholdrewards,
          alice.address,
          true,
          xpThreshold2
        )
      ).not.to.emit(activityPoints, "ActivityPointsEarned");

      // advance one day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      // should get points again
      await expect(
        activityPoints.rewardBlueTickets(
          ActivityType.players_evt_claimedxpthresholdrewards,
          alice.address,
          true,
          xpThreshold2
        )
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(
          ActivityType.players_evt_claimedxpthresholdrewards,
          xpThreshold2,
          alice.address,
          ACTIVITY_TICKET,
          xpThresholdAP
        );
    });
  });

  describe("Blue Point NFT Boosts", function () {
    it("Should not boost points when no boost is active", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);
      const points = 100;

      await expect(
        activityPoints.rewardBlueTickets(ActivityType.instantactions_evt_doinstantactions, alice.address, true, 0)
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.instantactions_evt_doinstantactions, 0, alice.address, ACTIVITY_TICKET, points * 2);
    });

    it("Should boost points when NFT boost is active", async function () {
      const {activityPoints, alice, testERC721} = await loadFixture(deployActivityPointsFixture);

      const nftTokenId = await getTokenId(testERC721.mint(alice.address));
      // Register boost
      await activityPoints.connect(alice).registerPointBoost(await testERC721.getAddress(), nftTokenId);

      // Calculate points with boost
      const basePoints = 100;
      await expect(
        activityPoints.rewardBlueTickets(ActivityType.instantactions_evt_doinstantactions, alice.address, true, 0)
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.instantactions_evt_doinstantactions, 0, alice.address, ACTIVITY_TICKET, basePoints * 2);
    });

    it("Should not boost points before boost activates", async function () {
      const {activityPoints, alice, testERC721} = await loadFixture(deployActivityPointsFixture);

      const nftTokenId = await getTokenId(testERC721.mint(alice));
      // console.log("nftTokenId", nftTokenId);
      await activityPoints.connect(alice).registerPointBoost(testERC721, nftTokenId);

      const basePoints = 200;
      await expect(
        activityPoints.rewardBlueTickets(ActivityType.instantactions_evt_doinstantactions, alice.address, true, 0)
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.instantactions_evt_doinstantactions, 0, alice.address, ACTIVITY_TICKET, basePoints);

      // Advance time past 1 day
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      // Points should not be boosted since there were no boosted the first day...
      await expect(
        activityPoints.rewardBlueTickets(ActivityType.instantactions_evt_doinstantactions, alice.address, true, 0)
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.instantactions_evt_doinstantactions, 0, alice.address, ACTIVITY_TICKET, basePoints);

      // Advance time past 1 day
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      // Points should now be boosted since there were no boosted the first day...
      await expect(
        activityPoints.rewardBlueTickets(ActivityType.instantactions_evt_doinstantactions, alice.address, true, 0)
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(
          ActivityType.instantactions_evt_doinstantactions,
          0,
          alice.address,
          ACTIVITY_TICKET,
          (basePoints * 110) / 100
        );
    });

    it("Should not boost points if NFT is transferred", async function () {
      const {activityPoints, alice, bob, testERC721} = await loadFixture(deployActivityPointsFixture);

      const nftTokenId = await getTokenId(testERC721.mint(alice));

      await activityPoints.connect(alice).registerPointBoost(testERC721, nftTokenId);

      // Advance time past 1 day
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      // Transfer NFT to bob
      await testERC721.connect(alice).transferFrom(alice, bob, nftTokenId);

      // Points should not be boosted for alice
      const basePoints = 200;
      await expect(activityPoints.rewardBlueTickets(ActivityType.instantactions_evt_doinstantactions, alice, true, 0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.instantactions_evt_doinstantactions, 0, alice, ACTIVITY_TICKET, basePoints);
    });
  });

  describe("Green Point Calculation", function () {
    it("Should get activity points for wishingwell_luckofthedraw when evolved", async function () {
      const {alice, activityPoints, mockItemNFT} = await loadFixture(deployActivityPointsFixture);

      const expectedGreenTickets = 3;
      await expect(activityPoints.rewardGreenTickets(ActivityType.wishingwell_luckofthedraw, alice, true))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.wishingwell_luckofthedraw, 0, alice.address, SONIC_GEM_TICKET, expectedGreenTickets);

      const balance = await mockItemNFT.balanceOf(alice, SONIC_GEM_TICKET);
      expect(balance).to.equal(expectedGreenTickets);
    });

    it("Should get activity points for players_dailyreward when evolved", async function () {
      const {alice, activityPoints} = await loadFixture(deployActivityPointsFixture);

      const expectedGreenTickets = 8;
      await expect(activityPoints.rewardGreenTickets(ActivityType.players_dailyreward, alice, true))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.players_dailyreward, 0, alice.address, SONIC_GEM_TICKET, expectedGreenTickets);
    });

    it("Should get activity points for wishingwell_luckypotion when evolved", async function () {
      const {alice, activityPoints, mockItemNFT} = await loadFixture(deployActivityPointsFixture);

      const expectedGreenTickets = 50;
      await expect(activityPoints.rewardGreenTickets(ActivityType.wishingwell_luckypotion, alice, true))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(ActivityType.wishingwell_luckypotion, 0, alice.address, SONIC_GEM_TICKET, expectedGreenTickets);

      const balance = await mockItemNFT.balanceOf(alice, SONIC_GEM_TICKET);
      expect(balance).to.equal(expectedGreenTickets);
    });

    it("Should not get activity points for wishingwell_luckofthedraw when not evolved", async function () {
      const {alice, activityPoints, mockItemNFT} = await loadFixture(deployActivityPointsFixture);

      await expect(activityPoints.rewardGreenTickets(ActivityType.wishingwell_luckofthedraw, alice, false)).to.not.emit(
        activityPoints,
        "ActivityPointsEarned"
      );

      const balance = await mockItemNFT.balanceOf(alice, SONIC_GEM_TICKET);
      expect(balance).to.equal(0);
    });

    it("Should not get activity points for players_dailyreward when not evolved", async function () {
      const {alice, activityPoints, mockItemNFT} = await loadFixture(deployActivityPointsFixture);

      await expect(activityPoints.rewardGreenTickets(ActivityType.players_dailyreward, alice, false)).to.not.emit(
        activityPoints,
        "ActivityPointsEarned"
      );

      const balance = await mockItemNFT.balanceOf(alice, SONIC_GEM_TICKET);
      expect(balance).to.equal(0);
    });

    it("Should not get activity points for wishingwell_luckypotion when not evolved", async function () {
      const {alice, activityPoints, mockItemNFT} = await loadFixture(deployActivityPointsFixture);

      await expect(activityPoints.rewardGreenTickets(ActivityType.wishingwell_luckypotion, alice, false)).to.not.emit(
        activityPoints,
        "ActivityPointsEarned"
      );

      const balance = await mockItemNFT.balanceOf(alice, SONIC_GEM_TICKET);
      expect(balance).to.equal(0);
    });
  });
});
