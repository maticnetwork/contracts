# Matic contracts

[![Build Status](https://travis-ci.org/maticnetwork/contracts.svg?branch=master)](https://travis-ci.org/maticnetwork/contracts)

Matic contracts are ethereum smart contracts to power [Matic Network](https://matic.network).

### Install dependencies with

```
npm install
```

### Compile
```
npm run truffle:compile
```

### Start chains
```
npm run mainchain
npm run maticchain
```

### Migrate
```
npm run truffle:migrate
```
alternatively,
```
(deploy contracts on rootchain)
npm run truffle:migrate:1

(deploy contracts on matic chain)
npm run truffle:migrate:2

(map token on mainchain)
npm run truffle:migrate:3
```


### Run test cases:

```
# run test cases
$ npm run test:ci
```
