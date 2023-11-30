#!/usr/bin/env sh

docker run --name bor-test -it -d -p 8545:8545 -v $(pwd):/bordata 0xpolygon/bor:v1.2.0 /bin/sh -c "cd /bordata; sh start.sh"
