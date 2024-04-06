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

WorldLibrary [0x7aa43aa55d7cc9c1ec5cbde71d841331e536c426](https://ftmscan.com/address/0x7aa43aa55d7cc9c1ec5cbde71d841331e536c426)  
World [0x28866bf156152966b5872bee39bc05b5b5eedb02](https://ftmscan.com/address/0x28866bf156152966b5872bee39bc05b5b5eedb02)  
Shop [0x7fb574e4fbe876f751fec90e59686c2776df19f9](https://ftmscan.com/address/0x7fb574e4fbe876f751fec90e59686c2776df19f9)  
RoyaltyReceiver [0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b](https://ftmscan.com/address/0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b)  
AdminAccess [0xe63b7195b301b9313c9e337df4aceac436c3751e](https://ftmscan.com/address/0xe63b7195b301b9313c9e337df4aceac436c3751e)  
ItemNFTLibrary [0x8d61639c830aaf82c8549c36e65a9aeef9a73b45](https://ftmscan.com/address/0x8d61639c830aaf82c8549c36e65a9aeef9a73b45)  
ItemNFT [0x4b9c90ebb1fa98d9724db46c4689994b46706f5a](https://ftmscan.com/address/0x4b9c90ebb1fa98d9724db46c4689994b46706f5a)  
EstforLibrary [0x8213fCAD73187A1A4d4cf9a44BF87d919Ca32970](https://ftmscan.com/address/0x8213fCAD73187A1A4d4cf9a44BF87d919Ca32970)  
PlayerNFT [0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9](https://ftmscan.com/address/0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9)  
PromotionsLibrary [0x5494e6a699e8e59e9a6ec3031ab96e35f2476c95](https://ftmscan.com/address/0x5494e6a699e8e59e9a6ec3031ab96e35f2476c95)  
Promotions [0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4](https://ftmscan.com/address/0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4)  
Quests [0x17c59f0d2d4f80FD0F906Df53a28272736c7b455](https://ftmscan.com/address/0x17c59f0d2d4f80FD0F906Df53a28272736c7b455)  
Clans [0x334caa8907bdf49470f7b085380c25431ef96f6d](https://ftmscan.com/address/0x334caa8907bdf49470f7b085380c25431ef96f6d)  
WishingWell [0x0a8d80ce4855666b7d7121d75f2a49aac434a918](https://ftmscan.com/address/0x0a8d80ce4855666b7d7121d75f2a49aac434a918)  
Bank Beacon [0xe183a43881eac74808c55bdb2a073929602af4db](https://ftmscan.com/address/0xe183a43881eac74808c55bdb2a073929602af4db)

PlayersLibrary [0xc6d48b3071099fb9a389d05b6e0fb504766f85fe](https://ftmscan.com/address/0xc6d48b3071099fb9a389d05b6e0fb504766f85fe)  
PlayersImplQueueActions [0xbaec5f2ae77e3d829b65c7ca99bb9ced4565c794](https://ftmscan.com/address/0xbaec5f2ae77e3d829b65c7ca99bb9ced4565c794)  
PlayersImplProcessActions [0x89b6f61de910328761e819d1068111e4ba010932](https://ftmscan.com/address/0x89b6f61de910328761e819d1068111e4ba010932)  
PlayersImplRewards [0xd7b7a8e05e577ec6d44c519127832bdd413b4f91](https://ftmscan.com/address/0xd7b7a8e05e577ec6d44c519127832bdd413b4f91)  
PlayersImplMisc [0x87e28f2107d20f963816e92b860b1d9d24cb35fe](https://ftmscan.com/address/0x87e28f2107d20f963816e92b860b1d9d24cb35fe)  
PlayersImplMisc1 [0x4094107b4a4ff215cdec4e9c61a0c9e046b6e687](https://ftmscan.com/address/0x4094107b4a4ff215cdec4e9c61a0c9e046b6e687)  
Players [0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143](https://ftmscan.com/address/0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143)

BankRegistry [0x55a1b0251e1375bd41dd9778c379322e3863a54e](https://ftmscan.com/address/0x55a1b0251e1375bd41dd9778c379322e3863a54e)  
BankFactory [0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4](https://ftmscan.com/address/0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4)

InstantActions [0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe](https://ftmscan.com/address/0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe)  
InstantVRFActions [0xfe2c07fd7751bba25164adbd96e09b382403f4d7](https://ftmscan.com/address/0xfe2c07fd7751bba25164adbd96e09b382403f4d7)  
GenericInstantVRFActionStrategy [0x6270b82049724ff6d7a78b71f2273bba03bfcdfc](https://ftmscan.com/address/0x6270b82049724ff6d7a78b71f2273bba03bfcdfc)  
EggInstantVRFActionStrategy [](https://ftmscan.com/address/)  
VRFRequestInfo [0x8c3dcf7b09ea620b265d9daab237f29f485f725b](https://ftmscan.com/address/0x8c3dcf7b09ea620b265d9daab237f29f485f725b)

LockedBankVaults [0x65e944795d00cc287bdace77d57571fc4deff3e0](https://ftmscan.com/address/0x65e944795d00cc287bdace77d57571fc4deff3e0)  
Territories [0x2cfd3b9f8b595200d6b4b7f667b2a1bcc6d0c170](https://ftmscan.com/address/0x2cfd3b9f8b595200d6b4b7f667b2a1bcc6d0c170)  
CombatantsHelper [0x8fedf83c55012acff7115b8fa164095721953c39](https://ftmscan.com/address/0x8fedf83c55012acff7115b8fa164095721953c39)  
DecoratorProvider [0xba2f8cff9ea18f3687eb685f0c1bcd509b539963](https://ftmscan.com/address/0xba2f8cff9ea18f3687eb685f0c1bcd509b539963)

PetNFTLibrary [](https://ftmscan.com/address/)  
PetNFT [](https://ftmscan.com/address/)

Oracle [0x28ade840602d0363a2ab675479f1b590b23b0490](https://ftmscan.com/address/0x28ade840602d0363a2ab675479f1b590b23b0490)  
VRF [0xeF5AC0489fc8ABC1085E8D1f5BEE85e74E6D2cC2](https://ftmscan.com/address/0xeF5AC0489fc8ABC1085E8D1f5BEE85e74E6D2cC2)  
Bazaar [0x6996c519dA4ac7815bEFbd836cf0b78Aa62fdBcE](https://ftmscan.com/address/0x6996c519dA4ac7815bEFbd836cf0b78Aa62fdBcE)

### Fantom mainnet beta deployed contract addresses:

WorldLibrary [0x17581c8e57fcca1be58dc109b0e275f4c24eb50f](https://ftmscan.com/address/0x17581c8e57fcca1be58dc109b0e275f4c24eb50f)  
World [0xe2f0b5cb118da85be68de1801d40726ce48009aa](https://ftmscan.com/address/0xe2f0b5cb118da85be68de1801d40726ce48009aa)  
Shop [0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30](https://ftmscan.com/address/0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30)  
RoyaltyReceiver [0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e](https://ftmscan.com/address/0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e)  
AdminAccess [0xa298f1636dacab0db352fec84d2079814e0ce778](https://ftmscan.com/address/0xa298f1636dacab0db352fec84d2079814e0ce778)  
ItemNFTLibrary [0xd24b6994c179817391466372fb2a26440fcc0dd7](https://ftmscan.com/address/0xd24b6994c179817391466372fb2a26440fcc0dd7)  
ItemNFT [0x1dae89b469d15b0ded980007dfdc8e68c363203d](https://ftmscan.com/address/0x1dae89b469d15b0ded980007dfdc8e68c363203d)  
EstforLibrary [0x52ecba8c563f686f9d7964a89fbc1956523ce105](https://ftmscan.com/address/0x52ecba8c563f686f9d7964a89fbc1956523ce105)  
PlayerNFT [0xde70e49756322afdf7714d3aca963abcb4547b8d](https://ftmscan.com/address/0xde70e49756322afdf7714d3aca963abcb4547b8d)  
PromotionsLibrary [0x684c6e254df63b9d5a28b29b7e4d0850d158f9f9](https://ftmscan.com/address/0x684c6e254df63b9d5a28b29b7e4d0850d158f9f9)  
Promotions [0xf28cab48e29be56fcc68574b5c147b780c35647c](https://ftmscan.com/address/0xf28cab48e29be56fcc68574b5c147b780c35647c)  
Quests [0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9](https://ftmscan.com/address/0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9)  
Clans [0xd35410f526db135f09bb8e2bb066c8a63135d812](https://ftmscan.com/address/0xd35410f526db135f09bb8e2bb066c8a63135d812)  
WishingWell [0xdd1131f57e5e416622fa2b61d4108822e8cc38dc](https://ftmscan.com/address/0xdd1131f57e5e416622fa2b61d4108822e8cc38dc)  
Bank Beacon [0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e](https://ftmscan.com/address/0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e)

PlayersLibrary [0x227846c11f3bd29a2a0628cc6bb73b141a1e9614](https://ftmscan.com/address/0x227846c11f3bd29a2a0628cc6bb73b141a1e9614)  
PlayersImplQueueActions [0x108413aa863a130b2ac1d604369097c4e23fac1a](https://ftmscan.com/address/0x108413aa863a130b2ac1d604369097c4e23fac1a)  
PlayersImplProcessActions [0xa8dba2a93e88b21fab8d4248c1fc04adf95f1d43](https://ftmscan.com/address/0xa8dba2a93e88b21fab8d4248c1fc04adf95f1d43)  
PlayersImplRewards [0x8716228a74d157860697dd178786e191a4f0bf14](https://ftmscan.com/address/0x8716228a74d157860697dd178786e191a4f0bf14)  
PlayersImplMisc [0x861908dd206b236ea3ffbfc86cc8afd6a7078e5a](https://ftmscan.com/address/0x861908dd206b236ea3ffbfc86cc8afd6a7078e5a)  
PlayersImplMisc1 [0x40804aced48c6599d6417f4c9fb0c8a4fc0f3383](https://ftmscan.com/address/0x40804aced48c6599d6417f4c9fb0c8a4fc0f3383)  
Players [0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be](https://ftmscan.com/address/0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be)

BankRegistry [0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0](https://ftmscan.com/address/0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0)  
BankProxy [0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb](https://ftmscan.com/address/0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb)  
BankFactory [0x7b8197e7d7352e8910a7af79a9184f50290403da](https://ftmscan.com/address/0x7b8197e7d7352e8910a7af79a9184f50290403da)

InstantActions [0xe9a1a09be4a64f806a26b33fbdf07a6f3e61af76](https://ftmscan.com/address/0xe9a1a09be4a64f806a26b33fbdf07a6f3e61af76)  
InstantVRFActions [0xe297508ff83ba7a984ec8778ea67d82e049eda58](https://ftmscan.com/address/0xe297508ff83ba7a984ec8778ea67d82e049eda58)  
GenericInstantVRFActionStrategy [0x2ea7d26184188ec7495acaa84a7de1292e8a1794](https://ftmscan.com/address/0x2ea7d26184188ec7495acaa84a7de1292e8a1794)  
EggInstantVRFActionStrategy [0x141234B4071e2D40e24F69788522127658285a49](https://ftmscan.com/address/0x141234B4071e2D40e24F69788522127658285a49)  
VRFRequestInfo [0x9bcf94e6c067c575dd6a748e45330b4ae4dc0483](https://ftmscan.com/address/0x9bcf94e6c067c575dd6a748e45330b4ae4dc0483)

LockedBankVaults [0x40567ad9cd25c56422807ed67f0e66f1825bdb91](https://ftmscan.com/address/0x40567ad9cd25c56422807ed67f0e66f1825bdb91)  
Territories [0xf31517db9f0987002f3a0fb4f787dfb9e892f184](https://ftmscan.com/address/0xf31517db9f0987002f3a0fb4f787dfb9e892f184)  
CombatantsHelper [0xe8231ac805a88b3c72e9602c2ae14a5d3421bc7c](https://ftmscan.com/address/0xe8231ac805a88b3c72e9602c2ae14a5d3421bc7c)  
DecoratorProvider [0xea8c4d188eb8d9704bc36931d89ba4f8e935cee2](https://ftmscan.com/address/0xea8c4d188eb8d9704bc36931d89ba4f8e935cee2)

PetNFTLibrary [0x0bf1c83fb10b5e211242090a8bc59a60bd488299](https://ftmscan.com/address/0x0bf1c83fb10b5e211242090a8bc59a60bd488299)  
PetNFT [0xa6489181b24e966402891225c65f8e2d136ddd2e](https://ftmscan.com/address/0xa6489181b24e966402891225c65f8e2d136ddd2e)

Oracle [0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7](https://ftmscan.com/address/0x6f7911cbbd4b5a1d2bdaa817a76056e510d728e7)  
VRF [0x58E9fd2Fae18c861B9F564200510A88106C05756](https://ftmscan.com/address/0x58E9fd2Fae18c861B9F564200510A88106C05756)  
Bazaar [0x082480aAAF1ac5bb0Db2c241eF8b4230Da85E191](https://ftmscan.com/address/0x082480aAAF1ac5bb0Db2c241eF8b4230Da85E191)

### Other addresses:

Brush [0x85dec8c4b2680793661bca91a8f129607571863d](https://ftmscan.com/address/0x85dec8c4b2680793661bca91a8f129607571863d)
