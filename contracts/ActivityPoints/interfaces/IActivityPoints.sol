// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

enum ActivityType {
  NONE,
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
  clans_evt_clancreated,
  lockedbankvaults_evt_attackvaults,
  territories_evt_attackterritory,
  territories_evt_claimunoccupiedterritory,
  players_evt_actionfinished,
  players_evt_addxp,
  players_evt_levelup,
  players_evt_boostfinished,
  players_evt_dailyreward,
  players_evt_weeklyreward,
  players_evt_claimedxpthresholdrewards
}

interface IActivityPoints {
  event ActivityPointsEarned(address indexed player, ActivityType indexed activityType, uint256 value, uint256 points);

  function reward(ActivityType activityType, address player, uint256 value) external returns (uint256 points);
}
