// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package constants

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/ava-labs/avalanchego/ids"
)

// Const variables to be exported
const (
	MainnetID uint32 = 1
	CascadeID uint32 = 2
	DenaliID  uint32 = 3
	EverestID uint32 = 4
	FujiID    uint32 = 5
	CostonID  uint32 = 16
	FtsoMvpID uint32 = 20210413
	SCDevID   uint32 = 20210406

	TestnetID  uint32 = FujiID
	UnitTestID uint32 = 10
	LocalID    uint32 = 12345

	MainnetName  = "mainnet"
	CascadeName  = "cascade"
	DenaliName   = "denali"
	EverestName  = "everest"
	FujiName     = "fuji"
	TestnetName  = "testnet"
	UnitTestName = "testing"
	LocalName    = "local"
	CostonName   = "coston"
	FtsoMvpName  = "ftsomvp"
	SCDevName    = "scdev"

	MainnetHRP  = "avax"
	CascadeHRP  = "cascade"
	DenaliHRP   = "denali"
	EverestHRP  = "everest"
	FujiHRP     = "fuji"
	UnitTestHRP = "testing"
	LocalHRP    = "local"
	FallbackHRP = "custom"
	CostonHRP   = "coston"
	FtsoMvpHRP  = "ftsomvp"
	SCDevHRP    = "scdev"
)

// Variables to be exported
var (
	PrimaryNetworkID = ids.Empty
	PlatformChainID  = ids.Empty

	NetworkIDToNetworkName = map[uint32]string{
		MainnetID:  MainnetName,
		CascadeID:  CascadeName,
		DenaliID:   DenaliName,
		EverestID:  EverestName,
		FujiID:     FujiName,
		UnitTestID: UnitTestName,
		LocalID:    LocalName,
		CostonID:   CostonName,
		FtsoMvpID:  FtsoMvpName,
		SCDevID:    SCDevName,
	}
	NetworkNameToNetworkID = map[string]uint32{
		MainnetName:  MainnetID,
		CascadeName:  CascadeID,
		DenaliName:   DenaliID,
		EverestName:  EverestID,
		FujiName:     FujiID,
		TestnetName:  TestnetID,
		UnitTestName: UnitTestID,
		LocalName:    LocalID,
		CostonName:   CostonID,
		FtsoMvpName:  FtsoMvpID,
		SCDevName:    SCDevID,
	}

	NetworkIDToHRP = map[uint32]string{
		MainnetID:  MainnetHRP,
		CascadeID:  CascadeHRP,
		DenaliID:   DenaliHRP,
		EverestID:  EverestHRP,
		FujiID:     FujiHRP,
		UnitTestID: UnitTestHRP,
		LocalID:    LocalHRP,
		CostonID:   CostonHRP,
		FtsoMvpID:  FtsoMvpHRP,
		SCDevID:    SCDevHRP,
	}
	NetworkHRPToNetworkID = map[string]uint32{
		MainnetHRP:  MainnetID,
		CascadeHRP:  CascadeID,
		DenaliHRP:   DenaliID,
		EverestHRP:  EverestID,
		FujiHRP:     FujiID,
		UnitTestHRP: UnitTestID,
		LocalHRP:    LocalID,
		CostonHRP:   CostonID,
		FtsoMvpHRP:  FtsoMvpID,
		SCDevHRP:    SCDevID,
	}

	ValidNetworkPrefix = "network-"
)

// GetHRP returns the Human-Readable-Part of bech32 addresses for a networkID
func GetHRP(networkID uint32) string {
	if hrp, ok := NetworkIDToHRP[networkID]; ok {
		return hrp
	}
	return FallbackHRP
}

// NetworkName returns a human readable name for the network with
// ID [networkID]
func NetworkName(networkID uint32) string {
	if name, exists := NetworkIDToNetworkName[networkID]; exists {
		return name
	}
	return fmt.Sprintf("network-%d", networkID)
}

// NetworkID returns the ID of the network with name [networkName]
func NetworkID(networkName string) (uint32, error) {
	networkName = strings.ToLower(networkName)
	if id, exists := NetworkNameToNetworkID[networkName]; exists {
		return id, nil
	}

	idStr := networkName
	if strings.HasPrefix(networkName, ValidNetworkPrefix) {
		idStr = networkName[len(ValidNetworkPrefix):]
	}
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("failed to parse %q as a network name", networkName)
	}
	return uint32(id), nil
}
