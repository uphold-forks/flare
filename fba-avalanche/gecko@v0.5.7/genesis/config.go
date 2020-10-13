// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package genesis

import (
	"github.com/ava-labs/gecko/sc"
	"github.com/ava-labs/gecko/ids"
)

// Note that since an AVA network has exactly one Platform Chain,
// and the Platform Chain defines the genesis state of the network
// (who is staking, which chains exist, etc.), defining the genesis
// state of the Platform Chain is the same as defining the genesis
// state of the network.

// Config contains the genesis addresses used to construct a genesis
type Config struct {
	MintAddresses, FundedAddresses, StakerIDs                   []string
	ParsedMintAddresses, ParsedFundedAddresses, ParsedStakerIDs []ids.ShortID
	EVMBytes                                                    []byte
}

func (c *Config) init() error {
	c.ParsedMintAddresses = nil
	for _, addrStr := range c.MintAddresses {
		addr, err := ids.ShortFromString(addrStr)
		if err != nil {
			return err
		}
		c.ParsedMintAddresses = append(c.ParsedMintAddresses, addr)
	}
	c.ParsedFundedAddresses = nil
	for _, addrStr := range c.FundedAddresses {
		addr, err := ids.ShortFromString(addrStr)
		if err != nil {
			return err
		}
		c.ParsedFundedAddresses = append(c.ParsedFundedAddresses, addr)
	}
	c.ParsedStakerIDs = nil
	for _, addrStr := range c.StakerIDs {
		addr, err := ids.ShortFromString(addrStr)
		if err != nil {
			return err
		}
		c.ParsedStakerIDs = append(c.ParsedStakerIDs, addr)
	}
	return nil
}

// Hard coded genesis constants
var (
	DefaultConfig = Config{
		MintAddresses: []string{},
		FundedAddresses: []string{},
		StakerIDs: sc.Validators,
		EVMBytes: []byte(sc.GenesisJSON),
	}
)

// GetConfig ...
func GetConfig(networkID uint32) *Config {
	return &DefaultConfig
}
