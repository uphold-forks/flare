// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package node

import (
	"time"

	"github.com/ava-labs/avalanchego/utils/constants"
	"github.com/ava-labs/avalanchego/version"
)

var (
	Version                      = version.NewDefaultVersion(constants.PlatformName, 1, 3, 2)
	MinimumCompatibleVersion     = version.NewDefaultVersion(constants.PlatformName, 1, 3, 0)
	PrevMinimumCompatibleVersion = version.NewDefaultVersion(constants.PlatformName, 1, 2, 0)
	MinimumUnmaskedVersion       = version.NewDefaultVersion(constants.PlatformName, 1, 1, 0)
	PrevMinimumUnmaskedVersion   = version.NewDefaultVersion(constants.PlatformName, 1, 0, 0)
	VersionParser                = version.NewDefaultParser()
)

func GetApricotPhase0Time(networkID uint32) time.Time {
	return time.Unix(10000000000, 0)
}

func GetApricotPhase1Time(networkID uint32) time.Time {
	return time.Unix(10000000000, 0)
}
