#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

# Set GOPATH
GOPATH="$(go env GOPATH)"

AVALANCHE_PATH=$( cd "$( dirname "${BASH_SOURCE[0]}" )"; cd .. && pwd ) # Directory above this script
BUILD_DIR=$AVALANCHE_PATH/build # Where binaries go

# GIT_COMMIT=$( git rev-list -1 HEAD )
GIT_COMMIT=2c5753be2c0eba789e39c0961964e0c47b12fa0c

# Build aVALANCHE
echo "Building Avalanche..."
go build -ldflags "-X main.GitCommit=$GIT_COMMIT" -o "$BUILD_DIR/avalanchego" "$AVALANCHE_PATH/main/"*.go
