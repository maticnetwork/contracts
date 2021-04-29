#!/usr/bin/env bash

start_testrpc() {
  npm run testrpc
}

start_blockchain() {
  cd $PWD/test-blockchain
  bash run-docker.sh
  cd ..
}

echo "Starting our own geth instance"
start_blockchain

echo "Starting our own testrpc instance"
start_testrpc


