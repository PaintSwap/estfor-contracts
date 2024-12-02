import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {clanFixture} from "./utils";
import {createPlayer} from "../../scripts/utils";
import {upgradePlayer} from "../utils";

describe("CombatantsHelper", function () {
  it("Assign both territory and locked vault combatants", async function () {
    const {
      combatantsHelper,
      clans,
      clanId,
      playerNFT,
      avatarId,
      owner,
      origName,
      playerId,
      brush,
      upgradePlayerBrushPrice,
      alice
    } = await loadFixture(clanFixture);

    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await upgradePlayer(playerNFT, ownerPlayerId, brush, upgradePlayerBrushPrice, owner);

    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequests(clanId, [ownerPlayerId], playerId);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, true, [ownerPlayerId], true, [playerId], false, [], playerId);
  });

  it("Cannot assign same player to both, fresh", async function () {
    const {combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], true, [playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(combatantsHelper, "PlayerCannotBeInAssignedMoreThanOnce");
  });

  it("Cannot assign same player to both, after assigning to one side already (first territory)", async function () {
    const {combatantsHelper, clanId, playerId, playerNFT, brush, upgradePlayerBrushPrice, alice} = await loadFixture(
      clanFixture
    );
    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);
    await combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], false, [], playerId);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], false, [], playerId)
    ).to.be.revertedWithCustomError(combatantsHelper, "PlayerAlreadyExistingCombatant");
  });

  it("Cannot assign same player to both, after assigning to one side already (first locked bank vaults)", async function () {
    const {combatantsHelper, clanId, playerId, playerNFT, brush, upgradePlayerBrushPrice, alice} = await loadFixture(
      clanFixture
    );
    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);
    await combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], false, [], playerId);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], false, [], playerId)
    ).to.be.revertedWithCustomError(combatantsHelper, "PlayerAlreadyExistingCombatant");
  });

  it("Assigning 0 combatants is ok", async function () {
    const {combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);
    await expect(combatantsHelper.connect(alice).assignCombatants(clanId, true, [], true, [], false, [], playerId)).to
      .not.be.reverted;
  });

  it("Assigning 0 combatants while the other is set, territory not set, locked vaults set", async function () {
    const {combatantsHelper, clanId, playerId, playerNFT, brush, upgradePlayerBrushPrice, alice} = await loadFixture(
      clanFixture
    );
    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [], true, [playerId], false, [], playerId)
    ).not.to.be.reverted;
  });

  it("Assigning 0 combatants while the other is set, territory set, locked vaults not set", async function () {
    const {combatantsHelper, clanId, playerId, playerNFT, brush, upgradePlayerBrushPrice, alice} = await loadFixture(
      clanFixture
    );
    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);
    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], true, [], false, [], playerId)
    ).not.to.be.reverted;
  });

  it("Assigning unevolved combatants will revert", async function () {
    const {combatantsHelper, clanId, playerId, alice} = await loadFixture(clanFixture);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [playerId], false, [], false, [], playerId)
    )
      .to.be.revertedWithCustomError(combatantsHelper, "PlayerNotUpgraded")
      .withArgs(playerId);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, false, [], true, [playerId], false, [], playerId)
    )
      .to.be.revertedWithCustomError(combatantsHelper, "PlayerNotUpgraded")
      .withArgs(playerId);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, false, [], false, [], true, [playerId], playerId)
    )
      .to.be.revertedWithCustomError(combatantsHelper, "PlayerNotUpgraded")
      .withArgs(playerId);
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
      brush,
      upgradePlayerBrushPrice,
      alice
    } = await loadFixture(clanFixture);

    await upgradePlayer(playerNFT, playerId, brush, upgradePlayerBrushPrice, alice);

    const ownerPlayerId = await createPlayer(playerNFT, avatarId, owner, origName + 1, true);
    await upgradePlayer(playerNFT, ownerPlayerId, brush, upgradePlayerBrushPrice, owner);

    await clans.requestToJoin(clanId, ownerPlayerId, 0);
    await clans.connect(alice).acceptJoinRequests(clanId, [ownerPlayerId], playerId);

    await combatantsHelper
      .connect(alice)
      .assignCombatants(clanId, true, [ownerPlayerId], true, [playerId], false, [], playerId);

    await combatantsHelper.clearCooldowns([ownerPlayerId]);
    await territories.clearCooldowns(clanId);
    await lockedBankVaults.clearCooldowns(clanId, []);

    await expect(
      combatantsHelper.connect(alice).assignCombatants(clanId, true, [ownerPlayerId], true, [], false, [], playerId)
    ).to.not.be.reverted;
  });
});
