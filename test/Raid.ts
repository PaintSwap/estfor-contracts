import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import { Items } from "../scripts/utils";

describe("Raid", function () {
  async function deployContracts() {
    // Contracts are deployed using the first signer/account by default
    const [owner, alice] = await ethers.getSigners();

    const MockBrushToken = await ethers.getContractFactory("MockBrushToken");
    const brush = await MockBrushToken.deploy();

    // Create NFT contract which contains all items & players
    const NFT = await ethers.getContractFactory("PaintScapeNFT");
    const nft = await NFT.deploy(brush.address);

    await nft.addShopItem(4, 500);

    return {
      nft,
      brush,
      owner,
      alice,
    };
  }

  it("Public Raid", async function () {
    const {nft, brush, alice} = await loadFixture(deployContracts);
    brush.mint(alice.address, 1000);
    brush.connect(alice).approve(nft.address, 1000);
    const quantityBought = 2;
    await nft.connect(alice).buy(Items.SHIELD, quantityBought);
    expect(await nft.balanceOf(alice.address, Items.SHIELD)).to.eq(quantityBought);

    // Need a raid pass
  });
});
