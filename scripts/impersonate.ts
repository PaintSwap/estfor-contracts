import {ethers, upgrades} from "hardhat";
import {
  CLANS_ADDRESS,
  EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
  ESTFOR_LIBRARY_ADDRESS,
  INSTANT_VRF_ACTIONS_ADDRESS,
  ITEM_NFT_ADDRESS,
  LOCKED_BANK_VAULTS_ADDRESS,
  ORACLE_ADDRESS,
  PET_NFT_ADDRESS,
  PLAYERS_ADDRESS,
  PLAYER_NFT_ADDRESS,
  PROMOTIONS_ADDRESS,
  QUESTS_ADDRESS,
  SAMWITCH_VRF_ADDRESS,
  SHOP_ADDRESS,
  TERRITORIES_ADDRESS,
  RANDOMNESS_BEACON_ADDRESS,
  BRIDGE_ADDRESS,
  PASSIVE_ACTIONS_ADDRESS,
  BANK_FACTORY_ADDRESS,
  BANK_ADDRESS
} from "./contractAddresses";
import {deployPlayerImplementations} from "./utils";
import {
  Bridge,
  Clans,
  EggInstantVRFActionStrategy,
  EstforLibrary,
  InstantVRFActions,
  ItemNFT,
  LockedBankVaults,
  LockedBankVaultsLibrary,
  PetNFT,
  PetNFTLibrary,
  PlayerNFT,
  Players,
  PlayersLibrary,
  Promotions,
  Quests,
  Shop,
  Territories
} from "../typechain-types";
import {LockedBankVault} from "@paintswap/estfor-definitions/types";
import {makeSigner} from "../test/Players/utils";

import * as helpers from "@nomicfoundation/hardhat-network-helpers";

