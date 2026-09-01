# `via_ir` stack-too-deep discovery

Date: 2026-09-01

## Decision summary

Selective `via_ir` profiles are worthwhile after test import isolation. The production-interface implementation reduced the measured cold full-suite wall time from 14:54.82 to 1:47.35 while preserving all 997 tests.

- The repository enables the IR pipeline in Foundry and Hardhat. Slither also passes `--via-ir` to Solidity.
- A clean-artifact Foundry build with IR took 875.83 seconds wall time in the current orb. An independent orb run took 740.45 seconds. Peak memory was about 4.7 GiB in both runs.
- Ten source units have a directly reproducible legacy-codegen stack-too-deep error. The dependency graph makes 32 of the 115 individually targeted files under `contracts/` fail, but those failures reduce to the same ten diagnostic locations.
- Two clean source targets that already compile without IR were 2.58× and 2.85× faster without IR. These small targets show a real cost, but they do not predict the full-project saving.
- The ten first errors range from local expression pressure to ABI-sized functions. Several are likely small refactors. `PlayersLibrary`, `Quests`, and `LockedBankVaultsLibrary` are higher-risk changes.
- Selective Foundry compiler profiles work, but configuration alone left 278 of 282 full-build sources in an IR job and made the measured clean build about 2.6% slower because 161 sources were also compiled with legacy codegen. A production-only selective build was much faster than the full build, which indicates that removing affected implementation imports from broad test fixtures is the main opportunity.
- The selective-profile implementation now keeps all test and script artifacts out of IR compilation, apart from one explicitly isolated event-decoder helper under `contracts/test`. After replacing test-only ABI facades with production interfaces, a clean `forge test --force` took 107.35 seconds and 2.72 GiB peak RSS, versus 894.82 seconds and 4.79 GiB with global IR. This is an 88.0% wall-time reduction and a 43.2% peak-memory reduction in the measured runs.

The selective-profile route is now implemented. Refactoring the ten stack-heavy production functions remains an optional follow-up rather than a prerequisite for fast Foundry compilation.

## Scope and limitations

The initial offender scan was read-only. The later selective-profile implementation changed Foundry configuration and test infrastructure, but did not change production contract behavior.

Solidity code generation stops at the first stack-too-deep error in a compilation unit. Compiling every production source as an independent target avoids failures in unrelated roots masking each other, but it cannot reveal a second error behind the first error in the same source unit. Therefore:

- The ten locations below are empirically confirmed.
- All other directly targeted production source units compile without IR in the current source tree.
- Applying IR restrictions to these ten source files made the complete current `contracts/` build succeed. These are therefore sufficient selective-profile restrictions for the current tree.
- Additional legacy-codegen errors can still exist behind the first diagnostic within one of these ten source files. A complete count of source refactors is not possible without temporary source changes or iterative fixes.
- The timing called “clean” below removes Foundry artifacts and cache. It does not purge the operating system page cache or control for other orb load.

The scan included production contracts and libraries. Interfaces, global-definition-only files, archived contracts, and test mocks were not treated as independent production offenders. A broader scan of all 115 Solidity files under `contracts/` found no additional direct diagnostic location.

## Current compiler configuration

| Tool    | Configuration                                                                                                              | Location                  |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Foundry | Solidity 0.8.28, Cancun, optimizer enabled, 9,999,999 runs, legacy codegen by default, with targeted `via-ir` restrictions | `foundry.toml`            |
| Hardhat | Solidity 0.8.28, Cancun, optimizer enabled, 9,999,999 runs, `viaIR: true`                                                  | `hardhat.config.ts:20-30` |
| Slither | Passes `--via-ir --optimize` to Solidity                                                                                   | `slither.config.json:3`   |

Foundry accepts `FOUNDRY_VIA_IR=false` as a non-persistent override. This made it possible to inspect the legacy pipeline without editing configuration.

## Confirmed offenders

Every diagnostic had this compiler message:

> Compiler error (`/solidity/libsolidity/codegen/LValue.cpp:50`): Stack too deep. Try compiling with `--via-ir` ... Otherwise, try removing local variables.

