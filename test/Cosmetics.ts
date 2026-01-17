import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";
import {EstforTypes, EstforConstants} from "@paintswap/estfor-definitions";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {createPlayer} from "../scripts/utils";
import {playersFixture} from "./Players/PlayersFixture";
import {setupBasicWoodcutting} from "./Players/utils";
import {ZeroAddress, parseEther} from "ethers";

describe("Cosmetics", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    const {brush, alice, royaltyReceiver} = baseFixture;
    const brushAmount = parseEther("100");
    await brush.mint(alice, brushAmount);
    const erc1155 = await ethers.deployContract("TestERC1155", [royaltyReceiver]);
    return {...baseFixture, erc1155};
  }

  it("should not allow minting of a cosmetic only avatar", async () => {
    const {playerNFT, bob} = await loadFixture(deployContracts);

    await expect(createPlayer(playerNFT, 9, bob, "New name", true)).to.be.revertedWithCustomError(
      playerNFT,
      "BaseAvatarNotExists"
    );
  });

  it("should not let non-owners from setting cosmetics", async () => {
    const {cosmetics, bob} = await loadFixture(deployContracts);

    await expect(
      cosmetics
        .connect(bob)
        .setCosmetics([1], [{itemTokenId: 1, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: 9}])
    ).to.be.revertedWithCustomError(cosmetics, "OwnableUnauthorizedAccount");
  });

  it("should revert when setting cosmetics incorrectly", async () => {
    const {cosmetics, owner} = await loadFixture(deployContracts);

    await expect(
      cosmetics
        .connect(owner)
        .setCosmetics([1, 2], [{itemTokenId: 1, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: 9}])
    ).to.be.revertedWithCustomError(cosmetics, "LengthMismatch");
  });

  it("should emit event when setting cosmetics", async () => {
    const {cosmetics, owner} = await loadFixture(deployContracts);

    await expect(
      cosmetics
        .connect(owner)
        .setCosmetics([1], [{itemTokenId: 1, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: 9}])
    )
      .to.emit(cosmetics, "SetCosmetics")
      .withArgs([1], [[BigInt(EstforTypes.EquipPosition.AVATAR), 1n, 9n]]);
  });

  it("should overwrite existing cosmetics", async () => {
    const {cosmetics, owner} = await loadFixture(deployContracts);

    await expect(
      cosmetics
        .connect(owner)
        .setCosmetics([1], [{itemTokenId: 1, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: 9}])
    )
      .to.emit(cosmetics, "SetCosmetics")
      .withArgs([1], [[BigInt(EstforTypes.EquipPosition.AVATAR), 1n, 9n]]);

    await expect(
      cosmetics
        .connect(owner)
        .setCosmetics([1], [{itemTokenId: 1, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: 9}])
    )
      .to.emit(cosmetics, "SetCosmetics")
      .withArgs([1], [[BigInt(EstforTypes.EquipPosition.AVATAR), 1n, 9n]]);
  });

  it("should not let non-owners from removing cosmetics", async () => {
    const {cosmetics, owner, bob} = await loadFixture(deployContracts);

    // First set cosmetics so we can remove them
    await cosmetics.connect(owner).setCosmetics(
      [1, 2],
      [
        {itemTokenId: 1, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: 9},
        {itemTokenId: 2, cosmeticPosition: EstforTypes.EquipPosition.AVATAR_BORDER, avatarId: 0},
      ]
    );

    await expect(cosmetics.connect(bob).removeCosmeticItems([1])).to.be.revertedWithCustomError(
      cosmetics,
      "OwnableUnauthorizedAccount"
    );
  });

  it("should remove cosmetic items and emit event", async () => {
    const {cosmetics, owner, itemNFT, bob, playerNFT} = await loadFixture(deployContracts);

    // First set cosmetics so we can remove them
    await cosmetics.connect(owner).setCosmetics(
      [1, 2],
      [
        {itemTokenId: 1, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: 9},
        {itemTokenId: 2, cosmeticPosition: EstforTypes.EquipPosition.AVATAR_BORDER, avatarId: 0},
      ]
    );

    await expect(cosmetics.connect(owner).removeCosmeticItems([1, 2]))
      .to.emit(cosmetics, "RemoveCosmetics")
      .withArgs([1, 2]);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);

    await itemNFT.mint(bob, 1, 1);
    await expect(cosmetics.connect(bob).applyCosmetic(newPlayerId, 1)).to.be.revertedWithCustomError(
      cosmetics,
      "NotEquippableCosmetic"
    );
  });

  it("should revert when trying to apply cosmetic when not owner of player", async () => {
    const {cosmetics, playerNFT, charlie, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);

    await expect(
      cosmetics.connect(charlie).applyCosmetic(newPlayerId, EstforConstants.AVATAR_001_CHIMP)
    ).to.be.revertedWithCustomError(cosmetics, "NotOwnerOfPlayer");
  });

  it("should revert when trying to apply item that is not a cosmetic", async () => {
    const {cosmetics, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);

    await expect(cosmetics.connect(bob).applyCosmetic(newPlayerId, 1)).to.be.revertedWithCustomError(
      cosmetics,
      "NotEquippableCosmetic"
    );
  });

  it("should revert when a cosmetic is already equipped", async () => {
    const {cosmetics, itemNFT, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);

    await itemNFT.mint(bob, EstforConstants.AVATAR_001_CHIMP, 1);
    await cosmetics.connect(bob).applyCosmetic(newPlayerId, EstforConstants.AVATAR_001_CHIMP);

    // second time should revert
    await expect(
      cosmetics.connect(bob).applyCosmetic(newPlayerId, EstforConstants.AVATAR_001_CHIMP)
    ).to.be.revertedWithCustomError(cosmetics, "CosmeticSlotOccupied");
  });

  it("should revert if user doesn't have the cosmetic item", async () => {
    const {cosmetics, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);

    await expect(cosmetics.connect(bob).applyCosmetic(newPlayerId, EstforConstants.AVATAR_001_CHIMP)).to.be.reverted;
  });

  it("should successfully burn item and emit events when applying cosmetic item", async () => {
    const {cosmetics, itemNFT, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);

    await itemNFT.mint(bob, EstforConstants.AVATAR_001_CHIMP, 1);
    await expect(cosmetics.connect(bob).applyCosmetic(newPlayerId, EstforConstants.AVATAR_001_CHIMP))
      .to.emit(cosmetics, "CosmeticApplied")
      .withArgs(newPlayerId, EstforConstants.AVATAR_001_CHIMP, BigInt(EstforTypes.EquipPosition.AVATAR))
      .and.to.emit(itemNFT, "TransferSingle")
      .withArgs(cosmetics, bob.address, ZeroAddress, EstforConstants.AVATAR_001_CHIMP, 1)
      .and.to.emit(playerNFT, "EditAvatar")
      .withArgs(newPlayerId, 9n);

    expect(await itemNFT.balanceOf(bob.address, EstforConstants.AVATAR_001_CHIMP)).to.equal(0);
  });

  it("should successfully get item back when removing cosmetic item", async () => {
    const {cosmetics, brush, itemNFT, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);

    const brushAmount = parseEther("100");
    await brush.mint(bob, brushAmount);
    await brush.connect(bob).approve(playerNFT, brushAmount);

    await itemNFT.mint(bob, EstforConstants.AVATAR_001_CHIMP, 1);
    await cosmetics.connect(bob).applyCosmetic(newPlayerId, EstforConstants.AVATAR_001_CHIMP);
    await expect(cosmetics.connect(bob).removeCosmetic(newPlayerId, EstforTypes.EquipPosition.AVATAR))
      .to.emit(cosmetics, "CosmeticRemoved")
      .withArgs(newPlayerId, BigInt(EstforTypes.EquipPosition.AVATAR))
      .and.to.emit(itemNFT, "TransferSingle")
      .withArgs(cosmetics, ZeroAddress, bob.address, EstforConstants.AVATAR_001_CHIMP, 1)
      .and.to.emit(playerNFT, "EditAvatar")
      .withArgs(newPlayerId, 1n); // revert stats back to base avatar

    expect(await itemNFT.balanceOf(bob.address, EstforConstants.AVATAR_001_CHIMP)).to.equal(1);
    expect(await brush.balanceOf(bob.address)).to.be.lessThan(brushAmount); // brush used for unequipping avatar cosmetic specifically
  });

  it("should revert when removing avatar cosmetic without enough brush", async () => {
    const {cosmetics, brush, itemNFT, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);

    const brushAmount = parseEther("100");
    await brush.connect(bob).approve(playerNFT, brushAmount);

    await itemNFT.mint(bob, EstforConstants.AVATAR_001_CHIMP, 1);
    await cosmetics.connect(bob).applyCosmetic(newPlayerId, EstforConstants.AVATAR_001_CHIMP);
    await expect(
      cosmetics.connect(bob).removeCosmetic(newPlayerId, EstforTypes.EquipPosition.AVATAR)
    ).to.be.revertedWithCustomError(brush, "ERC20InsufficientBalance");
  });

  it("should revert when trying to apply cosmetic when not owner of player", async () => {
    const {cosmetics, brush, itemNFT, playerNFT, charlie, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);

    const brushAmount = parseEther("100");
    await brush.mint(bob, brushAmount);
    await brush.connect(bob).approve(playerNFT, brushAmount);

    await itemNFT.mint(bob, EstforConstants.AVATAR_001_CHIMP, 1);
    await cosmetics.connect(bob).applyCosmetic(newPlayerId, EstforConstants.AVATAR_001_CHIMP);

    await expect(
      cosmetics.connect(charlie).removeCosmetic(newPlayerId, EstforTypes.EquipPosition.AVATAR)
    ).to.be.revertedWithCustomError(cosmetics, "NotOwnerOfPlayer");
  });

  it("should get bonus xp when equipping new avatar", async () => {
    const {cosmetics, itemNFT, players, playerNFT, worldActions, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const woodcuttingAvatarId = 10;
    await playerNFT.setAvatars(
      [woodcuttingAvatarId],
      [
        {
          name: "Woodcutting champ",
          description: "",
          imageURI: "10010.jpg",
          startSkills: [Skill.WOODCUTTING, Skill.NONE],
        },
      ]
    );
    await cosmetics.setCosmetics(
      [2],
      [{itemTokenId: 2, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: woodcuttingAvatarId}]
    );

    await itemNFT.mint(bob, 2, 1);
    await cosmetics.connect(bob).applyCosmetic(newPlayerId, 2);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(bob).startActions(newPlayerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await time.increase(queuedAction.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(bob, newPlayerId);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan * 1.1));
    await players.connect(bob).processActions(newPlayerId);
    expect(await players.getPlayerXP(newPlayerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      BigInt(Math.floor(queuedAction.timespan * 1.1))
    );
  });

  it("should get bonus xp when equipping new evolved avatar", async () => {
    const {cosmetics, brush, itemNFT, players, playerNFT, worldActions, bob} = await loadFixture(deployContracts);

    const brushAmount = parseEther("100");
    await brush.mint(bob, brushAmount);
    await brush.connect(bob).approve(playerNFT, brushAmount);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true, "", "", "", true);
    const woodcuttingAvatarId = 10;
    await playerNFT.setAvatars(
      [woodcuttingAvatarId, woodcuttingAvatarId + 10000],
      [
        {
          name: "Woodcutting champ",
          description: "",
          imageURI: "10.jpg",
          startSkills: [Skill.WOODCUTTING, Skill.NONE],
        },
        {
          name: "Woodcutting champ evolved",
          description: "",
          imageURI: "10010.jpg",
          startSkills: [Skill.WOODCUTTING, Skill.NONE],
        },
      ]
    );
    // equipping base avatar automatically equips evolved version for evolved players
    await cosmetics.setCosmetics(
      [2],
      [{itemTokenId: 2, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: woodcuttingAvatarId}]
    );

    await itemNFT.mint(bob, 2, 1);
    await cosmetics.connect(bob).applyCosmetic(newPlayerId, 2);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(bob).startActions(newPlayerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await time.increase(queuedAction.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(bob, newPlayerId);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan * 1.2));
    await players.connect(bob).processActions(newPlayerId);
    expect(await players.getPlayerXP(newPlayerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
      BigInt(Math.floor(queuedAction.timespan * 1.2))
    );
  });

  it("should revert to normal xp after unequipping cosmetic avatar", async () => {
    const {brush, cosmetics, itemNFT, players, playerNFT, worldActions, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const woodcuttingAvatarId = 10;
    await playerNFT.setAvatars(
      [woodcuttingAvatarId],
      [
        {
          name: "Woodcutting champ",
          description: "",
          imageURI: "10010.jpg",
          startSkills: [Skill.WOODCUTTING, Skill.NONE],
        },
      ]
    );
    await cosmetics.setCosmetics(
      [2],
      [{itemTokenId: 2, cosmeticPosition: EstforTypes.EquipPosition.AVATAR, avatarId: woodcuttingAvatarId}]
    );

    await itemNFT.mint(bob, 2, 1);
    await cosmetics.connect(bob).applyCosmetic(newPlayerId, 2);

    const {queuedAction} = await setupBasicWoodcutting(itemNFT, worldActions);
    await players.connect(bob).startActions(newPlayerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
    await time.increase(queuedAction.timespan);

    const pendingQueuedActionState = await players.getPendingQueuedActionState(bob, newPlayerId);
    expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan * 1.1));
    await players.connect(bob).processActions(newPlayerId);

    const xp = await players.getPlayerXP(newPlayerId, EstforTypes.Skill.WOODCUTTING);
    expect(xp).to.eq(BigInt(Math.floor(queuedAction.timespan * 1.1)));

    const brushAmount = parseEther("100");
    await brush.mint(bob, brushAmount);
    await brush.connect(bob).approve(playerNFT, brushAmount);
    await cosmetics.connect(bob).removeCosmetic(newPlayerId, EstforTypes.EquipPosition.AVATAR);

    {
      await players.connect(bob).startActions(newPlayerId, [queuedAction], EstforTypes.ActionQueueStrategy.OVERWRITE);
      await time.increase(queuedAction.timespan);

      const pendingQueuedActionState = await players.getPendingQueuedActionState(bob, newPlayerId);
      expect(pendingQueuedActionState.actionMetadatas[0].xpGained).to.eq(Math.floor(queuedAction.timespan));
      await players.connect(bob).processActions(newPlayerId);

      expect(await players.getPlayerXP(newPlayerId, EstforTypes.Skill.WOODCUTTING)).to.eq(
        xp + BigInt(Math.floor(queuedAction.timespan))
      );
    }
  });
});
