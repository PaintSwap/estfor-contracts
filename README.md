# Estfor Kingdom contracts

![image](https://user-images.githubusercontent.com/84033732/223739503-c53a888a-443f-4fb5-98a3-d40f94956799.png)

[![Continuous integration](https://github.com/PaintSwap/estfor-contracts/actions/workflows/ci.yml/badge.svg)](https://github.com/PaintSwap/estfor-contracts/actions/workflows/ci.yml)

All the smart contract code for the Estfor Kingdom RPG game on the Fantom Blockchain.

Make sure `yarn` is installed (or replace with equivalent npm instructions)

These contracts use hardhat and require solidity 0.8.19 at minimum.

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

TODO

### Fantom mainnet beta deployed contract addresses:

WorldLibrary [0x5443085444f881a9aee41d51166ad0aef8af1232](https://ftmscan.com/address/0x5443085444f881a9aee41d51166ad0aef8af1232)  
World [0xe2f0b5cb118da85be68de1801d40726ce48009aa](https://ftmscan.com/address/0xe2f0b5cb118da85be68de1801d40726ce48009aa)  
Shop [0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30](https://ftmscan.com/address/0xc5e24fbaba1a945226ad2f882e14fc7b44dc1f30)  
RoyaltyReceiver [0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e](https://ftmscan.com/address/0xc5de7625e1b5cb91d92bc65fd4d787f01c43e38e)  
AdminAccess [0xa298f1636dacab0db352fec84d2079814e0ce778](https://ftmscan.com/address/0xa298f1636dacab0db352fec84d2079814e0ce778)  
ItemNFTLibrary [0xa73f74c0fbed265a656293a1a91a9506678e3d54](https://ftmscan.com/address/0xa73f74c0fbed265a656293a1a91a9506678e3d54)  
ItemNFT [0x1dae89b469d15b0ded980007dfdc8e68c363203d](https://ftmscan.com/address/0x1dae89b469d15b0ded980007dfdc8e68c363203d)  
EstforLibrary [0xd72e962997aa3b9dd114cdd729fe28b3f54f4a6b](https://ftmscan.com/address/0xd72e962997aa3b9dd114cdd729fe28b3f54f4a6b)  
PlayerNFT [0xde70e49756322afdf7714d3aca963abcb4547b8d](https://ftmscan.com/address/0xde70e49756322afdf7714d3aca963abcb4547b8d)  
Quests [0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9](https://ftmscan.com/address/0x96948a6df3a64cc2eb0a1825fccd26f0c93bfce9)

Clans [0xd35410f526db135f09bb8e2bb066c8a63135d812](https://ftmscan.com/address/0xd35410f526db135f09bb8e2bb066c8a63135d812)  
Bank Impl [0x804636b4ce117478f84744d3b340d98d3a138bd0](https://ftmscan.com/address/0x804636b4ce117478f84744d3b340d98d3a138bd0)

PlayersLibrary [0xe3779fbc31ec1e318a4354e8efe830e25d1c6df6](https://ftmscan.com/address/0xe3779fbc31ec1e318a4354e8efe830e25d1c6df6)  
PlayersImplQueueActions [0x1a11f2dc820927ebeb2fd1416aef08d875aa91d1](https://ftmscan.com/address/0x1a11f2dc820927ebeb2fd1416aef08d875aa91d1)  
PlayersImplProcessActions [0x2ed3c44b9108a59560f5fa1063cf3683834e252e](https://ftmscan.com/address/0x2ed3c44b9108a59560f5fa1063cf3683834e252e)  
PlayersImplRewards [0x89742a8389e1ca4d19957be8ddb1a018a3ea5c88](https://ftmscan.com/address/0x89742a8389e1ca4d19957be8ddb1a018a3ea5c88)  
PlayersImplMisc [0x1583e7703b99530a42021b2d803c55983aa97233](https://ftmscan.com/address/0x1583e7703b99530a42021b2d803c55983aa97233)  
Players [0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be](https://ftmscan.com/address/0x0aac9c0966ad5ea59cd0a47a0d415a68126ab7be)

playersLibrary = "0xe3779fbc31ec1e318a4354e8efe830e25d1c6df6"
playersImplQueueActions = "0x1a11f2dc820927ebeb2fd1416aef08d875aa91d1"
playersImplProcessActions = "0x2ed3c44b9108a59560f5fa1063cf3683834e252e"
playersImplRewards = "0x89742a8389e1ca4d19957be8ddb1a018a3ea5c88"
playersImplMisc = "0x1583e7703b99530a42021b2d803c55983aa97233"

BankRegistry [0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0](https://ftmscan.com/address/0xd5da02cee3d9ef0d63d1b79c659df16770c3c4e0)  
BankProxy [0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb](https://ftmscan.com/address/0xe1998e9bad94716ecf81f3a3bead5fed3fb023cb)  
BankFactory [0x7b8197e7d7352e8910a7af79a9184f50290403da](https://ftmscan.com/address/0x7b8197e7d7352e8910a7af79a9184f50290403da)

### Other addresses:

BRUSH [0x85dec8c4b2680793661bca91a8f129607571863d](https://ftmscan.com/address/0x85dec8c4b2680793661bca91a8f129607571863d)
