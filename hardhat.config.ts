import "dotenv/config";

import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";

import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-solhint";

import "@openzeppelin/hardhat-upgrades";

import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-storage-layout";
import "solidity-coverage";
import {ethers} from "ethers";
import {SolcUserConfig} from "hardhat/types";

const defaultConfig: SolcUserConfig = {
  version: "0.8.20",
  settings: {
    evmVersion: "paris",
    optimizer: {
      enabled: true,
      runs: 9999999,
      details: {
        yul: true,
      },
    },
    viaIR: true, // Change to false when running coverage
    outputSelection: {
      "*": {
        "*": ["storageLayout"],
      },
    },
  },
};

const lowRunsConfig: SolcUserConfig = {
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    optimizer: {
      ...defaultConfig.settings.optimizer,
      runs: 2000,
    },
  },
};

const mediumRunsConfig: SolcUserConfig = {
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    optimizer: {
      ...defaultConfig.settings.optimizer,
      runs: 5000,
    },
  },
};

const highRunsConfig: SolcUserConfig = {
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    optimizer: {
      ...defaultConfig.settings.optimizer,
      runs: 50000,
    },
  },
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [defaultConfig, mediumRunsConfig, lowRunsConfig, highRunsConfig],
    overrides: {
      "contracts/Clans/Clans.sol": mediumRunsConfig,
      "contracts/ItemNFT.sol": highRunsConfig,
      "contracts/Players/Players.sol": highRunsConfig,
      "contracts/Players/PlayersImplProcessActions.sol": lowRunsConfig,
      "contracts/Players/PlayersImplRewards.sol": mediumRunsConfig,
      "contracts/Players/PlayersImplQueueActions.sol": mediumRunsConfig,
    },
  },
  gasReporter: {
    enabled: true,
  },
  networks: {
    hardhat: {
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      allowUnlimitedContractSize: true,
    },
    ftm: {
      url: process.env.FTM_RPC,
      accounts: [process.env.PRIVATE_KEY as string, process.env.PRIVATE_KEY1 as string],
      gasPrice: ethers.utils.parseUnits("34", "gwei").toNumber(),
    },
    ftm_testnet: {
      url: process.env.FTM_RPC_TESTNET,
      accounts: [process.env.PRIVATE_KEY as string, process.env.PRIVATE_KEY1 as string],
      gasPrice: ethers.utils.parseUnits("150", "gwei").toNumber(),
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
};

export default config;
