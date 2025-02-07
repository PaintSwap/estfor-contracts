import {ethers, upgrades} from "hardhat";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ActivityPoints} from "../typechain-types";
import {ContractTransactionResponse} from "ethers";

enum ActivityType {
  NONE,
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
  clans_evt_clancreated,
  lockedbankvaults_evt_attackvaults,
  territories_evt_attackterritory,
  territories_evt_claimunoccupiedterritory,
  players_evt_actionfinished,
  players_evt_addxp,
  players_evt_levelup,
  players_evt_boostfinished,
  players_evt_dailyreward,
  players_evt_weeklyreward,
  players_evt_claimedxpthresholdrewards
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
    const activityPoints = (await upgrades.deployProxy(ActivityPoints, [mockItemNFT.target], {
      kind: "uups"
    })) as unknown as ActivityPoints;
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

  describe("Point Calculation", function () {
    it("Should get activity points for instantactions_evt_doinstantactions", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const instantActionsAP = 200;
      await expect(activityPoints.reward(ActivityType.instantactions_evt_doinstantactions, alice.address, 0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.instantactions_evt_doinstantactions, 0, instantActionsAP);
    });

    it("Should get activity points for shop_evt_buy", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const brush0 = 1;
      const brushAP0 = 63;
      await expect(activityPoints.reward(ActivityType.shop_evt_buy, alice.address, brush0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.shop_evt_buy, brush0, brushAP0);

      const brush = 100;
      const brushAP = 189;
      await expect(activityPoints.reward(ActivityType.shop_evt_buy, alice.address, brush))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.shop_evt_buy, brush, brushAP);

      const brush2 = 4000;
      const brushAP2 = 315;
      await expect(activityPoints.reward(ActivityType.shop_evt_buy, alice.address, brush2))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.shop_evt_buy, brush2, brushAP2);

      const brush3 = 40000;
      const brushAP3 = 378;
      await expect(activityPoints.reward(ActivityType.shop_evt_buy, alice.address, brush3))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.shop_evt_buy, brush3, brushAP3);
    });

    it("Should get activity points for players_evt_addxp", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const xp = 1;
      const xpAP = 0;
      await expect(activityPoints.reward(ActivityType.players_evt_addxp, alice.address, xp)).not.to.emit(
        activityPoints,
        "ActivityPointsEarned"
      );

      const xp2 = 3;
      const xpAP2 = 15;
      await expect(activityPoints.reward(ActivityType.players_evt_addxp, alice.address, xp2))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_addxp, xp2, xpAP2);

      const xp3 = 966;
      const xpAP3 = 135;
      await expect(activityPoints.reward(ActivityType.players_evt_addxp, alice.address, xp3))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_addxp, xp3, xpAP3);

      const xp4 = 10000;
      const xpAP4 = 180;
      await expect(activityPoints.reward(ActivityType.players_evt_addxp, alice.address, xp4))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_addxp, xp4, xpAP4);
    });

    it("Should get activity points for players_evt_levelup", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const level1 = 1;
      const levelAP1 = 0;
      await expect(activityPoints.reward(ActivityType.players_evt_levelup, alice.address, level1)).not.to.emit(
        activityPoints,
        "ActivityPointsEarned"
      );

      const level3 = 4;
      const levelAP3 = 65;
      await expect(activityPoints.reward(ActivityType.players_evt_levelup, alice.address, level3))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_levelup, level3, levelAP3);

      const level10 = 10;
      const levelAP10 = 130;
      await expect(activityPoints.reward(ActivityType.players_evt_levelup, alice.address, level10))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_levelup, level10, levelAP10);

      const level25 = 25;
      const levelAP25 = 195;
      await expect(activityPoints.reward(ActivityType.players_evt_levelup, alice.address, level25))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_levelup, level25, levelAP25);

      const level89 = 89;
      const levelAP89 = 325;
      await expect(activityPoints.reward(ActivityType.players_evt_levelup, alice.address, level89))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_levelup, level89, levelAP89);

      const level130 = 130;
      const levelAP130 = 390;
      await expect(activityPoints.reward(ActivityType.players_evt_levelup, alice.address, level130))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_levelup, level130, levelAP130);

      //add 140
      const level140 = 140;
      const levelAP140 = 390;
      await expect(activityPoints.reward(ActivityType.players_evt_levelup, alice.address, level140))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_levelup, level140, levelAP140);
    });

    it("Should get activity points for players_evt_claimedxpthresholdrewards", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);

      const xpThreshold = 1;
      const xpThresholdAP = 100;
      await expect(
        activityPoints.reward(ActivityType.players_evt_claimedxpthresholdrewards, alice.address, xpThreshold)
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_claimedxpthresholdrewards, xpThreshold, xpThresholdAP);

      // at the max so no more points
      const xpThreshold2 = 1;
      await expect(
        activityPoints.reward(ActivityType.players_evt_claimedxpthresholdrewards, alice.address, xpThreshold2)
      ).not.to.emit(activityPoints, "ActivityPointsEarned");

      // advance one day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      // should get points again
      await expect(
        activityPoints.reward(ActivityType.players_evt_claimedxpthresholdrewards, alice.address, xpThreshold2)
      )
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.players_evt_claimedxpthresholdrewards, xpThreshold2, xpThresholdAP);
    });
  });

  describe("NFT Point Boosts", function () {
    it("Should not boost points when no boost is active", async function () {
      const {activityPoints, alice} = await loadFixture(deployActivityPointsFixture);
      const points = 100;

      await expect(activityPoints.reward(ActivityType.instantactions_evt_doinstantactions, alice.address, 0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.instantactions_evt_doinstantactions, 0, points * 2);
    });

    it("Should boost points when NFT boost is active", async function () {
      const {activityPoints, alice, testERC721} = await loadFixture(deployActivityPointsFixture);

      const nftTokenId = await getTokenId(testERC721.mint(alice.address));
      // Register boost
      await activityPoints.connect(alice).registerPointBoost(await testERC721.getAddress(), nftTokenId);

      // Calculate points with boost
      const basePoints = 100;
      await expect(activityPoints.reward(ActivityType.instantactions_evt_doinstantactions, alice.address, 0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.instantactions_evt_doinstantactions, 0, basePoints * 2);
    });

    it.only("Should not boost points before boost activates", async function () {
      const {activityPoints, alice, testERC721} = await loadFixture(deployActivityPointsFixture);

      const nftTokenId = await getTokenId(testERC721.mint(alice));
      console.log("nftTokenId", nftTokenId);
      await activityPoints.connect(alice).registerPointBoost(testERC721, nftTokenId);

      const basePoints = 200;
      await expect(activityPoints.reward(ActivityType.instantactions_evt_doinstantactions, alice.address, 0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.instantactions_evt_doinstantactions, 0, basePoints);

      // Advance time past 1 day
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      // Points should not be boosted since there were no boosted the first day...
      await expect(activityPoints.reward(ActivityType.instantactions_evt_doinstantactions, alice.address, 0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.instantactions_evt_doinstantactions, 0, basePoints);

      // Advance time past 1 day
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      // Points should now be boosted since there were no boosted the first day...
      await expect(activityPoints.reward(ActivityType.instantactions_evt_doinstantactions, alice.address, 0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice.address, ActivityType.instantactions_evt_doinstantactions, 0, (basePoints * 110) / 100);
    });

    it.only("Should not boost points if NFT is transferred", async function () {
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
      await expect(activityPoints.reward(ActivityType.instantactions_evt_doinstantactions, alice, 0))
        .to.emit(activityPoints, "ActivityPointsEarned")
        .withArgs(alice, ActivityType.instantactions_evt_doinstantactions, 0, basePoints);
    });
  });
});
