#!/bin/bash
if [[ $(pwd) =~ " " ]]; then echo "Working directory path contains a folder with a space in its name, please remove all spaces" && exit; fi
if [ -z ${GOPATH+x} ]; then echo "GOPATH is not set, visit https://github.com/golang/go/wiki/SettingGOPATH" && exit; fi
printf "\x1b[34mFlare Network Coston Deployment\x1b[0m\n\n"

LAUNCH_DIR=$(pwd)

# Ava has not tested and is thus not supporting rocksdb on Mac at this time.
DB_TYPE=rocksdb
if [ "$(uname)" == "Darwin" ]; then DB_TYPE=leveldb; fi

# Test and export underlying chain APIs you chose to use for the state connector
source ./cmd/export_chain_apis.sh $LAUNCH_DIR/conf/gcp/chain_apis.json

export FBA_VALs=$LAUNCH_DIR/conf/gcp/fba_validators.json
AVALANCHE_DIR=$GOPATH/src/github.com/ava-labs/avalanchego
cd $AVALANCHE_DIR
if ! echo $1 | grep -e "--existing" -q
then
	rm -rf $LAUNCH_DIR/logs/coston
	mkdir -p $LAUNCH_DIR/logs/coston
	rm -rf $LAUNCH_DIR/db/coston
	mkdir -p $LAUNCH_DIR/db/coston
	mkdir -p $LAUNCH_DIR/logs/coston/node1
	mkdir -p $LAUNCH_DIR/db/coston/node1
fi

# NODE 1
printf "Launching Node 1 at 127.0.0.1:9650\n"
nohup ./build/avalanchego \
--http-host= \
--public-ip=127.0.0.1 \
--http-port=9650 \
--staking-port=9651 \
--log-dir=$LAUNCH_DIR/logs/coston/node1 \
--db-dir=$LAUNCH_DIR/db/coston/node1 \
--bootstrap-ips="$(curl -m 10 -sX POST --data '{ "jsonrpc":"2.0", "id":1, "method":"info.getNodeIP" }' -H 'content-type:application/json;' https://coston.flare.network/ext/info | jq -r ".result.ip")" \
--bootstrap-ids="$(curl -m 10 -sX POST --data '{ "jsonrpc":"2.0", "id":1, "method":"info.getNodeID" }' -H 'content-type:application/json;' https://coston.flare.network/ext/info | jq -r ".result.nodeID")" \
--db-type=$DB_TYPE \
--log-level=debug > /dev/null 2>&1 &
NODE_1_PID=`echo $!`

printf "\n"
read -p "Press enter to stop background node processes"
kill $NODE_1_PID
