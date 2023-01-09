import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {Attribute, createPlayer, EquipPosition, FEMALE, Items, MALE, Skill} from "../scripts/utils";

describe("Player", () => {
  async function deployContracts() {
    const [owner, alice] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const mockBrushToken = await MockBrushToken.deploy();

    // Create the world
    const MockOracleClient = await ethers.getContractFactory("MockOracleClient");
    const mockOracleClient = await MockOracleClient.deploy();
    const subscriptionId = 2;
    const World = await ethers.getContractFactory("World");
    const world = await World.deploy(mockOracleClient.address, subscriptionId);    

    // Create NFT contract which contains all the items
    const ItemNFT = await ethers.getContractFactory("TestItemNFT");
    const itemNFT = await ItemNFT.deploy(mockBrushToken.address,  world.address);

    // Create NFT contract which contains all the players
    const PlayerNFT = await ethers.getContractFactory("PlayerNFT");
    const playerNFT = await PlayerNFT.deploy(mockBrushToken.address, itemNFT.address,  world.address);

    const avatarId = 1;
    const avatarInfo = { name: "Name goes here", description: "Hi I'm a description", imageURI: "1234.png" };
    await playerNFT.addAvatar(avatarId, avatarInfo);

    // Create player
    const player = await createPlayer(playerNFT, alice, avatarId);

    const maxTime = await player.MAX_TIME();
    const maxWeight = await player.MAX_WEIGHT_PER_SLOT();

    return {
      player,
      playerNFT,
      itemNFT,
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
    const {player, itemNFT} = await loadFixture(deployContracts);
    const Player = await ethers.getContractFactory("Player");
    expect(await player.sex()).to.eq(MALE);
    const playerFemale = await Player.deploy(itemNFT.address, 1, FEMALE);
    expect(await playerFemale.sex()).to.eq(FEMALE);
  });

  it("Equipment", async () => {
    const {player, alice, itemNFT, playerNFT, maxWeight} = await loadFixture(deployContracts);
    await itemNFT.testMint(alice.address, Items.SHIELD, 1);
    expect(await itemNFT.balanceOf(alice.address, Items.SHIELD)).to.eq(1);

    // Shield doesn't exist yet
    await expect(player.equip(Items.SHIELD)).to.be.reverted;

    await itemNFT.addItem(Items.SHIELD, {
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

    expect(await itemNFT.numEquipped(alice.address, Items.SHIELD)).to.eq(1);

    // Try equip it on someone else, should fail as we don't have enough
    const newPlayer = await createPlayer(playerNFT, alice, 1);
    await expect(newPlayer.connect(alice).equip(Items.SHIELD)).to.be.reverted;

    // Mint another one and try again, first trying to connect same item to the same player
    await itemNFT.testMint(alice.address, Items.SHIELD, 1);
    await expect(player.connect(alice).equip(Items.SHIELD)).to.be.reverted;
    await newPlayer.connect(alice).equip(Items.SHIELD);
    expect(await itemNFT.numEquipped(alice.address, Items.SHIELD)).to.eq(2);
  });

  it("Equipment Many", async () => {
    // TODO:
  });

  it("Inventory", async () => {
    const {player, itemNFT, alice} = await loadFixture(deployContracts);

    // Max inventory of 16 items
    await itemNFT.testMint(alice.address, Items.SHIELD, 1);
    await player.connect(alice).addToInventory(Items.SHIELD, 1);

    expect(await player.inventoryAmount(Items.SHIELD)).to.eq(1);
  });

  it("uri", async () => {
//    await robotzBoostMultiplierNFT.mint(alice.address, 1, { value: mintCost });
 //   const tokenId = 1;

    // level 1 (TODO: Update when we have the multipliers ready)
 //   const base64URI =
  //    "data:application/json;base64,eyJuYW1lIjogIlJvYm90eiBNdWx0aXBsaWVyIE5GVCAjMSIsImRlc2NyaXB0aW9uIjogIkdpdmVzIGJvb3N0cyBmb3IgdGhlIFJvYm90eiBwcm90b2NvbC4iLCJhdHRyaWJ1dGVzIjpbeyJ0cmFpdF90eXBlIjoiTGV2ZWwiLCJ2YWx1ZSI6IiMxIn0seyJ0cmFpdF90eXBlIjoiQm9vc3QgbXVsdGlwbGllciIsInZhbHVlIjoiMjAwMDB4In0seyJ0cmFpdF90eXBlIjoiVGltZSByZW1haW5pbmcgdGlsbCBuZXh0IHVwZ3JhZGUiLCJ2YWx1ZSI6IjEwMCJ9XSwiaW1hZ2UiOiAiZGF0YTppbWFnZS9zdmcreG1sO2Jhc2U2NCxQSE4yWnlCcFpEMGlUR0Y1WlhKZk1TSWdaR0YwWVMxdVlXMWxQU0pNWVhsbGNpQXhJaUI0Yld4dWN6MGlhSFIwY0RvdkwzZDNkeTUzTXk1dmNtY3ZNakF3TUM5emRtY2lJSFpwWlhkQ2IzZzlJakFnTUNBME5qY3VNellnTVRBeU9TNHpNU0krUEdSbFpuTStQSE4wZVd4bFBpNWpiSE10TVh0bWIyNTBMWE5wZW1VNk9UUTJjSGc3Wm1sc2JEb2pOV0prTXpRMk8zTjBjbTlyWlRvak1EQXdPM04wY205clpTMXRhWFJsY214cGJXbDBPakV3TzJadmJuUXRabUZ0YVd4NU9rMTVjbWxoWkZCeWJ5MVNaV2QxYkdGeUxDQk5lWEpwWVdRZ1VISnZPMnhsZEhSbGNpMXpjR0ZqYVc1bk9pMHdMakF5WlcwN2ZUd3ZjM1I1YkdVK1BDOWtaV1p6UGp4MFpYaDBJR05zWVhOelBTSmpiSE10TVNJZ2RISmhibk5tYjNKdFBTSjBjbUZ1YzJ4aGRHVW9NQzQxSURjNU1pNHpNU2tpUGpFOEwzUmxlSFErUEM5emRtYysifQ==";
  //  expect(await robotzBoostMultiplierNFT.tokenURI(tokenId)).to.equal(
 //     base64URI
   // );

});
