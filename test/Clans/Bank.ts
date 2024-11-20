import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {createPlayer} from "../../scripts/utils";
import {playersFixture} from "../Players/PlayersFixture";
import {ClanRank} from "@paintswap/estfor-definitions/types";
import {Bank} from "../../typechain-types";
import {calculateClanBankAddress} from "./utils";

describe("Bank", function () {
  async function bankFixture() {
    const fixture = await loadFixture(playersFixture);

    const {bankFactory, clans, bank} = fixture;

    // Add basic tier
    await clans.addTiers([
      {
        id: 1,
        maxMemberCapacity: 3,
        maxBankCapacity: 3,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);

    const clanName = "Clan 1";
    const discord = "G4ZgtP52JK";
    const telegram = "fantomfoundation";
    const twitter = "fantomfdn";

    const clanId = 1;
    const clanBankAddress = await calculateClanBankAddress(
      clanId,
      await bankFactory.getAddress(),
      await bank.getAddress()
    );

    return {...fixture, clanId, clanBankAddress, clans, clanName, discord, telegram, twitter};
  }

  it("Should be able to deposit items up to max capacity and only treasurers withdraw", async function () {
    const {
      clans,
      playerId,
      alice,
      clanName,
      discord,
      telegram,
      twitter,
      Bank,
      bankRelay,
      bankFactory,
      itemNFT,
      playerNFT,
      avatarId,
      owner,
      clanId,
      clanBankAddress
    } = await loadFixture(bankFixture);

    await itemNFT.mintBatch(
      alice,
      [
        EstforConstants.BRONZE_SHIELD,
        EstforConstants.BRONZE_HELMET,
        EstforConstants.SAPPHIRE_AMULET,
        EstforConstants.BRONZE_ARROW
      ],
      [200, 100, 100, 100]
    );

    // Send directly
    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);
    await itemNFT.connect(alice).setApprovalForAll(clanBankAddress, true);
    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;
    expect(await bankFactory.getCreatedHere(clanBankAddress)).to.be.true;
    expect(await bankFactory.getBankAddress(clanId)).to.eq(clanBankAddress);

    await expect(bankRelay.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "DepositItems")
      .withArgs(alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);

    expect(await bankRelay.getUniqueItemCountForPlayer(playerId)).to.eq(1);

    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice, clanBankAddress, EstforConstants.BRONZE_SHIELD, 1, "0x")
    )
      .to.emit(bank, "DepositItem")
      .withArgs(alice.address, playerId, EstforConstants.BRONZE_SHIELD, 1);

    expect(await bankRelay.getUniqueItemCountForPlayer(playerId)).to.eq(1); // Still just 1 as it's the same
    await expect(
      itemNFT
        .connect(alice)
        .safeBatchTransferFrom(
          alice,
          clanBankAddress,
          [EstforConstants.SAPPHIRE_AMULET, EstforConstants.BRONZE_ARROW],
          [5, 10],
          "0x"
        )
    )
      .to.emit(bank, "DepositItems")
      .withArgs(alice.address, playerId, [EstforConstants.SAPPHIRE_AMULET, EstforConstants.BRONZE_ARROW], [5, 10]);
    expect(await bankRelay.getUniqueItemCountForPlayer(playerId)).to.eq(3);

    // Have now reached the max
    await expect(
      bankRelay.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_HELMET], [1])
    ).to.be.revertedWithCustomError(bank, "MaxBankCapacityReached");

    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice, clanBankAddress, EstforConstants.BRONZE_HELMET, 1, "0x")
    ).to.be.revertedWithCustomError(bank, "MaxBankCapacityReached");

    await expect(
      itemNFT.connect(alice).safeBatchTransferFrom(alice, clanBankAddress, [EstforConstants.BRONZE_HELMET], [1], "0x")
    ).to.be.revertedWithCustomError(bank, "MaxBankCapacityReached");

    // Check same item can be deposited
    await bankRelay.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_SHIELD], [1]);

    // Upgrade tier of clan
    await clans.addTiers([
      {
        id: 2,
        maxMemberCapacity: 5,
        maxBankCapacity: 5,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);

    await clans.connect(alice).upgradeClan(clanId, playerId, 2);
    await bankRelay.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_HELMET], [1]);
    expect(await bankRelay.getUniqueItemCountForPlayer(playerId)).to.eq(4);

    // Check only treasurers can withdraw
    const balanceBefore = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_SHIELD);
    await expect(bankRelay.connect(alice).withdrawItems(alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "WithdrawItems")
      .withArgs(alice.address, alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);
    expect(balanceBefore + 1n).to.eq(await itemNFT.balanceOf(alice, EstforConstants.BRONZE_SHIELD));

    const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "my name ser", true);
    await clans.requestToJoin(clanId, newPlayerId, 0);
    await clans.connect(alice).acceptJoinRequests(clanId, [newPlayerId], playerId);

    await expect(
      bankRelay.withdrawItems(alice, newPlayerId, [EstforConstants.BRONZE_SHIELD], [1])
    ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
  });

  it("Withdraw (Distribute) to someone else", async function () {
    const {
      clans,
      playerId,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      bankRelay,
      bankFactory,
      Bank,
      itemNFT,
      clanBankAddress
    } = await loadFixture(bankFixture);

    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;

    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);
    await itemNFT.mint(clanBankAddress, EstforConstants.BRONZE_SHIELD, 1);

    await expect(bankRelay.connect(alice).withdrawItems(bob.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "WithdrawItems")
      .withArgs(alice.address, bob.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);
  });

  it("Withdraw (Distribute) to many users", async function () {
    const {
      clans,
      playerId,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      bankRelay,
      clanBankAddress,
      Bank,
      itemNFT
    } = await loadFixture(bankFixture);

    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;

    // Upgrade tier of clan
    await clans.addTiers([
      {
        id: 2,
        maxMemberCapacity: 5,
        maxBankCapacity: 6,
        maxImageId: 16,
        price: 0,
        minimumAge: 0
      }
    ]);
    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 2);

    // Send directly
    await itemNFT.mint(clanBankAddress, EstforConstants.TITANIUM_AXE, 2); // to alice
    await itemNFT.mint(clanBankAddress, EstforConstants.IRON_AXE, 3); // to bob
    await itemNFT.mint(clanBankAddress, EstforConstants.MITHRIL_AXE, 1); // Don't transfer this

    await itemNFT.mint(clanBankAddress, EstforConstants.ADAMANTINE_AXE, 4); // to bob
    await itemNFT.mint(clanBankAddress, EstforConstants.RUNITE_AXE, 3); // to alice (only send 1)
    await itemNFT.mint(clanBankAddress, EstforConstants.ORICHALCUM_AXE, 2); // to alice

    const tokenIds = [
      EstforConstants.TITANIUM_AXE,
      EstforConstants.IRON_AXE,
      EstforConstants.ADAMANTINE_AXE,
      EstforConstants.RUNITE_AXE,
      EstforConstants.ORICHALCUM_AXE
    ];
    const tos = [alice, bob, bob, alice, alice];
    const amounts = [2, 3, 4, 1, 2];

    // Turn this into expected transfer nft object
    const nftInfos = [];
    for (let i = 0; i < tokenIds.length; ++i) {
      const tokenId = tokenIds[i];
      const to = tos[i];
      const amount = amounts[i];

      let exists = false;
      for (let j = 0; j < nftInfos.length; ++j) {
        const nftInfo: any = nftInfos[j];
        if (to == nftInfo.to) {
          // Already exists
          exists = true;
          nftInfo.tokenIds.push(tokenId);
          nftInfo.amounts.push(amount);
          break;
        }
      }

      if (!exists) {
        nftInfos.push({tokenIds: [tokenId], amounts: [amount], to: to});
      }
    }

    await expect(bankRelay.connect(alice).withdrawItemsBulk(nftInfos, playerId)).to.emit(bank, "WithdrawItemsBulk");

    // Check balances of the NFTs are as expected
    expect(
      await itemNFT.balanceOfs(alice, [
        EstforConstants.TITANIUM_AXE,
        EstforConstants.RUNITE_AXE,
        EstforConstants.ORICHALCUM_AXE
      ])
    ).to.deep.eq([2, 1, 2]);

    expect(
      await itemNFT.balanceOfs(bob.address, [EstforConstants.IRON_AXE, EstforConstants.ADAMANTINE_AXE])
    ).to.deep.eq([3, 4]);

    expect(await itemNFT.balanceOf(clanBankAddress, EstforConstants.MITHRIL_AXE)).to.eq(1);
  });

  it("Should be able to withdraw non-transferable boosts", async function () {
    const {
      clans,
      playerId,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      bankRelay,
      clanBankAddress,
      Bank,
      itemNFT
    } = await loadFixture(bankFixture);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.SKILL_BOOST,
        isTransferable: false, // Cannot be transferred
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    // Confirm item cannot be transferred normally
    await itemNFT.mint(alice, EstforConstants.SKILL_BOOST, 1);
    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice, bob, EstforConstants.SKILL_BOOST, 1, "0x")
    ).to.be.revertedWithCustomError(itemNFT, "ItemNotTransferable");

    // Send directly
    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;

    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);
    await itemNFT.mint(clanBankAddress, EstforConstants.SKILL_BOOST, 1);

    await expect(bankRelay.connect(alice).withdrawItems(alice, playerId, [EstforConstants.SKILL_BOOST], [1]))
      .to.emit(bank, "WithdrawItems")
      .withArgs(alice.address, alice.address, playerId, [EstforConstants.SKILL_BOOST], [1]);
  });

  it("Should be able to deposit and withdraw ftm", async function () {});

  it("Should be able to deposit and withdraw tokens", async function () {
    const {
      clans,
      playerId,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      bankRelay,
      clanBankAddress,
      Bank,
      brush,
      playerNFT,
      avatarId,
      clanId
    } = await loadFixture(bankFixture);

    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;
    await brush.mint(alice, 1000);
    await brush.connect(alice).approve(bank, 1000);

    await expect(bankRelay.connect(alice).depositToken(playerId + 1n, brush, 1000)).to.be.revertedWithCustomError(
      bankRelay,
      "PlayerNotInClan"
    );

    await expect(bankRelay.connect(alice).depositToken(playerId, brush, 1000))
      .to.emit(bank, "DepositToken")
      .withArgs(alice.address, playerId, await brush.getAddress(), 1000);

    expect(await brush.balanceOf(bank)).to.eq(1000);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
    await expect(bankRelay.connect(alice).withdrawToken(playerId, bob, bobPlayerId, brush, 500))
      .to.emit(bank, "WithdrawToken")
      .withArgs(alice.address, playerId, bob.address, bobPlayerId, brush, 500);

    expect(await brush.balanceOf(bob)).to.eq(500);
    expect(await brush.balanceOf(bank)).to.eq(500);

    // Can also just transfer directly
    await brush.mint(bank, 500);

    await expect(bankRelay.connect(alice).withdrawToken(playerId, bob, bobPlayerId, brush, 750))
      .to.emit(bank, "WithdrawToken")
      .withArgs(alice.address, playerId, bob.address, bobPlayerId, brush, 750);

    expect(await brush.balanceOf(bob)).to.eq(1250);
    expect(await brush.balanceOf(bank)).to.eq(250);

    // Must be at least treasurer to withdraw
    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.SCOUT, playerId);
    await expect(
      bankRelay.connect(alice).withdrawToken(playerId, bob, bobPlayerId, brush, 250)
    ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
  });

  it("Should be able to deposit and withdraw other ERC1155 NFTs", async function () {
    const {
      clans,
      playerId,
      alice,
      bob,
      clanName,
      discord,
      telegram,
      twitter,
      bankRelay,
      clanId,
      clanBankAddress,
      Bank,
      brush,
      playerNFT,
      avatarId
    } = await loadFixture(bankFixture);

    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

    await brush.mint(alice, 1000);
    await brush.connect(alice).approve(clanBankAddress, 1000);

    const bank = (await Bank.attach(clanBankAddress)) as Bank;

    const erc1155 = await ethers.deployContract("TestERC1155NoRoyalty");
    const tokenId = 1;
    await erc1155.mintSpecificId(clanBankAddress, tokenId, 1000);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
    await expect(bankRelay.connect(alice).withdrawNFT(playerId, bob, bobPlayerId, erc1155, tokenId, 400))
      .to.emit(bank, "WithdrawNFT")
      .withArgs(alice.address, playerId, bob.address, bobPlayerId, erc1155, tokenId, 400);

    expect(await erc1155.balanceOf(bob.address, tokenId)).to.eq(400);
    expect(await erc1155.balanceOf(bank, tokenId)).to.eq(600);

    // Cannot send erc721s, so there's nothing to withdraw there
    const erc721 = await ethers.deployContract("TestERC721");
    await expect(erc721.mint(bank)).to.be.reverted;

    await expect(
      bankRelay.connect(alice).withdrawNFT(playerId, bob, bobPlayerId, erc721, tokenId, 1)
    ).to.be.revertedWithCustomError(bank, "NFTTypeNotSupported");

    await expect(
      bankRelay.connect(alice).withdrawNFT(playerId, alice, bobPlayerId, erc721, tokenId, 1)
    ).to.be.revertedWithCustomError(bank, "ToIsNotOwnerOfPlayer");

    // Cannot withdraw itemNFTs
    await expect(bankRelay.connect(alice).withdrawNFT(playerId, bob, bobPlayerId, erc1155, tokenId, 400));

    // Must be at least treasurer to withdraw
    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.SCOUT, playerId);
    await expect(
      bankRelay.connect(alice).withdrawToken(playerId, bob, bobPlayerId, brush, 250)
    ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
  });

  describe("Withdraw tokens to many users", function () {
    it("Withdrawer is not owner of player", async function () {
      const {clans, playerId, alice, clanName, discord, telegram, twitter, bankRelay, clanBankAddress, Bank, brush} =
        await loadFixture(bankFixture);

      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;
      await brush.mint(clanBankAddress, 500);

      await expect(
        bankRelay.connect(alice).withdrawTokenToMany(playerId + 1n, [alice.address], [playerId], brush, [250])
      ).to.be.revertedWithCustomError(bankRelay, "PlayerNotInClan");
    });

    it("Must be at least treasurer to withdraw", async function () {
      const {
        clans,
        playerId,
        alice,
        clanName,
        discord,
        telegram,
        twitter,
        bankRelay,
        clanId,
        clanBankAddress,
        Bank,
        brush
      } = await loadFixture(bankFixture);

      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;
      await brush.mint(bank, 500);
      await clans.connect(alice).changeRank(clanId, playerId, ClanRank.SCOUT, playerId);

      await expect(
        bankRelay.connect(alice).withdrawTokenToMany(playerId, [alice], [playerId], brush, [250])
      ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
    });

    it("Length mismatch", async function () {
      const {clans, playerId, alice, clanName, discord, telegram, twitter, bankRelay, clanBankAddress, Bank, brush} =
        await loadFixture(bankFixture);

      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;

      await expect(
        bankRelay.connect(alice).withdrawTokenToMany(playerId, [alice], [], brush, [250])
      ).to.be.revertedWithCustomError(bank, "LengthMismatch");

      await expect(
        bankRelay.connect(alice).withdrawTokenToMany(playerId, [alice], [playerId], brush, [])
      ).to.be.revertedWithCustomError(bank, "LengthMismatch");
    });

    it("Owner mismatch with the player id", async function () {
      const {clans, playerId, alice, clanName, discord, telegram, twitter, bankRelay, clanBankAddress, Bank, brush} =
        await loadFixture(bankFixture);

      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;
      await brush.mint(clanBankAddress, 500);

      await expect(
        bankRelay.connect(alice).withdrawTokenToMany(playerId, [alice], [playerId + 1n], brush, [250])
      ).to.be.revertedWithCustomError(bank, "ToIsNotOwnerOfPlayer");
    });

    it("Withdraw to many users", async function () {
      const {
        clans,
        playerId,
        alice,
        bob,
        clanName,
        discord,
        telegram,
        twitter,
        bankRelay,
        Bank,
        brush,
        origName,
        playerNFT,
        avatarId,
        clanBankAddress
      } = await loadFixture(bankFixture);

      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;
      await brush.mint(bank, 500);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);

      await expect(
        bankRelay
          .connect(alice)
          .withdrawTokenToMany(playerId, [alice, bob], [playerId, bobPlayerId], await brush.getAddress(), [250, 200])
      )
        .to.emit(bank, "WithdrawTokens")
        .withArgs(alice, playerId, [alice, bob], [playerId, bobPlayerId], await brush.getAddress(), [250, 200]);

      expect(await brush.balanceOf(alice)).to.eq(250);
      expect(await brush.balanceOf(bob)).to.eq(200);
    });
  });
});
