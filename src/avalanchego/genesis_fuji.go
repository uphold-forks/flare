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
		"allocations": [],
		"startTime": 1626530000,
		"initialStakeDuration": 31536000,
		"initialStakeDurationOffset": 0,
		"initialStakedFunds": [],
		"initialStakers": [],
		"cChainGenesis": "",
		"message": "flare"
	}`
	// FujiParams are the params used for the fuji testnet
	FujiParams = Params{
		TxFeeConfig: TxFeeConfig{
			TxFee:                 units.MilliAvax,
			CreateAssetTxFee:      10 * units.MilliAvax,
			CreateSubnetTxFee:     100 * units.MilliAvax,
			CreateBlockchainTxFee: 100 * units.MilliAvax,
		},
		StakingConfig: StakingConfig{
			UptimeRequirement:  .6, // 60%
			MinValidatorStake:  1 * units.Avax,
			MaxValidatorStake:  3 * units.MegaAvax,
			MinDelegatorStake:  1 * units.Avax,
			MinDelegationFee:   20000, // 2%
			MinStakeDuration:   24 * time.Hour,
			MaxStakeDuration:   365 * 24 * time.Hour,
			StakeMintingPeriod: 365 * 24 * time.Hour,
		},
		EpochConfig: EpochConfig{
			EpochFirstTransition: time.Unix(1607626800, 0),
			EpochDuration:        6 * time.Hour,
		},
	}
)
