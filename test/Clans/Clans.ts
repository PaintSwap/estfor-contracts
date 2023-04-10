import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {createPlayer} from "../../scripts/utils";
import {playersFixture} from "../Players/PlayersFixture";

describe("Clans", function () {
  async function clanFixture() {
    const fixture = await loadFixture(playersFixture);

    const {clans} = fixture;

    // Add basic tier
    await clans.addTiers([
      {
        id: 1,
        maxCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0,
      },
    ]);

    const clanName = "Clan 1";
    return {...fixture, clans, clanName};
  }
  describe("Create a clan", () => {
    it("New clan", async () => {
      const {clans, playerId, alice, clanName, bankFactory} = await loadFixture(clanFixture);

      const tierId = 1;
      const imageId = 2;
      const clanId = 1;
      const tier = await clans.tiers(tierId);

      // Figure out what the address with would
      const newContactAddr = ethers.utils.getContractAddress({
        from: bankFactory.address,
        nonce: clanId,
      });

      await expect(clans.connect(alice).createClan(playerId, clanName, imageId, tierId))
        .to.emit(clans, "ClanCreated")
        .withArgs(clanId, playerId, clanName, imageId, tierId)
        .and.to.emit(bankFactory, "BankContractCreated")
        .withArgs(alice.address, clanId, newContactAddr);

      // Check that the clan is created with the correct values
      const clan = await clans.clans(clanId);
      expect(clan.owner).to.eq(playerId);
      expect(clan.memberCount).to.eq(1);
      expect(clan.imageId).to.eq(imageId);
      expect(clan.tierId).to.eq(tierId);
      expect(tier.maxCapacity).to.eq(3);
      expect(await clans.isClanAdmin(clanId, playerId)).to.eq(true);
      expect(await clans.isClanMember(clanId, playerId)).to.eq(true);
      expect(await clans.hasInviteRequest(clanId, playerId)).to.eq(false);

      const {timestamp} = await ethers.provider.getBlock("latest");
      expect(clan.createdTimestamp).to.eq(timestamp);

      // Check that the player is created with the correct values
      const player = await clans.playerInfo(playerId);
      expect(player.clanId).to.eq(clanId);
      expect(player.requestedClanId).to.eq(0);
    });

    it("Cannot create a clan if already in another", async () => {
      const {clans, playerId, alice, clanName} = await loadFixture(clanFixture);

      const tierId = 1;
      const imageId = 2;
      await clans.connect(alice).createClan(playerId, clanName, imageId, tierId);

      await expect(clans.connect(alice).createClan(playerId, clanName, imageId, tierId)).to.be.revertedWithCustomError(
        clans,
        "AlreadyInClan"
      );
    });

    it("Cannot create a clan with the same name", async () => {
      const {clans, playerId, alice, clanName, playerNFT, avatarId} = await loadFixture(clanFixture);

      const tierId = 1;
      const imageId = 2;
      await clans.connect(alice).createClan(playerId, clanName, imageId, tierId);
      const newPlayerId = createPlayer(
        playerNFT,
        avatarId,
        alice,
        ethers.utils.formatBytes32String("my name ser"),
        true
      );
      await expect(
        clans.connect(alice).createClan(newPlayerId, clanName, imageId, tierId)
      ).to.be.revertedWithCustomError(clans, "NameAlreadyExists");
    });

    it("Allowed to create a clan if there is a pending request elsewhere", async () => {
      const {clans, playerId, alice, owner, clanName, playerNFT, avatarId} = await loadFixture(clanFixture);

      const tierId = 1;
      const imageId = 2;
      const clanId = 1;
      await clans.connect(alice).createClan(playerId, clanName, imageId, tierId);
      const newPlayerId = createPlayer(
        playerNFT,
        avatarId,
        owner,
        ethers.utils.formatBytes32String("my name ser"),
        true
      );
      await expect(clans.connect(alice).requestToJoin(clanId, playerId)).to.be.revertedWithCustomError(
        clans,
        "AlreadyInClan"
      );
      await expect(clans.requestToJoin(clanId + 1, newPlayerId)).to.be.revertedWithCustomError(
        clans,
        "ClanDoesNotExist"
      );
      await clans.requestToJoin(clanId, newPlayerId);
      let newPlayer = await clans.playerInfo(newPlayerId);
      expect(newPlayer.clanId).to.eq(0);
      expect(newPlayer.requestedClanId).to.eq(clanId);

      await clans.createClan(newPlayerId, clanName + "1", imageId, tierId);

      // Check that the player is created with the correct values
      newPlayer = await clans.playerInfo(newPlayerId);
      expect(newPlayer.clanId).to.eq(clanId + 1);
      expect(newPlayer.requestedClanId).to.eq(0);
    });
  });

  describe("Admins", () => {
    it("Must be a member to be promoted to admin", async () => {
      const {clans, playerId, alice, owner, clanName, playerNFT, avatarId} = await loadFixture(clanFixture);

      const tierId = 1;
      const imageId = 2;
      const clanId = 1;
      await clans.connect(alice).createClan(playerId, clanName, imageId, tierId);
      const newPlayerId = createPlayer(
        playerNFT,
        avatarId,
        owner,
        ethers.utils.formatBytes32String("my name ser"),
        true
      );
      await clans.requestToJoin(clanId, newPlayerId);

      await expect(clans.connect(alice).addAdmin(clanId, newPlayerId, playerId)).to.be.revertedWithCustomError(
        clans,
        "NotMemberOfClan"
      );
      await clans.connect(alice).acceptJoinRequest(clanId, newPlayerId, playerId);
      await clans.connect(alice).addAdmin(clanId, newPlayerId, playerId);

      expect(await clans.isClanAdmin(clanId, newPlayerId)).to.be.true;
      expect(await clans.isClanMember(clanId, newPlayerId)).to.be.true;

      const newPlayer = await clans.playerInfo(newPlayerId);
      expect(newPlayer.clanId).to.eq(clanId);
      expect(newPlayer.requestedClanId).to.eq(0);
    });

    it("Only owner can add new admins", async () => {
      const {clans, playerId, alice, owner, bob, clanName, playerNFT, avatarId} = await loadFixture(clanFixture);

      const tierId = 1;
      const imageId = 2;
      const clanId = 1;
      await clans.connect(alice).createClan(playerId, clanName, imageId, tierId);
      const newPlayerId = createPlayer(
        playerNFT,
        avatarId,
        owner,
        ethers.utils.formatBytes32String("my name ser"),
        true
      );
      await clans.requestToJoin(clanId, newPlayerId);

      await expect(clans.connect(alice).addAdmin(clanId, newPlayerId, playerId)).to.be.revertedWithCustomError(
        clans,
        "NotMemberOfClan"
      );
      await clans.connect(alice).acceptJoinRequest(clanId, newPlayerId, playerId);
      await clans.connect(alice).addAdmin(clanId, newPlayerId, playerId);
      await expect(clans.connect(alice).addAdmin(clanId, newPlayerId, playerId)).to.be.revertedWithCustomError(
        clans,
        "PlayerAlreadyAdmin"
      );

      expect(await clans.isClanAdmin(clanId, newPlayerId)).to.be.true;
      expect(await clans.isClanMember(clanId, newPlayerId)).to.be.true;

      const newPlayer = await clans.playerInfo(newPlayerId);
      expect(newPlayer.clanId).to.eq(clanId);
      expect(newPlayer.requestedClanId).to.eq(0);

      const newPlayerId1 = createPlayer(
        playerNFT,
        avatarId,
        bob,
        ethers.utils.formatBytes32String("my name ser123"),
        true
      );

      await clans.connect(bob).requestToJoin(clanId, newPlayerId1);
      await clans.acceptJoinRequest(clanId, newPlayerId1, newPlayerId);
      await expect(clans.addAdmin(clanId, newPlayerId1, newPlayerId)).to.be.revertedWithCustomError(clans, "OnlyOwner");
    });

    it("Only owner can remove admins", async () => {
      const {clans, playerId, alice, owner, clanName, playerNFT, avatarId} = await loadFixture(clanFixture);

      const tierId = 1;
      const imageId = 2;
      const clanId = 1;
      await clans.connect(alice).createClan(playerId, clanName, imageId, tierId);
      const newPlayerId = createPlayer(
        playerNFT,
        avatarId,
        owner,
        ethers.utils.formatBytes32String("my name ser"),
        true
      );
      await clans.requestToJoin(clanId, newPlayerId);
      await clans.connect(alice).acceptJoinRequest(clanId, newPlayerId, playerId);
      await clans.connect(alice).addAdmin(clanId, newPlayerId, playerId);

      await expect(clans.connect(alice).removeAdmin(clanId, playerId)).to.be.revertedWithCustomError(
        clans,
        "CannotBeCalledOnOwner"
      );
      await clans.connect(alice).removeAdmin(clanId, newPlayerId);

      expect(await clans.isClanAdmin(clanId, newPlayerId)).to.be.false;
      expect(await clans.isClanMember(clanId, newPlayerId)).to.be.true;

      const newPlayer = await clans.playerInfo(newPlayerId);
      expect(newPlayer.clanId).to.eq(clanId);
      expect(newPlayer.requestedClanId).to.eq(0);
    });

    it("Only owner or admins can remove a member", async () => {
      const {clans, playerId, alice, owner, bob, charlie, clanName, playerNFT, avatarId} = await loadFixture(
        clanFixture
      );

      const tierId = 1;
      const imageId = 2;
      const clanId = 1;
      await clans.connect(alice).createClan(playerId, clanName, imageId, tierId);
      const newPlayerId = createPlayer(
        playerNFT,
        avatarId,
        owner,
        ethers.utils.formatBytes32String("my name ser"),
        true
      );
      await clans.requestToJoin(clanId, newPlayerId);
      await clans.connect(alice).acceptJoinRequest(clanId, newPlayerId, playerId);
      await clans.connect(alice).addAdmin(clanId, newPlayerId, playerId);

      const bobPlayerId = createPlayer(
        playerNFT,
        avatarId,
        bob,
        ethers.utils.formatBytes32String("my name ser123"),
        true
      );

      await clans.connect(bob).requestToJoin(clanId, bobPlayerId);
      await clans.acceptJoinRequest(clanId, bobPlayerId, newPlayerId);
      expect(await clans.isClanMember(clanId, bobPlayerId)).to.be.true;
      await expect(clans.addAdmin(clanId, bobPlayerId, newPlayerId)).to.be.revertedWithCustomError(clans, "OnlyOwner");
      await clans.connect(alice).addAdmin(clanId, bobPlayerId, playerId);

      // Admin cannot remove admin
      await expect(clans.removeAdmin(clanId, bobPlayerId)).to.be.revertedWithCustomError(clans, "OnlyOwnerOrSelf");

      // Remove self as admin
      await clans.removeAdmin(clanId, newPlayerId);
      expect(await clans.isClanAdmin(clanId, newPlayerId)).to.be.false;
      expect(await clans.isClanMember(clanId, newPlayerId)).to.be.true;

      // No longer an admin so can be kicked
      await clans.connect(bob).kickMember(clanId, newPlayerId, bobPlayerId);

      const newPlayerMemberId = createPlayer(
        playerNFT,
        avatarId,
        charlie,
        ethers.utils.formatBytes32String("my name ser1234"),
        true
      );

      await clans.connect(charlie).requestToJoin(clanId, newPlayerMemberId);
      await clans.connect(bob).acceptJoinRequest(clanId, newPlayerMemberId, bobPlayerId);
      await expect(clans.kickMember(clanId, newPlayerMemberId, newPlayerId)).to.be.revertedWithCustomError(
        clans,
        "OnlyAdminsOrOwnerCanKickMember"
      );

      // Admin can remove a member
      await clans.connect(bob).kickMember(clanId, newPlayerMemberId, bobPlayerId);

      expect(await clans.isClanAdmin(clanId, newPlayerId)).to.be.false;
      expect(await clans.isClanMember(clanId, newPlayerId)).to.be.false;

      const newPlayer = await clans.playerInfo(newPlayerId);
      expect(newPlayer.clanId).to.eq(0);
      expect(newPlayer.requestedClanId).to.eq(0);
    });
  });

  describe("Clan upgrades", () => {
    async function upgradedClansFixture() {
      const fixture = await loadFixture(clanFixture);
      const {clans} = fixture;

      await clans.addTiers([
        {
          id: 2,
          maxCapacity: 10,
          maxImageId: 16,
          price: 10,
          minimumAge: 0,
        },
      ]);

      return {...fixture, clans};
    }

    it("Anyone can upgrade", async function () {
      const {clans} = await loadFixture(upgradedClansFixture);
      // TODO
    });

    it("Pay the difference for incremental upgrades", async function () {
      // TODO
    });
  });
});

// it("Check max capacity of added members", async function () {});

// kick owner, admin and member

// Claim ownership of a clan where the owner has been removed

// Invite and accept invite
