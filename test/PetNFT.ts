import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {playersFixture} from "./Players/PlayersFixture";
import {BasePetInput, PetEnhancementType, PetSkin, Skill} from "@paintswap/estfor-definitions/types";
import {upgrades} from "hardhat";
import {PetNFT} from "../typechain-types";
import {getXPFromLevel, makeSigner} from "./Players/utils";
import {parseEther} from "ethers";
import {EstforTypes} from "@paintswap/estfor-definitions";

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
    percentageStarThreshold: 1,
    isTransferable: true
  };

  it("Must be a minter to mint", async function () {
    const {petNFT, frank} = await loadFixture(deployContracts);
    await expect(petNFT.connect(frank).mintBatch(frank, [1], 1)).to.be.revertedWithCustomError(petNFT, "NotMinter");
  });

  it("Mint a standard pet", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);

    const randomWord = 1;
    await petNFT.addBasePets([pet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
    expect(await petNFT.getNextPetId()).to.eq(2);
    expect(await petNFT.balanceOf(alice, petId)).to.eq(1);
  });

  it("uri", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);
    const randomWord = 1;
    await petNFT.addBasePets([pet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
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
    expect(metadata.attributes).to.have.length(15);
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
    expect(metadata.attributes[5].trait_type).to.equal("Fixed max #1");
    expect(metadata.attributes[5]).to.have.property("value");
    expect(metadata.attributes[5].value).to.equal(0);
    expect(metadata.attributes[6].trait_type).to.equal("Percent increase #1");
    expect(metadata.attributes[6]).to.have.property("value");
    expect(metadata.attributes[6].value).to.equal(9);
    expect(metadata.attributes[7].trait_type).to.equal("Percent max #1");
    expect(metadata.attributes[7]).to.have.property("value");
    expect(metadata.attributes[7].value).to.equal(10);
    expect(metadata.attributes[8].trait_type).to.equal("Skill bonus #2");
    expect(metadata.attributes[8]).to.have.property("value");
    expect(metadata.attributes[8].value).to.equal("Defence");
    expect(metadata.attributes[9].trait_type).to.equal("Fixed increase #2");
    expect(metadata.attributes[9]).to.have.property("value");
    expect(metadata.attributes[9].value).to.equal(0);
    expect(metadata.attributes[10].trait_type).to.equal("Fixed max #2");
    expect(metadata.attributes[10]).to.have.property("value");
    expect(metadata.attributes[10].value).to.equal(0);
    expect(metadata.attributes[11].trait_type).to.equal("Percent increase #2");
    expect(metadata.attributes[11]).to.have.property("value");
    expect(metadata.attributes[11].value).to.equal(15);
    expect(metadata.attributes[12].trait_type).to.equal("Percent max #2");
    expect(metadata.attributes[12]).to.have.property("value");
    expect(metadata.attributes[12].value).to.equal(18);
    expect(metadata.attributes[13].trait_type).to.equal("Fixed Star");
    expect(metadata.attributes[13]).to.have.property("value");
    expect(metadata.attributes[13].value).to.equal("false");
    expect(metadata.attributes[14].trait_type).to.equal("Percent Star");
    expect(metadata.attributes[14]).to.have.property("value");
    expect(metadata.attributes[14].value).to.equal("true");

    expect(metadata).to.have.property("external_url");
    expect(metadata.external_url).to.eq(`https://beta.estfor.com`);
  });

  it("Mint non-existent pet", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);
    const randomWord = 1;
    await expect(petNFT.connect(alice).mintBatch(alice, [baseId], randomWord)).to.be.revertedWithCustomError(
      petNFT,
      "PetDoesNotExist"
    );
  });

  it("external_url when not in beta", async function () {
    const {adminAccess, brush, treasury, dev, royaltyReceiver, alice, randomnessBeacon, PetNFT} = await loadFixture(
      deployContracts
    );

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
        await randomnessBeacon.getAddress(),
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
    await expect(petNFTNotBeta.mintBatch(alice, [baseId], randomWord)).to.be.revertedWithCustomError(
      petNFTNotBeta,
      "NotMinter"
    );
    await petNFTNotBeta.initializeAddresses(alice, alice, alice);

    await petNFTNotBeta.connect(alice).mintBatch(alice, [baseId], randomWord);

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
    const {petNFT, adminAccess, brush, dev, royaltyReceiver, treasury, randomnessBeacon, PetNFT} = await loadFixture(
      deployContracts
    );
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
        await randomnessBeacon.getAddress(),
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
    const {petNFT, playerId, players, alice} = await loadFixture(deployContracts);

    const playersSigner = await makeSigner(players);
    await expect(petNFT.connect(playersSigner).assignPet(alice, playerId, petId, 0)).to.be.revertedWithCustomError(
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
    await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);

    const playersSigner = await makeSigner(players);
    await expect(petNFT.connect(playersSigner).assignPet(alice, playerId, petId, 0)).to.be.revertedWithCustomError(
      petNFT,
      "LevelNotHighEnough"
    );

    await players.connect(alice).modifyXP(alice, playerId, Skill.MELEE, getXPFromLevel(2));
    await expect(petNFT.connect(playersSigner).assignPet(alice, playerId, petId, 0)).to.not.be.reverted;
  });

  it("Must be players to call assign pet", async function () {
    const {petNFT, playerId, alice, players} = await loadFixture(deployContracts);

    const randomWord = 0;
    const modifiedPet = deepClonePet(pet);
    await petNFT.addBasePets([modifiedPet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);

    await expect(petNFT.assignPet(alice, playerId, petId, 0)).to.be.revertedWithCustomError(petNFT, "NotPlayers");

    const playersSigner = await makeSigner(players);
    await expect(petNFT.connect(playersSigner).assignPet(alice, playerId, petId, 0)).to.not.be.reverted;
  });

  it("Check 0 for both percentage and fixed reverts", async function () {
    const {petNFT, playerId, players, alice} = await loadFixture(deployContracts);

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

    await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
    const playersSigner = await makeSigner(players);
    await expect(petNFT.connect(playersSigner).assignPet(alice, playerId, petId, 0)).to.not.be.reverted;
  });

  it("Check all skins", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);

    const skins = Object.keys(EstforTypes.PetSkin).filter((item) => {
      return item != "NONE" && isNaN(Number(item));
    });

    let modifiedPet = deepClonePet(pet);
    let petId = 1;
    for (const skin of skins) {
      modifiedPet.skin = EstforTypes.PetSkin[skin as keyof typeof EstforTypes.PetSkin];
      await petNFT.addBasePets([modifiedPet]);
      await petNFT.connect(alice).mintBatch(alice.address, [modifiedPet.baseId], 0);
      ++modifiedPet.baseId;

      const uri = await petNFT.uri(petId);
      const metadata = JSON.parse(Buffer.from(uri.split(";base64,")[1], "base64").toString());
      expect(metadata.attributes[0].value.toLowerCase()).to.equal(skin.toLowerCase());
      ++petId;
    }
  });

  it("Check 0 for fixed or percentage does not revert", async function () {
    const {petNFT, playerId, players, alice} = await loadFixture(deployContracts);

    const playersSigner = await makeSigner(players);

    const randomWord = 0;
    const modifiedPet = deepClonePet(pet);
    await petNFT.addBasePets([modifiedPet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
    await expect(petNFT.connect(playersSigner).assignPet(alice, playerId, petId, 0)).to.not.be.reverted;

    // 0 percentage min/max is fine
    modifiedPet.skillPercentageMins[0] = 0;
    modifiedPet.skillPercentageMaxs[0] = 0;
    modifiedPet.skillFixedMaxs[0] = 1;
    await petNFT.editBasePets([modifiedPet]);
    await expect(petNFT.connect(playersSigner).assignPet(alice, playerId, petId, 0)).to.not.be.reverted;

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
    await expect(petNFT.connect(playersSigner).assignPet(alice, playerId, petId, 0)).to.not.be.reverted;
  });

  describe("Editing", function () {
    it("Edit pet name", async function () {
      const {petNFT, playerId, brush, editNameBrushPrice, owner, alice} = await loadFixture(deployContracts);

      const name = "My pet name is1";
      await brush.connect(alice).approve(petNFT, editNameBrushPrice * 3n);

      const randomWord = 0;
      await petNFT.addBasePets([pet]);
      await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);

      await expect(petNFT.connect(alice).editPet(playerId, petId, name)).to.be.revertedWithCustomError(
        brush,
        "ERC20InsufficientBalance"
      );
      await brush.mint(alice, editNameBrushPrice * 3n);

      await expect(petNFT.connect(alice).editPet(playerId + 1n, petId, name)).to.be.revertedWithCustomError(
        petNFT,
        "NotOwnerOfPlayer"
      );

      await petNFT.connect(alice).safeTransferFrom(alice, owner, petId, 1, "0x");
      await expect(petNFT.connect(alice).editPet(playerId, petId, name)).to.be.revertedWithCustomError(
        petNFT,
        "NotOwnerOfPet"
      );
      await petNFT.safeTransferFrom(owner, alice, petId, 1, "0x");
      await expect(petNFT.connect(alice).editPet(playerId, petId, name))
        .to.emit(petNFT, "EditPlayerPet")
        .withArgs(playerId, petId, alice, name);

      await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
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
      await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
      await brush.mint(alice, editNameBrushPrice * 3n);

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
      await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
      await brush.mint(alice, editNameBrushPrice * 3n);

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
      await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
      await brush.mint(alice, editNameBrushPrice * 3n);

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
      await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
      await brush.mint(alice, editNameBrushPrice * 3n);

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
      await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
      await brush.mint(alice, editNameBrushPrice * 3n);

      const newName = "New name";

      const brushBurntPercentage = 75n;
      const brushTreasuryPercentage = 0n;
      const brushDevPercentage = 25n;

      await petNFT.setBrushDistributionPercentages(brushBurntPercentage, brushTreasuryPercentage, brushDevPercentage);

      await petNFT.connect(alice).editPet(playerId, petId, newName);

      expect(await brush.balanceOf(alice)).to.eq(editNameBrushPrice * 2n);
      expect(await brush.balanceOf(dev)).to.eq((editNameBrushPrice * brushDevPercentage) / 100n);
      expect(await brush.amountBurnt()).to.eq((editNameBrushPrice * brushBurntPercentage) / 100n);
    });
  });

  it("A non-transferable pet cannot be transferred", async function () {
    const {petNFT, brush, editNameBrushPrice, alice, dev} = await loadFixture(deployContracts);

    await brush.connect(alice).approve(petNFT, editNameBrushPrice * 3n);
    const randomWord = 0;
    await petNFT.addBasePets([{...pet, isTransferable: false}]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);

    await expect(petNFT.connect(alice).safeTransferFrom(alice, dev, petId, 1, "0x")).to.be.revertedWithCustomError(
      petNFT,
      "CannotTransferThisPet"
    );
    // Try one that is transferable
    await petNFT.addBasePets([{...pet, baseId: baseId + 1, isTransferable: true}]);
    await petNFT.connect(alice).mintBatch(alice, [baseId + 1], randomWord);
    await expect(petNFT.connect(alice).safeTransferFrom(alice, dev, petId + 1, 1, "0x")).to.not.be.reverted;
  });

  it("totalSupply", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);

    expect(await petNFT["totalSupply()"]()).to.be.eq(0);
    const randomWord = 1;
    await petNFT.addBasePets([pet]);
    await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
    await petNFT.connect(alice).mintBatch(alice, [baseId], randomWord);
    expect(await petNFT["totalSupply()"]()).to.be.eq(2);
    expect(await petNFT["totalSupply(uint256)"](1)).to.be.eq(1);
    expect(await petNFT["totalSupply(uint256)"](2)).to.be.eq(1);
    await petNFT.connect(alice).burn(alice, 1);
    expect(await petNFT["totalSupply()"]()).to.be.eq(1);
    expect(await petNFT["totalSupply(uint256)"](1)).to.be.eq(0);
    await petNFT.connect(alice).burn(alice, 2);
    expect(await petNFT["totalSupply()"]()).to.be.eq(0);
    expect(await petNFT["totalSupply(uint256)"](2)).to.be.eq(0);
  });

  // Training not done yet
  it.skip("Train", async function () {
    const {petNFT, alice} = await loadFixture(deployContracts);
  });

  // TODO: mintBatch and check random words are used correctly

  function deepClonePet(pet: BasePetInput): BasePetInput {
    return JSON.parse(JSON.stringify(pet));
  }
});
