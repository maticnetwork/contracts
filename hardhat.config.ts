import '@nomiclabs/hardhat-truffle5'
import 'hardhat-contract-sizer'
import '@typechain/hardhat'

const MNEMONIC = process.env.MNEMONIC || 'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
const API_KEY = process.env.API_KEY

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default {
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
  }
}
