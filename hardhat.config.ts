import "dotenv/config";

import {HardhatNetworkAccountUserConfig, SolcUserConfig, HardhatUserConfig} from "hardhat/types";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "hardhat-deploy";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";

import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-storage-layout";
import "hardhat-abi-exporter";
import "solidity-coverage";
import {ethers, parseUnits} from "ethers";

const defaultConfig: SolcUserConfig = {
  version: "0.8.28",
  settings: {
    evmVersion: "cancun",
    optimizer: {
      enabled: true,
      runs: 9999999,
      details: {
        yul: true
      }
    },
    viaIR: true,
    outputSelection: {
      "*": {
        "*": ["storageLayout"]
      }
    }
  }
};

const mediumRunsConfig: SolcUserConfig = {
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    optimizer: {
      ...defaultConfig.settings.optimizer,
      runs: 5000
    }
  }
};

const lowRunsConfig: SolcUserConfig = {
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    optimizer: {
      ...defaultConfig.settings.optimizer,
      runs: 1000
    }
  }
};

const lowestRunsConfig: SolcUserConfig = {
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    optimizer: {
      ...defaultConfig.settings.optimizer,
      runs: 320
    }
  }
};

const privateKey = process.env.PRIVATE_KEY as string;
const privateKey1 = process.env.PRIVATE_KEY1 as string;

const hardhatAccounts: HardhatNetworkAccountUserConfig[] = [
  {
    privateKey,
    balance: ethers.parseEther("100000").toString()
  },
  {
    privateKey: privateKey1,
    balance: ethers.parseEther("100000").toString()
  },
  {
    privateKey: process.env.PROPOSER_PRIVATE_KEY as string,
    balance: ethers.parseEther("100000").toString()
  }
];

const config: HardhatUserConfig = {
  solidity: {
    compilers: [defaultConfig, mediumRunsConfig, lowRunsConfig, lowestRunsConfig],
    overrides: {
      "contracts/Clans/Clans.sol": lowestRunsConfig,
      "contracts/Clans/LockedBankVaults.sol": lowRunsConfig,
      "contracts/Clans/Territories.sol": lowRunsConfig,
      "contracts/Clans/Raids.sol": lowestRunsConfig,
      "contracts/PassiveActions.sol": mediumRunsConfig,
      "contracts/Players/Players.sol": lowestRunsConfig,
      "contracts/Players/PlayersImplMisc.sol": lowRunsConfig,
      "contracts/Players/PlayersImplProcessActions.sol": lowRunsConfig,
      "contracts/Players/PlayersImplQueueActions.sol": lowestRunsConfig,
      "contracts/Players/PlayersImplRewards.sol": lowestRunsConfig,
      "contracts/Promotions.sol": mediumRunsConfig,
      "contracts/RandomnessBeacon.sol": lowRunsConfig,
      "contracts/ItemNFT.sol": mediumRunsConfig,
      "contracts/PetNFT.sol": lowestRunsConfig,
      "contracts/PlayerNFT.sol": mediumRunsConfig,
      "contracts/Bazaar/OrderBook.sol": lowRunsConfig
    }
  },
  gasReporter: {
    enabled: true,
    showMethodSig: true
  },
  networks: {
    hardhat: {
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      allowUnlimitedContractSize: true,
      accounts: process.env.USE_PRIVATE_KEY === "true" ? hardhatAccounts : {count: 20},
      forking:
        process.env.USE_HARDHAT_FORK === "true"
          ? {
              url: process.env.SONIC_RPC as string,
              blockNumber: process.env.FORK_BLOCK_NUMBER ? Number(process.env.FORK_BLOCK_NUMBER) : undefined
            }
          : undefined
    },
    sonic: {
      url: process.env.SONIC_RPC,
      accounts: [
        process.env.PRIVATE_KEY as string,
        process.env.PRIVATE_KEY1 as string,
        process.env.PROPOSER_PRIVATE_KEY as string
      ]
    },
    "sonic-blaze": {
      url: process.env.SONIC_BLAZE_RPC,
      accounts: [process.env.PRIVATE_KEY as string, process.env.PRIVATE_KEY1 as string]
    },
    fantom: {
      url: process.env.FANTOM_RPC,
      accounts: [process.env.PRIVATE_KEY as string, process.env.PRIVATE_KEY1 as string],
      gasPrice: Number(parseUnits("100", "gwei"))
    }
  },
  external: {
    contracts: [
      {
        // Specify the exact path
        artifacts: "node_modules/@layerzerolabs/test-devtools-evm-hardhat/artifacts",
        deploy: "node_modules/@layerzerolabs/test-devtools-evm-hardhat/deploy"
      }
    ],
    deployments: {
      hardhat: ["node_modules/@layerzerolabs/test-devtools-evm-hardhat/deployments/hardhat"]
    }
  },
  mocha: {
    timeout: 240 * 1000,
    slow: 1
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY as string,
    customChains: [
      {
        network: "sonic",
        chainId: 146,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sonicscan.org"
        }
      }
    ]
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
    except: ["test", "@openzeppelin", "@layerzerolabs"]
  },
  abiExporter: {
    path: "./data/abi",
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
    format: "json",
    except: ["/interfaces", "/test", "/helper", "@openzeppelin", "@layerzerolabs"]
  },
  typechain: {
    target: "ethers-v6"
  }
};

export default config;
