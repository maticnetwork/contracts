require('babel-register')
require('babel-polyfill')

var HDWalletProvider = require('truffle-hdwallet-provider')
const MNEMONIC =
  'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
const API_KEY = ''
module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*' // match any network
    },
    dev: {
      host: 'localhost',
      port: 8546,
      network_id: '*' // match any network
    },
    local: {
      host: 'localhost',
      port: 8540,
      network_id: '*' // match any network
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(
          MNEMONIC,
          `https://ropsten.infura.io/${API_KEY}`
        )
      },
      network_id: 3,
      gas: 4000000
    },
    kovan: {
      provider: function() {
        return new HDWalletProvider(
          MNEMONIC,
          `https://kovan.infura.io/${API_KEY}`
        )
      },
      network_id: 42,
      gas: 8000000
    },
    mainnet: {
      provider: function() {
        return new HDWalletProvider(
          MNEMONIC,
          `https://mainnet.infura.io/${API_KEY}`
        )
      },
      network_id: 1,
      gas: 4000000
    },
    matic: {
      provider: function() {
        return new HDWalletProvider(MNEMONIC, `https://testnet.matic.network`)
      },
      network_id: 13,
      gas: 400000000
    }
  },
  // compilers: {
  //   solc: {
  //     version: '0.4.24',
  //     docker: true,
  //     settings: {
  //       optimizer: {
  //         enabled: true,
  //         runs: 200
  //       },
  //       evmVersion: 'byzantium'
  //     }
  //   }
  // },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
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
  }
}