| #   | Source and function                                                         | Diagnostic                             | Main source of pressure                                                                          | Likely first approach                                                                     | Risk       |
| --- | --------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------- |
| 1   | `contracts/Bazaar/OrderBook.sol`, `_cancelOrders` (410-458)                 | 430:46, `orderIds[i]`                  | Loop state, two output arrays, tuple locals, and nested mapping call arguments                   | Remove tuple destructuring; split per-side cancellation or use a local accumulator struct | Low        |
| 2   | `contracts/PetNFTLibrary.sol`, `uri` (19-103)                               | 46:45, `pet.skillFixedEnhancementMax1` | Large `abi.encodePacked` expression and URI locals                                               | Build skill and final JSON fragments in separate helpers or scopes                        | Low        |
| 3   | `contracts/Clans/Clans.sol`, `createClan` (263-307)                         | 287:45, `_playerInfo[playerId]`        | Seven parameters plus tier, clan, player, social, payment, and reward phases                     | Split persistence from post-create work and limit storage-reference lifetimes             | Medium     |
| 4   | `contracts/Players/PlayersLibrary.sol`, `determineBattleOutcome` (329-368)  | 355:9, `from`                          | Forwarding 12 inputs while carrying 5 return values                                              | Use internal request/result structs and split battle phases                               | High       |
| 5   | `contracts/Clans/CombatantsHelper.sol`, `assignCombatants` (107-158)        | 124:7, `setLockedVaultCombatants`      | Repeated 11-argument helper calls and parameterized modifiers                                    | Use destination-specific helpers or one compact internal assignment context               | Medium     |
| 6   | `contracts/Clans/LockedBankVaultsLibrary.sol`, `fulfillUpdateMMR` (371-458) | 394:7, `kA`                            | Nine parameters, two returns, index/MMR state, and four output arrays                            | Separate MMR calculation from ordered array mutation                                      | High       |
| 7   | `contracts/Quests.sol`, `processQuestsView` (574-654)                       | 596:60, `_activeQuests[playerId]`      | Six inputs, eight named dynamic-array returns, five counters, and a seven-value tuple            | Return private aggregate structs and split active-quest processing                        | High       |
| 8   | `contracts/PlayerNFT.sol`, `mint` (163-190)                                 | 183:40, `avatarId`                     | Seven inputs, four dynamic strings, event/name locals, storage pointer, and mint flow            | End name/social lifetimes before a player-initialization helper                           | Medium     |
| 9   | `contracts/PassiveActions.sol`, `pendingPassiveActionState` (245-330)       | 297:9, `playerId`                      | Five-value status tuple and guaranteed/random reward phases overlap                              | Extract guaranteed and random reward population into separate helpers                     | Low-Medium |
| 10  | `contracts/Session/UsageBasedSessionModule.sol`, `_execute` (212-268)       | 244:11, `safe`                         | Flattened request parameters plus session, registry, usage, nonce, and EIP-712 encoding operands | Pass `ExecuteParams calldata` through and isolate digest verification                     | Low        |

### 1. `OrderBook._cancelOrders`

The loop keeps the sender, coin total, NFT count, two memory arrays, loop bound, and index live. It then creates `cancelOrder`, destructures three fields into separate locals, computes `tick` and `storedPrice`, and passes four non-trivial expressions to `_cancelOrdersSide`.

Resolution order:

1. Remove `(side, tokenId, price)` tuple destructuring. Read fields from `cancelOrder` or copy only a field that is used repeatedly.
2. Put buy and sell handling in separate scoped blocks so `quantity` and side-specific mapping expressions expire immediately.
3. If that is insufficient, move coin/NFT output state into a memory accumulator struct and process one cancellation in a helper.

This should not require an external ABI or storage-layout change.

### 2. `PetNFTLibrary.uri`

The first failure is inside a 19-part `abi.encodePacked` call. The function also retains skin, tier, enhancement type, star flags, image URI, attributes, name data, URL data, and description until final JSON assembly.

Resolution order:

1. Build skill #1 and skill #2 attributes in separate helpers, then concatenate the two byte fragments.
2. Extract final JSON assembly into a helper so attribute-building locals are dead first.
3. Use nested scopes if helpers would add unnecessary public library surface.

Do not replace one large encoding expression with another large tuple. The objective is to reduce simultaneous operands.

### 3. `Clans.createClan`

The function combines validation, clan persistence, player membership, social data, event emission, payment, bank creation, and activity rewards. The failure occurs when the player storage pointer is introduced while tier and clan state are still in scope.

Resolution order:

1. Put tier validation and clan initialization in a helper that returns only `clanId` and the price needed later.
2. Complete player membership and social/name work in another phase before bank and activity calls.
3. Avoid tuple destructuring from `_setName` if an internal helper can return only the used value.

Keep the external signature unless an ABI migration is explicitly acceptable.

