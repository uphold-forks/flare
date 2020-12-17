package flare

import (
	"math/big"
)

// Fixed gas used for custom block.coinbase operations
func GetFixedGasUsed(BlockNumber *big.Int) (uint64) {
    switch {
        default:
            return 100000
    }
}

// Fixed gas ceiling for custom block.coinbase operations
func GetFixedGasCeil(BlockNumber *big.Int) (uint64) {
    switch {
        default:
            return 200000000000000000
    }
}

// State-connector smart contract
func GetStateConnectorContractAddr(BlockNumber *big.Int) (string) {
    switch {
        default:
            return "0x9679c89C54245C100fe5196C07ebeF5176d74735"
    }
}

// Contract where all transaction fees get routed to
func GetFeePoolContractAddr(BlockNumber *big.Int) (string) {
    switch {
        default:
            return "0x0000000000000000000000000000000000000000"
    }
}