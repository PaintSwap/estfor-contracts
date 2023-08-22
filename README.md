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

WorldLibrary [0x51d2026dccae8c9866fbd0bb6493f9dd2b406396](https://ftmscan.com/address/0x51d2026dccae8c9866fbd0bb6493f9dd2b406396)  
World [0x431137ea4620dacaf0007f0dfbfb8dd298e3c570](https://ftmscan.com/address/0x431137ea4620dacaf0007f0dfbfb8dd298e3c570)  
Shop [0xa254f7a8f9819dac75b8017f2b54d0f31cb1691f](https://ftmscan.com/address/0xa254f7a8f9819dac75b8017f2b54d0f31cb1691f)  
RoyaltyReceiver [0x84e4eff3bea2e129c9d884eb2fc0222be888ee92](https://ftmscan.com/address/0x84e4eff3bea2e129c9d884eb2fc0222be888ee92)  
AdminAccess [0xa09cd5d705441823eecc46de13e87699b07bd68c](https://ftmscan.com/address/0xa09cd5d705441823eecc46de13e87699b07bd68c)  
ItemNFTLibrary [0x4cb1ef0ff16e212e3b2531bb7bce7204f80e875f](https://ftmscan.com/address/0x4cb1ef0ff16e212e3b2531bb7bce7204f80e875f)  
ItemNFT [0x99998ed4c00de52263d92e6e5ebb66fa0986ae25](https://ftmscan.com/address/0x99998ed4c00de52263d92e6e5ebb66fa0986ae25)  
EstforLibrary [0xb1b79b74a8dd0ee2954835e34d4ae21ace74b656](https://ftmscan.com/address/0xb1b79b74a8dd0ee2954835e34d4ae21ace74b656)  
PlayerNFT [0x7fc74b194a0fd872d3e58de62dadbf8459e15c0f](https://ftmscan.com/address/0x7fc74b194a0fd872d3e58de62dadbf8459e15c0f)  
Promotions [0x04659ea5d6c3ab09532654139c8289cdfb2d3947](https://ftmscan.com/address/0x04659ea5d6c3ab09532654139c8289cdfb2d3947)  
Quests [0xd485fdaa87341d431e7685ace89a1c1aa2213d3e](https://ftmscan.com/address/0xd485fdaa87341d431e7685ace89a1c1aa2213d3e)  
Clans [0xa540ce96a2ec97572c7028f89ffb8bc1bc932c0b](https://ftmscan.com/address/0xa540ce96a2ec97572c7028f89ffb8bc1bc932c0b)  
Bank Beacon [0x3813315ec0fa8f52b0d12d1894e027d6e3b131a0](https://ftmscan.com/address/0x3813315ec0fa8f52b0d12d1894e027d6e3b131a0)  
WishingWell [0xe8156e6aeabe578926af8b61948ac3ece0dac737](https://ftmscan.com/address/0xe8156e6aeabe578926af8b61948ac3ece0dac737)

PlayersLibrary [0x3d08306658d3e3e54b5608915b6ce092d8e97448](https://ftmscan.com/address/0x3d08306658d3e3e54b5608915b6ce092d8e97448)  
PlayersImplQueueActions [0xb7a2fbce876444a6b6037551631b33bb131c88d9](https://ftmscan.com/address/0xb7a2fbce876444a6b6037551631b33bb131c88d9)  
PlayersImplProcessActions [0xbe92cdfa6311e34e71f27c8ba04d703cb5daea37](https://ftmscan.com/address/0xbe92cdfa6311e34e71f27c8ba04d703cb5daea37)  
PlayersImplRewards [0x12772b73d4b19595fd58f02bf442c6160d19857a](https://ftmscan.com/address/0x12772b73d4b19595fd58f02bf442c6160d19857a)  
PlayersImplMisc [0xea74bff137a0af1eee70ecedffe5a0640c5f1c7e](https://ftmscan.com/address/0xea74bff137a0af1eee70ecedffe5a0640c5f1c7e)  
PlayersImplMisc1 [0x222d5d31acb500509c9b4c7a4e2a076e2253dd2d](https://ftmscan.com/address/0x222d5d31acb500509c9b4c7a4e2a076e2253dd2d)  
Players [0x0c07300ed83db48cfa4048c3f4a465fb5ae454f7](https://ftmscan.com/address/0x0c07300ed83db48cfa4048c3f4a465fb5ae454f7)

BankRegistry [0x68ba00d2f1aabbff3325c1e64f905f05e1d725da](https://ftmscan.com/address/0x68ba00d2f1aabbff3325c1e64f905f05e1d725da)  
BankFactory [0x128124e8aceb8c885f5b450cce12e54b7d907393](https://ftmscan.com/address/0x128124e8aceb8c885f5b450cce12e54b7d907393)

### Fantom mainnet beta deployed contract addresses:

WorldLibrary [0x5443085444f881a9aee41d51166ad0aef8af1232](https://ftmscan.com/address/0x5443085444f881a9aee41d51166ad0aef8af1232)  
World [0xe2f0b5cb118da85be68de1801d40726ce48009aa](https://ftmscan.com/address/0xe2f0b5cb118da85be68de1801d40726ce48009aa)  
Shop [0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30](https://ftmscan.com/address/0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30)  
RoyaltyReceiver [0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e](https://ftmscan.com/address/0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e)  
AdminAccess [0xa298f1636dacab0db352fec84d2079814e0ce778](https://ftmscan.com/address/0xa298f1636dacab0db352fec84d2079814e0ce778)  
ItemNFTLibrary [0x22496409ef2407cd675195a604d0784a223c6028](https://ftmscan.com/address/0x22496409ef2407cd675195a604d0784a223c6028)  
ItemNFT [0x1dae89b469d15b0ded980007dfdc8e68c363203d](https://ftmscan.com/address/0x1dae89b469d15b0ded980007dfdc8e68c363203d)  
EstforLibrary [0x9bcb040b6ffc0adcedda870f0a8e18e4278c72de](https://ftmscan.com/address/0x9bcb040b6ffc0adcedda870f0a8e18e4278c72de)  
PlayerNFT [0xde70e49756322afdf7714d3aca963abcb4547b8d](https://ftmscan.com/address/0xde70e49756322afdf7714d3aca963abcb4547b8d)  
Promotions [0xf28cab48e29be56fcc68574b5c147b780c35647c](https://ftmscan.com/address/0xf28cab48e29be56fcc68574b5c147b780c35647c)  
Quests [0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9](https://ftmscan.com/address/0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9)  
Clans [0xd35410f526db135f09bb8e2bb066c8a63135d812](https://ftmscan.com/address/0xd35410f526db135f09bb8e2bb066c8a63135d812)  
Bank Beacon [0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e](https://ftmscan.com/address/0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e)  
WishingWell [0xdd1131f57e5e416622fa2b61d4108822e8cc38dc](https://ftmscan.com/address/0xdd1131f57e5e416622fa2b61d4108822e8cc38dc)

PlayersLibrary [0x96580ff13fb3ef3735eb7549e014b360c777cdcb](https://ftmscan.com/address/0x96580ff13fb3ef3735eb7549e014b360c777cdcb)  
PlayersImplQueueActions [0x37b6fa791ab30874b1a1eeaac5c583ae6e5188bb](https://ftmscan.com/address/0x37b6fa791ab30874b1a1eeaac5c583ae6e5188bb)  
PlayersImplProcessActions [0xaad4429aeefd9d19a6b554222acbc42b929a1dc7](https://ftmscan.com/address/0xaad4429aeefd9d19a6b554222acbc42b929a1dc7)  
PlayersImplRewards [0xaea65427bceda0b3c9cc01e1689db30e39b0641f](https://ftmscan.com/address/0xaea65427bceda0b3c9cc01e1689db30e39b0641f)  
PlayersImplMisc [0xefeb13e575493d4266a97ea877103f632f06e99f](https://ftmscan.com/address/0xefeb13e575493d4266a97ea877103f632f06e99f)  
PlayersImplMisc1 [0xed80678300b2c44ac6d05b454875e496ad96b283](https://ftmscan.com/address/0xed80678300b2c44ac6d05b454875e496ad96b283)  
Players [0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be](https://ftmscan.com/address/0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be)

BankRegistry [0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0](https://ftmscan.com/address/0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0)  
BankProxy [0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb](https://ftmscan.com/address/0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb)  
BankFactory [0x7b8197e7d7352e8910a7af79a9184f50290403da](https://ftmscan.com/address/0x7b8197e7d7352e8910a7af79a9184f50290403da)

### Other addresses:

BRUSH [0x85dec8c4b2680793661bca91a8f129607571863d](https://ftmscan.com/address/0x85dec8c4b2680793661bca91a8f129607571863d)
