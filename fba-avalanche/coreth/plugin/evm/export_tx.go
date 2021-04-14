// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package evm

import (
	"fmt"

	"github.com/ava-labs/coreth/core/state"

	"github.com/ava-labs/avalanchego/database"
	"github.com/ava-labs/avalanchego/ids"
	"github.com/ava-labs/avalanchego/snow"
	"github.com/ava-labs/avalanchego/utils/crypto"
	"github.com/ava-labs/avalanchego/vms/components/avax"
)

// UnsignedExportTx is an unsigned ExportTx
type UnsignedExportTx struct {
	avax.Metadata
	// ID of the network on which this tx was issued
	NetworkID uint32 `serialize:"true" json:"networkID"`
	// ID of this blockchain.
	BlockchainID ids.ID `serialize:"true" json:"blockchainID"`
	// Which chain to send the funds to
	DestinationChain ids.ID `serialize:"true" json:"destinationChain"`
	// Inputs
	Ins []EVMInput `serialize:"true" json:"inputs"`
	// Outputs that are exported to the chain
	ExportedOutputs []*avax.TransferableOutput `serialize:"true" json:"exportedOutputs"`
}

// InputUTXOs returns an empty set
func (tx *UnsignedExportTx) InputUTXOs() ids.Set { return ids.Set{} }

// Verify this transaction is well-formed
func (tx *UnsignedExportTx) Verify(
	avmID ids.ID,
	ctx *snow.Context,
	feeAmount uint64,
	feeAssetID ids.ID,
	ap1 bool,
) error {
	return errWrongChainID
}

// SemanticVerify this transaction is valid.
func (tx *UnsignedExportTx) SemanticVerify(
	vm *VM,
	stx *Tx,
	ap1 bool,
) TxError {
	return permError{fmt.Errorf("failed to fetch import UTXOs")}
}

// Accept this transaction.
func (tx *UnsignedExportTx) Accept(ctx *snow.Context, _ database.Batch) error {
	return nil
}

// newExportTx returns a new ExportTx
func (vm *VM) newExportTx(
	assetID ids.ID, // AssetID of the tokens to export
	amount uint64, // Amount of tokens to export
	chainID ids.ID, // Chain to send the UTXOs to
	to ids.ShortID, // Address of chain recipient
	keys []*crypto.PrivateKeySECP256K1R, // Pay the fee and provide the tokens
) (*Tx, error) {
	return nil, errWrongChainID
}

// EVMStateTransfer executes the state update from the atomic export transaction
func (tx *UnsignedExportTx) EVMStateTransfer(vm *VM, state *state.StateDB) error {
	return nil
}
