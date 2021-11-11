import '@nomiclabs/hardhat-truffle5'
import 'hardhat-contract-sizer'
import '@typechain/hardhat'
import '@nomiclabs/hardhat-etherscan'
import { HardhatUserConfig } from 'hardhat/types'

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
      url: `https://mainnet.infura.io/v3/${API_KEY}`,
      chainId: 1
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
    strict: true
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
  }
}

export default config

// contracts: [
//   'StakeManagerProxy',
//   'RootChainProxy',
//   'WithdrawManagerProxy',
//   'EventsHubProxy',
//   'ValidatorShareFactory',
//   'ExitNFT',
//   'DepositManagerProxy'
// ]
