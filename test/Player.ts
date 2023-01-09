import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Attribute, createPlayer, EquipPosition, FEMALE, Items, MALE, Skill} from "../scripts/utils";

describe("Player", function () {
  async function deployContracts() {
    const [owner, alice] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const mockBrushToken = await MockBrushToken.deploy();

    // Create NFT contract which contains all items & players
    const NFT = await ethers.getContractFactory("TestPaintScapeNFT");
    const nft = await NFT.deploy(mockBrushToken.address);

    // Create player
    const player = await createPlayer(nft, alice);

    const maxTime = await player.MAX_TIME();
    const maxWeight = await player.MAX_WEIGHT_PER_SLOT();

    return {
      player,
      nft,
      mockBrushToken,
      maxTime,
      maxWeight,
      owner,
      alice,
    };
  }

  it("Skill points", async function () {
    const {player, alice} = await loadFixture(deployContracts);

    expect(await player.skillPoints(Skill.PAINT)).to.eq(0);
    await player.connect(alice).paint();
    await ethers.provider.send("evm_increaseTime", [1]);
    await player.connect(alice).consumeLastSkill();
    expect((await player.skillPoints(Skill.PAINT)).toNumber()).to.be.oneOf([1, 2, 3]);
  });

  it("Skill points, max range", async function () {
    const {player, alice, maxTime} = await loadFixture(deployContracts);

    expect(await player.skillPoints(Skill.PAINT)).to.eq(0);
    await player.connect(alice).paint();
    await ethers.provider.send("evm_increaseTime", [maxTime + 1]);
    await player.connect(alice).consumeLastSkill();
    expect((await player.skillPoints(Skill.PAINT)).toNumber()).to.eq(maxTime);
  });

  it("Multi-skill points", async function () {
    // TODO:
  });

  it("Sex", async function () {
    const {player, nft} = await loadFixture(deployContracts);
    const Player = await ethers.getContractFactory("Player");
    expect(await player.sex()).to.eq(MALE);
    const playerFemale = await Player.deploy(nft.address, 1, FEMALE);
    expect(await playerFemale.sex()).to.eq(FEMALE);
  });

  it("Equipment", async () => {
    const {player, alice, nft, maxWeight} = await loadFixture(deployContracts);
    await nft.testMint(alice.address, Items.SHIELD, 1);
    expect(await nft.balanceOf(alice.address, Items.SHIELD)).to.eq(1);

    // Shield doesn't exist yet
    await expect(player.equip(Items.SHIELD)).to.be.reverted;

    await nft.addItem(Items.SHIELD, {
      attribute: Attribute.DEFENCE,
      equipPosition: EquipPosition.LEFT_ARM,
      weight: maxWeight,
      bonus: 1,
    });

    // Check bonuses before
    expect(await player.attackBonus()).to.eq(0);
    expect(await player.defenceBonus()).to.eq(0);

    await player.connect(alice).equip(Items.SHIELD);

    // Check bonuses after
    expect(await player.attackBonus()).to.eq(0);
    expect(await player.defenceBonus()).to.eq(1);

    expect(await nft.numEquipped(alice.address, Items.SHIELD)).to.eq(1);

    // Try equip it on someone else, should fail as we don't have enough
    const newPlayer = await createPlayer(nft, alice);
    await expect(newPlayer.connect(alice).equip(Items.SHIELD)).to.be.reverted;

    // Mint another one and try again, first trying to connect same item to the same player
    await nft.testMint(alice.address, Items.SHIELD, 1);
    await expect(player.connect(alice).equip(Items.SHIELD)).to.be.reverted;
    await newPlayer.connect(alice).equip(Items.SHIELD);
    expect(await nft.numEquipped(alice.address, Items.SHIELD)).to.eq(2);
  });

  it("Equipment Many", async () => {
    // TODO:
  });

  it("Inventory", async () => {
    const {player, nft, alice} = await loadFixture(deployContracts);

    // Max inventory of 16 items
    await nft.testMint(alice.address, Items.SHIELD, 1);
    await player.connect(alice).addToInventory(Items.SHIELD, 1);

    expect(await player.inventoryAmount(Items.SHIELD)).to.eq(1);
  });
});
