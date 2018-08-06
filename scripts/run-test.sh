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
  bash $PWD/test-blockchain/clean.sh
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

start_geth() {
  bash $PWD/test-blockchain/clean.sh
  bash $PWD/test-blockchain/start.sh
}

echo "Starting our own testrpc instance"
start_testrpc

echo "Starting our own geth instance"
start_geth

npm run truffle:test "$@"
