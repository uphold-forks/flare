// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package genesis

import (
	"time"

	"github.com/ava-labs/avalanchego/utils/units"
)

var (
	fujiGenesisConfigJSON = `{
		"networkID": 5,
		"allocations": [
			{
				"ethAddr": "0xfffEc6C83c8BF5c3F4AE0cCF8c45CE20E4560BD7",
				"avaxAddr": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"initialAmount": 0,
				"unlockSchedule": [
					{
						"amount": 1000000
					}
				]
			}
		],
		"startTime": 1626530000,
		"initialStakeDuration": 31536000,
		"initialStakeDurationOffset": 0,
		"initialStakedFunds": [
			"X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5"
		],
		"initialStakers": [
			{
				"nodeID": "NodeID-McERUZEMcYh69k23MRNWuFAzxo5wcVRj4",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-PvdjnVFttemfVSiB3eymorsgLvFhthZfg",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-DHviuwAp3xTupznQ4GuN6RsNHuNDCNTFr",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-GWDKipP5qqHeRXjs6vq2LSxWkEfcuzVUq",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-EUd2nHQX6qXQMgcB6m1hi2v8mufhDEJ4f",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-9LyMRJX3cX8hfr3GJ2MNEdZkX9oi7zAqu",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-9LnFMaC3cQNUBZTNfWMh3qnmQDGGSHx8W",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-5HTpLj5jTuCVZmEZduKv3pZJtEog4kLzU",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-Giko2tjmG6tKfZohSkYe8CeyDFG6TqBuG",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-CcFdhWGU1DgZs6ZYEDXYs1s3sniEsqJjp",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-2sJccyKdDfWrSstmYheH4AhaVte6gjzJM",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-BHXiArzzknWBpMoXNBDjJKJFtLT1XHh1A",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-HmgCXE2wohedvKFcs3grAXBF2X7iWCxHB",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-7MJVmbWR6BQyhKwu237BUzondoxpTtBYx",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-PCTxycR7M7ddGVgrxQPuRni1x929rjRoV",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-5p9SqCE8E4YiAKcAwwbDLChKYeJ22rWZQ",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-CDQEvf23WDSsVDSPsADXxHeocRKAGhCBV",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-EWCrwqy6yyefmSZZ8zQWpq4FdwbiJ8voA",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-FoGB1CgNnDLUeRTuDXU3JTGuGwVML2h7H",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			},
			{
				"nodeID": "NodeID-HoyjJ2epFh9jduDZ3vXQPcjfNaHVio7T6",
				"rewardAddress": "X-fuji1wlttjwm5lnvp96fr385yee5z3j5m3pdwpgwtu5",
				"delegationFee": 0
			}
		],
		"cChainGenesis": "",
		"message": "flare"
	}`
	// FujiParams are the params used for the fuji testnet
	FujiParams = Params{
		TxFee:                1 * units.NanoAvax,
		CreationTxFee:        1 * units.NanoAvax,
		UptimeRequirement:    .6, // 60%
		MinValidatorStake:    1 * units.NanoAvax,
		MaxValidatorStake:    1000 * units.NanoAvax,
		MinDelegatorStake:    1 * units.NanoAvax,
		MinDelegationFee:     0,
		MinStakeDuration:     7 * 24 * time.Hour,
		MaxStakeDuration:     365 * 24 * time.Hour,
		StakeMintingPeriod:   365 * 24 * time.Hour,
		EpochFirstTransition: time.Unix(1626530000, 0),
		EpochDuration:        6 * time.Hour,
	}
)
