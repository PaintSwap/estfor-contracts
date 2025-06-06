import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {playersFixture} from "../Players/PlayersFixture";
import {
  InstantVRFActionInput,
  InstantVRFActionType,
  defaultInstantVRFActionInput as _defaultInstantVRFActionInput
} from "@paintswap/estfor-definitions/types";
import {expect} from "chai";
import {EstforConstants} from "@paintswap/estfor-definitions";
import {AbiCoder, hexlify, keccak256, randomBytes} from "ethers";

const abiCoder = new AbiCoder();

describe("EggInstantVRFActionStrategy", function () {
  const rewardBasePetIdMin = 2;
  const rewardBasePetIdMax = 10;

  const defaultInstantVRFActionInput: InstantVRFActionInput = {
    actionType: InstantVRFActionType.EGG,
    inputTokenIds: [EstforConstants.SECRET_EGG_1_TIER1],
    inputAmounts: [1],
    actionId: 1,
    data: abiCoder.encode(
      ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
      [0, {rewardBasePetIdMin, rewardBasePetIdMax}]
    ),
    isFullModeOnly: false,
    isAvailable: true,
    questPrerequisiteId: 0
  };

  it("Only instantVRFActions can call setInstantVRFActions", async function () {
    const {eggInstantVRFActionStrategy} = await loadFixture(playersFixture);
    const instantVRFActionInput = {...defaultInstantVRFActionInput};
    await expect(eggInstantVRFActionStrategy.setAction(instantVRFActionInput)).to.be.revertedWithCustomError(
      eggInstantVRFActionStrategy,
      "OnlyInstantVRFActions"
    );
  });

  it("Set actions", async function () {
    const {eggInstantVRFActionStrategy, alice} = await loadFixture(playersFixture);

    await eggInstantVRFActionStrategy.setInstantVRFActions(alice);
    const actionId = 1;
    const instantVRFActionInput = {...defaultInstantVRFActionInput};
    await eggInstantVRFActionStrategy.connect(alice).setAction(instantVRFActionInput);

    let num = 1;
    let paddedHex = leftAlignAsBytes2(num);
    let bytes = keccak256(paddedHex);
    let randomWord = parseInt(bytes.slice(2, 6), 16);
    const actionAmount = 1;

    let res = await eggInstantVRFActionStrategy.getRandomRewards(actionId, actionAmount, [paddedHex], 0);
    expect(res.producedItemTokenIds).to.be.deep.eq([]);
    expect(res.producedItemsAmounts).to.be.deep.eq([]);
    expect(res.producedPetBaseIds).to.be.deep.eq([rewardBasePetIdMin + 1]);

    // Modulus of num should give the same output
    const oldNum = num;
    num = rewardBasePetIdMax - rewardBasePetIdMin + 1;
    expect(num % oldNum).to.eq(0);

    paddedHex = leftAlignAsBytes2(num);
    bytes = keccak256(paddedHex);
    randomWord = parseInt(bytes.slice(2, 6), 16);

    res = await eggInstantVRFActionStrategy.getRandomRewards(actionId, actionAmount, [paddedHex], 0);
    expect(res.producedPetBaseIds).to.be.deep.eq([rewardBasePetIdMin]);
  });

  it("Setting max < min should revert", async function () {
    const {eggInstantVRFActionStrategy, alice} = await loadFixture(playersFixture);

    await eggInstantVRFActionStrategy.setInstantVRFActions(alice);
    const instantVRFActionInput = {
      ...defaultInstantVRFActionInput,
      data: abiCoder.encode(
        ["uint8 version", "tuple(uint16 rewardBasePetIdMin,uint16 rewardBasePetIdMax)"],
        [0, {rewardBasePetIdMin: 2, rewardBasePetIdMax: 1}]
      )
    };
    await expect(
      eggInstantVRFActionStrategy.connect(alice).setAction(instantVRFActionInput)
    ).to.be.revertedWithCustomError(eggInstantVRFActionStrategy, "BasePetIdMinGreaterThanMax");
  });

  it("Multiple action amount", async function () {
    const {eggInstantVRFActionStrategy, alice} = await loadFixture(playersFixture);

    await eggInstantVRFActionStrategy.setInstantVRFActions(alice);
    const actionId = 1;
    const instantVRFActionInput = {...defaultInstantVRFActionInput};
    await eggInstantVRFActionStrategy.connect(alice).setAction(instantVRFActionInput);

    // Construct the padded hexadecimal string with zeros on the right
    const num = 1;
    const firstWord = hexlify(randomBytes(32));
    const paddedHex1 = leftAlignAsBytes2(num);
    const paddedHex2 = leftAlignAsBytes2(num + 1);

    const secondWord = "0x" + paddedHex1.slice(2, 6).concat(paddedHex2.slice(2, 6)).padEnd(64, "0");
    const actionAmount = 2;
    const startIndex = 1; // Should use the next random word
    const res = await eggInstantVRFActionStrategy.getRandomRewards(
      actionId,
      actionAmount,
      [firstWord, secondWord],
      startIndex
    );

    expect(res.producedItemTokenIds).to.be.deep.equal([]);
    expect(res.producedItemsAmounts).to.be.deep.equal([]);
    expect(res.producedPetBaseIds).to.be.deep.equal([rewardBasePetIdMin + 1, rewardBasePetIdMin + 2]);
  });

  const leftAlignAsBytes2 = (n: number) => {
    // Convert the number to its hexadecimal representation
    let hex = n.toString(16);

    // Ensure the hexadecimal string has an even length
    if (hex.length % 2 !== 0) {
      hex = "0" + hex;
    }

    // Define the desired length of the resulting bytes string (in characters)
    const desiredLength = 64;

    // Construct the padded hexadecimal string with zeros on the left
    const paddedHex = "0x" + hex.padStart(4, "0").padEnd(desiredLength, "0");
    return paddedHex;
  };
});
