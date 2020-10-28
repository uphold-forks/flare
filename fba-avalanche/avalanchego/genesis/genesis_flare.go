// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package genesis

import (
	"time"
	"github.com/ava-labs/avalanchego/utils/units"
)

// PrivateKey-vmRQiZeXEXYMyJhEiqdC2z5JhuDbxL8ix9UVvjgMu2Er1NepE => X-local1g65uqn6t77p656w64023nh8nd9updzmxyymev2
// PrivateKey-ewoqjP7PxY4yr3iLTpLisriqt94hdyDFNgchSxGGztUrTXtNN => X-local18jma8ppw3nhx5r4ap8clazz0dps7rv5u00z96u

var (
	flareGenesisConfigJSON = `{
		"networkID": 14,
		"allocations": [],
		"startTime": 0,
		"initialStakeDuration": 0,
		"initialStakeDurationOffset": 0,
		"initialStakedFunds": [],
		"initialStakers": [],
		"message": "flare"
	}`
	
	// LocalParams are the params used for local networks
	FlareParams = Params{
		TxFee:              units.Avax,
		CreationTxFee:      units.Avax,
		UptimeRequirement:  0, // 60%
		MinValidatorStake:  units.Avax,
		MaxValidatorStake:  units.Avax,
		MinDelegatorStake:  units.Avax,
		MinDelegationFee:   0, // 2%
		MinStakeDuration:   10 * 365 * 24 * time.Hour,
		MaxStakeDuration:   100 * 365 * 24 * time.Hour,
		StakeMintingPeriod: 100 * 365 * 24 * time.Hour,
	}
)
