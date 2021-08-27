require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers");
require('babel-register')
require('babel-polyfill')

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const MNEMONIC = process.env.MNEMONIC || 'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
const API_KEY = process.env.API_KEY

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "localhost",
  networks: {
    hardhat: {
      accounts: {mnemonic: MNEMONIC},
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: 'http://127.0.0.1:9545',
      allowUnlimitedContractSize: true,
    },
    root: {
      url: "http://127.0.0.1:9545",
      allowUnlimitedContractSize: true,
    },
    child: {
      url: "http://127.0.0.1:8545",
      allowUnlimitedContractSize: true,
      gas: 700000000,
    },
  },
  mocha: {
    timeout: 500000
  },
  solidity: "0.5.17",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    evmVersion: 'istanbul'
  },
};
