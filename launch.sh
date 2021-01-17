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

if echo $1 | grep -e "--restart" -q
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
fi

# NODE 1
printf "Launching Node 1 at 127.0.0.1:9650\n"
NODE_00_SC_CONFIG="653cf330f6af563bc209892c752ef975c616e862762a3d97f55bdfc41428b90b,\
					db/node00/coston/verifiedHashes.json,\
					8080,\
					wss://s2.ripple.com"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9650 --staking-port=9651 --db-dir=db/node00 --staking-enabled=true --network-id=coston --bootstrap-ips= --bootstrap-ids= --staking-tls-cert-file=$(pwd)/keys/node00/staker.crt --staking-tls-key-file=$(pwd)/keys/node00/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--state-connector-config=NODE_00_SC_CONFIG &> $LOG_DIR/node00/launch.out & echo $! > $LOG_DIR/node00/launch.pid
NODE_00_PID=`cat $LOG_DIR/node00/launch.pid`
sleep 5

# NODE 2
printf "Launching Node 2 at 127.0.0.1:9652\n"
NODE_01_SC_CONFIG="f63ba435fe78c905ba70203819e6a5d8b912b12526fd1add33dca1a9a724de8e,\
					db/node01/coston/verifiedHashes.json,\
					8081,\
					wss://s2.ripple.com"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9652 --staking-port=9653 --db-dir=db/node01 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node01/staker.crt --staking-tls-key-file=$(pwd)/keys/node01/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--state-connector-config=NODE_01_SC_CONFIG &> $LOG_DIR/node01/launch.out & echo $! > $LOG_DIR/node01/launch.pid
NODE_01_PID=`cat $LOG_DIR/node01/launch.pid`
sleep 5

# NODE 3
printf "Launching Node 3 at 127.0.0.1:9654\n"
NODE_02_SC_CONFIG="9f27c50cd5e289fb83c7a0528d378a569ef26043b945bed016378cd93534790b,\
					db/node02/coston/verifiedHashes.json,\
					8082,\
					wss://s2.ripple.com"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9654 --staking-port=9655 --db-dir=db/node02 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node02/staker.crt --staking-tls-key-file=$(pwd)/keys/node02/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--state-connector-config=NODE_02_SC_CONFIG &> $LOG_DIR/node02/launch.out & echo $! > $LOG_DIR/node02/launch.pid
NODE_02_PID=`cat $LOG_DIR/node02/launch.pid`
sleep 5

# NODE 4
printf "Launching Node 4 at 127.0.0.1:9656\n"
NODE_03_SC_CONFIG="eed1166ce92e87e68d5289d60aa83ca66f56596ac0e1761d62d0ea7710bffb5a,\
					db/node03/coston/verifiedHashes.json,\
					8083,\
					wss://s2.ripple.com"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9656 --staking-port=9657 --db-dir=db/node03 --staking-enabled=true --network-id=coston --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/keys/node00/nodeID.txt) --staking-tls-cert-file=$(pwd)/keys/node03/staker.crt --staking-tls-key-file=$(pwd)/keys/node03/staker.key --log-level=debug --unl-validators=\
$(cat $(pwd)/keys/node00/nodeID.txt),\
$(cat $(pwd)/keys/node01/nodeID.txt),\
$(cat $(pwd)/keys/node02/nodeID.txt),\
$(cat $(pwd)/keys/node03/nodeID.txt) \
--state-connector-config=NODE_03_SC_CONFIG &> $LOG_DIR/node03/launch.out & echo $! > $LOG_DIR/node03/launch.pid
NODE_03_PID=`cat $LOG_DIR/node03/launch.pid`
sleep 5

printf "\n"
read -p "Press enter to stop background node processes"
kill $NODE_00_PID
kill $NODE_01_PID
kill $NODE_02_PID
kill $NODE_03_PID