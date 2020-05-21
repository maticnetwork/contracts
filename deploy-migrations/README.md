# Deploy Contracts

### :one: We have some network configrations available.

| Network Name |                   URL                   | Network ID |
| ------------ | :-------------------------------------: | ---------: |
| ropsten      | https://ropsten.infura.io/v3/${API_KEY} |          3 |
| mainnet      | https://mainnet.infura.io/v3/${API_KEY} |          1 |
| development  |          http://localhost:9545          |         \* |
| bor          |          http://localhost:8545          |         \* |

Feel free to add your own. Update the chain url in `networks.matic` key in [truffle-config.js](../truffle-config.js).

### :two: Export variables

```
// (Optional) Only if you are using ethereum testnets
export API_KEY=<Infura PROJECT ID>

// For `developement` networks you can use the mnemonic present in package.json
export MNEMONIC=<mnemonic>

export HEIMDALL_ID=<>
e.g. export HEIMDALL_ID="heimdall-P5rXwg"
```
### :three: Choose Bor Chain Id
```
npm run template:process -- --bor-chain-id <bor-chain-id>
for instance, npm run template:process -- --bor-chain-id 15001
```
### :four: Compile contracts

```
npm run truffle:compile
```

### :five: Deploy contracts

We need to deploy our set of contracts on 2 chains:

- Base Chain: Ideally a higher security EVM chain which can be used for dispute resolution. For testing ganache or any other EVM chain should work.
- Child Chain: EVM compatible chain to work as our sidechain. For testing note that using `ganache` for child-chain is not recommended, instead invoking `npm run bor:simulate` would be better.

```
mv migrations dev-migrations && cp -r deploy-migrations migrations

// Root contracts are deployed on base chain
npm run truffle:migrate -- --reset --to 3 --network <base_chain_network_name>

// Contracts like ChildERC20Token are deployed on child chain aka BOR chain
// NOTE: You need to deploy or simulate BOR before running the below command
npm run truffle:migrate -- --reset -f 4 --to 4 --network <child_chain_network_name>


// Contracts deployed on BOR are mapped to the registry contract deployed on-chain
npm run truffle:migrate -- -f 5 --to 5 --network <base_chain_network_name>
```

Post successfull deployment all contract addresses will be written to a `contractAddresses.json` file.

> Check account that you are deploying from has ether for the network you are deploying on.

### :six: Stake to become a validator
```
// (Optional) Export mnemonic or the private key (without the 0x prefix)
// This account needs to have test token
export MNEMONIC=<>

// (Optional) Infura PROJECT ID, if required
export API_KEY=<PROJECT_ID>

npm run truffle exec scripts/stake.js -- --network <base_chain_network_name> <validator_account> <pub_key> <# tokens to stake> <fee_topup>
```
