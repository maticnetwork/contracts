require('babel-register')
require('babel-polyfill')

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised).should()

var HDWalletProvider = require('truffle-hdwallet-provider')

const MNEMONIC =
  process.env.MNEMONIC ||
  'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
const API_KEY = process.env.API_KEY
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: 'localhost',
      port: 9545,
      network_id: '*', // match any network
      skipDryRun: true,
      gas: 7000000
    },
    bor: {
      provider: () =>
        new HDWalletProvider(
          MNEMONIC,
          `http://localhost:8545`
        ),
      network_id: '*', // match any network
      gasPrice: '0'
    },
    ropsten: {
      provider: () =>
        new HDWalletProvider(
          MNEMONIC,
          `https://ropsten.infura.io/v3/${API_KEY}`
        ),
      network_id: 3,
      gas: 7000000,
      gasPrice: 10000000000, // 10 gwei
      skipDryRun: true
      // confirmations: 5
    },
    goerli: {
      provider: function() {
        return new HDWalletProvider(
          MNEMONIC,
          `https://goerli.infura.io/v3/${API_KEY}`
        )
      },
      network_id: 5,
      gas: 8000000,
      gasPrice: 5000000000, // 5 gwei
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(
          MNEMONIC,
          `https://kovan.infura.io/v3/${API_KEY}`
        )
      },
      network_id: 42,
      gas: 8000000
    },
    mainnet: {
      provider: function() {
        return new HDWalletProvider(
          MNEMONIC,
          `https://mainnet.infura.io/v3/${API_KEY}`
        )
      },
      network_id: 1,
      gas: 4000000
    }
  },
  compilers: {
    solc: {
      version: '0.5.17',
      docker: true,
      parser: 'solcjs',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: 'constantinople'
      }
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
      currency: 'USD',
      gasPrice: 21,
      outputFile: '/dev/null',
      showTimeSpent: true
    }
  },
  plugins: ['solidity-coverage', 'truffle-plugin-verify', 'truffle-contract-size'],
  verify: {
    preamble: 'Matic network contracts'
  },
  api_keys: {
    etherscan: ETHERSCAN_API_KEY
  }
}
