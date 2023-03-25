import {
  ADMIN_ACCESS_ADDRESS,
  ITEM_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
  PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
  PLAYERS_IMPL_REWARDS_ADDRESS,
  PLAYERS_LIBRARY_ADDRESS,
  PLAYER_NFT_ADDRESS,
  ROYALTY_RECEIVER_ADDRESS,
  SHOP_ADDRESS,
  WORLD_ADDRESS,
} from "./constants";
import {verifyContracts} from "./utils";

async function main() {
  const addresses = [
    WORLD_ADDRESS,
    SHOP_ADDRESS,
    ROYALTY_RECEIVER_ADDRESS,
    ADMIN_ACCESS_ADDRESS,
    ITEM_NFT_ADDRESS,
    PLAYER_NFT_ADDRESS,
    PLAYERS_LIBRARY_ADDRESS,
    PLAYERS_IMPL_QUEUE_ACTIONS_ADDRESS,
    PLAYERS_IMPL_PROCESS_ACTIONS_ADDRESS,
    PLAYERS_IMPL_REWARDS_ADDRESS,
    PLAYERS_ADDRESS,
  ];

  await verifyContracts(addresses);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
