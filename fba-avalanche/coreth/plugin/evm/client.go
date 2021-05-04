// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package evm

import (
	"fmt"
	"time"

	"github.com/ava-labs/avalanchego/api"
	"github.com/ava-labs/avalanchego/ids"
	"github.com/ava-labs/avalanchego/utils/formatting"
	"github.com/ava-labs/avalanchego/utils/rpc"
)

// Client ...
type Client struct {
	requester rpc.EndpointRequester
}

// NewClient returns a Client for interacting with EVM [chain]
func NewClient(uri, chain string, requestTimeout time.Duration) *Client {
	return &Client{
		requester: rpc.NewEndpointRequester(uri, fmt.Sprintf("/ext/bc/%s/avax", chain), "avax", requestTimeout),
	}
}

// NewCChainClient returns a Client for interacting with the C Chain
func NewCChainClient(uri string, requestTimeout time.Duration) *Client {
	return NewClient(uri, "C", requestTimeout)
}

// IssueTx issues a transaction to a node and returns the TxID
func (c *Client) IssueTx(txBytes []byte) (ids.ID, error) {
	res := &api.JSONTxID{}
	txStr, err := formatting.Encode(formatting.Hex, txBytes)
	if err != nil {
		return res.TxID, fmt.Errorf("problem hex encoding bytes: %w", err)
	}
	err = c.requester.SendRequest("issueTx", &api.FormattedTx{
		Tx:       txStr,
		Encoding: formatting.Hex,
	}, res)
	return res.TxID, err
}

// GetTxStatus returns the status of [txID]
// func (c *Client) GetTxStatus(txID ids.ID) (choices.Status, error) {
// 	res := &GetTxStatusReply{}
// 	err := c.requester.SendRequest("getTxStatus", &api.JSONTxID{
// 		TxID: txID,
// 	}, res)
// 	return res.Status, err
// }

// GetTx returns the byte representation of [txID]
func (c *Client) GetTx(txID ids.ID) ([]byte, error) {
	res := &api.FormattedTx{}
	err := c.requester.SendRequest("getTx", &api.GetTxArgs{
		TxID:     txID,
		Encoding: formatting.Hex,
	}, res)
	if err != nil {
		return nil, err
	}

	return formatting.Decode(formatting.Hex, res.Tx)
}
