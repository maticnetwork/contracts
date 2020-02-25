
module.exports = {
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true               // Run the grep's inverse set.
  },
  providerOptions: {
    // hardfork: 'istanbul',
    // port: 8545,
    mnemonic: "clock radar mass judge dismiss just intact mind resemble fringe diary casino",
    gasLimit: 8000000,
    gasPrice: 0
  },
  skipFiles: [
    'root/',
    'child/'
  ],
  compileCommand: 'npm run truffle:compile'
};
