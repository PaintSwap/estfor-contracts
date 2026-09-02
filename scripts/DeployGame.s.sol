// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

/// @notice Broadcasts a complete fresh game using configured external dependencies.
/// @dev Contract bytecode is loaded from Foundry artifacts at runtime. External library placeholders
/// are linked to the libraries deployed at the start of this broadcast before CREATE is executed.
contract DeployGame is Script {
  string private constant ERC1967_PROXY = "out/ERC1967Proxy.sol/ERC1967Proxy.json";
  string private constant UPGRADEABLE_BEACON = "out/UpgradeableBeacon.sol/UpgradeableBeacon.json";

  address private owner;
  string private dataDir;
  string private deploymentJson;
  string private deploymentInputJson;
  uint256 private phase;
  bool private isBeta;

  address private estforLibrary;
  address private itemNFTLibrary;
  address private petNFTLibrary;
  address private playersLibrary;
  address private promotionsLibrary;
  address private clanBattleLibrary;
  address private lockedBankVaultsLibrary;

  address private brush;
  address private wftm;
  address private vrf;
  address private router;
  address private paintSwapMarketplaceWhitelist;
  address private usdc;
  address private lzEndpoint;

  address private bridge;
  address private worldActions;
  address private randomnessBeacon;
  address private dailyRewardsScheduler;
  address private treasury;
  address private shop;
  address private royaltyReceiver;
  address private adminAccess;
  address private itemNFT;
  address private activityPoints;
  address private orderBook;
  address private marketplace;
  address private playerNFT;
  address private cosmetics;
  address private blackMarketTrader;
  address private quests;
  address private clans;
  address private wishingWell;
  address private bankBeacon;
  address private petNFT;
  address private petNFTReroll;
  address private playersImplQueueActions;
  address private playersImplProcessActions;
  address private playersImplRewards;
  address private playersImplMisc;
  address private playersImplMisc1;
  address private players;
  address private promotions;
  address private globalEvents;
  address private passiveActions;
  address private instantActions;
  address private instantVRFActions;
  address private genericInstantVRFActionStrategy;
  address private eggInstantVRFActionStrategy;
  address private bankRelay;
  address private pvpBattleground;
  address private raids;
  address private lockedBankVaults;
  address private territories;
  address private combatantsHelper;
  address private gameSubsidisationRegistry;
  address private usageBasedSessionModule;
  address private territoryTreasury;
  address private bankRegistry;
  address private bankFactory;

  function run() external {
    uint256 privateKey = vm.envUint("PRIVATE_KEY");
    owner = vm.addr(privateKey);
    isBeta = vm.envOr("IS_BETA", false);
    dataDir = vm.envOr("DEPLOY_DATA_DIR", string(".forge-deploy-data"));
    phase = vm.envUint("DEPLOY_PHASE");
    if (phase != 1) {
      deploymentInputJson = vm.readFile(vm.envOr("DEPLOYMENT_INPUT", string(".deployments/deployment.json")));
    }

    deploymentJson = vm.serializeUint("deployment", "chainId", block.chainid);
    deploymentJson = vm.serializeAddress("deployment", "owner", owner);
    deploymentJson = vm.serializeBool("deployment", "isBeta", isBeta);

    vm.startBroadcast(privateKey);
    if (phase == 1) {
      _loadExternalDependenciesFromEnvironment();
      _recordExternalDependencies();
      _deployLibraries();
    } else if (phase == 2) {
      _loadExternalDependencies();
      _deployGame1();
    } else if (phase == 3) {
      _loadExternalDependencies();
      _loadGame1();
      _deployGame2();
    } else if (phase == 4) {
      _loadExternalDependencies();
      _loadGame1();
      _loadGame2();
      _deployGame3();
    } else if (phase == 5) {
      _loadAllContracts();
      _wireGame();
    } else if (phase == 6) {
      _loadAllContracts();
      _seedGame1();
    } else if (phase == 7) {
      _loadAllContracts();
      _seedGame2();
    } else if (phase == 8) {
      _loadAllContracts();
      _seedGame3();
    } else {
      revert("DeployGame: unknown phase");
    }
    vm.stopBroadcast();

    vm.writeJson(deploymentJson, vm.envString("DEPLOYMENT_PHASE_OUTPUT"));
    console2.log("Completed deployment phase", phase);
  }

  function _deployLibraries() private {
    estforLibrary = _deploy("out/EstforLibrary.sol/EstforLibrary.json", "");
    _record("estforLibrary", estforLibrary);
    itemNFTLibrary = _deploy("out/ItemNFTLibrary.sol/ItemNFTLibrary.json", "");
    _record("itemNFTLibrary", itemNFTLibrary);
    petNFTLibrary = _deploy("out/PetNFTLibrary.sol/PetNFTLibrary.json", "");
    _record("petNFTLibrary", petNFTLibrary);
    playersLibrary = _deploy("out/PlayersLibrary.sol/PlayersLibrary.json", "");
    _record("playersLibrary", playersLibrary);
    promotionsLibrary = _deploy("out/PromotionsLibrary.sol/PromotionsLibrary.json", "");
    _record("promotionsLibrary", promotionsLibrary);
    clanBattleLibrary = _deploy("out/ClanBattleLibrary.sol/ClanBattleLibrary.json", "");
    _record("clanBattleLibrary", clanBattleLibrary);
    lockedBankVaultsLibrary = _deploy("out/LockedBankVaultsLibrary.sol/LockedBankVaultsLibrary.json", "");
    _record("lockedBankVaultsLibrary", lockedBankVaultsLibrary);
  }

  function _loadExternalDependenciesFromEnvironment() private {
    brush = _externalAddress("BRUSH_ADDRESS");
    wftm = _externalAddress("WFTM_ADDRESS");
    vrf = _externalAddress("VRF_ADDRESS");
    router = _externalAddress("ROUTER_ADDRESS");
    paintSwapMarketplaceWhitelist = _externalAddress("PAINTSWAP_MARKETPLACE_WHITELIST_ADDRESS");
    usdc = _externalAddress("USDC_ADDRESS");
    lzEndpoint = _externalAddress("LZ_ENDPOINT_ADDRESS");
  }

  function _recordExternalDependencies() private {
    _record("brush", brush);
    _record("wftm", wftm);
    _record("vrf", vrf);
    _record("router", router);
    _record("paintSwapMarketplaceWhitelist", paintSwapMarketplaceWhitelist);
    _record("usdc", usdc);
    _record("lzEndpoint", lzEndpoint);
  }

  function _externalAddress(string memory variableName) private view returns (address dependency) {
    dependency = vm.envAddress(variableName);
    require(dependency.code.length != 0, string.concat("DeployGame: no code at ", variableName));
  }

  function _deployGame1() private {
    bridge = _uups("bridge", "out/Bridge.sol/Bridge.json", abi.encode(lzEndpoint), _initializer("bridge", _a0()));
    worldActions = _uups(
      "worldActions",
      "out/WorldActions.sol/WorldActions.json",
      "",
      _initializer("worldActions", _a0())
    );
    randomnessBeacon = _uups(
      "randomnessBeacon",
      "out/RandomnessBeacon.sol/RandomnessBeacon.json",
      "",
      _initializer("randomnessBeacon", _a(vrf))
    );
    _callValue(randomnessBeacon, "", 10 ether);
    dailyRewardsScheduler = _uups(
      "dailyRewardsScheduler",
      "out/DailyRewardsScheduler.sol/DailyRewardsScheduler.json",
      "",
      _initializer("dailyRewardsScheduler", _a(randomnessBeacon))
    );
    treasury = _uups("treasury", "out/Treasury.sol/Treasury.json", "", _initializer("treasury", _a(brush)));
    shop = _uups("shop", "out/Shop.sol/Shop.json", "", _initializer("shop", _a(brush, treasury)));
    royaltyReceiver = _uups(
      "royaltyReceiver",
      "out/RoyaltyReceiver.sol/RoyaltyReceiver.json",
      "",
      _initializer("royaltyReceiver", _a(router, treasury, brush, wftm))
    );
    adminAccess = _uups(
      "adminAccess",
      "out/AdminAccess.sol/AdminAccess.json",
      "",
      _initializer("adminAccess", _a(owner))
    );
    itemNFT = _uups(
      "itemNFT",
      "out/ItemNFT.sol/ItemNFT.json",
      "",
      _initializer("itemNFT", _a(royaltyReceiver, adminAccess))
    );
    activityPoints = _uups(
      "activityPoints",
      "out/ActivityPoints.sol/ActivityPoints.json",
      "",
      _initializer("activityPoints", _a(itemNFT))
    );
    orderBook = _uups(
      "orderBook",
      "out/OrderBook.sol/OrderBook.json",
      "",
      _initializer("orderBook", _a(itemNFT, brush))
    );
    marketplace = _uups(
      "marketplace",
      "out/Marketplace.sol/Marketplace.json",
      "",
      _initializer("marketplace", _a(brush, owner))
    );
    playerNFT = _uups(
      "playerNFT",
      "out/PlayerNFT.sol/PlayerNFT.json",
      "",
      _initializer("playerNFT", _a(brush, treasury, royaltyReceiver, bridge))
    );
    cosmetics = _uups(
      "cosmetics",
      "out/Cosmetics.sol/Cosmetics.json",
      "",
      _initializer("cosmetics", _a(owner, itemNFT, playerNFT))
    );
    blackMarketTrader = _uups(
      "blackMarketTrader",
      "out/BlackMarketTrader.sol/BlackMarketTrader.json",
      "",
      _initializer("blackMarketTrader", _a(owner, itemNFT, vrf))
    );
    quests = _uups(
      "quests",
      "out/Quests.sol/Quests.json",
      "",
      _initializer("quests", _a(randomnessBeacon, bridge, router, wftm, brush, activityPoints))
    );
    clans = _uups(
      "clans",
      "out/Clans.sol/Clans.json",
      "",
      _initializer("clans", _a(brush, playerNFT, treasury, paintSwapMarketplaceWhitelist, bridge, activityPoints))
    );
    wishingWell = _uups(
      "wishingWell",
      "out/WishingWell.sol/WishingWell.json",
      "",
      _initializer("wishingWell", _a(brush, playerNFT, treasury, randomnessBeacon, clans, activityPoints))
    );
  }

  function _deployGame2() private {
    address bankImplementation = _deploy("out/Bank.sol/Bank.json", "");
    _record("bankImplementation", bankImplementation);
    bankBeacon = _deploy(UPGRADEABLE_BEACON, abi.encode(bankImplementation, owner));
    _record("bankBeacon", bankBeacon);

    petNFT = _uups(
      "petNFT",
      "out/PetNFT.sol/PetNFT.json",
      "",
      _initializer("petNFT", _a(brush, royaltyReceiver, treasury, randomnessBeacon, bridge, adminAccess))
    );
    petNFTReroll = _uups(
      "petNFTReroll",
      "out/PetNFTReroll.sol/PetNFTReroll.json",
      "",
      _initializer("petNFTReroll", _a(owner, itemNFT, petNFT, vrf))
    );

    playersImplQueueActions = _linkedImplementation(
      "playersImplQueueActions",
      "out/PlayersImplQueueActions.sol/PlayersImplQueueActions.json"
    );
    playersImplProcessActions = _linkedImplementation(
      "playersImplProcessActions",
      "out/PlayersImplProcessActions.sol/PlayersImplProcessActions.json"
    );
    playersImplRewards = _linkedImplementation(
      "playersImplRewards",
      "out/PlayersImplRewards.sol/PlayersImplRewards.json"
    );
    playersImplMisc = _linkedImplementation("playersImplMisc", "out/PlayersImplMisc.sol/PlayersImplMisc.json");
    playersImplMisc1 = _linkedImplementation("playersImplMisc1", "out/PlayersImplMisc1.sol/PlayersImplMisc1.json");
    players = _uups(
      "players",
      "out/Players.sol/Players.json",
      "",
      _initializer("players", _playersInitializerAddresses())
    );
    promotions = _uups(
      "promotions",
      "out/Promotions.sol/Promotions.json",
      "",
      _initializer(
        "promotions",
        _a(players, randomnessBeacon, dailyRewardsScheduler, itemNFT, playerNFT, quests, brush, treasury, adminAccess)
      )
    );
    globalEvents = _uups(
      "globalEvents",
      "out/GlobalEvent.sol/GlobalEvents.json",
      "",
      _initializer("globalEvents", _a(owner, players, itemNFT))
    );
    passiveActions = _uups(
      "passiveActions",
      "out/PassiveActions.sol/PassiveActions.json",
      "",
      _initializer("passiveActions", _a(players, itemNFT, randomnessBeacon, bridge, activityPoints))
    );
    instantActions = _uups(
      "instantActions",
      "out/InstantActions.sol/InstantActions.json",
      "",
      _initializer("instantActions", _a(players, itemNFT, quests, activityPoints))
    );
    instantVRFActions = _uups(
      "instantVRFActions",
      "out/InstantVRFActions.sol/InstantVRFActions.json",
      "",
      _initializer("instantVRFActions", _a(players, itemNFT, petNFT, quests, vrf, activityPoints))
    );
  }

  function _deployGame3() private {
    genericInstantVRFActionStrategy = _uups(
      "genericInstantVRFActionStrategy",
      "out/GenericInstantVRFActionStrategy.sol/GenericInstantVRFActionStrategy.json",
      "",
      _initializer("genericInstantVRFActionStrategy", _a(instantVRFActions))
    );
    eggInstantVRFActionStrategy = _uups(
      "eggInstantVRFActionStrategy",
      "out/EggInstantVRFActionStrategy.sol/EggInstantVRFActionStrategy.json",
      "",
      _initializer("eggInstantVRFActionStrategy", _a(instantVRFActions))
    );
    bankRelay = _uups("bankRelay", "out/BankRelay.sol/BankRelay.json", "", _initializer("bankRelay", _a(clans)));
    pvpBattleground = _uups(
      "pvpBattleground",
      "out/PVPBattleground.sol/PVPBattleground.json",
      "",
      _initializer("pvpBattleground", _a(players, playerNFT, brush, itemNFT, vrf, adminAccess))
    );
    raids = _uups(
      "raids",
      "out/Raids.sol/Raids.json",
      "",
      _initializer("raids", _a(players, itemNFT, clans, vrf, brush, worldActions, randomnessBeacon))
    );
    _callValue(raids, "", 10 ether);
    lockedBankVaults = _uups(
      "lockedBankVaults",
      "out/LockedBankVaults.sol/LockedBankVaults.json",
      "",
      _initializer(
        "lockedBankVaults",
        _a(players, clans, brush, bankRelay, itemNFT, treasury, vrf, adminAccess, activityPoints)
      )
    );
    territories = _uups(
      "territories",
      "out/Territories.sol/Territories.json",
      "",
      _initializer(
        "territories",
        _a(players, clans, brush, lockedBankVaults, itemNFT, vrf, adminAccess, activityPoints)
      )
    );
    combatantsHelper = _uups(
      "combatantsHelper",
      "out/CombatantsHelper.sol/CombatantsHelper.json",
      "",
      _initializer("combatantsHelper", _a(players, clans, territories, lockedBankVaults, raids, adminAccess))
    );
    gameSubsidisationRegistry = _uups(
      "gameSubsidisationRegistry",
      "out/GameSubsidisationRegistry.sol/GameSubsidisationRegistry.json",
      "",
      _initializer("gameSubsidisationRegistry", _a(owner))
    );
    usageBasedSessionModule = _uups(
      "usageBasedSessionModule",
      "out/UsageBasedSessionModule.sol/UsageBasedSessionModule.json",
      "",
      _initializer("usageBasedSessionModule", _a(owner, gameSubsidisationRegistry))
    );

    address clansImplementationV2 = _deploy("out/Clans.sol/Clans.json", "");
    _record("clansImplementationV2", clansImplementationV2);
    _call(
      clans,
      abi.encodeWithSignature(
        "upgradeToAndCall(address,bytes)",
        clansImplementationV2,
        abi.encodeWithSignature("initializeV2(address)", combatantsHelper)
      )
    );

    territoryTreasury = _uups(
      "territoryTreasury",
      "out/TerritoryTreasury.sol/TerritoryTreasury.json",
      "",
      _initializer("territoryTreasury", _a(territories, brush, playerNFT, treasury))
    );
    bankRegistry = _uups(
      "bankRegistry",
      "out/BankRegistry.sol/BankRegistry.json",
      "",
      _initializer("bankRegistry", _a0())
    );
    bankFactory = _uups(
      "bankFactory",
      "out/BankFactory.sol/BankFactory.json",
      "",
      _initializer(
        "bankFactory",
        _a(bankBeacon, bankRegistry, bankRelay, playerNFT, itemNFT, clans, players, lockedBankVaults, raids)
      )
    );
  }

  function _wireGame() private {
    _call(
      bankRegistry,
      abi.encodeWithSignature("setForceItemDepositors(address[],bool[])", _a(activityPoints, raids), _bools(true, true))
    );
    _call(itemNFT, abi.encodeWithSignature("setApproved(address[],bool)", _a(activityPoints), true));
    _call(shop, abi.encodeWithSignature("setActivityPoints(address)", activityPoints));
    _call(
      activityPoints,
      abi.encodeWithSignature(
        "addCallers(address[])",
        _a(
          instantActions,
          instantVRFActions,
          passiveActions,
          quests,
          shop,
          wishingWell,
          clans,
          lockedBankVaults,
          territories,
          players
        )
      )
    );

    _call(
      randomnessBeacon,
      abi.encodeWithSignature("initializeAddresses(address,address)", wishingWell, dailyRewardsScheduler)
    );
    _call(randomnessBeacon, abi.encodeWithSignature("initializeRandomWords()"));
    _call(playerNFT, abi.encodeWithSignature("setPlayers(address)", players));
    _call(quests, abi.encodeWithSignature("setPlayers(address)", players));
    _call(wishingWell, abi.encodeWithSignature("setPlayers(address)", players));
    _call(
      petNFT,
      abi.encodeWithSignature("initializeAddresses(address,address,address)", instantVRFActions, players, territories)
    );
    _call(
      clans,
      abi.encodeWithSignature(
        "initializeAddresses(address,address,address,address,address)",
        players,
        bankFactory,
        territories,
        lockedBankVaults,
        raids
      )
    );
    _call(
      bridge,
      abi.encodeWithSignature(
        "initializeAddresses(address,address,address,address,address,address,address)",
        petNFT,
        itemNFT,
        playerNFT,
        players,
        clans,
        quests,
        passiveActions
      )
    );

    _setBrushDistribution(playerNFT);
    _setBrushDistribution(petNFT);
    _setBrushDistribution(shop);
    _setBrushDistribution(promotions);
    _setBrushDistribution(lockedBankVaults);
    _setBrushDistribution(clans);

    _call(shop, abi.encodeWithSignature("setItemNFT(address)", itemNFT));
    _call(itemNFT, abi.encodeWithSignature("initializeAddresses(address,address)", bankFactory, players));
    _call(playerNFT, abi.encodeWithSignature("setCosmeticsAddress(address)", cosmetics));
    _call(playerNFT, abi.encodeWithSignature("setMarketplaceAddress(address)", marketplace));
    _call(petNFT, abi.encodeWithSignature("setMarketplaceAddress(address)", marketplace));
    _call(petNFT, abi.encodeWithSignature("setApprovalForAll(address,bool)", marketplace, true));
    _call(playerNFT, abi.encodeWithSignature("setApprovalForAll(address,bool)", marketplace, true));

    _call(
      itemNFT,
      abi.encodeWithSignature(
        "setApproved(address[],bool)",
        _a(
          players,
          shop,
          promotions,
          instantActions,
          territories,
          lockedBankVaults,
          orderBook,
          instantVRFActions,
          passiveActions,
          raids,
          bridge,
          cosmetics,
          globalEvents,
          blackMarketTrader,
          petNFTReroll
        ),
        true
      )
    );
    _call(itemNFT, abi.encodeWithSignature("setApprovedBurners(address[],bool)", _a(petNFTReroll), true));
    _call(petNFT, abi.encodeWithSignature("setApprovedMinters(address[],bool)", _a(petNFTReroll), true));
    _call(petNFT, abi.encodeWithSignature("setApprovedBurners(address[],bool)", _a(petNFTReroll), true));
    _call(raids, abi.encodeWithSignature("initializeAddresses(address,address)", combatantsHelper, bankFactory));
    _call(
      lockedBankVaults,
      abi.encodeWithSignature(
        "initializeAddresses(address,address,address)",
        territories,
        combatantsHelper,
        bankFactory
      )
    );
    _call(territories, abi.encodeWithSignature("setCombatantsHelper(address)", combatantsHelper));
    _seedCategory("territoryMinimumMMRs", territories);

    _call(
      treasury,
      abi.encodeWithSignature(
        "setFundAllocationPercentages(address[],uint256[])",
        _a(shop, territoryTreasury, address(0)),
        _uints(2, 30, 68)
      )
    );
    _call(treasury, abi.encodeWithSignature("setSpenders(address[],bool)", _a(territoryTreasury, shop), true));
    _call(bankRelay, abi.encodeWithSignature("setBankFactory(address)", bankFactory));
    _call(pvpBattleground, abi.encodeWithSignature("setPreventAttacks(bool)", true));
    _call(raids, abi.encodeWithSignature("setPreventRaids(bool)", true));
    _call(
      instantVRFActions,
      abi.encodeWithSignature(
        "addStrategies(uint8[],address[])",
        _uint8s(1, 2, 3),
        _a(genericInstantVRFActionStrategy, genericInstantVRFActionStrategy, eggInstantVRFActionStrategy)
      )
    );
    _call(players, abi.encodeWithSignature("setDailyRewardsEnabled(bool)", true));
    _call(shop, abi.encodeWithSignature("setSupporterPackToken(address)", usdc));
    _call(players, abi.encodeWithSignature("setXPModifiers(address[],bool)", _a(bridge, quests), true));
    _call(
      clans,
      abi.encodeWithSignature("setXPModifiers(address[],bool)", _a(lockedBankVaults, territories, wishingWell), true)
    );
  }

  function _seedGame1() private {
    _seedCategory("avatars", playerNFT);
    _seedCategory("cosmetics", cosmetics);
    _seedCategory("xpThresholdRewards", players);
    _seedCategory("items", itemNFT);
    _seedCategory("quests", quests);
    _seedCategory("orderbook", orderBook);
    _seedCategory("fullAttireBonuses", players);
  }

  function _seedGame2() private {
    _seedCategory("dailyRewards", dailyRewardsScheduler);
    _seedCategory("weeklyRewards", dailyRewardsScheduler);
    _seedCategory("actions", worldActions);
    _seedCategory("actionChoices", worldActions);
    _seedCategory("shopItems", shop);
    _seedCategory("clanTiers", clans);
  }

  function _seedGame3() private {
    _seedCategory("instantActions", instantActions);
    _seedCategory("instantVRFActions", instantVRFActions);
    _seedCategory("passiveActions", passiveActions);
    _seedCategory("basePets", petNFT);
    _seedCategory("baseRaids", raids);
    _seedCategory("unsellableItems", shop);
    _call(
      adminAccess,
      abi.encodeWithSignature("addPromotionalAdmins(address[])", _a(0xe9fB52D7611e502D93af381AC493981B42d91974))
    );
    if (isBeta) {
      _call(
        adminAccess,
        abi.encodeWithSignature(
          "addAdmins(address[])",
          _a(
            0xB4DDa75e5Dee0a9e999152C3B72816fC1004d1dD,
            0xF83219Cd7D96ab2D80f16D36e5d9D00e287531eC,
            0xa801864d0D24686B15682261aa05D4e1e6e5BD94,
            0x6dC225F7f21ACB842761b8df52AE46208705c942
          )
        )
      );
    }
  }

  function _loadExternalDependencies() private {
    brush = _load("brush");
    wftm = _load("wftm");
    vrf = _load("vrf");
    router = _load("router");
    paintSwapMarketplaceWhitelist = _load("paintSwapMarketplaceWhitelist");
    usdc = _load("usdc");
    lzEndpoint = _load("lzEndpoint");
  }

  function _loadGame1() private {
    bridge = _load("bridge");
    worldActions = _load("worldActions");
    randomnessBeacon = _load("randomnessBeacon");
    dailyRewardsScheduler = _load("dailyRewardsScheduler");
    treasury = _load("treasury");
    shop = _load("shop");
    royaltyReceiver = _load("royaltyReceiver");
    adminAccess = _load("adminAccess");
    itemNFT = _load("itemNFT");
    activityPoints = _load("activityPoints");
    orderBook = _load("orderBook");
    marketplace = _load("marketplace");
    playerNFT = _load("playerNFT");
    cosmetics = _load("cosmetics");
    blackMarketTrader = _load("blackMarketTrader");
    quests = _load("quests");
    clans = _load("clans");
    wishingWell = _load("wishingWell");
  }

  function _loadGame2() private {
    bankBeacon = _load("bankBeacon");
    petNFT = _load("petNFT");
    petNFTReroll = _load("petNFTReroll");
    playersImplQueueActions = _load("playersImplQueueActions");
    playersImplProcessActions = _load("playersImplProcessActions");
    playersImplRewards = _load("playersImplRewards");
    playersImplMisc = _load("playersImplMisc");
    playersImplMisc1 = _load("playersImplMisc1");
    players = _load("players");
    promotions = _load("promotions");
    globalEvents = _load("globalEvents");
    passiveActions = _load("passiveActions");
    instantActions = _load("instantActions");
    instantVRFActions = _load("instantVRFActions");
  }

  function _loadGame3() private {
    genericInstantVRFActionStrategy = _load("genericInstantVRFActionStrategy");
    eggInstantVRFActionStrategy = _load("eggInstantVRFActionStrategy");
    bankRelay = _load("bankRelay");
    pvpBattleground = _load("pvpBattleground");
    raids = _load("raids");
    lockedBankVaults = _load("lockedBankVaults");
    territories = _load("territories");
    combatantsHelper = _load("combatantsHelper");
    gameSubsidisationRegistry = _load("gameSubsidisationRegistry");
    usageBasedSessionModule = _load("usageBasedSessionModule");
    territoryTreasury = _load("territoryTreasury");
    bankRegistry = _load("bankRegistry");
    bankFactory = _load("bankFactory");
  }

  function _loadAllContracts() private {
    _loadExternalDependencies();
    _loadGame1();
    _loadGame2();
    _loadGame3();
  }

  function _load(string memory name) private view returns (address) {
    return vm.parseJsonAddress(deploymentInputJson, string.concat(".", name));
  }

  function _uups(
    string memory name,
    string memory artifact,
    bytes memory constructorArgs,
    bytes memory initializer
  ) private returns (address proxy) {
    address implementation = _deploy(artifact, constructorArgs);
    _record(string.concat(name, "Implementation"), implementation);
    proxy = _deploy(ERC1967_PROXY, abi.encode(implementation, initializer));
    _record(name, proxy);
  }

  function _linkedImplementation(string memory name, string memory artifact) private returns (address implementation) {
    implementation = _deploy(artifact, "");
    _record(name, implementation);
  }

  function _deploy(string memory artifact, bytes memory constructorArgs) private returns (address deployed) {
    bytes memory creationCode = bytes.concat(_artifactCreationCode(artifact), constructorArgs);
    assembly ("memory-safe") {
      deployed := create(0, add(creationCode, 0x20), mload(creationCode))
    }
    require(deployed != address(0), string.concat("DeployGame: CREATE failed for ", artifact));
  }

  function _artifactCreationCode(string memory artifact) private view returns (bytes memory) {
    if (phase != 1) {
      return vm.readFileBinary(string.concat(dataDir, "/bytecode/", artifact, ".bin"));
    }
    string memory json = vm.readFile(artifact);
    string memory object = vm.parseJsonString(json, ".bytecode.object");
    object = _link(object, "contracts/EstforLibrary.sol:EstforLibrary", estforLibrary, address(0x1001));
    object = _link(object, "contracts/ItemNFTLibrary.sol:ItemNFTLibrary", itemNFTLibrary, address(0x1002));
    object = _link(object, "contracts/PetNFTLibrary.sol:PetNFTLibrary", petNFTLibrary, address(0x1003));
    object = _link(object, "contracts/Players/PlayersLibrary.sol:PlayersLibrary", playersLibrary, address(0x1004));
    object = _link(object, "contracts/PromotionsLibrary.sol:PromotionsLibrary", promotionsLibrary, address(0x1005));
    object = _link(
      object,
      "contracts/Clans/ClanBattleLibrary.sol:ClanBattleLibrary",
      clanBattleLibrary,
      address(0x1006)
    );
    object = _link(
      object,
      "contracts/Clans/LockedBankVaultsLibrary.sol:LockedBankVaultsLibrary",
      lockedBankVaultsLibrary,
      address(0x1007)
    );
    return vm.parseBytes(object);
  }

  function _link(
    string memory object,
    string memory fullyQualifiedName,
    address libraryAddress,
    address configuredLibraryAddress
  ) private pure returns (string memory) {
    if (libraryAddress == address(0)) return object;
    string memory hash = vm.toString(keccak256(bytes(fullyQualifiedName)));
    string memory placeholder = string.concat("__$", _slice(hash, 2, 36), "$__");
    string memory replacement = _slice(vm.toString(libraryAddress), 2, 42);
    if (_contains(bytes(object), bytes(placeholder))) return vm.replace(object, placeholder, replacement);

    // Foundry's selective-profile test configuration prelinks artifacts at fixed test addresses.
    // Replace that address when this deployment script links the artifact for a real network.
    string memory configured = _slice(vm.toString(configuredLibraryAddress), 2, 42);
    if (_contains(bytes(object), bytes(configured))) return vm.replace(object, configured, replacement);
    return object;
  }

  function _contains(bytes memory input, bytes memory needle) private pure returns (bool) {
    if (needle.length > input.length) return false;
    for (uint256 i; i <= input.length - needle.length; ++i) {
      bool matches = true;
      for (uint256 j; j < needle.length; ++j) {
        if (input[i + j] != needle[j]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
    return false;
  }

  function _initializer(string memory name, address[] memory replacements) private view returns (bytes memory data) {
    data = vm.readFileBinary(string.concat(dataDir, "/init/", name, ".bin"));
    for (uint256 offset = 4; offset + 32 <= data.length; offset += 32) {
      uint256 word;
      assembly ("memory-safe") {
        word := mload(add(add(data, 0x20), offset))
      }
      for (uint256 i; i < replacements.length; ++i) {
        uint256 placeholder = uint256(uint160(bytes20(hex"f000000000000000000000000000000000000000"))) + i + 1;
        if (word == placeholder) {
          address replacement = replacements[i];
          assembly ("memory-safe") {
            mstore(add(add(data, 0x20), offset), replacement)
          }
          break;
        }
      }
    }
  }

  function _seedCategory(string memory category, address target) private {
    string memory manifest = vm.readFile(string.concat(dataDir, "/manifest.json"));
    uint256 count = vm.parseJsonUint(manifest, string.concat(".calls.", category));
    console2.log("Seeding", category, count);
    for (uint256 i; i < count; ++i) {
      _call(target, vm.readFileBinary(string.concat(dataDir, "/seed/", category, "-", vm.toString(i), ".bin")));
    }
  }

  function _setBrushDistribution(address target) private {
    _call(target, abi.encodeWithSignature("setBrushDistributionPercentages(uint8,uint8,uint8)", 25, 50, 25));
  }

  function _call(address target, bytes memory data) private {
    _callValue(target, data, 0);
  }

  function _callValue(address target, bytes memory data, uint256 value) private {
    (bool success, bytes memory result) = target.call{value: value}(data);
    if (!success) {
      assembly ("memory-safe") {
        revert(add(result, 0x20), mload(result))
      }
    }
  }

  function _record(string memory name, address deployed) private {
    deploymentJson = vm.serializeAddress("deployment", name, deployed);
  }

  function _slice(string memory input, uint256 start, uint256 end) private pure returns (string memory output) {
    bytes memory source = bytes(input);
    bytes memory result = new bytes(end - start);
    for (uint256 i; i < result.length; ++i) {
      result[i] = source[start + i];
    }
    output = string(result);
  }

  function _a0() private pure returns (address[] memory values) {
    values = new address[](0);
  }

  function _a(address a) private pure returns (address[] memory values) {
    values = new address[](1);
    values[0] = a;
  }

  function _a(address a, address b) private pure returns (address[] memory values) {
    values = new address[](2);
    values[0] = a;
    values[1] = b;
  }

  function _a(address a, address b, address c) private pure returns (address[] memory values) {
    values = new address[](3);
    values[0] = a;
    values[1] = b;
    values[2] = c;
  }

  function _a(address a, address b, address c, address d) private pure returns (address[] memory values) {
    values = new address[](4);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
  }

  function _a(address a, address b, address c, address d, address e) private pure returns (address[] memory values) {
    values = new address[](5);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
  }

  function _a(
    address a,
    address b,
    address c,
    address d,
    address e,
    address f
  ) private pure returns (address[] memory values) {
    values = new address[](6);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
  }

  function _a(
    address a,
    address b,
    address c,
    address d,
    address e,
    address f,
    address g
  ) private pure returns (address[] memory values) {
    values = new address[](7);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
    values[6] = g;
  }

  function _a(
    address a,
    address b,
    address c,
    address d,
    address e,
    address f,
    address g,
    address h
  ) private pure returns (address[] memory values) {
    values = new address[](8);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
    values[6] = g;
    values[7] = h;
  }

  function _a(
    address a,
    address b,
    address c,
    address d,
    address e,
    address f,
    address g,
    address h,
    address i
  ) private pure returns (address[] memory values) {
    values = new address[](9);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
    values[6] = g;
    values[7] = h;
    values[8] = i;
  }

  function _a(
    address a,
    address b,
    address c,
    address d,
    address e,
    address f,
    address g,
    address h,
    address i,
    address j
  ) private pure returns (address[] memory values) {
    values = new address[](10);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
    values[6] = g;
    values[7] = h;
    values[8] = i;
    values[9] = j;
  }

  function _a(
    address a,
    address b,
    address c,
    address d,
    address e,
    address f,
    address g,
    address h,
    address i,
    address j,
    address k,
    address l,
    address m,
    address n,
    address o
  ) private pure returns (address[] memory values) {
    values = new address[](15);
    values[0] = a;
    values[1] = b;
    values[2] = c;
    values[3] = d;
    values[4] = e;
    values[5] = f;
    values[6] = g;
    values[7] = h;
    values[8] = i;
    values[9] = j;
    values[10] = k;
    values[11] = l;
    values[12] = m;
    values[13] = n;
    values[14] = o;
  }

  function _playersInitializerAddresses() private view returns (address[] memory values) {
    values = new address[](17);
    values[0] = itemNFT;
    values[1] = playerNFT;
    values[2] = petNFT;
    values[3] = worldActions;
    values[4] = randomnessBeacon;
    values[5] = dailyRewardsScheduler;
    values[6] = adminAccess;
    values[7] = quests;
    values[8] = clans;
    values[9] = wishingWell;
    values[10] = playersImplQueueActions;
    values[11] = playersImplProcessActions;
    values[12] = playersImplRewards;
    values[13] = playersImplMisc;
    values[14] = playersImplMisc1;
    values[15] = bridge;
    values[16] = activityPoints;
  }

  function _bools(bool a, bool b) private pure returns (bool[] memory values) {
    values = new bool[](2);
    values[0] = a;
    values[1] = b;
  }

  function _uints(uint256 a, uint256 b, uint256 c) private pure returns (uint256[] memory values) {
    values = new uint256[](3);
    values[0] = a;
    values[1] = b;
    values[2] = c;
  }

  function _uint8s(uint8 a, uint8 b, uint8 c) private pure returns (uint8[] memory values) {
    values = new uint8[](3);
    values[0] = a;
    values[1] = b;
    values[2] = c;
  }
}
