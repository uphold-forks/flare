// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package evm

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"

	"github.com/ava-labs/avalanchego/api"
	"github.com/ava-labs/avalanchego/ids"
	"github.com/ava-labs/avalanchego/utils/constants"
	"github.com/ava-labs/avalanchego/utils/crypto"
	"github.com/ava-labs/avalanchego/utils/formatting"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/log"
)

// test constants
const (
	GenesisTestAddr = "0x751a0b96e1042bee789452ecb20253fba40dbe85"
	GenesisTestKey  = "0xabd71b35d559563fea757f0f5edbde286fb8c043105b15abb7cd57189306d7d1"

	// Max number of addresses that can be passed in as argument to GetUTXOs
	maxGetUTXOsAddrs = 1024
)

var (
	errNoAddresses   = errors.New("no addresses provided")
	errNoSourceChain = errors.New("no source chain provided")
)

// SnowmanAPI introduces snowman specific functionality to the evm
type SnowmanAPI struct{ vm *VM }

// AvaxAPI offers Avalanche network related API methods
type AvaxAPI struct{ vm *VM }

// NetAPI offers network related API methods
type NetAPI struct{ vm *VM }

// Listening returns an indication if the node is listening for network connections.
func (s *NetAPI) Listening() bool { return true } // always listening

// PeerCount returns the number of connected peers
func (s *NetAPI) PeerCount() hexutil.Uint { return hexutil.Uint(0) } // TODO: report number of connected peers

// Version returns the current ethereum protocol version.
func (s *NetAPI) Version() string { return fmt.Sprintf("%d", s.vm.networkID) }

// Web3API offers helper API methods
type Web3API struct{}

// ClientVersion returns the version of the vm running
func (s *Web3API) ClientVersion() string { return Version }

// Sha3 returns the bytes returned by hashing [input] with Keccak256
func (s *Web3API) Sha3(input hexutil.Bytes) hexutil.Bytes { return ethcrypto.Keccak256(input) }

// GetAcceptedFrontReply defines the reply that will be sent from the
// GetAcceptedFront API call
type GetAcceptedFrontReply struct {
	Hash   common.Hash `json:"hash"`
	Number *big.Int    `json:"number"`
}

// GetAcceptedFront returns the last accepted block's hash and height
func (api *SnowmanAPI) GetAcceptedFront(ctx context.Context) (*GetAcceptedFrontReply, error) {
	blk := api.vm.getLastAccepted().ethBlock
	return &GetAcceptedFrontReply{
		Hash:   blk.Hash(),
		Number: blk.Number(),
	}, nil
}

// IssueBlock to the chain
func (api *SnowmanAPI) IssueBlock(ctx context.Context) error {
	log.Info("Issuing a new block")

	return api.vm.tryBlockGen()
}

// parseAssetID parses an assetID string into an ID
func (service *AvaxAPI) parseAssetID(assetID string) (ids.ID, error) {
	if assetID == "" {
		return ids.ID{}, fmt.Errorf("assetID is required")
	} else if assetID == "AVAX" {
		return service.vm.ctx.AVAXAssetID, nil
	} else {
		return ids.FromString(assetID)
	}
}

// ExportKeyArgs are arguments for ExportKey
type ExportKeyArgs struct {
	api.UserPass
	Address string `json:"address"`
}

// ExportKeyReply is the response for ExportKey
type ExportKeyReply struct {
	// The decrypted PrivateKey for the Address provided in the arguments
	PrivateKey    string `json:"privateKey"`
	PrivateKeyHex string `json:"privateKeyHex"`
}

// ExportKey returns a private key from the provided user
func (service *AvaxAPI) ExportKey(r *http.Request, args *ExportKeyArgs, reply *ExportKeyReply) error {
	log.Info("EVM: ExportKey called")

	address, err := ParseEthAddress(args.Address)
	if err != nil {
		return fmt.Errorf("couldn't parse %s to address: %s", args.Address, err)
	}

	db, err := service.vm.ctx.Keystore.GetDatabase(args.Username, args.Password)
	if err != nil {
		return fmt.Errorf("problem retrieving user '%s': %w", args.Username, err)
	}
	defer db.Close()

	user := user{
		secpFactory: &service.vm.secpFactory,
		db:          db,
	}
	sk, err := user.getKey(address)
	if err != nil {
		return fmt.Errorf("problem retrieving private key: %w", err)
	}
	encodedKey, err := formatting.Encode(formatting.CB58, sk.Bytes())
	if err != nil {
		return fmt.Errorf("problem encoding bytes as cb58: %w", err)
	}
	reply.PrivateKey = constants.SecretKeyPrefix + encodedKey
	reply.PrivateKeyHex = hexutil.Encode(sk.Bytes())
	return nil
}

// ImportKeyArgs are arguments for ImportKey
type ImportKeyArgs struct {
	api.UserPass
	PrivateKey string `json:"privateKey"`
}

// ImportKey adds a private key to the provided user
func (service *AvaxAPI) ImportKey(r *http.Request, args *ImportKeyArgs, reply *api.JSONAddress) error {
	log.Info(fmt.Sprintf("EVM: ImportKey called for user '%s'", args.Username))

	if !strings.HasPrefix(args.PrivateKey, constants.SecretKeyPrefix) {
		return fmt.Errorf("private key missing %s prefix", constants.SecretKeyPrefix)
	}

	trimmedPrivateKey := strings.TrimPrefix(args.PrivateKey, constants.SecretKeyPrefix)
	pkBytes, err := formatting.Decode(formatting.CB58, trimmedPrivateKey)
	if err != nil {
		return fmt.Errorf("problem parsing private key: %w", err)
	}

	skIntf, err := service.vm.secpFactory.ToPrivateKey(pkBytes)
	if err != nil {
		return fmt.Errorf("problem parsing private key: %w", err)
	}
	sk, ok := skIntf.(*crypto.PrivateKeySECP256K1R)
	if !ok {
		return fmt.Errorf("expected *crypto.PrivateKeySECP256K1R but got %T", skIntf)
	}

	// TODO: return eth address here
	reply.Address = FormatEthAddress(GetEthAddress(sk))

	db, err := service.vm.ctx.Keystore.GetDatabase(args.Username, args.Password)
	if err != nil {
		return fmt.Errorf("problem retrieving data: %w", err)
	}
	defer db.Close()

	user := user{
		secpFactory: &service.vm.secpFactory,
		db:          db,
	}
	if err := user.putAddress(sk); err != nil {
		return fmt.Errorf("problem saving key %w", err)
	}
	return nil
}

// IssueTx ...
func (service *AvaxAPI) IssueTx(r *http.Request, args *api.FormattedTx, response *api.JSONTxID) error {
	log.Info("EVM: IssueTx called")

	txBytes, err := formatting.Decode(args.Encoding, args.Tx)
	if err != nil {
		return fmt.Errorf("problem decoding transaction: %w", err)
	}

	tx := &Tx{}
	if _, err := service.vm.codec.Unmarshal(txBytes, tx); err != nil {
		return fmt.Errorf("problem parsing transaction: %w", err)
	}
	if err := tx.Sign(service.vm.codec, nil); err != nil {
		return fmt.Errorf("problem initializing transaction: %w", err)
	}

	if err := tx.UnsignedAtomicTx.SemanticVerify(service.vm, tx, service.vm.useApricotPhase1()); err != nil {
		return err
	}

	response.TxID = tx.ID()
	return service.vm.issueTx(tx)
}
