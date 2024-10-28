import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {BattleResult, clanFixture} from "./utils";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";

import {createPlayer} from "../../scripts/utils";
import {getXPFromLevel} from "../Players/utils";

describe("ClanBattleLibrary", function () {
  it("Basic comparison of skill level", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId];
    let clanMembersB = [playerId];
    const skills = [Skill.FISHING];
    let randomWordAs = [0, 1, 0];
    let randomWordBs = [0, 1, 0];
    const extraRollsA = 0;
    const extraRollsB = 0;
    await players.testModifyXP(alice, playerId, skills[0], 1000, true);

    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.true;

    randomWordAs = [0, 1, 0];
    randomWordBs = [0, 0, 0];

    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.true;

    randomWordAs = [0, 0, 0];
    randomWordBs = [0, 1, 0];

    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.false;
  });

  it("Evolved hero should get an extra roll", async () => {
    const {owner, alice, players, playerId, clanBattleLibrary, playerNFT, upgradePlayerBrushPrice, brush, origName} =
      await loadFixture(clanFixture);

    const clanMembersA = [playerId];
    const skills = [Skill.FISHING];

    const avatarId = 1;
    let randomWordAs = [0, 3, 0];
    let randomWordBs = [0, 3, 0];
    const extraRollsA = 0;
    const extraRollsB = 0;

    await createPlayer(playerNFT, avatarId, owner, "New name", true);
    await players.testModifyXP(owner, playerId + 1n, skills[0], getXPFromLevel(20), true);
    const clanMembersB = [playerId + 1n];
    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.false;

    await brush.connect(alice).approve(playerNFT, upgradePlayerBrushPrice);
    await brush.mint(alice, upgradePlayerBrushPrice);
    const upgrade = true;
    await playerNFT.connect(alice).editPlayer(playerId, origName, "", "", "", upgrade);
    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.true;
  });

  it("Check extra rolls work", async () => {
    const {owner, players, playerId, clanBattleLibrary, playerNFT} = await loadFixture(clanFixture);

    const clanMembersA = [playerId];
    const skills = [Skill.FISHING];

    const avatarId = 1;
    const randomWordAs = [0, 3, 0];
    const randomWordBs = [0, 3, 0];
    let extraRollsA = 0;
    const extraRollsB = 0;

    await createPlayer(playerNFT, avatarId, owner, "New name", true);
    await players.testModifyXP(owner, playerId + 1n, skills[0], getXPFromLevel(20), true);
    const clanMembersB = [playerId + 1n];
    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.false;

    extraRollsA = 1;

    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.true;
  });

  it("Mismatch in player counts is an automatic win for those that are not missing", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId];
    let clanMembersB: bigint[] = [];
    const skills = [Skill.FISHING];
    const randomWordAs = [0, 1, 0];
    const randomWordBs = [0, 3, 0];
    const extraRollsA = 0;
    const extraRollsB = 0;
    await players.testModifyXP(alice, playerId, skills[0], 1000, true);
    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );

    expect(res.didAWin).to.be.true;
    expect(res.battleResults[0]).to.eq(BattleResult.WIN);

    clanMembersA = [];
    clanMembersB = [playerId];
    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],

      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.false;
    expect(res.battleResults[0]).to.eq(BattleResult.LOSE);
  });

  it("Player ids of 0 is an automatic win for the other side", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId];
    let clanMembersB = [0n];
    const skills = [Skill.FISHING];
    const randomWordAs = [0, 1, 0];
    const randomWordBs = [0, 3, 0];
    const extraRollsA = 0;
    const extraRollsB = 0;
    await players.testModifyXP(alice, playerId, skills[0], 1000, true);
    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );

    expect(res.didAWin).to.be.true;

    clanMembersA = [0n];
    clanMembersB = [playerId];
    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],

      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.false;
  });

  it("Multiple clan members", async () => {
    const {alice, playerNFT, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId, playerId];
    let clanMembersB = [playerId, playerId];
    const skills = Array(clanMembersA.length).fill(Skill.FISHING);
    let randomWordAs = [0, 3, 0];
    let randomWordBs = [0, 1, 0];
    const extraRollsA = 0;
    const extraRollsB = 0;
    await players.testModifyXP(alice, playerId, skills[0], getXPFromLevel(20), true); // Get 2 rolls each

    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.true;

    const avatarId = 1;
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);
    // Need to be at least level 40
    await players.testModifyXP(alice, newPlayerId, skills[0], getXPFromLevel(40), true);

    clanMembersA = [playerId, newPlayerId];
    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.true;

    randomWordAs = [0, 1, 0];
    randomWordBs = [0, 3, 0];

    clanMembersA = [playerId, playerId];
    clanMembersB = [playerId, newPlayerId];
    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.false;
  });

  it("Multiple clan members with different skills", async () => {
    const {alice, playerNFT, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    const avatarId = 1;
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);
    let clanMembersA = [playerId, playerId];
    let clanMembersB = [newPlayerId, newPlayerId];

    const skills = [Skill.FISHING, Skill.WOODCUTTING];
    await players.testModifyXP(alice, newPlayerId, Skill.WOODCUTTING, getXPFromLevel(20), true); // Get 3 rolls
    let randomWordAs = [0, 0b11_00000000_00000011, 0];
    let randomWordBs = [0, 0b11_00000000_00000011, 0];
    const extraRollsA = 0;
    const extraRollsB = 0;
    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.battleResults[0]).to.eq(BattleResult.DRAW);
    expect(res.battleResults[1]).to.eq(BattleResult.LOSE);
    expect(res.didAWin).to.be.false;

    await players.testModifyXP(alice, playerId, Skill.FISHING, getXPFromLevel(20), true); // Get 3 rolls

    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.battleResults[0]).to.eq(BattleResult.WIN);
    expect(res.battleResults[1]).to.eq(BattleResult.LOSE);
    expect(res.didAWin).to.be.true;
  });

  it("Different random words should yield different results (many)", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId, playerId];
    let clanMembersB = [playerId, playerId];
    const skills = Array(clanMembersA.length).fill(Skill.FISHING);
    await players.testModifyXP(alice, playerId, skills[0], getXPFromLevel(60), true); // Get 4 rolls each

    let numWinsA = 0;
    let numWinsB = 0;
    const extraRollsA = 0;
    const extraRollsB = 0;

    for (let i = 0; i < 50; ++i) {
      const randomWordAs = [0, i, 0];
      const randomWordBs = [0, 1, 0];
      const res = await clanBattleLibrary.doBattle(
        players,
        clanMembersA,
        clanMembersB,
        skills,
        [...randomWordAs, ...randomWordBs],
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

  it("Check shuffling of the order is working (many)", async () => {
    const {playerNFT, alice, players, clanBattleLibrary} = await loadFixture(clanFixture);

    const skill = Skill.FISHING;
    const avatarId = 1;
    const numMembers = 4;
    const randomWordAs = [0, 1, 0];
    const randomWordBs = [0, 1, 0];
    const extraRollsA = 0;
    const extraRollsB = 0;

    const clanMembersA = [];
    const levelsA = [99, 5, 3, 3];
    for (let i = 0; i < numMembers; ++i) {
      clanMembersA.push(await createPlayer(playerNFT, avatarId, alice, "New name" + i, true));
      await players.testModifyXP(alice, clanMembersA[i], skill, getXPFromLevel(levelsA[i]), true);
    }

    const clanMembersB = [];
    const levelsB = [6, 6, 4, 2];
    for (let i = 0; i < numMembers; ++i) {
      clanMembersB.push(await createPlayer(playerNFT, avatarId, alice, "New name" + i + clanMembersA.length, true));
      await players.testModifyXP(alice, clanMembersB[i], skill, getXPFromLevel(levelsB[i]), true);
    }

    const skills = Array(clanMembersA.length).fill(skill);

    // Initial result
    const initialWinner = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );

    let success = false;
    for (let i = 1; i < 100; ++i) {
      const randomWordAs = [0, i, 0];
      const randomWordBs = [0, 1, 0];
      const winner = await clanBattleLibrary.doBattle(
        players,
        clanMembersA,
        clanMembersB,
        skills,
        [...randomWordAs, ...randomWordBs],
        extraRollsA,
        extraRollsB
      );

      if (initialWinner != winner) {
        success = true;
        break;
      }
    }

    expect(success).to.eq(true);
  });

  it("More than 8 rolls should use multiple bytes", async () => {
    const {players, playerId, clanBattleLibrary, alice} = await loadFixture(clanFixture);

    let clanMembersA = [playerId];
    let clanMembersB = [playerId];

    const skills = [Skill.FISHING];
    await players.testModifyXP(alice, playerId, Skill.FISHING, getXPFromLevel(40), true);

    let randomWordAs = [0, 0b1_00000000, 0];
    let randomWordBs = [0, 0b0_00000001, 0];
    const extraRollsA = 8; // 9 rolls
    const extraRollsB = 8; // 9 rolls
    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.true;

    // B gets another hit so has 1 more
    randomWordAs = [0, 0b1_00000000, 0];
    randomWordBs = [0, 0b1_00000001, 0];
    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.false;
  });

  it("Using more than 16 players should use multiple random words", async () => {
    const {players, playerId, clanBattleLibrary, alice} = await loadFixture(clanFixture);

    const clanMembersA = new Array(17).fill(playerId);
    const clanMembersB = new Array(17).fill(playerId);
    const skills = new Array(17).fill(Skill.FISHING);

    let randomWordAs = [
      0,
      0b00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000000n, // has 0 at the right most byte
      0b1
    ];
    let randomWordBs = [
      0,
      0b00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001n,
      0b0
    ];
    const extraRollsA = 0;
    const extraRollsB = 0;
    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.true;

    // B gets another hit so has 1 more
    randomWordAs = [
      0,
      0b00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000000n,
      0b1
    ];
    randomWordBs = [
      0,
      0b00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001_00000000_00000001n,
      0b1
    ];

    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.didAWin).to.be.false;
  });

  it("Have at least 6 random words", async () => {
    const {players, playerId, clanBattleLibrary, alice} = await loadFixture(clanFixture);

    const clanMembersA = new Array(17).fill(playerId);
    const clanMembersB = new Array(17).fill(playerId);
    const skills = new Array(17).fill(Skill.FISHING);

    let randomWordAs = [0, 0b0, 0b1];
    let randomWordBs = [0, 0b0]; // Only have 2 random words which is not enough
    const extraRollsA = 0;
    const extraRollsB = 0;
    await expect(
      clanBattleLibrary.doBattle(
        players,
        clanMembersA,
        clanMembersB,
        skills,
        [...randomWordAs, ...randomWordBs],
        extraRollsA,
        extraRollsB
      )
    ).to.be.revertedWithCustomError(clanBattleLibrary, "NotEnoughRandomWords");
  });

  it("Too many attackers or defenders", async () => {
    const {players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = new Array(33).fill(playerId);
    let clanMembersB = new Array(1).fill(playerId);
    const skills = new Array(33).fill(Skill.FISHING);

    let randomWordAs = [0, 0b0, 0b1];
    let randomWordBs = [0, 0b0, 0b1];
    const extraRollsA = 0;
    const extraRollsB = 0;
    await expect(
      clanBattleLibrary.doBattle(
        players,
        clanMembersA,
        clanMembersB,
        skills,
        [...randomWordAs, ...randomWordBs],
        extraRollsA,
        extraRollsB
      )
    ).to.be.revertedWithCustomError(clanBattleLibrary, "TooManyAttackers");

    clanMembersA = new Array(1).fill(playerId);
    clanMembersB = new Array(33).fill(playerId);
    await expect(
      clanBattleLibrary.doBattle(
        players,
        clanMembersA,
        clanMembersB,
        skills,
        [...randomWordAs, ...randomWordBs],
        extraRollsA,
        extraRollsB
      )
    ).to.be.revertedWithCustomError(clanBattleLibrary, "TooManyDefenders");
  });

  it("Check shuffling works", async () => {
    const {alice, players, playerId, playerNFT, clanBattleLibrary} = await loadFixture(clanFixture);

    const avatarId = 1;
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);

    let clanMembersA = [playerId, newPlayerId];
    let clanMembersB = [playerId, newPlayerId];
    const skills = [Skill.FISHING, Skill.WOODCUTTING];
    let randomWordAs = [0, 5, 0];
    let randomWordBs = [0, 5, 0];
    await players.testModifyXP(alice, playerId, Skill.FISHING, getXPFromLevel(40), true); // Get 3 rolls for fishing

    const extraRollsA = 0;
    const extraRollsB = 0;
    let res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.battleResults[0]).to.eq(BattleResult.DRAW);
    expect(res.battleResults[1]).to.eq(BattleResult.DRAW);
    expect(res.didAWin).to.be.true;

    randomWordAs = [1, 5, 0]; // Add some shuffling to attackers
    randomWordBs = [0, 5, 0];
    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.battleResults[0]).to.eq(BattleResult.LOSE);
    expect(res.battleResults[1]).to.eq(BattleResult.DRAW); // There are no bytes for the second player
    expect(res.didAWin).to.be.false;

    randomWordAs = [0, 5, 0];
    randomWordBs = [1, 5, 0]; // Add some shuffling to defenders
    res = await clanBattleLibrary.doBattle(
      players,
      clanMembersA,
      clanMembersB,
      skills,
      [...randomWordAs, ...randomWordBs],
      extraRollsA,
      extraRollsB
    );
    expect(res.battleResults[0]).to.eq(BattleResult.WIN);
    expect(res.battleResults[1]).to.eq(BattleResult.DRAW);
    expect(res.didAWin).to.be.true;
  });
});
