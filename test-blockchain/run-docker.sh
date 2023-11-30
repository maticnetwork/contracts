#!/usr/bin/env sh
set -xe

docker run --name bor-test -it -d -p 8545:8545 -v $(pwd):/bordata --entrypoint /bin/sh 0xpolygon/bor:1.2.0 -c "cd /bordata; sh start.sh"
