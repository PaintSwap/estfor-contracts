import {ethers} from "hardhat";
import {ACTIVITY_POINTS_ADDRESS} from "./contractAddresses";
import {getChainId} from "./utils";
import {ActivityPoints} from "../typechain-types";

// must match contract!!!
enum ActivityType {
  NONE,
  //
  // BLUE TICKETS
  //
  instantactions_evt_doinstantactions,
  instantvrfactions_evt_doinstantvrfactions,
  passiveactions_evt_claimpassiveaction,
  quests_evt_questcompleted,
  shop_evt_buy, // + shop_evt_buybatch,
  shop_evt_sell, // + shop_evt_sellbatch,
  wishingwell_evt_donate,
  wishingwell_evt_donatetoclan,
  orderbook_evt_ordersmatched,
  orderbook_evt_claimedtokens,
  orderbook_evt_claimednfts,
  // players
  players_evt_actionfinished,
  players_evt_addxp,
  players_evt_levelup,
  players_evt_boostfinished,
  players_evt_dailyreward,
  players_evt_weeklyreward,
  players_evt_claimedxpthresholdrewards,
  // clans
  clans_evt_clancreated, // _isClanActivityType
  lockedbankvaults_evt_attackvaults, // _isClanActivityType
  territories_evt_attackterritory, // _isClanActivityType
  territories_evt_claimunoccupiedterritory // _isClanActivityType
}

// must match contract!!!
enum CalculationType {
  NONE,
  discrete,
  log2,
  log10,
  linear
}

async function main() {
  const [owner] = await ethers.getSigners();
  console.log(
    `Updating activity points calculationsat address ${ACTIVITY_POINTS_ADDRESS} with the account: ${
      owner.address
    } on chain id ${await getChainId(owner)}`
  );

  const activityPoints = await ethers.getContractAt("ActivityPoints", ACTIVITY_POINTS_ADDRESS);

  // ActivityType activityType,
  // CalculationType calculation,
  // uint16 base,
  // uint16 multiplier,
  // uint16 divider,
  // uint64 maxPointsPerDay

  const calculations = [
    [ActivityType.instantactions_evt_doinstantactions, CalculationType.discrete, 5, 1, 0, 0],
    [ActivityType.instantvrfactions_evt_doinstantvrfactions, CalculationType.discrete, 5, 0, 0, 0],
    [ActivityType.passiveactions_evt_claimpassiveaction, CalculationType.discrete, 200, 0, 0, 0],
    [ActivityType.quests_evt_questcompleted, CalculationType.discrete, 250, 0, 0, 1000],
    [ActivityType.shop_evt_buy, CalculationType.log2, 11, 10, 1, 2000],
    [ActivityType.shop_evt_sell, CalculationType.log2, 3, 20, 1, 500],
    [ActivityType.wishingwell_evt_donate, CalculationType.log10, 50, 20, 1, 0],
    [ActivityType.wishingwell_evt_donatetoclan, CalculationType.log10, 5, 20, 1, 0],
    [ActivityType.orderbook_evt_ordersmatched, CalculationType.log2, 11, 10, 1, 2000],
    [ActivityType.players_evt_actionfinished, CalculationType.discrete, 23, 0, 0, 2001],
    [ActivityType.players_evt_addxp, CalculationType.log2, 5, 8, 10, 5000],
    [ActivityType.players_evt_levelup, CalculationType.log2, 33, 5, 10, 5000],
    [ActivityType.players_evt_boostfinished, CalculationType.discrete, 75, 0, 0, 750],
    [ActivityType.players_evt_dailyreward, CalculationType.discrete, 80, 0, 0, 0],
    [ActivityType.players_evt_weeklyreward, CalculationType.discrete, 450, 0, 0, 0],
    [ActivityType.players_evt_claimedxpthresholdrewards, CalculationType.discrete, 100, 0, 0, 100],
    [ActivityType.clans_evt_clancreated, CalculationType.discrete, 300, 0, 0, 300],
    [ActivityType.lockedbankvaults_evt_attackvaults, CalculationType.discrete, 50, 0, 0, 250],
    [ActivityType.territories_evt_attackterritory, CalculationType.discrete, 250, 0, 0, 250],
    [ActivityType.territories_evt_claimunoccupiedterritory, CalculationType.discrete, 100, 0, 0, 100]
  ];

  for (const [activityType, calculation, base, multiplier, divider, maxPointsPerDay] of calculations) {
    console.log(`Setting activity points for ${ActivityType[activityType]}`);
    const tx = await activityPoints.addPointsCalculation(
      activityType,
      calculation,
      base,
      multiplier,
      divider,
      maxPointsPerDay
    );
    await tx.wait();
  }

  console.log("Done");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
