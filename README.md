# Matic contracts

[![Build Status](https://travis-ci.org/maticnetwork/contracts.svg?branch=master)](https://travis-ci.org/maticnetwork/contracts)

Ethereum smart contracts that power the [Matic Network](https://matic.network).

### Install dependencies with

```
npm install
```

### Compile
```
npm run truffle:compile
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

### Migrate
For development
```
npm run truffle:migrate
```

For deploying contracts
```
rm -rf migrations
mv deploy-migrations migrations
npm run truffle:migrate:deploy
```

### Run tests
```
$ npm test
```
