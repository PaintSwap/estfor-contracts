import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";

describe("EstforLibrary", function () {
  async function deployContracts() {
    const PlayersLibrary = await ethers.getContractFactory("PlayersLibrary");
    const playersLibrary = await PlayersLibrary.deploy();
    return {playersLibrary};
  }

  it("GetLevel", async () => {
    const {playersLibrary} = await loadFixture(deployContracts);
    expect(await playersLibrary.getLevel(0)).to.eq(1);
    expect(await playersLibrary.getLevel(1035475)).to.eq(98); // 1 below 99
    expect(await playersLibrary.getLevel(1035476)).to.eq(99); // exactly 99
    expect(await playersLibrary.getLevel(1035477)).to.eq(99); // 1 above
    expect(await playersLibrary.getLevel(1109796)).to.eq(100); // exactly 100
    expect(await playersLibrary.getLevel(1209796)).to.eq(100); // Above 100
  });
});
