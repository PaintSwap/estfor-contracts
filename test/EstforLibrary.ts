import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";

describe("EstforLibrary", function () {
  async function deployContracts() {
    const EstforLibrary = await ethers.getContractFactory("EstforLibrary");
    const estforLibrary = await EstforLibrary.deploy();
    return {estforLibrary};
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
  });

  it("Validate strings", async () => {
    const {estforLibrary} = await loadFixture(deployContracts);
    const upperCaseLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowerCaseLetters = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const specialCharacters = "-_ .";
    const allowedCharacters = upperCaseLetters + lowerCaseLetters + digits + specialCharacters;
    expect(await estforLibrary.containsValidCharacters(allowedCharacters)).to.be.true;

    const nonAllowedCharacters = "@!#$%^&*()+={}[]|;\"'<>,/?`~";
    for (const char of nonAllowedCharacters) {
      expect(await estforLibrary.containsValidCharacters(char)).to.be.false;
    }
  });
});
