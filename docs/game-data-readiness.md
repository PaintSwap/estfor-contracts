# Game data reconciliation readiness

Date: 2026-09-03

This document inventories canonical game data that must eventually be checked by `pnpm deployment:sync`. It separates
contract read capability from command support. A contract can be read-ready while its deployment domain remains
unmanaged because no adapter compares, mutates, simulates, and verifies that data yet.

## Status vocabulary

- **Managed**: `deployment:sync` reads, diffs, plans, simulates, and verifies this domain.
- **Read-ready**: all persisted canonical fields and current keys can be read without chain-history reconstruction.
- **Known-key read**: desired records can be read by ID, but unknown stale keys cannot be discovered completely.
- **Missing getter**: at least one persisted canonical field has no direct getter.
- **Mutation-blocked**: reads are sufficient, but exact reconciliation cannot remove or replace stale configuration.
- **Runtime-excluded**: mutable player, market, supply, randomness, or progress state must not be compared with seed data.

The command policy remains `unmanaged` for every row except Shop. Read-ready means that the next adapter can use direct
contract reads; it does not mean that `deployment:sync` currently reports drift for that row.

## Read API boundary

The reconciliation ABI is in [`contracts/interfaces/IGameData.sol`](../contracts/interfaces/IGameData.sol). The
implementations do not inherit these narrow interfaces. This keeps archived implementations and unrelated mocks from
acquiring new interface requirements.

Tests and future scripts must import the neutral interfaces, not stack-heavy implementations. This preserves the
selective `via-ir` boundary described in [`via-ir-stack-too-deep-discovery.md`](./via-ir-stack-too-deep-discovery.md).
Sparse reads use exclusive `[start, end)` ranges of at most 1,024 keys. They scan existing storage and do not add
enumeration storage that would require migration for old proxy records.

## Fresh-deployment game data

These data sets are loaded by [`scripts/prepareForgeDeployData.ts`](../scripts/prepareForgeDeployData.ts).

