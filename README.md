# Matic contracts

![Build Status](https://github.com/maticnetwork/contracts/workflows/CI/badge.svg)

Ethereum smart contracts that power the [Matic Network](https://matic.network).

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
```# Create a folder
$ mkdir actions-runner && cd actions-runner# Download the latest runner package
$ curl -o actions-runner-linux-x64-2.289.2.tar.gz -L https://github.com/actions/runner/releases/download/v2.289.2/actions-runner-linux-x64-2.289.2.tar.gz# Optional: Validate the hash
$ echo "7ba89bb75397896a76e98197633c087a9499d4c1db7603f21910e135b0d0a238  actions-runner-linux-x64-2.289.2.tar.gz" | shasum -a 256 -c# Extract the installer
$ tar xzf ./actions-runner-linux-x64-2.289.2.tar.gzu
