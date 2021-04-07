package core

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/ioutil"
	"math/big"
	"net/http"
	"os"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

var fileMutex sync.Mutex

// Fixed gas used for custom block.coinbase operations
func GetDataFee(blockNumber *big.Int) uint64 {
	switch {
	default:
		return 10000000
	}
}

func GetGovernanceContractAddr(blockNumber *big.Int) string {
	switch {
	default:
		return "0x1000000000000000000000000000000000000000"
	}
}

func GetStateConnectorContractAddr(blockNumber *big.Int) string {
	switch {
	default:
		return "0x1000000000000000000000000000000000000001"
	}
}

func GetSystemTriggerContractAddr(blockNumber *big.Int) string {
	switch {
	default:
		return "0x1000000000000000000000000000000000000002"
	}
}

func GetProveClaimPeriodFinalitySelector(blockNumber *big.Int) []byte {
	switch {
	default:
		return []byte{0xa5, 0x7d, 0x0e, 0x25}
	}
}

func GetProvePaymentFinalitySelector(blockNumber *big.Int) []byte {
	switch {
	default:
		return []byte{0x13, 0xbb, 0x43, 0x1c}
	}
}

func GetAddChainSelector(blockNumber *big.Int) []byte {
	switch {
	default:
		return []byte{0x1d, 0x4d, 0xed, 0x8e}
	}
}

func GetMaxAllowedChains(blockNumber *big.Int) uint32 {
	switch {
	default:
		return 1
	}
}

func GetSystemTriggerSelector(blockNumber *big.Int) []byte {
	switch {
	default:
		return []byte{0x7f, 0xec, 0x8d, 0x38}
	}
}

var (
	tr = &http.Transport{
		MaxIdleConns:       10,
		IdleConnTimeout:    60 * time.Second,
		DisableCompression: true,
	}
	client = &http.Client{
		Transport: tr,
		Timeout:   5 * time.Second,
	}
)

type StateHashes struct {
	Hashes []string `json:"hashes"`
}

func contains(slice []string, item string) bool {
	set := make(map[string]struct{}, len(slice))
	for _, s := range slice {
		set[s] = struct{}{}
	}
	_, ok := set[item]
	return ok
}

// =======================================================
// XRP
// =======================================================

type PingXRPParams struct {
}
type PingXRPPayload struct {
	Method string          `json:"method"`
	Params []PingXRPParams `json:"params"`
}
type GetXRPBlockRequestParams struct {
	LedgerIndex  uint64 `json:"ledger_index"`
	Full         bool   `json:"full"`
	Accounts     bool   `json:"accounts"`
	Transactions bool   `json:"transactions"`
	Expand       bool   `json:"expand"`
	OwnerFunds   bool   `json:"owner_funds"`
}
type GetXRPBlockRequestPayload struct {
	Method string                     `json:"method"`
	Params []GetXRPBlockRequestParams `json:"params"`
}
type CheckXRPErrorResponse struct {
	Error string `json:"error"`
}
type GetXRPBlockResponse struct {
	LedgerHash  string `json:"ledger_hash"`
	LedgerIndex int    `json:"ledger_index"`
	Validated   bool   `json:"validated"`
}

func PingXRP(chainURL string) bool {
	data := PingXRPPayload{
		Method: "ping",
	}
	payloadBytes, err := json.Marshal(data)
	if err != nil {
		return false
	}
	body := bytes.NewReader(payloadBytes)

	req, err := http.NewRequest("POST", chainURL, body)
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode == 200 {
		return true
	} else {
		return false
	}
}

func GetXRPBlock(ledger uint64, chainURL string) (string, bool) {
	data := GetXRPBlockRequestPayload{
		Method: "ledger",
		Params: []GetXRPBlockRequestParams{
			GetXRPBlockRequestParams{
				LedgerIndex:  ledger,
				Full:         false,
				Accounts:     false,
				Transactions: false,
				Expand:       false,
				OwnerFunds:   false,
			},
		},
	}
	payloadBytes, err := json.Marshal(data)
	if err != nil {
		return "", true
	}
	body := bytes.NewReader(payloadBytes)
	req, err := http.NewRequest("POST", chainURL, body)
	if err != nil {
		return "", true
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return "", true
	}
	defer resp.Body.Close()
	if resp.StatusCode == 200 {
		respBody, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return "", true
		}
		var checkErrorResp map[string]CheckXRPErrorResponse
		err = json.Unmarshal(respBody, &checkErrorResp)
		if err != nil {
			return "", true
		}
		if checkErrorResp["result"].Error != "" {
			return "", true
		}
		var jsonResp map[string]GetXRPBlockResponse
		err = json.Unmarshal(respBody, &jsonResp)
		if err != nil {
			return "", true
		}
		if !jsonResp["result"].Validated {
			return "", true
		}
		return jsonResp["result"].LedgerHash, false
	}
	return "", true
}

