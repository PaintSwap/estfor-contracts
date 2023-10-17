import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ClanRank} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {ethers} from "hardhat";
import {Tier} from "../../scripts/data/clans";
import {createPlayer} from "../../scripts/utils";
import {playersFixture} from "../Players/PlayersFixture";

describe("Clans", function () {
  async function clanFixture() {
    const fixture = await loadFixture(playersFixture);
    const {clans, playerId, alice, bankFactory} = fixture;

    // Add basic tier
    await clans.addTiers([
      {
        id: 1,
        maxMemberCapacity: 3,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0,
      },
    ]);

    const clanName = "Clan 1";

    const tierId = 1;
    const imageId = 2;
    const clanId = 1;
    const tier = await clans.tiers(tierId);
    const discord = "G4ZgtP52JK";
    const telegram = "fantomfoundation";

    // Figure out what the address would be
    const newContactAddr = ethers.utils.getContractAddress({
      from: bankFactory.address,
      nonce: clanId,
    });

    await expect(clans.connect(alice).createClan(playerId, clanName, discord, telegram, imageId, tierId))
      .to.emit(clans, "ClanCreated")
      .withArgs(clanId, playerId, [clanName, discord, telegram], imageId, tierId)
      .and.to.emit(bankFactory, "BankContractCreated")
      .withArgs(alice.address, clanId, newContactAddr);

    const editNameCost = await clans.editNameCost();
    return {...fixture, clans, clanName, discord, telegram, tierId, imageId, clanId, tier, editNameCost};
  }
  describe("Create a clan", () => {
    it("New clan", async () => {
      const {clans, playerId, clanId, imageId, tierId, tier, clanName} = await loadFixture(clanFixture);

      // Check that the clan is created with the correct values
      const clan = await clans.clans(clanId);
      expect(clan.owner).to.eq(playerId);
      expect(clan.memberCount).to.eq(1);
      expect(clan.imageId).to.eq(imageId);
      expect(clan.tierId).to.eq(tierId);
      expect(clan.name).to.eq(clanName);
      expect(tier.maxMemberCapacity).to.eq(3);
      expect(tier.maxBankCapacity).to.eq(3);
      expect(await clans.canWithdraw(clanId, playerId)).to.be.true;
      expect(await clans.isClanMember(clanId, playerId)).to.be.true;
      expect(await clans.hasInviteRequest(clanId, playerId)).to.eq(false);

      const {timestamp} = await ethers.provider.getBlock("latest");
      expect(clan.createdTimestamp).to.eq(timestamp);

      // Check that the player is created with the correct values
      const player = await clans.playerInfo(playerId);
      expect(player.clanId).to.eq(clanId);
      expect(player.requestedClanId).to.eq(0);
    });

    it("Cannot create a clan if already in another", async () => {
      const {clans, playerId, alice, imageId, tierId, clanName, discord, telegram} = await loadFixture(clanFixture);

      await expect(
        clans.connect(alice).createClan(playerId, clanName, discord, telegram, imageId, tierId)
      ).to.be.revertedWithCustomError(clans, "AlreadyInClan");
    });

    it("Cannot create a clan with the same name", async () => {
      const {clans, bob, playerNFT, avatarId, imageId, tierId, clanName, discord, telegram} = await loadFixture(
        clanFixture
      );
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      await expect(
        clans.connect(bob).createClan(bobPlayerId, clanName, discord, telegram, imageId, tierId)
      ).to.be.revertedWithCustomError(clans, "NameAlreadyExists");
    });

    it("Cannot create a clan, with invalid name (empty or > 20 chars)", async () => {
      // Also check that whitespace is trimmed
      const {clans, bob, playerNFT, avatarId, imageId, tierId, discord, telegram} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      const name = " uhh$£";
      await expect(
        clans.connect(bob).createClan(bobPlayerId, name, discord, telegram, imageId, tierId)
      ).to.be.revertedWithCustomError(clans, "NameInvalidCharacters");
    });

    it("Cannot create a clan, with invalid social media handles", async () => {
      const {clans, bob, playerNFT, avatarId, imageId, tierId, discord, telegram} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      const anotherName = "Another name";
      let discordInvalid = "uhh$£";
      await expect(
        clans.connect(bob).createClan(bobPlayerId, anotherName, discordInvalid, telegram, imageId, tierId)
      ).to.be.revertedWithCustomError(clans, "DiscordInvalidCharacters");
      discordInvalid = "12";
      await expect(
        clans.connect(bob).createClan(bobPlayerId, anotherName, discordInvalid, telegram, imageId, tierId)
      ).to.be.revertedWithCustomError(clans, "DiscordTooShort");

      discordInvalid = "01234567890123456789012345";
      await expect(
        clans.connect(bob).createClan(bobPlayerId, anotherName, discordInvalid, telegram, imageId, tierId)
      ).to.be.revertedWithCustomError(clans, "DiscordTooLong");

      let telegramInvalid = "uhh$£";
      await expect(
        clans.connect(bob).createClan(bobPlayerId, anotherName, discord, telegramInvalid, imageId, tierId)
      ).to.be.revertedWithCustomError(clans, "TelegramInvalidCharacters");

      telegramInvalid = "01234567890123456789012345";
      await expect(
        clans.connect(bob).createClan(bobPlayerId, anotherName, discord, telegramInvalid, imageId, tierId)
      ).to.be.revertedWithCustomError(clans, "TelegramTooLong");
    });

    it("Allowed to create a clan with empty discord", async () => {
      const {clans, bob, playerNFT, avatarId, imageId, tierId, telegram} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      const anotherName = "Another name";
      const emptyHandle = "";
      await expect(clans.connect(bob).createClan(bobPlayerId, anotherName, emptyHandle, telegram, imageId, tierId)).to
        .not.be.reverted;
    });

    it("Allowed to create a clan with empty telegram", async () => {
      const {clans, bob, playerNFT, avatarId, imageId, tierId, discord} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      const anotherName = "Another name";
      const emptyHandle = "";
      await expect(clans.connect(bob).createClan(bobPlayerId, anotherName, discord, emptyHandle, imageId, tierId)).to
        .not.be.reverted;
    });

    it("Allowed to create a clan if there is a pending request elsewhere", async () => {
      const {clans, alice, bob, clanId, clanName, discord, telegram, playerNFT, avatarId, playerId, tierId, imageId} =
        await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      await expect(clans.connect(alice).requestToJoin(clanId, playerId)).to.be.revertedWithCustomError(
        clans,
        "AlreadyInClan"
      );
      await expect(clans.connect(bob).requestToJoin(clanId + 1, bobPlayerId)).to.be.revertedWithCustomError(
        clans,
        "ClanDoesNotExist"
      );
      await clans.connect(bob).requestToJoin(clanId, bobPlayerId);
      let newPlayer = await clans.playerInfo(bobPlayerId);
      expect(newPlayer.clanId).to.eq(0);
      expect(newPlayer.requestedClanId).to.eq(clanId);

      await expect(clans.connect(bob).createClan(bobPlayerId, clanName + "1", discord, telegram, imageId, tierId))
        .to.emit(clans, "JoinRequestRemoved")
        .withArgs(clanId, bobPlayerId);

      // Check that the player is created with the correct values
      newPlayer = await clans.playerInfo(bobPlayerId);
      expect(newPlayer.clanId).to.eq(clanId + 1);
      expect(newPlayer.requestedClanId).to.eq(0);
    });
  });

  describe("Invites", () => {
    it("Invite a player to a clan", async () => {
      const {clans, playerId, alice, bob, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);

      await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId);
      expect(await clans.hasInviteRequest(clanId, bobPlayerId)).to.be.true;
      expect(await clans.hasInviteRequest(clanId, playerId)).to.be.false; // sanity check
      await expect(clans.acceptInvite(clanId, bobPlayerId)).to.be.revertedWithCustomError(
        clans,
        "NotOwnerOfPlayerAndActive"
      );
      await clans.connect(bob).acceptInvite(clanId, bobPlayerId);

      expect(await clans.canWithdraw(clanId, bobPlayerId)).to.be.false;
      expect(await clans.isClanMember(clanId, bobPlayerId)).to.be.true;

      const newPlayer = await clans.playerInfo(bobPlayerId);
      expect(newPlayer.clanId).to.eq(clanId);
      expect(newPlayer.requestedClanId).to.eq(0);
    });

    it("Invite muliple players to a clan", async () => {
      const {clans, playerId, alice, bob, charlie, dev, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);
      const devPlayerId = await createPlayer(playerNFT, avatarId, dev, "dev", true);

      await expect(
        clans.connect(alice).inviteMembers(clanId, [bobPlayerId, charliePlayerId, devPlayerId], playerId)
      ).to.be.revertedWithCustomError(clans, "ClanIsFull");
      await clans.connect(alice).inviteMembers(clanId, [bobPlayerId, charliePlayerId], playerId);
      expect(await clans.hasInviteRequest(clanId, bobPlayerId)).to.be.true;
      expect(await clans.hasInviteRequest(clanId, charliePlayerId)).to.be.true;
      expect(await clans.hasInviteRequest(clanId, playerId)).to.be.false; // sanity check
      expect(await clans.hasInviteRequest(clanId, devPlayerId)).to.be.false; // sanity check
    });

    it("Cannot accept an invite that does not exist", async () => {
      const {clans, bob, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);

      await expect(clans.connect(bob).acceptInvite(clanId, bobPlayerId)).to.be.revertedWithCustomError(
        clans,
        "InviteDoesNotExist"
      );
    });

    it("Cannot invite a player to a clan if you are not at least a scout", async () => {
      const {clans, playerId, alice, bob, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);

      await clans.connect(alice).changeRank(clanId, playerId, ClanRank.COMMONER, playerId);
      const player = await clans.playerInfo(playerId);
      expect(player.rank).to.eq(ClanRank.COMMONER);
      await expect(clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId)).to.be.revertedWithCustomError(
        clans,
        "RankNotHighEnough"
      );
    });

    it("Cannot accept an invite if you are already in a clan", async () => {
      const {clans, playerId, alice, bob, clanId, playerNFT, avatarId, discord, telegram, imageId} = await loadFixture(
        clanFixture
      );
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      await clans.connect(bob).createClan(bobPlayerId, "bob", discord, telegram, imageId, 1);
      await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId);
      await expect(clans.connect(bob).acceptInvite(clanId, bobPlayerId)).to.be.revertedWithCustomError(
        clans,
        "AlreadyInClan"
      );
    });

    it("Delete invites as a player", async () => {
      const {clans, playerId, alice, bob, charlie, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);

      await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId);
      await clans.connect(bob).acceptInvite(clanId, bobPlayerId);

      await expect(clans.connect(bob).deleteInvitesAsPlayer([clanId], bobPlayerId)).to.be.revertedWithCustomError(
        clans,
        "InviteDoesNotExist"
      );

      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);
      await clans.connect(alice).inviteMember(clanId, charliePlayerId, playerId);

      // Not the owner of the invite
      await expect(clans.deleteInvitesAsPlayer([clanId], charliePlayerId)).to.be.revertedWithCustomError(
        clans,
        "NotOwnerOfPlayer"
      );

      await expect(clans.connect(charlie).deleteInvitesAsPlayer([clanId], charliePlayerId))
        .to.emit(clans, "InvitesDeletedByPlayer")
        .withArgs([clanId], charliePlayerId);
      expect(await clans.hasInviteRequest(clanId, charliePlayerId)).to.be.false;
    });

    it("Delete invites as a clan", async () => {
      const {clans, playerId, alice, bob, charlie, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);

      await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId);
      await clans.connect(bob).acceptInvite(clanId, bobPlayerId);
      expect(await clans.hasInviteRequest(clanId, bobPlayerId)).to.be.false;

      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);
      await clans.connect(alice).inviteMember(clanId, charliePlayerId, playerId);

      await expect(
        clans.connect(charlie).deleteInvitesAsClan(clanId, [charliePlayerId], charliePlayerId)
      ).to.be.revertedWithCustomError(clans, "NotMemberOfClan");

      // Not a scout
      await expect(
        clans.connect(bob).deleteInvitesAsClan(clanId, [charliePlayerId], bobPlayerId)
      ).to.be.revertedWithCustomError(clans, "RankNotHighEnough");

      await clans.connect(alice).changeRank(clanId, bobPlayerId, ClanRank.SCOUT, playerId);
      await expect(clans.connect(bob).deleteInvitesAsClan(clanId, [charliePlayerId], bobPlayerId))
        .to.emit(clans, "InvitesDeletedByClan")
        .withArgs(clanId, [charliePlayerId], bobPlayerId);
      expect(await clans.hasInviteRequest(clanId, charliePlayerId)).to.be.false;
    });
  });

  describe("Join requests", () => {
    it("Accept multiple join requests", async () => {
      const {clans, playerId, alice, bob, charlie, dev, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      await clans.connect(bob).requestToJoin(clanId, bobPlayerId);

      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);
      await clans.connect(charlie).requestToJoin(clanId, charliePlayerId);

      const devPlayerId = await createPlayer(playerNFT, avatarId, dev, "dev", true);
      await clans.connect(dev).requestToJoin(clanId, devPlayerId);

      await expect(
        clans.connect(alice).acceptJoinRequests(clanId, [bobPlayerId, charliePlayerId, devPlayerId], playerId)
      ).to.be.revertedWithCustomError(clans, "ClanIsFull");

      await expect(
        clans.acceptJoinRequests(clanId, [bobPlayerId, charliePlayerId, devPlayerId], playerId)
      ).to.be.revertedWithCustomError(clans, "NotOwnerOfPlayerAndActive");

      await clans.connect(alice).acceptJoinRequests(clanId, [bobPlayerId, charliePlayerId], playerId);
      expect(await clans.isClanMember(clanId, bobPlayerId)).to.be.true;
      expect(await clans.isClanMember(clanId, charliePlayerId)).to.be.true;
      expect(await clans.isClanMember(clanId, devPlayerId)).to.be.false;
    });

    it("Remove join request as player", async () => {
      const {clans, bob, charlie, dev, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      await clans.connect(bob).requestToJoin(clanId, bobPlayerId);

      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);
      await clans.connect(charlie).requestToJoin(clanId, charliePlayerId);

      let playerInfo = await clans.playerInfo(bobPlayerId);
      expect(playerInfo.requestedClanId).to.eq(clanId);
      await clans.connect(bob).removeJoinRequest(clanId, bobPlayerId);
      playerInfo = await clans.playerInfo(bobPlayerId);
      expect(playerInfo.requestedClanId).to.eq(0);
      // Charlie should be unchanged
      playerInfo = await clans.playerInfo(charliePlayerId);
      expect(playerInfo.requestedClanId).to.eq(clanId);
    });

    it("Remove join requests as clan", async () => {
      const {clans, playerId, alice, bob, charlie, dev, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      await clans.connect(bob).requestToJoin(clanId, bobPlayerId);

      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);
      await clans.connect(charlie).requestToJoin(clanId, charliePlayerId);

      const devPlayerId = await createPlayer(playerNFT, avatarId, dev, "dev", true);
      await clans.connect(dev).requestToJoin(clanId, devPlayerId);

      expect((await clans.playerInfo(bobPlayerId)).requestedClanId).to.eq(clanId);
      expect((await clans.playerInfo(charliePlayerId)).requestedClanId).to.eq(clanId);
      expect((await clans.playerInfo(devPlayerId)).requestedClanId).to.eq(clanId);

      // Trying to remove duplicate
      await expect(
        clans.connect(alice).removeJoinRequestsAsClan(clanId, [charliePlayerId, charliePlayerId], playerId)
      ).to.be.revertedWithCustomError(clans, "NoJoinRequest");

      // Do not have permission to remove join requests if you don't own this player
      await expect(clans.removeJoinRequestsAsClan(clanId, [charliePlayerId], playerId)).to.be.revertedWithCustomError(
        clans,
        "NotOwnerOfPlayer"
      );

      await clans.connect(alice).removeJoinRequestsAsClan(clanId, [devPlayerId, charliePlayerId], playerId);

      // Must be at least a scout
      await clans.connect(alice).changeRank(clanId, playerId, ClanRank.COMMONER, playerId);
      await expect(
        clans.connect(alice).removeJoinRequestsAsClan(clanId, [bobPlayerId], playerId)
      ).to.be.revertedWithCustomError(clans, "RankNotHighEnough");

      let playerInfo = await clans.playerInfo(bobPlayerId);
      expect(playerInfo.requestedClanId).to.eq(clanId); // bob should be unchanged
      playerInfo = await clans.playerInfo(charliePlayerId);
      expect(playerInfo.requestedClanId).to.eq(0);
      playerInfo = await clans.playerInfo(devPlayerId);
      expect(playerInfo.requestedClanId).to.eq(0);
    });

    it("Disable join requests to clan", async () => {
      const {clans, playerId, alice, bob, charlie, dev, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      await clans.connect(bob).requestToJoin(clanId, bobPlayerId); // By default join requests are enabled

      await expect(clans.setJoinRequestsEnabled(clanId, false, playerId)).to.be.revertedWithCustomError(
        clans,
        "NotOwnerOfPlayer"
      );

      await clans.connect(alice).setJoinRequestsEnabled(clanId, false, playerId);

      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);
      await expect(clans.connect(charlie).requestToJoin(clanId, charliePlayerId)).to.be.revertedWithCustomError(
        clans,
        "JoinRequestsDisabled"
      );

      // Must be at least a scout
      await clans.connect(alice).changeRank(clanId, playerId, ClanRank.COMMONER, playerId);
      await expect(clans.connect(alice).setJoinRequestsEnabled(clanId, false, playerId)).to.be.revertedWithCustomError(
        clans,
        "RankNotHighEnough"
      );

      await expect(clans.setJoinRequestsEnabled(clanId, false, playerId)).to.be.revertedWithCustomError(
        clans,
        "NotOwnerOfPlayer"
      );
    });
  });

  describe("Treasurers", () => {
    it("Must be a member to be promoted to admin", async () => {
      const {clans, playerId, alice, bob, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      await clans.connect(bob).requestToJoin(clanId, bobPlayerId);

      await expect(
        clans.connect(alice).changeRank(clanId, bobPlayerId, ClanRank.TREASURER, playerId)
      ).to.be.revertedWithCustomError(clans, "NotMemberOfClan");
      await clans.connect(alice).acceptJoinRequest(clanId, bobPlayerId, playerId);
      await clans.connect(alice).changeRank(clanId, bobPlayerId, ClanRank.TREASURER, playerId);

      expect(await clans.canWithdraw(clanId, bobPlayerId)).to.be.true;
      expect(await clans.isClanMember(clanId, bobPlayerId)).to.be.true;

      const newPlayer = await clans.playerInfo(bobPlayerId);
      expect(newPlayer.clanId).to.eq(clanId);
      expect(newPlayer.requestedClanId).to.eq(0);
    });

    it("Only owner can add new treasurers", async () => {
      const {clans, playerId, alice, bob, charlie, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);

      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      await clans.connect(bob).requestToJoin(clanId, bobPlayerId);

      await expect(
        clans.connect(alice).changeRank(clanId, bobPlayerId, ClanRank.TREASURER, playerId)
      ).to.be.revertedWithCustomError(clans, "NotMemberOfClan");
      await clans.connect(alice).acceptJoinRequest(clanId, bobPlayerId, playerId);
      await clans.connect(alice).changeRank(clanId, bobPlayerId, ClanRank.TREASURER, playerId);
      await expect(
        clans.connect(alice).changeRank(clanId, bobPlayerId, ClanRank.TREASURER, playerId)
      ).to.be.revertedWithCustomError(clans, "CannotSetSameRank");

      expect(await clans.canWithdraw(clanId, bobPlayerId)).to.be.true;
      expect(await clans.isClanMember(clanId, bobPlayerId)).to.be.true;

      const newPlayer = await clans.playerInfo(bobPlayerId);
      expect(newPlayer.clanId).to.eq(clanId);
      expect(newPlayer.requestedClanId).to.eq(0);

      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);

      await clans.connect(charlie).requestToJoin(clanId, charliePlayerId);
      await clans.connect(bob).acceptJoinRequest(clanId, charliePlayerId, bobPlayerId);
      await expect(
        clans.changeRank(clanId, charliePlayerId, ClanRank.TREASURER, charliePlayerId)
      ).to.be.revertedWithCustomError(clans, "NotOwnerOfPlayer");
    });

    it("Scouts and above can changes members below them in rank", async () => {
      const {clans, playerId, alice, bob, charlie, dev, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);

      const devPlayerId = await createPlayer(playerNFT, avatarId, dev, "dev", true);
      await clans.connect(dev).requestToJoin(clanId, devPlayerId);
      await clans.connect(alice).acceptJoinRequest(clanId, devPlayerId, playerId);
      await clans.connect(alice).changeRank(clanId, devPlayerId, ClanRank.SCOUT, playerId);

      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);

      await clans.connect(bob).requestToJoin(clanId, bobPlayerId);
      await clans.connect(dev).acceptJoinRequest(clanId, bobPlayerId, devPlayerId);
      expect(await clans.isClanMember(clanId, bobPlayerId)).to.be.true;
      await expect(clans.changeRank(clanId, bobPlayerId, ClanRank.SCOUT, playerId)).to.be.revertedWithCustomError(
        clans,
        "NotOwnerOfPlayer"
      );
      await clans.connect(alice).changeRank(clanId, bobPlayerId, ClanRank.SCOUT, playerId);

      // Cannot change rank of someone of the same rank
      await expect(
        clans.connect(dev).changeRank(clanId, bobPlayerId, ClanRank.SCOUT, devPlayerId)
      ).to.be.revertedWithCustomError(clans, "ChangingRankEqualOrHigherThanSelf");

      // Remove self as scout to commoner
      await clans.connect(dev).changeRank(clanId, devPlayerId, ClanRank.COMMONER, devPlayerId);
      expect(await clans.canWithdraw(clanId, devPlayerId)).to.be.false;
      expect(await clans.isClanMember(clanId, devPlayerId)).to.be.true;

      // Kick this user from the clan
      await clans.connect(bob).changeRank(clanId, devPlayerId, ClanRank.NONE, bobPlayerId);

      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);

      await clans.connect(charlie).requestToJoin(clanId, charliePlayerId);
      await clans.connect(bob).acceptJoinRequest(clanId, charliePlayerId, bobPlayerId);
      await expect(
        clans.connect(dev).changeRank(clanId, charliePlayerId, ClanRank.NONE, devPlayerId)
      ).to.be.revertedWithCustomError(clans, "ChangingRankEqualOrHigherThanSelf");

      // Scout can remove a member
      await clans.connect(bob).changeRank(clanId, charliePlayerId, ClanRank.NONE, bobPlayerId);

      expect(await clans.canWithdraw(clanId, devPlayerId)).to.be.false;
      expect(await clans.isClanMember(clanId, devPlayerId)).to.be.false;

      const newPlayer = await clans.playerInfo(devPlayerId);
      expect(newPlayer.clanId).to.eq(0);
      expect(newPlayer.requestedClanId).to.eq(0);
    });
  });

  it("Check max capacity of added members", async function () {
    const {clans, playerId, alice, owner, bob, charlie, clanId, tierId, playerNFT, avatarId} = await loadFixture(
      clanFixture
    );
    const maxMemberCapacity = (await clans.tiers(tierId)).maxMemberCapacity;

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
    await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId); // Invite now as it won't be possible later when full

    for (let i = 0; i < maxMemberCapacity - 1; ++i) {
      const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie" + i, true);
      await clans.connect(alice).inviteMember(clanId, charliePlayerId, playerId);
      await clans.connect(charlie).acceptInvite(clanId, charliePlayerId);
    }

    // Should be max capacity
    await expect(clans.connect(bob).acceptInvite(clanId, bobPlayerId)).to.be.revertedWithCustomError(
      clans,
      "ClanIsFull"
    );
    const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "unique name1", true);
    await expect(clans.connect(alice).inviteMember(clanId, newPlayerId, playerId)).to.be.revertedWithCustomError(
      clans,
      "ClanIsFull"
    );

    await clans.connect(bob).requestToJoin(clanId, bobPlayerId);
    await expect(clans.connect(alice).acceptJoinRequest(clanId, bobPlayerId, playerId)).to.be.revertedWithCustomError(
      clans,
      "ClanIsFull"
    );
    await expect(
      clans.connect(alice).acceptJoinRequests(clanId, [bobPlayerId], playerId)
    ).to.be.revertedWithCustomError(clans, "ClanIsFull");
  });

  it("Check getClanName is case sensitive", async function () {
    const {clans, playerId, clanName} = await loadFixture(clanFixture);
    expect(await clans.getClanNameOfPlayer(playerId)).to.eq(clanName);
  });

  it("Commoner leave clan", async function () {
    const {clans, playerId, alice, clanId} = await loadFixture(clanFixture);
    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.COMMONER, playerId);
    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.NONE, playerId);
  });

  it("changeRanks", async function () {
    const {clans, playerId, alice, bob, charlie, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);
    await clans.connect(alice).inviteMembers(clanId, [bobPlayerId, charliePlayerId], playerId);

    await clans.connect(bob).acceptInvite(clanId, bobPlayerId);
    await clans.connect(charlie).acceptInvite(clanId, charliePlayerId);

    await clans
      .connect(alice)
      .changeRanks(clanId, [bobPlayerId, charliePlayerId], [ClanRank.SCOUT, ClanRank.TREASURER], playerId);

    const bobPlayerInfo = await clans.playerInfo(bobPlayerId);
    expect(bobPlayerInfo.rank).to.eq(ClanRank.SCOUT);

    const charliePlayerInfo = await clans.playerInfo(charliePlayerId);
    expect(charliePlayerInfo.rank).to.eq(ClanRank.TREASURER);
  });

  it("Claim ownership of clan with no leader", async function () {
    const {clans, playerId, alice, bob, charlie, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
    await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId);

    await expect(clans.connect(bob).claimOwnership(clanId, bobPlayerId)).to.be.revertedWithCustomError(
      clans,
      "NotMemberOfClan"
    );

    const charliePlayerId = await createPlayer(playerNFT, avatarId, charlie, "charlie", true);
    await clans.connect(alice).inviteMember(clanId, charliePlayerId, playerId);
    await clans.connect(charlie).acceptInvite(clanId, charliePlayerId);

    await expect(clans.connect(charlie).claimOwnership(clanId, charliePlayerId)).to.be.revertedWithCustomError(
      clans,
      "OwnerExists"
    );

    await expect(clans.connect(alice).changeRank(clanId, playerId, ClanRank.NONE, playerId))
      .to.emit(clans, "ClanOwnerLeft")
      .withArgs(clanId, playerId);
    let clan = await clans.connect(alice).clans(clanId);
    await expect(clan.owner).to.eq(0);
    await expect(clan.memberCount).to.eq(1);

    await expect(clans.connect(bob).claimOwnership(clanId, bobPlayerId)).to.be.revertedWithCustomError(
      clans,
      "NotMemberOfClan"
    );
    await clans.connect(bob).acceptInvite(clanId, bobPlayerId);
    await clans.connect(bob).claimOwnership(clanId, bobPlayerId);

    clan = await clans.connect(alice).clans(clanId);
    await expect(clan.owner).to.eq(bobPlayerId);
    await expect(clan.memberCount).to.eq(2);
  });

  describe("Clan upgrades", () => {
    async function upgradedClansFixture() {
      const fixture = await loadFixture(clanFixture);
      const {clans} = fixture;

      await clans.addTiers([
        {
          id: 2,
          maxMemberCapacity: 10,
          maxBankCapacity: 10,
          maxImageId: 16,
          price: 10,
          minimumAge: 0,
        },
      ]);

      await clans.addTiers([
        {
          id: 3,
          maxMemberCapacity: 20,
          maxBankCapacity: 10,
          maxImageId: 30,
          price: 100,
          minimumAge: 0,
        },
      ]);

      return {...fixture, clans};
    }

    it("Create upgraded clan", async function () {
      const {clans, playerNFT, avatarId, bob, brush, discord, telegram, imageId} = await loadFixture(
        upgradedClansFixture
      );

      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      const brushAmount = (await clans.tiers(4)).price;
      expect(brushAmount).to.eq(0);
      await brush.mint(bob.address, 1000);
      await brush.connect(bob).approve(clans.address, 1000);
      await clans.connect(bob).createClan(bobPlayerId, "bob", discord, telegram, imageId, 2);
      expect(await brush.balanceOf(bob.address)).to.eq(1000 - (await clans.tiers(2)).price.toNumber());
    });

    it("Anyone can upgrade", async function () {
      const {clans, clanId, playerId, alice, brush} = await loadFixture(upgradedClansFixture);

      await expect(clans.connect(alice).upgradeClan(clanId, playerId, 2)).to.be.revertedWith(
        "ERC20: insufficient allowance"
      );
      const brushAmount = (await clans.tiers(2)).price;
      await brush.mint(alice.address, brushAmount - 1);
      await brush.connect(alice).approve(clans.address, brushAmount);
      await expect(clans.connect(alice).upgradeClan(clanId, playerId, 2)).to.be.revertedWith(
        "ERC20: transfer amount exceeds balance"
      );
      await brush.mint(alice.address, 1);
      await clans.connect(alice).upgradeClan(clanId, playerId, 2);
      const clan = await clans.clans(clanId);
      expect(clan.tierId).to.eq(2);
    });

    it("Pay the difference for incremental upgrades", async function () {
      const {clans, clanId, alice, playerId, brush} = await loadFixture(upgradedClansFixture);

      const brushAmount = (await clans.tiers(3)).price;
      await brush.mint(alice.address, brushAmount);
      const beforeBalance = await brush.balanceOf(alice.address);
      await brush.connect(alice).approve(clans.address, brushAmount);

      await clans.connect(alice).upgradeClan(clanId, playerId, 2);
      expect(await brush.balanceOf(alice.address)).to.eq(beforeBalance.sub((await clans.tiers(2)).price));
      await clans.connect(alice).upgradeClan(clanId, playerId, 3);
      expect(await brush.balanceOf(alice.address)).to.eq(beforeBalance.sub(brushAmount));
    });

    it("Cannot upgrade to a tier that doesn't exist", async function () {
      const {clans, clanId, playerNFT, avatarId, bob, brush} = await loadFixture(upgradedClansFixture);

      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
      const brushAmount = (await clans.tiers(4)).price;
      expect(brushAmount).to.eq(0);
      await brush.mint(bob.address, 1000);
      await brush.connect(bob).approve(clans.address, 1000);

      await expect(clans.connect(bob).upgradeClan(clanId, bobPlayerId, 4)).to.be.revertedWithCustomError(
        clans,
        "TierDoesNotExist"
      );
    });

    it("Cannot downgrade a clan", async function () {
      const {clans, clanId, playerId, alice, brush} = await loadFixture(upgradedClansFixture);

      await brush.mint(alice.address, 1000);
      await brush.connect(alice).approve(clans.address, 1000);
      await clans.connect(alice).upgradeClan(clanId, playerId, 2);
      await expect(clans.connect(alice).upgradeClan(clanId, playerId, 1)).to.be.revertedWithCustomError(
        clans,
        "CannotDowngradeTier"
      );
    });
  });

  it("Edit tiers", async function () {
    const fixture = await loadFixture(clanFixture);
    const {clans} = fixture;

    await clans.addTiers([
      {
        id: 2,
        maxMemberCapacity: 10,
        maxBankCapacity: 10,
        maxImageId: 16,
        price: 10,
        minimumAge: 0,
      },
    ]);

    const tiers: Tier[] = [
      {
        id: 1,
        maxMemberCapacity: 1,
        maxBankCapacity: 1,
        maxImageId: 50,
        price: BigNumber.from(1),
        minimumAge: 0,
      },
      {id: 2, maxMemberCapacity: 2, maxBankCapacity: 2, maxImageId: 50, price: BigNumber.from(2), minimumAge: 0},
      {id: 3, maxMemberCapacity: 3, maxBankCapacity: 3, maxImageId: 150, price: BigNumber.from(3), minimumAge: 0},
    ];

    await expect(clans.editTiers(tiers)).to.be.revertedWithCustomError(clans, "TierDoesNotExist");
    tiers.pop();
    await clans.editTiers(tiers);

    const tier1 = await clans.tiers(1);
    const tier2 = await clans.tiers(2);

    expect(tier1.maxMemberCapacity).to.eq(tiers[0].maxMemberCapacity);
    expect(tier1.maxBankCapacity).to.eq(tiers[0].maxBankCapacity);
    expect(tier1.maxImageId).to.eq(tiers[0].maxImageId);
    expect(tier1.minimumAge).to.eq(tiers[0].minimumAge);
    expect(tier1.price).to.eq(tiers[0].price);

    expect(tier2.maxMemberCapacity).to.eq(tiers[1].maxMemberCapacity);
    expect(tier2.maxBankCapacity).to.eq(tiers[1].maxBankCapacity);
    expect(tier2.maxImageId).to.eq(tiers[1].maxImageId);
    expect(tier2.minimumAge).to.eq(tiers[1].minimumAge);
    expect(tier2.price).to.eq(tiers[1].price);
  });

  describe("Leader", function () {
    describe("Edit clans", () => {
      it("Must be owner of player to edit", async () => {
        const {playerId, clans, alice, clanId, clanName, discord, telegram, imageId} = await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);
        await expect(
          clans.editClan(clanId, clanName, discord, telegram, imageId, playerId)
        ).to.be.revertedWithCustomError(clans, "NotOwnerOfPlayerAndActive");
      });

      it("Edited clan name should be freed and available", async () => {
        const {playerId, clans, alice, clanId, clanName, discord, telegram, imageId, brush, editNameCost} =
          await loadFixture(clanFixture);
        const anotherName = "Another name";
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);
        await expect(clans.connect(alice).editClan(clanId, anotherName, discord, telegram, imageId, playerId)).to.be
          .revertedWith;
        // Needs brush and approval
        const brushAmount = editNameCost.mul(5);
        await brush.mint(alice.address, brushAmount);
        await brush.connect(alice).approve(clans.address, brushAmount);

        await clans.connect(alice).editClan(clanId, anotherName, discord, telegram, imageId, playerId);
        expect(await clans.lowercaseNames(clanName.toLowerCase())).to.be.false;
        expect(await clans.lowercaseNames(anotherName.toLowerCase())).to.be.true;

        await clans.connect(alice).editClan(clanId, anotherName, discord, telegram, imageId, playerId); // Use same name, should not fail unless both the same
        await clans.connect(alice).editClan(clanId, clanName, discord, telegram, imageId, playerId);
        expect(await clans.lowercaseNames(clanName.toLowerCase())).to.be.true;
        expect(await clans.lowercaseNames(anotherName.toLowerCase())).to.be.false;
        await clans.connect(alice).editClan(clanId, anotherName, discord, telegram, imageId, playerId);
        await clans.connect(alice).editClan(clanId, anotherName, discord, telegram, imageId + 1, playerId);
        expect(await clans.lowercaseNames(anotherName.toLowerCase())).to.be.true;
      });

      it("Edit clan image", async () => {
        const {playerId, clans, alice, clanId, clanName, discord, telegram, imageId} = await loadFixture(clanFixture);

        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);
        await clans.connect(alice).editClan(clanId, clanName, discord, telegram, imageId + 1, playerId);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.TREASURER, playerId);
        await expect(
          clans.connect(alice).editClan(clanId, clanName, discord, telegram, imageId + 1, playerId)
        ).to.be.revertedWithCustomError(clans, "RankNotHighEnough");
      });

      it("Only leader can remove treasurers", async () => {
        const {clans, playerId, alice, bob, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
        const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
        await clans.connect(bob).requestToJoin(clanId, bobPlayerId);
        await clans.connect(alice).acceptJoinRequest(clanId, bobPlayerId, playerId);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId); // Change self to leader
        await clans.connect(alice).changeRank(clanId, bobPlayerId, ClanRank.TREASURER, playerId);

        await expect(
          clans.connect(bob).changeRank(clanId, playerId, ClanRank.SCOUT, bobPlayerId)
        ).to.be.revertedWithCustomError(clans, "ChangingRankOfPlayerEqualOrHigherThanSelf");
        await clans.connect(alice).changeRank(clanId, bobPlayerId, ClanRank.SCOUT, playerId);

        expect(await clans.canWithdraw(clanId, bobPlayerId)).to.be.false;
        expect(await clans.isClanMember(clanId, bobPlayerId)).to.be.true;

        const newPlayer = await clans.playerInfo(bobPlayerId);
        expect(newPlayer.clanId).to.eq(clanId);
        expect(newPlayer.requestedClanId).to.eq(0);
      });
    });

    describe("GateKeeping", function () {
      it("Check gateway defensive constraints", async function () {
        const {playerId, alice, clans, clanId, paintSwapMarketplaceWhitelist} = await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);
        const erc1155 = await ethers.deployContract("MockERC1155");
        await expect(
          clans.gateKeep(clanId, [{nft: erc1155.address, nftType: 1155}], playerId)
        ).to.be.revertedWithCustomError(clans, "NotOwnerOfPlayerAndActive");
        await expect(
          clans.connect(alice).gateKeep(clanId, [{nft: erc1155.address, nftType: 1155}], playerId)
        ).to.be.revertedWithCustomError(clans, "NFTNotWhitelistedOnMarketplace");
        await paintSwapMarketplaceWhitelist.setWhitelisted(erc1155.address, true);
        await expect(
          clans.connect(alice).gateKeep(clanId, [{nft: erc1155.address, nftType: 999}], playerId)
        ).to.be.revertedWithCustomError(clans, "UnsupportedNFTType");
        await expect(
          clans.connect(alice).gateKeep(clanId, [{nft: erc1155.address, nftType: 721}], playerId)
        ).to.be.revertedWithCustomError(clans, "InvalidNFTType");
        await expect(clans.connect(alice).gateKeep(clanId, [{nft: erc1155.address, nftType: 1155}], playerId)).to.not.be
          .reverted;

        const erc721 = await ethers.deployContract("MockERC721");
        await expect(
          clans.connect(alice).gateKeep(clanId, [{nft: erc721.address, nftType: 721}], playerId)
        ).to.be.revertedWithCustomError(clans, "NFTNotWhitelistedOnMarketplace");
        await paintSwapMarketplaceWhitelist.setWhitelisted(erc721.address, true);
        await expect(
          clans.connect(alice).gateKeep(clanId, [{nft: erc721.address, nftType: 999}], playerId)
        ).to.be.revertedWithCustomError(clans, "UnsupportedNFTType");
        await expect(
          clans.connect(alice).gateKeep(clanId, [{nft: erc721.address, nftType: 1155}], playerId)
        ).to.be.revertedWithCustomError(clans, "InvalidNFTType");
        await expect(clans.connect(alice).gateKeep(clanId, [{nft: erc721.address, nftType: 721}], playerId)).to.not.be
          .reverted;
        // 5 is ok
        await expect(
          clans.connect(alice).gateKeep(
            clanId,
            [
              {nft: erc721.address, nftType: 721},
              {nft: erc721.address, nftType: 721},
              {nft: erc721.address, nftType: 721},
              {nft: erc721.address, nftType: 721},
              {nft: erc721.address, nftType: 721},
            ],
            playerId
          )
        ).to.not.be.reverted;
        // Too many (max 5)
        await expect(
          clans.connect(alice).gateKeep(
            clanId,
            [
              {nft: erc721.address, nftType: 721},
              {nft: erc721.address, nftType: 721},
              {nft: erc721.address, nftType: 721},
              {nft: erc721.address, nftType: 721},
              {nft: erc721.address, nftType: 721},
              {nft: erc721.address, nftType: 721},
            ],
            playerId
          )
        ).to.be.revertedWithCustomError(clans, "TooManyNFTs");
      });

      it("Gate keep join request with ERC1155", async function () {
        const {clans, playerId, alice, bob, clanId, playerNFT, avatarId, paintSwapMarketplaceWhitelist} =
          await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);
        const erc1155 = await ethers.deployContract("MockERC1155");
        await paintSwapMarketplaceWhitelist.setWhitelisted(erc1155.address, true);

        await clans.connect(alice).gateKeep(clanId, [{nft: erc1155.address, nftType: 1155}], playerId);

        const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
        const tokenId = 1;
        await expect(
          clans.connect(bob).requestToJoinTODOPaint(clanId, bobPlayerId, tokenId)
        ).to.be.revertedWithCustomError(clans, "NoGateKeptNFTFound");

        await erc1155.mint(bob.address);
        await clans.connect(bob).requestToJoinTODOPaint(clanId, bobPlayerId, tokenId);
        await erc1155.connect(bob).safeTransferFrom(bob.address, alice.address, tokenId, 1, "0x");

        // Accepting should work even if they have since removed the NFT
        await clans.connect(alice).acceptJoinRequest(clanId, bobPlayerId, playerId);
      });

      it("Gate keep join request with ERC721", async function () {
        const {clans, playerId, alice, bob, clanId, playerNFT, avatarId, paintSwapMarketplaceWhitelist} =
          await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);
        const erc721 = await ethers.deployContract("MockERC721");
        await paintSwapMarketplaceWhitelist.setWhitelisted(erc721.address, true);

        await clans.connect(alice).gateKeep(clanId, [{nft: erc721.address, nftType: 721}], playerId);

        const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
        const tokenId = 1;
        await expect(clans.connect(bob).requestToJoinTODOPaint(clanId, bobPlayerId, tokenId)).to.be.revertedWith(
          "ERC721: invalid token ID"
        );

        await erc721.mint(bob.address);
        await clans.connect(bob).requestToJoinTODOPaint(clanId, bobPlayerId, tokenId);
        await clans.connect(alice).acceptJoinRequest(clanId, bobPlayerId, playerId);
      });

      it("Gate keep accepting invites with ERC1155", async function () {
        // Sending invites without the nft is fine, they must have the NFT to accept it though.
        const {clans, playerId, alice, bob, clanId, playerNFT, avatarId, paintSwapMarketplaceWhitelist} =
          await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);

        const erc1155 = await ethers.deployContract("MockERC1155");
        await paintSwapMarketplaceWhitelist.setWhitelisted(erc1155.address, true);

        const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);

        await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId);
        expect(await clans.hasInviteRequest(clanId, bobPlayerId)).to.be.true;

        await clans.connect(alice).gateKeep(clanId, [{nft: erc1155.address, nftType: 1155}], playerId);

        const tokenId = 1;
        await expect(
          clans.connect(bob).acceptInviteTODOPaint(clanId, bobPlayerId, tokenId)
        ).to.be.revertedWithCustomError(clans, "NoGateKeptNFTFound");
        await erc1155.mint(bob.address);
        await clans.connect(bob).acceptInviteTODOPaint(clanId, bobPlayerId, tokenId);
      });

      it("Gate keep accepting invites with ERC721", async function () {
        // Sending invites without the nft is fine, they must have the NFT to accept it though.
        const {clans, playerId, alice, bob, clanId, playerNFT, avatarId, paintSwapMarketplaceWhitelist} =
          await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);

        const erc721 = await ethers.deployContract("MockERC721");
        await paintSwapMarketplaceWhitelist.setWhitelisted(erc721.address, true);

        const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);

        await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId);
        expect(await clans.hasInviteRequest(clanId, bobPlayerId)).to.be.true;

        await clans.connect(alice).gateKeep(clanId, [{nft: erc721.address, nftType: 721}], playerId);

        const tokenId = 1;
        await expect(clans.connect(bob).acceptInviteTODOPaint(clanId, bobPlayerId, tokenId)).to.be.revertedWith(
          "ERC721: invalid token ID"
        );
        await erc721.mint(bob.address);
        await clans.connect(bob).acceptInviteTODOPaint(clanId, bobPlayerId, tokenId);
      });
    });
    describe("Message Pinning", function () {
      it("Must be owner of player to pin", async function () {
        const {playerId, alice, clans, clanId} = await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);
        await expect(clans.pinMessage(clanId, "test", playerId)).to.be.revertedWithCustomError(
          clans,
          "NotOwnerOfPlayerAndActive"
        );
        await clans.connect(alice).pinMessage(clanId, "test", playerId);
      });
      it("Must be leader to pin", async function () {
        const {playerId, alice, clans, clanId} = await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.TREASURER, playerId);
        await expect(clans.connect(alice).pinMessage(clanId, "test", playerId)).to.be.revertedWithCustomError(
          clans,
          "RankNotHighEnough"
        );
      });

      it("Check maximum length", async function () {
        const {playerId, alice, clans, clanId} = await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);
        await expect(clans.connect(alice).pinMessage(clanId, "x".repeat(201), playerId)).to.be.revertedWithCustomError(
          clans,
          "MessageTooLong"
        );
      });

      it("Pin message", async function () {
        const {playerId, alice, clans, clanId} = await loadFixture(clanFixture);
        await clans.connect(alice).changeRank(clanId, playerId, ClanRank.LEADER, playerId);
        expect(await clans.connect(alice).pinMessage(clanId, "test", playerId))
          .to.emit(clans, "MessagePinned")
          .withArgs(clanId, "test", playerId);
      });
    });
  });

  describe("Owner", function () {
    describe("Renounce ownership", () => {
      it("Must be owner to renounce", async function () {
        const {clans, playerId, alice, bob, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);

        await expect(
          clans.connect(alice).renounceOwnershipTo(clanId, playerId, ClanRank.COMMONER)
        ).to.be.revertedWithCustomError(clans, "CannotRenounceToSelf");

        const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "unique name", true);
        await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId); // Invite now as it won't be possible later when full
        await clans.connect(bob).acceptInvite(clanId, bobPlayerId);
        // Bob is now the leader
        await clans.connect(alice).renounceOwnershipTo(clanId, bobPlayerId, ClanRank.COMMONER);

        // Leader should now be a commoner
        const oldLeaderPlayerInfo = await clans.playerInfo(playerId);
        expect(oldLeaderPlayerInfo.rank).to.eq(ClanRank.COMMONER);
        expect(oldLeaderPlayerInfo.clanId).to.eq(clanId);

        // Check owner transferred to bob and other clan details
        const clan = await clans.connect(alice).clans(clanId);
        await expect(clan.owner).to.eq(bobPlayerId);
        await expect(clan.memberCount).to.eq(2);

        // Cannot renounce now as you aren't owner
        await expect(
          clans.connect(alice).renounceOwnershipTo(clanId, bobPlayerId, ClanRank.COMMONER)
        ).to.be.revertedWithCustomError(clans, "NotOwnerOfPlayer");
      });

      it("Can only renounce to a member", async function () {
        const {clans, playerId, alice, bob, clanId, playerNFT, avatarId} = await loadFixture(clanFixture);
        const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "unique name", true);
        await clans.connect(alice).inviteMember(clanId, bobPlayerId, playerId);
        await expect(
          clans.connect(alice).renounceOwnershipTo(clanId, bobPlayerId, ClanRank.COMMONER)
        ).to.be.revertedWithCustomError(clans, "NotMemberOfClan");
      });
    });
  });
});
