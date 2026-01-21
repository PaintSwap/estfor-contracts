---
applyTo: "contracts/Session/*.sol"
---

# Estfor Account Abstraction AI Guide

- Aim of the Session module is to abstract Web3 accounts away so that any user with an email and a passkey can sign transactions without paying for gas or require signing multiple transactions. The architecture for achieving this is as follows:

1. User registers with an email and passkey
2. A 2 of 3 multi-sig Safe is created where 1 signer is the user passkey, 1 signer is a recovery DAO owned multi-sig Safe, 1 signer is a hot DAO owned EOA that exists to execute and sign transactions on behalf of the user to subsidise the gas cost.
3. User authenticates with their passkey to create a new session - `UsageBasedSessionModule.enableSession` ([contracts/Session/UsageBasedSessionModule.sol](contracts/Session/UsageBasedSessionModule.sol)). The session key passed is a temporary throwaway private key stored in the users browser/device for the duration set.
4. User uses their session private key to sign game transactions, then passes the arguments via an api to the hot DAO EOA signer that will call `UsageBasedSessionModule.execute`, and thus the designated game action.

- The `UsageBasedSessionModule` contains the logic to restrict overuse and needless gas expense via the subsidised mechanism.
- `GameRegistry` ([contracts/Session/GameRegistry.sol](contracts/Session/GameRegistry.sol)) contract contains all valid game actions that can be subsidised by the session module.
- Safe module documentation can be found at https://docs.safe.global/advanced/smart-account-modules
