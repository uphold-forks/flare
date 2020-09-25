// Copyright 2014 The go-ethereum Authors
// This file is part of the go-ethereum library.
//
// The go-ethereum library is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// The go-ethereum library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with the go-ethereum library. If not, see <http://www.gnu.org/licenses/>.

package core

import (
	"errors"
	"math/big"

	"github.com/ava-labs/gecko/sc"
	"github.com/ava-labs/go-ethereum/common"
	"github.com/ava-labs/go-ethereum/core/vm"
	"github.com/ava-labs/go-ethereum/log"
)

var (
	errInsufficientBalanceForGas = errors.New("insufficient balance to pay for gas")
)

type StateTransition struct {
	gp         *GasPool
	msg        Message
	gas        uint64
	gasPrice   *big.Int
	initialGas uint64
	value      *big.Int
	data       []byte
	state      vm.StateDB
	evm        *vm.EVM
}

// Message represents a message sent to a contract.
type Message interface {
	From() common.Address
	//FromFrontier() (common.Address, error)
	To() *common.Address

	GasPrice() *big.Int
	Gas() uint64
	Value() *big.Int

	Nonce() uint64
	CheckNonce() bool
	Data() []byte
}

// NewStateTransition initialises and returns a new state transition object.
func NewStateTransition(evm *vm.EVM, msg Message, gp *GasPool) *StateTransition {
	return &StateTransition{
		gp:       gp,
		evm:      evm,
		msg:      msg,
		gasPrice: msg.GasPrice(),
		value:    msg.Value(),
		data:     msg.Data(),
		state:    evm.StateDB,
	}
}

// ApplyMessage computes the new state by applying the given message
// against the old state within the environment.
//
// ApplyMessage returns the bytes returned by any EVM execution (if it took place),
// the gas used (which includes gas refunds) and an error if it failed. An error always
// indicates a core error meaning that the message would always fail for that particular
// state and would never be accepted within a block.
func CoreEthApplyMessage(evm *vm.EVM, msg Message, gp *GasPool) ([]byte, uint64, bool, error) {
	return NewStateTransition(evm, msg, gp).CoreEthTransitionDb()
}

// to returns the recipient of the message.
func (st *StateTransition) to() common.Address {
	if st.msg == nil || st.msg.To() == nil /* contract creation */ {
		return common.Address{}
	}
	return *st.msg.To()
}

func (st *StateTransition) buyGas() error {
	FixedGasMaxTotal := new(big.Int).Mul(new(big.Int).SetUint64(sc.FixedGasMax), new(big.Int).SetUint64(sc.FixedGasPrice))
	
	if st.state.GetBalance(st.msg.From()).Cmp(FixedGasMaxTotal) < 0 || sc.FixedGasMax < sc.FixedGas {
		return errInsufficientBalanceForGas
	}
	if err := st.gp.SubGas(sc.FixedGas); err != nil {
		return err
	}

	FixedGasTotal := new(big.Int).Mul(new(big.Int).SetUint64(sc.FixedGas), new(big.Int).SetUint64(sc.FixedGasPrice))

	st.state.SubBalance(st.msg.From(), FixedGasTotal)
	return nil
}

func (st *StateTransition) preCheck() error {
	// Make sure this transaction's nonce is correct.
	if st.msg.CheckNonce() {
		nonce := st.state.GetNonce(st.msg.From())
		if nonce < st.msg.Nonce() {
			return ErrNonceTooHigh
		} else if nonce > st.msg.Nonce() {
			return ErrNonceTooLow
		}
	}
	return st.buyGas()
}

// TransitionDb will transition the state by applying the current message and
// returning the result including the used gas. It returns an error if failed.
// An error indicates a consensus issue.
func (st *StateTransition) CoreEthTransitionDb() (ret []byte, usedGas uint64, failed bool, err error) {
	if err = st.preCheck(); err != nil {
		return
	}
	msg := st.msg
	sender := vm.AccountRef(msg.From())
	contractCreation := msg.To() == nil

	var (
		evm = st.evm
		vmerr error
	)
	if contractCreation {
		ret, _, _, vmerr = evm.Create(sender, st.data, sc.FixedGasMax, st.value)
	} else {
		// Increment the nonce for the next transaction
		st.state.SetNonce(msg.From(), st.state.GetNonce(sender.Address())+1)

		if (*msg.To() == sc.StateConnectorContract) {
			originalCoinbase := evm.Context.Coinbase
			defer func() {
				evm.Context.Coinbase = originalCoinbase
			}()
			evm.Context.Coinbase = sc.LocalNodeAddr
		}

		ret, _, vmerr = evm.Call(sender, st.to(), st.data, sc.FixedGasMax, st.value)

	}
	if vmerr != nil {
		log.Debug("VM returned with error", "err", vmerr)
		if vmerr == vm.ErrInsufficientBalance {
			return nil, 0, false, vmerr
		}
	}

	st.state.AddBalance(sc.StateConnectorContract, new(big.Int).Mul(new(big.Int).SetUint64(sc.FixedGas), new(big.Int).SetUint64(sc.FixedGasPrice)))

	return ret, sc.FixedGas, vmerr != nil, err
}