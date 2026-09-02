# Existing deployment reconciliation

Date: 2026-09-01

## Decision summary

Add one host CLI command, backed by Foundry artifacts and scripts:

```text
pnpm deployment:sync -- --deployment sonic-live
```

The command should be a desired-state reconciler, not another collection of imperative release scripts.

- Its default behavior is read-only: select one tracked deployment, inspect chain state, calculate a deterministic plan, and simulate the plan.
- Applying a plan requires an explicit apply option and the hash of the previously reviewed plan.
- Deployment identity and stable addresses live in tracked files keyed by deployment ID. Chain ID is validated but is not the deployment identity because Sonic already has live and beta deployments on chain 146.
- Current proxy implementations are discovered from EIP-1967 slots. Implementation code is compared with linked Foundry runtime artifacts by bytecode segment. OpenZeppelin validation remains the upgrade-safety check; it is not an implementation identity check.
- Configuration is compared as managed resources with add, update, remove, and no-op results. Every managed resource must expose direct contract reads that discover its complete current key set and configuration values.
- Every tracked contract and beacon is expected to be owned by a multisignature Safe. All upgrades, wiring, and configuration changes are submitted as Safe proposals. EOA ownership and direct owner broadcasts are unsupported legacy behavior.
- A deployer EOA may deploy libraries, implementations, and brand-new proxy contracts. A new proxy must be owned by the tracked Safe before the deployment transaction completes; later authority-controlled changes still go through a Safe proposal.
- The first useful implementation should inventory every contract but manage only Shop buyable items and unsellable flags. It should then add Safe proposal execution, upgrades, and other data domains in stages.
- Do not add contract version methods solely for this tool. A manually maintained version does not prove that deployed code matches the build. Add missing state getters when a resource cannot otherwise be compared safely.

The intended invariant is:

> A successful apply followed by a new plan at a later block produces no managed operations, unless chain state or repository intent changed.

## Scope

This design covers:

- tracking more than one deployment on a chain;
- selecting and validating an existing deployment;
- discovering proxy and beacon implementations;
- deciding whether implementation upgrades are needed;
- comparing managed contract configuration and canonical game data;
- planning, simulating, proposing, broadcasting, resuming, and auditing changes;
- migrating from the current Hardhat scripts without a single large cutover.

Different rules and data for future deployments are not designed here. The deployment record reserves a profile name so this can be added without changing deployment identity or CLI selection.

User-owned state and mutable runtime state are not desired configuration. Examples include balances, player progression, active quests, shop allocation checkpoints, supporter-pack inventory consumed by users, active passive actions, and pending VRF requests. A resource adapter must explicitly exclude such fields.

## Current repository findings

### Address tracking is code and environment driven

Before Phase 1, [`scripts/contractAddresses.ts`](../scripts/contractAddresses.ts) contained the effective stable-address registry. It selected one of two address sets with `IS_BETA`; both sets were on Sonic chain 146. It separately selected third-party addresses with `CHAIN_ID`. Unsupported chains received placeholder `"0x"` values.

This has three problems:

1. A deployment is selected indirectly by process environment instead of an explicit identity.
2. One chain can only have the two branches encoded in the file.
3. Addresses, network selection, and script behavior are coupled in executable TypeScript.

Phase 1 moved these values to tracked registry files. `contractAddresses.ts` is now a compatibility export layer selected by `DEPLOYMENT_ID`, and the README links to the registry instead of duplicating addresses.

### The OpenZeppelin manifest is not a deployment registry

The tracked [`.openzeppelin/sonic.json`](../.openzeppelin/sonic.json) is manifest version 3.2. At the time of this investigation it contains 247 proxy history records and 333 implementation records. It includes both current Sonic live and beta proxies, but does not assign Estfor logical names or deployment IDs to them.

