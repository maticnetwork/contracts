#!/usr/bin/env sh

CWD=$PWD

/usr/bin/parity --config $CWD/config.toml
# echo $! > $CWD/data/node.pid
echo "Node started. Check test-blockchain/data/node.log for more logs"