### 4. `PlayersLibrary.determineBattleOutcome`

The external library function forwards 12 inputs to `_determineBattleOutcome` and carries 5 return values. The internal implementation then spans damage, elapsed time, food, equipment, and death calculation.

Resolution order:

1. Define internal request and result memory structs. Keep the current external signature initially and aggregate values at the boundary.
2. Split the internal implementation into coherent phases such as damage/kill timing and consumable/equipment calculation.
3. If the external wrapper itself remains over the limit, changing the library ABI to accept a struct may be necessary. Update all Solidity callers and generated bindings together.

This is high risk because argument aggregation can move, rather than remove, pressure at the ABI boundary. It also has production callers in `PlayersImplMisc.sol` and `Raids.sol` and substantial test coverage.

### 5. `CombatantsHelper.assignCombatants`

The function accepts eight values and has two parameterized modifiers. It then calls `_checkAndSetAssignCombatants` three times with 11 arguments in different orders.

Resolution order:

1. Replace the generic reordered call with three destination-specific internal helpers. Each helper can read `_territories`, `_lockedVaults`, and `_raids` from storage rather than receiving interface values.
2. Alternatively, create one local assignment context and pass only the selected destination and exclusion sets.
3. Preserve the current external ABI. It has many script and test callers.

### 6. `LockedBankVaultsLibrary.fulfillUpdateMMR`

The function computes clan indices, old and new MMR values, eligibility, and return deltas. It then maintains four parallel arrays while preserving index-shift ordering.

Resolution order:

1. Isolate old/new MMR calculation in a pure or view helper that returns a compact result.
2. End the calculation phase before allocating update arrays.
3. Model one pending MMR update as a memory struct, then encode parallel arrays only at `_updateMMRArrays` if that API must remain unchanged.
4. Keep attacker and defender mutation ordering explicit because insertion can shift the defender index.

The source already records that an earlier struct attempt caused `Could not create stack layout after 1000 iterations`. A future change should use a real phase boundary and a small context, not put every current value into one large struct.

### 7. `Quests.processQuestsView`

Eight named dynamic-array returns are live for the full function. The active quest branch adds five lengths and destructures seven values from `_processQuestView`.

Resolution order:

1. Make `_processQuestView` return one private memory result struct instead of seven tuple values.
2. Put all output arrays and their logical lengths in one private accumulator struct.
3. Move active-quest processing to a helper, then unpack the accumulator at the current external boundary.
4. Change the external return shape only if the wrapper still cannot compile and the ABI migration is acceptable.

The production caller in `PlayersImplRewards.sol` currently destructures all eight outputs. An external return-struct change would require coordinated caller and interface updates.

### 8. `PlayerNFT.mint`

The function receives seven inputs, including four strings. The trimmed name remains live through social checks, a large event, storage initialization, minting, and upgrade selection.

Resolution order:

1. Scope name/social validation and event emission so `trimmedName` is dead before mint setup.
2. Move player storage initialization and starting-item mint into a helper with only `from`, `playerId`, `avatarId`, and `makeActive`.
3. Keep upgrade selection in a final phase.

The external ABI can remain unchanged.

### 9. `PassiveActions.pendingPassiveActionState`

The named memory return already provides a useful aggregate, but five `finishedInfo` values, passive action/reward references, guaranteed reward state, and random reward state overlap. The failure occurs in the randomness call.

Resolution order:

1. Extract guaranteed reward array creation and population.
2. Extract random reward calculation with only the reward, timing, winner count, player ID, and output state it needs.
3. Create `numIterations`, `endTime`, and random bytes only in the random helper or a narrow block.
4. Replace tuple destructuring with a status struct if `finishedInfo` can support it without spreading ABI changes.

### 10. `UsageBasedSessionModule._execute`

`executeSingle` already receives `ExecuteParams calldata`, but immediately flattens it into five arguments. `_execute` then keeps session, selector, group, usage, nonce, digest, and the seven EIP-712 encoding values live.

Resolution order:

1. Pass `ExecuteParams calldata` directly to `_execute`.
2. Extract EIP-712 digest construction and signature verification into a helper.
3. Scope registry lookup and daily counter reset separately from signature and execution work.

This is the clearest low-risk use of a calldata struct because the struct and external entry point already exist.

## Techniques to apply consistently

### Shorten variable lifetimes

Use a block or helper when one logical phase does not need the previous phase's locals. The best candidates here are `Clans.createClan`, `PlayerNFT.mint`, `PassiveActions.pendingPassiveActionState`, and `LockedBankVaultsLibrary.fulfillUpdateMMR`.