func ProveClaimPeriodFinalityXRP(checkRet []byte, chainURL string) (bool, bool) {
	ledger := binary.BigEndian.Uint64(checkRet[56:64])
	ledgerHashString, err := GetXRPBlock(ledger, chainURL)
	if err {
		return false, true
	}
	if ledgerHashString != "" && bytes.Equal(crypto.Keccak256([]byte(ledgerHashString)), checkRet[96:128]) {
		return true, false
	}
	return false, false
}

type GetXRPTxRequestParams struct {
	Transaction string `json:"transaction"`
	Binary      bool   `json:"binary"`
}
type GetXRPTxRequestPayload struct {
	Method string                  `json:"method"`
	Params []GetXRPTxRequestParams `json:"params"`
}
type GetXRPTxResponse struct {
	Account         string      `json:"Account"`
	Amount          interface{} `json:"Amount"`
	Destination     string      `json:"Destination"`
	DestinationTag  int         `json:"DestinationTag"`
	TransactionType string      `json:"TransactionType"`
	Hash            string      `json:"hash"`
	InLedger        int         `json:"inLedger"`
	Flags           int         `json:"Flags"`
	Validated       bool        `json:"validated"`
}

func GetXRPTx(txHash string, latestAvailableLedger uint64, chainURL string) ([]byte, bool) {
	data := GetXRPTxRequestPayload{
		Method: "tx",
		Params: []GetXRPTxRequestParams{
			GetXRPTxRequestParams{
				Transaction: txHash,
				Binary:      false,
			},
		},
	}
	payloadBytes, err := json.Marshal(data)
	if err != nil {
		return []byte{}, true
	}
	body := bytes.NewReader(payloadBytes)
	req, err := http.NewRequest("POST", chainURL, body)
	if err != nil {
		return []byte{}, true
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return []byte{}, true
	}
	defer resp.Body.Close()
	if resp.StatusCode == 200 {
		respBody, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return []byte{}, true
		}
		var checkErrorResp map[string]CheckXRPErrorResponse
		err = json.Unmarshal(respBody, &checkErrorResp)
		if err != nil {
			return []byte{}, true
		}
		if checkErrorResp["result"].Error != "" {
			return []byte{}, true
		}
		var jsonResp map[string]GetXRPTxResponse
		err = json.Unmarshal(respBody, &jsonResp)
		if err != nil {
			return []byte{}, false
		}
		if jsonResp["result"].TransactionType == "Payment" {
			amountType := reflect.TypeOf(jsonResp["result"].Amount)
			if amountType.Name() == "string" && jsonResp["result"].Flags != 131072 && uint64(jsonResp["result"].InLedger) < latestAvailableLedger && jsonResp["result"].Validated == true {
				txIdHash := crypto.Keccak256([]byte(jsonResp["result"].Hash))
				ledgerHash := crypto.Keccak256(common.LeftPadBytes(common.FromHex(hexutil.EncodeUint64(uint64(jsonResp["result"].InLedger))), 32))
				sourceHash := crypto.Keccak256([]byte(jsonResp["result"].Account))
				destinationHash := crypto.Keccak256([]byte(jsonResp["result"].Destination))
				destinationTagHash := crypto.Keccak256(common.LeftPadBytes(common.FromHex(hexutil.EncodeUint64(uint64(jsonResp["result"].DestinationTag))), 32))
				amount, err := strconv.ParseUint(jsonResp["result"].Amount.(string), 10, 64)
				if err != nil {
					return []byte{}, false
				}
				amountHash := crypto.Keccak256(common.LeftPadBytes(common.FromHex(hexutil.EncodeUint64(uint64(amount))), 32))
				return crypto.Keccak256(txIdHash, ledgerHash, sourceHash, destinationHash, destinationTagHash, amountHash), false
			} else {
				return []byte{}, false
			}
		} else {
			return []byte{}, false
		}
	}
	return []byte{}, true
}

func ProvePaymentFinalityXRP(checkRet []byte, chainURL string) (bool, bool) {
	paymentHash, err := GetXRPTx(string(checkRet[160:]), binary.BigEndian.Uint64(checkRet[56:64]), chainURL)
	if !err {
		if len(paymentHash) > 0 && bytes.Equal(paymentHash, checkRet[64:96]) {
			return true, false
		}
		return false, false
	}
	return false, true
}

