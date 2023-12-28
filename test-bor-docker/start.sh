#!/usr/bin/env sh

BOR=bor
DIR=$PWD

mkdir $DIR/data
$BOR --datadir $DIR/data init $DIR/genesis.json
cp -rf $DIR/keystore $DIR/data/

$BOR --datadir $DIR/data \
  --port 30303 \
  --http --http.addr '0.0.0.0' \
  --http.vhosts '*' \
  --http.corsdomain '*' \
  --http.port 9545 \
  --ipcdisable \
  --http.api 'personal,db,eth,net,web3,txpool,miner,admin,bor' \
  --syncmode 'full' \
  --networkid '15001' \
  --unlock '0x9fb29aac15b9a4b7f17c3385939b007540f4d791, 0x96C42C56fdb78294F96B0cFa33c92bed7D75F96a' \
  --password $DIR/password.txt \
  --allow-insecure-unlock \
  --miner.gastarget '20000000' \
  --miner.gaslimit '20000000' \
  --bor.withoutheimdall \
  --mine
