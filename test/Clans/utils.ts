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

  const tierId = 1;
  const imageId = 2;
  const clanId = 1;
  const tier = await clans.tiers(tierId);
  const discord = "G4ZgtP52JK";
  const telegram = "fantomfoundation";
  const twitter = "fantomfdn";

  // Figure out what the address would be
  const bankAddress = ethers.utils.getContractAddress({
    from: bankFactory.address,
    nonce: clanId,
  });

  await expect(clans.connect(alice).createClan(playerId, clanName, discord, telegram, twitter, imageId, tierId))
    .to.emit(clans, "ClanCreated")
    .withArgs(clanId, playerId, [clanName, discord, telegram, twitter], imageId, tierId)
    .and.to.emit(bankFactory, "BankContractCreated")
    .withArgs(alice.address, clanId, bankAddress);

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
  };
}

export enum BattleResult {
  DRAW,
  WIN,
  LOSE,
}
