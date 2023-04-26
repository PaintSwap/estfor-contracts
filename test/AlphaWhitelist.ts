import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {whitelistedAdmins, whitelistedSnapshot} from "@paintswap/estfor-definitions/constants";
import {Skill} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {ethers} from "hardhat";
import {MerkleTreeWhitelist} from "../scripts/MerkleTreeWhitelist";
import {AvatarInfo} from "../scripts/utils";
import {playersFixture} from "./Players/PlayersFixture";

describe("AlphaWhitelist", function () {
  async function deployContracts() {
    const fixture = await loadFixture(playersFixture);
    return {...fixture};
  }

  it("Merkle proof minting", async function () {
    const {owner, playerNFT, alice} = await loadFixture(deployContracts);

    const whitelistAddresses = [
      "0xa801864d0D24686B15682261aa05D4e1e6e5BD94",
      "0xBa00694692267ed0B5154d48Fcb4D435D0B24d3F",
      owner.address,
    ];

    const treeWhitelist = new MerkleTreeWhitelist(whitelistAddresses);
    const root = treeWhitelist.getRoot();
    await playerNFT.setMerkleRoot(root);
    const proof = treeWhitelist.getProof(owner.address);
    expect(await playerNFT.checkInWhitelist(proof)).to.be.true;
    expect(await playerNFT.connect(alice).checkInWhitelist(proof)).to.be.false;

    const avatarId = 1;
    const avatarInfo: AvatarInfo = {
      name: "Name goes here",
      description: "Hi I'm a description",
      imageURI: "1234.png",
      startSkills: [Skill.MAGIC, Skill.NONE],
    };
    await playerNFT.setAvatars(avatarId, [avatarInfo]);

    const maxMints = await playerNFT.MAX_ALPHA_WHITELIST();
    for (let i = 0; i < maxMints.toNumber(); ++i) {
      const name = `name${i}`;
      await playerNFT.mintWhitelist(1, name, true, proof);
    }

    const newName = "Cheesy poofs";
    await expect(playerNFT.mintWhitelist(1, newName, true, proof)).to.be.revertedWithCustomError(
      playerNFT,
      "MintedMoreThanAllowed"
    );
    await expect(playerNFT.connect(alice).mintWhitelist(1, newName, true, proof)).to.be.revertedWithCustomError(
      playerNFT,
      "NotInWhitelist"
    );
  });

  it("Read from library", async function () {
    expect(whitelistedSnapshot.find((el) => el == "0x003c06a6168e9d2474e2c7f588d819b75f8025e5")).to.not.be.undefined;
    expect(whitelistedAdmins.find((el) => el == "0x316342122a9ae36de41b231260579b92f4c8be7f")).to.not.be.undefined;
  });
});
