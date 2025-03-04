import {parseEther} from "ethers";

export type Tier = {
  id: number; // id of the tier, starts at 1
  maxMemberCapacity: number; // How many members the clan can have
  maxBankCapacity: number; // How many items the clan can have in the bank
  maxImageId: number;
  price: bigint; // Price to update the tier from the base tier
  minimumAge: number; // How old the clan must be before it can be upgraded to this tier
};
export const allClanTiers: Tier[] = [
  {
    id: 1,
    maxMemberCapacity: 3,
    maxBankCapacity: 5,
    maxImageId: 10000,
    price: parseEther("100"),
    minimumAge: 0
  },
  {
    id: 2,
    maxMemberCapacity: 10,
    maxBankCapacity: 20,
    maxImageId: 20000,
    price: parseEther("350"),
    minimumAge: 0
  },
  {
    id: 3,
    maxMemberCapacity: 50,
    maxBankCapacity: 75,
    maxImageId: 30000,
    price: parseEther("2000"),
    minimumAge: 0
  }
];

export const allClanTiersBeta: Tier[] = allClanTiers.map((tier) => {
  return {
    ...tier,
    price: tier.price / 10n
  };
});
