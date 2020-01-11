# Matic contracts

[![Build Status](https://travis-ci.org/maticnetwork/contracts.svg?branch=master)](https://travis-ci.org/maticnetwork/contracts)

Ethereum smart contracts that power the [Matic Network](https://matic.network).

### Install dependencies with

```
npm install
```

### Compile
```
npm run template:process
npm run truffle:compile
```

### Start main chain and side chain

- Start Main chain
```
npm run testrpc
```
- Start Matic side chain. Requires docker.
```
npm run bor:simulate
```
- If you ran a bor instance before, a dead docker container might still be lying around, clean it with
```
npm run bor:clean
```
- Run a bor (our matic chain node) instance.


### Deploy Contracts
- For local development
```
npm run truffle:migrate
```

- For a properly initialized set of contracts, follow the instructions [here](./deploy-migrations/README.md).

### Run tests
```
npm test
```
