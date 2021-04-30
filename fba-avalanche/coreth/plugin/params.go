// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/ava-labs/coreth/plugin/evm"
)

var (
	cliConfig evm.CommandLineConfig
	version   bool
)

func init() {
	fs := flag.NewFlagSet("coreth", flag.ContinueOnError)

	config := fs.String("config", "default", "Pass in CLI Config to set runtime attributes for Coreth")
	fs.BoolVar(&version, "version", false, "If true, print version and quit")

	if err := fs.Parse(os.Args[1:]); err != nil {
		cliConfig.ParsingError = err
		return
	}

	cliConfig.RPCGasCap = 0
	cliConfig.RPCTxFeeCap = 0
	cliConfig.APIMaxDuration = 15000000000 // 15 seconds
	cliConfig.MaxBlocksPerRequest = 100

	if *config != "default" {
		for i, value := range strings.Split(*config, " ") {
			if value != "" {
				if i == 0 {
					if value == "api-enabled" {
						cliConfig.EthAPIEnabled = true
						cliConfig.PersonalAPIEnabled = true
						cliConfig.TxPoolAPIEnabled = true
						cliConfig.NetAPIEnabled = true
						cliConfig.Web3APIEnabled = true
						cliConfig.DebugAPIEnabled = true
					}
				} else {
					cliConfig.StateConnectorConfig = append(cliConfig.StateConnectorConfig, value)
				}
			} else {
				cliConfig.ParsingError = fmt.Errorf("StateConnectorConfig contains empty string")
				return
			}
		}
	} else {
		cliConfig.ParsingError = fmt.Errorf("coreth cliConfig is not set.")
	}

}
