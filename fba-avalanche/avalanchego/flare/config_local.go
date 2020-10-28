package flare

import (
	"math/big"
  	"github.com/ethereum/go-ethereum/common"
)

// State-connector smart contract
func GetStateConnectorContractAddr(BlockNumber *big.Int) (common.Address) {
    switch {
        default:
            return common.HexToAddress("0x9679c89C54245C100fe5196C07ebeF5176d74735")
    }
}

// Contract where all transaction fees get routed to
func GetFeePoolContractAddr(BlockNumber *big.Int) (common.Address) {
    switch {
        default:
            return common.HexToAddress("0x0000000000000000000000000000000000000000")
    }
}