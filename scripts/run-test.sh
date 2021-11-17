#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT SIGINT SIGTERM ERR EXIT

# get current directory
PWD=$(pwd)

cleanup() {
  echo "Cleaning up"
  pkill -f "hardhat node"
  cd $PWD/test-blockchain
  bash stop-docker.sh
  bash clean.sh
  cd ..
  echo "Done"
}

start_testrpc() {
  yarn testrpc:root > /dev/null &
}

start_blockchain() {
  yarn bor:simulate
}


echo "Starting our own testrpc instance"
start_testrpc

echo "Starting our own bor instance"
start_blockchain

sleep 2

if [ "$SOLIDITY_COVERAGE" = true ]; then
  yarn coverage "$@"
else
  yarn test "$@"
fi


