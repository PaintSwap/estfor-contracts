import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {BasePetInput} from "@paintswap/estfor-definitions/types";
import {playersFixture} from "./Players/PlayersFixture";

import {allBasePets} from "../scripts/data/pets";

const PET_SHARD = 13316;

describe("PetNFTReroll", function () {
  async function deployContracts() {
    const fixture = await loadFixture(playersFixture);

    const basePet: BasePetInput = {...allBasePets[0]};
    await fixture.petNFT.addBasePets([basePet]);

    const originalPetTokenId = await fixture.petNFT.getNextPetId();
    await fixture.petNFT.mintBatch(fixture.alice.address, [basePet.baseId], 123456);
    await fixture.itemNFT.mint(fixture.alice.address, PET_SHARD, 1);

    return {
      ...fixture,
      basePet,
      originalPetTokenId,
    };
  }

  it("reverts when caller is not the pet owner", async function () {
    const {petNFTReroll, originalPetTokenId, bob} = await loadFixture(deployContracts);
    const cost = await petNFTReroll.requestCost(1);

    await expect(petNFTReroll.connect(bob).rerollPet(originalPetTokenId, {value: cost})).to.be.revertedWithCustomError(
      petNFTReroll,
      "NotOwnerOfPet"
    );
  });

  it("reverts when caller does not own a shard", async function () {
    const {petNFTReroll, itemNFT, originalPetTokenId, alice} = await loadFixture(deployContracts);
    await itemNFT.connect(alice).burn(alice, PET_SHARD, 1);

    const cost = await petNFTReroll.requestCost(1);
    await expect(
      petNFTReroll.connect(alice).rerollPet(originalPetTokenId, {value: cost})
    ).to.be.revertedWithCustomError(petNFTReroll, "NotOwnerOfPetShard");
  });

  it("reverts when the VRF fee is not paid", async function () {
    const {petNFTReroll, originalPetTokenId, alice, mockVRF} = await loadFixture(deployContracts);

    await expect(petNFTReroll.connect(alice).rerollPet(originalPetTokenId)).to.be.revertedWithCustomError(
      mockVRF,
      "InsufficientGasPayment"
    );
  });

  it("rerolls a pet and consumes one shard", async function () {
    const {petNFTReroll, petNFT, itemNFT, mockVRF, alice, basePet, originalPetTokenId} = await loadFixture(
      deployContracts
    );
    const cost = await petNFTReroll.requestCost(1);

    await petNFTReroll.connect(alice).rerollPet(originalPetTokenId, {value: cost});
    const requestId = 1;
    const newPetTokenId = originalPetTokenId + 1n;

    await expect(mockVRF.fulfillSeeded(requestId, await petNFTReroll.getAddress(), 987654321))
      .to.emit(petNFTReroll, "CompletePetReroll")
      .withArgs(alice.address, originalPetTokenId, newPetTokenId, requestId);

    expect(await petNFT.balanceOf(alice, originalPetTokenId)).to.eq(0);
    expect(await petNFT.balanceOf(alice, newPetTokenId)).to.eq(1);
    expect(await itemNFT.balanceOf(alice, PET_SHARD)).to.eq(0);
    expect((await petNFT.getPet(newPetTokenId)).baseId).to.eq(basePet.baseId);
  });

  it("reverts if the request does not exist", async function () {
    const {petNFTReroll, mockVRF} = await loadFixture(deployContracts);

    await expect(mockVRF.fulfillSeeded(999999, await petNFTReroll.getAddress(), 1)).to.be.revertedWithCustomError(
      petNFTReroll,
      "RequestDoesNotExist"
    );
  });
});
