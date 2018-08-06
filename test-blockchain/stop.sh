#!/usr/bin/env sh

CWD=$PWD/test-blockchain

pkill -F $CWD/bootnode.pid
pkill -F $CWD/data1/node.pid
pkill -F $CWD/data2/node.pid

rm $CWD/bootnode.pid
rm $CWD/data1/node.pid
rm $CWD/data2/node.pid
