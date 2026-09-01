# Estfor Kingdom contracts

![EK_logomark-light_shadow_4K](https://github.com/user-attachments/assets/053d8e67-7e83-41ba-98cd-88d0b4bc3908)

[![Continuous integration](https://github.com/PaintSwap/estfor-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/PaintSwap/estfor-contracts/actions/workflows/ci.yml)

All the smart contract code for the Estfor Kingdom MMORPG game on the Sonic Blockchain.

Make sure `pnpm` is installed (or replace with equivalent npm instructions).

These contracts use Hardhat and require Solidity 0.8.20 at minimum.

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

Tracked deployment addresses and metadata have one source of truth:

- [Sonic mainnet](deployments/146/sonic-live.json)
- [Sonic mainnet beta](deployments/146/sonic-beta.json)

Select an existing deployment explicitly and validate its addresses against Sonic:

```shell
DEPLOYMENT_ID=sonic-live pnpm deployment:validate
```

The command requires `RPC_URL` or `SONIC_RPC`.

### Obtain Safe API key

[Safe Developer Portal](https://developer.safe.global/api-keys)