// When you need to fork a chain and debug
async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`ChainId: ${network.chainId}`);

  const owner = await ethers.getImpersonatedSigner("0x316342122A9ae36de41B231260579b92F4C8Be7f");

  const player = await ethers.getImpersonatedSigner("0xe9684cc079adce40652d3baeb4c2696b92ef61e8");
  const playerId = 35947;

  await helpers.mine();

  const estforLibrary = await ethers.deployContract("EstforLibrary");
  // Players

  const playersLibrary = await ethers.deployContract("PlayersLibrary");
  const Players = (await ethers.getContractFactory("Players")).connect(owner);
  const players = (await upgrades.upgradeProxy(PLAYERS_ADDRESS, Players, {
    kind: "uups",
    unsafeAllow: ["delegatecall"]
  })) as unknown as Players;

  // Set the implementations
  const {playersImplQueueActions, playersImplProcessActions, playersImplRewards, playersImplMisc, playersImplMisc1} =
    await deployPlayerImplementations(await playersLibrary.getAddress());

  const tx = await players.setImpls(
    await playersImplQueueActions.getAddress(),
    await playersImplProcessActions.getAddress(),
    await playersImplRewards.getAddress(),
    await playersImplMisc.getAddress(),
    await playersImplMisc1.getAddress()
  );
  await tx.wait();
  /*
  // PlayerNFT
  const PlayerNFT = (
    await ethers.getContractFactory("PlayerNFT", {
      libraries: {EstforLibrary: await estforLibrary.getAddress()}
    })
  ).connect(owner);
  const playerNFT = (await upgrades.upgradeProxy(PLAYER_NFT_ADDRESS, PlayerNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as PlayerNFT;

  // Quests
  const Quests = await ethers.getContractFactory("Quests");
  const quests = (await upgrades.upgradeProxy(QUESTS_ADDRESS, Quests, {
    kind: "uups"
  })) as unknown as Quests;

  const Shop = await ethers.getContractFactory("Shop");
  const shop = (await upgrades.upgradeProxy(SHOP_ADDRESS, Shop, {
    kind: "uups"
  })) as unknown as Shop;

  const RandomnessBeacon = (await ethers.getContractFactory("RandomnessBeacon")).connect(owner);
  const randomnessBeacon = await upgrades.upgradeProxy(RANDOMNESS_BEACON_ADDRESS, RandomnessBeacon, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  });
*/
  // ItemNFT
  const itemNFTLibrary = await ethers.deployContract("ItemNFTLibrary");

  const ItemNFT = (
    await ethers.getContractFactory("ItemNFT", {
      libraries: {ItemNFTLibrary: await itemNFTLibrary.getAddress()}
    })
  ).connect(owner);
  const itemNFT = (await upgrades.upgradeProxy(ITEM_NFT_ADDRESS, ItemNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as ItemNFT;
  /*
  const promotionsLibrary = await ethers.deployContract("PromotionsLibrary");
  const Promotions = await ethers.getContractFactory("Promotions", {
    libraries: {PromotionsLibrary: await promotionsLibrary.getAddress()}
  });
  const promotions = (await upgrades.upgradeProxy(PROMOTIONS_ADDRESS, Promotions, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as Promotions;

  const Clans = await ethers.getContractFactory("Clans", {
    libraries: {EstforLibrary: await estforLibrary.getAddress()}
  });
  const clans = (await upgrades.upgradeProxy(CLANS_ADDRESS, Clans, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as Clans;

  const lockedBankVaultsLibrary = await ethers.deployContract("LockedBankVaultsLibrary");

  const LockedBankVaults = await ethers.getContractFactory("LockedBankVaults", {
    libraries: {
      EstforLibrary: await estforLibrary.getAddress(),
      LockedBankVaultsLibrary: await lockedBankVaultsLibrary.getAddress()
    }
  });
  const lockedBankVaults = (await upgrades.upgradeProxy(LOCKED_BANK_VAULTS_ADDRESS, LockedBankVaults, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as LockedBankVaults;
  const Territories = (await ethers.getContractFactory("Territories")).connect(owner);
  const territories = (await upgrades.upgradeProxy(TERRITORIES_ADDRESS, Territories, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"]
  })) as unknown as Territories;

  await territories.connect(player).attackTerritory(63, 1, 252);
  const petNFTLibrary = await ethers.deployContract("PetNFTLibrary");
  const PetNFT = (
    await ethers.getContractFactory("PetNFT", {
      libraries: {EstforLibrary: ESTFOR_LIBRARY_ADDRESS, PetNFTLibrary: await petNFTLibrary.getAddress()}
    })
  ).connect(owner);
  const petNFT = (await upgrades.upgradeProxy(PET_NFT_ADDRESS, PetNFT, {
    kind: "uups",
    unsafeAllow: ["external-library-linking"],
    timeout: 10000
  })) as unknown as PetNFT;
  await petNFT.waitForDeployment();

  const EggInstantVRFActionStrategy = await ethers.getContractFactory("EggInstantVRFActionStrategy");
  const eggInstantVRFActionStrategy = (await upgrades.upgradeProxy(
    EGG_INSTANT_VRF_ACTION_STRATEGY_ADDRESS,
    EggInstantVRFActionStrategy,
    {
      kind: "uups",
      timeout: 100000
    }
  )) as unknown as EggInstantVRFActionStrategy;
  await eggInstantVRFActionStrategy.waitForDeployment();

  const InstantVRFActions = await ethers.getContractFactory("InstantVRFActions");
  const instantVRFActions = (await upgrades.upgradeProxy(INSTANT_VRF_ACTIONS_ADDRESS, InstantVRFActions, {
    kind: "uups",
    timeout: 100000
  })) as unknown as InstantVRFActions;

  const Bank = (await ethers.getContractFactory("Bank")).connect(owner);
  const bank = await upgrades.upgradeBeacon(BANK_ADDRESS, Bank);
  console.log("Deployed bank beacon", await bank.getAddress());
  await bank.waitForDeployment();

  const BankFactory = (await ethers.getContractFactory("BankFactory")).connect(owner);
  const bankFactory = await upgrades.upgradeProxy(BANK_FACTORY_ADDRESS, BankFactory, {
    kind: "uups"
  });
  await bankFactory.waitForDeployment();
  console.log(`bankFactory = "${(await bankFactory.getAddress()).toLowerCase()}"`);
*/
  //   await players.connect(player).modifyXP("0x6dC225F7f21ACB842761b8df52AE46208705c942", 158, 12, 1109796, SKIP_XP_THRESHOLD_EFFECTS);
  //  const pendingQueuedActionState = await players.getPendingQueuedActionState(player.address, playerId);
  //  console.log(pendingQueuedActionState);

  await itemNFT.connect(player).safeTransferFrom(player, "0x9D7d06E1f425aD534B68E60403Cd0a1C099862Ae", 13953, 1, "0x");
  /*
  // Debugging bridging
  const lzEndpoint = "0x1a44076050125825900e736c501f859c50fE728c";
  const Bridge = (await ethers.getContractFactory("Bridge")).connect(owner);
  const bridge = (await upgrades.upgradeProxy(BRIDGE_ADDRESS, Bridge, {
    kind: "uups",
    unsafeAllow: ["delegatecall", "constructor", "state-variable-immutable"],
    constructorArgs: [lzEndpoint]
  })) as unknown as Bridge;
  await bridge.waitForDeployment();
  console.log("Bridge upgraded");

  const data =
    "0xdcfdeb60000000000000000000000000e1dd69a2d08df4ea6a30a91cc061ac70f98aabe30000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000075a000000000000000000000000014b69305897a645ed5a4b542e4c45d629d0fe381000000000000000000000000000000000000000000000000000000000000002d0000000000000000000000006d4f6abf56a6f7bee3231fbe932550068cef156b8365674735a196de4bb3acc0478e0bd4a5bddf628118663a07f60f3ce8747d600000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000078000000000000000000000000000000000000000000000000000000000001e8480000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000316342122a9ae36de41b231260579b92f4c8be7f000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000034000000000000000000000000000000000000000000000000000000000000003c0000000000000000000000000000000000000000000000000000000000000044000000000000000000000000000000000000000000000000000000000000004c0000000000000000000000000000000000000000000000000000000000000054000000000000000000000000000000000000000000000000000000000000005c0000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000037580000000000000000000000000000000000000000000000000000000000003759000000000000000000000000000000000000000000000000000000000000375a000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000009000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000170000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000002b00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

  try {
    const tx = await owner.sendTransaction({
      to: "0x83e72DA23b533b2083eD007223a491ba7EC3CcBe",
      data
    });

    const receipt = await tx.wait();
    console.log("Transaction hash:", receipt?.hash);
  } catch (error) {
    console.error(error);
  }
*/
  /*
  //  When trying to fix a VRF issue
  const randomnessBeacon = await ethers.getContractAt("RandomnessBeacon", RANDOMNESS_BEACON_ADDRESS);
  const samwitchVRFSigner = await makeSigner(SAMWITCH_VRF_ADDRESS);
  const tx = await randomnessBeacon
    .connect(samwitchVRFSigner)
    .fulfillRandomWords(
      ethers.toBeHex("101876967951259145252687976040413305757081568456854986909913200232326320008480", 32),
      [1323423423423423431111111111111111111n],
      {gasLimit: 600000}
    );
  await tx.wait();
  */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
