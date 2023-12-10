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

WorldLibrary [0xd582da91d0449f93ba7ba477a55dd82689301f1f](https://ftmscan.com/address/0xd582da91d0449f93ba7ba477a55dd82689301f1f)  
World [0x28866bf156152966b5872bee39bc05b5b5eedb02](https://ftmscan.com/address/0x28866bf156152966b5872bee39bc05b5b5eedb02)  
Shop [0x7fb574e4fbe876f751fec90e59686c2776df19f9](https://ftmscan.com/address/0x7fb574e4fbe876f751fec90e59686c2776df19f9)  
RoyaltyReceiver [0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b](https://ftmscan.com/address/0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b)  
AdminAccess [0xe63b7195b301b9313c9e337df4aceac436c3751e](https://ftmscan.com/address/0xe63b7195b301b9313c9e337df4aceac436c3751e)  
ItemNFTLibrary [0x91ad699cce43d8c6133d9e97a794d5c381e0fce0](https://ftmscan.com/address/0x91ad699cce43d8c6133d9e97a794d5c381e0fce0)  
ItemNFT [0x4b9c90ebb1fa98d9724db46c4689994b46706f5a](https://ftmscan.com/address/0x4b9c90ebb1fa98d9724db46c4689994b46706f5a)  
EstforLibrary [0x4ab5ccd48c4f64a2dd64b1417394415879eedd02](https://ftmscan.com/address/0x4ab5ccd48c4f64a2dd64b1417394415879eedd02)  
PlayerNFT [0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9](https://ftmscan.com/address/0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9)  
PromotionsLibrary [0x861718E0c56b6A76D95a92A818DeeAFF5FfBCa36](https://ftmscan.com/address/0x861718E0c56b6A76D95a92A818DeeAFF5FfBCa36)  
Promotions [0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4](https://ftmscan.com/address/0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4)  
Quests [0x17c59f0d2d4f80FD0F906Df53a28272736c7b455](https://ftmscan.com/address/0x17c59f0d2d4f80FD0F906Df53a28272736c7b455)  
Clans [0x334caa8907bdf49470f7b085380c25431ef96f6d](https://ftmscan.com/address/0x334caa8907bdf49470f7b085380c25431ef96f6d)  
WishingWell [0x0a8d80ce4855666b7d7121d75f2a49aac434a918](https://ftmscan.com/address/0x0a8d80ce4855666b7d7121d75f2a49aac434a918)  
Bank Beacon [0xe183a43881eac74808c55bdb2a073929602af4db](https://ftmscan.com/address/0xe183a43881eac74808c55bdb2a073929602af4db)

PlayersLibrary [0x7f3d2f36b3b3181e01fe4048dd9ba63be3440710](https://ftmscan.com/address/0x7f3d2f36b3b3181e01fe4048dd9ba63be3440710)  
PlayersImplQueueActions [0xa84314f52b6811e6e26c25d63b655108d6a16c02](https://ftmscan.com/address/0xa84314f52b6811e6e26c25d63b655108d6a16c02)  
PlayersImplProcessActions [0x51bb1f55fe017f0df121c1c1cdd192ae96f32516](https://ftmscan.com/address/0x51bb1f55fe017f0df121c1c1cdd192ae96f32516)  
PlayersImplRewards [0xfa69a967bf8a35b456c56c19d644fc1a819da833](https://ftmscan.com/address/0xfa69a967bf8a35b456c56c19d644fc1a819da833)  
PlayersImplMisc [0x5e2a2a50f1b6afff7d588dccac0a4f0252f589fa](https://ftmscan.com/address/0x5e2a2a50f1b6afff7d588dccac0a4f0252f589fa)  
PlayersImplMisc1 [0x84dacfda4ae5831e388f62692fb697dffc89ca53](https://ftmscan.com/address/0x84dacfda4ae5831e388f62692fb697dffc89ca53)  
Players [0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143](https://ftmscan.com/address/0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143)

BankRegistry [0x55a1b0251e1375bd41dd9778c379322e3863a54e](https://ftmscan.com/address/0x55a1b0251e1375bd41dd9778c379322e3863a54e)  
BankFactory [0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4](https://ftmscan.com/address/0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4)

InstantActions [0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe](https://ftmscan.com/address/0x7e89fe755b546b10ea8372b056ea0d7b26cf36fe)

ClanBattleLibrary [](https://ftmscan.com/address/)  
LockedBankVault [](https://ftmscan.com/address/)  
Territories [](https://ftmscan.com/address/)  
DecoratorProvider [](https://ftmscan.com/address/)

### Fantom mainnet beta deployed contract addresses:

WorldLibrary [0x8e18dba6eba3e1e959a011695027ddb2b468e2f9](https://ftmscan.com/address/0x8e18dba6eba3e1e959a011695027ddb2b468e2f9)  
World [0xe2f0b5cb118da85be68de1801d40726ce48009aa](https://ftmscan.com/address/0xe2f0b5cb118da85be68de1801d40726ce48009aa)  
Shop [0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30](https://ftmscan.com/address/0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30)  
RoyaltyReceiver [0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e](https://ftmscan.com/address/0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e)  
AdminAccess [0xa298f1636dacab0db352fec84d2079814e0ce778](https://ftmscan.com/address/0xa298f1636dacab0db352fec84d2079814e0ce778)  
ItemNFTLibrary [0x22496409ef2407cd675195a604d0784a223c6028](https://ftmscan.com/address/0x22496409ef2407cd675195a604d0784a223c6028)  
ItemNFT [0x1dae89b469d15b0ded980007dfdc8e68c363203d](https://ftmscan.com/address/0x1dae89b469d15b0ded980007dfdc8e68c363203d)  
EstforLibrary [0x5700909581d61b380ff7177f9a9709b9d3321c04](https://ftmscan.com/address/0x5700909581d61b380ff7177f9a9709b9d3321c04)  
PlayerNFT [0xde70e49756322afdf7714d3aca963abcb4547b8d](https://ftmscan.com/address/0xde70e49756322afdf7714d3aca963abcb4547b8d)  
PromotionsLibrary [0xFB1F5dEeE960C1e841Ba54919da6628588d7A541](https://ftmscan.com/address/ 0xFB1F5dEeE960C1e841Ba54919da6628588d7A541)  
Promotions [0xf28cab48e29be56fcc68574b5c147b780c35647c](https://ftmscan.com/address/0xf28cab48e29be56fcc68574b5c147b780c35647c)  
Quests [0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9](https://ftmscan.com/address/0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9)  
Clans [0xd35410f526db135f09bb8e2bb066c8a63135d812](https://ftmscan.com/address/0xd35410f526db135f09bb8e2bb066c8a63135d812)  
WishingWell [0xdd1131f57e5e416622fa2b61d4108822e8cc38dc](https://ftmscan.com/address/0xdd1131f57e5e416622fa2b61d4108822e8cc38dc)  
Bank Beacon [0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e](https://ftmscan.com/address/0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e)

PlayersLibrary [0x30267dab4833af17624b7c6c3ec7c58a5e0a3fda](https://ftmscan.com/address/0x30267dab4833af17624b7c6c3ec7c58a5e0a3fda)  
PlayersImplQueueActions [0x68e2542c46957f2ff999bc3d6dac33e29fa3709c](https://ftmscan.com/address/0x68e2542c46957f2ff999bc3d6dac33e29fa3709c)  
PlayersImplProcessActions [0xf22b146ae7af1e1990cf4326cecaac910edc2b50](https://ftmscan.com/address/0xf22b146ae7af1e1990cf4326cecaac910edc2b50)  
PlayersImplRewards [0xafd93adb9c96db6d454c78d2edb8b0ea0bd32f88](https://ftmscan.com/address/0xafd93adb9c96db6d454c78d2edb8b0ea0bd32f88)  
PlayersImplMisc [0xc1e7d4fa974f46d906296c90b6c0ce3ac0145483](https://ftmscan.com/address/0xc1e7d4fa974f46d906296c90b6c0ce3ac0145483)  
PlayersImplMisc1 [0x9551f0bb149f5cdbdf56a732fd4784630bf4dd20](https://ftmscan.com/address/0x9551f0bb149f5cdbdf56a732fd4784630bf4dd20)  
Players [0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be](https://ftmscan.com/address/0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be)

BankRegistry [0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0](https://ftmscan.com/address/0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0)  
BankProxy [0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb](https://ftmscan.com/address/0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb)  
BankFactory [0x7b8197e7d7352e8910a7af79a9184f50290403da](https://ftmscan.com/address/0x7b8197e7d7352e8910a7af79a9184f50290403da)

InstantActions [0xe9a1a09be4a64f806a26b33fbdf07a6f3e61af76](https://ftmscan.com/address/0xe9a1a09be4a64f806a26b33fbdf07a6f3e61af76)

ClanBattleLibrary [0xfe975aecd5a10aade85c2f2cc8f5d52b148bd0d3](https://ftmscan.com/address/0xfe975aecd5a10aade85c2f2cc8f5d52b148bd0d3)  
LockedBankVault [0x49c8f367ef32c2d949028e6f151c0388283c7984](https://ftmscan.com/address/0x49c8f367ef32c2d949028e6f151c0388283c7984)  
Territories [0xe2c9ce95ad783bf37201c07bec443eb518637ccc](https://ftmscan.com/address/0xe2c9ce95ad783bf37201c07bec443eb518637ccc)  
DecoratorProvider [0xea8c4d188eb8d9704bc36931d89ba4f8e935cee2](https://ftmscan.com/address/0xea8c4d188eb8d9704bc36931d89ba4f8e935cee2)

### Other addresses:

BRUSH [0x85dec8c4b2680793661bca91a8f129607571863d](https://ftmscan.com/address/0x85dec8c4b2680793661bca91a8f129607571863d)
