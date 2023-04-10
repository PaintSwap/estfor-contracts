import {BigNumber} from "ethers";
import {ethers} from "hardhat";

export type Tier = {
  id: number; // id of the tier, starts at 1
  maxMemberCapacity: number; // How many members the clan can have
  maxBankCapacity: number; // How many items the clan can have in the bank
  maxImageId: number;
  price: BigNumber; // Price to update the tier from the base tier
  minimumAge: number; // How old the clan must be before it can be upgraded to this tier
};
export const allTiers: Tier[] = [
  {
    id: 1,
    maxMemberCapacity: 3,
    maxBankCapacity: 5,
    maxImageId: 8,
    price: BigNumber.from(0),
    minimumAge: 0,
  },
  {
    id: 2,
    maxMemberCapacity: 10,
    maxBankCapacity: 20,
    maxImageId: 32,
    price: ethers.utils.parseEther("5000"),
    minimumAge: 0,
  },
  {
    id: 3,
    maxMemberCapacity: 50,
    maxBankCapacity: 75,
    maxImageId: 128,
    price: ethers.utils.parseEther("10000"),
    minimumAge: 0,
  },
];
