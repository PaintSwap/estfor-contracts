import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {createPlayer} from "../../scripts/utils";

describe("CombatantsHelper", function () {
  it("Assign both territory and locked vault combatants", async function () {
    const {combatantsHelper, clans, clanId, playerNFT, avatarId, owner, origName, playerId, alice} = await loadFixture(
      clanFixture
    );

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [ownerPlayerId], true, [playerId], playerId);
  });

  it("Cannot assign same player to both, fresh", async function () {
    const {combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], true, [playerId], playerId)
    ).to.be.revertedWithCustomError(combatantsHelper, "PlayerOnTerritoryAndLockedVault");
  });

  it("Cannot assign same player to both, after assigning to one side already (first territory)", async function () {
    const {combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId)
    ).to.be.revertedWithCustomError(combatantsHelper, "PlayerAlreadyExistingCombatant");
  });

  it("Cannot assign same player to both, after assigning to one side already (first territory)", async function () {
    const {combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);
    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], playerId);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(combatantsHelper, "PlayerAlreadyExistingCombatant");
  });

  it("Assigning 0 combatants is ok", async function () {
    const {combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);
    await expect(combatantsHelper.connect(alice).assignCombatants(clanId, true, [], true, [], playerId)).to.not.be
      .reverted;
  });

  it("Assigning 0 combatants while the other is set, territory not set, locked vaults set", async function () {
    const {combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);
    await expect(combatantsHelper.connect(alice).assignCombatants(clanId, true, [], true, [playerId], playerId)).not.to
      .be.reverted;
  });

  it("Assigning 0 combatants while the other is set, territory set, locked vaults not set", async function () {
    const {combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);
    await expect(combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], true, [], playerId)).not.to
      .be.reverted;
  });

  it("Assigning 0 combatants after having some set, while the other is still set", async function () {
    const {
      combatantsHelper,
      territories,
      lockedBankVaults,
      clans,
      clanId,
      playerNFT,
      avatarId,
      owner,
      origName,
      playerId,
      alice
    } = await loadFixture(clanFixture);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequest(clanId, ownerPlayerId, playerId);

    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [ownerPlayerId], true, [playerId], playerId);

    await combatantsHelper.clearCooldowns([ownerPlayerId]);
    await territories.clearCooldowns(clanId);
    await lockedBankVaults.clearCooldowns(clanId, []);

    await expect(combatantsHelper.connect(alice).assignCombatants(clanId, true, [ownerPlayerId], true, [], playerId)).to
      .not.be.reverted;
  });
});
