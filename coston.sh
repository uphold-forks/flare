#!/bin/bash
if [[ $(pwd) =~ " " ]]; then echo "Working directory path contains a folder with a space in its name, please remove all spaces" && exit; fi
if [ -z ${GOPATH+x} ]; then echo "GOPATH is not set, visit https://github.com/golang/go/wiki/SettingGOPATH" && exit; fi
if [ -z ${XRP_APIs+x} ] || [ "$XRP_APIs" == "url1, url2, ..., urlN" ]; then echo "XRP_APIs is not set, please set it using the form: $ export XRP_APIs=\"url1, url2, ..., urlN\"" && exit; fi
printf "\x1b[34mCoston Testnet Peering Deployment\x1b[0m\n\n"
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
	mkdir -p $LOG_DIR/node04
	printf "Building Flare Core...\n"
	./scripts/build.sh
fi

cd config
printf "Generating node keypair...\n"
go run gen_node_key.go
cd - &> /dev/null

./build/avalanchego \
    --http-host= \
    --public-ip=127.0.0.1 \
    --snow-sample-size=2 \
    --snow-quorum-size=2 \
    --http-port=9650 \
    --staking-port=9651 \
    --db-dir=db/node04/ \
    --staking-enabled=true \
    --p2p-tls-enabled=true \
    --network-id=coston \
    --bootstrap-ips=$(dig +short coston.flare.network):9300  \
    --bootstrap-ids=$(curl -sX POST --data '{ "jsonrpc":"2.0", "id":1, "method":"info.getNodeID" }' -H 'content-type:application/json;' https://coston.flare.network/ext/info | jq -r ".result.nodeID")  \
    --staking-tls-cert-file=$(pwd)/config/keys/node04/node.crt  \
    --staking-tls-key-file=$(pwd)/config/keys/node04/node.key \
    --log-level=debug \
    --validators-file=$(pwd)/config/validators/validators_0001.json \
    --alert-apis=https://flare.network \
    --xrp-apis=$XRP_APIs