import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";
import {TestSamWitchERC1155UpgradeableSinglePerToken} from "../typechain-types";

// Test stuff like mint/burn/transfer/balanceOf/totalSupply. The rest should be covered by the normal OZ ERC1155 tests.
describe("SamWitchERC1155UpgradeableSinglePerToken", function () {
  const firstTokenId = 1;
  const secondTokenId = 2;
  const unknownTokenId = 3;

  const firstAmount = 1;
  const secondAmount = 1;
  async function deployContracts() {
    const [owner, alice] = await ethers.getSigners();
    const ERC1155UpgradeableSinglePerToken = await ethers.getContractFactory(
      "TestSamWitchERC1155UpgradeableSinglePerToken"
    );
    const erc1155UpgradeableSinglePerToken = (await upgrades.deployProxy(ERC1155UpgradeableSinglePerToken, [], {
      kind: "uups"
    })) as unknown as TestSamWitchERC1155UpgradeableSinglePerToken;
    return {owner, alice, erc1155UpgradeableSinglePerToken};
  }

  describe("balanceOf", function () {
    // it("reverts when queried about the zero address", async function () {
    //   const {erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
    //   await expect(erc1155UpgradeableSinglePerToken.balanceOf(ZeroAddress, firstTokenId)).to.be.revertedWithCustomError(
    //     erc1155UpgradeableSinglePerToken,
    //     "ERC1155InsufficientBalance"
    //   );
    // });

    it("returns zero for given addresses when accounts don't own tokens", async function () {
      const {owner, alice, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(alice, secondTokenId)).to.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, unknownTokenId)).to.eq(0);
    });

    it("returns the amount of tokens owned by the given addresses when accounts own some tokens", async function () {
      const {owner, alice, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(0);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, 1, "0x");

      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(firstAmount);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(alice, secondTokenId)).to.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, unknownTokenId)).to.eq(0);
    });
  });

  describe("balanceOfBatch", function () {
    it("returns zeros for each account when they own no tokens", async function () {
      const {owner, alice, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      const result = await erc1155UpgradeableSinglePerToken.balanceOfBatch(
        [owner, alice, owner],
        [firstTokenId, secondTokenId, unknownTokenId]
      );
      expect(result).to.be.an("array");
      expect(result).to.deep.eq([0, 0, 0]);
    });

    it("when accounts own some tokens return correctly", async function () {
      const {owner, alice, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");
      await erc1155UpgradeableSinglePerToken.mint(alice, secondTokenId, secondAmount, "0x");

      const result = await erc1155UpgradeableSinglePerToken.balanceOfBatch(
        [alice, owner, owner],
        [secondTokenId, firstTokenId, unknownTokenId]
      );
      expect(result).to.be.an("array");
      expect(result).to.deep.eq([secondAmount, firstAmount, 0]);
    });

    it("returns multiple times the balance of the same address when asked", async function () {
      const {owner, alice, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");
      await erc1155UpgradeableSinglePerToken.mint(alice, secondTokenId, secondAmount, "0x");

      const result = await erc1155UpgradeableSinglePerToken.balanceOfBatch(
        [alice, alice, owner],
        [secondTokenId, secondTokenId, firstTokenId]
      );

      expect(result).to.be.an("array");
      expect(result[0]).to.eq(result[2]);
      expect(result).to.deep.eq([firstAmount, secondAmount, firstAmount]);
    });
  });

  describe("safeTransferFrom", function () {
    it("reverts when transferring more than balance", async function () {
      const {owner, alice, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");
      await expect(
        erc1155UpgradeableSinglePerToken.safeTransferFrom(owner, alice, firstTokenId, firstAmount + 1, "0x")
      ).to.be.revertedWithCustomError(erc1155UpgradeableSinglePerToken, "ERC1155InsufficientBalance");
    });

    it("Transfer correct amount should work", async function () {
      const {owner, alice, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");

      await erc1155UpgradeableSinglePerToken.safeTransferFrom(owner, alice, firstTokenId, firstAmount, "0x");

      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(alice, firstTokenId)).to.eq(1);
      // Transfer again
      await erc1155UpgradeableSinglePerToken
        .connect(alice)
        .safeTransferFrom(alice, owner, firstTokenId, firstAmount, "0x");

      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(alice, firstTokenId)).to.eq(0);
    });
  });

  describe("safeBatchTransferFrom", function () {
    it("reverts when transferring more than balance", async function () {
      const {owner, alice, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mintBatch(
        owner,
        [firstTokenId, secondTokenId],
        [firstAmount, secondAmount],
        "0x"
      );
      await expect(
        erc1155UpgradeableSinglePerToken.safeBatchTransferFrom(owner, alice, [firstTokenId], [firstAmount + 1], "0x")
      ).to.be.revertedWithCustomError(erc1155UpgradeableSinglePerToken, "ERC1155InsufficientBalance");
    });

    it("Transfer correct amount should work", async function () {
      const {owner, alice, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mintBatch(
        owner,
        [firstTokenId, secondTokenId],
        [firstAmount, secondAmount],
        "0x"
      );
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(1);
      await erc1155UpgradeableSinglePerToken.safeBatchTransferFrom(
        owner,
        alice,
        [firstTokenId, secondTokenId],
        [firstAmount, secondAmount],
        "0x"
      );
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(0);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(2);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](secondTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(alice, firstTokenId)).to.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, secondTokenId)).to.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(alice, secondTokenId)).to.eq(1);

      // Transfer again
      await erc1155UpgradeableSinglePerToken
        .connect(alice)
        .safeBatchTransferFrom(alice, owner, [firstTokenId, secondTokenId], [firstAmount, secondAmount], "0x");

      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(2);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](secondTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(alice, firstTokenId)).to.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, secondTokenId)).to.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(alice, secondTokenId)).to.eq(0);
    });
  });

  describe("mint", function () {
    it("reverts when minting more than 1 at once", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await expect(
        erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount + 1, "0x")
      ).to.be.revertedWithCustomError(erc1155UpgradeableSinglePerToken, "ERC1155MintingMoreThanOneSameNFT");
    });

    it("reverts when minting more than 1 during separate mints", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");
      await expect(
        erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x")
      ).to.be.revertedWithCustomError(erc1155UpgradeableSinglePerToken, "ERC1155MintingMoreThanOneSameNFT");
    });

    it("Minting should add to totalSupply correctly", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");

      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](secondTokenId)).to.be.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(1);

      await erc1155UpgradeableSinglePerToken.mint(owner, secondTokenId, secondAmount, "0x");
      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(2);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](secondTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, secondTokenId)).to.eq(1);
    });
  });

  describe("mintBatch", function () {
    it("reverts when minting more than balance", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await expect(
        erc1155UpgradeableSinglePerToken.mintBatch(
          owner,
          [firstTokenId, secondTokenId],
          [firstAmount, secondAmount + 1],
          "0x"
        )
      ).to.be.revertedWithCustomError(erc1155UpgradeableSinglePerToken, "ERC1155MintingMoreThanOneSameNFT");
    });

    it("reverts when minting more than 1 during separate mints", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mintBatch(owner, [firstTokenId], [firstAmount], "0x");
      await expect(
        erc1155UpgradeableSinglePerToken.mintBatch(owner, [firstTokenId], [firstAmount], "0x")
      ).to.be.revertedWithCustomError(erc1155UpgradeableSinglePerToken, "ERC1155MintingMoreThanOneSameNFT");
    });

    it("Minting should add to totalSupply correctly", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mintBatch(owner, [firstTokenId], [firstAmount], "0x");

      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](secondTokenId)).to.be.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(1);

      await erc1155UpgradeableSinglePerToken.mintBatch(owner, [secondTokenId], [secondAmount], "0x");
      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(2);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](secondTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, secondTokenId)).to.eq(1);
    });
  });

  describe("burn", function () {
    it("reverts when burning more than balance", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");

      await expect(
        erc1155UpgradeableSinglePerToken.burn(owner, firstTokenId, firstAmount + 1)
      ).to.be.revertedWithCustomError(erc1155UpgradeableSinglePerToken, "ERC1155InsufficientBalance");
    });

    it("Burning should remove from totalSupply and remove balance", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");

      await erc1155UpgradeableSinglePerToken.burn(owner, firstTokenId, firstAmount);

      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(0);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, secondTokenId)).to.eq(0);
    });

    it("Burning with dead address should not remove from totalSupply and remove balance", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");

      await erc1155UpgradeableSinglePerToken.safeTransferFrom(
        owner,
        "0x000000000000000000000000000000000000dEaD",
        firstTokenId,
        firstAmount,
        "0x"
      );

      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(firstAmount);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(firstAmount);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(0);
    });

    it("Reminting after burning should work fine", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");

      await erc1155UpgradeableSinglePerToken.burn(owner, firstTokenId, firstAmount);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(0);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(0);

      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");
      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(1);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(1);
    });
  });

  describe("burnBatch", function () {
    it("reverts when burning more than balance", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");

      await expect(erc1155UpgradeableSinglePerToken.burnBatch(owner, [secondTokenId])).to.be.revertedWithCustomError(
        erc1155UpgradeableSinglePerToken,
        "ERC1155InsufficientBalance"
      );
    });

    it("Burning should remove from totalSupply and remove balance", async function () {
      const {owner, erc1155UpgradeableSinglePerToken} = await loadFixture(deployContracts);
      await erc1155UpgradeableSinglePerToken.mint(owner, firstTokenId, firstAmount, "0x");

      await erc1155UpgradeableSinglePerToken.burnBatch(owner, [firstTokenId]);

      expect(await erc1155UpgradeableSinglePerToken["totalSupply()"]()).to.be.eq(0);
      expect(await erc1155UpgradeableSinglePerToken["totalSupply(uint256)"](firstTokenId)).to.be.eq(0);
      expect(await erc1155UpgradeableSinglePerToken.balanceOf(owner, firstTokenId)).to.eq(0);
    });
  });
});
