#!/usr/bin/env sh

# current working directory
CWD=$PWD/test-blockchain

nohup bootnode -nodekey bootnode.key > $CWD/bootnode.log 2>&1 &
echo $! > $CWD/bootnode.pid
echo "Bootnode stared."

sleep 2

nohup geth \
  --bootnodes enode://744ae75e44fb51f95a92a5ca29f8f8273b2501e3025157e9fca30b01a4baf2c01912dc9269a24b6c14642551d7dc50479244a7e5cd35e09446850730967520f3@127.0.0.1:30301 \
  --datadir $CWD/data1  \
  --syncmode 'full' \
  --port 30303  \
  --rpc --rpcport 8546  \
  --rpcvhosts "*" \
  --rpccorsdomain "*" \
  --gasprice "0" \
  --txpool.accountqueue 1000000 \
  --txpool.globalqueue 10000000 \
  --txpool.accountslots 100000 \
  --txpool.globalslots 10000000 \
  --txpool.pricelimit 0 \
  --unlock "0x9fb29aac15b9a4b7f17c3385939b007540f4d791"  \
  --password $CWD/node.password  \
  --networkid 13 --mine > $CWD/data1/node.log 2>&1 &
echo $! > $CWD/data1/node.pid
echo "Node 1 started. Check test-blockchain/data1/node.log for more logs"

sleep 2

nohup geth \
  --bootnodes enode://744ae75e44fb51f95a92a5ca29f8f8273b2501e3025157e9fca30b01a4baf2c01912dc9269a24b6c14642551d7dc50479244a7e5cd35e09446850730967520f3@127.0.0.1:30301 \
  --datadir $CWD/data2 \
  --syncmode 'full' \
  --port 40303 \
  --rpc --rpcport 9546 \
  --rpcvhosts "*" \
  --rpccorsdomain "*" \
  --gasprice "0" \
  --txpool.accountqueue 1000000 \
  --txpool.globalqueue 10000000 \
  --txpool.accountslots 100000 \
  --txpool.globalslots 10000000 \
  --txpool.pricelimit 0 \
  --unlock "0xacf8eccdca12a0eb6ae4fb1431e26c44e66decdb" \
  --password "$CWD/node.password" \
  --networkid 13 --mine > $CWD/data2/node.log 2>&1 &
echo $! > $CWD/data2/node.pid
echo "Node 2 started. Check test-blockchain/data2/node.log for more logs"
