#!/bin/bash

NODE_VERSION=avalanchego@v1.0.3
CORETH_VERSION=coreth@v0.3.6

rm -rf logs
mkdir logs
LOG_DIR=$(pwd)/logs
CONFIG_DIR=$(pwd)/config
PKG_DIR=$GOPATH/pkg/mod/github.com/ava-labs
NODE_DIR=$PKG_DIR/$NODE_VERSION
CORETH_DIR=$PKG_DIR/$CORETH_VERSION

rm -rf $NODE_DIR
mkdir -p $PKG_DIR
cp -r fba-avalanche/$NODE_VERSION $NODE_DIR

rm -rf $CORETH_DIR
cp -r ./fba-avalanche/$CORETH_VERSION $CORETH_DIR

cd $NODE_DIR
cp -r .pkg/ .git/
rm -rf $NODE_DIR/db/

printf "\x1b[34mFlare Network 5-Node Local Deployment\x1b[0m\n\n"
# NODE 1
printf "Launching Node 1 at 127.0.0.1:9650\n"
cp $CONFIG_DIR/config_local_00.go $NODE_DIR/flare/config_local.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node00
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9650 --staking-port=9651 --db-dir=db/node00 --staking-enabled=true --network-id=flare --bootstrap-ips= --bootstrap-ids= --staking-tls-cert-file=$(pwd)/keys/node00/staker.crt --staking-tls-key-file=$(pwd)/keys/node00/staker.key --log-level=info &> $LOG_DIR/node00/nohup.out & echo $! > $LOG_DIR/node00/ava.pid
NODE_00_PID=`cat $LOG_DIR/node00/ava.pid`

# NODE 2
printf "Launching Node 2 at 127.0.0.1:9652\n"
cp $CONFIG_DIR/config_local_01.go $NODE_DIR/flare/config_local.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node01
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9652 --staking-port=9653 --db-dir=db/node01 --staking-enabled=true --network-id=flare --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node01/staker.crt --staking-tls-key-file=$(pwd)/keys/node01/staker.key --log-level=info &> $LOG_DIR/node01/nohup.out & echo $! > $LOG_DIR/node01/ava.pid
NODE_01_PID=`cat $LOG_DIR/node01/ava.pid`

# NODE 3
printf "Launching Node 3 at 127.0.0.1:9654\n"
cp $CONFIG_DIR/config_local_02.go $NODE_DIR/flare/config_local.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node02
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9654 --staking-port=9655 --db-dir=db/node02 --staking-enabled=true --network-id=flare --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node02/staker.crt --staking-tls-key-file=$(pwd)/keys/node02/staker.key --log-level=info &> $LOG_DIR/node02/nohup.out & echo $! > $LOG_DIR/node02/ava.pid
NODE_02_PID=`cat $LOG_DIR/node02/ava.pid`

# NODE 4
printf "Launching Node 4 at 127.0.0.1:9656\n"
cp $CONFIG_DIR/config_local_03.go $NODE_DIR/flare/config_local.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node03
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9656 --staking-port=9657 --db-dir=db/node03 --staking-enabled=true --network-id=flare --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node03/staker.crt --staking-tls-key-file=$(pwd)/keys/node03/staker.key --log-level=info &> $LOG_DIR/node03/nohup.out & echo $! > $LOG_DIR/node03/ava.pid
NODE_03_PID=`cat $LOG_DIR/node03/ava.pid`

# NODE 5
printf "Launching Node 5 at 127.0.0.1:9658\n"
cp $CONFIG_DIR/config_local_04.go $NODE_DIR/flare/config_local.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node04
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9658 --staking-port=9659 --db-dir=db/node04 --staking-enabled=true --network-id=flare --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node04/staker.crt --staking-tls-key-file=$(pwd)/keys/node04/staker.key --log-level=info &> $LOG_DIR/node04/nohup.out & echo $! > $LOG_DIR/node04/ava.pid
NODE_04_PID=`cat $LOG_DIR/node04/ava.pid`

cd - &>/dev/null
printf "\nNetwork launched, deploying state-connector system\n"
sleep 10
node deploy.js

printf "\nNode 1 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.sampleValidators",
    "params" :{
        "size":5
    }
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/P | jq '.result'

printf "\nNode 2 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.sampleValidators",
    "params" :{
        "size":5
    }
}' -H 'content-type:application/json;' 127.0.0.1:9652/ext/P | jq '.result'

printf "\nNode 3 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.sampleValidators",
    "params" :{
        "size":5
    }
}' -H 'content-type:application/json;' 127.0.0.1:9654/ext/P | jq '.result'

printf "\nNode 4 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.sampleValidators",
    "params" :{
        "size":5
    }
}' -H 'content-type:application/json;' 127.0.0.1:9656/ext/P | jq '.result'

printf "\nNode 5 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.sampleValidators",
    "params" :{
        "size":5
    }
}' -H 'content-type:application/json;' 127.0.0.1:9658/ext/P | jq '.result'

mkdir $LOG_DIR/client
nohup node client.js &> $LOG_DIR/client/nohup.out & echo $! > $LOG_DIR/client/client.pid
CLIENT_PID=`cat $LOG_DIR/client/client.pid`
printf "\n\n\tInitiated 1000 XRP Ledger transactions across 10 agents:\n\t\t\x1b[4mhttps://testnet.xrpl.org/\x1b[0m"

printf "\n\n\n"
read -p "Press enter to stop background node processes"
kill $NODE_00_PID
kill $NODE_01_PID
kill $NODE_02_PID
kill $NODE_03_PID
kill $NODE_04_PID
kill $CLIENT_PID &>/dev/null