Do not add blocks mechanically. A block helps only when values are not needed later and legacy code generation can release their stack slots.

### Replace tuples with memory or calldata structs

Tuple destructuring creates several simultaneously live values. Private/internal result structs are suitable for `Quests` and `PlayersLibrary`. Passing the existing `ExecuteParams calldata` through is suitable for the session module.

Keep local structs in memory. Adding storage structs or state variables is unnecessary and would create upgrade-layout risk.

An external struct parameter or return changes the ABI even if it carries the same conceptual fields. Preserve external signatures first. Treat an ABI change as a separate migration decision.

### Reduce call-site argument pressure

An internal helper is useful only if its interface is smaller than the code it replaces. Passing every current local to a new helper does not solve the problem. Helpers should read stable contract dependencies from storage where appropriate and accept one coherent request or result.

### Split large encoding expressions

Large `abi.encodePacked` and `abi.encode` expressions require many operands at once. Construct semantic fragments first, and encode the final object after earlier values expire. This is directly applicable to `PetNFTLibrary.uri` and session EIP-712 hashing.

### Split coherent phases, not arbitrary line ranges

Good boundaries have smaller inputs and outputs: calculate MMR, apply ordered MMR updates, build one pet skill's metadata, validate a session signature, or populate random rewards. Arbitrary extraction can increase argument pressure and bytecode size.

## Compilation measurements

### Full repository with IR

Current orb:

```text
rm -rf /tmp/estfor-out-ir-benchmark /tmp/estfor-cache-ir-benchmark
/usr/bin/time -f 'ELAPSED=%e USER=%U SYS=%S MAXRSS_KB=%M EXIT=%x' \
  env FOUNDRY_VIA_IR=true \
      FOUNDRY_OUT=/tmp/estfor-out-ir-benchmark \
      FOUNDRY_CACHE_PATH=/tmp/estfor-cache-ir-benchmark \
  forge build --force

Compiling 282 files with Solc 0.8.28
Solc 0.8.28 finished in 871.87s
ELAPSED=875.83 USER=871.04 SYS=5.34 MAXRSS_KB=4785612 EXIT=0
```

An independent orb repeated the forced build in 740.45 seconds wall time and 735.18 seconds user CPU time, with 4,785,676 KiB peak RSS. This variation is why a future before/after benchmark should use several alternating runs on the same machine.

### Full repository without IR

```text
rm -rf /tmp/estfor-out-noir /tmp/estfor-cache-noir
/usr/bin/time -f 'ELAPSED=%e USER=%U SYS=%S MAXRSS_KB=%M EXIT=%x' \
  env FOUNDRY_VIA_IR=false \
      FOUNDRY_OUT=/tmp/estfor-out-noir \
      FOUNDRY_CACHE_PATH=/tmp/estfor-cache-noir \
  forge build --force

Compiling 282 files with Solc 0.8.28
Solc 0.8.28 finished in 12.54s
Error: ... Stack too deep ... contracts/Bazaar/OrderBook.sol:430:46
ELAPSED=15.70 USER=13.21 SYS=2.19 MAXRSS_KB=2296436 EXIT=1
```

This is time to the first failure, not a successful no-IR build and not a valid speed comparison.

### Successful clean target comparisons

| Target                       | Measurement                      | Without IR | With IR | IR/no-IR wall ratio |
| ---------------------------- | -------------------------------- | ---------: | ------: | ------------------: |
| `contracts/ItemNFT.sol`      | Current orb; 44 sources compiled |      1.35s |   3.85s |               2.85× |
| `contracts/WorldActions.sol` | Independent orb                  |      1.18s |   3.04s |               2.58× |

Both used separate empty output/cache directories and forced compilation. No-IR ran first, and OS caches were not purged. These results establish direction, not a full-project estimate.

## Alternative: selective compiler profiles

Foundry can compile different source units with different compiler settings. This makes it technically possible to keep the ten confirmed offenders on the IR pipeline while making the default profile use the legacy pipeline. All of these keys belong under `[profile.default]`:

