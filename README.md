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

### Sonic mainnet deployed contract addresses:

Bridge [0x551944b340a17f277a97773355f463beefea7901](https://sonicscan.org/address/0x551944b340a17f277a97773355f463beefea7901)  
WorldActions [0x9e1275dd55e9623dc8f1673fc3c94cf1176a2816](https://sonicscan.org/address/0x9e1275dd55e9623dc8f1673fc3c94cf1176a2816)  
RandomnessBeacon [0x9b4ba31bf6031d9304c5d4487c3b30d58cef49a3](https://sonicscan.org/address/0x9b4ba31bf6031d9304c5d4487c3b30d58cef49a3)  
DailyRewardsScheduler [0x56ddffd7126b55883b603c4c5f33c639dfa424bc](https://sonicscan.org/address/0x56ddffd7126b55883b603c4c5f33c639dfa424bc)  
Treasury [0x50b64112cc5af4ff4f8e079143c5b19decddaf03](https://sonicscan.org/address/0x50b64112cc5af4ff4f8e079143c5b19decddaf03)  
Shop [0x80b78e431b6e52027debe297cd8ba614820a2f1b](https://sonicscan.org/address/0x80b78e431b6e52027debe297cd8ba614820a2f1b)  
RoyaltyReceiver [0x6c01e51d7254e5d3a3d844d2d56c35dd8abfa753](https://sonicscan.org/address/0x6c01e51d7254e5d3a3d844d2d56c35dd8abfa753)  
AdminAccess [0x3977a0e1a9f7564ce20cd88a22ae76d13386087a](https://sonicscan.org/address/0x3977a0e1a9f7564ce20cd88a22ae76d13386087a)  
ItemNFTLibrary [0xe5440a37964fdfb7456c292d31471d80d7f6046b](https://sonicscan.org/address/0xe5440a37964fdfb7456c292d31471d80d7f6046b)  
ItemNFT [0x8970c63da309d5359a579c2f53bfd64f72b7b706](https://sonicscan.org/address/0x8970c63da309d5359a579c2f53bfd64f72b7b706)  
Bazaar [0x0d6d3794c858b512716e77e05588d4f1fc264319](https://sonicscan.org/address/0x0d6d3794c858b512716e77e05588d4f1fc264319)  
EstforLibrary [0xe3223eaf0e260b54a8ce777ac9f4a972310370c0](https://sonicscan.org/address/0xe3223eaf0e260b54a8ce777ac9f4a972310370c0)  
PlayerNFT [0x076aeec336f5abbdf64ba8ddf96fc974b0463528](https://sonicscan.org/address/0x076aeec336f5abbdf64ba8ddf96fc974b0463528)  
Quests [0x193ecbc093f3bcf6ae6155c9f1bd7c963af6b8d2](https://sonicscan.org/address/0x193ecbc093f3bcf6ae6155c9f1bd7c963af6b8d2)  
Clans [0xbc6ed9e6cb54661ed9682c5055a6631d92e9e1d0](https://sonicscan.org/address/0xbc6ed9e6cb54661ed9682c5055a6631d92e9e1d0)  
WishingWell [0x1207d2f1dc47a9228f20e9d0ce5094ff08bcb00b](https://sonicscan.org/address/0x1207d2f1dc47a9228f20e9d0ce5094ff08bcb00b)  
Bank [0x144884e1b42ccc9c648adee9b5dc1479ce1c8fe3](https://sonicscan.org/address/0x144884e1b42ccc9c648adee9b5dc1479ce1c8fe3)  
PetNFTLibrary [0xa117b910a35e922a51b2a07ab24d2c4b493a5489](https://sonicscan.org/address/0xa117b910a35e922a51b2a07ab24d2c4b493a5489)  
PetNFT [0xe97f8165d9d8d6835abdf7a814ba55dd09b7b1ed](https://sonicscan.org/address/0xe97f8165d9d8d6835abdf7a814ba55dd09b7b1ed)  
PlayersLibrary [0x99e7d54c349173c61b536876c6fd47106e47ebf6](https://sonicscan.org/address/0x99e7d54c349173c61b536876c6fd47106e47ebf6)  
PlayersImplQueueActions [0x5e638cec36bdff41a46b1727720fd4f98bb4a39d](https://sonicscan.org/address/0x5e638cec36bdff41a46b1727720fd4f98bb4a39d)  
PlayersImplProcessActions [0x5fd93e183427e4df76a0211e03e27b4b410d01cc](https://sonicscan.org/address/0x5fd93e183427e4df76a0211e03e27b4b410d01cc)  
PlayersImplRewards [0x82404558911f710876b791ebd3122ae2c7aabc36](https://sonicscan.org/address/0x82404558911f710876b791ebd3122ae2c7aabc36)  
PlayersImplMisc [0x7c3d8c6215c0c8d20c9942d4c2b2a3f93ed36943](https://sonicscan.org/address/0x7c3d8c6215c0c8d20c9942d4c2b2a3f93ed36943)  
PlayersImplMisc1 [0x91c130d6864e118f11905e1d8c268f50588c6e97](https://sonicscan.org/address/0x91c130d6864e118f11905e1d8c268f50588c6e97)  
Players [0xefa670aad6d5921236e9655f346ca13a5c56481b](https://sonicscan.org/address/0xefa670aad6d5921236e9655f346ca13a5c56481b)  
PromotionsLibrary [0x201ffa5be3886d19ef2f18da877ff3b9e34d10c9](https://sonicscan.org/address/0x201ffa5be3886d19ef2f18da877ff3b9e34d10c9)  
Promotions [0xaf48a8a12f29e30b3831392aa2ee6344d07d188b](https://sonicscan.org/address/0xaf48a8a12f29e30b3831392aa2ee6344d07d188b)  
PassiveActions [0x72bb8faee4094d5a701faa26f9f442d32dfe53b6](https://sonicscan.org/address/0x72bb8faee4094d5a701faa26f9f442d32dfe53b6)  
InstantActions [0x765f7068c3cd210b52374498f3ce01617667aed0](https://sonicscan.org/address/0x765f7068c3cd210b52374498f3ce01617667aed0)  
InstantVRFActions [0x1ea4b1fa7f069b89eb8cceee30bfb24945e4d638](https://sonicscan.org/address/0x1ea4b1fa7f069b89eb8cceee30bfb24945e4d638)  
GenericInstantVRFActionStrategy [0x05cd907e6ad6cad21ab2a39e49c68b110be7189a](https://sonicscan.org/address/0x05cd907e6ad6cad21ab2a39e49c68b110be7189a)  
EggInstantVRFActionStrategy [0x231363f40693698df92354275e2bcc4cbe48aa56](https://sonicscan.org/address/0x231363f40693698df92354275e2bcc4cbe48aa56)  
BankRelay [0x0df55b940e993f8d3b06a64212962c3d0fef8cba](https://sonicscan.org/address/0x0df55b940e993f8d3b06a64212962c3d0fef8cba)  
PVPBattleground [0x679193f35e696651e125b2851ee7c4e44bf40a18](https://sonicscan.org/address/0x679193f35e696651e125b2851ee7c4e44bf40a18)  
Raids [0xec57b7988ee3344bcf4ce64e5d11f495df7cd951](https://sonicscan.org/address/0xec57b7988ee3344bcf4ce64e5d11f495df7cd951)  
ClanBattleLibrary [0x6545f99f0753acbc4276a1ff317159690eef9111](https://sonicscan.org/address/0x6545f99f0753acbc4276a1ff317159690eef9111)  
LockedBankVaultsLibrary [0x10de14eafea8f841689b01fa682c63e52255b148](https://sonicscan.org/address/0x10de14eafea8f841689b01fa682c63e52255b148)  
LockedBankVaults [0xfaa31b6ddb7e07cae5ff15475b3966d78d660240](https://sonicscan.org/address/0xfaa31b6ddb7e07cae5ff15475b3966d78d660240)  
Territories [0x5a6d80bb035318d2a24c1fdfd055032a15f11b12](https://sonicscan.org/address/0x5a6d80bb035318d2a24c1fdfd055032a15f11b12)  
CombatantsHelper [0xc754d621239b5830264f8c8e302c21ffe48625fc](https://sonicscan.org/address/0xc754d621239b5830264f8c8e302c21ffe48625fc)  
TerritoryTreasury [0x4b1da5984c89312f852c798154a171a5ddc07d43](https://sonicscan.org/address/0x4b1da5984c89312f852c798154a171a5ddc07d43)  
BankRegistry [0xf213febd3889c5bf18086356e7eff79e2a9fe391](https://sonicscan.org/address/0xf213febd3889c5bf18086356e7eff79e2a9fe391)  
BankFactory [0x76af5869f1b902f7a16c128a1daa7734819ec327](https://sonicscan.org/address/0x76af5869f1b902f7a16c128a1daa7734819ec327)  
ActivityPoints [0x84527c02bb28ce7c32ca4182ad0541a2a9a561d2](https://sonicscan.org/address/0x84527c02bb28ce7c32ca4182ad0541a2a9a561d2)

### Sonic mainnet beta deployed contract addresses:

Bridge [0x4a4988daecaad326aec386e70fb0e6e6af5bda1a](https://sonicscan.org/address/0x4a4988daecaad326aec386e70fb0e6e6af5bda1a)  
WorldActions [0x3a965bf890e5ac353603420cc8d4c821d1f8a765](https://sonicscan.org/address/0x3a965bf890e5ac353603420cc8d4c821d1f8a765)  
RandomnessBeacon [0x7695be7272f3d223a40fc3c0499053f81c17cb65](https://sonicscan.org/address/0x7695be7272f3d223a40fc3c0499053f81c17cb65)  
DailyRewardsScheduler [0x16ba02365efcb5dacc46fe743c46d37a93997575](https://sonicscan.org/address/0x16ba02365efcb5dacc46fe743c46d37a93997575)  
Treasury [0xdd744b66bb24a01a4ec62287f3d0d91fee37f8b1](https://sonicscan.org/address/0xdd744b66bb24a01a4ec62287f3d0d91fee37f8b1)  
Shop [0xb3778f2c24d94e3c7cfe608388bd35bba9401caa](https://sonicscan.org/address/0xb3778f2c24d94e3c7cfe608388bd35bba9401caa)  
RoyaltyReceiver [0x5fce65360e0acdfcec0153bda8c412a7631d47a2](https://sonicscan.org/address/0x5fce65360e0acdfcec0153bda8c412a7631d47a2)  
AdminAccess [0xc06b7bb82b6312c1c2c2de3e375f04d97e80de57](https://sonicscan.org/address/0xc06b7bb82b6312c1c2c2de3e375f04d97e80de57)  
ItemNFTLibrary [0x8ef4472a1792ae0c326d50c82145d0e0716aed0f](https://sonicscan.org/address/0x8ef4472a1792ae0c326d50c82145d0e0716aed0f)  
ItemNFT [0x8ee7d355f76fb5621ee89bca431ba0cd39fe14c5](https://sonicscan.org/address/0x8ee7d355f76fb5621ee89bca431ba0cd39fe14c5)  
Bazaar [0xae4bd229721ff40c07162c1720e060a2a5c89ff6](https://sonicscan.org/address/0xae4bd229721ff40c07162c1720e060a2a5c89ff6)  
EstforLibrary [0x96977118842d6f209f9442e76d7de04d393480d8](https://sonicscan.org/address/0x96977118842d6f209f9442e76d7de04d393480d8)  
PlayerNFT [0xbf5eed84c0cdff089c9dd6086ddf805d111ef35b](https://sonicscan.org/address/0xbf5eed84c0cdff089c9dd6086ddf805d111ef35b)  
Quests [0xd896af0dd1d3533d5d86d4be52df9546a97ddb4d](https://sonicscan.org/address/0xd896af0dd1d3533d5d86d4be52df9546a97ddb4d)  
Clans [0x84d9d334c5b64fcbcb17d6b853a0434818d052bb](https://sonicscan.org/address/0x84d9d334c5b64fcbcb17d6b853a0434818d052bb)  
WishingWell [0xb2570777de043adbc7bfcc4bfed747e2e44fbeea](https://sonicscan.org/address/0xb2570777de043adbc7bfcc4bfed747e2e44fbeea)  
Bank [0x72598e7d7a6652ebb29026f83512bce1455999f6](https://sonicscan.org/address/0x72598e7d7a6652ebb29026f83512bce1455999f6)  
PetNFTLibrary [0xc782815771443b1007a1ee92483ee9ff907dad0d](https://sonicscan.org/address/0xc782815771443b1007a1ee92483ee9ff907dad0d)  
PetNFT [0x7ca7f680517150c8e1ed5a6dd5db80cdc6934082](https://sonicscan.org/address/0x7ca7f680517150c8e1ed5a6dd5db80cdc6934082)  
PlayersLibrary [0xc9ceda474642e39f05c3e8fed75b3f45ed4ae210](https://sonicscan.org/address/0xc9ceda474642e39f05c3e8fed75b3f45ed4ae210)  
PlayersImplQueueActions [0x0fa35e2923b1bfb0423f897c68ddfcf9e0e311e5](https://sonicscan.org/address/0x0fa35e2923b1bfb0423f897c68ddfcf9e0e311e5)  
PlayersImplProcessActions [0xc2ad1e20200083ae750d0c4026934f510d497881](https://sonicscan.org/address/0xc2ad1e20200083ae750d0c4026934f510d497881)  
PlayersImplRewards [0xc57b754651974e7cd629b3e37222f39fd0112355](https://sonicscan.org/address/0xc57b754651974e7cd629b3e37222f39fd0112355)  
PlayersImplMisc [0x2c05adf49992bdd1e6ae3921e4e770c2cf41f893](https://sonicscan.org/address/0x2c05adf49992bdd1e6ae3921e4e770c2cf41f893)  
PlayersImplMisc1 [0x304025989630e2f9c6076b4e8a7bce5ddcac60ce](https://sonicscan.org/address/0x304025989630e2f9c6076b4e8a7bce5ddcac60ce)  
Players [0x4f60948bea953693b4dcd7ea414a2198c3646c97](https://sonicscan.org/address/0x4f60948bea953693b4dcd7ea414a2198c3646c97)  
PromotionsLibrary [0xaf79ca769a02381daca6f7736c51e3ad01ac571c](https://sonicscan.org/address/0xaf79ca769a02381daca6f7736c51e3ad01ac571c)  
Promotions [0xa4f0adf443b48b52827f8c1f56d2f2ab76ae43ab](https://sonicscan.org/address/0xa4f0adf443b48b52827f8c1f56d2f2ab76ae43ab)  
PassiveActions [0x0b577a40b8e69614bd2f6687349ba69c0d1f7113](https://sonicscan.org/address/0x0b577a40b8e69614bd2f6687349ba69c0d1f7113)  
InstantActions [0x76928633cfbf043bca1f6b8ffe634f4c63dbd90d](https://sonicscan.org/address/0x76928633cfbf043bca1f6b8ffe634f4c63dbd90d)  
InstantVRFActions [0x007247ab8fbae2b07f5adf3e70a141459c89264e](https://sonicscan.org/address/0x007247ab8fbae2b07f5adf3e70a141459c89264e)  
GenericInstantVRFActionStrategy [0x2e66bf22e21aee0986602dd2c7265a5470ec9962](https://sonicscan.org/address/0x2e66bf22e21aee0986602dd2c7265a5470ec9962)  
EggInstantVRFActionStrategy [0xd9deebc6ca8b75f8e4de7b4e96a4d8b7e2b3607e](https://sonicscan.org/address/0xd9deebc6ca8b75f8e4de7b4e96a4d8b7e2b3607e)  
BankRelay [0xd6cdc1d365e505f0546361782c4336c829c39568](https://sonicscan.org/address/0xd6cdc1d365e505f0546361782c4336c829c39568)  
PVPBattleground [0xe91a6cdac47dfd546578273253bff1fddc350764](https://sonicscan.org/address/0xe91a6cdac47dfd546578273253bff1fddc350764)  
Raids [0xbfd416e76519cf199dd95b82f6928b3a4b5ac995](https://sonicscan.org/address/0xbfd416e76519cf199dd95b82f6928b3a4b5ac995)  
ClanBattleLibrary [0xff0fa1996e56b21ecf9e5b132d6bcfdf083f6ec1](https://sonicscan.org/address/0xff0fa1996e56b21ecf9e5b132d6bcfdf083f6ec1)  
LockedBankVaultsLibrary [0xecd730e2a4c10a9761afc7faa0850655618eceed](https://sonicscan.org/address/0xecd730e2a4c10a9761afc7faa0850655618eceed)  
LockedBankVaults [0x9451943d38ac8cde8a2a8026adb8b28ac089b2cb](https://sonicscan.org/address/0x9451943d38ac8cde8a2a8026adb8b28ac089b2cb)  
Territories [0xa2ca7daad4b86819c455fafc704d727a23c5a513](https://sonicscan.org/address/0xa2ca7daad4b86819c455fafc704d727a23c5a513)  
CombatantsHelper [0x7fa2b4c19093e0777d72235ea28d302f53227fa0](https://sonicscan.org/address/0x7fa2b4c19093e0777d72235ea28d302f53227fa0)  
TerritoryTreasury [0x5d1429f842891ea0ed80e856762b48bc117ac2a8](https://sonicscan.org/address/0x5d1429f842891ea0ed80e856762b48bc117ac2a8)  
BankRegistry [0x7e7664ff2717889841c758ddfa7a1c6473a8a4d6](https://sonicscan.org/address/0x7e7664ff2717889841c758ddfa7a1c6473a8a4d6)  
BankFactory [0x5497f4b12092d2a8bff8a9e1640ef68e44613f8c](https://sonicscan.org/address/0x5497f4b12092d2a8bff8a9e1640ef68e44613f8c)  
ActivityPoints [0x7fdf947ada5b8979e8aa05c373e1a6ed7457348a](https://sonicscan.org/address/0x7fdf947ada5b8979e8aa05c373e1a6ed7457348a)

### Other addresses:

Brush [0xE51EE9868C1f0d6cd968A8B8C8376Dc2991BFE44](https://sonicscan.org/address/0xE51EE9868C1f0d6cd968A8B8C8376Dc2991BFE44)
