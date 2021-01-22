#!/bin/bash
if [ -z ${GOPATH+x} ]; then echo "GOPATH is not set, visit https://github.com/golang/go/wiki/SettingGOPATH" && exit;
fi
printf "\x1b[34mFlare Network 4-Node Local Deployment\x1b[0m\n\n"
AVALANCHEGO_VERSION=@v1.1.0
CORETH_VERSION=@v0.3.16

EXEC_DIR=$(pwd)
LOG_DIR=$(pwd)/logs
CONFIG_DIR=$(pwd)/config
PKG_DIR=$GOPATH/pkg/mod/github.com/ava-labs
NODE_DIR=$PKG_DIR/avalanchego$AVALANCHEGO_VERSION
CORETH_DIR=$PKG_DIR/coreth$CORETH_VERSION

if echo $1 | grep -e "--existing" -q
then
	cd $NODE_DIR
else
	rm -rf logs
	mkdir logs
	rm -rf $NODE_DIR
	mkdir -p $PKG_DIR
	cp -r fba-avalanche/avalanchego $NODE_DIR
	rm -rf $CORETH_DIR
	cp -r fba-avalanche/coreth $CORETH_DIR
	cd $NODE_DIR
	rm -rf $NODE_DIR/db/
	mkdir -p $LOG_DIR/node00
	mkdir -p $LOG_DIR/node01
	mkdir -p $LOG_DIR/node02
	mkdir -p $LOG_DIR/node03
	printf "Building Flare Core...\n"
	./scripts/build.sh
	cd verify
	yarn --silent
	cd -
fi

# NODE 1
printf "Launching Node 1 at 127.0.0.1:9650\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9650 --staking-port=9651 --db-dir=db/node00 --staking-enabled=true --network-id=coston --bootstrap-ips= --bootstrap-ids= --staking-tls-cert-file=$(pwd)/keys/node00/staker.crt --staking-tls-key-file=$(pwd)/keys/node00/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--state-connector-config="8080,wss://xrpl.ws" &> $LOG_DIR/node00/launch.out & echo $! > $LOG_DIR/node00/launch.pid
NODE_00_PID=`cat $LOG_DIR/node00/launch.pid`
sleep 5

# NODE 2
printf "Launching Node 2 at 127.0.0.1:9652\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9652 --staking-port=9653 --db-dir=db/node01 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node01/staker.crt --staking-tls-key-file=$(pwd)/keys/node01/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--state-connector-config="8081,wss://xrpl.ws" &> $LOG_DIR/node01/launch.out & echo $! > $LOG_DIR/node01/launch.pid
NODE_01_PID=`cat $LOG_DIR/node01/launch.pid`
sleep 5

# NODE 3
printf "Launching Node 3 at 127.0.0.1:9654\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9654 --staking-port=9655 --db-dir=db/node02 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node02/staker.crt --staking-tls-key-file=$(pwd)/keys/node02/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--state-connector-config="8082,wss://xrpl.ws" &> $LOG_DIR/node02/launch.out & echo $! > $LOG_DIR/node02/launch.pid
NODE_02_PID=`cat $LOG_DIR/node02/launch.pid`
sleep 5

# NODE 4
printf "Launching Node 4 at 127.0.0.1:9656\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9656 --staking-port=9657 --db-dir=db/node03 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node03/staker.crt --staking-tls-key-file=$(pwd)/keys/node03/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--state-connector-config="8083,wss://xrpl.ws" &> $LOG_DIR/node03/launch.out & echo $! > $LOG_DIR/node03/launch.pid
NODE_03_PID=`cat $LOG_DIR/node03/launch.pid`
sleep 5

printf "\n"
read -p "Press enter to stop background node processes"
kill $NODE_00_PID
kill $NODE_01_PID
kill $NODE_02_PID
kill $NODE_03_PID