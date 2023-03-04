import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-storage-layout";
import "@openzeppelin/hardhat-upgrades";
import "solidity-coverage";

import dotenv from "dotenv";
dotenv.config(); // Store environment-specific variable from '.env' to process.env

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999,
        details: {
          yul: true,
        },
      },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
  gasReporter: {
    enabled: true,
  },
  networks: {
    hardhat: {
      gasPrice: 0,
      initialBaseFeePerGas: 0,
    },
    ftm: {
      url: process.env.FTM_RPC,
      accounts: [process.env.PRIVATE_KEY as string],
      gasPrice: 150000000000,
    },
    ftm_testnet: {
      url: process.env.FTM_RPC_TESTNET,
      accounts: [process.env.PRIVATE_KEY as string],
      gasPrice: 150000000000,
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
};

export default config;
