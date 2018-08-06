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
  pkill -f ganache-cli

  # stop & clean test blockchain
  cd test-blockchain
  bash $PWD/clean.sh
  pkill -f geth

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
}

start_parity() {
  cd $PWD/test-blockchain
  bash $PWD/clean.sh
  bash $PWD/start.sh
  cd $PWD/..
}

echo "Starting our own testrpc instance"
start_testrpc

echo "Starting our own geth instance"
start_parity

tail -f $PWD/test-blockchain/data/node.log
#npm run truffle:test "$@"
