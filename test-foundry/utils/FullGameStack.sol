// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {Vm} from "forge-std/Vm.sol";

import {Skill} from "../../contracts/globals/misc.sol";
import {EstforLibrary} from "../../contracts/EstforLibrary.sol";
import {AvatarInfo, CosmeticInfo, EquipPosition} from "../../contracts/globals/players.sol";
import {AdminAccess} from "../../contracts/AdminAccess.sol";
import {ActivityPoints} from "../../contracts/ActivityPoints/ActivityPoints.sol";
import {IActivityPoints, IActivityPointsCaller} from "../../contracts/ActivityPoints/interfaces/IActivityPoints.sol";
import {BlackMarketTrader} from "../../contracts/Events/BlackMarketTrader.sol";
import {GlobalEvents} from "../../contracts/Events/GlobalEvent.sol";
import {Bridge} from "../../contracts/Bridge/Bridge.sol";
import {Cosmetics} from "../../contracts/Cosmetics.sol";
import {DailyRewardsScheduler} from "../../contracts/DailyRewardsScheduler.sol";
import {Marketplace} from "../../contracts/Marketplace.sol";
import {PassiveActions} from "../../contracts/PassiveActions.sol";
import {PetNFT} from "../../contracts/PetNFT.sol";
import {PetNFTReroll} from "../../contracts/PetNFTReroll.sol";
import {PlayerNFT} from "../../contracts/PlayerNFT.sol";
import {Promotions} from "../../contracts/Promotions.sol";
import {PVPBattleground} from "../../contracts/PVPBattleground.sol";
import {Quests} from "../../contracts/Quests.sol";
import {RoyaltyReceiver} from "../../contracts/RoyaltyReceiver.sol";
import {Shop} from "../../contracts/Shop.sol";
import {Treasury} from "../../contracts/Treasury.sol";
import {WishingWell} from "../../contracts/WishingWell.sol";
import {WorldActions} from "../../contracts/WorldActions.sol";
import {Bank} from "../../contracts/Clans/Bank.sol";
import {BankFactory} from "../../contracts/Clans/BankFactory.sol";
import {BankRegistry} from "../../contracts/Clans/BankRegistry.sol";
import {BankRelay} from "../../contracts/Clans/BankRelay.sol";
import {Clans} from "../../contracts/Clans/Clans.sol";
import {CombatantsHelper} from "../../contracts/Clans/CombatantsHelper.sol";
import {LockedBankVaults} from "../../contracts/Clans/LockedBankVaults.sol";
import {Raids} from "../../contracts/Clans/Raids.sol";
import {Territories} from "../../contracts/Clans/Territories.sol";
import {IClans} from "../../contracts/interfaces/IClans.sol";
import {ICombatants} from "../../contracts/interfaces/ICombatants.sol";
import {ICombatantsHelper} from "../../contracts/interfaces/ICombatantsHelper.sol";
import {IItemNFT} from "../../contracts/interfaces/IItemNFT.sol";
import {IPlayerNFT} from "../../contracts/interfaces/IPlayerNFT.sol";
import {IWorldActions} from "../../contracts/interfaces/IWorldActions.sol";
import {InstantActions} from "../../contracts/InstantActions.sol";
import {InstantVRFActions} from "../../contracts/InstantVRFActions.sol";
import {EggInstantVRFActionStrategy} from "../../contracts/InstantVRFActionStrategies/EggInstantVRFActionStrategy.sol";
import {GenericInstantVRFActionStrategy} from "../../contracts/InstantVRFActionStrategies/GenericInstantVRFActionStrategy.sol";
import {ItemNFT} from "../../contracts/ItemNFT.sol";
import {Players} from "../../contracts/Players/Players.sol";
import {PlayersImplMisc} from "../../contracts/Players/PlayersImplMisc.sol";
import {PlayersImplMisc1} from "../../contracts/Players/PlayersImplMisc1.sol";
import {PlayersImplProcessActions} from "../../contracts/Players/PlayersImplProcessActions.sol";
import {PlayersImplQueueActions} from "../../contracts/Players/PlayersImplQueueActions.sol";
import {PlayersImplRewards} from "../../contracts/Players/PlayersImplRewards.sol";
import {IBankFactory} from "../../contracts/interfaces/IBankFactory.sol";
import {IBrushToken} from "../../contracts/interfaces/external/IBrushToken.sol";
import {IClanMemberLeftCB} from "../../contracts/interfaces/IClanMemberLeftCB.sol";
import {IOracleCB} from "../../contracts/interfaces/IOracleCB.sol";
import {ITerritories} from "../../contracts/interfaces/ITerritories.sol";
import {IPlayers} from "../../contracts/interfaces/IPlayers.sol";
import {ISolidlyRouter} from "../../contracts/interfaces/external/ISolidlyRouter.sol";
import {MockBrushToken} from "../../contracts/test/external/MockBrushToken.sol";
import {MockPaintSwapMarketplaceWhitelist} from "../../contracts/test/external/MockPaintSwapMarketplaceWhitelist.sol";
import {MockRouter} from "../../contracts/test/external/MockRouter.sol";
import {EndpointV2Mock} from "@layerzerolabs/test-devtools-evm-foundry/contracts/mocks/EndpointV2Mock.sol";
import {EstforTest} from "./EstforTest.sol";

