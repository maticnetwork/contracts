Scripts that read contract states from a chain and write the states to another chain.

Pre-requisite: contracts are already deployed on both chains.

Steps:

1. Modify contract address in the script. 
2. Run the script with custom environment variables.

Usage example
```bash
PRIVATE_KEY="0x..." NEW_CHAIN_ID=1337 npm run truffle exec scripts/migrate-states/rootChain.js
```

Environment variables:

```
PRIVATE_KEY: The private key of the account that will be used to send transactions.
NEW_CHAIN_ID: The chain id of the new chain.
OLD_CHAIN_PROVIDER: The provider of the old chain. Default: http://localhost:9546
NEW_CHAIN_PROVIDER: The provider of the new chain. Default: http://localhost:9545
```