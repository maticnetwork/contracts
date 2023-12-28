module.exports = {
    mocha: {
        grep: "@skip-on-coverage", // Find everything with this tag
        invert: true               // Run the grep's inverse set.
    },
    compileCommand: 'npx hardhat compile'
}
