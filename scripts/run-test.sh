#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

# get current directory
PWD=$(pwd)

cleanup() {
  echo "Cleaning up"
  pkill -f ganache-cli
  cd $PWD/test-blockchain
  bash clean.sh
  cd ..
  echo "Done"
}

start_testrpc() {
  npm run testrpc > /dev/null &
}

start_blockchain() {
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
