npm run truffle:compile
npm run truffle:migrate:augur -- --reset --to 4
npm run truffle:migrate:augur:bor -- --reset -f 5 --to 5
npm run truffle:migrate:augur -- -f 6 --to 6
mv contractAddresses.json ../predict/output/addresses.plasma.json
