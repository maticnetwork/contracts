#!/usr/bin/env sh

CWD=$PWD

if [ -z "$GOPATH" ]
then
  GETH=geth
  DIR=/bordata
else
  GETH=$GOPATH/src/github.com/ethereum/go-ethereum/build/bin/geth
  DIR=$CWD
fi

mkdir $DIR/data
$GETH --datadir $DIR/data init $DIR/genesis.json
cp -rf $DIR/keystore $DIR/data/

$GETH --datadir $DIR/data \
  --port 30341 \
  --rpc --rpcaddr '0.0.0.0' \
  --rpcvhosts '*' \
  --rpccorsdomain '*' \
  --rpcport 8545 \
  --ipcpath $DIR/geth.ipc \
  --rpcapi 'personal,db,eth,net,web3,txpool,miner,admin' \
  --syncmode 'full' \
  --networkid '15001' \
  --gasprice '0' \
  --unlock '0x9fb29aac15b9a4b7f17c3385939b007540f4d791,0x96C42C56fdb78294F96B0cFa33c92bed7D75F96a' \
  --password $DIR/password.txt \
  --allow-insecure-unlock \
  --mine > $DIR/data/node.log &
tail -f $DIR/data/node.log