| Data set                               | Contract                                                                              | Desired source                                        | Read status                              | Direct read                                                                        | Remaining reconciliation work                                                                                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Items                                  | `ItemNFT`                                                                             | `scripts/data/items.ts`                               | **Read-ready**                           | `getItemTokenIds`, existing `getItem`, and `getTokenURI`                           | Add an exact adapter. Compare only persisted fields and preserve supply and first-mint state.                                                                                                                                                                                    |
| Quests and minimum requirements        | `Quests`                                                                              | `scripts/data/quests.ts`                              | **Read-ready**                           | `getQuestIds`, existing `getQuest`, and `getMinimumRequirements`                   | Add an exact adapter. A removed quest's old minimum-requirement slots are intentionally hidden because the quest is inactive.                                                                                                                                                    |
| World actions                          | `WorldActions`                                                                        | `scripts/data/actions.ts`                             | **Read-ready**, **mutation-blocked**     | `getActionIds` and existing action/reward getters                                  | Add an adapter. Exact policy needs action removal; additive policy can proceed without it.                                                                                                                                                                                       |
| World action choices                   | `WorldActions`                                                                        | `scripts/data/actionChoiceIds.ts`, `actionChoices.ts` | **Read-ready**                           | `getActionChoiceIds` and existing `getActionChoice`                                | Add an exact adapter; choice removal already exists. Include action ID `0`, which owns shared combat choices.                                                                                                                                                                    |
| Shop prices and unsellable flags       | `Shop`                                                                                | `scripts/data/shop.ts`                                | **Managed**                              | `getShopItemStates` scans the complete `uint16` keyspace                           | No read gap. Runtime token allocation fields remain excluded.                                                                                                                                                                                                                    |
| Cosmetics                              | `Cosmetics`                                                                           | `scripts/data/cosmetics.ts`                           | **Read-ready**                           | `getCosmeticItemTokenIds` and `getCosmetic`                                        | Add an exact adapter; configuration removal already exists. Preserve per-player equipped cosmetics.                                                                                                                                                                              |
| Instant actions                        | `InstantActions`                                                                      | `scripts/data/instantActions.ts`                      | **Read-ready**                           | `getActionIds` for each finite action type and existing `getAction`                | Add an exact adapter; add, edit, and removal already exist.                                                                                                                                                                                                                      |
| Instant VRF actions and strategy data  | `InstantVRFActions`, `GenericInstantVRFActionStrategy`, `EggInstantVRFActionStrategy` | `scripts/data/instantVRFActions.ts`                   | **Read-ready**                           | `getActionIds`, existing action/strategy reads, and strategy `getAction` reads     | Add an exact action adapter and treat strategy addresses as wiring. Parent action removal already exists.                                                                                                                                                                        |
| Passive actions and rewards            | `PassiveActions`                                                                      | `scripts/data/passiveActions.ts`                      | **Read-ready**, **mutation-blocked**     | `getActionIds`, existing `getAction`, and `getActionRewards`                       | Add an additive adapter or define action removal semantics.                                                                                                                                                                                                                      |
| Base pet metadata                      | `PetNFT`                                                                              | `scripts/data/pets.ts`                                | **Read-ready**, **mutation-blocked**     | `getBasePetIds` and `getBasePetMetadata`                                           | Add an additive adapter or define removal semantics. Existing pets cannot change either enhancement skill. Full `uint24` discovery needs 16,384 calls at the 1,024-key page limit, so the adapter must measure RPC cost.                                                         |
| Avatars                                | `PlayerNFT`                                                                           | `scripts/data/avatars.ts`                             | **Known-key read**                       | `getAvatar`                                                                        | Arbitrary `uint256` setter keys have no complete discovery. Reconciliation can verify, overwrite, or clear known IDs.                                                                                                                                                            |
| XP threshold rewards                   | `Players`                                                                             | `scripts/data/xpThresholdRewards.ts`                  | **Read-ready**, **mutation-blocked**     | `getXPThresholdRewards` enumerates configured entries in the fixed threshold table | Add an additive adapter or define removal semantics.                                                                                                                                                                                                                             |
| Full-attire bonuses                    | `Players`                                                                             | `scripts/data/fullAttireBonuses.ts`                   | **Read-ready**, **mutation-blocked**     | `getFullAttireBonus` over the finite `Skill` enum                                  | Add an additive adapter or define a clear operation for stale skills. The existing add operation overwrites a skill.                                                                                                                                                             |
| Daily and weekly reward pools          | `DailyRewardsScheduler`                                                               | `scripts/data/dailyRewards.ts`                        | **Known-key read**                       | `getDailyRewardPool` and `getWeeklyRewardPool`                                     | Desired tiers are readable and replaceable. Arbitrary `uint256` tier keys prevent discovery of unknown stale pools.                                                                                                                                                              |
| Clan tiers                             | `Clans`                                                                               | `scripts/data/clans.ts`                               | **Read-ready**, **mutation-blocked**     | `getTierIds` and existing `getTier`                                                | Add an additive adapter or define tier removal semantics.                                                                                                                                                                                                                        |
| Base raids and combat action pool      | `Raids`                                                                               | `scripts/data/raids.ts` plus initializer combat IDs   | **Known-key read**, **mutation-blocked** | `getBaseRaidIds`, `getBaseRaid`, and `getCombatActionIds`                          | The combat pool is replaceable. `getBaseRaidIds` completely scans the gameplay `uint16` ID range without trusting `_maxBaseRaidId`, but the owner setter accepts arbitrary `uint256` IDs. Those out-of-range keys are readable only when known. Base raids also have no removal. |
| Territories and minimum MMR            | `Territories`                                                                         | `scripts/data/territories.ts`                         | **Read-ready**, **mutation-blocked**     | Existing `getTerrorities` and `getTerritory`                                       | Add an adapter that compares only ID, emission percentage, and minimum MMR. Preserve occupancy, unclaimed emissions, and timestamps. A removed ID below `_nextTerritoryId` cannot be recreated by the sequential add operation.                                                  |
| Territory battle skills                | `Territories`                                                                         | `scripts/data/territories.ts`                         | **Read-ready**, **mutation-blocked**     | `getComparableSkills`                                                              | `setComparableSkills` appends. Exact reconciliation needs replacement semantics.                                                                                                                                                                                                 |
| PVP battle skills and comparison count | `PVPBattleground`                                                                     | `scripts/data/territories.ts`                         | **Read-ready**, **mutation-blocked**     | `getComparableSkills` and `getNumSkillsToCompare`                                  | `setComparableSkills` appends. Exact reconciliation needs replacement semantics.                                                                                                                                                                                                 |
| Locked-vault battle skills             | `LockedBankVaults`                                                                    | `scripts/data/territories.ts`                         | **Read-ready**, **mutation-blocked**     | `getComparableSkills`                                                              | `setComparableSkills` appends. Exact reconciliation needs replacement semantics.                                                                                                                                                                                                 |
| Order-book token constraints           | `OrderBook`                                                                           | `scripts/data/orderbookTokenIdInfos.ts`               | **Known-key read**, **mutation-blocked** | Existing `getTokenIdInfo`                                                          | Arbitrary `uint256` token IDs have no complete discovery or removal, and a nonzero tick cannot be changed.                                                                                                                                                                       |

`ItemInput.name`, `isCollectionItem`, and `isQuestItem` are not persisted by `ItemNFT`. A reconciler cannot compare them
on-chain and must not claim to do so.

