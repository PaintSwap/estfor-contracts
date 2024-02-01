import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {BattleResult, clanFixture} from "./utils";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {BigNumber, ethers} from "ethers";
import {createPlayer} from "../../scripts/utils";
import {getXPFromLevel} from "../Players/utils";

describe("ClanBattleLibrary", function () {
  it("Basic comparison of skill level", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId];
    let clanMembersB = [playerId];
    const skills = [Skill.FISHING];
    let randomWordA = 1;
    let randomWordB = 1;
    await players.testModifyXP(alice.address, playerId, skills[0], 1000, true);

    let res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.false;

    randomWordA = 1;
    randomWordB = 0;

    res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.true;

    randomWordA = 0;
    randomWordB = 1;

    res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.false;
  });

  it("Mismatch in player counts is an automatic win for those that are not missing", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId];
    let clanMembersB: BigNumber[] = [];
    const skills = [Skill.FISHING];
    const randomWordA = 1;
    const randomWordB = 3;
    await players.testModifyXP(alice.address, playerId, skills[0], 1000, true);
    let res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );

    expect(res.didAWin).to.be.true;
    expect(res.battleResults[0]).to.eq(BattleResult.WIN);

    clanMembersA = [];
    clanMembersB = [playerId];
    res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.false;
    expect(res.battleResults[0]).to.eq(BattleResult.LOSE);
  });

  it("Player ids of 0 is an automatic win for the other side", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId];
    let clanMembersB = [ethers.BigNumber.from(0)];
    const skills = [Skill.FISHING];
    const randomWordA = 1;
    const randomWordB = 3;
    await players.testModifyXP(alice.address, playerId, skills[0], 1000, true);
    let res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );

    expect(res.didAWin).to.be.true;

    clanMembersA = [ethers.BigNumber.from(0)];
    clanMembersB = [playerId];
    res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.false;
  });

  it("Multiple clan members", async () => {
    const {alice, playerNFT, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId, playerId];
    let clanMembersB = [playerId, playerId];
    const skills = Array(clanMembersA.length).fill(Skill.FISHING);
    let randomWordA = 3;
    let randomWordB = 1;
    await players.testModifyXP(alice.address, playerId, skills[0], getXPFromLevel(20), true); // Get 2 rolls each

    let res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.true;

    const avatarId = 1;
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);
    // Need to be at least level 40
    await players.testModifyXP(alice.address, newPlayerId, skills[0], getXPFromLevel(40), true);

    clanMembersA = [playerId, newPlayerId];
    res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.true;

    randomWordA = 3;
    randomWordB = 3;

    clanMembersA = [playerId, playerId];
    clanMembersB = [playerId, newPlayerId];
    res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.false;
  });

  it("Multiple clan members with different skills", async () => {
    const {alice, playerNFT, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    const avatarId = 1;
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);
    let clanMembersA = [playerId, playerId];
    let clanMembersB = [playerId, newPlayerId];

    const skills = [Skill.FISHING, Skill.WOODCUTTING];
    let randomWordA = 3;
    let randomWordB = 1;
    await players.testModifyXP(alice.address, newPlayerId, skills[1], getXPFromLevel(20), true); // Get 2 rolls

    randomWordA = 7;
    randomWordB = 7;
    let res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.false;

    await players.testModifyXP(alice.address, playerId, skills[0], getXPFromLevel(40), true); // Get 3 rolls

    res = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      randomWordA,
      randomWordB
    );
    expect(res.didAWin).to.be.true;
  });

  it("Different random words should yield different results (many)", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId, playerId];
    let clanMembersB = [playerId, playerId];
    const skills = Array(clanMembersA.length).fill(Skill.FISHING);
    await players.testModifyXP(alice.address, playerId, skills[0], getXPFromLevel(60), true); // Get 4 rolls each

    let numWinsA = 0;
    let numWinsB = 0;

    for (let i = 0; i < 50; ++i) {
      const randomWordA = i;
      const randomWordB = 1;

      const res = await clanBattleLibrary.doBattleLib(
        players.address,
        clanMembersA,
        clanMembersB,
        skills,
        randomWordA,
        randomWordB
      );

      if (res.didAWin) {
        ++numWinsA;
      } else {
        ++numWinsB;
      }
    }

    expect(numWinsA).to.gt(numWinsB + 10); // By at least 10
  });

  it("Check shuffling of the order is working (many)", async () => {
    const {playerNFT, alice, players, clanBattleLibrary} = await loadFixture(clanFixture);

    const skill = Skill.FISHING;
    const avatarId = 1;
    const numMembers = 4;

    const clanMembersA = [];
    const levelsA = [99, 5, 3, 3];
    for (let i = 0; i < numMembers; ++i) {
      clanMembersA.push(await createPlayer(playerNFT, avatarId, alice, "New name" + i, true));
      await players.testModifyXP(alice.address, clanMembersA[i], skill, getXPFromLevel(levelsA[i]), true);
    }

    const clanMembersB = [];
    const levelsB = [6, 6, 4, 2];
    for (let i = 0; i < numMembers; ++i) {
      clanMembersB.push(await createPlayer(playerNFT, avatarId, alice, "New name" + i + clanMembersA.length, true));
      await players.testModifyXP(alice.address, clanMembersB[i], skill, getXPFromLevel(levelsB[i]), true);
    }

    const skills = Array(clanMembersA.length).fill(skill);

    // Initial result
    const initialWinner = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      skills,
      1,
      1
    );

    let success = false;
    for (let i = 1; i < 100; ++i) {
      const randomWordA = i;
      const randomWordB = 1;
      const winner = await clanBattleLibrary.doBattleLib(
        players.address,
        clanMembersA,
        clanMembersB,
        skills,
        randomWordA,
        randomWordB
      );

      if (initialWinner != winner) {
        success = true;
        break;
      }
    }

    expect(success).to.eq(true);
  });
});
