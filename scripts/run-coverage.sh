#!/usr/bin/env bash
# SOLIDITY_COVERAGE=true scripts/run-test.sh
SOLIDITY_COVERAGE=true truffle run coverage --network development --solcoverjs .solcover.js
