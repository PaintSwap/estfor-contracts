import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";

describe("EstforLibrary", function () {
  async function deployContracts() {
    const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
    const estforLibrary = await EstforLibrary.deploy();
    const upperCaseLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowerCaseLetters = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const telegramSymbols = "+";
    return {estforLibrary, upperCaseLetters, lowerCaseLetters, digits, telegramSymbols};
  }

  it("Trim string", async () => {
    const {estforLibrary} = await loadFixture(deployContracts);
    expect(await estforLibrary.trim("  hello  ")).to.eq("hello");
    expect(await estforLibrary.trim("hello  ")).to.eq("hello");
    expect(await estforLibrary.trim("  hello")).to.eq("hello");
    expect(await estforLibrary.trim("hello")).to.eq("hello");
    expect(await estforLibrary.trim(" ")).to.eq("");
    expect(await estforLibrary.trim("")).to.eq("");
    expect(await estforLibrary.trim("Alice")).to.eq("Alice");
    expect(await estforLibrary.trim("Sam test clan")).to.eq("Sam test clan");
    expect(await estforLibrary.trim("Double  space")).to.eq("Double  space");
  });

  it("Validate names", async () => {
    const {estforLibrary, upperCaseLetters, lowerCaseLetters, digits} = await loadFixture(deployContracts);
    const specialCharacters = "-_ .";
    const allowedCharacters = upperCaseLetters + lowerCaseLetters + digits + specialCharacters;
    expect(await estforLibrary.containsValidNameCharacters(allowedCharacters)).to.be.true;

    const nonAllowedCharacters = "@!#$%^&*()+={}[]|;\"'<>,/?`~";
    for (const char of nonAllowedCharacters) {
      expect(await estforLibrary.containsValidNameCharacters(char)).to.be.false;
    }

    // Check for multiple spaces
    expect(await estforLibrary.containsValidNameCharacters("Double  space")).to.be.false;
    expect(await estforLibrary.containsValidNameCharacters("Triple   space")).to.be.false;
    expect(await estforLibrary.containsValidNameCharacters("Single space")).to.be.true;
  });

  it("Validate discord invite code", async () => {
    const {estforLibrary, upperCaseLetters, lowerCaseLetters, digits} = await loadFixture(deployContracts);
    const allowedCharacters = upperCaseLetters + lowerCaseLetters + digits;
    expect(await estforLibrary.containsValidDiscordCharacters(allowedCharacters)).to.be.true;

    const nonAllowedCharacters = "@!#$%^&*()+={}[]|;\"'<>,/?`~ _-.";
    for (const char of nonAllowedCharacters) {
      expect(await estforLibrary.containsValidDiscordCharacters(char)).to.be.false;
    }
  });

  it("Validate telegram handle", async () => {
    const {estforLibrary, upperCaseLetters, lowerCaseLetters, digits, telegramSymbols} = await loadFixture(
      deployContracts
    );
    const allowedCharacters = upperCaseLetters + lowerCaseLetters + digits + telegramSymbols;
    expect(await estforLibrary.containsValidTelegramCharacters(allowedCharacters)).to.be.true;

    const nonAllowedCharacters = "@!#$%^&*()={}[]|;\"'<>,/?`~ _-.";
    for (const char of nonAllowedCharacters) {
      expect(await estforLibrary.containsValidTelegramCharacters(char)).to.be.false;
    }
  });

  it("Binary search", async () => {
    const {estforLibrary} = await loadFixture(deployContracts);

    let res = await estforLibrary.binarySearchMemory([1, 2, 4, 7, 12], 4);
    expect(res).to.eq(2);

    res = await estforLibrary.binarySearchMemory([1, 2, 4, 7, 12], 5);
    expect(res).to.eq(ethers.constants.MaxUint256);

    res = await estforLibrary.binarySearchMemory([1, 2, 4, 7, 12], 1);
    expect(res).to.eq(0);

    res = await estforLibrary.binarySearchMemory([1, 2, 4, 7, 12], 12);
    expect(res).to.eq(4);

    await expect(estforLibrary.binarySearchMemory([1, 2, 4, 7, 12], 0)).to.be.reverted;
  });

  it("Binary search with 0s inbetween", async () => {
    const {estforLibrary} = await loadFixture(deployContracts);

    let res = await estforLibrary.binarySearchMemory([1, 0, 0, 0, 0, 0, 12], 12);
    expect(res).to.eq(6);

    res = await estforLibrary.binarySearchMemory([1, 12, 0, 0, 0, 0, 0, 0], 12);
    expect(res).to.eq(1);

    res = await estforLibrary.binarySearchMemory([1, 12, 0, 0, 16, 0, 0, 20, 0, 0], 12);
    expect(res).to.eq(1);

    res = await estforLibrary.binarySearchMemory([1, 12, 0, 0, 0, 16, 0, 0, 20, 0, 0], 12);
    expect(res).to.eq(1);

    res = await estforLibrary.binarySearchMemory([1, 12, 0, 0, 0, 16, 0, 0, 0, 20, 0, 0], 12);
    expect(res).to.eq(1);

    await expect(estforLibrary.binarySearchMemory([1, 12, 0, 0, 0, 16, 0, 0, 0, 20, 0, 0], 0)).to.be.reverted;
  });
});
