# Deployment reconciliation

Use one command to inspect and manage an existing deployment:

```text
pnpm deployment:sync -- --deployment <deployment-id>
```

The command loads `.env` before it reads configuration.

## Modes

| Mode                    | Purpose                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| No mode option          | Refresh tracked chain state, create a plan, and simulate it. This mode does not send transactions. |
| `--apply --plan <path>` | Validate a reviewed plan, deploy required code, and submit Safe proposals.                         |
| `--resume <run-id>`     | Read transaction and Safe status, then create a plan for unproposed work.                          |

Use `--allow-removals` to permit planned removals. Limit options reject plans that contain too many changes or too much value change.

## Environment

| Variable                 | Use                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `RPC_URL` or `SONIC_RPC` | Read chain state and create the simulation fork.                                                                                              |
| `PROPOSER_PRIVATE_KEY`   | Derive candidate addresses, deploy code, and sign Safe proposals. A read-only plan needs this key only when it contains an upgrade candidate. |
| `SAFE_API_KEY`           | Submit or read Safe proposals during apply and resume modes.                                                                                  |

Do not put secrets in a plan or a tracked deployment file.

## Replacing linked libraries

A library address is embedded in the bytecode of every implementation that uses it. When a library differs from the desired
artifact, planning automatically assigns its future CREATE address from the proposer nonce, compiles dependent candidates
with that address, and records the complete deployment order in the plan. The operator does not declare candidate addresses
in the deployment registry.

Keep `PROPOSER_PRIVATE_KEY` set to the account that will deploy the reviewed candidates. Do not use this account for other
transactions between planning and apply because each transaction changes its nonce and predicted addresses. If its nonce
changes, discard the old plan and generate a new one.

Apply deploys libraries first, then standalone Players delegates and upgradeable implementations. It submits the generated
`Players.setImpls(...)`, UUPS, and beacon calls to the Safe only after every candidate deployment is verified. After the Safe
executes the proposals, use `--resume <run-id>` and verify that the managed plan is empty. Update stable registry addresses
from the verified final plan in a separate registry-only change.

## Reinitializers

For a UUPS contract with a reinitializer, the contract's `reinitializer` object separates observed state from desired intent:

- `onchainVersion` is the OpenZeppelin initialized version read from the proxy.
- `targetVersion` and `callData` are the reviewed reinitializer intent for the next implementation upgrade.

Before it builds or rebuilds a plan, reconciliation uses Foundry `cast` commands to read the latest initialized-version
storage and update `onchainVersion` in the tracked deployment file. An upgrade includes `callData` only when
`onchainVersion` is lower than `targetVersion`. Equal or higher on-chain versions omit the calldata and do not block
reconciliation. This makes a rerun refresh stale registry state without associating old calldata with a newer on-chain
version. When `--block` or a reviewed plan selects a historical block, reconciliation uses a separate non-writing observation
for that plan; historical data never overwrites the latest tracked state.

## Main files

| File                                 | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `deploymentSync.ts`                  | Own the command workflow and mode selection.                |
| `deploymentRegistry.ts`              | Load, refresh, and validate tracked deployment state.       |
| `deploymentInventory.ts`             | Read chain state and create the deployment plan.            |
| `deploymentArtifacts.ts`             | Compare deployed bytecode with Foundry artifacts.           |
| `deploymentSimulation.ts`            | Execute the complete plan on a pinned Anvil fork.           |
| `deploymentWiring.ts`                | Check required contract links and roles.                    |
| `shopReconciliation.ts`              | Compare and encode managed Shop data.                       |
| `upgradeReconciliation.ts`           | Validate and prepare implementation and library candidates. |
| `safeReconciliation.ts`              | Build, submit, and inspect Safe proposal batches.           |
| `reconciliation.ts`                  | Define the shared operation and limit types.                |
| `ReconciliationCodeDeployment.s.sol` | Deploy validated candidate code through Foundry.            |

The `deploy-foundry.sh` and `DeployGame.s.sol` files create a new deployment. They are not modes of existing-deployment reconciliation.

## Outputs

Plan mode writes review files under `runs/<deployment-id>/<run-id>/`:

- `plan.json` is the hashed machine-readable plan.
- `plan.md` is the review summary.
- `safe-transaction-builder-*.json` contains Safe calls.

Apply validates `plan.json` and checks that its derived Markdown and Transaction Builder files are unchanged. It does not
rewrite the review files. Apply adds only durable execution evidence to the same run directory:

- candidate and Safe proposal journals bind each submitted transaction to the reviewed plan before submission;
- candidate Forge logs retain command diagnostics.

Foundry still creates its own broadcast record while it sends a candidate, but reconciliation places that duplicate data in
a temporary system directory and removes it after the command. The journal is the durable transaction record; the append-only
Forge log is retained for diagnostics.

Resume updates the journals and writes immutable `remainder-plan-<hash>.json`, `remainder-plan-<hash>.md`, and derived Safe
Transaction Builder files from current chain state. The hash suffix preserves each reviewed remainder when the run needs
more than one apply/resume cycle. When all reviewed proposals have executed, the empty remainder plan is also the final
verification record; no duplicate final plan is written.

Candidate journals record the block before each Foundry broadcast. If apply is interrupted after broadcast, the next run
uses historical deployer nonces to locate the transaction's block, then verifies its nonce, creation-code hash, receipt, and
deployed address. This logarithmic lookup also identifies failed deployment transactions. Existing code alone is not
accepted as evidence of a reviewed deployment.

Current Safe journals are bound to their immutable plan and derived batch. For runs created by older versions that overwrote
those plan files, resume accepts the old `safe-proposal-<batch>.json` and `safe-proposal-<plan-hash>-<batch>.json` names. It
checks the filename against the journal and re-derives the Safe transaction hash from the recorded calls and nonce before it
reads execution status.

Normal Foundry output stays in `out/` and `cache-foundry/`. Reconciliation keeps its one address-linked candidate build
under `cache-foundry/reconciliation/`; it does not use `.deployments/`, which belongs to fresh deployment workflows.
Old `reconciliation-artifacts/` and `upgrade-preparation/` trees under `.deployments/` are disposable compiler output from
earlier versions of this command. They can be removed when no older reconciliation process is running.

The command can also update `onchainVersion` values in `deployments/<chain-id>/<deployment-id>.json` before writing a plan.

An apply is not complete until the Safe executes all proposals and a new plan has no managed operations.
