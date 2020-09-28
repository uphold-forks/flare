#!/bin/bash

rm -rf logs
mkdir logs
LOG_DIR=$(pwd)/logs
SC_DIR=$(pwd)/config
NODE_DIR=$GOPATH/src/github.com/ava-labs/gecko
rm -rf $NODE_DIR
mkdir -p $GOPATH/src/github.com/ava-labs/
cp -r fba-avalanche/gecko@v0.5.7/ $NODE_DIR
rm -rf $GOPATH/pkg/mod/github.com/ava-labs/coreth@v0.2.5/
mkdir -p $GOPATH/pkg/mod/github.com/ava-labs
cp -r ./fba-avalanche/coreth@v0.2.5/ $GOPATH/pkg/mod/github.com/ava-labs/coreth@v0.2.5/
cd $NODE_DIR
rm -rf $NODE_DIR/db/

printf "\x1b[34mFlare Network 5-Node Local Deployment\x1b[0m\n\n"
# NODE 1
printf "Launching Node 1 at 127.0.0.1:9650\n"
cp $SC_DIR/state_connector_1.go $NODE_DIR/sc/state_connector.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node1
nohup ./build/ava --public-ip=127.0.0.1 --snow-quorum-size=3 --snow-virtuous-commit-threshold=60 --snow-rogue-commit-threshold=90 --http-port=9650 --staking-port=9651 --db-dir=db/node1 --staking-tls-enabled=true --network-id=local --bootstrap-ips= --bootstrap-ids= --staking-tls-cert-file=$(pwd)/staking/local/staker1.crt --staking-tls-key-file=$(pwd)/staking/local/staker1.key --log-level=debug &> $LOG_DIR/node1/nohup.out & echo $! > $LOG_DIR/node1/ava.pid
NODE_1_PID=`cat $LOG_DIR/node1/ava.pid`

# NODE 2
printf "Launching Node 2 at 127.0.0.1:9652\n"
cp $SC_DIR/state_connector_2.go $NODE_DIR/sc/state_connector.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node2
nohup ./build/ava --public-ip=127.0.0.1 --snow-quorum-size=3 --snow-virtuous-commit-threshold=60 --snow-rogue-commit-threshold=90 --http-port=9652 --staking-port=9653 --db-dir=db/node2 --staking-tls-enabled=true --network-id=local --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg --staking-tls-cert-file=$(pwd)/staking/local/staker2.crt --staking-tls-key-file=$(pwd)/staking/local/staker2.key --log-level=debug &> $LOG_DIR/node2/nohup.out & echo $! > $LOG_DIR/node2/ava.pid
NODE_2_PID=`cat $LOG_DIR/node2/ava.pid`

# NODE 3
printf "Launching Node 3 at 127.0.0.1:9654\n"
cp $SC_DIR/state_connector_3.go $NODE_DIR/sc/state_connector.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node3
nohup ./build/ava --public-ip=127.0.0.1 --snow-quorum-size=3 --snow-virtuous-commit-threshold=60 --snow-rogue-commit-threshold=90 --http-port=9654 --staking-port=9655 --db-dir=db/node3 --staking-tls-enabled=true --network-id=local --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg --staking-tls-cert-file=$(pwd)/staking/local/staker3.crt --staking-tls-key-file=$(pwd)/staking/local/staker3.key --log-level=debug &> $LOG_DIR/node3/nohup.out & echo $! > $LOG_DIR/node3/ava.pid
NODE_3_PID=`cat $LOG_DIR/node3/ava.pid`

# NODE 4
printf "Launching Node 4 at 127.0.0.1:9656\n"
cp $SC_DIR/state_connector_4.go $NODE_DIR/sc/state_connector.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node4
nohup ./build/ava --public-ip=127.0.0.1 --snow-quorum-size=3 --snow-virtuous-commit-threshold=60 --snow-rogue-commit-threshold=90 --http-port=9656 --staking-port=9657 --db-dir=db/node4 --staking-tls-enabled=true --network-id=local --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg --staking-tls-cert-file=$(pwd)/staking/local/staker4.crt --staking-tls-key-file=$(pwd)/staking/local/staker4.key --log-level=debug &> $LOG_DIR/node4/nohup.out & echo $! > $LOG_DIR/node4/ava.pid
NODE_4_PID=`cat $LOG_DIR/node4/ava.pid`

# NODE 5
printf "Launching Node 5 at 127.0.0.1:9658\n"
cp $SC_DIR/state_connector_5.go $NODE_DIR/sc/state_connector.go
./scripts/build.sh &>/dev/null
mkdir -p $LOG_DIR/node5
nohup ./build/ava --public-ip=127.0.0.1 --snow-quorum-size=3 --snow-virtuous-commit-threshold=60 --snow-rogue-commit-threshold=90 --http-port=9658 --staking-port=9659 --db-dir=db/node5 --staking-tls-enabled=true --network-id=local --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg --staking-tls-cert-file=$(pwd)/staking/local/staker5.crt --staking-tls-key-file=$(pwd)/staking/local/staker5.key --log-level=debug &> $LOG_DIR/node5/nohup.out & echo $! > $LOG_DIR/node5/ava.pid
NODE_5_PID=`cat $LOG_DIR/node5/ava.pid`

cd - &>/dev/null
printf "\nNetwork launched, deploying state-connector system\n"
sleep 10
node deploy.js

printf "\nNode 1 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.getCurrentValidators"
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/P | jq '.result'

printf "\nNode 2 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.getCurrentValidators"
}' -H 'content-type:application/json;' 127.0.0.1:9652/ext/P | jq '.result'

printf "\nNode 3 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.getCurrentValidators"
}' -H 'content-type:application/json;' 127.0.0.1:9654/ext/P | jq '.result'

printf "\nNode 4 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.getCurrentValidators"
}' -H 'content-type:application/json;' 127.0.0.1:9656/ext/P | jq '.result'

printf "\nNode 5 UNL:\n"
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method": "platform.getCurrentValidators"
}' -H 'content-type:application/json;' 127.0.0.1:9658/ext/P | jq '.result'

mkdir $LOG_DIR/client
nohup node client.js &> $LOG_DIR/client/nohup.out & echo $! > $LOG_DIR/client/client.pid
CLIENT_PID=`cat $LOG_DIR/client/client.pid`
printf "\n\n\tInitiated 1000 XRP Ledger transactions across 10 agents:\n\t\t\x1b[4mhttps://testnet.xrpl.org/\x1b[0m"

printf "\n\n\n"
read -p "Press enter to stop background node processes"
kill $NODE_1_PID
kill $NODE_2_PID
kill $NODE_3_PID
kill $NODE_4_PID
kill $NODE_5_PID
kill $CLIENT_PID &>/dev/null