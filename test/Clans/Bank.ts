import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants, EstforTypes} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {createPlayer} from "../../scripts/utils";
import {playersFixture} from "../Players/PlayersFixture";
import {ClanRank} from "@paintswap/estfor-definitions/types";

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
        minimumAge: 0,
      },
    ]);

    const clanName = "Clan 1";
    const discord = "G4ZgtP52JK";
    const telegram = "fantomfoundation";
    return {...fixture, clans, clanName, discord, telegram};
  }

  it("Should be able to deposit items up to max capacity and only treasurers withdraw", async function () {
    const {
      clans,
      playerId,
      alice,
      clanName,
      discord,
      telegram,
      Bank,
      bankFactory,
      itemNFT,
      playerNFT,
      avatarId,
      owner,
    } = await loadFixture(bankFixture);

    await itemNFT.testMints(
      alice.address,
      [
        EstforConstants.BRONZE_SHIELD,
        EstforConstants.BRONZE_HELMET,
        EstforConstants.SAPPHIRE_AMULET,
        EstforConstants.BRONZE_ARROW,
      ],
      [200, 100, 100, 100]
    );

    // Send directly
    const clanId = 1;
    const clanBankAddress = ethers.utils.getContractAddress({
      from: bankFactory.address,
      nonce: clanId,
    });

    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, 2, 1);
    await itemNFT.connect(alice).setApprovalForAll(clanBankAddress, true);
    const bank = await Bank.attach(clanBankAddress);
    expect(await bankFactory.createdHere(clanBankAddress)).to.be.true;
    expect(await bankFactory.bankAddress(clanId)).to.eq(clanBankAddress);

    await expect(bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "DepositItems")
      .withArgs(alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);

    expect(await bank.uniqueItemCount()).to.eq(1);

    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, clanBankAddress, EstforConstants.BRONZE_SHIELD, 1, "0x")
    )
      .to.emit(bank, "DepositItem")
      .withArgs(alice.address, playerId, EstforConstants.BRONZE_SHIELD, 1);

    expect(await bank.uniqueItemCount()).to.eq(1); // Still just 1 as it's the same
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
    expect(await bank.uniqueItemCount()).to.eq(3);

    // Have now reached the max
    await expect(
      bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_HELMET], [1])
    ).to.be.revertedWithCustomError(bank, "MaxBankCapacityReached");

    // Reverting inside the on received function can't catch that revert message so check for the generic one
    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, clanBankAddress, EstforConstants.BRONZE_HELMET, 1, "0x")
    ).to.be.revertedWithCustomError(itemNFT, "ERC1155TransferToNonERC1155Receiver");

    await expect(
      itemNFT
        .connect(alice)
        .safeBatchTransferFrom(alice.address, clanBankAddress, [EstforConstants.BRONZE_HELMET], [1], "0x")
    ).to.be.revertedWithCustomError(itemNFT, "ERC1155TransferToNonERC1155Receiver");

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
        minimumAge: 0,
      },
    ]);

    await clans.connect(alice).upgradeClan(clanId, playerId, 2);
    await bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_HELMET], [1]);
    expect(await bank.uniqueItemCount()).to.eq(4);

    // Check only treasurers can withdraw
    const balanceBefore = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_SHIELD);
    await expect(bank.connect(alice).withdrawItems(alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "WithdrawItems")
      .withArgs(alice.address, alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);
    expect(balanceBefore.add(1)).to.eq(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_SHIELD));

    const newPlayerId = await createPlayer(playerNFT, avatarId, owner, "my name ser", true);
    await clans.requestToJoin(clanId, newPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, newPlayerId, playerId);

    await expect(
      bank.connect(owner).withdrawItems(alice.address, newPlayerId, [EstforConstants.BRONZE_SHIELD], [1])
    ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
  });

  it("Withdraw (Distribute) to someone else", async function () {
    const {clans, playerId, alice, bob, clanName, discord, telegram, Bank, bankFactory, itemNFT} = await loadFixture(
      bankFixture
    );

    // Send directly
    const clanId = 1;
    const clanBankAddress = ethers.utils.getContractAddress({
      from: bankFactory.address,
      nonce: clanId,
    });
    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, 2, 1);
    await itemNFT.testMint(clanBankAddress, EstforConstants.BRONZE_SHIELD, 1);

    const bank = await Bank.attach(clanBankAddress);
    await expect(bank.connect(alice).withdrawItems(bob.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "WithdrawItems")
      .withArgs(alice.address, bob.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);
  });

  it("Should be able to withdraw non-transferable boosts", async function () {
    const {clans, playerId, alice, bob, clanName, discord, telegram, Bank, bankFactory, itemNFT} = await loadFixture(
      bankFixture
    );

    await itemNFT.addItems([
      {
        ...EstforTypes.defaultItemInput,
        tokenId: EstforConstants.SKILL_BOOST,
        isTransferable: false, // Cannot be transferred
        equipPosition: EstforTypes.EquipPosition.RIGHT_HAND,
      },
    ]);

    // Confirm item cannot be transferred normally
    await itemNFT.testMint(alice.address, EstforConstants.SKILL_BOOST, 1);
    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, bob.address, EstforConstants.SKILL_BOOST, 1, "0x")
    ).to.be.revertedWithCustomError(itemNFT, "ItemNotTransferable");

    // Send directly
    const clanId = 1;
    const clanBankAddress = ethers.utils.getContractAddress({
      from: bankFactory.address,
      nonce: clanId,
    });

    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, 2, 1);
    await itemNFT.testMint(clanBankAddress, EstforConstants.SKILL_BOOST, 1);

    const bank = await Bank.attach(clanBankAddress);
    await expect(bank.connect(alice).withdrawItems(alice.address, playerId, [EstforConstants.SKILL_BOOST], [1]))
      .to.emit(bank, "WithdrawItems")
      .withArgs(alice.address, alice.address, playerId, [EstforConstants.SKILL_BOOST], [1]);
  });

  it("Should be able to deposit and withdraw ftm", async function () {});

  it("Should be able to deposit and withdraw tokens", async function () {
    const {clans, playerId, alice, bob, clanName, discord, telegram, Bank, bankFactory, brush} = await loadFixture(
      bankFixture
    );

    const clanId = 1;
    const clanBankAddress = ethers.utils.getContractAddress({
      from: bankFactory.address,
      nonce: clanId,
    });
    await clans.connect(alice).createClan(playerId, clanName, discord, telegram, 2, 1);

    await brush.mint(alice.address, 1000);
    await brush.connect(alice).approve(clanBankAddress, 1000);

    const bank = await Bank.attach(clanBankAddress);

    await expect(bank.connect(alice).depositToken(playerId.add(1), brush.address, 1000)).to.be.revertedWithCustomError(
      bank,
      "NotOwnerOfPlayer"
    );

    await expect(bank.connect(alice).depositToken(playerId, brush.address, 1000))
      .to.emit(bank, "DepositToken")
      .withArgs(alice.address, playerId, brush.address, 1000);

    expect(await brush.balanceOf(bank.address)).to.eq(1000);

    await expect(bank.connect(alice).withdrawToken(bob.address, playerId, brush.address, 500))
      .to.emit(bank, "WithdrawToken")
      .withArgs(alice.address, bob.address, playerId, brush.address, 500);

    expect(await brush.balanceOf(bob.address)).to.eq(500);
    expect(await brush.balanceOf(bank.address)).to.eq(500);

    // Can also just transfer directly
    await brush.mint(bank.address, 500);

    await expect(bank.connect(alice).withdrawToken(bob.address, playerId, brush.address, 750))
      .to.emit(bank, "WithdrawToken")
      .withArgs(alice.address, bob.address, playerId, brush.address, 750);

    expect(await brush.balanceOf(bob.address)).to.eq(1250);
    expect(await brush.balanceOf(bank.address)).to.eq(250);

    // Must be at least treasurer to withdraw
    await clans.connect(alice).changeRank(clanId, playerId, ClanRank.SCOUT, playerId);
    await expect(
      bank.connect(alice).withdrawToken(bob.address, playerId, brush.address, 750)
    ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
  });
});