```toml
via_ir = false

additional_compiler_profiles = [
  { name = "via-ir", via_ir = true },
]

compilation_restrictions = [
  { paths = "contracts/Bazaar/OrderBook.sol", via_ir = true },
  { paths = "contracts/PetNFTLibrary.sol", via_ir = true },
  { paths = "contracts/Clans/Clans.sol", via_ir = true },
  { paths = "contracts/Players/PlayersLibrary.sol", via_ir = true },
  { paths = "contracts/Clans/CombatantsHelper.sol", via_ir = true },
  { paths = "contracts/Clans/LockedBankVaultsLibrary.sol", via_ir = true },
  { paths = "contracts/Quests.sol", via_ir = true },
  { paths = "contracts/PlayerNFT.sol", via_ir = true },
  { paths = "contracts/PassiveActions.sol", via_ir = true },
  { paths = "contracts/Session/UsageBasedSessionModule.sol", via_ir = true },
]
```

These are illustrative changes, not repository configuration applied by this discovery. Fields omitted from the additional profile inherit the normal project settings.

In Foundry 1.8.1, `additional_compiler_profiles` can override `via_ir`, `evm_version`, `optimizer`, `optimizer_runs`, and `bytecode_hash`. Restriction `paths` are glob patterns despite the documentation describing them as regular expressions. Exact project-relative paths, as used above, avoid that ambiguity.

### Restriction propagation

Only the ten direct offenders need explicit restrictions. Foundry selects a compiler profile that satisfies a source and all of its imports. A source that imports an IR-restricted source therefore joins an IR compilation unit automatically. Explicitly maintaining every transitive importer in `compilation_restrictions` would be redundant and more error-prone.

The reverse-import closure of the ten offenders contains 32 production source files:

```text
contracts/Bazaar/OrderBook.sol
contracts/Bridge/Bridge.sol
contracts/Clans/BankRelay.sol
contracts/Clans/ClanBattleLibrary.sol
contracts/Clans/Clans.sol
contracts/Clans/CombatantsHelper.sol
contracts/Clans/LockedBankVaults.sol
contracts/Clans/LockedBankVaultsLibrary.sol
contracts/Clans/Raids.sol
contracts/Clans/Territories.sol
contracts/InstantActions.sol
contracts/InstantVRFActions.sol
contracts/PVPBattleground.sol
contracts/PassiveActions.sol
contracts/PetNFT.sol
contracts/PetNFTLibrary.sol
contracts/PetNFTReroll.sol
contracts/PlayerNFT.sol
contracts/Players/Players.sol
contracts/Players/PlayersBase.sol
contracts/Players/PlayersImplMisc.sol
contracts/Players/PlayersImplMisc1.sol
contracts/Players/PlayersImplProcessActions.sol
contracts/Players/PlayersImplQueueActions.sol
contracts/Players/PlayersImplRewards.sol
contracts/Players/PlayersLibrary.sol
contracts/Promotions.sol
contracts/Quests.sol
contracts/Session/UsageBasedSessionModule.sol
contracts/WishingWell.sol
contracts/interfaces/IPlayersDelegates.sol
contracts/test/Session/TestSessionHelpers.sol
```

These roots and their dependencies cover 82 of 115 local `contracts/**/*.sol` source files. Selective profiles reduce the IR surface, but the production dependency graph still creates a broad IR compilation unit.

### Measured result without changing imports

A disposable worktree used the configuration above and ran `forge build --force --no-lint`:

| Configuration                         | Compiler jobs                           | Wall time |      Peak RSS |
| ------------------------------------- | --------------------------------------- | --------: | ------------: |
| Global IR                             | 282 files with IR                       |   857.13s | 4,786,068 KiB |
| Selective profiles, imports unchanged | 161 files without IR; 278 files with IR |   879.65s | 4,803,120 KiB |

The selective build compiled some shared sources in both profiles. Its IR job still contained 278 files, while the additional legacy job contained 161 files. It was 22.52 seconds, or about 2.6%, slower than the global-IR run. These are single runs and normal timing variation still applies, but **configuration alone is not a compelling optimization for this repository**: it adds duplicate compilation without materially shrinking the expensive IR job.

A production-only comparison was more favorable:

| Production-only configuration | Compiler jobs                           | Wall time |      Peak RSS |
| ----------------------------- | --------------------------------------- | --------: | ------------: |
| Global IR                     | 192 files with IR                       |   112.86s | 1,062,052 KiB |
| Selective profiles            | 141 files without IR; 147 files with IR |    91.06s |   959,964 KiB |

This separate comparison was about 19% faster in the measured run. A repeated selective production-only build took 93.89 seconds and 958,792 KiB peak RSS, which is consistent with that result. It suggests that IR compilation of tests is a large part of the full-build cost and that detaching tests from affected implementation sources is the important part of this alternative. It does not establish the final achievable full-build time.

