#!/usr/bin/env sh

CWD=$PWD

pkill -f parity

rm -rf $CWD/data/*
mkdir -p $CWD/data/keys/PrivatePoA
cp -rf $CWD/keys/* $CWD/data/keys/PrivatePoA/
