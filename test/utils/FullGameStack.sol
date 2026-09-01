// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {Vm} from "forge-std/Vm.sol";

import {Skill} from "../../contracts/globals/misc.sol";
import {AvatarInfo, CosmeticInfo, EquipPosition} from "../../contracts/globals/players.sol";
import {AdminAccess} from "../../contracts/AdminAccess.sol";
import {ActivityPoints} from "../../contracts/ActivityPoints/ActivityPoints.sol";
import {IActivityPoints, IActivityPointsCaller} from "../../contracts/ActivityPoints/interfaces/IActivityPoints.sol";
import {BlackMarketTrader} from "../../contracts/Events/BlackMarketTrader.sol";
import {GlobalEvents} from "../../contracts/Events/GlobalEvent.sol";
import {IBridge as Bridge} from "../../contracts/interfaces/IBridge.sol";
import {Cosmetics} from "../../contracts/Cosmetics.sol";
import {DailyRewardsScheduler} from "../../contracts/DailyRewardsScheduler.sol";
import {Marketplace} from "../../contracts/Marketplace.sol";
import {RandomnessBeacon} from "../../contracts/RandomnessBeacon.sol";
import {IPassiveActions as PassiveActions} from "../../contracts/interfaces/IPassiveActions.sol";
import {IPetNFT as PetNFT} from "../../contracts/interfaces/IPetNFT.sol";
import {IPetNFTReroll as PetNFTReroll} from "../../contracts/interfaces/IPetNFTReroll.sol";
import {IPlayerNFT as PlayerNFT} from "../../contracts/interfaces/IPlayerNFT.sol";
import {IPromotions as Promotions} from "../../contracts/interfaces/IPromotions.sol";
import {IPVPBattleground as PVPBattleground} from "../../contracts/interfaces/IPVPBattleground.sol";
import {IQuests as Quests} from "../../contracts/interfaces/IQuests.sol";
import {RoyaltyReceiver} from "../../contracts/RoyaltyReceiver.sol";
import {Shop} from "../../contracts/Shop.sol";
import {Treasury} from "../../contracts/Treasury.sol";
import {IWishingWell as WishingWell} from "../../contracts/interfaces/IWishingWell.sol";
import {WorldActions} from "../../contracts/WorldActions.sol";
import {Bank} from "../../contracts/Clans/Bank.sol";
import {BankFactory} from "../../contracts/Clans/BankFactory.sol";
import {BankRegistry} from "../../contracts/Clans/BankRegistry.sol";
import {IBankRelay as BankRelay} from "../../contracts/interfaces/IBankRelay.sol";
import {IClans as Clans} from "../../contracts/interfaces/IClans.sol";
import {ICombatantsHelper as CombatantsHelper} from "../../contracts/interfaces/ICombatantsHelper.sol";
import {ILockedBankVaults as LockedBankVaults} from "../../contracts/interfaces/ILockedBankVaults.sol";
import {IRaids as Raids} from "../../contracts/interfaces/IRaids.sol";
import {ITerritories as Territories} from "../../contracts/interfaces/ITerritories.sol";
import {ICombatants} from "../../contracts/interfaces/ICombatants.sol";
import {IUUPSUpgradeable} from "../../contracts/interfaces/IUUPSUpgradeable.sol";
import {IItemNFT} from "../../contracts/interfaces/IItemNFT.sol";
import {IWorldActions} from "../../contracts/interfaces/IWorldActions.sol";
import {IInstantActions as InstantActions} from "../../contracts/interfaces/IInstantActions.sol";
import {IInstantVRFActions as InstantVRFActions} from "../../contracts/interfaces/IInstantVRFActions.sol";
import {EggInstantVRFActionStrategy} from "../../contracts/InstantVRFActionStrategies/EggInstantVRFActionStrategy.sol";
import {
    GenericInstantVRFActionStrategy
} from "../../contracts/InstantVRFActionStrategies/GenericInstantVRFActionStrategy.sol";
import {ItemNFT} from "../../contracts/ItemNFT.sol";
import {IPlayers as Players} from "../../contracts/interfaces/IPlayers.sol";
import {IPlayersImplMisc as PlayersImplMisc} from "../../contracts/interfaces/IPlayersImplMisc.sol";
import {IPlayersImplMisc1 as PlayersImplMisc1} from "../../contracts/interfaces/IPlayersImplMisc1.sol";
import {
    IPlayersImplProcessActions as PlayersImplProcessActions
} from "../../contracts/interfaces/IPlayersImplProcessActions.sol";
import {IPlayersImplQueueActions as PlayersImplQueueActions} from "../../contracts/interfaces/IPlayersImplQueueActions.sol";
import {IPlayersImplRewards as PlayersImplRewards} from "../../contracts/interfaces/IPlayersImplRewards.sol";
import {IBankFactory} from "../../contracts/interfaces/IBankFactory.sol";
import {IBrushToken} from "../../contracts/interfaces/external/IBrushToken.sol";
import {IClanMemberLeftCB} from "../../contracts/interfaces/IClanMemberLeftCB.sol";
import {IOracleCB} from "../../contracts/interfaces/IOracleCB.sol";
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
    MockRouter private _router;

    function deployFullGame() internal {
        _deployCoreInfrastructure();
        _deployNFTsAndSocialSystems();
        _deployPetSystems();
        _deployPlayers();
        _deployPromotionAndActionSystems();
        _deployPVPAndRaids();
        _deployCombatAndClanSystems();
        _deployBanksAndAuxiliarySystems();
        _wireCoreSystems();
        _wireItemAndClanSystems();
        _wireMarketplaceSystems();
        _configureActivityPointCallers();
        _configureAvatars();
    }

    function _deployCoreInfrastructure() internal {
        _deployBeaconStack();
        brush = new MockBrushToken();
        lzEndpoint = address(new EndpointV2Mock(LZ_FANTOM_EID, address(this)));
        Bridge bridgeImplementation =
            Bridge(_deployArtifact("contracts/Bridge/Bridge.sol:Bridge", abi.encode(lzEndpoint)));
        bridge = Bridge(
            payable(_deployUUPS(address(bridgeImplementation), abi.encodeCall(Bridge.initialize, (LZ_FANTOM_EID))))
        );

        worldActions =
            WorldActions(_deployUUPS(address(new WorldActions()), abi.encodeCall(WorldActions.initialize, ())));

        marketplace = Marketplace(
            _deployUUPS(
                address(new Marketplace()),
                abi.encodeCall(Marketplace.initialize, (IBrushToken(address(brush)), address(this)))
            )
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

        _router = new MockRouter();
        RoyaltyReceiver royaltyReceiverImplementation = new RoyaltyReceiver();
        royaltyReceiver = RoyaltyReceiver(
            payable(_deployUUPS(
                    address(royaltyReceiverImplementation),
                    abi.encodeCall(
                        RoyaltyReceiver.initialize,
                        (ISolidlyRouter(address(_router)), address(treasury), DEV, IBrushToken(address(brush)), ALICE)
                    )
                ))
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
                abi.encodeCall(ActivityPoints.initialize, (address(itemNFT), ACTIVITY_TICKET, SONIC_GEM_TICKET))
            )
        );
        itemNFT.setApproved(_addresses(address(activityPoints)), true);

        Shop shopImplementation = new Shop();
        shop = Shop(
            _deployUUPS(
                address(shopImplementation),
                abi.encodeCall(
                    Shop.initialize,
                    (
                        IBrushToken(address(brush)),
                        treasury,
                        DEV,
                        MIN_ITEM_QUANTITY_BEFORE_SELLS_ALLOWED,
                        SELLING_CUTOFF_DURATION
                    )
                )
            )
        );
        shop.setItemNFT(itemNFT);
    }

    function _deployNFTsAndSocialSystems() internal {
        PlayerNFT playerNFTImplementation = PlayerNFT(_deployArtifact("contracts/PlayerNFT.sol:PlayerNFT:via-ir"));
        playerNFT = PlayerNFT(
            _deployUUPS(
                address(playerNFTImplementation),
                bytes.concat(
                    PlayerNFT.initialize.selector,
                    abi.encode(address(brush), address(treasury), DEV, address(royaltyReceiver), uint72(1 ether)),
                    abi.encode(uint72(1 ether), uint256(10 * 32), uint64(1), true, address(bridge)),
                    _dynamicTail(abi.encode("ipfs://"))
                )
            )
        );

        address[2] memory buyPath = [ALICE, address(brush)];
        Quests questsImplementation = Quests(_deployArtifact("contracts/Quests.sol:Quests:via-ir"));
        quests = Quests(
            payable(_deployUUPS(
                    address(questsImplementation),
                    abi.encodeCall(
                        Quests.initialize,
                        (
                            address(randomnessBeacon),
                            address(bridge),
                            ISolidlyRouter(address(_router)),
                            buyPath,
                            IActivityPoints(address(activityPoints))
                        )
                    )
                ))
        );

        paintSwapMarketplaceWhitelist = new MockPaintSwapMarketplaceWhitelist();
        Clans clansImplementation = Clans(_deployArtifact("contracts/Clans/Clans.sol:Clans:via-ir"));
        clans = Clans(
            _deployUUPS(
                address(clansImplementation),
                bytes.concat(
                    Clans.initialize.selector,
                    abi.encode(address(brush), address(playerNFT), address(treasury), DEV, uint80(1 ether)),
                    abi.encode(
                        address(paintSwapMarketplaceWhitelist),
                        INITIAL_MMR,
                        START_CLAN_ID,
                        address(bridge),
                        address(activityPoints)
                    )
                )
            )
        );

        WishingWell wishingWellImplementation =
            WishingWell(_deployArtifact("contracts/WishingWell.sol:WishingWell"));
        wishingWell = WishingWell(
            _deployUUPS(
                address(wishingWellImplementation),
                bytes.concat(
                    WishingWell.initialize.selector,
                    abi.encode(
                        address(brush), address(playerNFT), address(treasury), address(randomnessBeacon), address(clans)
                    ),
                    abi.encode(5 ether, 1000 ether, 250 ether, address(activityPoints))
                )
            )
        );
    }

    function _deployPetSystems() internal {
        PetNFT petNFTImplementation = PetNFT(_deployArtifact("contracts/PetNFT.sol:PetNFT"));
        petNFT = PetNFT(
            _deployUUPS(
                address(petNFTImplementation),
                bytes.concat(
                    PetNFT.initialize.selector,
                    abi.encode(address(brush), address(royaltyReceiver), uint256(11 * 32), DEV, uint72(1 ether)),
                    abi.encode(
                        address(treasury), address(randomnessBeacon), uint40(1), address(bridge), address(adminAccess)
                    ),
                    abi.encode(true),
                    _dynamicTail(abi.encode("ipfs://"))
                )
            )
        );

        PetNFTReroll petNFTRerollImplementation =
            PetNFTReroll(_deployArtifact("contracts/PetNFTReroll.sol:PetNFTReroll"));
        petNFTReroll = PetNFTReroll(
            _deployUUPS(
                address(petNFTRerollImplementation),
                abi.encodeCall(
                    PetNFTReroll.initialize,
                    (address(this), ItemNFT(address(itemNFT)), PetNFT(address(petNFT)), address(mockVRF))
                )
            )
        );
    }

    function _deployPlayers() internal {
        PlayersImplQueueActions queueActionsImplementation = PlayersImplQueueActions(
            _deployArtifact("contracts/Players/PlayersImplQueueActions.sol:PlayersImplQueueActions")
        );
        playersImplQueueActions = address(queueActionsImplementation);
        PlayersImplProcessActions processActionsImplementation = PlayersImplProcessActions(
            _deployArtifact("contracts/Players/PlayersImplProcessActions.sol:PlayersImplProcessActions")
        );
        playersImplProcessActions = address(processActionsImplementation);
        PlayersImplRewards rewardsImplementation =
            PlayersImplRewards(_deployArtifact("contracts/Players/PlayersImplRewards.sol:PlayersImplRewards"));
        playersImplRewards = address(rewardsImplementation);
        PlayersImplMisc miscImplementation =
            PlayersImplMisc(_deployArtifact("contracts/Players/PlayersImplMisc.sol:PlayersImplMisc"));
        playersImplMisc = address(miscImplementation);
        PlayersImplMisc1 misc1Implementation =
            PlayersImplMisc1(_deployArtifact("contracts/Players/PlayersImplMisc1.sol:PlayersImplMisc1"));
        playersImplMisc1 = address(misc1Implementation);

        Players playersImplementation = Players(_deployArtifact("contracts/Players/Players.sol:Players"));
        players = Players(_deployUUPS(address(playersImplementation), _playersInitializer()));
    }

    function _playersInitializer() internal view returns (bytes memory) {
        return bytes.concat(
            Players.initialize.selector,
            abi.encode(
                address(itemNFT), address(playerNFT), address(petNFT), address(worldActions), address(randomnessBeacon)
            ),
            abi.encode(
                address(dailyRewardsScheduler),
                address(adminAccess),
                address(quests),
                address(clans),
                address(wishingWell)
            ),
            abi.encode(
                playersImplQueueActions,
                playersImplProcessActions,
                playersImplRewards,
                playersImplMisc,
                playersImplMisc1
            ),
            abi.encode(address(bridge), address(activityPoints), true)
        );
    }

    function _deployPromotionAndActionSystems() internal {
        Promotions promotionsImplementation = Promotions(_deployArtifact("contracts/Promotions.sol:Promotions"));
        promotions = Promotions(
            _deployUUPS(
                address(promotionsImplementation),
                bytes.concat(
                    Promotions.initialize.selector,
                    abi.encode(
                        address(players),
                        address(randomnessBeacon),
                        address(dailyRewardsScheduler),
                        address(itemNFT),
                        address(playerNFT),
                        address(quests)
                    ),
                    abi.encode(address(brush), address(treasury), DEV, address(adminAccess), true)
                )
            )
        );

        InstantActions instantActionsImplementation =
            InstantActions(_deployArtifact("contracts/InstantActions.sol:InstantActions"));
        instantActions = InstantActions(
            _deployUUPS(
                address(instantActionsImplementation),
                abi.encodeCall(
                    InstantActions.initialize,
                    (
                        Players(address(players)),
                        ItemNFT(address(itemNFT)),
                        Quests(address(quests)),
                        IActivityPoints(address(activityPoints))
                    )
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

        InstantVRFActions instantVRFActionsImplementation =
            InstantVRFActions(_deployArtifact("contracts/InstantVRFActions.sol:InstantVRFActions"));
        instantVRFActions = InstantVRFActions(
            _deployUUPS(
                address(instantVRFActionsImplementation),
                bytes.concat(
                    InstantVRFActions.initialize.selector,
                    abi.encode(
                        address(players),
                        address(itemNFT),
                        address(petNFT),
                        address(quests),
                        address(mockVRF),
                        MAX_INSTANT_VRF_ACTION_AMOUNT
                    ),
                    abi.encode(address(activityPoints))
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
    }

    function _deployPVPAndRaids() internal {
        BankRelay bankRelayImplementation = BankRelay(_deployArtifact("contracts/Clans/BankRelay.sol:BankRelay"));
        bankRelay = BankRelay(
            _deployUUPS(address(bankRelayImplementation), abi.encodeCall(BankRelay.initialize, (address(clans))))
        );

        PVPBattleground pvpBattlegroundImplementation =
            PVPBattleground(_deployArtifact("contracts/PVPBattleground.sol:PVPBattleground"));
        pvpBattleground = PVPBattleground(
            _deployUUPS(
                address(pvpBattlegroundImplementation),
                bytes.concat(
                    PVPBattleground.initialize.selector,
                    abi.encode(
                        address(players),
                        address(playerNFT),
                        address(brush),
                        address(itemNFT),
                        address(mockVRF),
                        uint256(9 * 32)
                    ),
                    abi.encode(3600, address(adminAccess), true),
                    _dynamicTail(abi.encode(_battleSkills()))
                )
            )
        );

        _deploySessionStack();

        Raids raidsImplementation = Raids(_deployArtifact("contracts/Clans/Raids.sol:Raids"));
        raids = Raids(
            payable(_deployUUPS(
                    address(raidsImplementation),
                    bytes.concat(
                        Raids.initialize.selector,
                        abi.encode(
                            address(players),
                            address(itemNFT),
                            address(clans),
                            address(mockVRF),
                            8 hours,
                            address(brush)
                        ),
                        abi.encode(address(worldActions), address(randomnessBeacon), 20, uint256(11 * 32), true),
                        _dynamicTail(abi.encode(_raidCombatActionIds()))
                    )
                ))
        );
        vm.deal(address(raids), 10 ether);
    }

    function _deployCombatAndClanSystems() internal {
        LockedBankVaults lockedBankVaultsImplementation =
            LockedBankVaults(_deployArtifact("contracts/Clans/LockedBankVaults.sol:LockedBankVaults"));
        lockedBankVaults = LockedBankVaults(
            _deployUUPS(
                address(lockedBankVaultsImplementation),
                bytes.concat(
                    LockedBankVaults.initialize.selector,
                    abi.encode(
                        address(players),
                        address(clans),
                        address(brush),
                        address(bankRelay),
                        address(itemNFT),
                        address(treasury)
                    ),
                    abi.encode(DEV, address(mockVRF), uint256(16 * 32), 4, uint24(7 days), 20),
                    abi.encode(100, address(adminAccess), address(activityPoints), true),
                    _dynamicTail(abi.encode(_battleSkills()))
                )
            )
        );
        lockedBankVaults.setKValues(3, 3);

        Territories territoriesImplementation =
            Territories(_deployArtifact("contracts/Clans/Territories.sol:Territories"));
        territories = Territories(_deployUUPS(address(territoriesImplementation), _territoriesInitializer()));

        CombatantsHelper combatantsHelperImplementation =
            CombatantsHelper(_deployArtifact("contracts/Clans/CombatantsHelper.sol:CombatantsHelper:via-ir"));
        combatantsHelper = CombatantsHelper(
            _deployUUPS(
                address(combatantsHelperImplementation),
                bytes.concat(
                    CombatantsHelper.initialize.selector,
                    abi.encode(
                        address(players),
                        address(clans),
                        address(territories),
                        address(lockedBankVaults),
                        address(raids),
                        address(adminAccess)
                    ),
                    abi.encode(true)
                )
            )
        );

        IUUPSUpgradeable(address(clans)).upgradeToAndCall(
            address(Clans(_deployArtifact("contracts/Clans/Clans.sol:Clans:via-ir"))),
            abi.encodeCall(Clans.initializeV2, (CombatantsHelper(address(combatantsHelper))))
        );

        PassiveActions passiveActionsImplementation =
            PassiveActions(_deployArtifact("contracts/PassiveActions.sol:PassiveActions:via-ir"));
        passiveActions = PassiveActions(
            _deployUUPS(
                address(passiveActionsImplementation),
                abi.encodeCall(
                    PassiveActions.initialize,
                    (
                        Players(address(players)),
                        ItemNFT(address(itemNFT)),
                        RandomnessBeacon(payable(address(randomnessBeacon))),
                        address(bridge),
                        IActivityPoints(address(activityPoints))
                    )
                )
            )
        );
    }

    function _deployBanksAndAuxiliarySystems() internal {
        bank = address(new UpgradeableBeacon(address(new Bank()), address(this)));

        BankRegistry bankRegistryImplementation = new BankRegistry();
        bankRegistry =
            BankRegistry(_deployUUPS(address(bankRegistryImplementation), abi.encodeCall(BankRegistry.initialize, ())));
        bankRegistry.setForceItemDepositors(_addresses(address(raids), address(activityPoints)), _bools(true, true));

        BankFactory bankFactoryImplementation = new BankFactory();
        bankFactory = BankFactory(
            _deployUUPS(
                address(bankFactoryImplementation),
                bytes.concat(
                    BankFactory.initialize.selector,
                    abi.encode(
                        bank,
                        address(bankRegistry),
                        address(bankRelay),
                        address(playerNFT),
                        address(itemNFT),
                        address(clans)
                    ),
                    abi.encode(address(players), address(lockedBankVaults), address(raids))
                )
            )
        );

        cosmetics = Cosmetics(
            _deployUUPS(
                address(new Cosmetics()),
                abi.encodeCall(
                    Cosmetics.initialize, (address(this), IItemNFT(address(itemNFT)), PlayerNFT(address(playerNFT)))
                )
            )
        );

        GlobalEvents globalEventsImplementation = new GlobalEvents();
        globalEvents = GlobalEvents(
            _deployUUPS(
                address(globalEventsImplementation),
                abi.encodeCall(
                    GlobalEvents.initialize, (address(this), Players(address(players)), IItemNFT(address(itemNFT)))
                )
            )
        );
    }

    function _wireCoreSystems() internal {
        randomnessBeacon.initializeAddresses(IOracleCB(address(wishingWell)), IOracleCB(address(dailyRewardsScheduler)));
        randomnessBeacon.initializeRandomWords();

        playerNFT.setPlayers(Players(address(players)));
        quests.setPlayers(Players(address(players)));
        wishingWell.setPlayers(Players(address(players)));

        petNFT.initializeAddresses(address(instantVRFActions), address(players), address(territories));

        clans.initializeAddresses(
            Players(address(players)),
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
    }

    function _wireItemAndClanSystems() internal {
        itemNFT.initializeAddresses(IBankFactory(address(bankFactory)), Players(address(players)));
        itemNFT.setApproved(_gameItemApprovals(), true);
        itemNFT.setApprovedBurners(_addresses(address(petNFTReroll)), true);
        petNFT.setApprovedMinters(_addresses(address(petNFTReroll)), true);
        petNFT.setApprovedBurners(_addresses(address(petNFTReroll)), true);

        territories.setCombatantsHelper(address(combatantsHelper));
        raids.initializeAddresses(address(combatantsHelper), IBankFactory(address(bankFactory)));
        lockedBankVaults.initializeAddresses(
            Territories(address(territories)), address(combatantsHelper), IBankFactory(address(bankFactory))
        );
        clans.setXPModifiers(_addresses(address(lockedBankVaults), address(territories), address(wishingWell)), true);
        players.setAlphaCombatParams(1, 1, 0);
    }

    function _wireMarketplaceSystems() internal {
        playerNFT.setMarketplaceAddress(address(marketplace));
        petNFT.setMarketplaceAddress(address(marketplace));
        playerNFT.setApprovalForAll(address(marketplace), true);
        petNFT.setApprovalForAll(address(marketplace), true);
        playerNFT.setCosmeticsAddress(address(cosmetics));
    }

    function _configureActivityPointCallers() internal {
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
    }

    function _configureAvatars() internal {
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
        cosmeticInfos[0] =
            CosmeticInfo({cosmeticPosition: EquipPosition.AVATAR, itemTokenId: AVATAR_001_CHIMP, avatarId: 9});
        cosmetics.setCosmetics(_uint16s(AVATAR_001_CHIMP), cosmeticInfos);

        playerId = _createPlayer(ALICE, 1, ORIG_NAME, true);
    }

    function _createPlayer(address account, uint256 avatarId, string memory heroName, bool makeActive)
        internal
        returns (uint256 createdPlayerId)
    {
        return _createPlayer(account, avatarId, heroName, makeActive, false);
    }

    function _createPlayer(address account, uint256 avatarId, string memory heroName, bool makeActive, bool upgrade)
        internal
        returns (uint256 createdPlayerId)
    {
        vm.recordLogs();
        vm.prank(account);
        (bool success, bytes memory returndata) =
            address(playerNFT).call(_playerMintCalldata(avatarId, heroName, upgrade, makeActive));
        if (!success) {
            assembly ("memory-safe") {
                revert(add(returndata, 0x20), mload(returndata))
            }
        }
        bytes32 newPlayerTopic = keccak256("NewPlayer(uint256,uint256,string,address,string,string,string,bool)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics[0] == newPlayerTopic) {
                createdPlayerId = abi.decode(logs[i].data, (uint256));
            }
        }
        require(createdPlayerId != 0, "NewPlayer event not found");
    }

    function _playerMintCalldata(uint256 avatarId, string memory heroName, bool upgrade, bool makeActive)
        private
        pure
        returns (bytes memory)
    {
        bytes memory heroNameTail = _dynamicTail(abi.encode(heroName));
        bytes memory emptyStringTail = abi.encode(uint256(0));
        uint256 firstTailOffset = 7 * 32;
        return bytes.concat(
            PlayerNFT.mint.selector,
            abi.encode(
                avatarId,
                firstTailOffset,
                firstTailOffset + heroNameTail.length,
                firstTailOffset + heroNameTail.length + emptyStringTail.length,
                firstTailOffset + heroNameTail.length + emptyStringTail.length * 2
            ),
            abi.encode(upgrade, makeActive),
            heroNameTail,
            emptyStringTail,
            emptyStringTail,
            emptyStringTail
        );
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

    function _territoriesInitializer() private view returns (bytes memory) {
        bytes memory territoriesTail = _dynamicTail(abi.encode(_territories()));
        bytes memory skillsTail = _dynamicTail(abi.encode(_battleSkills()));
        return bytes.concat(
            Territories.initialize.selector,
            abi.encode(
                uint256(13 * 32),
                address(players),
                address(clans),
                address(brush),
                address(lockedBankVaults),
                address(itemNFT)
            ),
            abi.encode(
                address(mockVRF),
                uint256(13 * 32 + territoriesTail.length),
                20,
                24 hours,
                address(adminAccess),
                address(activityPoints)
            ),
            abi.encode(true),
            territoriesTail,
            skillsTail
        );
    }

    function _dynamicTail(bytes memory encoded) private pure returns (bytes memory tail) {
        tail = new bytes(encoded.length - 32);
        for (uint256 i; i < tail.length; ++i) {
            tail[i] = encoded[i + 32];
        }
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

    function _gameItemApprovals() private view returns (address[] memory values) {
        values = new address[](12);
        values[0] = address(players);
        values[1] = address(shop);
        values[2] = address(promotions);
        values[3] = address(instantActions);
        values[4] = address(territories);
        values[5] = address(lockedBankVaults);
        values[6] = address(instantVRFActions);
        values[7] = address(passiveActions);
        values[8] = address(raids);
        values[9] = address(cosmetics);
        values[10] = address(globalEvents);
        values[11] = address(blackMarketTrader);
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
}
