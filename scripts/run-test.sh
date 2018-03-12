#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

# get current directory
PWD=$(pwd)

cleanup() {
  echo "Cleaning up"
  # Kill the testrpc instance that we started (if we started one and if it's still running).
  if [ -n "$testrpc_pid" ] && ps -p $testrpc_pid > /dev/null; then
    kill -9 $testrpc_pid
  fi

  # Kill the geth instance that we started (if we started one and if it's still running).
  if [ -n "$geth_pid" ] && ps -p $geth_pid > /dev/null; then
    kill -9 $geth_pid
  fi

  rm -rf $PWD/private-blockchain/geth
  echo "Done"
}

testrpc_port=8545
testrpc_running() {
  nc -z localhost "$testrpc_port"
}

geth_port=8546
geth_running() {
  nc -z localhost "$geth_port"
}

start_testrpc() {
  npm run testrpc > /dev/null &
  testrpc_pid=$!
}

start_geth() {
  if [ ! -d "$PWD/private-blockchain/geth" ]; then
    geth --datadir "$PWD/private-blockchain" init "$PWD/private-blockchain/genesis.json"
  fi
  geth --datadir "$PWD/private-blockchain" --targetgaslimit '900000000000000' --rpc --rpcport 8546 --rpccorsdomain "*" --wsorigins "*" --unlock "0x9fb29aac15b9a4b7f17c3385939b007540f4d791,0xacf8eccdca12a0eb6ae4fb1431e26c44e66decdb" --password "$PWD/scripts/password" --networkid 13 --mine > /dev/null &
  geth_pid=$!
}


if testrpc_running; then
  echo "Using existing testrpc instance"
else
  echo "Starting our own testrpc instance"
  start_testrpc
fi

if geth_running; then
  echo "Using existing geth instance"
else
  echo "Starting our own geth instance"
  start_geth
fi

npm run test "$@"
