# Tooling and deployment target

- Use Foundry for Solidity compilation and testing. Use it as the default contract-facing engine for new deployment and interaction workflows.
- Existing Hardhat scripts are supported legacy code. Modify them when a task requires it, but do not add a new Hardhat workflow unless requested.
- Sonic deployments must satisfy the Brio limits: deployed runtime bytecode must not exceed 49,152 bytes, and init bytecode must not exceed 98,304 bytes.
- Run only one Forge or Hardhat process at a time, including package scripts that invoke them.

# Multiple compiler profiles

- Sources listed under `compilation_restrictions` in `foundry.toml` require IR compilation.
- Foundry tests and Solidity scripts must not import those implementation sources. Load the compiled artifact and interact through an interface that declares the exact functions, errors, and events in use.
- When testing an IR-only implementation, follow the `:via-ir` artifact pattern in `test/utils/EstforTest.sol` and `test/utils/FullGameStack.sol`.

# Upgradeable implementations

When changing an existing UUPS or beacon implementation:

1. Before editing it, copy the current implementation to `contracts/old/<Name>V<N>.sol`. Use the next available archive version for `N`.
2. Rename the archived contract declaration to `<Name>V<N>` and keep the archive compilable by correcting its relative imports.
3. If the change affects an imported definition that contributes to storage layout, preserve the old definition under `contracts/old/dependencies/` and import it from the archive.
4. Add `/// @custom:oz-upgrades-from <Name>V<N>` to the current implementation.
5. Ensure `test/UpgradeSafety.t.sol` contains one validation test for the current implementation. Add a test only when one does not already exist.
6. Run `forge clean` before the targeted upgrade-safety test, then run the relevant behavioral tests.

Do not modify an established archive version unless correcting that archive is the task.

# OpenZeppelin dependencies

Keep `@openzeppelin/contracts` and `@openzeppelin/contracts-upgradeable` linked to the PaintSwap v5.1 memory-safe forks in this workspace. Replacing them with upstream packages can reintroduce the `Arrays.sol` stack-too-deep failure. Change these dependencies only when the task explicitly requires a migration.

# Design

- Follow repository patterns for routine changes. For new architecture or an unfamiliar integration without local precedent, review relevant established implementations before choosing a design.
- Choose the simplest complete design that fits the existing architecture. Before adding a package or a local implementation, check the documentation and types of current dependencies.
- Build large changes as working end-to-end increments. Each increment must fit the intended final architecture; do not add a known disposable stopgap unless requested.

# Documentation

- Write instructions and documentation in plain technical English inspired by ASD-STE100.
- Use short, active sentences with one requirement per sentence where practical. Use established terms consistently and make requirement strength explicit.
- Use `MUST`, `SHOULD`, and `MAY` only for normative requirements. Do not enforce the ASD-STE100 controlled vocabulary when standard software terminology is clearer.
