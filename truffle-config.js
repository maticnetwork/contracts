require('babel-register')
require('babel-polyfill')

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
    }
  },
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
