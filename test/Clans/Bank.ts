import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {expect} from "chai";
import {ethers} from "hardhat";
import {createPlayer} from "../../scripts/utils";
import {playersFixture} from "../Players/PlayersFixture";

describe("Bank", function () {
  async function bankFixture() {
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
  it("Should be able to deposit items up to max capacity", async function () {
    const {clans, playerId, alice, clanName, Bank, bankFactory, itemNFT, playerNFT, avatarId, owner} =
      await loadFixture(bankFixture);

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

    await clans.connect(alice).createClan(playerId, clanName, 2, 1);
    await itemNFT.connect(alice).setApprovalForAll(clanBankAddress, true);
    const bank = await Bank.attach(clanBankAddress);
    expect(await bankFactory.createdHere(clanBankAddress)).to.be.true;
    expect(await bankFactory.bankAddress(clanId)).to.eq(clanBankAddress);

    await expect(bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "DepositItems")
      .withArgs(alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1])
      .and.to.not.emit(bank, "DepositItemsNoPlayer");

    expect(await bank.uniqueItemCount()).to.eq(1);

    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, clanBankAddress, EstforConstants.BRONZE_SHIELD, 1, "0x")
    )
      .to.emit(bank, "DepositItemNoPlayer")
      .withArgs(alice.address, EstforConstants.BRONZE_SHIELD, 1);

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
      .to.emit(bank, "DepositItemsNoPlayer")
      .withArgs(alice.address, [EstforConstants.SAPPHIRE_AMULET, EstforConstants.BRONZE_ARROW], [5, 10]);
    expect(await bank.uniqueItemCount()).to.eq(3);

    // Have now reached the max
    await expect(
      bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_HELMET], [1])
    ).to.be.revertedWithCustomError(bank, "MaxCapacityReached");

    // Reverting inside the on received function can't catch that revert message so check for the generic one
    await expect(
      itemNFT.connect(alice).safeTransferFrom(alice.address, clanBankAddress, EstforConstants.BRONZE_HELMET, 1, "0x")
    ).to.be.revertedWith("ERC1155: transfer to non-ERC1155Receiver implementer");

    await expect(
      itemNFT
        .connect(alice)
        .safeBatchTransferFrom(alice.address, clanBankAddress, [EstforConstants.BRONZE_HELMET], [1], "0x")
    ).to.be.revertedWith("ERC1155: transfer to non-ERC1155Receiver implementer");

    // Check same item can be deposited
    await bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_SHIELD], [1]);

    // Upgrade tier of clan
    await clans.addTiers([
      {
        id: 2,
        maxCapacity: 5,
        maxImageId: 16,
        price: 0,
        minimumAge: 0,
      },
    ]);

    await clans.connect(alice).upgradeClan(clanId, playerId, 2);
    await bank.connect(alice).depositItems(playerId, [EstforConstants.BRONZE_HELMET], [1]);
    expect(await bank.uniqueItemCount()).to.eq(4);

    // Check only admins can withdraw
    const balanceBefore = await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_SHIELD);
    await expect(bank.connect(alice).withdrawItems(alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]))
      .to.emit(bank, "WithdrawItems")
      .withArgs(alice.address, playerId, [EstforConstants.BRONZE_SHIELD], [1]);
    expect(balanceBefore.add(1)).to.eq(await itemNFT.balanceOf(alice.address, EstforConstants.BRONZE_SHIELD));

    const newPlayerId = createPlayer(playerNFT, avatarId, owner, ethers.utils.formatBytes32String("my name ser"), true);
    await clans.requestToJoin(clanId, newPlayerId);
    await clans.connect(alice).acceptJoinRequest(clanId, newPlayerId, playerId);

    await expect(
      bank.connect(owner).withdrawItems(alice.address, newPlayerId, [EstforConstants.BRONZE_SHIELD], [1])
    ).to.be.revertedWithCustomError(bank, "NotClanAdmin");
  });

  it("Max capacity of the tier should be adhered to with items", async function () {
    const {clans, playerId, alice, clanName, bank, Bank, bankFactory} = await loadFixture(bankFixture);
  });

  it("Should be able to deposit and withdraw ftm", async function () {});

  it("Should be able to deposit and withdraw tokens", async function () {});
});
