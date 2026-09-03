Hardhat dependencies are legacy packages.

Foundry toolchain is the new standard for testing, deploying, and interacting with Ethereum smart contracts for this project. Contracts should be Brio hardfork compatible on the Sonic chain (48kb contract size with 96kb init).

When upgrading a contract firstly copy the existing contract code to contracts/old/, update the archived contract name to a new version, and then update the contract code with an annotation reference to the old contract:

```solidity
// contracts/old/PlayerNFTv1.sol
contract PlayerNFTv1 is UUPSUpgradeable, OwnableUpgradeable, SamWitchERC1155UpgradeableSinglePerToken, IMarketplaceNFT, IPlayerNFT {

// contracts/PlayerNFT.sol
// New version of PlayerNFT (contract name remains the same)
/// @custom:oz-upgrades-from PlayerNFTv1
contract PlayerNFT is UUPSUpgradeable, OwnableUpgradeable, SamWitchERC1155UpgradeableSinglePerToken, IMarketplaceNFT, IPlayerNFT {
```

After updating the contract code, add an Upgrade test to ensure the upgrade works as expected:

```solidity
// test/UpgradeSafety.t.sol
import {UpgradeSafetyTestBase} from "./utils/UpgradeSafetyTestBase.sol";

contract UpgradeSafetyTest is UpgradeSafetyTestBase {
  function testPlayerNFTUpgradeSafe() public {
    _validateUpgrade("contracts/PlayerNFT.sol:PlayerNFT");
  }
}
```

If the test already exists, add one `_validateUpgrade` call for the upgraded contract. The contract's `@custom:oz-upgrades-from` annotation identifies the archived reference contract.

A custom Paintswap OZ fork is used specifically to add "memory-safe" assembly markers to v5.1 contracts. This works around a stack-too-deep compilation issue in Arrays.sol. Upstream OZ contracts have not yet marked their assembly blocks as memory-safe so this fork is needed to work around the issue.

Ensure that the foundry test suite and scripts do not directly reference contracts that require IR compilation. Instead use indirect interfaces for exact error and event signatures.

Study how established products solve the problem before designing a solution. Adopt their proven patterns and conventions rather than inventing an approach from scratch.

Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.

Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.

Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.

Keep components modular and concerns clearly separated.

Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.

Write instructions and documentation using principles from ASD-STE100
(Simplified Technical English):

- Use short, direct sentences.
- Use one instruction per sentence where practical.
- Use consistent terminology. Do not use synonyms for defined concepts.
- Prefer active voice.
- Make requirements explicit.
- Avoid ambiguous pronouns and references.
- Avoid unnecessary words and idioms.
- Use MUST, SHOULD, and MAY consistently for requirement strength.

Do not enforce the ASD-STE100 controlled vocabulary. Prefer established
software-engineering terminology where it is clearer.
