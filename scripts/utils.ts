import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber} from "ethers";
import {run} from "hardhat";
import {PlayerNFT} from "../typechain-types";
import {Skill} from "@paintswap/estfor-definitions/types";

export const createPlayer = async (
  playerNFT: PlayerNFT,
  avatarId: number,
  account: SignerWithAddress,
  name: string,
  makeActive: boolean
): Promise<BigNumber> => {
  const tx = await playerNFT.connect(account).mint(avatarId, name, makeActive);
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "NewPlayer";
  })[0].args;
  return event?.playerId;
};
export type AvatarInfo = {
  name: string;
  description: string;
  imageURI: string;
  startSkills: [Skill, Skill];
};

// If there's an error with build-info not matching then delete cache/artifacts folder and try again
export const verifyContracts = async (addresses: string[]) => {
  for (const address of addresses) {
    await run("verify:verify", {
      address,
    });
  }
  console.log("Verified all contracts");
};
