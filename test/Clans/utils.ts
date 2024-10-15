import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {playersFixture} from "../Players/PlayersFixture";
import {ethers} from "hardhat";
import {expect} from "chai";

export async function clanFixture() {
  const fixture = await loadFixture(playersFixture);
  const {clans, playerId, alice, bankFactory} = fixture;

  // Add basic tier
  await clans.addTiers([
    {
      id: 1,
      maxMemberCapacity: 3,
      maxBankCapacity: 3,
      maxImageId: 16,
      price: 0,
      minimumAge: 0,
    },
  ]);

  const clanName = "Clan 1";

  const clanId = 1;
  const discord = "G4ZgtP52JK";
  const telegram = "fantomfoundation";
  const twitter = "fantomfdn";
  const imageId = 2;
  const tierId = 1;

  const tier = await clans.tiers(tierId);

  // Figure out what the address would be
  const bankAddress = ethers.getCreateAddress({from: await bankFactory.getAddress(), nonce: clanId});

  await expect(clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, imageId, tierId))
    .to.emit(clans, "ClanCreated")
    .withArgs(clanId, playerId, [clanName, discord, telegram, twitter], imageId, tierId)
    .and.to.emit(bankFactory, "BankContractCreated")
    .withArgs(alice.address, clanId, bankAddress);

  const LockedBankVaultsLibrary = await ethers.getContractFactory("LockedBankVaultsLibrary");
  // All these must match the constants inside LockedBankVaults.sol
  const MAX_LOCKED_VAULTS = 100;
  // This must match the constructor of LockedBankVaults.sol
  const isBeta = true;
  const attackingCooldown = isBeta ? 1.5 * 60 : 4 * 3600;
  const reattackingCooldown = isBeta ? 3 * 60 : 24 * 3600;
  const combatantChangeCooldown = isBeta ? 5 * 60 : 3 * 86400;
  const editNameCost = await clans.editNameCost();
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
    MAX_LOCKED_VAULTS,
    attackingCooldown,
    reattackingCooldown,
    combatantChangeCooldown,
  };
}

export enum BattleResult {
  DRAW,
  WIN,
  LOSE,
}
