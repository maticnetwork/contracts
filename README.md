# Matic contracts

[![Build Status](https://travis-ci.org/maticnetwork/contracts.svg?branch=master)](https://travis-ci.org/maticnetwork/contracts)

Ethereum smart contracts that power the [Matic Network](https://matic.network).

### Install dependencies with

```
npm install
```

### Start main chain and side chain

Start Main chain
```
npm run testrpc
```
Start Matic side chain
```
# Install parity
bash <(curl https://get.parity.io -L) -r stable
cd test-blockchain
bash start.sh

# Tail logs
tail -f data/node.log
```

### Compile
```
npm run truffle:compile
```

### Migrate
For development
```
npm run truffle:migrate
```

### Run tests
```
$ npm test
```
