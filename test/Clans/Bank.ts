import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {createPlayer} from "../../scripts/utils";
import {playersFixture} from "../Players/PlayersFixture";
import {ClanRank} from "@paintswap/estfor-definitions/types";
import {Bank} from "../../typechain-types";

describe("Bank", function () {
  async function bankFixture() {
    const fixture = await loadFixture(playersFixture);

    const {clans} = fixture;

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
    return {...fixture, clans, clanName, discord, telegram, twitter};
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
      bankFactory,
      itemNFT,
      playerNFT,
      avatarId,
      owner
    } = await loadFixture(bankFixture);

    await itemNFT.testMints(
      alice.address,
      [
        EstforConstants.BRONZE_SHIELD,
        EstforConstants.BRONZE_HELMET,
        EstforConstants.SAPPHIRE_AMULET,
        EstforConstants.BRONZE_ARROW
      ],
      [200, 100, 100, 100]
    );

    // Send directly
    const clanId = 1;
    const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});

    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);
    await itemNFT.connect(alice).setApprovalForAll(clanBankAddress, true);
    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;
    expect(await bankFactory.getCreatedHere(clanBankAddress)).to.be.true;
    expect(await bankFactory.getBankAddress(clanId)).to.eq(clanBankAddress);

    await expect(bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "DepositItems")
      .withArgs(alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);

    expect(await bank.getUniqueItemCount()).to.eq(1);

    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, clanBankAddress, EstforConstants.BRONZE_SHIELD, 1, "0x")
    )
      .to.emit(bank, "DepositItem")
      .withArgs(alice.address, playerId, EstforConstants.BRONZE_SHIELD, 1);

    expect(await bank.getUniqueItemCount()).to.eq(1); // Still just 1 as it's the same
    await expect(
      itemNFT
        .connect(alice)
        .safeBatchTransferFrom(
          alice.address,
          clanBankAddress,
          [EstforConstants.SAPPHIRE_AMULET, EstforConstants.BRONZE_ARROW],
          [5, 10],
          "0x"
        )
    )
      .to.emit(bank, "DepositItems")
      .withArgs(alice.address, playerId, [EstforConstants.SAPPHIRE_AMULET, EstforConstants.BRONZE_ARROW], [5, 10]);
    expect(await bank.getUniqueItemCount()).to.eq(3);

    // Have now reached the max
    await expect(
      bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_HELMET], [1])
    ).to.be.revertedWithCustomError(bank, "MaxBankCapacityReached");

    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, clanBankAddress, EstforConstants.BRONZE_HELMET, 1, "0x")
    ).to.be.revertedWithCustomError(bank, "MaxBankCapacityReached");

    await expect(
      itemNFT
        .connect(alice)
        .safeBatchTransferFrom(alice.address, clanBankAddress, [EstforConstants.BRONZE_HELMET], [1], "0x")
    ).to.be.revertedWithCustomError(bank, "MaxBankCapacityReached");

    // Check same item can be deposited
    await bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_SHIELD], [1]);

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
    await bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_HELMET], [1]);
    expect(await bank.getUniqueItemCount()).to.eq(4);

    // Check only treasurers can withdraw
    const balanceBefore = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_SHIELD);
    await expect(bank.connect(alice).withdrawItems(alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "WithdrawItems")
      .withArgs(alice.address, alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);
    expect(balanceBefore + 1n).to.eq(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_SHIELD));

    const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "my name ser", true);
    await clans.requestToJoin(clanId, newPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, newPlayerId, playerId);

    await expect(
      bank.connect(owner).withdrawItems(alice.address, newPlayerId, [EstforConstants.BRONZE_SHIELD], [1])
    ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
  });

  it("Withdraw (Distribute) to someone else", async function () {
    const {clans, playerId, alice, bob, clanName, discord, telegram, twitter, Bank, bankFactory, itemNFT} =
      await loadFixture(bankFixture);

    const clanId = 1;
    const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});

    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);
    await itemNFT.testMint(clanBankAddress, EstforConstants.BRONZE_SHIELD, 1);

    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;
    await expect(bank.connect(alice).withdrawItems(bob.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "WithdrawItems")
      .withArgs(alice.address, bob.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);
  });

  it("Withdraw (Distribute) to many users", async function () {
    const {clans, playerId, alice, bob, clanName, discord, telegram, twitter, Bank, bankFactory, itemNFT} =
      await loadFixture(bankFixture);

    const clanId = 1;
    const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});

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
    await itemNFT.testMint(clanBankAddress, EstforConstants.TITANIUM_AXE, 2); // to alice
    await itemNFT.testMint(clanBankAddress, EstforConstants.IRON_AXE, 3); // to bob
    await itemNFT.testMint(clanBankAddress, EstforConstants.MITHRIL_AXE, 1); // Don't transfer this

    await itemNFT.testMint(clanBankAddress, EstforConstants.ADAMANTINE_AXE, 4); // to bob
    await itemNFT.testMint(clanBankAddress, EstforConstants.RUNITE_AXE, 3); // to alice (only send 1)
    await itemNFT.testMint(clanBankAddress, EstforConstants.ORICHALCUM_AXE, 2); // to alice

    const tokenIds = [
      EstforConstants.TITANIUM_AXE,
      EstforConstants.IRON_AXE,
      EstforConstants.ADAMANTINE_AXE,
      EstforConstants.RUNITE_AXE,
      EstforConstants.ORICHALCUM_AXE
    ];
    const tos = [alice.address, bob.address, bob.address, alice.address, alice.address];
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

    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;

    await expect(bank.connect(alice).withdrawItemsBulk(nftInfos, playerId)).to.emit(bank, "WithdrawItemsBulk");

    // Check balances of the NFTs are as expected
    expect(
      await itemNFT.balanceOfs(alice.address, [
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
    const {clans, playerId, alice, bob, clanName, discord, telegram, twitter, Bank, bankFactory, itemNFT} =
      await loadFixture(bankFixture);

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.SKILL_BOOST,
        isTransferable: false, // Cannot be transferred
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND
      }
    ]);

    // Confirm item cannot be transferred normally
    await itemNFT.testMint(alice.address, EstforConstants.SKILL_BOOST, 1);
    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, bob.address, EstforConstants.SKILL_BOOST, 1, "0x")
    ).to.be.revertedWithCustomError(itemNFT, "ItemNotTransferable");

    // Send directly
    const clanId = 1;
    const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});

    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);
    await itemNFT.testMint(clanBankAddress, EstforConstants.SKILL_BOOST, 1);

    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;
    await expect(bank.connect(alice).withdrawItems(alice.address, playerId, [EstforConstants.SKILL_BOOST], [1]))
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
      Bank,
      bankFactory,
      brush,
      playerNFT,
      avatarId
    } = await loadFixture(bankFixture);

    const clanId = 1;
    const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});
    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(clanBankAddress, 1000);

    const bank = (await Bank.attach(clanBankAddress)) as unknown as Bank;

    await expect(
      bank.connect(alice).depositToken(alice.address, playerId + 1n, await brush.getAddress(), 1000)
    ).to.be.revertedWithCustomError(bank, "NotOwnerOfPlayer");

    await expect(bank.connect(alice).depositToken(alice.address, playerId, await brush.getAddress(), 1000))
      .to.emit(bank, "DepositToken")
      .withArgs(alice.address, playerId, await brush.getAddress(), 1000);

    expect(await brush.balanceOf(await bank.getAddress())).to.eq(1000);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
    await expect(bank.connect(alice).withdrawToken(playerId, bob.address, bobPlayerId, await brush.getAddress(), 500))
      .to.emit(bank, "WithdrawToken")
      .withArgs(alice.address, playerId, bob.address, bobPlayerId, await brush.getAddress(), 500);

    expect(await brush.balanceOf(bob.address)).to.eq(500);
    expect(await brush.balanceOf(await bank.getAddress())).to.eq(500);

    // Can also just transfer directly
    await brush.mint(await bank.getAddress(), 500);

    await expect(bank.connect(alice).withdrawToken(playerId, bob.address, bobPlayerId, await brush.getAddress(), 750))
      .to.emit(bank, "WithdrawToken")
      .withArgs(alice.address, playerId, bob.address, bobPlayerId, await brush.getAddress(), 750);

    expect(await brush.balanceOf(bob.address)).to.eq(1250);
    expect(await brush.balanceOf(await bank.getAddress())).to.eq(250);

    // Must be at least treasurer to withdraw
    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.SCOUT, playerId);
    await expect(
      bank.connect(alice).withdrawToken(playerId, bob.address, bobPlayerId, await brush.getAddress(), 250)
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
      Bank,
      bankFactory,
      brush,
      playerNFT,
      avatarId
    } = await loadFixture(bankFixture);

    const clanId = 1;
    const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});
    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(clanBankAddress, 1000);

    const bank = (await Bank.attach(clanBankAddress)) as Bank;

    const erc1155 = await ethers.deployContract("MockERC1155");
    const tokenId = 1;
    await erc1155.mintSpecific(await bank.getAddress(), tokenId, 1000);

    const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, "bob", true);
    await expect(
      bank.connect(alice).withdrawNFT(playerId, bob.address, bobPlayerId, await erc1155.getAddress(), tokenId, 400)
    )
      .to.emit(bank, "WithdrawNFT")
      .withArgs(alice.address, playerId, bob.address, bobPlayerId, await erc1155.getAddress(), tokenId, 400);

    expect(await erc1155.balanceOf(bob.address, tokenId)).to.eq(400);
    expect(await erc1155.balanceOf(await bank.getAddress(), tokenId)).to.eq(600);

    // Cannot send erc721s, so there's nothing to withdraw there
    const erc721 = await ethers.deployContract("MockERC721");
    await expect(erc721.mint(await bank.getAddress())).to.be.reverted;

    await expect(
      bank.connect(alice).withdrawNFT(playerId, bob.address, bobPlayerId, await erc721.getAddress(), tokenId, 1)
    ).to.be.revertedWithCustomError(bank, "NFTTypeNotSupported");

    await expect(
      bank.connect(alice).withdrawNFT(playerId, alice.address, bobPlayerId, await erc721.getAddress(), tokenId, 1)
    ).to.be.revertedWithCustomError(bank, "ToIsNotOwnerOfPlayer");

    // Cannot withdraw itemNFTs
    await expect(
      bank.connect(alice).withdrawNFT(playerId, bob.address, bobPlayerId, await erc1155.getAddress(), tokenId, 400)
    );

    // Must be at least treasurer to withdraw
    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.SCOUT, playerId);
    await expect(
      bank.connect(alice).withdrawToken(playerId, bob.address, bobPlayerId, await brush.getAddress(), 250)
    ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
  });

  describe("Withdraw tokens to many users", function () {
    it("Withdrawer is not owner of player", async function () {
      const {clans, playerId, alice, clanName, discord, telegram, twitter, Bank, bankFactory, brush} =
        await loadFixture(bankFixture);

      const clanId = 1;
      const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});
      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;
      await brush.mint(await bank.getAddress(), 500);

      await expect(
        bank
          .connect(alice)
          .withdrawTokenToMany(playerId + 1n, [alice.address], [playerId], await brush.getAddress(), [250])
      ).to.be.revertedWithCustomError(bank, "NotOwnerOfPlayer");
    });

    it("Must be at least treasurer to withdraw", async function () {
      const {clans, playerId, alice, clanName, discord, telegram, twitter, Bank, bankFactory, brush} =
        await loadFixture(bankFixture);

      const clanId = 1;
      const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});
      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;
      await brush.mint(await bank.getAddress(), 500);
      await clans.connect(alice).changeRank(clanId, playerId, ClanRank.SCOUT, playerId);

      await expect(
        bank.connect(alice).withdrawTokenToMany(playerId, [alice.address], [playerId], await brush.getAddress(), [250])
      ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
    });

    it("Length mismatch", async function () {
      const {clans, playerId, alice, clanName, discord, telegram, twitter, Bank, bankFactory, brush} =
        await loadFixture(bankFixture);

      const clanId = 1;
      const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});
      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;

      await expect(
        bank.connect(alice).withdrawTokenToMany(playerId, [alice.address], [], await brush.getAddress(), [250])
      ).to.be.revertedWithCustomError(bank, "LengthMismatch");

      await expect(
        bank.connect(alice).withdrawTokenToMany(playerId, [alice.address], [playerId], await brush.getAddress(), [])
      ).to.be.revertedWithCustomError(bank, "LengthMismatch");
    });

    it("Owner mismatch with the player id", async function () {
      const {clans, playerId, alice, clanName, discord, telegram, twitter, Bank, bankFactory, brush} =
        await loadFixture(bankFixture);

      const clanId = 1;
      const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});
      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;
      await brush.mint(await bank.getAddress(), 500);

      await expect(
        bank
          .connect(alice)
          .withdrawTokenToMany(playerId, [alice.address], [playerId + 1n], await brush.getAddress(), [250])
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
        Bank,
        bankFactory,
        brush,
        origName,
        playerNFT,
        avatarId
      } = await loadFixture(bankFixture);

      const clanId = 1;
      const clanBankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});
      await clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, 2, 1);

      const bank = (await Bank.attach(clanBankAddress)) as Bank;
      await brush.mint(await bank.getAddress(), 500);
      const bobPlayerId = await createPlayer(playerNFT, avatarId, bob, origName + 1, true);

      await expect(
        bank
          .connect(alice)
          .withdrawTokenToMany(
            playerId,
            [alice.address, bob.address],
            [playerId, bobPlayerId],
            await brush.getAddress(),
            [250, 200]
          )
      )
        .to.emit(bank, "WithdrawTokens")
        .withArgs(
          alice.address,
          playerId,
          [alice.address, bob.address],
          [playerId, bobPlayerId],
          await brush.getAddress(),
          [250, 200]
        );

      expect(await brush.balanceOf(alice.address)).to.eq(250);
      expect(await brush.balanceOf(bob.address)).to.eq(200);
    });
  });
});
