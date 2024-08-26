import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {clanFixture} from "./utils";
import {expect} from "chai";

describe("LockedBankVaultsLibrary", function () {
  describe("getNewMMRs", function () {
    it("Simple", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);
      const Ka = 32;
      const Kd = 32;
      const [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 500, 500, true);
      expect(newAttackingMMR).to.equal(516);
      expect(newDefendingMMR).to.equal(484);
    });

    it("Extremes (0 and 65535)", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const Ka = 32;
      const Kd = 32;
      let [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1, 1, false);
      expect(newAttackingMMR).to.equal(0);
      expect(newDefendingMMR).to.equal(17);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1, 1, true);
      expect(newAttackingMMR).to.equal(17);
      expect(newDefendingMMR).to.equal(0);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 0, 1, true);
      expect(newAttackingMMR).to.equal(16);
      expect(newDefendingMMR).to.equal(0);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 0, 0, true);
      expect(newAttackingMMR).to.equal(16);
      expect(newDefendingMMR).to.equal(0);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 0, 0, false);
      expect(newAttackingMMR).to.equal(0);
      expect(newDefendingMMR).to.equal(16);

      // Max 65535, just check you can get close to it
      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 65000, 65000, true);
      expect(newAttackingMMR).to.equal(65016);
      expect(newDefendingMMR).to.equal(64984);
    });

    it("Various checks", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);
      const Ka = 32;
      const Kd = 32;
      let [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 600, 500, true);
      expect(newAttackingMMR).to.equal(611);
      expect(newDefendingMMR).to.equal(489);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 600, 500, false);
      expect(newAttackingMMR).to.equal(580);
      expect(newDefendingMMR).to.equal(520);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1200, 500, true);
      expect(newAttackingMMR).to.equal(1200);
      expect(newDefendingMMR).to.equal(500);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1200, 500, false);
      expect(newAttackingMMR).to.equal(1169);
      expect(newDefendingMMR).to.equal(531);

      // 800 difference is the max
      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1300, 500, true);
      expect(newAttackingMMR).to.equal(1300);
      expect(newDefendingMMR).to.equal(500);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1300, 500, false);
      expect(newAttackingMMR).to.equal(1269);
      expect(newDefendingMMR).to.equal(531);

      // Exceeding 800 difference just makes it the same as if it was 800
      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1500, 500, true);
      expect(newAttackingMMR).to.equal(1500);
      expect(newDefendingMMR).to.equal(500);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1500, 500, false);
      expect(newAttackingMMR).to.equal(1469);
      expect(newDefendingMMR).to.equal(531);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1000, 1500, true);
      expect(newAttackingMMR).to.equal(1030);
      expect(newDefendingMMR).to.equal(1470);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 1000, 1500, false);
      expect(newAttackingMMR).to.equal(999);
      expect(newDefendingMMR).to.equal(1501);
    });

    it("Small K values", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);
      const Ka = 3;
      const Kd = 3;
      let [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 500, 498, true);
      expect(newAttackingMMR).to.equal(501);
      expect(newDefendingMMR).to.equal(497);

      [newAttackingMMR, newDefendingMMR] = await lockedBankVaultsLibrary.getNewMMRs(Ka, Kd, 500, 498, false);
      expect(newAttackingMMR).to.equal(499);
      expect(newDefendingMMR).to.equal(499);
    });
  });

  describe("isWithinRange", function () {
    it("Should return true when defending clan is within range", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);
      const sortedClanIds = [0, 1, 2, 3, 4, 5];
      const sortedClansByMMR = [1000, 1100, 1200, 1300, 1400, 1500];
      const clanId = 2; // MMR 1200
      const defendingClanId = 4; // MMR 1400
      const mmrAttackDistance = 2;

      const result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;
    });

    it("Should return false when defending clan is out of range", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const sortedClanIds = [0, 1, 2, 3, 4, 5];
      const sortedClansByMMR = [1000, 1100, 1200, 1300, 1400, 1500];
      const clanId = 2; // MMR 1200
      const defendingClanId = 5; // MMR 1500
      const mmrAttackDistance = 2;

      const result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;
    });

    it("Should handle edge case at the beginning of the array", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const sortedClanIds = [0, 1, 2, 3, 4, 5];
      const sortedClansByMMR = [1000, 1100, 1200, 1300, 1400, 1500];
      const clanId = 0; // MMR 1000
      const defendingClanId = 2; // MMR 1200
      const mmrAttackDistance = 1;

      const result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;
    });

    it("Should handle edge case at the end of the array", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const sortedClanIds = [0, 1, 2, 3, 4, 5];
      const sortedClansByMMR = [1000, 1100, 1200, 1300, 1400, 1500];
      const clanId = 5; // MMR 1500
      const defendingClanId = 3; // MMR 1300
      const mmrAttackDistance = 1;

      const result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;
    });

    it("Should include clans with same MMR at the edge of the range", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const sortedClanIds = [0, 1, 2, 3, 4, 5];
      const sortedClansByMMR = [1000, 1100, 1200, 1300, 1300, 1400, 1500];
      const clanId = 2; // MMR 1200
      const defendingClanId = 4; // MMR 1300 (second occurrence)
      const mmrAttackDistance = 1;

      const result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;
    });

    it("Should include clans with same MMR at the edge of the range (multiple)", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const sortedClanIds = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      const sortedClansByMMR = [1000, 1100, 1200, 1300, 1300, 1300, 1300, 1400, 1500];
      const clanId = 2; // MMR 1200
      const defendingClanId = 6; // MMR 1300 (second occurrence)
      const mmrAttackDistance = 1;

      let result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId + 1,
        mmrAttackDistance
      );
      expect(result).to.be.false;
    });

    it("Should include clans with same MMR at the edge of the range (reverse direction)", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const sortedClanIds = [0, 1, 2, 3, 4, 5];
      const sortedClansByMMR = [1000, 1100, 1200, 1200, 1300, 1400, 1500];
      const clanId = 4; // MMR 1300
      const defendingClanId = 2; // MMR 1200 (first occurrence)
      const mmrAttackDistance = 1;

      const result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;
    });

    it("Should exclude clans with different MMR just outside the range", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const sortedClanIds = [0, 1, 2, 3, 4, 5];
      const sortedClansByMMR = [1000, 1100, 1200, 1300, 1400, 1500];
      const clanId = 2; // MMR 1200
      const defendingClanId = 4; // MMR 1400
      const mmrAttackDistance = 1;

      const result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;
    });

    it("Should include clans with same MMR at the beginning of the range", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const sortedClanIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const sortedClansByMMR = [500, 500, 500, 600, 700, 800, 800, 900, 1000, 1000];
      let clanId = 0; // MMR 500
      let defendingClanId = 3; // MMR 600
      const mmrAttackDistance = 1;
      let result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      clanId = 1;
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      clanId = 2;
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      ++defendingClanId;
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;

      clanId = 5; // first 800 MMR
      defendingClanId = 6; // second 800 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      defendingClanId = 7; // 900 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      defendingClanId = 8; // First 1000 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;

      clanId = 6; // second 800 MMR
      defendingClanId = 5; // first 800 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      defendingClanId = 4; // 700 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      defendingClanId = 3; // 600 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;

      clanId = 9; // second 1000 MMR
      defendingClanId = 8; // first 1000 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      defendingClanId = 7; // 900 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      defendingClanId = 6; // 800 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;

      clanId = 8; // first 1000 MMR
      defendingClanId = 9; // second 1000 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      defendingClanId = 7; // 900 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      defendingClanId = 6; // 800 MMR
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;
    });

    it("Should include clans with same MMR at the beginning of the range, extremes", async function () {
      const {lockedBankVaultsLibrary} = await loadFixture(clanFixture);

      const sortedClanIds = [0, 1, 2, 3, 4, 5, 6];
      const sortedClansByMMR = [400, 500, 500, 500, 500, 500, 600];
      let clanId = 1; // first MMR 500
      let defendingClanId = 5; // MMR 600

      const mmrAttackDistance = 3;
      let result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      clanId = 5; // last MMR 500
      defendingClanId = 0; // MMR 400
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;

      clanId = 6; // MMR 600
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.false;

      defendingClanId = 1; // first MMR 500
      result = await lockedBankVaultsLibrary.isWithinRange(
        sortedClanIds,
        sortedClansByMMR,
        clanId,
        defendingClanId,
        mmrAttackDistance
      );
      expect(result).to.be.true;
    });
  });
});