### Avoiding implementation imports in tests

Foundry's documentation recommends `vm.deployCode` when tests must deploy a contract from another compiler profile without importing its implementation. The profile-qualified artifact identifier was verified with Foundry 1.8.1:

```solidity
import {IOrderBook} from "../contracts/interfaces/IOrderBook.sol";

IOrderBook orderBook = IOrderBook(
  vm.deployCode("contracts/Bazaar/OrderBook.sol:OrderBook:via-ir")
);
```

A disposable test using this pattern compiled 36 sources with the legacy pipeline in 3.34 seconds and passed. A control experiment that restricted `test/**` to `via_ir = false` while `OrderBook.t.sol` still directly imported `OrderBook` failed before compilation with incompatible restrictions. Removing the implementation import is therefore necessary; changing only the deployment expression is not sufficient.

The current test graph makes this a migration rather than a small configuration change:

- 54 of 55 Foundry test source files transitively import at least one affected production source.
- 36 test files have 93 direct import edges to 31 of the 32 affected production sources.
- 25 test files directly import at least one of the ten confirmed offenders.
- The 55 Solidity test/helper files and four Solidity scripts contain 147 direct contract-creation expressions across 27 files. Of these, 69 are concentrated in the two shared test helpers: 47 in `FullGameStack.sol` and 22 in `EstforTest.sol`.
- There are 15 direct constructions of confirmed offenders: six `OrderBook`, two each of `Clans`, `CombatantsHelper`, and `PlayerNFT`, and one each of `Quests`, `PassiveActions`, and `UsageBasedSessionModule`. The three library offenders have no direct construction sites.
- `test/utils/FullGameStack.sol` imports and deploys many affected game implementations. `test/utils/EstforTest.sol` imports and deploys `OrderBook` and `UsageBasedSessionModule`. Migrating these shared bases would have high leverage, but leaf tests also contain direct imports.
- At least 18 tests use types scoped to affected concrete implementations, such as `Clans.Tier`, `Quests.MinimumRequirement`, `PassiveActions.PassiveActionInput`, and `UsageBasedSessionModule.ExecuteParams`. Some Players tests also refer to concrete-contract errors, events, or selectors. These definitions would need to move to neutral interface/global files, or the tests would need equivalent ABI declarations and selector constants.
- Existing public interfaces do not consistently expose initializer and setup methods. Tests that deploy proxies would need test-only deployment interfaces or `abi.encodeWithSignature` instead of `abi.encodeCall(Concrete.initialize, ...)`.

Do not add a blanket `{ paths = "test/**", via_ir = false }` restriction during migration. Tests with no affected imports will select the default non-IR profile automatically; tests that still import affected implementations must remain eligible for the IR profile.

### Artifact deployment and library linking

`vm.deployCode` reverts when the selected artifact contains unlinked library placeholders. This affects several important implementations:

- `Clans`, `CombatantsHelper`, and `PlayerNFT` link `EstforLibrary`.
- `PetNFT` links `EstforLibrary` and `PetNFTLibrary`.
- Players implementation modules and `Raids` link `PlayersLibrary`.
- `LockedBankVaults` links `ClanBattleLibrary`, `LockedBankVaultsLibrary`, and `EstforLibrary`.
- `ItemNFT` links `ItemNFTLibrary`.

Those tests cannot be converted to plain `vm.deployCode` calls without also solving library linking. The repository already contains a suitable basis: `scripts/DeployGame.s.sol` reads artifact creation bytecode and replaces library placeholders before `CREATE`. A reusable test deployment helper could use the same approach, or the test configuration could use fixed Foundry library addresses where practical.

Among the ten direct offenders, only `Clans`, `CombatantsHelper`, and `PlayerNFT` have unresolved link references, all to `EstforLibrary`. Plain profile-qualified `vm.deployCode` can deploy the other seven offender artifacts. The broader list above matters when shared fixtures also stop importing affected transitive implementations.

Compiler profiles also make artifact selection important. Sources compiled in multiple profiles can produce a suffixed artifact such as `Contract.via-ir.json`. Profile-qualified identifiers such as `path:contract:via-ir` avoid ambiguity. `DeployGame.s.sol` already avoids concrete production imports and deploys linked artifact bytecode, so it needs an artifact path/profile audit rather than a blanket conversion to `vm.deployCode`.

