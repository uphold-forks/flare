#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

# Set GOPATH
GOPATH="$(go env GOPATH)"

AVALANCHE_PATH=$( cd "$( dirname "${BASH_SOURCE[0]}" )"; cd .. && pwd ) # Directory above this script
BUILD_DIR=$AVALANCHE_PATH/build # Where binaries go

GIT_COMMIT=032a79a3dcb928f7bc0fcac7f30ed13ab6e7aae6

# Build aVALANCHE
echo "Building Avalanche..."
go build -ldflags "-X main.GitCommit=$GIT_COMMIT" -o "$BUILD_DIR/avalanchego" "$AVALANCHE_PATH/main/"*.go
