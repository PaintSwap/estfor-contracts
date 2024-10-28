import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {AdminAccess} from "../typechain-types";

describe("AdminAccess", function () {
  async function deployContracts() {
    const [owner, alice, bob] = await ethers.getSigners();
    const AdminAccess = await ethers.getContractFactory("AdminAccess");
    const adminAccess = (await upgrades.deployProxy(AdminAccess, [[], []])) as unknown as AdminAccess;
    return {adminAccess, AdminAccess, owner, alice, bob};
  }

  it("Initialize admins on construction", async () => {
    const {AdminAccess, owner, alice} = await loadFixture(deployContracts);
    const adminAccess = await upgrades.deployProxy(AdminAccess, [[owner.address, alice.address], [alice.address]]);
    expect(await adminAccess.isAdmin(owner)).to.be.true;
    expect(await adminAccess.isAdmin(alice)).to.be.true;

    expect(await adminAccess.isPromotionalAdmin(alice)).to.be.true;
    expect(await adminAccess.isPromotionalAdmin(owner)).to.be.false;
  });

  describe("addPromotionalAdmins", () => {
    it("Add multiple admins", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addPromotionalAdmins([owner, alice]);
      expect(await adminAccess.isPromotionalAdmin(owner)).to.be.true;
      expect(await adminAccess.isPromotionalAdmin(alice)).to.be.true;
      expect(await adminAccess.isAdmin(owner)).to.be.false;
    });

    it("Revert if not called by owner", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await expect(adminAccess.connect(alice).addPromotionalAdmins([owner])).to.be.revertedWithCustomError(
        adminAccess,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("removePromotionalAdmins", () => {
    it("Remove multiple admins", async () => {
      const {adminAccess, owner, alice, bob} = await loadFixture(deployContracts);
      await adminAccess.addPromotionalAdmins([owner, alice, bob]);
      await adminAccess.removePromotionalAdmins([owner, bob]);
    });

    it("Revert if not called by owner", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addPromotionalAdmins([owner, alice]);
      await expect(adminAccess.connect(alice).addPromotionalAdmins([owner])).to.be.revertedWithCustomError(
        adminAccess,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("addAdmins", () => {
    it("Add multiple admins", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmins([owner, alice]);
      expect(await adminAccess.isAdmin(owner)).to.be.true;
      expect(await adminAccess.isAdmin(alice)).to.be.true;
      expect(await adminAccess.isAdmin(adminAccess)).to.be.false;
    });

    it("Revert if not called by owner", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await expect(adminAccess.connect(alice).addAdmins([owner])).to.be.revertedWithCustomError(
        adminAccess,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("addAdmins", () => {
    it("Add an admin", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmins([owner]);
      expect(await adminAccess.isAdmin(owner)).to.be.true;
      expect(await adminAccess.isAdmin(alice)).to.be.false;
    });

    it("Revert if not called by owner", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await expect(adminAccess.connect(alice).addAdmins([owner])).to.be.revertedWithCustomError(
        adminAccess,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("removeAdmin", () => {
    it("Remove an admin", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmins([owner, alice]);
      await adminAccess.removeAdmins([owner]);
      expect(await adminAccess.isAdmin(alice)).to.be.true;
      expect(await adminAccess.isAdmin(owner)).to.be.false;
    });

    it("Revert if not called by owner", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmins([owner, alice]);
      await expect(adminAccess.connect(alice).removeAdmins([owner])).to.be.revertedWithCustomError(
        adminAccess,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("isAdmin", () => {
    it("Return true for an admin", async () => {
      const {adminAccess, owner} = await loadFixture(deployContracts);
      await adminAccess.addAdmins([owner]);
      expect(await adminAccess.isAdmin(owner)).to.be.true;
    });

    it("Return false for a non-admin", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmins([owner]);
      expect(await adminAccess.isAdmin(alice)).to.be.false;
    });
  });
});
