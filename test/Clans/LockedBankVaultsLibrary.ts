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
});
