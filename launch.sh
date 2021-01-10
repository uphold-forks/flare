#!/bin/bash

NODE_VERSION=@v1.1.0

LOG_DIR=$(pwd)/logs
PKG_DIR=$GOPATH/pkg/mod/github.com/ava-labs
NODE_DIR=$PKG_DIR/avalanchego$NODE_VERSION
cd $NODE_DIR

# NODE 1
printf "\nLaunching Node 1 at 127.0.0.1:9650\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9650 --staking-port=9651 --db-dir=db/node00 --staking-enabled=true --network-id=coston --bootstrap-ips= --bootstrap-ids= --staking-tls-cert-file=$(pwd)/keys/node00/staker.crt --staking-tls-key-file=$(pwd)/keys/node00/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--coreth-config="wss://s.altnet.rippletest.net:51233" &> $LOG_DIR/node00/nohup.out & echo $! > $LOG_DIR/node00/ava.pid
NODE_00_PID=`cat $LOG_DIR/node00/ava.pid`
sleep 5

# NODE 2
printf "Launching Node 2 at 127.0.0.1:9652\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9652 --staking-port=9653 --db-dir=db/node01 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node01/staker.crt --staking-tls-key-file=$(pwd)/keys/node01/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--coreth-config="wss://s.altnet.rippletest.net:51233" &> $LOG_DIR/node01/nohup.out & echo $! > $LOG_DIR/node01/ava.pid
NODE_01_PID=`cat $LOG_DIR/node01/ava.pid`
sleep 5

# NODE 3
printf "Launching Node 3 at 127.0.0.1:9654\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9654 --staking-port=9655 --db-dir=db/node02 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node02/staker.crt --staking-tls-key-file=$(pwd)/keys/node02/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--coreth-config="wss://s.altnet.rippletest.net:51233" &> $LOG_DIR/node02/nohup.out & echo $! > $LOG_DIR/node02/ava.pid
NODE_02_PID=`cat $LOG_DIR/node02/ava.pid`
sleep 5

# NODE 4
printf "Launching Node 4 at 127.0.0.1:9656\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9656 --staking-port=9657 --db-dir=db/node03 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node03/staker.crt --staking-tls-key-file=$(pwd)/keys/node03/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--coreth-config="wss://s.altnet.rippletest.net:51233" &> $LOG_DIR/node03/nohup.out & echo $! > $LOG_DIR/node03/ava.pid
NODE_03_PID=`cat $LOG_DIR/node03/ava.pid`
sleep 5

printf "\n\n"
read -p "Press enter to stop background node processes"
kill $NODE_00_PID
kill $NODE_01_PID
kill $NODE_02_PID
kill $NODE_03_PID