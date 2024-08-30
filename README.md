# Estfor Kingdom contracts

![image](https://user-images.githubusercontent.com/84033732/223739503-c53a888a-443f-4fb5-98a3-d40f94956799.png)

[![Continuous integration](https://github.com/PaintSwap/estfor-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/PaintSwap/estfor-contracts/actions/workflows/ci.yml)

All the smart contract code for the Estfor Kingdom RPG game on the Fantom Blockchain.

Make sure `yarn` is installed (or replace with equivalent npm instructions)

These contracts use hardhat and require solidity 0.8.20 at minimum.

Install dependencies:

```shell
yarn install
```

To compile:

```shell
yarn compile
```

To run the tests:

```shell
yarn test
```

To deploy the contracts:

```shell
yarn deploy
```

To verify the contracts on ftmscan:

```shell
yarn verifyContracts
```

To check storage slot packing of the test file:

```shell
yarn umlStorage
```

### Fantom mainnet deployed contract addresses:

WorldLibrary [0xcba2273a46649cc0ce76e69eb0bb05d9b699ca38](https://ftmscan.com/address/0xcba2273a46649cc0ce76e69eb0bb05d9b699ca38)  
World [0x28866bf156152966b5872bee39bc05b5b5eedb02](https://ftmscan.com/address/0x28866bf156152966b5872bee39bc05b5b5eedb02)  
Shop [0x7fb574e4fbe876f751fec90e59686c2776df19f9](https://ftmscan.com/address/0x7fb574e4fbe876f751fec90e59686c2776df19f9)  
RoyaltyReceiver [0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b](https://ftmscan.com/address/0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b)  
AdminAccess [0xe63b7195b301b9313c9e337df4aceac436c3751e](https://ftmscan.com/address/0xe63b7195b301b9313c9e337df4aceac436c3751e)  
ItemNFTLibrary [0x8d61639c830aaf82c8549c36e65a9aeef9a73b45](https://ftmscan.com/address/0x8d61639c830aaf82c8549c36e65a9aeef9a73b45)  
ItemNFT [0x4b9c90ebb1fa98d9724db46c4689994b46706f5a](https://ftmscan.com/address/0x4b9c90ebb1fa98d9724db46c4689994b46706f5a)  
EstforLibrary [0x804a530f41ecf0c40cd4e312a72e033c78a2c1fa](https://ftmscan.com/address/0x804a530f41ecf0c40cd4e312a72e033c78a2c1fa)  
PlayerNFT [0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9](https://ftmscan.com/address/0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9)  
PromotionsLibrary [0x5494e6a699e8e59e9a6ec3031ab96e35f2476c95](https://ftmscan.com/address/0x5494e6a699e8e59e9a6ec3031ab96e35f2476c95)  
Promotions [0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4](https://ftmscan.com/address/0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4)  
Quests [0x17c59f0d2d4f80FD0F906Df53a28272736c7b455](https://ftmscan.com/address/0x17c59f0d2d4f80FD0F906Df53a28272736c7b455)  
Clans [0x334caa8907bdf49470f7b085380c25431ef96f6d](https://ftmscan.com/address/0x334caa8907bdf49470f7b085380c25431ef96f6d)  
WishingWell [0x0a8d80ce4855666b7d7121d75f2a49aac434a918](https://ftmscan.com/address/0x0a8d80ce4855666b7d7121d75f2a49aac434a918)  
Bank Beacon [0xe183a43881eac74808c55bdb2a073929602af4db](https://ftmscan.com/address/0xe183a43881eac74808c55bdb2a073929602af4db)

PlayersLibrary [0x0DAbE42562B15614887C68fe486E9B81CB5DDbE9](https://ftmscan.com/address/0x0DAbE42562B15614887C68fe486E9B81CB5DDbE9)  
PlayersImplQueueActions [0xb86cadad55067e24540c6d781d16778f887bf62f](https://ftmscan.com/address/0xb86cadad55067e24540c6d781d16778f887bf62f)  
PlayersImplProcessActions [0xe2a9b8c9cee566ae94758510aeaca20476eff97f](https://ftmscan.com/address/0xe2a9b8c9cee566ae94758510aeaca20476eff97f)  
PlayersImplRewards [0xfb2aa5afc0de399c76d570ac9bc446940367cfba](https://ftmscan.com/address/0xfb2aa5afc0de399c76d570ac9bc446940367cfba)  
PlayersImplMisc [0xddf2bf45e270c1cd624a6ad479974dff24113500](https://ftmscan.com/address/0xddf2bf45e270c1cd624a6ad479974dff24113500)  
PlayersImplMisc1 [0xc62bdaebc179b3f9cc83ac978db834457aea893b](https://ftmscan.com/address/0xc62bdaebc179b3f9cc83ac978db834457aea893b)  
Players [0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143](https://ftmscan.com/address/0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143)

BankRegistry [0x55a1b0251e1375bd41dd9778c379322e3863a54e](https://ftmscan.com/address/0x55a1b0251e1375bd41dd9778c379322e3863a54e)  
BankFactory [0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4](https://ftmscan.com/address/0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4)

InstantActions [0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe](https://ftmscan.com/address/0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe)  
InstantVRFActions [0xfe2c07fd7751bba25164adbd96e09b382403f4d7](https://ftmscan.com/address/0xfe2c07fd7751bba25164adbd96e09b382403f4d7)  
GenericInstantVRFActionStrategy [0x6270b82049724ff6d7a78b71f2273bba03bfcdfc](https://ftmscan.com/address/0x6270b82049724ff6d7a78b71f2273bba03bfcdfc)  
EggInstantVRFActionStrategy [0x7797fd3904fc399184d2a549dff025210d62e645](https://ftmscan.com/address/0x7797fd3904fc399184d2a549dff025210d62e645)  
VRFRequestInfo [0x8c3dcf7b09ea620b265d9daab237f29f485f725b](https://ftmscan.com/address/0x8c3dcf7b09ea620b265d9daab237f29f485f725b)

LockedBankVaults [0x65e944795d00cc287bdace77d57571fc4deff3e0](https://ftmscan.com/address/0x65e944795d00cc287bdace77d57571fc4deff3e0)  
LockedBankVaultsLibrary [0xd5a209d7fa6bc485b3c4120aaec75b2912cfe4e8](https://ftmscan.com/address/0xd5a209d7fa6bc485b3c4120aaec75b2912cfe4e8)  
Territories [0x2cfd3b9f8b595200d6b4b7f667b2a1bcc6d0c170](https://ftmscan.com/address/0x2cfd3b9f8b595200d6b4b7f667b2a1bcc6d0c170)  
CombatantsHelper [0x8fedf83c55012acff7115b8fa164095721953c39](https://ftmscan.com/address/0x8fedf83c55012acff7115b8fa164095721953c39)  
DecoratorProvider [0xba2f8cff9ea18f3687eb685f0c1bcd509b539963](https://ftmscan.com/address/0xba2f8cff9ea18f3687eb685f0c1bcd509b539963)

PetNFTLibrary [0x5a134487df2d8e216e34bf9407bd63cd80e76957](https://ftmscan.com/address/0x5a134487df2d8e216e34bf9407bd63cd80e76957)  
PetNFT [0x1681f593ac5cba407c2a190de0ca2beb4a69b5d3](https://ftmscan.com/address/0x1681f593ac5cba407c2a190de0ca2beb4a69b5d3)  
PassiveActions [0xa3e3a69edaee89b8dbbd1ca37704cc574cb8e1d4](https://ftmscan.com/address/0xa3e3a69edaee89b8dbbd1ca37704cc574cb8e1d4)

Oracle [0x28ade840602d0363a2ab675479f1b590b23b0490](https://ftmscan.com/address/0x28ade840602d0363a2ab675479f1b590b23b0490)  
VRF [0xeF5AC0489fc8ABC1085E8D1f5BEE85e74E6D2cC2](https://ftmscan.com/address/0xeF5AC0489fc8ABC1085E8D1f5BEE85e74E6D2cC2)  
Bazaar [0x6996c519dA4ac7815bEFbd836cf0b78Aa62fdBcE](https://ftmscan.com/address/0x6996c519dA4ac7815bEFbd836cf0b78Aa62fdBcE)

### Fantom mainnet beta deployed contract addresses:

WorldLibrary [0x31edace030c71d33bd8b6e53c1df123c0404e5ca](https://ftmscan.com/address/0x31edace030c71d33bd8b6e53c1df123c0404e5ca)  
World [0xe2f0b5cb118da85be68de1801d40726ce48009aa](https://ftmscan.com/address/0xe2f0b5cb118da85be68de1801d40726ce48009aa)  
Shop [0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30](https://ftmscan.com/address/0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30)  
RoyaltyReceiver [0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e](https://ftmscan.com/address/0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e)  
AdminAccess [0xa298f1636dacab0db352fec84d2079814e0ce778](https://ftmscan.com/address/0xa298f1636dacab0db352fec84d2079814e0ce778)  
ItemNFTLibrary [0x2d0b79a4d76d6fd86b8ba08acc68d3f35430aa7a](https://ftmscan.com/address/0x2d0b79a4d76d6fd86b8ba08acc68d3f35430aa7a)  
ItemNFT [0x1dae89b469d15b0ded980007dfdc8e68c363203d](https://ftmscan.com/address/0x1dae89b469d15b0ded980007dfdc8e68c363203d)  
EstforLibrary [0xAD4Fe5A1d43F986659F548Cc899dCD4045FA9974](https://ftmscan.com/address/0xAD4Fe5A1d43F986659F548Cc899dCD4045FA9974)  
PlayerNFT [0xde70e49756322afdf7714d3aca963abcb4547b8d](https://ftmscan.com/address/0xde70e49756322afdf7714d3aca963abcb4547b8d)  
PromotionsLibrary [0x684c6e254df63b9d5a28b29b7e4d0850d158f9f9](https://ftmscan.com/address/0x684c6e254df63b9d5a28b29b7e4d0850d158f9f9)  
Promotions [0xf28cab48e29be56fcc68574b5c147b780c35647c](https://ftmscan.com/address/0xf28cab48e29be56fcc68574b5c147b780c35647c)  
Quests [0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9](https://ftmscan.com/address/0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9)  
Clans [0xd35410f526db135f09bb8e2bb066c8a63135d812](https://ftmscan.com/address/0xd35410f526db135f09bb8e2bb066c8a63135d812)  
WishingWell [0xdd1131f57e5e416622fa2b61d4108822e8cc38dc](https://ftmscan.com/address/0xdd1131f57e5e416622fa2b61d4108822e8cc38dc)  
Bank Beacon [0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e](https://ftmscan.com/address/0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e)

PlayersLibrary [0xa603b1b306032218032716e326d40ba37dd38c7d](https://ftmscan.com/address/0xa603b1b306032218032716e326d40ba37dd38c7d)  
PlayersImplQueueActions [0xbbe4d7d9027e22562386cb794c618cde55ef04be](https://ftmscan.com/address/0xbbe4d7d9027e22562386cb794c618cde55ef04be)  
PlayersImplProcessActions [0xb42935f9a62dc3c6f6898d54400b8c6b68a29f22](https://ftmscan.com/address/0xb42935f9a62dc3c6f6898d54400b8c6b68a29f22)  
PlayersImplRewards [0x45cac1133b81181af3d0543c33a3e7c568579592](https://ftmscan.com/address/0x45cac1133b81181af3d0543c33a3e7c568579592)  
PlayersImplMisc [0x55919fc7193d8c5fa409a1d2437ecda0eb395f17](https://ftmscan.com/address/0x55919fc7193d8c5fa409a1d2437ecda0eb395f17)  
PlayersImplMisc1 [0xae72aebfdd87f74aa9409ada0f64a6d9d41a2ec8](https://ftmscan.com/address/0xae72aebfdd87f74aa9409ada0f64a6d9d41a2ec8)  
Players [0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be](https://ftmscan.com/address/0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be)

BankRegistry [0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0](https://ftmscan.com/address/0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0)  
BankProxy [0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb](https://ftmscan.com/address/0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb)  
BankFactory [0x7b8197e7d7352e8910a7af79a9184f50290403da](https://ftmscan.com/address/0x7b8197e7d7352e8910a7af79a9184f50290403da)

InstantActions [0xe9a1a09be4a64f806a26b33fbdf07a6f3e61af76](https://ftmscan.com/address/0xe9a1a09be4a64f806a26b33fbdf07a6f3e61af76)  
InstantVRFActions [0xbbcc13d2359ad6f2c02e172de46097a1c534ef89](https://ftmscan.com/address/0xbbcc13d2359ad6f2c02e172de46097a1c534ef89)  
GenericInstantVRFActionStrategy [0xc4c92d3987cc0bad3219e696653eb87eddda78c6](https://ftmscan.com/address/0xc4c92d3987cc0bad3219e696653eb87eddda78c6)  
EggInstantVRFActionStrategy [0x941369948CC8a4b5b8eFb1F688Eddfe26A736039](https://ftmscan.com/address/0x941369948CC8a4b5b8eFb1F688Eddfe26A736039)  
VRFRequestInfo [0x9bcf94e6c067c575dd6a748e45330b4ae4dc0483](https://ftmscan.com/address/0x9bcf94e6c067c575dd6a748e45330b4ae4dc0483)

LockedBankVaultsLibrary [0x4361e1825cf5c910d1589600df613322e0e704b0](https://ftmscan.com/address/0x4361e1825cf5c910d1589600df613322e0e704b0)  
LockedBankVaults [0x40567ad9cd25c56422807ed67f0e66f1825bdb91](https://ftmscan.com/address/0x40567ad9cd25c56422807ed67f0e66f1825bdb91)  
Territories [0xf31517db9f0987002f3a0fb4f787dfb9e892f184](https://ftmscan.com/address/0xf31517db9f0987002f3a0fb4f787dfb9e892f184)  
CombatantsHelper [0xe8231ac805a88b3c72e9602c2ae14a5d3421bc7c](https://ftmscan.com/address/0xe8231ac805a88b3c72e9602c2ae14a5d3421bc7c)  
DecoratorProvider [0xea8c4d188eb8d9704bc36931d89ba4f8e935cee2](https://ftmscan.com/address/0xea8c4d188eb8d9704bc36931d89ba4f8e935cee2)

PetNFTLibrary [0x04a11e4afd667ca55b10d834a7367c4bed107750](https://ftmscan.com/address/0x04a11e4afd667ca55b10d834a7367c4bed107750)  
PetNFT [0xa6489181b24e966402891225c65f8e2d136ddd2e](https://ftmscan.com/address/0xa6489181b24e966402891225c65f8e2d136ddd2e)  
PassiveActions [0x3df5b6cad0d2de6b71f2d5084e0b933dbcd395f6](https://ftmscan.com/address/0x3df5b6cad0d2de6b71f2d5084e0b933dbcd395f6)

Oracle [0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7](https://ftmscan.com/address/0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7)  
VRF [0x58E9fd2Fae18c861B9F564200510A88106C05756](https://ftmscan.com/address/0x58E9fd2Fae18c861B9F564200510A88106C05756)  
Bazaar [0x082480aAAF1ac5bb0Db2c241eF8b4230Da85E191](https://ftmscan.com/address/0x082480aAAF1ac5bb0Db2c241eF8b4230Da85E191)

### Other addresses:

Brush [0x85dec8c4b2680793661bca91a8f129607571863d](https://ftmscan.com/address/0x85dec8c4b2680793661bca91a8f129607571863d)