The other current Forge Solidity scripts do not directly import the affected production implementations. The TypeScript deployment and maintenance scripts use Hardhat artifacts/type bindings and do not enter Foundry's source compilation graph. They are therefore outside this Foundry optimization, although Hardhat's globally enabled IR pipeline remains a separate cold-build cost.

Hardhat and Slither remain globally configured for IR. This selective-profile approach only reduces Foundry compilation unless separate changes are made for those toolchains.

### Assessment and recommended spike

Selective profiles are technically valid and could avoid risky source refactors. The current import graph, however, prevents configuration alone from delivering a meaningful full-build gain. The potential return comes from detaching broad tests from concrete affected implementations.

If this route is evaluated, use a staged spike:

1. Make non-IR the default and restrict only the ten direct offenders to the `via-ir` profile.
2. Convert one representative end-to-end test to neutral interfaces plus profile-qualified artifact deployment.
3. Add a focused artifact deployment/linking helper based on `DeployGame.s.sol` for contracts with linked libraries.
4. Migrate `FullGameStack` and `EstforTest`, then replace concrete-scoped structs, errors, events, selectors, and initializer references in dependent tests.
5. Leave direct implementation and library unit tests on IR where removing their source import would undermine what they test.
6. Rebenchmark clean full builds after each tranche and stop if duplicate compilation or test ABI maintenance consumes the expected gain.

This spike is a credible alternative to refactoring the ten stack-heavy functions, but its migration surface is substantial. The measured production-only improvement supports investigating it; the unchanged-import full-build result does not support adopting the configuration by itself.

### Implemented selective-profile result

The recommendation was implemented after the discovery measurement:

- Foundry now uses legacy codegen by default and a named `via-ir` profile for the ten confirmed offenders.
- A small battle-result decoder is also restricted to IR. It exists only to keep three large event tuple decodes out of legacy-compiled test functions.
- Test code no longer imports the affected production implementations. Canonical `I<Name>` interfaces under `contracts/interfaces` expose game-owned methods, structs, events, and errors, and the corresponding production contracts inherit those interfaces. This makes ABI drift a compile-time error instead of requiring manually synchronized test facades. Callable library ABIs also live under `contracts/interfaces`, but libraries cannot inherit interfaces.
- Standard OpenZeppelin interfaces are used where they exist, including ERC-1155, ERC-2981, ERC-5313 ownership, ERC-1822 proxiable, and ERC-1967 upgrade events. Focused supplemental interfaces contain Ownable, UUPS, Initializable, Pausable, ReentrancyGuard, and ERC-1155 supply ABI that OpenZeppelin does not publish as complete standalone interfaces. These framework selectors do not pollute game interfaces.
- Interface initializer parameters use neutral interface or address types where importing a concrete implementation would recreate the restricted import edge. The implementation converts those ABI-equivalent addresses back to its existing concrete storage types. This preserves storage layout and runtime ABI while keeping test roots in the legacy compiler job.
- Affected implementations and libraries are loaded with profile-qualified artifact identifiers such as `contracts/PlayerNFT.sol:PlayerNFT:via-ir`.
- Foundry links seven libraries at fixed test addresses. `EstforTest` installs each library's runtime bytecode at the matching address before artifact deployment. This supports implementations with link references while preserving artifact-based deployment.
- `FullGameStack` separates deployment and wiring into smaller phases so that the fixture itself compiles with legacy codegen. Large initializer and mint payloads are encoded in bounded chunks where the legacy ABI encoder would otherwise exhaust the stack.
- Solidity scripts already avoided affected implementation imports, so no script artifact deployment rewrite was required. `DeployGame.s.sol` now builds its 17-address Players initializer from contract state instead of a 17-argument helper, which lets the script itself compile without IR. Its existing artifact linker now replaces either unresolved placeholders or the fixed test addresses emitted by Foundry, so production deployments do not retain test-library links.

Artifact metadata after the final cold build contained zero artifacts rooted under `test/` or `scripts/` with `metadata.settings.viaIR = true`. A separate forced target build of `scripts/DeployGame.s.sol` succeeded and emitted `DeployGame.json` with `viaIR = false`. The session test helpers under `contracts/test/Session/` also compile without IR. The only IR artifacts in test-helper paths are the explicitly restricted battle-result decoder and its neutral interface dependency. This verifies the intended import boundary directly. Production sources shared by both jobs can still have both legacy and IR artifacts; that duplication is expected.

The comparison used the same command shape in the same orb. Both runs started with `forge clean`, forced compilation, ran all tests, and exited successfully. The global baseline was recorded before this change, with the parent revision's `via_ir = true` configuration. The selective run used the configuration implemented in this change:

