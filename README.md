# Estfor Kingdom contracts

![EK_logomark-light_shadow_4K](https://github.com/user-attachments/assets/053d8e67-7e83-41ba-98cd-88d0b4bc3908)

[![Continuous integration](https://github.com/PaintSwap/estfor-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/PaintSwap/estfor-contracts/actions/workflows/ci.yml)

All the smart contract code for the Estfor Kingdom MMORPG game on the Sonic Blockchain.

Make sure `pnpm` is installed (or replace with equivalent npm instructions)

These contracts use hardhat and require solidity 0.8.20 at minimum.

Install dependencies:

```shell
pnpm install
```

To compile:

```shell
pnpm compile
```

To run the tests:

```shell
pnpm test
```

To deploy the contracts:

```shell
pnpm deploy
```

To verify the contracts on ftmscan:

```shell
pnpm verifyContracts
```

To check storage slot packing of the test file:

```shell
pnpm umlStorage
```

## Existing deployments

Use `deployment:sync` to inspect or change a tracked deployment. The command loads `.env` automatically.

Create and simulate a read-only plan:

```shell
pnpm deployment:sync -- --deployment sonic-live
```

Apply a reviewed plan:

```shell
pnpm deployment:sync -- --deployment sonic-live --apply --plan runs/sonic-live/<run-id>/plan.json
```

Resume after an interruption:

```shell
pnpm deployment:sync -- --deployment sonic-live --resume <run-id>
```

The command requires `RPC_URL` or `SONIC_RPC`. Upgrade plans and apply operations use `PROPOSER_PRIVATE_KEY`. Safe apply and resume operations use `SAFE_API_KEY`.

See the [deployment reconciliation operator guide](docs/deployment-reconciliation.md) for the command modes, files, and outputs. Tracked addresses are in [Sonic live](deployments/146/sonic-live.json) and [Sonic beta](deployments/146/sonic-beta.json).
