import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {playersFixture} from "./Players/PlayersFixture";
import {BasePetInput, PetEnhancementType, PetSkin, Skill} from "@paintswap/estfor-definitions/types";
import {ethers, upgrades} from "hardhat";
import {PetNFT} from "../typechain-types";

describe("PetNFT", function () {
  async function deployContracts() {
    const baseFixture = await loadFixture(playersFixture);
    return {...baseFixture};
  }

  const PET_PREFIX = "Pet ";
  const petId = 1;
  const tier = 2;
  const baseId = 3;

  const pet: BasePetInput = {
    description: "",
    tier,
    skin: PetSkin.TESTER,
    enhancementType: PetEnhancementType.MELEE,
    baseId,
    skillEnhancements: [Skill.MELEE, Skill.NONE],
    percentageMins: [5, 0],
    percentageMaxs: [10, 0],
    percentageIncrements: [1, 0],
  };

  it("Must be a minter to mint", async function () {
    const {petNFT, frank} = await loadFixture(deployContracts);
    await expect(petNFT.connect(frank).mint(frank.address, 1, 1)).to.be.revertedWithCustomError(petNFT, "NotMinter");
  });

  it("Mint a standard pet", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);

    const randomWord = 1;
    await petNFT.addBasePets([pet]);
    await petNFT.connect(alice).mint(alice.address, baseId, randomWord);
    expect(await petNFT.nextPetId()).to.eq(2);
    expect(await petNFT.balanceOf(alice.address, petId)).to.eq(1);
  });

  it("TODO Edit Name, check that it cannot start with PET_PREFIX", async function () {});

  it("uri", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);
    const randomWord = 1;
    await petNFT.addBasePets([pet]);
    await petNFT.connect(alice).mint(alice.address, baseId, randomWord);
    const uri = await petNFT.uri(petId);

    const skin = "Tester";
    const enhancementType = "Melee";
    const skill = "Melee";

    expect(uri.startsWith("data:application/json;base64")).to.be.true;
    const metadata = JSON.parse(Buffer.from(uri.split(";base64,")[1], "base64").toString());
    expect(metadata).to.have.property("name");
    expect(metadata.name).to.eq(`${PET_PREFIX}${petId} (T${tier})`);
    expect(metadata.image).to.eq(`ipfs://Tester_${tier}_${enhancementType}.jpg`);
    expect(metadata).to.have.property("attributes");
    expect(metadata.attributes).to.be.an("array");
    expect(metadata.attributes).to.have.length(7);
    expect(metadata.attributes[0]).to.have.property("trait_type");
    expect(metadata.attributes[0].trait_type).to.equal("Skin");
    expect(metadata.attributes[0]).to.have.property("value");
    expect(metadata.attributes[0].value).to.equal(skin);
    expect(metadata.attributes[1]).to.have.property("trait_type");
    expect(metadata.attributes[1].trait_type).to.equal("Tier");
    expect(metadata.attributes[1]).to.have.property("value");
    expect(metadata.attributes[1].value).to.eq(tier);
    expect(metadata.attributes[2]).to.have.property("trait_type");
    expect(metadata.attributes[2].trait_type).to.equal("Enhancement type");
    expect(metadata.attributes[2]).to.have.property("value");
    expect(metadata.attributes[2].value).to.equal(enhancementType);
    expect(metadata.attributes[3]).to.have.property("trait_type");
    expect(metadata.attributes[3].trait_type).to.equal("Skill bonus #1");
    expect(metadata.attributes[3]).to.have.property("value");
    expect(metadata.attributes[3].value).to.equal(skill);
    expect(metadata.attributes[4].trait_type).to.equal("Percent increase #1");
    expect(metadata.attributes[4]).to.have.property("value");
    expect(metadata.attributes[4].value).to.equal(pet.percentageMins[0] + randomWord);
    expect(metadata.attributes[5].trait_type).to.equal("Skill bonus #2");
    expect(metadata.attributes[5]).to.have.property("value");
    expect(metadata.attributes[5].value).to.equal("None");
    expect(metadata.attributes[6].trait_type).to.equal("Percent increase #2");
    expect(metadata.attributes[6]).to.have.property("value");
    expect(metadata.attributes[6].value).to.equal(0);
    expect(metadata).to.have.property("external_url");
    expect(metadata.external_url).to.eq(`https://beta.estfor.com`);
  });

  it("Mint non-existent pet", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);
    const randomWord = 1;
    await expect(petNFT.connect(alice).mint(alice.address, baseId, randomWord)).to.be.revertedWithCustomError(
      petNFT,
      "PetDoesNotExist"
    );
  });

  it("external_url when not in beta", async function () {
    const {adminAccess, brush, dev, royaltyReceiver, estforLibrary, alice} = await loadFixture(deployContracts);

    // Confirm that external_url points to main estfor site
    const isBeta = false;
    const editNameCost = ethers.utils.parseEther("1");
    const PetNFT = await ethers.getContractFactory("PetNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    });
    const imageBaseUri = "ipfs://";
    const petNFTNotBeta = (await upgrades.deployProxy(
      PetNFT,
      [brush.address, royaltyReceiver.address, imageBaseUri, dev.address, editNameCost, adminAccess.address, isBeta],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"],
      }
    )) as PetNFT;

    const randomWord = 1;
    await petNFTNotBeta.addBasePets([pet]);
    await petNFTNotBeta.setPlayers(alice.address);
    await petNFTNotBeta.connect(alice).mint(alice.address, baseId, randomWord);

    const uriNotBeta = await petNFTNotBeta.uri(petId);
    const metadataNotBeta = JSON.parse(Buffer.from(uriNotBeta.split(";base64,")[1], "base64").toString());
    expect(metadataNotBeta.external_url).to.eq(`https://estfor.com`);
  });

  describe("supportsInterface", async function () {
    it("IERC165", async function () {
      const {petNFT} = await loadFixture(deployContracts);
      expect(await petNFT.supportsInterface("0x01ffc9a7")).to.be.true;
    });

    it("IERC1155", async function () {
      const {petNFT} = await loadFixture(deployContracts);
      expect(await petNFT.supportsInterface("0xd9b67a26")).to.be.true;
    });

    it("IERC1155Metadata", async function () {
      const {petNFT} = await loadFixture(deployContracts);
      expect(await petNFT.supportsInterface("0x0e89341c")).to.be.true;
    });

    it("IERC2981 royalties", async function () {
      const {petNFT} = await loadFixture(deployContracts);
      expect(await petNFT.supportsInterface("0x2a55205a")).to.be.true;
    });
  });

  it("name & symbol", async function () {
    const {petNFT, adminAccess, brush, dev, royaltyReceiver, estforLibrary} = await loadFixture(deployContracts);
    expect(await petNFT.name()).to.be.eq("Estfor Pets (Beta)");
    expect(await petNFT.symbol()).to.be.eq("EK_PETS_B");

    const isBeta = false;
    const editNameCost = ethers.utils.parseEther("1");
    const PetNFT = await ethers.getContractFactory("PetNFT", {
      libraries: {EstforLibrary: estforLibrary.address},
    });
    const imageBaseUri = "ipfs://";
    const petNFTNotBeta = (await upgrades.deployProxy(
      PetNFT,
      [brush.address, royaltyReceiver.address, imageBaseUri, dev.address, editNameCost, adminAccess.address, isBeta],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"],
      }
    )) as PetNFT;

    expect(await petNFTNotBeta.name()).to.be.eq("Estfor Pets");
    expect(await petNFTNotBeta.symbol()).to.be.eq("EK_PETS");
  });

  it("totalSupply", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);

    expect(await petNFT["totalSupply()"]()).to.be.eq(0);
    const randomWord = 1;
    await petNFT.addBasePets([pet]);
    await petNFT.connect(alice).mint(alice.address, baseId, randomWord);
    await petNFT.connect(alice).mint(alice.address, baseId, randomWord);
    expect(await petNFT["totalSupply()"]()).to.be.eq(2);
    expect(await petNFT["totalSupply(uint256)"](1)).to.be.eq(1);
    expect(await petNFT["totalSupply(uint256)"](2)).to.be.eq(1);
    await petNFT.connect(alice).burn(alice.address, 1);
    expect(await petNFT["totalSupply()"]()).to.be.eq(1);
    expect(await petNFT["totalSupply(uint256)"](1)).to.be.eq(0);
    await petNFT.connect(alice).burn(alice.address, 2);
    expect(await petNFT["totalSupply()"]()).to.be.eq(0);
    expect(await petNFT["totalSupply(uint256)"](2)).to.be.eq(0);
  });
});