```bash
# Parent revision: global via_ir = true, no selective profiles or restrictions
forge clean
/usr/bin/time -v forge test --force

# This revision: legacy default plus selective via-ir restrictions
forge clean
/usr/bin/time -v forge test --force
```

| Configuration                                 | Compiler jobs      | Test result | Wall time | User CPU |      Peak RSS |
| --------------------------------------------- | ------------------ | ----------- | --------: | -------: | ------------: |
| Global `via_ir = true`                        | 282 files with IR  | 997 passed  |   894.82s |  892.04s | 4,785,628 KiB |
| Selective profiles with production interfaces | 283 legacy; 163 IR | 997 passed  |   107.35s |  206.10s | 2,716,824 KiB |

In the final measurement, selective compilation was 8.34× faster by wall clock. It removed 787.47 seconds (88.0%) and reduced peak RSS by 2,068,804 KiB (43.2%). The two selective compiler jobs can run concurrently inside one Foundry process, which explains the 195% CPU utilization and user CPU time greater than wall time.

These are concrete single-run cold-artifact measurements, not a statistical benchmark. “Cold” means Foundry output and cache were removed; the operating-system page cache was not purged, and orb load was not controlled. The result is large enough to establish a material benefit, but repeated alternating runs are still appropriate if small future regressions must be assessed.

## Source-refactor implementation experiment

No implementation was done as part of this discovery. If work proceeds:

1. Record three alternating forced IR builds on the same machine.
2. Resolve the low-risk group first: session module, pet metadata, order cancellation, and passive rewards.
3. Compile each changed target without IR after each refactor. Preserve behavior and compare bytecode size.
4. Re-run the all-source scan to reveal the next diagnostic frontier.
5. Address `Clans`, `PlayerNFT`, and `CombatantsHelper` without changing external ABIs.
6. Reassess before the high-risk group: `PlayersLibrary`, `Quests`, and `LockedBankVaultsLibrary`.
7. After a full no-IR build succeeds, run the complete Foundry test suite and upgrade validation tests, then benchmark at least three alternating clean builds per mode.
8. Compare deployment bytecode and gas-sensitive tests. Removing IR changes code generation, not only compilation time.

Suggested go/no-go criteria:

- Continue if the low/medium-risk work exposes a credible route through the three high-risk functions and clean target timings retain a material advantage.
- Stop if preserving public ABIs requires wrappers that still fail, latent errors expand the scope substantially, or deployment size/gas regressions are unacceptable.
- Remove `via_ir` from both Foundry and Hardhat only after both toolchains compile and their relevant test suites pass.

## Reproduction commands

Verify the override:

```bash
FOUNDRY_VIA_IR=false forge config --json | jq '.via_ir'
```

Reproduce one direct offender without changing repository configuration:

```bash
FOUNDRY_VIA_IR=false \
FOUNDRY_OUT=/tmp/estfor-out-noir \
FOUNDRY_CACHE_PATH=/tmp/estfor-cache-noir \
forge build contracts/Bazaar/OrderBook.sol --force
```

For a future scan, compile source targets sequentially. Do not run Forge jobs in parallel because repository guidance warns that they can interfere with each other.

## Primary references

- [Solidity 0.8.28: memory safety and stack-to-memory movement in the IR pipeline](https://docs.soliditylang.org/en/v0.8.28/assembly.html#memory-safety)
- [Solidity 0.8.28: optimizer internals, legacy pipeline, Yul optimizer, and stack compression](https://docs.soliditylang.org/en/v0.8.28/internals/optimizer.html)
- [Foundry: additional compiler profiles and compilation restrictions](https://www.getfoundry.sh/config/reference/solidity-compiler#compilation-restrictions)
- [Foundry: `vm.deployCode`](https://www.getfoundry.sh/reference/cheatcodes/deploy-code)
- [Foundry 1.8.1: compiler profile cloning and restriction graph construction](https://github.com/foundry-rs/foundry/blob/982849d3140c01fd3b72905759581a132df7aa98/crates/config/src/lib.rs#L1280-L1340)
- [Foundry 1.8.1: artifact identifier lookup used by `vm.deployCode`](https://github.com/foundry-rs/foundry/blob/982849d3140c01fd3b72905759581a132df7aa98/crates/cheatcodes/src/fs.rs#L576-L735)

The compiler output and source locations in this document came directly from Solidity 0.8.28 through Foundry 1.8.1.
