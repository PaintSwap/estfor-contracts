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
// test-foundry/UpgradeSafety.t.sol
import {Test} from "forge-std/Test.sol";
import {Upgrades, Options} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract UpgradeSafetyTest is Test {
    function testPlayerNFTUpgradeSafe() public {
        Options memory opts;
        Upgrades.validateUpgrade("contracts/PlayerNFT.sol", opts);
    }
}
```

If the test already exists then just update the reference contract path to point to the old contract.
