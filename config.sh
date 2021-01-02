#!/bin/bash

NODE_VERSION=@v1.1.0
CORETH_VERSION=@v0.3.16

cd solidity
./compile.sh stateConnector
cd -

rm -rf logs
mkdir logs
LOG_DIR=$(pwd)/logs
CONFIG_DIR=$(pwd)/config
PKG_DIR=$GOPATH/pkg/mod/github.com/ava-labs
NODE_DIR=$PKG_DIR/avalanchego$NODE_VERSION
CORETH_DIR=$PKG_DIR/coreth$CORETH_VERSION

rm -rf $NODE_DIR
mkdir -p $PKG_DIR
cp -r fba-avalanche/avalanchego $NODE_DIR

rm -rf $CORETH_DIR
cp -r fba-avalanche/coreth $CORETH_DIR

cd $NODE_DIR
rm -rf $NODE_DIR/db/

printf "\x1b[34mFlare Network 5-Node Local Deployment\x1b[0m\n\n"
printf "Building Flare Core...\n"
./scripts/build.sh

# NODE 1
printf "\nLaunching Node 1 at 127.0.0.1:9650\n"
mkdir -p $LOG_DIR/node00
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9650 --staking-port=9651 --db-dir=db/node00 --staking-enabled=true --network-id=coston --bootstrap-ips= --bootstrap-ids= --staking-tls-cert-file=$(pwd)/keys/node00/staker.crt --staking-tls-key-file=$(pwd)/keys/node00/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--coreth-config=$(cat $(pwd)/keys/node00/scID.txt) &> $LOG_DIR/node00/nohup.out & echo $! > $LOG_DIR/node00/ava.pid
NODE_00_PID=`cat $LOG_DIR/node00/ava.pid`
sleep 5

# NODE 2
printf "Launching Node 2 at 127.0.0.1:9652\n"
mkdir -p $LOG_DIR/node01
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9652 --staking-port=9653 --db-dir=db/node01 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node01/staker.crt --staking-tls-key-file=$(pwd)/keys/node01/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--coreth-config=$(cat $(pwd)/keys/node01/scID.txt) &> $LOG_DIR/node01/nohup.out & echo $! > $LOG_DIR/node01/ava.pid
NODE_01_PID=`cat $LOG_DIR/node01/ava.pid`
sleep 5

# NODE 3
printf "Launching Node 3 at 127.0.0.1:9654\n"
mkdir -p $LOG_DIR/node02
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9654 --staking-port=9655 --db-dir=db/node02 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node02/staker.crt --staking-tls-key-file=$(pwd)/keys/node02/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--coreth-config=$(cat $(pwd)/keys/node02/scID.txt) &> $LOG_DIR/node02/nohup.out & echo $! > $LOG_DIR/node02/ava.pid
NODE_02_PID=`cat $LOG_DIR/node02/ava.pid`
sleep 5

# NODE 4
printf "Launching Node 4 at 127.0.0.1:9656\n"
mkdir -p $LOG_DIR/node03
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9656 --staking-port=9657 --db-dir=db/node03 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node03/staker.crt --staking-tls-key-file=$(pwd)/keys/node03/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--coreth-config=$(cat $(pwd)/keys/node03/scID.txt) &> $LOG_DIR/node03/nohup.out & echo $! > $LOG_DIR/node03/ava.pid
NODE_03_PID=`cat $LOG_DIR/node03/ava.pid`
sleep 5

printf "\nNode 1 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.sampleValidators",
    "params" :{
        "size":4
    }
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/P | jq '.result'

printf "\nNode 2 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.sampleValidators",
    "params" :{
        "size":4
    }
}' -H 'content-type:application/json;' 127.0.0.1:9652/ext/P | jq '.result'

printf "\nNode 3 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.sampleValidators",
    "params" :{
        "size":4
    }
}' -H 'content-type:application/json;' 127.0.0.1:9654/ext/P | jq '.result'

printf "\nNode 4 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.sampleValidators",
    "params" :{
        "size":4
    }
}' -H 'content-type:application/json;' 127.0.0.1:9656/ext/P | jq '.result'

cd - &>/dev/null
printf "\nNetwork launched, deploying state-connector system..."
node deploy.js
printf "\nNode endpoints configured, stopping network...\n"
sleep 5
kill $NODE_00_PID
kill $NODE_01_PID
kill $NODE_02_PID
kill $NODE_03_PID