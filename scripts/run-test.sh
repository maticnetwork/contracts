#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

# get current directory
PWD=$(pwd)

cleanup() {
  if [ "$GITHUB_ACTIONS" != true ] ; then
    echo "Cleaning up"
    pkill -f ganache
    cd $PWD/test-blockchain
    bash stop-docker.sh
    bash clean.sh
    cd ..
    echo "Done"
  fi
}

start_testrpc() {
  npm run testrpc > /dev/null &
}

start_blockchain() {
  cd $PWD/test-blockchain
  bash run-docker.sh
  cd ..
}


echo "Starting our own ganache (L1) instance"
start_testrpc

echo "Starting our own bor (L2) instance"
start_blockchain

if [ "$SOLIDITY_COVERAGE" = true ]; then
  npm run truffle:coverage "$@"
else
  npm run truffle:test "$@"
fi
