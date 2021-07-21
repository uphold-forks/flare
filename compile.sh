#!/bin/bash
WORKING_DIR=$(pwd)

sudo rm -rf $GOPATH/src/github.com/ava-labs
sudo rm -rf $GOPATH/pkg/mod/github.com/ava-labs
go get -v -d github.com/ava-labs/avalanchego/...
cd $GOPATH/src/github.com/ava-labs/avalanchego
git checkout ac32de45ffd6769007f250f123a5d5dae8230456

echo "Applying Flare-specific changes to AvalancheGo..."

# Apply changes to avalanchego
cp $WORKING_DIR/src/avalanchego/flags.go ./config/flags.go
cp $WORKING_DIR/src/avalanchego/beacons.go ./genesis/beacons.go
cp $WORKING_DIR/src/avalanchego/genesis_coston.go ./genesis/genesis_coston.go
cp $WORKING_DIR/src/avalanchego/genesis_fuji.go ./genesis/genesis_fuji.go
cp $WORKING_DIR/src/avalanchego/unparsed_config.go ./genesis/unparsed_config.go
cp $WORKING_DIR/src/avalanchego/set.go ./snow/validators/set.go
cp $WORKING_DIR/src/avalanchego/build_coreth.sh ./scripts/build_coreth.sh
mkdir ./scripts/coreth_changes
cp $WORKING_DIR/src/coreth/state_transition.go ./scripts/coreth_changes/state_transition.go
cp $WORKING_DIR/src/stateco/state_connector.go ./scripts/coreth_changes/state_connector.go

./scripts/build.sh
rm -rf ./scripts/coreth_changes