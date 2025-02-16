// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
  territories_evt_claimunoccupiedterritory, // _isClanActivityType
  //
  // GREEN TICKETS
  //
  players_dailyreward, // = 8
  wishingwell_luckofthedraw, // = 3
  wishingwell_luckypotion // = 50
}

interface IActivityPointsCaller {
  function setActivityPoints(address activityPoints) external;
}

interface IActivityPoints {
  event ActivityPointsEarned(
    ActivityType indexed activityType,
    uint256 value,
    address indexed from,
    uint16 indexed tokenId,
    uint256 points
  );

  function rewardGreenTickets(
    ActivityType activityType,
    address recipient,
    bool isEvolved
  ) external returns (uint256 tickets);

  function rewardBlueTickets(
    ActivityType activityType,
    address from,
    bool isEvolvedOrNA,
    uint256 value
  ) external returns (uint256 points);
}
