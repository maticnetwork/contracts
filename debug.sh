#!/usr/bin/env sh
rm -rf test-blockchain/geth
geth --datadir "$PWD/test-blockchain" init "$PWD/test-blockchain/genesis.json"
geth --datadir "$PWD/test-blockchain" --targetgaslimit '900000000000000' --rpc --rpcport 8546 --rpccorsdomain "*" --wsorigins "*" --unlock "0x9fb29aac15b9a4b7f17c3385939b007540f4d791,0xacf8eccdca12a0eb6ae4fb1431e26c44e66decdb" --password "$PWD/scripts/password" --networkid 13 console
