module.exports = {
    mocha: {
        grep: "@skip-on-coverage", // Find everything with this tag
        invert: true               // Run the grep's inverse set.
    },
    providerOptions: {
        // port: 8545,
        mnemonic: "clock radar mass judge dismiss just intact mind resemble fringe diary casino",
        gasLimit: 9007199254740991,
        gasPrice: 0,
        allowUnlimitedContractSize: true
    },
    compileCommand: 'npm run truffle:compile'
};
