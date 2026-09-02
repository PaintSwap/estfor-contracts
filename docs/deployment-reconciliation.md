# Deployment reconciliation

Use one command to inspect and manage an existing deployment:

```text
pnpm deployment:sync -- --deployment <deployment-id>
```

The command loads `.env` before it reads configuration.

## Modes

| Mode                    | Purpose                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------- |
| No mode option          | Read chain state, create a plan, and simulate it. This mode does not send transactions. |
| `--apply --plan <path>` | Validate a reviewed plan, deploy required code, and submit Safe proposals.              |
| `--resume <run-id>`     | Read transaction and Safe status, then create a plan for unproposed work.               |

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

## Main files

| File                                 | Purpose                                                      |
| ------------------------------------ | ------------------------------------------------------------ |
| `deploymentSync.ts`                  | Own the command workflow and mode selection.                 |
| `deploymentRegistry.ts`              | Load and validate tracked deployment identity and addresses. |
| `deploymentInventory.ts`             | Read chain state and create the deployment plan.             |
| `deploymentArtifacts.ts`             | Compare deployed bytecode with Foundry artifacts.            |
| `deploymentSimulation.ts`            | Execute the complete plan on a pinned Anvil fork.            |
| `deploymentWiring.ts`                | Check required contract links and roles.                     |
| `shopReconciliation.ts`              | Compare and encode managed Shop data.                        |
| `upgradeReconciliation.ts`           | Validate and prepare implementation and library candidates.  |
| `safeReconciliation.ts`              | Build, submit, and inspect Safe proposal batches.            |
| `reconciliation.ts`                  | Define the shared operation and limit types.                 |
| `ReconciliationCodeDeployment.s.sol` | Deploy validated candidate code through Foundry.             |

The `deploy-foundry.sh` and `DeployGame.s.sol` files create a new deployment. They are not modes of existing-deployment reconciliation.

## Outputs

Each run writes files under `runs/<deployment-id>/<run-id>/`:

- `plan.json` is the hashed machine-readable plan.
- `plan.md` is the review summary.
- `safe-transaction-builder-*.json` contains Safe calls.
- proposal and deployment journals record submitted work.
- `remainder-plan.*` contains only work that is not already pending.

An apply is not complete until the Safe executes all proposals and a new plan has no managed operations.