## Release and administration data

These records are not part of the central fresh-deployment seed function, but release or administration scripts write
them.

| Data set                          | Contract                    | Desired source                                                      | Read status                              | Direct read                                                                 | Remaining reconciliation work                                                                                                                                                                                                                                                                                 |
| --------------------------------- | --------------------------- | ------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Promotions                        | `Promotions`                | Inline release scripts such as `scripts/addPromotion.ts`            | **Read-ready**                           | Existing `getActivePromotion` over the finite `Promotion` enum              | Centralize desired records, normalize packed day/cost fields, and add an exact adapter. Add, edit, and removal exist.                                                                                                                                                                                         |
| Activity-point calculations       | `ActivityPoints`            | Initializer defaults and `scripts/addActivityPointsCalculations.ts` | **Read-ready**                           | `getPointsCalculation` over the finite `ActivityType` enum                  | Centralize the desired table and add an exact adapter. The setter can overwrite or clear a calculation.                                                                                                                                                                                                       |
| Global events                     | `GlobalEvents`              | Inline `scripts/addGlobalEvents.ts` data                            | **Known-key read**, **mutation-blocked** | `getGlobalEvent`                                                            | Event IDs are arbitrary `uint256` values with no discovery or removal. `addGlobalEvents` can overwrite configuration while preserving runtime `totalInputAmount`.                                                                                                                                             |
| Black-market collections          | `BlackMarketTrader`         | `scripts/data/blackMarketItems.ts` and release scripts              | **Known-key read**, **mutation-blocked** | `getShopCollection` enumerates items for a known event ID                   | Event IDs are arbitrary and undiscoverable. Compare items by token ID, not returned order. Compare accepted item, price, amount per purchase, and configured stock; exclude current stock and active state. `editShopItems` resets current stock, so configuration updates need an explicit safe-time policy. |
| Session subsidy groups and limits | `GameSubsidisationRegistry` | `scripts/data/groupSubsidyLimits.ts`                                | **Known-key read**                       | Existing `functionToLimitGroup`, `groupDailyLimits`, and `getGroupAndLimit` | Desired keys are readable, but arbitrary contract/selector mappings cannot expose unknown stale entries.                                                                                                                                                                                                      |
| Supporter packs                   | `Shop`                      | Release scripts                                                     | **Missing getter**                       | None for `_packPrices` or pack IDs                                          | Add configuration-only reads and define how `amountRemaining` is preserved. Do not reset consumed inventory during reconciliation.                                                                                                                                                                            |

Inline release data must move into profile-aware canonical data functions before it becomes managed. Otherwise a
reconciler would compare against whichever one-off script happens to be current.

## Runtime state excluded from canonical data

The following state is not deployment drift:

- item balances, supply, and first-mint timestamps;
- equipped player cosmetics, player quest progress, avatars selected by players, XP, and action queues;
- minted pet instances, pet training, names, and ownership;
- territory occupancy, emissions accrued, claim timestamps, attacks, and clan combatants;
- spawned raids and active raid progress;
- current reward randomness;
- Shop allocation checkpoints and supporter-pack remaining quantity;
- global-event contributed totals;
- black-market current stock and active state;
- promotion claim/completion state;
- order-book orders, claims, and market balances; and
- activity-point checkpoints, registered boosts, and session usage counters.

Adapters must normalize mixed structs before comparison. They must never write a full returned struct back when that
would overwrite one of these runtime fields.

## Scalar configuration outside this phase

Initializers and owner setters also hold scalar deployment configuration: addresses, fees, distribution percentages,
URI prefixes, rename/upgrade costs, cooldowns, gas limits, combat limits, Wishing Well thresholds and reward IDs, and
feature flags. These values are deployment configuration rather than keyed content records. They need separate narrow
configuration adapters and getters where absent; they are not covered by the read-ready statements above.

## Next implementation order

1. Add adapters for Items, Quests, Cosmetics, and Instant Actions. They have complete reads and exact mutations.
2. Add World Action Choices, then decide whether World Actions use additive policy or gain action removal.
3. Add Instant VRF Actions with both strategy decoders.
4. Add runtime-normalized Territories and the replaceable raid combat-action pool.
5. Add additive adapters for mutation-blocked domains only after the retained-stale-record policy is explicit.
6. Resolve arbitrary-key discovery for avatars, reward tiers, global events, black-market event IDs, OrderBook token IDs,
   and subsidy selectors before claiming exact alignment.
7. Add supporter-pack and scalar-configuration getters as separate phases.

Each adapter must still implement desired-data loading, pinned-block reads, normalized diffing, Safe calldata, fork
simulation, postcondition verification, partial resume, and a second-plan-empty test before its command policy changes
from `unmanaged`.
