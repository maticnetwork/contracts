# Deploy Contracts

### :one: We have some network configrations available.

| Network Name |                   URL                   | Network ID |
| ------------ | :-------------------------------------: | ---------: |
| ropsten      | https://ropsten.infura.io/v3/${API_KEY} |          3 |
| mainnet      | https://mainnet.infura.io/v3/${API_KEY} |          1 |
| bor_testnet2 |     https://testnet2.matic.network      |       8995 |
| development  |          http://localhost:8545          |         \* |
| matic_dev    |          http://localhost:8546          |         \* |

Feel free to add your own. Update the chain url in `networks.matic` key in [truffle-config.js](../truffle-config.js).

### :two: Export variables

```
// (Optional) Only if you are using ethereum testnets
export API_KEY=<infura api key>

// For `developement` networks you can use the mnemonic present in package.json
export MNEMONIC=<mnemonic>
```

### :three: Compile contracts

```
npm run truffle:compile
```

### :four: Deploy contracts

We need to deploy our set of contracts on 2 chains:

- Base Chain: Ideally a higher security EVM chain which can be used for dispute resolution. For testing ganache or any other EVM chain should work.
- Child Chain: EVM compatible chain to work as our sidechain. For testing note that using `ganache` for child-chain is not recommended, instead invoking `npm run bor:simulate` would be better.

```
mv migrations dev-migrations && cp -r deploy-migrations migrations

// Root contracts are deployed on base chain
npm run truffle:migrate -- --reset --network <base_chain_network_name> --to 3

// Contracts like ChildERC20Token are deployed on child chain aka BOR chain
// NOTE: You need to deploy or simulate BOR before running the below command
npm run truffle:migrate -- --reset --network <child_chain_network_name> -f 4 --to 4


// Contracts deployed on BOR are mapped to the registry contract deployed on-chain
npm run truffle:migrate -- --network <base_chain_network_name> -f 5 --to 5
```

Post successfull deployment all contract addresses will be written to a `contractAddresses.json` file.

> Check account that you are deploying from has ether for the network you are deploying on.

### :five: Stake to become a validator
```
// (Optional) Export mnemonic or the private key (without the 0x prefix)
// This account needs to have test token
export MNEMONIC=<>

// (Optional) Infura PROJECT ID, if required
export API_KEY=<PROJECT_ID>

npm run truffle exec scripts/stake.js -- --network <base_chain_network_name>
```