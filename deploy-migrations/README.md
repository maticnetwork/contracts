# Deploy Contracts
1. Use Infura to point to the main chain node (Ethereum ropsten)
```
export API_KEY=<infura api key>
export MNEMONIC=<mnemonic>
```
2. Use Bor node to point the matic chain
Update the chain url in `networks.matic` key in [truffle-config.js](./truffle-config.js).

3. Compile contracts
```
npm run truffle:compile
```

4. Check account that you are deploying from has ropsten ether.

5. Deploy contracts
```
mv migrations dev-migrations && cp -r deploy-migrations migrations

(local)
npm run truffle:migrate -- --reset --network development --to 2
npm run truffle:migrate -- --reset --network development --from 3 --to 3
npm run truffle:migrate -- --reset --network matic_dev --from 4 --to 4
npm run truffle:migrate -- --network development --from 5 --to 5

(ropsten)
npm run truffle:migrate -- --network ropsten --to 2
npm run truffle:migrate -- --network ropsten --from 3 --to 3
npm run truffle:migrate -- --network matic --from 4 --to 4
npm run truffle:migrate -- --network ropsten --from 5 --to 5
```
