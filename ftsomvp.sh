#!/bin/bash
if [[ $(pwd) =~ " " ]]; then echo "Working directory path contains a folder with a space in its name, please remove all spaces" && exit; fi
if [ -z ${GOPATH+x} ]; then echo "GOPATH is not set, visit https://github.com/golang/go/wiki/SettingGOPATH" && exit; fi
if [ -z ${XRP_APIs+x} ] || [ "$XRP_APIs" == "url1, url2, ..., urlN" ]; then echo "XRP_APIs is not set, please set it using the form: $ export XRP_APIs=\"url1, url2, ..., urlN\"" && exit; fi
XRP_APIs_JOINED="$(echo -e "${XRP_APIs}" | tr -d '[:space:]')"
printf "\x1b[34mFlare Network 4-Node Local Deployment\x1b[0m\n\n"
AVALANCHEGO_VERSION=@v1.3.2
CORETH_VERSION=@v0.4.2-rc.4

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
fi

# NODE 1
printf "Launching Node 1 at 127.0.0.1:9650\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9670 --staking-port=9671 --db-dir=$(pwd)/db/node00/ --staking-enabled=true --network-id=ftsomvp --bootstrap-ips= --bootstrap-ids= --staking-tls-cert-file=$(pwd)/config/keys/node00/node.crt --staking-tls-key-file=$(pwd)/config/keys/node00/node.key --log-level=info --log-dir=$LOG_DIR/node00 --validators-file=$(pwd)/config/validators/local/1619186000.json --alert-apis="https://flare.network" --xrp-apis=$XRP_APIs_JOINED &>> /dev/null & echo $! > $LOG_DIR/node00/launch.pid
NODE_00_PID=`cat $LOG_DIR/node00/launch.pid`
sleep 5

# NODE 2
printf "Launching Node 2 at 127.0.0.1:9652\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9672 --staking-port=9673 --db-dir=$(pwd)/db/node01/ --staking-enabled=true --network-id=ftsomvp --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/config/keys/node00/node.txt) --staking-tls-cert-file=$(pwd)/config/keys/node01/node.crt --staking-tls-key-file=$(pwd)/config/keys/node01/node.key --log-level=info --log-dir=$LOG_DIR/node01 --validators-file=$(pwd)/config/validators/local/1619186000.json --alert-apis="https://flare.network" --xrp-apis=$XRP_APIs_JOINED --coreth-config="api-disabled" &>> /dev/null & echo $! > $LOG_DIR/node01/launch.pid
NODE_01_PID=`cat $LOG_DIR/node01/launch.pid`
sleep 5

# NODE 3
printf "Launching Node 3 at 127.0.0.1:9654\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9674 --staking-port=9675 --db-dir=$(pwd)/db/node02/ --staking-enabled=true --network-id=ftsomvp --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/config/keys/node00/node.txt) --staking-tls-cert-file=$(pwd)/config/keys/node02/node.crt --staking-tls-key-file=$(pwd)/config/keys/node02/node.key --log-level=info --log-dir=$LOG_DIR/node02 --validators-file=$(pwd)/config/validators/local/1619186000.json --alert-apis="https://flare.network" --xrp-apis=$XRP_APIs_JOINED --coreth-config="api-disabled" &>> /dev/null & echo $! > $LOG_DIR/node02/launch.pid
NODE_02_PID=`cat $LOG_DIR/node02/launch.pid`
sleep 5

# NODE 4
printf "Launching Node 4 at 127.0.0.1:9656\n"
nohup ./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9676 --staking-port=9677 --db-dir=$(pwd)/db/node03/ --staking-enabled=true --network-id=ftsomvp --bootstrap-ips=127.0.0.1:9651 --bootstrap-ids=$(cat $(pwd)/config/keys/node00/node.txt) --staking-tls-cert-file=$(pwd)/config/keys/node03/node.crt --staking-tls-key-file=$(pwd)/config/keys/node03/node.key --log-level=info --log-dir=$LOG_DIR/node03 --validators-file=$(pwd)/config/validators/local/1619186000.json --alert-apis="https://flare.network" --xrp-apis=$XRP_APIs_JOINED --coreth-config="api-disabled" &>> /dev/null & echo $! > $LOG_DIR/node03/launch.pid
NODE_03_PID=`cat $LOG_DIR/node03/launch.pid`
sleep 5

printf "\n"
read -p "Press enter to stop background node processes"
kill $NODE_00_PID
kill $NODE_01_PID
kill $NODE_02_PID
kill $NODE_03_PID
