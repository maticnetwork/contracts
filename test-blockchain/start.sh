#!/usr/bin/env sh

CWD=$PWD

nohup parity --config $CWD/config.toml > $CWD/data/node.log 2>&1 &
echo $! > $CWD/data/node.pid
echo "Node started. Check test-blockchain/data/node.log for more logs"
