# Polygon contracts

![Build Status](https://github.com/maticnetwork/contracts/workflows/CI/badge.svg)

Ethereum smart contracts that power [Polygon sidechain](https://polygon.technology).

### Prerequesties

Yarn and Node 14

### Install dependencies with

```
yarn
```

### Preprocess templates for local BOR

bor-chain-id for Mainnet = 137
bor-chain-id for Testnet (Mumbai) = 15001

For local development you should go with 15001 chain id

```
npm run template:process -- --bor-chain-id <bor-chain-id>
```

### Start root chain and child chain

- Start Root chain

```
yarn testrpc
```

- Start Matic side chain. Requires docker.

```
yarn bor:simulate
```

- If you ran a bor instance before, a dead docker container might still be lying around, clean it with

```
yarn bor:clean
```

- Run a bor (our matic chain node) instance.

### Deploy Contracts

- For local development

```
yarn deploy:all --network root --child-url CHILD_URL
```

By default child url is http://localhost:8545


### Run tests

```
yarn test
```
