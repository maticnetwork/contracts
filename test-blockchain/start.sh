#!/usr/bin/env sh

CWD=$PWD

BUILD_DIR=$GOPATH/src/github.com/ethereum/go-ethereum/build/bin

$BUILD_DIR/geth --datadir $PWD/data init $PWD/genesis.json
cp -rf $PWD/keystore $PWD/data/

nohup $BUILD_DIR/geth --datadir data \
  --port 30341 \
  --rpc --rpcaddr '0.0.0.0' \
  --rpcvhosts '*' \
  --rpccorsdomain '*' \
  --rpcport 8545 \
  --ipcpath $PWD/node$1/geth.ipc \
  --rpcapi 'personal,db,eth,net,web3,txpool,miner,admin' \
  --syncmode 'full' \
  --networkid '13' \
  --gasprice '0' \
  --unlock '0x9fb29aac15b9a4b7f17c3385939b007540f4d791' \
  --password password.txt \
  --allow-insecure-unlock \
  --mine > $CWD/data/node.log 2>&1 &
echo $! > $CWD/data/node.pid
echo "Node started. Check test-blockchain/data/node.log for more logs"
