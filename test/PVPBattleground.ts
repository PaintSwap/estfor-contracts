import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {BattleResult, fulfillRandomWords, getEventLog, timeTravel} from "./utils";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";

import {createPlayer} from "../scripts/utils";
import {getXPFromLevel} from "./Players/utils";
import {playersFixture} from "./Players/PlayersFixture";
import {Block} from "ethers";
import {ethers} from "hardhat";
import {allBattleSkills} from "../scripts/data/territories";

describe("PVPBattleground", function () {
  const pvpBattlegroundFixture = async () => {
    const fixture = await loadFixture(playersFixture);
    const {owner, playerNFT} = fixture;

    const defendingPlayerId = await createPlayer(playerNFT, 1, owner, "New name", true);
    return {...fixture, defendingPlayerId};
  };

  describe("determineBattleOutcome", function () {
    it("Basic comparison of skill level", async () => {
      const {alice, players, playerId, defendingPlayerId, pvpBattleground} = await loadFixture(pvpBattlegroundFixture);

      const skills = [Skill.FISHING];
      // randomWordAs[0] is the random word deciding dice rolls for the first 16 players
      // randomWordAs[1] is the random word deciding dice rolls for the remaining players
      let randomWords = [1, 1];

      const extraRollsA = 0;
      const extraRollsB = 0;
      await players.testModifyXP(alice, playerId, skills[0], 1000, true);

      let res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.true;

      randomWords = [1, 0];

      res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.true;

      randomWords = [0, 1];

      res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.false;
    });

    it("Evolved hero should get an extra roll", async () => {
      const {
        owner,
        alice,
        players,
        playerId,
        defendingPlayerId,
        pvpBattleground,
        playerNFT,
        upgradePlayerBrushPrice,
        brush,
        origName
      } = await loadFixture(pvpBattlegroundFixture);

      const skills = [Skill.FISHING];

      let randomWords = [3, 3];
      const extraRollsA = 0;
      const extraRollsB = 0;

      await players.testModifyXP(owner, defendingPlayerId, skills[0], getXPFromLevel(20), true);
      let res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.false;

      await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
      await brush.mint(alice, upgradePlayerBrushPrice);
      const upgrade = true;
      await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", upgrade);
      res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.true;
    });

    it("Check extra rolls work", async () => {
      const {owner, players, playerId, defendingPlayerId, pvpBattleground, playerNFT} = await loadFixture(
        pvpBattlegroundFixture
      );

      const skills = [Skill.FISHING];

      const randomWords = [3, 3];
      let extraRollsA = 0;
      const extraRollsB = 0;

      await players.testModifyXP(owner, defendingPlayerId, skills[0], getXPFromLevel(20), true);
      let res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.false;

      extraRollsA = 1;
      res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.true;
    });

    it("Player ids of 0/non-existent is an automatic win for the other side", async () => {
      const {owner, alice, players, playerId, defendingPlayerId, pvpBattleground} = await loadFixture(
        pvpBattlegroundFixture
      );

      const invalidDefendingPlayerId = 0n;
      const skills = [Skill.FISHING];
      const randomWords = [1, 3];
      const extraRollsA = 0;
      const extraRollsB = 0;
      await players.testModifyXP(alice, playerId, skills[0], getXPFromLevel(20), true);
      let res = await pvpBattleground.determineBattleOutcome(
        playerId,
        invalidDefendingPlayerId, // no defender
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );

      expect(res.didAWin).to.be.true;
      await players.testModifyXP(owner, defendingPlayerId, skills[0], getXPFromLevel(20), true);
      res = await pvpBattleground.determineBattleOutcome(
        0, // even 0 still gets a roll
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.false;
    });

    it("Both player ids of 0/non-existent is a winner for the attacker", async () => {
      const {alice, players, playerId, pvpBattleground} = await loadFixture(pvpBattlegroundFixture);

      const invalidAttackingPlayerId = 0n;
      const invalidDefendingPlayerId = 0n;
      const skills = [Skill.FISHING];
      const randomWords = [1, 3];
      const extraRollsA = 0;
      const extraRollsB = 0;
      await players.testModifyXP(alice, playerId, skills[0], 1000, true);
      let res = await pvpBattleground.determineBattleOutcome(
        invalidAttackingPlayerId,
        invalidDefendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.true;
    });

    it("Different skills", async () => {
      const {owner, alice, players, playerId, defendingPlayerId, pvpBattleground} = await loadFixture(
        pvpBattlegroundFixture
      );

      const skills = [Skill.FISHING, Skill.WOODCUTTING];
      await players.testModifyXP(owner, defendingPlayerId, Skill.WOODCUTTING, getXPFromLevel(20), true); // Get 3 rolls
      let randomWords = [0b11_00000000_00000011, 0b11_00000000_00000011];
      const extraRollsA = 0;
      const extraRollsB = 0;
      let res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.battleResults[0]).to.eq(BattleResult.DRAW);
      expect(res.battleResults[1]).to.eq(BattleResult.LOSE);
      expect(res.didAWin).to.be.false;

      await players.testModifyXP(alice, playerId, Skill.FISHING, getXPFromLevel(20), true); // Get 3 rolls

      res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.battleResults[0]).to.eq(BattleResult.WIN);
      expect(res.battleResults[1]).to.eq(BattleResult.LOSE);
      expect(res.didAWin).to.be.true;
    });

    it("Different random words should yield different results (many)", async () => {
      const {owner, alice, players, playerId, defendingPlayerId, pvpBattleground} = await loadFixture(
        pvpBattlegroundFixture
      );

      const skills = [Skill.FISHING];
      await players.testModifyXP(alice, playerId, skills[0], getXPFromLevel(60), true); // Get 4 rolls each
      await players.testModifyXP(owner, defendingPlayerId, skills[0], getXPFromLevel(60), true); // Get 4 rolls each

      let numWinsA = 0;
      let numWinsB = 0;
      const extraRollsA = 0;
      const extraRollsB = 0;

      for (let i = 0; i < 50; ++i) {
        const randomWords = [i, 1];
        const res = await pvpBattleground.determineBattleOutcome(
          playerId,
          defendingPlayerId,
          skills,
          randomWords,
          extraRollsA,
          extraRollsB
        );

        if (res.didAWin) {
          ++numWinsA;
        } else {
          ++numWinsB;
        }
      }

      expect(numWinsA).to.gt(numWinsB + 10); // By at least 10
    });

    it("More than 8 rolls should use multiple bytes", async () => {
      const {players, playerId, defendingPlayerId, pvpBattleground, owner, alice} = await loadFixture(
        pvpBattlegroundFixture
      );

      const skills = [Skill.FISHING];
      await players.testModifyXP(alice, playerId, skills[0], getXPFromLevel(40), true);
      await players.testModifyXP(owner, defendingPlayerId, skills[0], getXPFromLevel(40), true);

      let randomWords = [0b1_00000000, 0b0_00000001];
      const extraRollsA = 8; // 9 rolls
      const extraRollsB = 8; // 9 rolls
      let res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.true;

      // B gets another hit so has 1 more
      randomWords = [0b1_00000000, 0b1_00000001];
      res = await pvpBattleground.determineBattleOutcome(
        playerId,
        defendingPlayerId,
        skills,
        randomWords,
        extraRollsA,
        extraRollsB
      );
      expect(res.didAWin).to.be.false;
    });

    it("Have at least 2 random words", async () => {
      const {playerId, defendingPlayerId, pvpBattleground} = await loadFixture(pvpBattlegroundFixture);

      const skills = [Skill.FISHING];
      let randomWords = [0b0];
      const extraRollsA = 0;
      const extraRollsB = 0;
      await expect(
        pvpBattleground.determineBattleOutcome(
          playerId,
          defendingPlayerId,
          skills,
          randomWords,
          extraRollsA,
          extraRollsB
        )
      ).to.be.revertedWithCustomError(pvpBattleground, "NotEnoughRandomWords");
    });

    it("Too many skills", async () => {
      // TODO:
      /*
      const {playerId, defendingPlayerId, pvpBattleground} = await loadFixture(pvpBattlegroundFixture);

      const skills = new Array(17).fill(Skill.FISHING); // Needs to use all
      let randomWords = [0, 0b0];
      const extraRollsA = 0;
      const extraRollsB = 0;
      await expect(
        pvpBattleground.determineBattleOutcome(
          playerId,
          defendingPlayerId,
          skills,
          randomWords,
          extraRollsA,
          extraRollsB
        )
      ).to.be.revertedWithCustomError(pvpBattleground, "TODO"); */
    });
  });

  describe("other", function () {
    it("Cannot attack your own player", async function () {
      const {pvpBattleground, playerId, alice} = await loadFixture(pvpBattlegroundFixture);

      await expect(
        pvpBattleground.connect(alice).attackPlayer(playerId, playerId, {value: await pvpBattleground.getAttackCost()})
      ).to.be.revertedWithCustomError(pvpBattleground, "CannotAttackSelf");
    });

    it("Check player info is set after attacking", async () => {
      const {playerId, defendingPlayerId, alice, mockVRF, pvpBattleground, pvpAttackingCooldown} = await loadFixture(
        pvpBattlegroundFixture
      );

      await pvpBattleground
        .connect(alice)
        .attackPlayer(playerId, defendingPlayerId, {value: await pvpBattleground.getAttackCost()});

      let attackingPlayerInfo = await pvpBattleground.getPlayerInfo(playerId);

      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      expect(attackingPlayerInfo.attackingCooldownTimestamp).to.eq(NOW + pvpAttackingCooldown);
      expect(attackingPlayerInfo.currentlyAttacking).to.be.true;

      const requestId = 1;
      await fulfillRandomWords(requestId, pvpBattleground, mockVRF);
      attackingPlayerInfo = await pvpBattleground.getPlayerInfo(playerId);
      expect(attackingPlayerInfo.currentlyAttacking).to.be.false;
    });

    it("Cannot fulfill more than once", async () => {
      const {playerId, defendingPlayerId, alice, mockVRF, pvpBattleground, pvpAttackingCooldown} = await loadFixture(
        pvpBattlegroundFixture
      );

      await pvpBattleground
        .connect(alice)
        .attackPlayer(playerId, defendingPlayerId, {value: await pvpBattleground.getAttackCost()});

      let attackingPlayerInfo = await pvpBattleground.getPlayerInfo(playerId);

      const {timestamp: NOW} = (await ethers.provider.getBlock("latest")) as Block;
      expect(attackingPlayerInfo.attackingCooldownTimestamp).to.eq(NOW + pvpAttackingCooldown);
      expect(attackingPlayerInfo.currentlyAttacking).to.be.true;

      const requestId = 1;
      await fulfillRandomWords(requestId, pvpBattleground, mockVRF);
      await expect(fulfillRandomWords(requestId, pvpBattleground, mockVRF)).to.revertedWithCustomError(
        pvpBattleground,
        "RequestIdNotKnown"
      );
    });

    it("Attacking has a cooldown", async () => {
      const {playerId, defendingPlayerId, alice, mockVRF, pvpBattleground, pvpAttackingCooldown} = await loadFixture(
        pvpBattlegroundFixture
      );

      await pvpBattleground
        .connect(alice)
        .attackPlayer(playerId, defendingPlayerId, {value: await pvpBattleground.getAttackCost()});
      const requestId = 1;
      await fulfillRandomWords(requestId, pvpBattleground, mockVRF);
      await expect(
        pvpBattleground
          .connect(alice)
          .attackPlayer(playerId, defendingPlayerId, {value: await pvpBattleground.getAttackCost()})
      ).to.be.revertedWithCustomError(pvpBattleground, "PlayerAttackingCooldown");
      await timeTravel(pvpAttackingCooldown - 10);
      await expect(
        pvpBattleground
          .connect(alice)
          .attackPlayer(playerId, defendingPlayerId, {value: await pvpBattleground.getAttackCost()})
      ).to.be.revertedWithCustomError(pvpBattleground, "PlayerAttackingCooldown");
      await timeTravel(pvpAttackingCooldown - 10);
      await expect(
        pvpBattleground
          .connect(alice)
          .attackPlayer(playerId, defendingPlayerId, {value: await pvpBattleground.getAttackCost()})
      ).to.not.be.reverted;
    });

    it("Attacking should never use same skills twice (many)", async () => {
      const {playerId, defendingPlayerId, alice, mockVRF, pvpBattleground, pvpAttackingCooldown} = await loadFixture(
        pvpBattlegroundFixture
      );

      // Check different skills are used each time, and also that all skills are represented.
      const skillMap = new Map<number, number>(); // Changed from Skill to number
      for (let i = 0; i < 50; ++i) {
        await pvpBattleground
          .connect(alice)
          .attackPlayer(playerId, defendingPlayerId, {value: await pvpBattleground.getAttackCost()});

        const requestId = i + 1;
        const tx = await fulfillRandomWords(requestId, pvpBattleground, mockVRF);
        const log = await getEventLog(tx, pvpBattleground, "BattleResult");

        expect(log.attackingPlayerId).to.eq(playerId);
        expect(log.defendingPlayerId).to.eq(defendingPlayerId);

        const set = new Set(log.randomSkills);
        expect(set.size).to.eq(log.randomSkills.length); // Check for duplicates
        expect(log.randomSkills.length).to.eq(8); // Check for 8 skills
        for (const randomSkill of log.randomSkills) {
          // Convert BigInt to number when storing
          const skillNumber = Number(randomSkill);
          skillMap.set(skillNumber, (skillMap.get(skillNumber) ?? 0) + 1);
        }
        await timeTravel(pvpAttackingCooldown);
      }
      allBattleSkills.forEach((skill) => {
        const skillNumber = Number(skill);
        expect(skillMap.has(skillNumber)).to.be.true;
        expect(skillMap.get(skillNumber) as number).to.be.gt(0);
      });
    });

    it("Try fulfill an attack request id that isn't ongoing", async () => {
      const {playerId, defendingPlayerId, alice, mockVRF, pvpBattleground} = await loadFixture(pvpBattlegroundFixture);

      await pvpBattleground
        .connect(alice)
        .attackPlayer(playerId, defendingPlayerId, {value: await pvpBattleground.getAttackCost()});

      await expect(fulfillRandomWords(3, pvpBattleground, mockVRF)).to.revertedWithCustomError(
        pvpBattleground,
        "RequestIdNotKnown"
      );
    });

    it("Not paying the request cost", async function () {
      const {playerId, defendingPlayerId, alice, pvpBattleground} = await loadFixture(pvpBattlegroundFixture);

      await expect(
        pvpBattleground
          .connect(alice)
          .attackPlayer(playerId, defendingPlayerId, {value: (await pvpBattleground.getAttackCost()) - 1n})
      ).to.be.revertedWithCustomError(pvpBattleground, "InsufficientCost");
    });
  });
});
