#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

# get current directory
PWD=$(pwd)

cleanup() {
  echo "Cleaning up"
  pkill -f geth
  pkill -f ganache-cli
  echo "Done"
}

start_testrpc() {
  npm run testrpc > /dev/null &
}

start_blockchain() {
  # if [ ! -d "$PWD/test-blockchain/geth" ]; then
  #   geth --datadir "$PWD/test-blockchain" init "$PWD/test-blockchain/genesis.json"
  # fi
  # geth --datadir "$PWD/test-blockchain" --targetgaslimit '900000000000000' --rpc --rpcport 8546 --rpccorsdomain "*" --wsorigins "*" --unlock "0x9fb29aac15b9a4b7f17c3385939b007540f4d791,0xacf8eccdca12a0eb6ae4fb1431e26c44e66decdb" --password "$PWD/scripts/password" --networkid 13 --mine > /dev/null &
  # geth_pid=$!
  cd $PWD/test-blockchain
  bash clean.sh
  bash start.sh
  cd ..
}


echo "Starting our own testrpc instance"
start_testrpc

echo "Starting our own geth instance"
start_blockchain

npm run truffle:test "$@"
