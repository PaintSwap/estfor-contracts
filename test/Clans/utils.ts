import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {playersFixture} from "../Players/PlayersFixture";
import {ethers} from "hardhat";
import {expect} from "chai";
import {Block} from "ethers";

export async function calculateClanBankAddress(
  clanId: number,
  bankFactoryAddress: string,
  bankBeaconAddress: string
): Promise<string> {
  // Combine `clanId` into a `salt`
  const salt = ethers.zeroPadValue(ethers.toBeHex(clanId), 32);

  // Get the `initialize` selector
  const initializeSelector = ethers.id("initialize()").slice(0, 10);

  // Combine `initializeSelector` and encoded `data`
  const initializeCalldata = initializeSelector;

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
  const {clans, playerId, alice, bank, bankFactory, isBeta} = fixture;

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

  const bankAddress = await calculateClanBankAddress(clanId, await bankFactory.getAddress(), await bank.getAddress());

  const timestamp = ((await ethers.provider.getBlock("latest")) as Block).timestamp + 1;
  await expect(clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, imageId, tierId))
    .to.emit(clans, "ClanCreated")
    .withArgs(clanId, playerId, [clanName, discord, telegram, twitter], imageId, tierId, timestamp)
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
