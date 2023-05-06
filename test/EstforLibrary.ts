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
    return {estforLibrary, upperCaseLetters, lowerCaseLetters, digits};
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
    const {estforLibrary, upperCaseLetters, lowerCaseLetters, digits} = await loadFixture(deployContracts);
    const allowedCharacters = upperCaseLetters + lowerCaseLetters + digits;
    expect(await estforLibrary.containsValidTelegramCharacters(allowedCharacters)).to.be.true;

    const nonAllowedCharacters = "@!#$%^&*()+={}[]|;\"'<>,/?`~ _-.";
    for (const char of nonAllowedCharacters) {
      expect(await estforLibrary.containsValidTelegramCharacters(char)).to.be.false;
    }
  });
});
