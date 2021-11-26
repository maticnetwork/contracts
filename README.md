# Matic contracts

![Build Status](https://github.com/maticnetwork/contracts/workflows/CI/badge.svg)
![Forks](https://img.shields.io/github/forks/maticnetwork/contracts?style=social)
![Stars](https://img.shields.io/github/stars/maticnetwork/contracts?style=social)
![Languages](https://img.shields.io/github/languages/count/maticnetwork/contracts) 
![Issues](https://img.shields.io/github/issues/maticnetwork/contracts) 
![MIT License](https://img.shields.io/github/license/maticnetwork/contracts)
![contributors](https://img.shields.io/github/contributors-anon/maticnetwork/contracts)
![PRs](https://img.shields.io/github/issues-pr-raw/maticnetwork/contracts) 
![size](https://img.shields.io/github/languages/code-size/maticnetwork/contracts) 
![lines](https://img.shields.io/tokei/lines/github/maticnetwork/contracts)
[![Discord](https://img.shields.io/discord/714888181740339261?color=1C1CE1&label=Polygon%20%7C%20Discord%20%F0%9F%91%8B%20&style=flat-square)](https://discord.gg/zdwkdvMNY2)
[![Twitter Follow](https://img.shields.io/twitter/follow/0xPolygon.svg?style=social)](https://twitter.com/0xPolygon)


Ethereum smart contracts that power the [Polygon (Matic Network)](https://matic.network).

### Install dependencies with

```
npm install
```

### Compile

bor-chain-id for Mainnet = 137
bor-chain-id for TestnetV4 (Mumbai) = 80001

```
npm run template:process -- --bor-chain-id <bor-chain-id>
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
