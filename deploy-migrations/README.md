# Deploy Contracts
1. Use Infura to point to the main chain node (Ethereum ropsten)
```
export API_KEY=<infura api key>
```
2. Use Bor node to point the matic chain
Update the chain url in `networks.matic` key in [truffle-config.js](./truffle-config.js).

3. Check `0x9fB29AAc15b9A4B7F17c3385939b007540f4d791` has ropsten ether.

3. Deploy contracts
```
mv migrations dev-migrations && cp -r deploy-migrations migrations

(local)
npm run truffle:migrate -- --reset --network development --to 2
npm run truffle:migrate -- --reset --network matic_dev --from 3 --to 3
npm run truffle:migrate -- --network development --from 4 --to 4

(ropsten)
npm run truffle:migrate -- --network ropsten --to 2
npm run truffle:migrate -- --network matic --from 3 --to 3
npm run truffle:migrate -- --network ropsten --from 4 --to 4
```
