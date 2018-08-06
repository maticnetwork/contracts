#!/usr/bin/env sh

CWD=$PWD/test-blockchain

pkill -F $CWD/bootnode.pid
rm $CWD/bootnode.log $CWD/bootnode.pid

pkill -F $CWD/data1/node.pid
rm -rf $CWD/data1/*
mkdir -p $CWD/data1/keystore

pkill -F $CWD/data2/node.pid
rm -rf $CWD/data2/*
mkdir -p $CWD/data2/keystore

cp $CWD/keystore/UTC--2018-02-19T10-26-21.638675000Z--9fb29aac15b9a4b7f17c3385939b007540f4d791 $CWD/data1/keystore/
# cp $CWD/keystore/UTC--2018-02-18T14-45-31.445018000Z--acf8eccdca12a0eb6ae4fb1431e26c44e66decdb $CWD/data1/keystore/
# cp $CWD/keystore/UTC--2018-02-19T10-26-21.638675000Z--9fb29aac15b9a4b7f17c3385939b007540f4d791 $CWD/data2/keystore/
cp $CWD/keystore/UTC--2018-02-18T14-45-31.445018000Z--acf8eccdca12a0eb6ae4fb1431e26c44e66decdb $CWD/data2/keystore/

geth --datadir "$CWD/data1" init $CWD/genesis.json
geth --datadir "$CWD/data2" init $CWD/genesis.json
