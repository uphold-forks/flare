#!/bin/bash

# Pass in vars
NODE_NAME="${1:-node00}"
BOOTSTRAP_IPS="${2:- }"
STATE_CONNECTOR_IPS="${3:- }"

# Pre-defined vars
NODE_VERSION=@v1.0.4
CORETH_VERSION=@v0.3.12
LOG_DIR=$(pwd)/logs
CONFIG_DIR=$(pwd)/config
DB_DIR=$(pwd)/db
REPO_DIR=$(pwd)
PKG_DIR=$GOPATH/pkg/mod/github.com/ava-labs
NODE_DIR=$PKG_DIR/avalanchego$NODE_VERSION
CORETH_DIR=$PKG_DIR/coreth$CORETH_VERSION

# Nodes public IP address
PIP=$(curl -H "Metadata-Flavor: Google" http://metadata/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)

# Clear and make dirs
mkdir -p $PKG_DIR
rsync -a --delete $REPO_DIR/fba-avalanche/avalanchego/* $NODE_DIR/
ls -lah $NODE_DIR
rsync -a --delete $REPO_DIR/fba-avalanche/coreth/* $CORETH_DIR/
ls -lah $CORETH_DIR
rm -rf $DB_DIR/*
mkdir -p $LOG_DIR

# Build commands
cd $NODE_DIR
printf "\x1b[34mFlare Network Node Deployment\x1b[0m\n\n"
printf "Building Flare and Coreth...\n\n"
$NODE_DIR/scripts/build.sh

# Function to start a specific node
start_node () {
    printf "Launching $NODE_NAME at $PIP:9650\n"
    nohup $NODE_DIR/build/avalanchego --http-host=  --http-port=$4 --public-ip=$PIP --staking-port=$5  \
    --staking-enabled=true --p2p-tls-enabled=true --log-level=debug --network-id=flare \
    --db-dir=$DB_DIR \
    --staking-tls-cert-file=$(pwd)/keys/$NODE_NAME/staker.crt  \
    --staking-tls-key-file=$(pwd)/keys/$NODE_NAME/staker.key \
    --snow-sample-size=2 --snow-quorum-size=2 \
    --bootstrap-ips=$3  \
    --bootstrap-ids=$2  \
    --unl-validators=$1  \
    --coreth-config=$(cat $(pwd)/keys/$NODE_NAME/scID.txt) \
    &>> $LOG_DIR/nohup.out & echo $! > $LOG_DIR/ava.pid
    NODE_PID=`cat $LOG_DIR/ava.pid`
}

wait_node_evm() {
    # Wait until node is finished bootstrapping before continuing
    while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' -X POST --data '{ \"jsonrpc\": \"2.0\", \"method\": \"web3_clientVersion\", \"params\" [], \"id\": 1 }' -H 'Content-Type: application/json' -H 'cache-control: no-cache' 127.0.0.1:$1/ext/bc/C/rpc)" != "200" ]]; do echo "Service still bootstrapping.. Http code:" $(curl -s -o /dev/null -w ''%{http_code}'' -X POST --data '{ \"jsonrpc\": \"2.0\", \"method\": \"web3_clientVersion\", \"params\" [], \"id\": 1 }' -H 'Content-Type: application/json' -H 'cache-control: no-cache' 127.0.0.1:$1/ext/bc/C/rpc); sleep 5; done
}

wait_all_node() {
    # Wait until node is finished bootstrapping before continuing
    while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' -X POST --data '{ \"jsonrpc\": \"2.0\", \"id\":1, \"method\":\"platform.sampleValidators\", \"params\" :{ \"size\":4 }' -H 'Content-Type: application/json' -H 'cache-control: no-cache' 127.0.0.1:$1/ext/P)" != "200" ]]; do echo "Service still bootstrapping.. Http code:" $(curl -s -o /dev/null -w ''%{http_code}'' -X POST --data '{ \"jsonrpc\": \"2.0\", \"id\":1, \"method\":\"platform.sampleValidators\", \"params\" :{ \"size\":4 }' -H 'Content-Type: application/json' -H 'cache-control: no-cache' 127.0.0.1:$1/ext/P); sleep 5; done

    IFS=',' ;for PEER in `echo "$STATE_CONNECTOR_IPS"`
    do
        echo $PEER
        # Wait until all nodes are finished before continuing
        while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' -X POST --data '{ \"jsonrpc\": \"2.0\", \"id\":1, \"method\":\"platform.sampleValidators\", \"params\" :{ \"size\":4 }' -H 'Content-Type: application/json' -H 'cache-control: no-cache' $PEER/ext/P)" != "200" ]]; do echo "Service still bootstrapping.. Http code:" $(curl -s -o /dev/null -w ''%{http_code}'' -X POST --data '{ \"jsonrpc\": \"2.0\", \"id\":1, \"method\":\"platform.sampleValidators\", \"params\" :{ \"size\":4 }' -H 'Content-Type: application/json' -H 'cache-control: no-cache' $PEER/ext/P); sleep 5; done
    done
}

display_unl() {
    # Display all validators in UNL
    printf "\nNode UNL:\n"
    curl -sX POST --data '{
        "jsonrpc":"2.0",
        "id"     :1,
        "method": "platform.sampleValidators",
        "params" :{
            "size":4
        }
    }' -H 'content-type:application/json;' 127.0.0.1:$1/ext/P | jq '.result'
}

# Case to configure then start a specific node
case "$NODE_NAME" in
"node00")
    echo 0
    UNL=$(cat $NODE_DIR/keys/node00/nodeID.txt),$(cat $NODE_DIR/keys/node01/nodeID.txt),$(cat $NODE_DIR/keys/node02/nodeID.txt),$(cat $NODE_DIR/keys/node04/nodeID.txt)
    BOOTSTRAP_IDS=" "
    HTTP_PORT=9650
    PEERING_PORT=9651
    start_node "$UNL" "$BOOTSTRAP_IDS" " " "$HTTP_PORT" "$PEERING_PORT"
    wait_node_evm "$HTTP_PORT"
    wait_all_node "$HTTP_PORT"
    display_unl "$HTTP_PORT"
    sleep 0
    ;;
"node01")
    echo 1
    UNL=$(cat $(pwd)/keys/node00/nodeID.txt),$(cat $(pwd)/keys/node01/nodeID.txt),$(cat $(pwd)/keys/node02/nodeID.txt),$(cat $(pwd)/keys/node03/nodeID.txt)
    BOOTSTRAP_IDS=$(cat $(pwd)/keys/node00/nodeID.txt),$(cat $(pwd)/keys/node01/nodeID.txt),$(cat $(pwd)/keys/node02/nodeID.txt),$(cat $(pwd)/keys/node03/nodeID.txt)
    HTTP_PORT=9652
    PEERING_PORT=9653
    start_node "$UNL" "$BOOTSTRAP_IDS" "$BOOTSTRAP_IPS" "$HTTP_PORT" "$PEERING_PORT"
    wait_node_evm "$HTTP_PORT"
    wait_all_node "$HTTP_PORT"
    display_unl "$HTTP_PORT"
    sleep 60
    ;;
"node02")
    echo 2
    UNL=$(cat $(pwd)/keys/node00/nodeID.txt),$(cat $(pwd)/keys/node01/nodeID.txt),$(cat $(pwd)/keys/node02/nodeID.txt),$(cat $(pwd)/keys/node03/nodeID.txt)
    BOOTSTRAP_IDS=$(cat $(pwd)/keys/node00/nodeID.txt),$(cat $(pwd)/keys/node01/nodeID.txt),$(cat $(pwd)/keys/node02/nodeID.txt),$(cat $(pwd)/keys/node03/nodeID.txt)
    HTTP_PORT=9654
    PEERING_PORT=9655
    start_node "$UNL" "$BOOTSTRAP_IDS" "$BOOTSTRAP_IPS" "$HTTP_PORT" "$PEERING_PORT"
    wait_node_evm "$HTTP_PORT"
    wait_all_node "$HTTP_PORT"
    display_unl "$HTTP_PORT"
    sleep 120
    ;;
"node03")
    echo 3
    UNL=$(cat $(pwd)/keys/node00/nodeID.txt),$(cat $(pwd)/keys/node01/nodeID.txt),$(cat $(pwd)/keys/node02/nodeID.txt),$(cat $(pwd)/keys/node03/nodeID.txt)
    BOOTSTRAP_IDS=$(cat $(pwd)/keys/node00/nodeID.txt),$(cat $(pwd)/keys/node01/nodeID.txt),$(cat $(pwd)/keys/node02/nodeID.txt),$(cat $(pwd)/keys/node03/nodeID.txt)
    HTTP_PORT=9656
    PEERING_PORT=9657
    start_node "$UNL" "$BOOTSTRAP_IDS" "$BOOTSTRAP_IPS" "$HTTP_PORT" "$PEERING_PORT"
    wait_node_evm "$HTTP_PORT"
    wait_all_node "$HTTP_PORT"
    display_unl "$HTTP_PORT"
    sleep 180
    ;;
"node04")
    echo 4
    UNL=$(cat $(pwd)/keys/node01/nodeID.txt),$(cat $(pwd)/keys/node02/nodeID.txt),$(cat $(pwd)/keys/node03/nodeID.txt),$(cat $(pwd)/keys/node04/nodeID.txt)
    BOOTSTRAP_IDS=$(cat $(pwd)/keys/node01/nodeID.txt),$(cat $(pwd)/keys/node02/nodeID.txt),$(cat $(pwd)/keys/node03/nodeID.txt),$(cat $(pwd)/keys/node04/nodeID.txt)
    HTTP_PORT=9658
    PEERING_PORT=9659
    start_node "$UNL" "$BOOTSTRAP_IDS" "$BOOTSTRAP_IPS" "$HTTP_PORT" "$PEERING_PORT"
    wait_node_evm "$HTTP_PORT"
    wait_all_node "$HTTP_PORT"
    display_unl "$HTTP_PORT"
    sleep 240
    ;;
*)
    echo "non"
    UNL=$(cat $(pwd)/keys/node00/nodeID.txt),$(cat $(pwd)/keys/node01/nodeID.txt),$(cat $(pwd)/keys/node02/nodeID.txt),$(cat $(pwd)/keys/node04/nodeID.txt)
    BOOTSTRAP_IDS=" "
    HTTP_PORT=9650
    PEERING_PORT=9651
    start_node "$UNL" "$BOOTSTRAP_IDS" " " "$HTTP_PORT" "$PEERING_PORT"
    wait_node_evm "$HTTP_PORT"
    wait_node_unl "$HTTP_PORT"
    display_unl "$HTTP_PORT"
    sleep 300
    ;;
esac

# Configure the state connector dynamically - Currently configured to 5 nodes 00-04
printf "\nNetwork launched, configuring the state-connector system\n"
cd $REPO_DIR
cp $CONFIG_DIR/config.gcp.json $CONFIG_DIR/config.json
NODE_NO=0
IFS=',' ;for IP in `echo "$STATE_CONNECTOR_IPS"`
do
    echo $NODE_NO
    echo $IP

    if (( $NODE_NO < 10 )); then
        # Replace each <node0-9> with an IP and Port
        FIND_NAME="<node0${NODE_NO}>"
    else    
        # Replace each <node10-99> with an IP and Port
        FIND_NAME="<node${NODE_NO}>"
    fi

    sed -i "s/$FIND_NAME/$IP/" $CONFIG_DIR/config.json

    NODE_NO=$[$NODE_NO +1]
done

# Launch the state connector
printf "\nDeploying state-connector system\n"
# node stateConnectorConfig.js
node deploy.js

# Launch the client
#mkdir $LOG_DIR/client
#nohup node client.js &> $LOG_DIR/client/nohup.out & echo $! > $LOG_DIR/client/client.pid
#CLIENT_PID=`cat $LOG_DIR/client/client.pid`
#printf "\n\n\tInitiating 1000 XRP Ledger transactions:\n\t\t\x1b[4mhttps://testnet.xrpl.org/\x1b[0m"

# Kill all command
# printf "\n\n\n"
# read -p "Press enter to stop background node processes"
# kill $NODE_PID
# kill $CLIENT_PID &>/dev/null

printf "\n\n\n"
printf "To kill the node and client run bash gcp/stop.sh script \x1b[0m"

