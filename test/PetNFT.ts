import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {playersFixture} from "./Players/PlayersFixture";
import {BasePetInput, PetEnhancementType, PetSkin, Skill} from "@paintswap/estfor-definitions/types";
import {upgrades} from "hardhat";
import {PetNFT} from "../typechain-types";
import {getXPFromLevel} from "./Players/utils";
import {parseEther} from "ethers";

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
    skin: PetSkin.OG,
    enhancementType: PetEnhancementType.MELEE,
    baseId,
    skillEnhancements: [Skill.MELEE, Skill.DEFENCE],
    skillFixedMins: [0, 0],
    skillFixedMaxs: [0, 0],
    skillFixedIncrements: [1, 0],
    skillPercentageMins: [5, 10],
    skillPercentageMaxs: [10, 20],
    skillPercentageIncrements: [1, 1],
    skillMinLevels: [1, 0],
    fixedStarThreshold: 1,
    percentageStarThreshold: 1
  };

  it("Must be a minter to mint", async function () {
    const {petNFT, frank} = await loadFixture(deployContracts);
    await expect(petNFT.connect(frank).mintBatch(frank.address, [1], [1])).to.be.revertedWithCustomError(
      petNFT,
      "NotMinter"
    );
  });

  it("Mint a standard pet", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);

    const randomWord = 1;
    await petNFT.addBasePets([pet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
    expect(await petNFT.getNextPetId()).to.eq(2);
    expect(await petNFT.balanceOf(alice.address, petId)).to.eq(1);
  });

  it("uri", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);
    const randomWord = 1;
    await petNFT.addBasePets([pet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
    const uri = await petNFT.uri(petId);

    const skin = "OG";
    const enhancementType = "Melee";
    const skill = "Melee";

    expect(uri.startsWith("data:application/json;base64")).to.be.true;
    const metadata = JSON.parse(Buffer.from(uri.split(";base64,")[1], "base64").toString());
    expect(metadata).to.have.property("name");
    expect(metadata.name).to.eq(`${PET_PREFIX}${petId} (T${tier})`);
    expect(metadata.image).to.eq(`ipfs://${skin}_${tier}_${enhancementType}.jpg`);
    expect(metadata).to.have.property("attributes");
    expect(metadata.attributes).to.be.an("array");
    expect(metadata.attributes).to.have.length(11);
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
    expect(metadata.attributes[4].trait_type).to.equal("Fixed increase #1");
    expect(metadata.attributes[4]).to.have.property("value");
    expect(metadata.attributes[4].value).to.equal(0);
    expect(metadata.attributes[5].trait_type).to.equal("Percent increase #1");
    expect(metadata.attributes[5]).to.have.property("value");
    expect(metadata.attributes[5].value).to.equal(pet.skillPercentageMins[0] + randomWord);
    expect(metadata.attributes[6].trait_type).to.equal("Skill bonus #2");
    expect(metadata.attributes[6]).to.have.property("value");
    expect(metadata.attributes[6].value).to.equal("Defence");
    expect(metadata.attributes[7].trait_type).to.equal("Fixed increase #2");
    expect(metadata.attributes[7]).to.have.property("value");
    expect(metadata.attributes[7].value).to.equal(0);
    expect(metadata.attributes[8].trait_type).to.equal("Percent increase #2");
    expect(metadata.attributes[8]).to.have.property("value");
    expect(metadata.attributes[8].value).to.equal(10);
    expect(metadata.attributes[9].trait_type).to.equal("Fixed Star");
    expect(metadata.attributes[9]).to.have.property("value");
    expect(metadata.attributes[9].value).to.equal("false");
    expect(metadata.attributes[10].trait_type).to.equal("Percent Star");
    expect(metadata.attributes[10]).to.have.property("value");
    expect(metadata.attributes[10].value).to.equal("true");

    expect(metadata).to.have.property("external_url");
    expect(metadata.external_url).to.eq(`https://beta.estfor.com`);
  });

  it("Mint non-existent pet", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);
    const randomWord = 1;
    await expect(petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord])).to.be.revertedWithCustomError(
      petNFT,
      "PetDoesNotExist"
    );
  });

  it("external_url when not in beta", async function () {
    const {adminAccess, brush, treasury, dev, royaltyReceiver, alice, PetNFT} = await loadFixture(deployContracts);

    // Confirm that external_url points to main estfor site
    const isBeta = false;
    const editNameCost = parseEther("1");
    const imageBaseUri = "ipfs://";
    const petNFTNotBeta = (await upgrades.deployProxy(
      PetNFT,
      [
        await brush.getAddress(),
        await royaltyReceiver.getAddress(),
        imageBaseUri,
        dev.address,
        editNameCost,
        await treasury.getAddress(),
        await adminAccess.getAddress(),
        isBeta
      ],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"]
      }
    )) as unknown as PetNFT;

    const randomWord = 1;
    await petNFTNotBeta.addBasePets([pet]);
    await expect(petNFTNotBeta.mintBatch(alice.address, [baseId], [randomWord])).to.be.revertedWithCustomError(
      petNFTNotBeta,
      "NotMinter"
    );
    await petNFTNotBeta.setInstantVRFActions(alice.address);
    await petNFTNotBeta.connect(alice).mintBatch(alice.address, [baseId], [randomWord]);

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
    const {petNFT, adminAccess, brush, dev, royaltyReceiver, treasury, PetNFT} = await loadFixture(deployContracts);
    expect(await petNFT.name()).to.be.eq("Estfor Pets (Beta)");
    expect(await petNFT.symbol()).to.be.eq("EK_PETS_B");

    const isBeta = false;
    const editNameCost = parseEther("1");
    const imageBaseUri = "ipfs://";
    const petNFTNotBeta = (await upgrades.deployProxy(
      PetNFT,
      [
        await brush.getAddress(),
        await royaltyReceiver.getAddress(),
        imageBaseUri,
        dev.address,
        editNameCost,
        await treasury.getAddress(),
        await adminAccess.getAddress(),
        isBeta
      ],
      {
        kind: "uups",
        unsafeAllow: ["external-library-linking"]
      }
    )) as unknown as PetNFT;

    expect(await petNFTNotBeta.name()).to.be.eq("Estfor Pets");
    expect(await petNFTNotBeta.symbol()).to.be.eq("EK_PETS");
  });

  it("Must own pet to assign", async function () {
    const {petNFT, playerId, alice} = await loadFixture(deployContracts);

    await expect(petNFT.connect(alice).assignPet(alice.address, playerId, petId, 0)).to.be.revertedWithCustomError(
      petNFT,
      "PlayerDoesNotOwnPet"
    );
  });

  it("Check min levels are respected", async function () {
    const {petNFT, players, playerId, alice} = await loadFixture(deployContracts);

    const randomWord = 0;
    const modifiedPet = deepClonePet(pet);
    modifiedPet.skillMinLevels[0] = 2;
    await petNFT.addBasePets([modifiedPet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);

    await expect(petNFT.connect(alice).assignPet(alice.address, playerId, petId, 0)).to.be.revertedWithCustomError(
      petNFT,
      "LevelNotHighEnough"
    );

    await players.connect(alice).testModifyXP(alice.address, playerId, Skill.MELEE, getXPFromLevel(2), true);
    await expect(petNFT.connect(alice).assignPet(alice.address, playerId, petId, 0)).to.not.be.reverted;
  });

  it("Must be players or admin and beta to call assign pet", async function () {
    const {petNFT, playerId, alice, bob} = await loadFixture(deployContracts);

    const randomWord = 0;
    const modifiedPet = deepClonePet(pet);
    await petNFT.addBasePets([modifiedPet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);

    await expect(petNFT.assignPet(alice.address, playerId, petId, 0)).to.not.be.revertedWithCustomError(
      petNFT,
      "NotPlayersOrAdminAndBeta"
    );

    await expect(petNFT.assignPet(alice.address, playerId, petId, 0)).to.not.be.revertedWithCustomError(
      petNFT,
      "NotPlayersOrAdminAndBeta"
    );

    await petNFT.setPlayers(bob.address);
    await expect(petNFT.connect(bob).assignPet(alice.address, playerId, petId, 0)).to.not.be.revertedWithCustomError(
      petNFT,
      "NotPlayersOrAdminAndBeta"
    );
  });

  it("Check 0 for both percentage and fixed reverts", async function () {
    const {petNFT, playerId, alice} = await loadFixture(deployContracts);

    const randomWord = 0;
    const modifiedPet = deepClonePet(pet);
    modifiedPet.skillPercentageMins[0] = 0;
    modifiedPet.skillPercentageMaxs[0] = 0;
    await expect(petNFT.addBasePets([modifiedPet])).to.be.revertedWithCustomError(
      petNFT,
      "MustHaveAtLeastPercentageOrFixedSet"
    );

    modifiedPet.skillPercentageMins[0] = 1;
    modifiedPet.skillPercentageMaxs[0] = 10;
    modifiedPet.skillFixedMins[0] = 0;
    modifiedPet.skillFixedMaxs[0] = 0;
    await petNFT.addBasePets([modifiedPet]);

    await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
    await expect(petNFT.assignPet(alice.address, playerId, petId, 0)).to.not.be.reverted;
  });

  it("Check 0 for fixed or percentage does not revert", async function () {
    const {petNFT, playerId, alice} = await loadFixture(deployContracts);

    const randomWord = 0;
    const modifiedPet = deepClonePet(pet);
    await petNFT.addBasePets([modifiedPet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
    await expect(petNFT.assignPet(alice.address, playerId, petId, 0)).to.not.be.reverted;

    // 0 percentage min/max is fine
    modifiedPet.skillPercentageMins[0] = 0;
    modifiedPet.skillPercentageMaxs[0] = 0;
    modifiedPet.skillFixedMaxs[0] = 1;
    await petNFT.editBasePets([modifiedPet]);
    await expect(petNFT.assignPet(alice.address, playerId, petId, 0)).to.not.be.reverted;

    // Check second enhancement too
    modifiedPet.skillFixedMaxs[1] = 1;
    await expect(petNFT.editBasePets([modifiedPet])).to.be.revertedWithCustomError(
      petNFT,
      "SkillFixedIncrementCannotBeZero"
    );
    modifiedPet.skillFixedIncrements[1] = 1;
    await expect(petNFT.editBasePets([modifiedPet])).to.not.be.reverted;

    modifiedPet.skillFixedMaxs[1] = 0;
    modifiedPet.skillPercentageIncrements[1] = 0;
    await expect(petNFT.editBasePets([modifiedPet])).to.be.revertedWithCustomError(
      petNFT,
      "SkillPercentageIncrementCannotBeZero"
    );

    modifiedPet.skillPercentageIncrements[1] = 1;
    await petNFT.editBasePets([modifiedPet]);
    await expect(petNFT.assignPet(alice.address, playerId, petId, 0)).to.not.be.reverted;
  });

  describe("Editing", function () {
    it("Edit pet name", async function () {
      const {petNFT, playerId, brush, editNameBrushPrice, owner, alice} = await loadFixture(deployContracts);

      const name = "My pet name is1";
      await brush.connect(alice).approve(petNFT, editNameBrushPrice * 3n);

      const randomWord = 0;
      await petNFT.addBasePets([pet]);
      await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);

      await expect(petNFT.connect(alice).editPet(playerId, petId, name)).to.be.revertedWithCustomError(
        brush,
        "ERC20InsufficientBalance"
      );
      await brush.mint(alice.address, editNameBrushPrice * 3n);

      await expect(petNFT.connect(alice).editPet(playerId + 1n, petId, name)).to.be.revertedWithCustomError(
        petNFT,
        "NotOwnerOfPlayer"
      );

      await petNFT.connect(alice).safeTransferFrom(alice.address, owner.address, petId, 1, "0x");
      await expect(petNFT.connect(alice).editPet(playerId, petId, name)).to.be.revertedWithCustomError(
        petNFT,
        "NotOwnerOfPet"
      );
      await petNFT.safeTransferFrom(owner.address, alice.address, petId, 1, "0x");
      await expect(petNFT.connect(alice).editPet(playerId, petId, name))
        .to.emit(petNFT, "EditPlayerPet")
        .withArgs(playerId, petId, alice.address, name);

      await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
      await expect(petNFT.connect(alice).editPet(playerId, petId + 1, name)).to.be.revertedWithCustomError(
        petNFT,
        "NameAlreadyExists"
      );
    });

    it("Changing from previous name should relinquish it", async function () {
      const {petNFT, playerId, brush, editNameBrushPrice, alice} = await loadFixture(deployContracts);

      await brush.connect(alice).approve(petNFT, editNameBrushPrice * 3n);
      const randomWord = 0;
      await petNFT.addBasePets([pet]);
      await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
      await brush.mint(alice.address, editNameBrushPrice * 3n);

      const newName = "CHOO CHOO";
      await petNFT.connect(alice).editPet(playerId, petId, newName);
      await petNFT.connect(alice).editPet(playerId, petId, newName + "1");
      await expect(petNFT.connect(alice).editPet(playerId, petId, newName)).to.not.be.reverted;
    });

    it("Editing name without actually changing it should revert", async function () {
      const {petNFT, playerId, brush, editNameBrushPrice, alice} = await loadFixture(deployContracts);

      await brush.connect(alice).approve(petNFT, editNameBrushPrice * 3n);
      const randomWord = 0;
      await petNFT.addBasePets([pet]);
      await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
      await brush.mint(alice.address, editNameBrushPrice * 3n);

      const newName = "CHOO CHOO";
      await petNFT.connect(alice).editPet(playerId, petId, newName);
      await expect(petNFT.connect(alice).editPet(playerId, petId, newName)).to.be.revertedWithCustomError(
        petNFT,
        "SameName"
      );
    });

    it("Max 15 charactes for the name", async function () {
      const {petNFT, playerId, brush, editNameBrushPrice, alice} = await loadFixture(deployContracts);

      await brush.connect(alice).approve(petNFT, editNameBrushPrice * 3n);
      const randomWord = 0;
      await petNFT.addBasePets([pet]);
      await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
      await brush.mint(alice.address, editNameBrushPrice * 3n);

      let newName = "1234567890123456";
      await expect(petNFT.connect(alice).editPet(playerId, petId, newName)).to.be.revertedWithCustomError(
        petNFT,
        "NameTooLong"
      );
      newName = newName.slice(0, newName.length - 1);
      await expect(petNFT.connect(alice).editPet(playerId, petId, newName)).to.not.be.reverted;
    });

    it("Cannot edit name to start with 'Pet ' regardless of case", async function () {
      // Check "Pet " is not allowed, doesn't matter about case. "PET " should also not be allowed
      const {petNFT, playerId, brush, editNameBrushPrice, owner, alice} = await loadFixture(deployContracts);

      await brush.connect(alice).approve(petNFT, editNameBrushPrice * 3n);
      const randomWord = 0;
      await petNFT.addBasePets([pet]);
      await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
      await brush.mint(alice.address, editNameBrushPrice * 3n);

      let illegalName = "Pet sdfs";
      await expect(petNFT.connect(alice).editPet(playerId, petId, illegalName)).to.be.revertedWithCustomError(
        petNFT,
        "IllegalNameStart"
      );

      illegalName = "PET sdfs";
      await expect(petNFT.connect(alice).editPet(playerId, petId, illegalName)).to.be.revertedWithCustomError(
        petNFT,
        "IllegalNameStart"
      );
    });

    it("Check brush payment goes to expected addresses", async function () {
      const {petNFT, playerId, brush, editNameBrushPrice, alice, dev, territories} = await loadFixture(deployContracts);

      await brush.connect(alice).approve(petNFT, editNameBrushPrice * 3n);
      const randomWord = 0;
      await petNFT.addBasePets([pet]);
      await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
      await brush.mint(alice.address, editNameBrushPrice * 3n);

      const newName = "New name";

      const brushBurntPercentage = 75n;
      const brushTreasuryPercentage = 0n;
      const brushDevPercentage = 25n;

      await petNFT.setBrushDistributionPercentages(brushBurntPercentage, brushTreasuryPercentage, brushDevPercentage);

      await petNFT.connect(alice).editPet(playerId, petId, newName);

      expect(await brush.balanceOf(alice.address)).to.eq(editNameBrushPrice * 2n);
      expect(await brush.balanceOf(dev.address)).to.eq((editNameBrushPrice * brushDevPercentage) / 100n);
      expect(await brush.amountBurnt()).to.eq((editNameBrushPrice * brushBurntPercentage) / 100n);
    });
  });

  it("totalSupply", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);

    expect(await petNFT["totalSupply()"]()).to.be.eq(0);
    const randomWord = 1;
    await petNFT.addBasePets([pet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], [randomWord]);
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

  // TODO: mintBatch and check random words are used correctly

  function deepClonePet(pet: BasePetInput): BasePetInput {
    return JSON.parse(JSON.stringify(pet));
  }
});
