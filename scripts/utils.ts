import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {PaintScapeNFT, Player, PlayerNFT} from "../typechain-types";

// Should match contract
export enum Skill {
  NONE,
  PAINT,
  DEFENCE,
  FISH,
  COOK,
}

export enum Items {
  DUMMY,
  MYSTERY_BOX,
  BRUSH,
  WAND,
  SHIELD,
  BRONZE_NECKLACE,
  WOODEN_FISHING_ROD,
  IGNORE_NOW_OTHER_ITEMS,
  COD,
}

export enum Attribute {
  NONE,
  ATTACK,
  DEFENCE,
}

export enum EquipPosition {
  HEAD,
  NECK,
  BODY,
  RIGHT_ARM,
  LEFT_ARM,
  LEGS,
  DUMMY,
  DUMMY1,
}

export const MALE = true;
export const FEMALE = false;

export const createPlayer = async (nft: PlayerNFT, avatarId: number, account: SignerWithAddress): Promise<Player> => {
  const tx = await nft.connect(account).mintPlayer(MALE, avatarId);
  const receipt = await tx.wait();
  const event = receipt?.events?.filter((x) => {
    return x.event == "NewPlayer";
  })[0].args;
  const playerAddress = event?.player;
  const Player = await ethers.getContractFactory("Player");
  return Player.attach(playerAddress);
};
