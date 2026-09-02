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

Do not run forge/hardhat commands in parallel as they may interfere with each other. Run all forge/hardhat commands sequentially.