This matches the documented role of OpenZeppelin network files: they track versions and deployment history for an upgrades plugin on a network. OpenZeppelin recommends committing public-network manifests and supports custom manifest directories when environments on one chain need isolation ([OpenZeppelin network files](https://docs.openzeppelin.com/upgrades-plugins/network-files)).

Keep this file while Hardhat upgrade scripts need it. Do not select deployments from it. If a legacy proxy must be restored to a Hardhat manifest, `forceImport` needs the current implementation factory, not the proposed implementation ([OpenZeppelin Hardhat Upgrades `forceImport`](https://docs.openzeppelin.com/upgrades-plugins/api-hardhat-upgrades#force-import)). This is a migration repair operation, not normal reconciliation.

### Hardhat changes are imperative and manually selected

[`scripts/deployUpgrade.ts`](../scripts/deployUpgrade.ts) imports stable addresses, uses booleans and commented transaction entries to select work, prepares implementations, and either upgrades directly or proposes a Safe batch. The many `add*`, `edit*`, `remove*`, and `set*` commands in [`package.json`](../package.json) repeat the same release-specific pattern.

[`scripts/utils.ts`](../scripts/utils.ts) contains both the old and current execution concepts:

- direct owner calls, which are legacy and should not be carried into the reconciler; and
- Safe proposals for Sonic through `initialiseSafe`, `getSafeUpgradeTransaction`, and `sendTransactionSetToSafe`, which are the pattern to retain.

These scripts do not first calculate the complete difference between current and desired state. Their safe rerun behavior therefore depends on each script and the manually selected items.

### The Foundry deployment is a good fresh-deployment verifier, not a reconciler

`pnpm deploy:foundry` invokes [`scripts/deploy-foundry.sh`](../scripts/deploy-foundry.sh). The wrapper builds contracts, clears singleton run directories, executes eight `DeployGame` broadcast phases, optionally executes test-data phases, and runs RPC-backed assertions.

[`scripts/DeployGame.s.sol`](../scripts/DeployGame.s.sol) uses `CREATE` to deploy new libraries, implementations, proxies, a beacon, and other contracts. It then wires and seeds them. [`scripts/prepareForgeDeployData.ts`](../scripts/prepareForgeDeployData.ts) turns the canonical TypeScript data into linked bytecode, initializer calldata, seed calldata, and a generated manifest.

The output `.deployments/deployment.json` already has a useful logical address shape, but `.deployments` is ignored and the default path represents one run. It is a run result, not durable multi-deployment intent.

[`scripts/VerifyDeployment.s.sol`](../scripts/VerifyDeployment.s.sol) already demonstrates several checks that should be reused:

- chain and data-mode checks;
- code existence and Brio runtime size;
- direct EIP-1967 implementation-slot reads;
- proxy and beacon ownership;
- wiring checks; and
- representative seed checks.

It checks representative records rather than every canonical data record, and it assumes recorded implementation addresses from the fresh deployment output.

## Proposed architecture

Use TypeScript as the coordinator and data diff engine. Use Foundry for compilation artifacts, upgrade validation, fork simulation, and deployer-funded creation of libraries, implementations, and new proxies. Use the Safe SDK to create and submit every authority-controlled change as a Safe proposal.

```diagram
┌──────────────────────────┐
│ deployment:sync CLI      │
│ select / plan / apply    │
└────────────┬─────────────┘
             │
     ┌───────┴────────┐
     ▼                ▼
┌──────────────┐  ┌──────────────────┐
│ Deployment   │  │ Desired state    │
│ registry     │  │ artifacts + data │
└──────┬───────┘  └────────┬─────────┘
       │                   │
       └─────────┬─────────┘
                 ▼
         ┌──────────────┐
         │ RPC inventory│
         │ slots / code │
         │ getters      │
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │ Immutable    │
         │ hashed plan  │
         └──────┬───────┘
                ▼
         ┌──────────────┐
         │ Pinned fork  │
         │ simulation   │
         └──────┬───────┘
                ▼
      ┌─────────┴──────────┐
      ▼                    ▼
┌────────────┐       ┌────────────┐
│ Deployer   │       │ Safe       │
│ code create│       │ proposal   │
└────────────┘       └────────────┘
```

A pure Solidity coordinator is not a good fit. Deployment selection, ABI-normalized object comparison, plan serialization, Safe service calls, and human review output are host concerns. Keeping on-chain assertions and execution in Foundry still makes Foundry the contract-facing engine.

The plan envelope is shared across data domains. A generic reconciliation operation carries the domain, action, resource,
target, caller, value, calldata, dependencies, gas estimate, and postcondition. A generic domain plan carries desired and
current state, changes, limits, blocked reasons, and operations. Domain adapters still own their record shape, diff rules,
limits, calldata encoding, and postconditions. Making those semantics generic would hide important safety rules instead of
removing duplication.

## Tracked deployment registry

Use one reviewed file per deployment:

```text
deployments/
  146/
    sonic-live.json
    sonic-beta.json
  57054/
    blaze-beta.json
```

An initial schema can stay small:

```json
{
  "schemaVersion": 1,
  "deploymentId": "sonic-live",
  "chainId": 146,
  "deploymentBlock": 123456,
  "networkFingerprint": {
    "genesisHash": "0x..."
  },
  "profile": "live",
  "authority": {
    "type": "safe",
    "address": "0x..."
  },
  "contracts": {
    "shop": {
      "kind": "uups",
      "address": "0x..."
    },
    "bank": {
      "kind": "beacon",
      "address": "0x..."
    }
  },
  "externals": {
    "brush": "0x..."
  }
}
```

Design rules:

- `deploymentId` is the CLI identity. `chainId` is a validated attribute.
- Multiple files can have the same chain ID.
- RPC URLs and credentials remain outside tracked files. The registry can name an environment variable, but should not contain its value.
- Proxy, beacon, non-proxy, and external addresses are reviewed stable intent.
- `authority.type` must be `safe`. The loader rejects an EOA owner instead of selecting a direct-broadcast fallback.
- Any newly created proxy must name the tracked Safe as owner during initialization or transfer ownership to it within the same creation transaction.
- Current implementation addresses are discovered from the chain and recorded in run reports, not maintained as stable intent.
- `deploymentBlock` bounds deployment-specific verification and audit queries.
- A genesis hash or another stable network fingerprint protects against an RPC that reports the expected chain ID for a different network.
- `profile` is only a pointer in the first version. It maps current `live` and `beta` choices without designing future rule inheritance.
- Generated plans, receipts, traces, and Safe payloads go under an ignored `runs/<deploymentId>/<runId>/` directory.

The first migration should mechanically copy Sonic live and beta values from `contractAddresses.ts`. During transition, legacy Hardhat scripts should load the selected registry file through one compatibility module. This removes duplicate address truth before changing operational behavior.

## Proxy and implementation discovery

### Chain facts

For each tracked entry, the inventory step must:

1. Assert `eth_chainId`, network fingerprint, and non-empty `eth_getCode` at the stable address.
2. Read the EIP-1967 implementation slot for UUPS and transparent proxies.
3. Read the EIP-1967 beacon slot for beacon proxies, then call `implementation()` on the beacon.
4. Assert that implementation code exists.
5. Assert that every managed proxy and beacon is owned by the tracked multisignature Safe.
6. Call `proxiableUUID()` directly on a UUPS implementation where applicable and verify the implementation slot UUID.
7. Cross-check the legacy OpenZeppelin manifest while Hardhat remains in service. A missing manifest record is a warning; chain slots and code are authoritative.

EIP-1967 defines the implementation, beacon, and admin slots and the corresponding change events ([ERC-1967](https://eips.ethereum.org/EIPS/eip-1967)). `eth_getStorageAt` and `eth_getCode` provide the required chain data ([Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/)). `VerifyDeployment` already uses the implementation-slot form.

### Bytecode identity

A plain hash comparison is not sufficient for all contracts.

Solidity runtime artifacts contain:

- executable bytes;
- linked library reference ranges;
- immutable reference ranges whose values are inserted during construction; and
- a metadata trailer, which normally contains an IPFS hash of compiler metadata.

Solidity exposes link and immutable ranges in standard compiler output ([Solidity compiler JSON output](https://docs.soliditylang.org/en/latest/using-the-compiler.html#compiler-input-and-output-json-description)). Source paths, settings, and source changes can alter metadata and therefore runtime bytecode even when executable behavior is unchanged ([Solidity contract metadata](https://docs.soliditylang.org/en/latest/metadata.html)). The compiler also warns that post-compilation library linking does not update metadata ([Solidity library linking](https://docs.soliditylang.org/en/latest/using-the-compiler.html#library-linking)). This is directly relevant because `DeployGame` manually links artifact bytecode.

OpenZeppelin's UUPS base also has an immutable `__self = address(this)`. The current Shop artifact has three 32-byte references to that immutable. Therefore, a locally compiled runtime with unresolved immutable bytes cannot have the same full hash as an implementation deployed at an arbitrary address.

The comparer should classify a result instead of returning one boolean:

| Result               | Meaning                                                                                                           | Default action                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Exact match          | Full runtime bytes match after constructing expected bytes for the actual address and declared constructor values | No upgrade                                                                           |
| Build metadata drift | Executable bytes, links, and semantic immutable values match; only metadata differs                               | Report; no automatic upgrade                                                         |
| Library drift        | Executable template matches but one or more linked addresses differ from desired libraries                        | Upgrade implementation after library decision                                        |
| Immutable drift      | An immutable differs from its declared desired value                                                              | Upgrade, except validated UUPS `__self` must equal the actual implementation address |
| Executable drift     | Executable bytes differ outside declared link/immutable ranges                                                    | Upgrade candidate                                                                    |
| Unknown              | Artifact layout or constructor inputs cannot explain the difference                                               | Refuse automatic upgrade                                                             |

Do not blindly remove metadata, links, or immutables and call the result aligned. A normalized executable hash is useful for classification, but links and meaningful immutable values can change behavior and must be checked separately.

The build fingerprint in the plan should include the compiler version, optimizer settings, EVM version, source/build-info hashes, artifact fully qualified name, linked library addresses, immutable values, and full on-chain runtime hash.

### Upgrade safety and deployment

Bytecode identity answers “is different code active?” It does not answer “is this upgrade storage safe?”

Use OpenZeppelin Foundry Upgrades for the latter. Its API supplies implementation and beacon discovery, `validateUpgrade`, `prepareUpgrade`, and `upgradeProxy` ([OpenZeppelin Foundry Upgrades API](https://docs.openzeppelin.com/upgrades-plugins/foundry/api/upgrades)). Use `prepareUpgrade` to validate and deploy an implementation from the deployer EOA, then place `upgradeToAndCall` in the mandatory Safe proposal. The deployer must never call the proxy upgrade function directly.

Before adding any upgrade to the reconciler, follow this repository's upgrade policy:

1. copy the current contract to `contracts/old/` with a versioned name;
2. add `@custom:oz-upgrades-from` to the new implementation;
3. add or update its Foundry upgrade-safety test; and
4. make `validateUpgrade` pass before a plan can be applicable.

Do not add `implementationVersion()` solely for discovery. It is a manually maintained claim and can drift from code. It can be added later as a human release label, but slot discovery, segmented bytecode comparison, build fingerprints, and OpenZeppelin validation remain necessary.

## Configuration and data reconciliation

### Managed-resource contract

Each supported resource needs an explicit adapter with these responsibilities:

```text
loadDesired(profile) -> canonical records
readCurrent(block)    -> canonical records + evidence
diff(current, desired)-> add / update / remove / no-op
encode(diff)          -> dependency-ordered calls
verify(block)         -> managed postconditions
```

Comparison must use complete ABI-normalized values, stable key sorting, and explicit treatment of mutable fields. The adapter must declare one policy:

- `exact`: additions, updates, and removals are managed;
- `additive`: additions and updates are managed, unknown current keys are retained;
- `observe`: drift is reported but no calls are emitted; or
- `unmanaged`: the domain is excluded from the alignment claim.

Only `exact` and `additive` are needed in the first version. This policy boundary is also where future deployment-specific rules can fit. It should not be generalized into profile inheritance now.

### Shop is the correct tracer bullet

Canonical desired buyable items already live in [`scripts/data/shopItems.ts`](../scripts/data/shopItems.ts). [`contracts/Shop.sol`](../contracts/Shop.sol) has:

- `shopItems(uint16) -> uint256`, where zero means absence because add rejects zero prices;
- `tokenInfos(uint16)`, including the unsellable flag;
- owner-only `addBuyableItems`, `editItems`, and `removeItems`; and
- owner-only `addUnsellableItems` and `removeUnsellableItems`.

For every desired item ID, the existing per-ID getters are enough to calculate add, update, or no-op. Exact removal also
requires direct discovery of current IDs that are absent from desired state. `Shop.getShopItemStates(startTokenId,
endTokenId)` therefore returns configured prices and unsellable flags for a bounded page of the complete `uint16`
keyspace. Reconciliation reads all 64 pages at the pinned block. It does not depend on chain history, archive service
behavior, or an off-chain membership cache.

Removals must be displayed separately and require an explicit `--allow-removals`. Add limits for item count and aggregate value change. A wrong profile must not be able to silently remove a large set.

Do not reconcile `TokenInfo.allocationRemaining`, `price`, or `checkpointTimestamp`; these are runtime sale state. Reconcile only `unsellable` from that struct.

Shop is not fully introspectable:

- `_packPrices` has a setter but no getter, enumeration, or removal;
- the promotion discount, selling cutoff, brush distribution, dev address, supporter-pack token, and some linked addresses do not all have complete getters; and
- supporter-pack `amountRemaining` is user-consumed runtime state and must not be reset by configuration alignment.

Add narrow getters before those fields become managed. For supporter packs, first define which fields are configuration and which fields are inventory. Prefer bounded, domain-shaped reads over maintaining duplicate enumerable storage solely for reconciliation.

### Wider data capability

The fresh deployment seeds these domains from `scripts/data/*` through `prepareForgeDeployData.ts` and `_seedGame1/_seedGame2/_seedGame3`:

| Domain                | Current comparison capability                | Main gap before exact management                                          |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| Items                 | Per-ID reads and add/edit/remove             | Add complete key discovery; preserve supply/balances/first-mint state     |
| Quests                | Per-ID quest getter and add/edit/remove      | Add minimum-requirement and complete key reads                            |
| World actions/choices | Rich per-ID getters and choice mutations     | No action removal or complete key read                                    |
| Shop/unsellable       | Complete paginated state read and mutations  | Other Shop configuration lacks reads                                      |
| Clan tiers            | Per-ID getter and add/edit                   | No removal or complete key read                                           |
| Instant actions       | Per-key getter and add/edit/remove           | Add complete key discovery and verify getter covers full input            |
| Instant VRF actions   | Per-ID action/strategy getters and mutations | Add complete key discovery and compare all strategy/reward fields         |
| Passive actions       | Per-ID getter and add/edit                   | Rewards are not fully returned; no removal                                |
| Cosmetics             | Set/remove mutations                         | No configuration getter or complete key read; preserve equipped cosmetics |
| Avatars               | Setter                                       | No configuration getter, removal, or complete key read                    |
| XP threshold rewards  | Add/edit mutations                           | No raw getter, removal, or complete key read                              |
| Full attire bonuses   | Add mutation                                 | No raw getter, edit/remove, or complete key read                          |
| Daily/weekly rewards  | Setters and derived reward behavior          | No raw pool getter                                                        |
| Base pets             | Add/edit mutations                           | No base-data getter or removal; preserve minted pets                      |
| Base raids            | Add/edit mutations                           | No base-data getter or removal; preserve active raid state                |
| Black market          | Owner mutations                              | No configuration getters or complete key read                             |
| Global events         | Owner add operations                         | No configuration getter or complete key read                              |

This means the first CLI cannot truthfully claim that all repository data is aligned. It must report an inventory with each domain marked managed, observed, or unmanaged. Add domains one at a time after complete read semantics and safe deletion semantics are documented.

Prefer these remedies in order:

1. Existing complete, domain-shaped view getter.
2. Add a bounded paginated getter when the key type makes complete scanning practical.
3. Add direct on-chain enumeration when bounded reads are not practical.

Adding arrays or enumerable sets to every contract increases storage, mutation gas, upgrade work, and migration complexity. Use them only when a bounded direct getter cannot provide complete discovery.

## CLI behavior

### Commands

Use one command surface with explicit modes:

```text
# Build, inspect, plan, and simulate. No signer is required.
pnpm deployment:sync -- --deployment sonic-live

# Deploy required code and submit exactly a reviewed Safe proposal.
pnpm deployment:sync -- --deployment sonic-live \
  --apply --plan runs/sonic-live/<run-id>/plan.json

# Re-read chain state after an interruption and plan only the remainder.
pnpm deployment:sync -- --deployment sonic-live --resume <run-id>
```

The default must never broadcast, deploy code, or submit a Safe proposal.

Application has two ordered effects:

- broadcast any required library, implementation, or brand-new proxy creation transactions from the deployer; and
- create and submit a Safe proposal for every upgrade, wiring, ownership-controlled, or configuration call.

The generated Safe Transaction Builder-compatible payload is retained as an audit artifact, but an apply is not successful unless the proposal is submitted. There is no direct-owner execution mode and no EOA fallback. A deployment that only creates candidate code remains pending, not aligned.

### Plan contents

Pin the observation block number and hash. The machine-readable plan should contain:

- schema version, deployment ID, chain ID, network fingerprint, authority, and observation block;
- registry, source-data, artifact, build-info, compiler-setting, and git revision hashes;
- current implementation slots, runtime hashes, segmented comparison results, desired artifacts, and library links;
- each current and desired managed value;
- sorted add, update, and remove operations;
- target, value, calldata, caller, dependencies, estimated gas, and postcondition for every operation;
- upgrade validation evidence;
- destructive-operation flags and configured caps; and
- the hash of all immutable plan content.

Also render a short Markdown summary for human review. Do not put private keys, RPC credentials, or Safe API credentials in either artifact.

Refuse to apply when:

- the selected RPC has the wrong chain or fingerprint;
- code, proxy kind, owner, or beacon owner is unexpected;
- a plan input hash changed;
- the pinned plan is stale beyond the configured policy;
- bytecode classification is unknown;
- storage-layout validation failed;
- simulation failed;
- a removal is present without explicit permission;
- the tracked owner is not a Safe;
- the deployer attempts an authority-controlled call; or
- the Safe address or proposal sender does not match the plan.

### Simulation

Simulation has two levels:

1. Preflight each call with the exact sender and value using `eth_call`, and estimate it with `eth_estimateGas` ([Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/)).
2. Execute the full dependency-ordered plan on a fork pinned to the observation block. Use the deployer only for code creation and the tracked Safe as caller for every authority-controlled operation, then run all managed postconditions.

Foundry scripts simulate before broadcast by default. `forge script --resume` skips simulation and assumes unchanged nonces, so it should not be the reconciliation recovery model ([Foundry `forge script`](https://www.getfoundry.sh/reference/forge/script)). Re-read state and calculate the remaining desired-state difference instead.

### Apply and atomicity

Broadcast only code-creation transactions from the deployer account and wait for their receipts. Then encode every upgrade, wiring, and configuration call into a reviewed Safe payload and submit it as a Safe proposal. The reconciler must refuse a deployment whose managed contracts are owned by an EOA.

A brand-new proxy may be created by the deployer, but it must be initialized with the tracked Safe as owner. If an existing initializer can only assign `msg.sender`, the creation transaction must also transfer ownership to the Safe before it completes. Do not leave a deployer-owned proxy for a later reconciliation step.

Safe MultiSend executes its contained operations in one transaction and reverts when an operation fails ([Safe MultiSend source](https://github.com/safe-global/safe-smart-account/blob/main/contracts/libraries/MultiSend.sol)). Use one atomic batch for tightly coupled operations such as an upgrade plus its reinitializer. Split independent configuration work only at gas and risk boundaries.

The whole reconciliation may still span multiple transactions and is therefore not globally atomic. Every stage must be idempotent and declare dependencies. A deployed implementation that is not approved by the Safe is harmless partial progress and should be recorded for reuse rather than deployed again blindly.

Applying creates and submits a proposal; it does not make the deployment aligned until the Safe threshold executes it. The next read-only run should report pending, executed, failed, and remaining operations separately.

### Resumability and audit

Recovery must be state based:

1. journal the intended transaction or Safe payload before submission;
2. after an unknown outcome, query transaction receipts and Safe state;
3. re-read managed chain state;
4. regenerate only remaining operations; and
5. simulate the new remainder before sending it.

Preserve the plan, summary, traces, upgrade-validation output, Foundry broadcast artifacts, Safe payload/hash/nonce, transaction hashes and receipts, and final postcondition report. The final report should include the empty second-plan result.

## Implementation plan

### Phase 1: tracked registry and loader

Status: implemented on 2026-09-01.

1. Define and validate the versioned deployment schema.
2. Add tracked Sonic live and beta files from `contractAddresses.ts`.
3. Determine and review deployment blocks, Safe owner addresses, and network fingerprints.
4. Add one selector that requires an explicit deployment ID.
5. Make `contractAddresses.ts` load a selected registry file during migration, preserving legacy exports.
6. Generate README address tables from the registry or replace the duplicated lists with registry links.

Acceptance:

- live and beta can be selected independently on chain 146;
- a wrong RPC, no-code address, or non-Safe owner fails before any operation is prepared; and
- existing Hardhat scripts still receive the same addresses.

The tracked records use the verified Sonic genesis hash, deployment start blocks 1,375,466 (live) and 1,241,080 (beta), and Safe `0xC7073F6317813C3EDB09FA2d19A6cA259A9d4aD9`. A Foundry validation script confirmed code at every tracked contract and external address. It also found one intentional hard failure in both existing deployments: `DailyRewardsScheduler.owner()` is legacy EOA `0x316342122A9ae36de41B231260579b92F4C8Be7f`, not the tracked Safe. This is recorded as alignment drift, not as an accepted authority override. Until ownership is transferred, full registry validation correctly exits with an error for both deployment IDs. Logical contract identity and implementation matching remain Phase 2 work; Phase 1 does not claim that swapping two valid Safe-owned UUPS addresses is detectable.

### Phase 2: read-only inventory and plan format

Status: implemented on 2026-09-01.

1. Extract shared proxy/beacon slot constants and checks from `VerifyDeployment` where practical.
2. Inventory all stable contracts, externals, proxy implementations, beacon implementations, owners, code sizes, and code hashes.
3. Parse Foundry artifacts and build-info into segmented implementation fingerprints.
4. Cross-check the legacy OpenZeppelin manifest without treating it as authority.
5. Emit hashable JSON and readable Markdown plans.
6. Add explicit managed/observed/unmanaged domain reporting.

Acceptance:

- inventory is deterministic at a pinned block;
- both Sonic deployments produce separate reports; and
- implementation mismatches are classified, never collapsed into a false upgrade decision.

`pnpm deployment:sync -- --deployment sonic-live` now pins an observation block and writes a hashable JSON plan plus a Markdown report under `runs/<deployment-id>/`. It inventories every stable and external address, discovers UUPS and beacon implementations, validates UUPS UUIDs and Safe ownership, fingerprints Foundry artifacts and build info, classifies segmented runtime differences, and treats the legacy OpenZeppelin manifest as a warning-only cross-check. Configuration domains remain explicitly unmanaged until their later phases. The command is read-only and exits with status 2 when the report contains alignment errors, including the known `DailyRewardsScheduler` owner drift.

### Phase 3: Shop read-only tracer bullet

Status: implemented on 2026-09-01.

1. Refactor canonical data preparation so fresh deploy and reconciliation consume the same Shop data function.
2. Read all desired Shop prices and unsellable flags.
3. Add and consume a paginated contract getter over the bounded `uint16` keyspace.
4. Produce stable add/update/remove/no-op sets.
5. Exclude runtime `TokenInfo` fields.
6. Add removal permission and change caps.
7. Simulate generated calls on a pinned fork and verify every managed item afterward.

Acceptance:

- a fixture with missing, changed, stale, and unchanged records produces the exact four classifications;
- applying on Anvil and planning again gives an empty Shop plan;
- rerunning after each partial batch emits only remaining changes; and
- wrong-profile removal volume is blocked.

The Shop adapter now shares `getShopData(profile)` with fresh deployment preparation. It discovers buyable and
unsellable membership through paginated `getShopItemStates` calls over the complete `uint16` keyspace and reads only
buyable price and the `unsellable` flag. Plans contain stable add, update, remove,
and no-op classifications plus dependency-ordered calldata. Removals require `--allow-removals`; defaults cap a plan at
100 changed IDs, 10 removals, and 10,000 BRUSH of aggregate price movement. These defaults can be overridden with
`--max-shop-changes`, `--max-shop-removals`, and `--max-shop-value-change` (wei). Unblocked operations are preflighted
at the observation block, executed from the tracked Safe on an ephemeral Anvil fork pinned to that block, and followed
by verification of every managed ID. The command remains read-only by default. Phase 4 adds reviewed-plan apply and
state-based resume modes.

Existing Shop proxies must be upgraded to the implementation that exposes `getShopItemStates` before Phase 3 can inspect
them. The reconciler fails closed when this direct read is unavailable; it does not fall back to chain-history reconstruction.

### Phase 4: Safe proposal execution

Status: Safe proposal execution is implemented on 2026-09-02 for managed Shop operations. The code-creation part remains
blocked on Phase 5 producing validated library and implementation candidates, so the creation acceptance case is not yet
implemented.

1. Add Foundry broadcasts only for deployer-funded library, implementation, and new-proxy creation.
2. Generate Safe Transaction Builder JSON for all authority-controlled calls.
3. Submit the proposal through the existing Safe SDK pattern as part of apply.
4. Reject EOA-owned managed contracts and any direct authority-controlled broadcast.
5. Add journaling, receipt checks, pending Safe detection, state-based resume, and final verification.
6. Group atomic dependencies and split independent batches by gas/risk limits.

Acceptance:

- creation transactions can be sent by the deployer without granting it contract authority;
- Safe simulation uses the Safe as caller;
- generated Safe calldata matches the simulated calldata byte for byte; and
- apply submits the reviewed proposal and records its Safe transaction hash and nonce.

Read-only plans now retain deterministic Safe Transaction Builder JSON files generated from the same generic operation
envelope used by fork simulation. The reviewed plan hash covers the Safe operation-count and aggregate-gas batch limits;
defaults are 20 operations and 8,000,000 estimated gas, configurable with `--max-safe-operations` and `--max-safe-gas`.
Dependency-connected operations stay in one atomic batch, while independent groups split at those limits. Destructive
dependency groups are isolated from independent changes as a fixed risk boundary.

Apply uses `--apply --plan <path>`. It verifies the stored plan hash, reconstructs the plan at its pinned block, checks a
3,600-block default staleness limit, re-reads latest state, and refuses submission if the authority, inputs, or operation
calldata changed. Every authority operation must name the tracked Safe as caller. The proposer key must belong to a
tracked Safe owner. There is no direct owner broadcast path. Proposal journals are written before submission and then
record nonce, Safe transaction hash, service status, execution transaction hash, and the validated RPC receipt. An unknown
service failure is not retried; a prepared proposal is retried only after the service confirms that its Safe transaction
hash is absent.

`--resume <run-id>` refreshes each journal from the Safe service, reports pending, executed, failed, and unproposed
remaining work, and writes a new remainder plan from current state. Once every proposal executed, it requires an empty
managed plan and stores the final verification report. Partial execution is resumed by reviewing and applying the newly
generated current-state plan; old calls are never broadcast directly.

### Phase 5: implementation upgrades

1. Establish archived reference contracts and Foundry validation tests according to `AGENTS.md`.
2. Implement segmented bytecode comparison, including linked library and immutable checks.
3. Build the library dependency graph so linked implementations are upgraded only after their desired libraries are known.
4. Use `validateUpgrade` in planning and `prepareUpgrade` in apply.
5. Encode UUPS `upgradeToAndCall` and beacon upgrades only for the tracked Safe.
6. Record candidate implementation addresses and reuse successful partial deployments.
7. Simulate upgrades and reinitializers together and rerun all ownership, wiring, and managed-data checks.

Acceptance:

- identical executable code produces no implementation deployment;
- metadata-only drift is reported but does not automatically upgrade;
- linked-library and executable drift produce validated upgrade operations;
- an unknown comparison or failed storage check blocks apply; and
- the second plan after execution contains no upgrade operation.

### Phase 6: expand managed resources

For each data domain:

1. document managed keys and fields;
2. identify mutable fields to preserve;
3. prove complete current-state discovery;
4. add missing direct getters when required;
5. define deletion semantics and dependencies;
6. add diff, fork simulation, partial-resume, and second-plan-empty tests; and
7. only then retire the equivalent one-off Hardhat scripts.

Good next candidates are Items, World action choices, Instant actions, and Quests after minimum-requirement reads are available. Supporter packs, passive actions, avatars, rewards, pets, raids, and domains without deletion semantics should remain observed or unmanaged until their contracts are suitable.

## Contract changes likely to be useful

The Shop tracer bullet adds `getShopItemStates` for complete paginated discovery. Later work is likely to need:

- a quest minimum-requirements getter;
- raw configuration getters for rewards, passive action rewards, base pets, base raids, cosmetics, avatars, and XP threshold rewards;
- Shop getters for scalar configuration and supporter-pack configuration;
- explicit removal methods only where product semantics allow deletion.

Do not expose private storage wholesale. Add domain-shaped read methods that return only configuration. Do not return or overwrite player state, consumed inventory, checkpoints, pending randomness, balances, or supply.

Every contract upgrade needed for introspection must follow the archive, annotation, and upgrade-test process in `AGENTS.md`. Batch introspection with a normal contract upgrade when possible; do not mass-upgrade production only to make the first CLI complete.

## Decisions needed for later phases

Phase 1 established the deployment blocks, Sonic network fingerprint, and intended Safe. Later phases still need these product decisions:

1. maximum removal and value-change caps;
2. maximum Safe batch gas or operation count; and
3. the first managed scope beyond Shop.

The recommended defaults are complete direct contract reads, mandatory Safe proposal submission on apply, metadata-only bytecode drift as a warning, and no implementation-version rollout.

## Primary external references

- [ERC-1967: proxy storage slots](https://eips.ethereum.org/EIPS/eip-1967)
- [Ethereum JSON-RPC methods](https://ethereum.org/developers/docs/apis/json-rpc/)
- [OpenZeppelin Upgrades network files](https://docs.openzeppelin.com/upgrades-plugins/network-files)
- [OpenZeppelin Hardhat Upgrades API](https://docs.openzeppelin.com/upgrades-plugins/api-hardhat-upgrades)
- [OpenZeppelin Foundry Upgrades API](https://docs.openzeppelin.com/upgrades-plugins/foundry/api/upgrades)
- [Solidity contract metadata](https://docs.soliditylang.org/en/latest/metadata.html)
- [Solidity compiler input and output JSON](https://docs.soliditylang.org/en/latest/using-the-compiler.html#compiler-input-and-output-json-description)
- [Solidity library linking](https://docs.soliditylang.org/en/latest/using-the-compiler.html#library-linking)
- [Foundry `forge script`](https://www.getfoundry.sh/reference/forge/script)
- [Safe MultiSend implementation](https://github.com/safe-global/safe-smart-account/blob/main/contracts/libraries/MultiSend.sol)
