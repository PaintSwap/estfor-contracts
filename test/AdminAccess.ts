import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

describe("AdminAccess", function () {
  async function deployContracts() {
    const [owner, alice] = await ethers.getSigners();
    const AdminAccess = await ethers.getContractFactory("AdminAccess");
    const adminAccess = await upgrades.deployProxy(AdminAccess, [[]]);
    return {adminAccess, AdminAccess, owner, alice};
  }

  it("Initialize admins on construction", async () => {
    const {AdminAccess, owner, alice} = await loadFixture(deployContracts);
    const adminAccess = await upgrades.deployProxy(AdminAccess, [[owner.address, alice.address]]);
    expect(await adminAccess.isAdmin(owner.address)).to.be.true;
    expect(await adminAccess.isAdmin(alice.address)).to.be.true;
  });

  describe("addAdmins", () => {
    it("Add multiple admins", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmins([owner.address, alice.address]);
      expect(await adminAccess.isAdmin(owner.address)).to.be.true;
      expect(await adminAccess.isAdmin(alice.address)).to.be.true;
      expect(await adminAccess.isAdmin(adminAccess.address)).to.be.false;
    });

    it("Revert if not called by owner", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await expect(adminAccess.connect(alice).addAdmins([owner.address])).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("addAdmin", () => {
    it("Add an admin", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmin(owner.address);
      expect(await adminAccess.isAdmin(owner.address)).to.be.true;
      expect(await adminAccess.isAdmin(alice.address)).to.be.false;
    });

    it("Revert if not called by owner", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await expect(adminAccess.connect(alice).addAdmin(owner.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("removeAdmin", () => {
    it("Remove an admin", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmins([owner.address, alice.address]);
      await adminAccess.removeAdmin(owner.address);
      expect(await adminAccess.isAdmin(alice.address)).to.be.true;
      expect(await adminAccess.isAdmin(owner.address)).to.be.false;
    });

    it("Revert if not called by owner", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmins([owner.address, alice.address]);
      await expect(adminAccess.connect(alice).removeAdmin(owner.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("isAdmin", () => {
    it("Return true for an admin", async () => {
      const {adminAccess, owner} = await loadFixture(deployContracts);
      await adminAccess.addAdmin(owner.address);
      expect(await adminAccess.isAdmin(owner.address)).to.be.true;
    });

    it("Return false for a non-admin", async () => {
      const {adminAccess, owner, alice} = await loadFixture(deployContracts);
      await adminAccess.addAdmin(owner.address);
      expect(await adminAccess.isAdmin(alice.address)).to.be.false;
    });
  });
});
