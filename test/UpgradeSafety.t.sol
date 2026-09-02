// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {UpgradeSafetyTestBase} from "./utils/UpgradeSafetyTestBase.sol";

contract UpgradeSafetyTest is UpgradeSafetyTestBase {
  function testActivityPointsUpgradeSafe() public {
    _validateUpgrade("contracts/ActivityPoints/ActivityPoints.sol:ActivityPoints");
  }

  function testAdminAccessUpgradeSafe() public {
    _validateUpgrade("contracts/AdminAccess.sol:AdminAccess");
  }

  function testOrderBookUpgradeSafe() public {
    _validateUpgrade("contracts/Bazaar/OrderBook.sol:OrderBook");
  }

  function testBridgeUpgradeSafe() public {
    _validateUpgrade("contracts/Bridge/Bridge.sol:Bridge");
  }

  function testBankFactoryUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/BankFactory.sol:BankFactory");
  }

  function testBankRegistryUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/BankRegistry.sol:BankRegistry");
  }

  function testBankRelayUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/BankRelay.sol:BankRelay");
  }

  function testClansUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/Clans.sol:Clans");
  }

  function testCombatantsHelperUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/CombatantsHelper.sol:CombatantsHelper");
  }

  function testLockedBankVaultsUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/LockedBankVaults.sol:LockedBankVaults");
  }

  function testRaidsUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/Raids.sol:Raids");
  }

  function testTerritoriesUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/Territories.sol:Territories");
  }

  function testTerritoryTreasuryUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/TerritoryTreasury.sol:TerritoryTreasury");
  }

  function testCosmeticsUpgradeSafe() public {
    _validateUpgrade("contracts/Cosmetics.sol:Cosmetics");
  }

  function testDailyRewardsSchedulerUpgradeSafe() public {
    _validateUpgrade("contracts/DailyRewardsScheduler.sol:DailyRewardsScheduler");
  }

  function testBlackMarketTraderUpgradeSafe() public {
    _validateUpgrade("contracts/Events/BlackMarketTrader.sol:BlackMarketTrader");
  }

  function testGlobalEventsUpgradeSafe() public {
    _validateUpgrade("contracts/Events/GlobalEvent.sol:GlobalEvents");
  }

  function testInstantActionsUpgradeSafe() public {
    _validateUpgrade("contracts/InstantActions.sol:InstantActions");
  }

  function testEggInstantVRFActionStrategyUpgradeSafe() public {
    _validateUpgrade(
      "contracts/InstantVRFActionStrategies/EggInstantVRFActionStrategy.sol:EggInstantVRFActionStrategy"
    );
  }

  function testGenericInstantVRFActionStrategyUpgradeSafe() public {
    _validateUpgrade(
      "contracts/InstantVRFActionStrategies/GenericInstantVRFActionStrategy.sol:GenericInstantVRFActionStrategy"
    );
  }

  function testInstantVRFActionsUpgradeSafe() public {
    _validateUpgrade("contracts/InstantVRFActions.sol:InstantVRFActions");
  }

  function testItemNFTUpgradeSafe() public {
    _validateUpgrade("contracts/ItemNFT.sol:ItemNFT");
  }

  function testMarketplaceUpgradeSafe() public {
    _validateUpgrade("contracts/Marketplace.sol:Marketplace");
  }

  function testPVPBattlegroundUpgradeSafe() public {
    _validateUpgrade("contracts/PVPBattleground.sol:PVPBattleground");
  }

  function testPassiveActionsUpgradeSafe() public {
    _validateUpgrade("contracts/PassiveActions.sol:PassiveActions");
  }

  function testPetNFTUpgradeSafe() public {
    _validateUpgrade("contracts/PetNFT.sol:PetNFT");
  }

  function testPetNFTRerollUpgradeSafe() public {
    _validateUpgrade("contracts/PetNFTReroll.sol:PetNFTReroll");
  }

  function testPlayerNFTUpgradeSafe() public {
    _validateUpgrade("contracts/PlayerNFT.sol:PlayerNFT");
  }

  function testPlayersUpgradeSafe() public {
    _validateUpgrade("contracts/Players/Players.sol:Players");
  }

  function testPromotionsUpgradeSafe() public {
    _validateUpgrade("contracts/Promotions.sol:Promotions");
  }

  function testQuestsUpgradeSafe() public {
    _validateUpgrade("contracts/Quests.sol:Quests");
  }

  function testRandomnessBeaconUpgradeSafe() public {
    _validateUpgrade("contracts/RandomnessBeacon.sol:RandomnessBeacon");
  }

  function testRoyaltyReceiverUpgradeSafe() public {
    _validateUpgrade("contracts/RoyaltyReceiver.sol:RoyaltyReceiver");
  }

  function testGameSubsidisationRegistryUpgradeSafe() public {
    _validateUpgrade("contracts/Session/GameSubsidisationRegistry.sol:GameSubsidisationRegistry");
  }

  function testUsageBasedSessionModuleUpgradeSafe() public {
    _validateUpgrade("contracts/Session/UsageBasedSessionModule.sol:UsageBasedSessionModule");
  }

  function testShopUpgradeSafe() public {
    _validateUpgrade("contracts/Shop.sol:Shop");
  }

  function testTreasuryUpgradeSafe() public {
    _validateUpgrade("contracts/Treasury.sol:Treasury");
  }

  function testWishingWellUpgradeSafe() public {
    _validateUpgrade("contracts/WishingWell.sol:WishingWell");
  }

  function testWorldActionsUpgradeSafe() public {
    _validateUpgrade("contracts/WorldActions.sol:WorldActions");
  }

  function testBankUpgradeSafe() public {
    _validateUpgrade("contracts/Clans/Bank.sol:Bank");
  }
}
