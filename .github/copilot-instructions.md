# Estfor Contracts AI Guide

- Game contracts for Estfor Kingdom on Sonic; Hardhat + Solidity 0.8.28 with multiple compiler profiles and per-file overrides for gas/size ([hardhat.config.ts](hardhat.config.ts)).
- Upgradeable first: most contracts are UUPS proxies; constructors disable initializers and `initialize` wires dependencies and beta flags.
- Core orchestrator `Players` delegates logic into impl contracts (queue/process/rewards/misc) via manual `delegatecall`; it coordinates Player NFTs, Item NFTs, Pets, WorldActions, Quests, Clans, WishingWell, RandomnessBeacon, and activity points ([contracts/Players/Players.sol](contracts/Players/Players.sol)).
- Actions and rewards registry lives in `WorldActions`; owners can add/edit actions, choices, and combat stats with tight validation using `SkillLibrary` and `EstforLibrary` ([contracts/WorldActions.sol](contracts/WorldActions.sol)).
- Items are ERC1155 upgradeable; admin/beta-gated minters, optional non-transferable items enforced via bank checks, and transfer hooks call back into `Players` to sync state ([contracts/ItemNFT.sol](contracts/ItemNFT.sol)).
- Shared constants/enums/structs come from `contracts/globals/all.sol` plus `@paintswap/estfor-definitions`; prefer reusing these instead of redefining magic numbers.
- Source layout: feature folders under `contracts/` (Clans, Bazaar, ActivityPoints, Players, globals) with libraries/helpers alongside their feature; keep new modules co-located.
- ABI exports and storage layouts are generated on compile to `data/abi`; contract sizer, storage layout, and gas reporter run during builds ([hardhat.config.ts](hardhat.config.ts)).
- Package uses pnpm; primary workflows in [README.md](README.md): `pnpm install`, `pnpm compile`, `pnpm test` (Hardhat network), `pnpm deploy`, `pnpm verifyContracts` (runs [scripts/verifyContracts.ts](scripts/verifyContracts.ts)), `pnpm umlStorage` for storage slot diagrams.
- Numerous game maintenance scripts under `scripts/` are mapped to `pnpm` commands (add/edit items/actions/quests/terrains, set URIs, gas limits, donations, MMR, etc.); check [package.json](package.json) before adding duplicates.
- Networks: `hardhat` can fork Sonic when `USE_HARDHAT_FORK=true` with `SONIC_RPC` + optional `FORK_BLOCK_NUMBER`; `USE_PRIVATE_KEY=true` uses provided keys for local accounts; live networks `sonic`, `sonic-blaze`, and `fantom` require `PRIVATE_KEY`, `PRIVATE_KEY1`, `PROPOSER_PRIVATE_KEY` env vars (see [hardhat.config.ts](hardhat.config.ts)).
- Verification uses Etherscan-style API with custom Sonic chain config; set `ETHERSCAN_API_KEY` even for sonicscan.
- Tests use Mocha/Chai via Hardhat toolbox with 240s timeout; gas reporter is on by default—disable in config if logs too noisy.
- Coding patterns: favor `initializer` instead of constructors, keep storage layout stable for proxies, respect optimizer run overrides per contract, and reuse delegatecall interfaces in `contracts/interfaces/` when extending Players.
- Non-transferable items: only banks created via `IBankFactory` can move them; Player transfer hooks clear boosts/quests and may lock players when recipient holds boost items ([contracts/ItemNFT.sol](contracts/ItemNFT.sol), [contracts/Players/Players.sol](contracts/Players/Players.sol)).
- World actions: action IDs must be non-zero and unique; rates must divide 3600, and non-combat actions cannot mix guaranteed+random rewards when choices are required ([contracts/WorldActions.sol](contracts/WorldActions.sol)).
- Upgrades/storage safety: storageLayout output is enabled; run `pnpm compile` before migrations and prefer adding new slots at tail. Contract sizer excludes tests/openzeppelin/layerzero.
- Generated types target ethers v6 (`typechain`); import from `typechain-types` in scripts/tests.
- Precommit: `pnpm precommit` (pretty-quick) and `pnpm prettier` target contracts and scripts. Lint with `pnpm lint` (solhint) for `contracts/*`.
- ABIs for external LayerZero test devtools are wired via `external.contracts` in Hardhat config; local deployments auto-pick them during tests.
- Use custom errors in require checks for gas efficiency. Do NOT use `string` messages in `revert` or `require`. Do NOT use `assert` for input validation. Do NOT use `revert`, instead use `require` with custom errors.
- Do NOT add getter functions for mappings or arrays. Instead, emit events when data is added/updated and read data off-chain via events or direct storage reads. Contract size is more important than on-chain convenience functions.
- Always follow Checks-Effects-Interactions pattern to prevent reentrancy issues. Update contract state before making any external calls.
- Contract owners are expected to be Gnosis Safe multisigs. There are some scripts that may still use single EOA accounts as they haven't been updated yet. For new scripts, prefer the proposal pattern using `prepareUpgrade` and use the util function `sendTransactionSetToSafe` in `scripts/utils.ts`.
- Use openzeppelin libraries for common functionalities like ERC standards, access control, upgradeability, and security features. Avoid reinventing the wheel.
- Use `pnpm test <file>` to run specific test files during development for faster feedback.
- Do not use `pnpm hardhat test <file>` as it forces a full recompile which slows down the workflow.

If anything here feels off or incomplete, tell me what to clarify or expand.