func ProveXRP(blockNumber *big.Int, functionSelector []byte, checkRet []byte, chainURL string) (bool, bool) {
	if bytes.Equal(functionSelector, GetProveClaimPeriodFinalitySelector(blockNumber)) {
		return ProveClaimPeriodFinalityXRP(checkRet, chainURL)
	} else if bytes.Equal(functionSelector, GetProvePaymentFinalitySelector(blockNumber)) {
		return ProvePaymentFinalityXRP(checkRet, chainURL)
	}
	return false, true
}

// =======================================================
// Common
// =======================================================

func PingChain(chainId uint32, chainURL string) bool {
	switch chainId {
	case 0:
		return PingXRP(chainURL)
	default:
		return false
	}
}

func ProveChain(blockNumber *big.Int, functionSelector []byte, checkRet []byte, chainId uint32, chainURL string) (bool, bool) {
	switch chainId {
	case 0:
		return ProveXRP(blockNumber, functionSelector, checkRet, chainURL)
	default:
		return false, true
	}
}

func AlertAdmin(alertURLs string, errorCode int) {
	for {
		for _, alertURL := range strings.Split(alertURLs, ",") {
			if alertURL != "" {
				switch errorCode {
				// General pattern:
				// 1) Send alert to the current alertURL
				// 2) If unsuccessful -> continue in for-loop to try another alertURL
				// 3) Else -> return
				case 0:
					// uint32(len(chainURLs)) <= chainId
					return
				case 1:
					// PingChain failed
					return
				case 2:
					// ProveChain failed
					return
				case 3:
					// All chainURLs failed
					return
				default:
					return
				}
			}
		}
		// If all alert APIs used were unsuccessful at reaching admin, wait and try again
		time.Sleep(10 * time.Second)
	}
}

func ReadChain(blockNumber *big.Int, functionSelector []byte, checkRet []byte, alertURLs string, chainURLs []string) bool {
	chainId := binary.BigEndian.Uint32(checkRet[28:32])
	if uint32(len(chainURLs)) <= chainId {
		// This is already checked at avalanchego/main/params.go on launch, but a fail-safe
		// is included here regardless for increased coverage
		for {
			AlertAdmin(alertURLs, 0)
			time.Sleep(10 * time.Second)
		}
	}
	for {
		for _, chainURL := range strings.Split(chainURLs[chainId], ",") {
			if chainURL != "" {
				pong := PingChain(chainId, chainURL)
				if !pong {
					AlertAdmin(alertURLs, 1)
					continue
				}
				verified, err := ProveChain(blockNumber, functionSelector, checkRet, chainId, chainURL)
				if err {
					AlertAdmin(alertURLs, 2)
					continue
				}
				return verified
			}
		}
		AlertAdmin(alertURLs, 3)
		time.Sleep(10 * time.Second)
	}
	return false
}

// Verify proof against underlying chain
func StateConnectorCall(blockNumber *big.Int, functionSelector []byte, checkRet []byte, stateConnectorConfig []string) bool {
	fileMutex.Lock()
	defer fileMutex.Unlock()
	var data StateHashes
	stateCacheFilePath := stateConnectorConfig[0]
	rawHash := sha256.Sum256([]byte(hex.EncodeToString(functionSelector) + hex.EncodeToString(checkRet)))
	hexHash := hex.EncodeToString(rawHash[:])
	_, err := os.Stat(stateCacheFilePath)
	if errors.Is(err, os.ErrNotExist) {
		_, err = os.Create(stateCacheFilePath)
		if err != nil {
			// Bypass caching mechanism
			return ReadChain(blockNumber, functionSelector, checkRet, stateConnectorConfig[1], stateConnectorConfig[2:])
		}
	} else if err != nil {
		// Bypass caching mechanism
		return ReadChain(blockNumber, functionSelector, checkRet, stateConnectorConfig[1], stateConnectorConfig[2:])
	} else {
		file, err := ioutil.ReadFile(stateCacheFilePath)
		if err != nil {
			// Bypass caching mechanism
			return ReadChain(blockNumber, functionSelector, checkRet, stateConnectorConfig[1], stateConnectorConfig[2:])
		}
		data = StateHashes{}
		err = json.Unmarshal(file, &data)
		if err != nil {
			// Bypass caching mechanism
			return ReadChain(blockNumber, functionSelector, checkRet, stateConnectorConfig[1], stateConnectorConfig[2:])
		}
	}
	if !contains(data.Hashes, hexHash) {
		if ReadChain(blockNumber, functionSelector, checkRet, stateConnectorConfig[1], stateConnectorConfig[2:]) {
			data.Hashes = append(data.Hashes, hexHash)
			jsonData, err := json.Marshal(data)
			if err == nil {
				ioutil.WriteFile(stateCacheFilePath, jsonData, 0644)
			}
			return true
		} else {
			return false
		}
	}
	// Cache contains this proof already
	return true
}
