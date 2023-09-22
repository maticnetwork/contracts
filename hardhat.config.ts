import { HardhatUserConfig } from 'hardhat/types'

import '@nomiclabs/hardhat-truffle5'
import 'hardhat-contract-sizer'
import '@typechain/hardhat'
import '@nomiclabs/hardhat-etherscan'

import './lib/type-extensions'
import './tasks'

const MNEMONIC = process.env.MNEMONIC || 'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
const API_KEY = process.env.API_KEY

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts: { mnemonic: MNEMONIC },
      allowUnlimitedContractSize: true
    },
    root: {
      url: 'http://127.0.0.1:9545',
      accounts: { mnemonic: MNEMONIC },
      allowUnlimitedContractSize: true
    },
    child: {
      url: 'http://localhost:8545',
      gas: 20e6,
      chainId: 15001,
      allowUnlimitedContractSize: true
    },
    mainnet: {
      accounts: { mnemonic: MNEMONIC },
      url: `https://mainnet.infura.io/v3/${API_KEY}`,
      chainId: 1
    },
    goerli: {
      accounts: { mnemonic: MNEMONIC },
      url: `https://goerli.infura.io/v3/${API_KEY}`,
      chainId: 5
    }
  },
  mocha: {
    timeout: 500000
  },
  solidity: {
    version: '0.5.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: 'constantinople'
    }
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false
  },
  typechain: {
    outDir: 'typechain',
    target: 'truffle-v5',
    alwaysGenerateOverloads: false
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  },
  verify: {
    contracts: [
      'StakeManagerProxy',
      'StakeManager',
      'StakeManagerExtension',
      'RootChainProxy',
      'RootChain',
      'WithdrawManagerProxy',
      'WithdrawManager',
      'EventsHubProxy',
      'EventsHub',
      'ValidatorShareFactory',
      'ExitNFT',
      'DepositManagerProxy',
      'DepositManager'
    ]
  },
  paths: {
    sourceTemplates: 'contracts',
    sources: 'contracts-out'
  }
}

export default config
