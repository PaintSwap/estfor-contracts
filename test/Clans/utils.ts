import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {playersFixture} from "../Players/PlayersFixture";
import {ethers} from "hardhat";
import {expect} from "chai";

export async function calculateClanBankAddress(
  clanId: number,
  bankFactoryAddress: string,
  clansAddress: string,
  bankBeaconAddress: string,
  bankRegistryAddress: string,
  bankRelayAddress: string,
  playerNFTAddress: string,
  itemNFTAddress: string,
  playersAddress: string,
  lockedBankVaultsAddress: string,
  raidsAddress: string
): Promise<string> {
  // Combine `clanId` into a `salt`
  const salt = ethers.zeroPadValue(ethers.toBeHex(clanId), 32);

  // Get the `initialize` selector
  const initializeSelector = ethers
    .id("initialize(uint256,address,address,address,address,address,address,address,address)")
    .slice(0, 10);

  // Encode the data for `initialize` function parameters
  const data = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address", "address", "address", "address", "address", "address", "address", "address"],
    [
      clanId,
      bankRegistryAddress,
      bankRelayAddress,
      playerNFTAddress,
      itemNFTAddress,
      clansAddress,
      playersAddress,
      lockedBankVaultsAddress,
      raidsAddress
    ]
  );

  // Combine `initializeSelector` and encoded `data`
  const initializeCalldata = initializeSelector.concat(data.slice(2));

  // Encode the constructor arguments for the `BeaconProxy` (beacon address + initialize calldata)
  const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes"],
    [bankBeaconAddress, initializeCalldata] // `bank` here is the beacon address
  );

  // Get the bytecode of the `BeaconProxy` contract
  const BeaconProxy = await ethers.getContractFactory("BeaconProxy");
  const beaconProxyBytecode = BeaconProxy.bytecode;

  // Calculate the initialization code hash
  const initCodeHash = ethers.keccak256(beaconProxyBytecode + encodedArgs.slice(2));

  // Calculate the proxy address
  return ethers.getCreate2Address(bankFactoryAddress, salt, initCodeHash);
}

export async function clanFixture() {
  const fixture = await loadFixture(playersFixture);
  const {
    clans,
    playerId,
    alice,
    bank,
    bankRegistry,
    bankFactory,
    bankRelay,
    playerNFT,
    itemNFT,
    players,
    lockedBankVaults,
    raids,
    isBeta
  } = fixture;

  // Add basic tier
  await clans.addTiers([
    {
      id: 1,
      maxMemberCapacity: 3,
      maxBankCapacity: 3,
      maxImageId: 16,
      price: 0,
      minimumAge: 0
    }
  ]);

  const clanName = "Clan 1";

  const clanId = 1;
  const discord = "G4ZgtP52JK";
  const telegram = "fantomfoundation";
  const twitter = "fantomfdn";
  const imageId = 2;
  const tierId = 1;

  const tier = await clans.getTier(tierId);

  const bankAddress = await calculateClanBankAddress(
    clanId,
    await bankFactory.getAddress(),
    await clans.getAddress(),
    await bank.getAddress(),
    await bankRegistry.getAddress(),
    await bankRelay.getAddress(),
    await playerNFT.getAddress(),
    await itemNFT.getAddress(),
    await players.getAddress(),
    await lockedBankVaults.getAddress(),
    await raids.getAddress()
  );

  await expect(clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, imageId, tierId))
    .to.emit(clans, "ClanCreated")
    .withArgs(clanId, playerId, [clanName, discord, telegram, twitter], imageId, tierId)
    .and.to.emit(bankFactory, "BankContractCreated")
    .withArgs(alice.address, clanId, bankAddress);

  const LockedBankVaultsLibrary = await ethers.getContractFactory("LockedBankVaultsLibrary");
  // All these must match the constants inside LockedBankVaults.sol
  // This must match the constructor of LockedBankVaults.sol
  const attackingCooldown = isBeta ? 1.5 * 60 : 4 * 3600;
  const reattackingCooldown = isBeta ? 3 * 60 : 24 * 3600;
  const combatantChangeCooldown = isBeta ? 5 * 60 : 3 * 86400;
  const editNameCost = await clans.getEditNameCost();
  return {
    ...fixture,
    clans,
    clanName,
    discord,
    telegram,
    twitter,
    tierId,
    imageId,
    clanId,
    tier,
    editNameCost,
    bankAddress,
    LockedBankVaultsLibrary,
    attackingCooldown,
    reattackingCooldown,
    combatantChangeCooldown
  };
}
