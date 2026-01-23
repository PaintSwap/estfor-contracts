import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {createPlayer} from "../scripts/utils";
import {Marketplace} from "../typechain-types";
import {playersFixture} from "./Players/PlayersFixture";
import {parseEther, keccak256, solidityPacked} from "ethers";
import {makeSigner} from "./Players/utils";

describe("Marketplace", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    const {brush, alice, royaltyReceiver} = baseFixture;
    const brushAmount = parseEther("100");
    await brush.mint(alice, brushAmount);
    const erc1155 = await ethers.deployContract("TestERC1155", [royaltyReceiver]);
    return {...baseFixture, erc1155};
  }

  it("should allow listing an item", async () => {
    const {marketplace, players, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    // listing id is keccak256 of (sellerAddress, nftAddress, tokenId)
    const listingId = keccak256(
      solidityPacked(["address", "address", "uint256"], [bob.address, await playerNFT.getAddress(), newPlayerId])
    );

    await expect(marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1))
      .to.emit(marketplace, "Listed")
      .withArgs(listingId, bob.address, await playerNFT.getAddress(), newPlayerId, listingPrice, 1);
  });

  it("should revert on invalid price", async () => {
    const {marketplace, players, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("0");

    await expect(
      marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1)
    ).to.revertedWithCustomError(marketplace, "InvalidPrice");
  });

  it("should revert on invalid amount", async () => {
    const {marketplace, players, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    await expect(
      marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 0)
    ).to.revertedWithCustomError(marketplace, "InvalidAmount");
  });

  it("should revert on unowned token id", async () => {
    const {marketplace, players, playerNFT, bob, alice} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    await expect(
      marketplace.connect(alice).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1)
    ).to.revertedWithCustomError(marketplace, "InvalidAmount");
  });

  it("should revert on buying a non-existent listing", async () => {
    const {marketplace, players, playerNFT, bob} = await loadFixture(deployContracts);

    await expect(marketplace.connect(bob).buy(1, parseEther("1"), bob.address)).to.revertedWithCustomError(
      marketplace,
      "ListingDoesNotExist"
    );
  });

  it("should revert on cancelling a non-existent listing", async () => {
    const {marketplace, players, playerNFT, bob} = await loadFixture(deployContracts);

    await expect(marketplace.connect(bob).cancel(1)).to.revertedWithCustomError(marketplace, "ListingDoesNotExist");
  });

  it("should revert on attempting to safe cancel as non-nft contract", async () => {
    const {marketplace, players, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    await marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1);

    await expect(
      marketplace.connect(bob).contractCancel(bob.address, await playerNFT.getAddress(), newPlayerId)
    ).to.revertedWithCustomError(marketplace, "NotNFTContract");
  });

  it("can cancel a listed item", async () => {
    const {marketplace, players, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    // listing id is keccak256 of (sellerAddress, nftAddress, tokenId)
    const listingId = keccak256(
      solidityPacked(["address", "address", "uint256"], [bob.address, await playerNFT.getAddress(), newPlayerId])
    );

    await marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1);

    await expect(marketplace.connect(bob).cancel(listingId)).to.emit(marketplace, "Cancelled").withArgs(listingId);
  });

  it("should revert cancelling a non-owned listing", async () => {
    const {marketplace, players, playerNFT, alice, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    // listing id is keccak256 of (sellerAddress, nftAddress, tokenId)
    const listingId = keccak256(
      solidityPacked(["address", "address", "uint256"], [bob.address, await playerNFT.getAddress(), newPlayerId])
    );

    await marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1);

    await expect(marketplace.connect(alice).cancel(listingId)).to.revertedWithCustomError(marketplace, "NotSeller");
  });

  it("can safe cancel a listed item from nft contract", async () => {
    const {marketplace, players, playerNFT, bob} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    // listing id is keccak256 of (sellerAddress, nftAddress, tokenId)
    const listingId = keccak256(
      solidityPacked(["address", "address", "uint256"], [bob.address, await playerNFT.getAddress(), newPlayerId])
    );

    await marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1);

    const nftSigner = await makeSigner(playerNFT);
    await expect(marketplace.connect(nftSigner).contractCancel(bob.address, await playerNFT.getAddress(), newPlayerId))
      .to.emit(marketplace, "Cancelled")
      .withArgs(listingId);
  });

  it("can safe cancel a non-existent listing (silent return)", async () => {
    const {marketplace, players, playerNFT, bob} = await loadFixture(deployContracts);

    const nftSigner = await makeSigner(playerNFT);
    await expect(marketplace.connect(nftSigner).contractCancel(bob.address, await playerNFT.getAddress(), 1)).to.not.be
      .reverted;
  });

  it("can buy a listed item", async () => {
    const {marketplace, players, playerNFT, alice, bob, brush, royaltyReceiver} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    // listing id is keccak256 of (sellerAddress, nftAddress, tokenId)
    const listingId = keccak256(
      solidityPacked(["address", "address", "uint256"], [bob.address, await playerNFT.getAddress(), newPlayerId])
    );

    await marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1);
    await playerNFT.connect(bob).setApprovalForAll(marketplace, true);

    // check owner of nft is bob
    expect(await playerNFT.ownerOf(newPlayerId)).to.equal(bob.address);

    // approve brush to spend alice's funds
    await brush.connect(alice).approve(marketplace.getAddress(), listingPrice);

    const previousBrushBalanceBob = await brush.balanceOf(bob.address);
    const previousBrushBalanceAlice = await brush.balanceOf(alice.address);
    const previousBrushBalanceRoyalty = await brush.balanceOf(royaltyReceiver);

    await expect(marketplace.connect(alice).buy(listingId, listingPrice, alice.address))
      .to.emit(marketplace, "Sold")
      .withArgs(listingId, alice.address, bob.address, listingPrice, 1);

    // check owner of nft is now alice
    expect(await playerNFT.ownerOf(newPlayerId)).to.equal(alice.address);
    const finalBrushBalanceBob = await brush.balanceOf(bob.address);
    const finalBrushBalanceAlice = await brush.balanceOf(alice.address);
    const finalBrushBalanceRoyalty = await brush.balanceOf(royaltyReceiver);

    expect(finalBrushBalanceRoyalty).to.be.equal(previousBrushBalanceRoyalty + (listingPrice * 3n) / 100n); // 3% royalty
    expect(finalBrushBalanceBob).to.be.equal(previousBrushBalanceBob + (listingPrice * 97n) / 100n);
    expect(finalBrushBalanceAlice).to.be.equal(previousBrushBalanceAlice - listingPrice);
  });

  it("should revert on price frontrun", async () => {
    const {marketplace, players, playerNFT, alice, bob, brush, royaltyReceiver} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    // listing id is keccak256 of (sellerAddress, nftAddress, tokenId)
    const listingId = keccak256(
      solidityPacked(["address", "address", "uint256"], [bob.address, await playerNFT.getAddress(), newPlayerId])
    );

    await marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1);
    await playerNFT.connect(bob).setApprovalForAll(marketplace, true);

    // check owner of nft is bob
    expect(await playerNFT.ownerOf(newPlayerId)).to.equal(bob.address);

    // approve brush to spend alice's funds
    await brush.connect(alice).approve(marketplace.getAddress(), listingPrice);

    await expect(
      marketplace.connect(alice).buy(listingId, parseEther("0.5"), alice.address)
    ).to.revertedWithCustomError(marketplace, "InvalidPrice");
  });

  it("should extract brush from sender not receiver", async () => {
    const {marketplace, players, playerNFT, alice, bob, charlie, brush} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    // listing id is keccak256 of (sellerAddress, nftAddress, tokenId)
    const listingId = keccak256(
      solidityPacked(["address", "address", "uint256"], [bob.address, await playerNFT.getAddress(), newPlayerId])
    );

    await marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1);
    await playerNFT.connect(bob).setApprovalForAll(marketplace, true);

    // check owner of nft is bob
    expect(await playerNFT.ownerOf(newPlayerId)).to.equal(bob.address);

    // approve brush to spend alice's funds
    await brush.connect(alice).approve(marketplace.getAddress(), listingPrice);

    const previousBrushBalanceBob = await brush.balanceOf(bob.address);
    const previousBrushBalanceAlice = await brush.balanceOf(alice.address);

    await expect(marketplace.connect(alice).buy(listingId, listingPrice, charlie.address))
      .to.emit(marketplace, "Sold")
      .withArgs(listingId, alice.address, bob.address, listingPrice, 1);

    // check owner of nft is now alice
    expect(await playerNFT.ownerOf(newPlayerId)).to.equal(charlie.address);
    const finalBrushBalanceBob = await brush.balanceOf(bob.address);
    const finalBrushBalanceAlice = await brush.balanceOf(alice.address);

    expect(finalBrushBalanceBob).to.be.greaterThan(previousBrushBalanceBob);
    expect(finalBrushBalanceAlice).to.be.lessThan(previousBrushBalanceAlice);
  });

  it("should revert on all re-entrancy attempts", async () => {
    const {marketplace, players, playerNFT, alice, bob, brush, owner, erc1155} = await loadFixture(deployContracts);

    const maliciousReentrancy = new ethers.Contract(
      (await ethers.deployContract("TestMaliciousReentrancy", [marketplace.target])).target,
      (await ethers.getContractFactory("Marketplace")).interface,
      owner
    ) as unknown as Marketplace;

    const tokenId = 1;
    const initialQuantity = 10n;
    const listingPrice = parseEther("1");

    const listingId = keccak256(
      solidityPacked(["address", "address", "uint256"], [bob.address, await erc1155.getAddress(), tokenId])
    );

    const maliciousReentrancySigner = await ethers.getImpersonatedSigner(await maliciousReentrancy.getAddress());
    await brush.mint(maliciousReentrancySigner, parseEther("10"));
    await erc1155.mintSpecificId(bob, tokenId, initialQuantity * 2n);
    await brush.connect(maliciousReentrancySigner).approve(marketplace.getAddress(), listingPrice);

    await marketplace.connect(bob).list(await erc1155.getAddress(), tokenId, listingPrice, initialQuantity);
    await erc1155.connect(bob).setApprovalForAll(marketplace, true);

    // Route the buy through the malicious proxy (fallback) so reentrancy runs inside onERC1155Received
    await expect(
      maliciousReentrancy
        .connect(maliciousReentrancySigner)
        .buy(listingId, listingPrice, maliciousReentrancySigner.address)
    ).to.revertedWithCustomError(marketplace, "ListingDoesNotExist");
  });

  it("cancels the listing automatically on transfer", async () => {
    const {marketplace, players, playerNFT, alice, bob, brush} = await loadFixture(deployContracts);

    const newPlayerId = await createPlayer(playerNFT, 1, bob, "New name", true);
    const listingPrice = parseEther("1");

    // listing id is keccak256 of (sellerAddress, nftAddress, tokenId)
    const listingId = keccak256(
      solidityPacked(["address", "address", "uint256"], [bob.address, await playerNFT.getAddress(), newPlayerId])
    );

    await marketplace.connect(bob).list(await playerNFT.getAddress(), newPlayerId, listingPrice, 1);
    await playerNFT.connect(bob).setApprovalForAll(marketplace, true);

    // check owner of nft is bob
    expect(await playerNFT.ownerOf(newPlayerId)).to.equal(bob.address);

    await expect(playerNFT.connect(bob).safeTransferFrom(bob.address, alice.address, newPlayerId, 1, "0x"))
      .to.emit(marketplace, "Cancelled")
      .withArgs(listingId);
    // check owner of nft is now alice
    expect(await playerNFT.ownerOf(newPlayerId)).to.equal(alice.address);

    await expect(marketplace.connect(bob).cancel(1)).to.revertedWithCustomError(marketplace, "ListingDoesNotExist");
  });
});
