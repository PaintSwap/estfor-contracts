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

WorldLibrary [0x4457c8211eec0a1b805db0669dc2dd3c7957d1df](https://ftmscan.com/address/0x4457c8211eec0a1b805db0669dc2dd3c7957d1df)  
World [0x28866bf156152966b5872bee39bc05b5b5eedb02](https://ftmscan.com/address/0x28866bf156152966b5872bee39bc05b5b5eedb02)  
Shop [0x7fb574e4fbe876f751fec90e59686c2776df19f9](https://ftmscan.com/address/0x7fb574e4fbe876f751fec90e59686c2776df19f9)  
RoyaltyReceiver [0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b](https://ftmscan.com/address/0xc3d53b81042454aa5fcf5c4e95de3e796dddb28b)  
AdminAccess [0xe63b7195b301b9313c9e337df4aceac436c3751e](https://ftmscan.com/address/0xe63b7195b301b9313c9e337df4aceac436c3751e)  
ItemNFTLibrary [0x91ad699cce43d8c6133d9e97a794d5c381e0fce0](https://ftmscan.com/address/0x91ad699cce43d8c6133d9e97a794d5c381e0fce0)  
ItemNFT [0x4b9c90ebb1fa98d9724db46c4689994b46706f5a](https://ftmscan.com/address/0x4b9c90ebb1fa98d9724db46c4689994b46706f5a)  
EstforLibrary [0x4ab5ccd48c4f64a2dd64b1417394415879eedd02](https://ftmscan.com/address/0x4ab5ccd48c4f64a2dd64b1417394415879eedd02)  
PlayerNFT [0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9](https://ftmscan.com/address/0xb809ed839c691d465e2ec45e1bcb5e5aded50fb9)  
Promotions [0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4](https://ftmscan.com/address/0x7d1c598266Dd6Bb0Ed7a76161c11e5073D8A71A4)  
Quests [0x17c59f0d2d4f80FD0F906Df53a28272736c7b455](https://ftmscan.com/address/0x17c59f0d2d4f80FD0F906Df53a28272736c7b455)  
Clans [0x334caa8907bdf49470f7b085380c25431ef96f6d](https://ftmscan.com/address/0x334caa8907bdf49470f7b085380c25431ef96f6d)  
WishingWell [0x0a8d80ce4855666b7d7121d75f2a49aac434a918](https://ftmscan.com/address/0x0a8d80ce4855666b7d7121d75f2a49aac434a918)  
Bank Beacon [0xe183a43881eac74808c55bdb2a073929602af4db](https://ftmscan.com/address/0xe183a43881eac74808c55bdb2a073929602af4db)

PlayersLibrary [0x0ab89556b1e8f904544dfb34ee4d2954d6567d80](https://ftmscan.com/address/0x0ab89556b1e8f904544dfb34ee4d2954d6567d80)  
PlayersImplQueueActions [0x340d9c2f9ad35ef7f2b2a426190b8f16ceb83281](https://ftmscan.com/address/0x340d9c2f9ad35ef7f2b2a426190b8f16ceb83281)  
PlayersImplProcessActions [0x2c775ed7cc888836454287ea11242c01aa51c21c](https://ftmscan.com/address/0x2c775ed7cc888836454287ea11242c01aa51c21c)  
PlayersImplRewards [0x53e2f292161138c082111b49701cc03c1d175060](https://ftmscan.com/address/0x53e2f292161138c082111b49701cc03c1d175060)  
PlayersImplMisc [0xa4e121759bf5dbd7e7936254b26988dda892ba83](https://ftmscan.com/address/0xa4e121759bf5dbd7e7936254b26988dda892ba83)  
PlayersImplMisc1 [0x4f7d7624552776d51ff92927b45fe9223374b0b7](https://ftmscan.com/address/0x4f7d7624552776d51ff92927b45fe9223374b0b7)  
Players [0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143](https://ftmscan.com/address/0x058ec56aba13f7fee3ae9c9b91b3bb03bc336143)

BankRegistry [0x55a1b0251e1375bd41dd9778c379322e3863a54e](https://ftmscan.com/address/0x55a1b0251e1375bd41dd9778c379322e3863a54e)  
BankFactory [0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4](https://ftmscan.com/address/0x4af59427b2aeb66e6f7dca98c366ec66cca4e8d4)

InstantActions [TBD](https://ftmscan.com/address/)

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
Promotions [0xf28cab48e29be56fcc68574b5c147b780c35647c](https://ftmscan.com/address/0xf28cab48e29be56fcc68574b5c147b780c35647c)  
Quests [0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9](https://ftmscan.com/address/0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9)  
Clans [0xd35410f526db135f09bb8e2bb066c8a63135d812](https://ftmscan.com/address/0xd35410f526db135f09bb8e2bb066c8a63135d812)  
WishingWell [0xdd1131f57e5e416622fa2b61d4108822e8cc38dc](https://ftmscan.com/address/0xdd1131f57e5e416622fa2b61d4108822e8cc38dc)  
Bank Beacon [0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e](https://ftmscan.com/address/0x73d1b1420deaeb6474b8aafb1d8229d392d1a04e)

PlayersLibrary [0x4d6e98a7d0dae169a3aa9fd4a7fdf0298e602fa1](https://ftmscan.com/address/0x4d6e98a7d0dae169a3aa9fd4a7fdf0298e602fa1)  
PlayersImplQueueActions [0x4192f7b2ab046471a29b2e8e5031e98e00ff55a7](https://ftmscan.com/address/0x4192f7b2ab046471a29b2e8e5031e98e00ff55a7)  
PlayersImplProcessActions [0xdafa698c2c0722c503151728916f64f2fbebe303](https://ftmscan.com/address/0xdafa698c2c0722c503151728916f64f2fbebe303)  
PlayersImplRewards [0x9782185ae5f260379682fe9adc48d21e4f167af4](https://ftmscan.com/address/0x9782185ae5f260379682fe9adc48d21e4f167af4)  
PlayersImplMisc [0xfa4c0ee00a667517cf89a414edb3fe25a1d57e42](https://ftmscan.com/address/0xfa4c0ee00a667517cf89a414edb3fe25a1d57e42)  
PlayersImplMisc1 [0xa0514061144d8f5e038940e1382b26bee89ff564](https://ftmscan.com/address/0xa0514061144d8f5e038940e1382b26bee89ff564)  
Players [0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be](https://ftmscan.com/address/0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be)

BankRegistry [0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0](https://ftmscan.com/address/0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0)  
BankProxy [0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb](https://ftmscan.com/address/0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb)  
BankFactory [0x7b8197e7d7352e8910a7af79a9184f50290403da](https://ftmscan.com/address/0x7b8197e7d7352e8910a7af79a9184f50290403da)

InstantActions [0xe7f1725e7734ce288f8367e1bb143e90bb3f0512](https://ftmscan.com/address/0xe7f1725e7734ce288f8367e1bb143e90bb3f0512)

### Other addresses:

BRUSH [0x85dec8c4b2680793661bca91a8f129607571863d](https://ftmscan.com/address/0x85dec8c4b2680793661bca91a8f129607571863d)
