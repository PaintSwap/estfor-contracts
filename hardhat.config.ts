import "dotenv/config";

import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import "@nomiclabs/hardhat-solhint";

import "@openzeppelin/hardhat-upgrades";

import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-storage-layout";
import "hardhat-abi-exporter";
import "solidity-coverage";
import {parseUnits} from "ethers";
import {SolcUserConfig} from "hardhat/types";

const defaultConfig: SolcUserConfig = {
  version: "0.8.20",
  settings: {
    evmVersion: "shanghai",
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

const lowRunsConfig: SolcUserConfig = {
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    optimizer: {
      ...defaultConfig.settings.optimizer,
      runs: 1000,
    },
  },
};

const lowestRunsConfig: SolcUserConfig = {
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    optimizer: {
      ...defaultConfig.settings.optimizer,
      runs: 320,
    },
  },
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [defaultConfig, mediumRunsConfig, lowRunsConfig, lowestRunsConfig],
    overrides: {
      "contracts/Clans/Clans.sol": mediumRunsConfig,
      "contracts/Clans/LockedBankVaults.sol": lowRunsConfig,
      "contracts/Clans/Territories.sol": mediumRunsConfig,
      "contracts/Players/Players.sol": lowRunsConfig,
      "contracts/Players/PlayersImplMisc.sol": mediumRunsConfig,
      "contracts/Players/PlayersImplProcessActions.sol": mediumRunsConfig,
      "contracts/Players/PlayersImplQueueActions.sol": mediumRunsConfig,
      "contracts/Players/PlayersImplRewards.sol": mediumRunsConfig,
      "contracts/Promotions.sol": mediumRunsConfig,
      "contracts/World.sol": lowRunsConfig,
      "contracts/ItemNFT.sol": mediumRunsConfig,
      "contracts/PetNFT.sol": lowRunsConfig,
    },
  },
  gasReporter: {
    enabled: false,
    showMethodSig: true,
  },
  networks: {
    hardhat: {
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      allowUnlimitedContractSize: true,
    },
    fantom: {
      url: process.env.FANTOM_RPC,
      accounts: [process.env.PRIVATE_KEY as string, process.env.PRIVATE_KEY1 as string],
      gasPrice: parseInt(parseUnits("150", "gwei").toString(), 10),
    },
    fantom_testnet: {
      url: process.env.FANTOM_TESTNET_RPC,
      accounts: [process.env.PRIVATE_KEY as string, process.env.PRIVATE_KEY1 as string],
      gasPrice: parseInt(parseUnits("150", "gwei").toString(), 10),
    },
  },
  mocha: {
    timeout: 120 * 1000,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  abiExporter: {
    path: "./data/abi",
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
    format: "json",
    except: [
      "/ozUpgradeable",
      "/interfaces",
      "/test",
      "/helper",
      "/debug",
      "/legacy",
      "SamWitchVRFConsumerUpgradeable",
      "PlayersImpl*",
      "@openzeppelin",
    ],
  },
  typechain: {
    target: "ethers-v6",
  },
};

export default config;