abstract contract FullGameStack is EstforTest {
    uint32 internal constant LZ_FANTOM_EID = 30112;
    uint16 internal constant ACTIVITY_TICKET = 65465;
    uint16 internal constant SONIC_GEM_TICKET = 65466;
    uint16 internal constant AVATAR_001_CHIMP = 15712;
    uint16 internal constant START_CLAN_ID = 1;
    uint16 internal constant INITIAL_MMR = 500;
    uint8 internal constant MAX_INSTANT_VRF_ACTION_AMOUNT = 64;

    address internal constant CHARLIE = address(0xCA0);
    address internal constant ERIN = address(0xE11);
    address internal constant FRANK = address(0xF1A);
    address internal constant GEOFF = address(0x6E0F);
    address internal constant HARRY = address(0x8A12);
    address internal constant ISLA = address(0x15A);
    address internal constant JULIET = address(0x7A1E);
    address internal constant KIKI = address(0x4141);
    address internal constant LUCY = address(0x1C2);

    string internal constant ORIG_NAME = "0xSamWitch";

    address internal lzEndpoint;
    Bridge internal bridge;
    WorldActions internal worldActions;
    Marketplace internal marketplace;
    ActivityPoints internal activityPoints;
    address internal estforLibrary;
    PlayerNFT internal playerNFT;
    Quests internal quests;
    Clans internal clans;
    WishingWell internal wishingWell;
    PetNFT internal petNFT;
    PetNFTReroll internal petNFTReroll;
    Players internal players;
    address internal playersImplQueueActions;
    address internal playersImplProcessActions;
    address internal playersImplRewards;
    address internal playersImplMisc;
    address internal playersImplMisc1;
    Promotions internal promotions;
    InstantActions internal instantActions;
    BlackMarketTrader internal blackMarketTrader;
    InstantVRFActions internal instantVRFActions;
    GenericInstantVRFActionStrategy internal genericInstantVRFActionStrategy;
    EggInstantVRFActionStrategy internal eggInstantVRFActionStrategy;
    BankRelay internal bankRelay;
    PVPBattleground internal pvpBattleground;
    Raids internal raids;
    LockedBankVaults internal lockedBankVaults;
    Territories internal territories;
    CombatantsHelper internal combatantsHelper;
    PassiveActions internal passiveActions;
    address internal bank;
    BankRegistry internal bankRegistry;
    BankFactory internal bankFactory;
    Cosmetics internal cosmetics;
    GlobalEvents internal globalEvents;
    MockPaintSwapMarketplaceWhitelist internal paintSwapMarketplaceWhitelist;
    uint256 internal playerId;

    function deployFullGame() internal {
        _deployBeaconStack();
        brush = new MockBrushToken();
        estforLibrary = address(new EstforLibrary());

        lzEndpoint = address(new EndpointV2Mock(LZ_FANTOM_EID, address(this)));
        bridge = Bridge(payable(_deployUUPS(address(new Bridge(lzEndpoint)), abi.encodeCall(Bridge.initialize, (LZ_FANTOM_EID)))));

        worldActions = WorldActions(_deployUUPS(address(new WorldActions()), abi.encodeCall(WorldActions.initialize, ())));

        marketplace = Marketplace(
            _deployUUPS(address(new Marketplace()), abi.encodeCall(Marketplace.initialize, (IBrushToken(address(brush)), address(this))))
        );

        DailyRewardsScheduler schedulerImplementation = new DailyRewardsScheduler();
        dailyRewardsScheduler = DailyRewardsScheduler(
            _deployUUPS(
                address(schedulerImplementation),
                abi.encodeCall(schedulerImplementation.initialize, (address(randomnessBeacon)))
            )
        );

        Treasury treasuryImplementation = new Treasury();
        treasury = Treasury(
            _deployUUPS(
                address(treasuryImplementation), abi.encodeCall(Treasury.initialize, (IBrushToken(address(brush))))
            )
        );

        MockRouter router = new MockRouter();
        RoyaltyReceiver royaltyReceiverImplementation = new RoyaltyReceiver();
        royaltyReceiver = RoyaltyReceiver(
            payable(
                _deployUUPS(
                    address(royaltyReceiverImplementation),
                    abi.encodeCall(
                        RoyaltyReceiver.initialize,
                        (ISolidlyRouter(address(router)), address(treasury), DEV, IBrushToken(address(brush)), ALICE)
                    )
                )
            )
        );

        adminAccess = AdminAccess(
            _deployUUPS(
                address(new AdminAccess()),
                abi.encodeCall(
                    AdminAccess.initialize, (_addresses(address(this), ALICE), _addresses(address(this), ALICE))
                )
            )
        );

        ItemNFT itemNFTImplementation = new ItemNFT();
        itemNFT = ItemNFT(
            _deployUUPS(
                address(itemNFTImplementation),
                abi.encodeCall(ItemNFT.initialize, (address(royaltyReceiver), "ipfs://", adminAccess, true))
            )
        );

        activityPoints = ActivityPoints(
            _deployUUPS(
                address(new ActivityPoints()),
                abi.encodeCall(
                    ActivityPoints.initialize, (address(itemNFT), ACTIVITY_TICKET, SONIC_GEM_TICKET)
                )
            )
        );
        itemNFT.setApproved(_addresses(address(activityPoints)), true);

        Shop shopImplementation = new Shop();
        shop = Shop(
            _deployUUPS(
                address(shopImplementation),
                abi.encodeCall(
                    Shop.initialize,
                    (IBrushToken(address(brush)), treasury, DEV, MIN_ITEM_QUANTITY_BEFORE_SELLS_ALLOWED, SELLING_CUTOFF_DURATION)
                )
            )
        );
        shop.setItemNFT(itemNFT);

        PlayerNFT playerNFTImplementation = new PlayerNFT();
        playerNFT = PlayerNFT(
            _deployUUPS(
                address(playerNFTImplementation),
                abi.encodeCall(
                    PlayerNFT.initialize,
                    (
                        IBrushToken(address(brush)),
                        address(treasury),
                        DEV,
                        address(royaltyReceiver),
                        uint72(1 ether),
                        uint72(1 ether),
                        "ipfs://",
                        uint64(1),
                        true,
                        address(bridge)
                    )
                )
            )
        );

        address[2] memory buyPath = [ALICE, address(brush)];
        Quests questsImplementation = new Quests();
        quests = Quests(
            payable(
                _deployUUPS(
                    address(questsImplementation),
                    abi.encodeCall(
                        Quests.initialize,
                        (
                            address(randomnessBeacon),
                            address(bridge),
                            ISolidlyRouter(address(router)),
                            buyPath,
                            IActivityPoints(address(activityPoints))
                        )
                    )
                )
            )
        );

        paintSwapMarketplaceWhitelist = new MockPaintSwapMarketplaceWhitelist();
        Clans clansImplementation = new Clans();
        clans = Clans(
            _deployUUPS(
                address(clansImplementation),
                abi.encodeCall(
                    Clans.initialize,
                    (
                        IBrushToken(address(brush)),
                        IERC1155(address(playerNFT)),
                        address(treasury),
                        DEV,
                        uint80(1 ether),
                        address(paintSwapMarketplaceWhitelist),
                        INITIAL_MMR,
                        START_CLAN_ID,
                        address(bridge),
                        IActivityPoints(address(activityPoints))
                    )
                )
            )
        );

        WishingWell wishingWellImplementation = new WishingWell();
        wishingWell = WishingWell(
            _deployUUPS(
                address(wishingWellImplementation),
                abi.encodeCall(
                    WishingWell.initialize,
                    (
                        IBrushToken(address(brush)),
                        playerNFT,
                        address(treasury),
                        address(randomnessBeacon),
                        clans,
                        5 ether,
                        1000 ether,
                        250 ether,
                        IActivityPoints(address(activityPoints))
                    )
                )
            )
        );

        PetNFT petNFTImplementation = new PetNFT();
        petNFT = PetNFT(
            _deployUUPS(
                address(petNFTImplementation),
                abi.encodeCall(
                    PetNFT.initialize,
                    (
                        IBrushToken(address(brush)),
                        address(royaltyReceiver),
                        "ipfs://",
                        DEV,
                        uint72(1 ether),
                        address(treasury),
                        randomnessBeacon,
                        uint40(1),
                        address(bridge),
                        adminAccess,
                        true
                    )
                )
            )
        );

        PetNFTReroll petNFTRerollImplementation = new PetNFTReroll();
        petNFTReroll = PetNFTReroll(
            _deployUUPS(
                address(petNFTRerollImplementation),
                abi.encodeCall(
                    PetNFTReroll.initialize, (address(this), itemNFT, petNFT, address(mockVRF))
                )
            )
        );

        PlayersImplQueueActions queueActionsImplementation = new PlayersImplQueueActions();
        playersImplQueueActions = address(queueActionsImplementation);
        PlayersImplProcessActions processActionsImplementation = new PlayersImplProcessActions();
        playersImplProcessActions = address(processActionsImplementation);
        PlayersImplRewards rewardsImplementation = new PlayersImplRewards();
        playersImplRewards = address(rewardsImplementation);
        PlayersImplMisc miscImplementation = new PlayersImplMisc();
        playersImplMisc = address(miscImplementation);
        PlayersImplMisc1 misc1Implementation = new PlayersImplMisc1();
        playersImplMisc1 = address(misc1Implementation);

        Players playersImplementation = new Players();
        players = Players(
            _deployUUPS(
                address(playersImplementation),
                abi.encodeCall(
                    Players.initialize,
                    (
                        itemNFT,
                        playerNFT,
                        petNFT,
                        IWorldActions(address(worldActions)),
                        randomnessBeacon,
                        dailyRewardsScheduler,
                        adminAccess,
                        quests,
                        clans,
                        wishingWell,
                        playersImplQueueActions,
                        playersImplProcessActions,
                        playersImplRewards,
                        playersImplMisc,
                        playersImplMisc1,
                        address(bridge),
                        IActivityPoints(address(activityPoints)),
                        true
                    )
                )
            )
        );

        Promotions promotionsImplementation = new Promotions();
        promotions = Promotions(
            _deployUUPS(
                address(promotionsImplementation),
                abi.encodeCall(
                    Promotions.initialize,
                    (
                        IPlayers(address(players)),
                        randomnessBeacon,
                        dailyRewardsScheduler,
                        itemNFT,
                        playerNFT,
                        quests,
                        IBrushToken(address(brush)),
                        address(treasury),
                        DEV,
                        adminAccess,
                        true
                    )
                )
            )
        );

        InstantActions instantActionsImplementation = new InstantActions();
        instantActions = InstantActions(
            _deployUUPS(
                address(instantActionsImplementation),
                abi.encodeCall(
                    InstantActions.initialize,
                    (IPlayers(address(players)), itemNFT, quests, IActivityPoints(address(activityPoints)))
                )
            )
        );

        BlackMarketTrader blackMarketTraderImplementation = new BlackMarketTrader();
        blackMarketTrader = BlackMarketTrader(
            _deployUUPS(
                address(blackMarketTraderImplementation),
                abi.encodeCall(BlackMarketTrader.initialize, (address(this), itemNFT, address(mockVRF)))
            )
        );

        InstantVRFActions instantVRFActionsImplementation = new InstantVRFActions();
        instantVRFActions = InstantVRFActions(
            _deployUUPS(
                address(instantVRFActionsImplementation),
                abi.encodeCall(
                    InstantVRFActions.initialize,
                    (players, itemNFT, petNFT, quests, address(mockVRF), MAX_INSTANT_VRF_ACTION_AMOUNT, IActivityPoints(address(activityPoints)))
                )
            )
        );

        GenericInstantVRFActionStrategy genericStrategyImplementation = new GenericInstantVRFActionStrategy();
        genericInstantVRFActionStrategy = GenericInstantVRFActionStrategy(
            _deployUUPS(
                address(genericStrategyImplementation),
                abi.encodeCall(GenericInstantVRFActionStrategy.initialize, (address(instantVRFActions)))
            )
        );

        EggInstantVRFActionStrategy eggStrategyImplementation = new EggInstantVRFActionStrategy();
        eggInstantVRFActionStrategy = EggInstantVRFActionStrategy(
            _deployUUPS(
                address(eggStrategyImplementation),
                abi.encodeCall(EggInstantVRFActionStrategy.initialize, (address(instantVRFActions)))
            )
        );

        BankRelay bankRelayImplementation = new BankRelay();
        bankRelay = BankRelay(
            _deployUUPS(address(bankRelayImplementation), abi.encodeCall(BankRelay.initialize, (address(clans))))
        );

        PVPBattleground pvpBattlegroundImplementation = new PVPBattleground();
        pvpBattleground = PVPBattleground(
            _deployUUPS(
                address(pvpBattlegroundImplementation),
                abi.encodeCall(
                    PVPBattleground.initialize,
                    (
                        IPlayers(address(players)),
                        playerNFT,
                        IBrushToken(address(brush)),
                        itemNFT,
                        address(mockVRF),
                        _battleSkills(),
                        3600,
                        adminAccess,
                        true
                    )
                )
            )
        );

        _deploySessionStack();

        Raids raidsImplementation = new Raids();
        raids = Raids(
            payable(
                _deployUUPS(
                    address(raidsImplementation),
                    abi.encodeCall(
                        Raids.initialize,
                        (
                            IPlayers(address(players)),
                            itemNFT,
                            IClans(address(clans)),
                            address(mockVRF),
                            8 hours,
                            IBrushToken(address(brush)),
                            IWorldActions(address(worldActions)),
                            randomnessBeacon,
                            20,
                            _raidCombatActionIds(),
                            true
                        )
                    )
                )
            )
        );
        vm.deal(address(raids), 10 ether);

        LockedBankVaults lockedBankVaultsImplementation = new LockedBankVaults();
        lockedBankVaults = LockedBankVaults(
            _deployUUPS(
                address(lockedBankVaultsImplementation),
                abi.encodeCall(
                    LockedBankVaults.initialize,
                    (
                        IPlayers(address(players)),
                        IClans(address(clans)),
                        IBrushToken(address(brush)),
                        address(bankRelay),
                        itemNFT,
                        address(treasury),
                        DEV,
                        address(mockVRF),
                        _battleSkills(),
                        4,
                        uint24(7 days),
                        20,
                        100,
                        adminAccess,
                        IActivityPoints(address(activityPoints)),
                        true
                    )
                )
            )
        );
        lockedBankVaults.setKValues(3, 3);

        Territories territoriesImplementation = new Territories();
        territories = Territories(
            _deployUUPS(
                address(territoriesImplementation),
                abi.encodeCall(
                    Territories.initialize,
                    (
                        _territories(),
                        address(players),
                        IClans(address(clans)),
                        IBrushToken(address(brush)),
                        lockedBankVaults,
                        itemNFT,
                        address(mockVRF),
                        _battleSkills(),
                        20,
                        24 hours,
                        adminAccess,
                        IActivityPoints(address(activityPoints)),
                        true
                    )
                )
            )
        );

        CombatantsHelper combatantsHelperImplementation = new CombatantsHelper();
        combatantsHelper = CombatantsHelper(
            _deployUUPS(
                address(combatantsHelperImplementation),
                abi.encodeCall(
                    CombatantsHelper.initialize,
                    (
                        IPlayers(address(players)),
                        IClans(address(clans)),
                        ICombatants(address(territories)),
                        ICombatants(address(lockedBankVaults)),
                        ICombatants(address(raids)),
                        adminAccess,
                        true
                    )
                )
            )
        );

        clans.upgradeToAndCall(
            address(new Clans()), abi.encodeCall(Clans.initializeV2, (ICombatantsHelper(address(combatantsHelper))))
        );

        PassiveActions passiveActionsImplementation = new PassiveActions();
        passiveActions = PassiveActions(
            _deployUUPS(
                address(passiveActionsImplementation),
                abi.encodeCall(
                    PassiveActions.initialize,
                    (IPlayers(address(players)), itemNFT, randomnessBeacon, address(bridge), IActivityPoints(address(activityPoints)))
                )
            )
        );

        bank = address(new UpgradeableBeacon(address(new Bank()), address(this)));

        BankRegistry bankRegistryImplementation = new BankRegistry();
        bankRegistry = BankRegistry(_deployUUPS(address(bankRegistryImplementation), abi.encodeCall(BankRegistry.initialize, ())));
        bankRegistry.setForceItemDepositors(_addresses(address(raids), address(activityPoints)), _bools(true, true));

        BankFactory bankFactoryImplementation = new BankFactory();
        bankFactory = BankFactory(
            _deployUUPS(
                address(bankFactoryImplementation),
                abi.encodeCall(
                    BankFactory.initialize,
                    (
                        bank,
                        address(bankRegistry),
                        address(bankRelay),
                        address(playerNFT),
                        address(itemNFT),
                        address(clans),
                        address(players),
                        address(lockedBankVaults),
                        address(raids)
                    )
                )
            )
        );

        cosmetics = Cosmetics(
            _deployUUPS(
                address(new Cosmetics()),
                abi.encodeCall(Cosmetics.initialize, (address(this), IItemNFT(address(itemNFT)), IPlayerNFT(address(playerNFT))))
            )
        );

        GlobalEvents globalEventsImplementation = new GlobalEvents();
        globalEvents = GlobalEvents(
            _deployUUPS(
                address(globalEventsImplementation),
                abi.encodeCall(
                    GlobalEvents.initialize, (address(this), IPlayers(address(players)), IItemNFT(address(itemNFT)))
                )
            )
        );

        randomnessBeacon.initializeAddresses(IOracleCB(address(wishingWell)), IOracleCB(address(dailyRewardsScheduler)));
        randomnessBeacon.initializeRandomWords();

        playerNFT.setPlayers(IPlayers(address(players)));
        quests.setPlayers(IPlayers(address(players)));
        wishingWell.setPlayers(IPlayers(address(players)));

        petNFT.initializeAddresses(address(instantVRFActions), address(players), address(territories));

        clans.initializeAddresses(
            IPlayers(address(players)),
            IBankFactory(address(bankFactory)),
            IClanMemberLeftCB(address(territories)),
            IClanMemberLeftCB(address(lockedBankVaults)),
            IClanMemberLeftCB(address(raids))
        );

        playerNFT.setBrushDistributionPercentages(25, 50, 25);
        petNFT.setBrushDistributionPercentages(25, 50, 25);
        shop.setBrushDistributionPercentages(25, 50, 25);
        promotions.setBrushDistributionPercentages(25, 50, 25);
        lockedBankVaults.setBrushDistributionPercentages(25, 50, 25);
        clans.setBrushDistributionPercentages(25, 50, 25);

        treasury.setFundAllocationPercentages(_addresses(address(shop), address(0)), _uints(10, 90));
        treasury.setSpenders(_addresses(address(shop)), true);

        bankRelay.setBankFactory(address(bankFactory));

        itemNFT.initializeAddresses(IBankFactory(address(bankFactory)), IPlayers(address(players)));
        itemNFT.setApproved(
            _addresses12(
                address(players),
                address(shop),
                address(promotions),
                address(instantActions),
                address(territories),
                address(lockedBankVaults),
                address(instantVRFActions),
                address(passiveActions),
                address(raids),
                address(cosmetics),
                address(globalEvents),
                address(blackMarketTrader)
            ),
            true
        );
        itemNFT.setApprovedBurners(_addresses(address(petNFTReroll)), true);
        petNFT.setApprovedMinters(_addresses(address(petNFTReroll)), true);
        petNFT.setApprovedBurners(_addresses(address(petNFTReroll)), true);

        territories.setCombatantsHelper(address(combatantsHelper));
        raids.initializeAddresses(address(combatantsHelper), IBankFactory(address(bankFactory)));
        lockedBankVaults.initializeAddresses(ITerritories(address(territories)), address(combatantsHelper), IBankFactory(address(bankFactory)));
        clans.setXPModifiers(_addresses(address(lockedBankVaults), address(territories), address(wishingWell)), true);
        players.setAlphaCombatParams(1, 1, 0);

        playerNFT.setMarketplaceAddress(address(marketplace));
        petNFT.setMarketplaceAddress(address(marketplace));
        playerNFT.setApprovalForAll(address(marketplace), true);
        petNFT.setApprovalForAll(address(marketplace), true);
        playerNFT.setCosmeticsAddress(address(cosmetics));

        address[10] memory callers = [
            address(lockedBankVaults),
            address(territories),
            address(instantVRFActions),
            address(instantActions),
            address(players),
            address(wishingWell),
            address(clans),
            address(quests),
            address(shop),
            address(passiveActions)
        ];
        address[] memory callerAddresses = new address[](10);
        for (uint256 i; i < callers.length; ++i) {
            callerAddresses[i] = callers[i];
        }
        activityPoints.addCallers(callerAddresses);
        for (uint256 i; i < callerAddresses.length; ++i) {
            IActivityPointsCaller(callerAddresses[i]).setActivityPoints(address(activityPoints));
        }

        AvatarInfo[] memory avatarInfos = new AvatarInfo[](2);
        avatarInfos[0] = AvatarInfo({
            name: "Name goes here",
            description: "Hi I'm a description",
            imageURI: "1234.png",
            startSkills: [Skill.MAGIC, Skill.NONE]
        });
        avatarInfos[1] = AvatarInfo({
            name: "Cosmetic Avatar",
            description: "Hi I'm a cosmetic avatar",
            imageURI: "5678.png",
            startSkills: [Skill.ALCHEMY, Skill.FORGING]
        });
        playerNFT.setAvatars(_uints256(1, 9), avatarInfos);

        CosmeticInfo[] memory cosmeticInfos = new CosmeticInfo[](1);
        cosmeticInfos[0] = CosmeticInfo({
            cosmeticPosition: EquipPosition.AVATAR,
            itemTokenId: AVATAR_001_CHIMP,
            avatarId: 9
        });
        cosmetics.setCosmetics(_uint16s(AVATAR_001_CHIMP), cosmeticInfos);

        playerId = _createPlayer(ALICE, 1, ORIG_NAME, true);
    }

    function _createPlayer(address account, uint256 avatarId, string memory heroName, bool makeActive)
        internal
        returns (uint256 createdPlayerId)
    {
        vm.recordLogs();
        vm.prank(account);
        playerNFT.mint(avatarId, heroName, "", "", "", false, makeActive);
        bytes32 newPlayerTopic = keccak256("NewPlayer(uint256,uint256,string,address,string,string,string,bool)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == newPlayerTopic) {
                createdPlayerId = abi.decode(logs[i].data, (uint256));
            }
        }
        require(createdPlayerId != 0, "NewPlayer event not found");
    }

    function _battleSkills() internal pure returns (Skill[] memory skills) {
        skills = new Skill[](17);
        skills[0] = Skill.MELEE;
        skills[1] = Skill.RANGED;
        skills[2] = Skill.MAGIC;
        skills[3] = Skill.DEFENCE;
        skills[4] = Skill.HEALTH;
        skills[5] = Skill.MINING;
        skills[6] = Skill.WOODCUTTING;
        skills[7] = Skill.FISHING;
        skills[8] = Skill.SMITHING;
        skills[9] = Skill.THIEVING;
        skills[10] = Skill.CRAFTING;
        skills[11] = Skill.COOKING;
        skills[12] = Skill.FIREMAKING;
        skills[13] = Skill.ALCHEMY;
        skills[14] = Skill.FLETCHING;
        skills[15] = Skill.FORGING;
        skills[16] = Skill.FARMING;
    }

    function _territories() private pure returns (Territories.TerritoryInput[] memory inputs) {
        inputs = new Territories.TerritoryInput[](25);
        for (uint256 i; i < inputs.length; ++i) {
            uint16 emissions = i < 5 ? 100 : i < 15 ? 30 : 20;
            inputs[i] = Territories.TerritoryInput({territoryId: uint16(i + 1), percentageEmissions: emissions});
        }
    }

    function _raidCombatActionIds() private pure returns (uint16[] memory ids) {
        ids = new uint16[](28);
        for (uint256 i; i < ids.length; ++i) {
            ids[i] = uint16(2000 + i);
        }
    }

    function _addresses12(
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
        address l
    ) private pure returns (address[] memory values) {
        values = new address[](12);
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
    }

    function _bools(bool a, bool b) private pure returns (bool[] memory values) {
        values = new bool[](2);
        values[0] = a;
        values[1] = b;
    }

    function _uints256(uint256 a, uint256 b) private pure returns (uint256[] memory values) {
        values = new uint256[](2);
        values[0] = a;
        values[1] = b;
    }

    function _uint16s(uint16 a) private pure returns (uint16[] memory values) {
        values = new uint16[](1);
        values[0] = a;
    }
}
