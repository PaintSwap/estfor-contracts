import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {clanFixture} from "./utils";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {createPlayer} from "../../scripts/utils";
import {getXPFromLevel} from "../Players/utils";

describe("ClanBattleLibrary", function () {
  it("Basic comparison of skill level", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId];
    let clanMembersB = [playerId];
    let randomWordA = 1;
    let randomWordB = 1;
    const skill = Skill.FISHING;
    await players.testModifyXP(alice.address, playerId, skill, 1000, true);

    let winner = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      randomWordA,
      randomWordB,
      skill
    );
    expect(winner).to.eq(0);

    randomWordA = 1;
    randomWordB = 0;

    winner = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      randomWordA,
      randomWordB,
      skill
    );
    expect(winner).to.eq(1);

    randomWordA = 0;
    randomWordB = 1;

    winner = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      randomWordA,
      randomWordB,
      skill
    );
    expect(winner).to.eq(-1);
  });

  it("Mismatch in counts is an automatic win for those that are not missing", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId];
    let clanMembersB: BigNumber[] = [];
    const randomWordA = 1;
    const randomWordB = 3;
    const skill = Skill.FISHING;
    await players.testModifyXP(alice.address, playerId, skill, 1000, true);
    let winner = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      randomWordA,
      randomWordB,
      skill
    );
    expect(winner).to.eq(1);

    clanMembersA = [];
    clanMembersB = [playerId];
    winner = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      randomWordA,
      randomWordB,
      skill
    );
    expect(winner).to.eq(-1);
  });

  it("Multiple clan members", async () => {
    const {alice, playerNFT, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId, playerId];
    let clanMembersB = [playerId, playerId];
    let randomWordA = 3;
    let randomWordB = 1;
    const skill = Skill.FISHING;
    await players.testModifyXP(alice.address, playerId, skill, 1000, true);

    let winner = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      randomWordA,
      randomWordB,
      skill
    );
    expect(winner).to.eq(0);

    const avatarId = 1;
    const newPlayerId = await createPlayer(playerNFT, avatarId, alice, "New name", true);
    // Need to be at least level 40
    await players.testModifyXP(alice.address, newPlayerId, skill, getXPFromLevel(40), true);

    clanMembersA = [playerId, newPlayerId];
    winner = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      randomWordA,
      randomWordB,
      skill
    );
    expect(winner).to.eq(1);

    randomWordA = 3;
    randomWordB = 3;

    clanMembersA = [playerId, playerId];
    clanMembersB = [playerId, newPlayerId];
    winner = await clanBattleLibrary.doBattleLib(
      players.address,
      clanMembersA,
      clanMembersB,
      randomWordA,
      randomWordB,
      skill
    );
    expect(winner).to.eq(-1);
  });

  it("Different random words should yield different results (many)", async () => {
    const {alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    let clanMembersA = [playerId, playerId];
    let clanMembersB = [playerId, playerId];
    const skill = Skill.FISHING;
    await players.testModifyXP(alice.address, playerId, skill, getXPFromLevel(40), true); // Get 3 rolls each

    let numWinsA = 0;
    let numWinsB = 0;

    for (let i = 0; i < 50; ++i) {
      const randomWordA = i;
      const randomWordB = 1;

      const winner = await clanBattleLibrary.doBattleLib(
        players.address,
        clanMembersA,
        clanMembersB,
        randomWordA,
        randomWordB,
        skill
      );
      if (winner == 1) {
        numWinsA++;
      } else if (winner == -1) {
        numWinsB++;
      }
    }

    expect(numWinsA).to.gt(numWinsB + 10); // By at least 10
  });

  it("Check shuffling of the order is working(many)", async () => {
    const {playerNFT, alice, players, playerId, clanBattleLibrary} = await loadFixture(clanFixture);

    const skill = Skill.FISHING;
    const avatarId = 1;

    // 99, 5, 3, 3
    const clanMembersA = [
      await createPlayer(playerNFT, avatarId, alice, "New name", true),
      await createPlayer(playerNFT, avatarId, alice, "New name1", true),
      await createPlayer(playerNFT, avatarId, alice, "New name2", true),
      await createPlayer(playerNFT, avatarId, alice, "New name3", true),
    ];
    await players.testModifyXP(alice.address, clanMembersA[0], skill, getXPFromLevel(99), true);
    await players.testModifyXP(alice.address, clanMembersA[1], skill, getXPFromLevel(5), true);
    await players.testModifyXP(alice.address, clanMembersA[2], skill, getXPFromLevel(3), true);
    await players.testModifyXP(alice.address, clanMembersA[3], skill, getXPFromLevel(3), true);

    // 6, 6, 4, 2
    const clanMembersB = [
      await createPlayer(playerNFT, avatarId, alice, "New name4", true),
      await createPlayer(playerNFT, avatarId, alice, "New name5", true),
      await createPlayer(playerNFT, avatarId, alice, "New name6", true),
      await createPlayer(playerNFT, avatarId, alice, "New name7", true),
    ];
    await players.testModifyXP(alice.address, clanMembersB[0], skill, getXPFromLevel(6), true);
    await players.testModifyXP(alice.address, clanMembersB[1], skill, getXPFromLevel(6), true);
    await players.testModifyXP(alice.address, clanMembersB[2], skill, getXPFromLevel(4), true);
    await players.testModifyXP(alice.address, clanMembersB[3], skill, getXPFromLevel(2), true);

    // Initial result
    const initialWinner = await clanBattleLibrary.doBattleLib(players.address, clanMembersA, clanMembersB, 1, 1, skill);

    let success = false;
    for (let i = 1; i < 100; ++i) {
      const randomWordA = i;
      const randomWordB = 1;
      const winner = await clanBattleLibrary.doBattleLib(
        players.address,
        clanMembersA,
        clanMembersB,
        randomWordA,
        randomWordB,
        skill
      );

      if (initialWinner != winner) {
        success = true;
        break;
      }
    }

    expect(success).to.eq(true);
  });
});
