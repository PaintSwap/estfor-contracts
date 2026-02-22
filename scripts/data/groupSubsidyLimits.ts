import {PLAYER_NFT_ADDRESS} from "../contractAddresses";
import {PlayerNFT__factory} from "../../typechain-types";

const playerNFTIface = PlayerNFT__factory.createInterface();
const mintSelector = playerNFTIface.getFunction("mint").selector;

export const groups = [
  {
    groupId: 1,
    limit: 2,
    selectors: [
      {
        groupId: 1,
        contract: PLAYER_NFT_ADDRESS,
        selector: mintSelector,
      },
    ],
  },
];
