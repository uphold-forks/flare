package core

import (
	"sync"
	"math/big"
	"encoding/json"
	"encoding/hex"
	"encoding/binary"
	"crypto/sha256"
	"io/ioutil"
	"os"
	"time"
	"net/http"
	"bytes"
	"reflect"
	"strconv"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
)

var fileMutex sync.Mutex

// Fixed gas used for custom block.coinbase operations
func GetDataFee(blockNumber *big.Int) (uint64) {
    switch {
        default:
            return 10000000
    }
}

func GetGovernanceContractAddr(blockNumber *big.Int) (string) {
    switch {
        default:
            return "0x1000000000000000000000000000000000000000"
    }
}

func GetStateConnectorContractAddr(blockNumber *big.Int) (string) {
    switch {
        default:
            return "0x1000000000000000000000000000000000000001"
    }
}

func GetSystemTriggerContractAddr(blockNumber *big.Int) (string) {
    switch {
        default:
            return "0x1000000000000000000000000000000000000002"
    }
}

func GetProveClaimPeriodFinalitySelector(blockNumber *big.Int) ([]byte) {
    switch {
        default:
            return []byte{0xa5,0x7d,0x0e,0x25}
    }
}

func GetProvePaymentFinalitySelector(blockNumber *big.Int) ([]byte) {
    switch {
        default:
            return []byte{0x13,0xbb,0x43,0x1c}
    }
}

func GetSystemTriggerSelector(blockNumber *big.Int) ([]byte) {
    switch {
        default:
            return []byte{0x7f,0xec,0x8d,0x38}
    }
}

var (
	tr = &http.Transport{
		MaxIdleConns:       10,
		IdleConnTimeout:    60 * time.Second,
		DisableCompression: true,
	}
	client = &http.Client{Transport: tr}
)

type StateHashes struct {
	Hashes	[]string 	`json:"hashes"`
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
	Method string   		`json:"method"`
	Params []PingXRPParams 	`json:"params"`
}
type GetXRPBlockRequestParams struct {
	LedgerIndex  			uint64 		`json:"ledger_index"`
	Full         			bool   		`json:"full"`
	Accounts     			bool   		`json:"accounts"`
	Transactions 			bool   		`json:"transactions"`
	Expand       			bool   		`json:"expand"`
	OwnerFunds   			bool   		`json:"owner_funds"`
}
type GetXRPBlockRequestPayload struct {
	Method 					string   					`json:"method"`
	Params 					[]GetXRPBlockRequestParams 	`json:"params"`
}
type CheckXRPErrorResponse struct {
	Error   				string 		`json:"error"`
}
type GetXRPBlockResponse struct {
    LedgerHash   			string 		`json:"ledger_hash"`
    LedgerIndex     		int 		`json:"ledger_index"`
    Validated   			bool 		`json:"validated"`
}

func PingXRP(chainURL string) (bool) {
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
	if (resp.StatusCode == 200) {
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
				LedgerIndex: ledger,
				Full: false,
				Accounts: false,
				Transactions: false,
				Expand: false,
				OwnerFunds: false,
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
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", true
	}
	defer resp.Body.Close()
	if (resp.StatusCode == 200) {
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
	if ledgerHashString != "" && bytes.Compare(crypto.Keccak256([]byte(ledgerHashString)), checkRet[96:128]) == 0 {
		return true, false
	}
	return false, false
}

type GetXRPTxRequestParams struct {
	Transaction  			string 		`json:"transaction"`
	Binary         			bool   		`json:"binary"`
}
type GetXRPTxRequestPayload struct {
	Method 					string   					`json:"method"`
	Params 					[]GetXRPTxRequestParams 	`json:"params"`
}
type GetXRPTxResponse struct {
	Account      			string 		`json:"Account"`
    Amount		   			interface{} `json:"Amount"`
    Destination     		string 		`json:"Destination"`
    DestinationTag     		int 		`json:"DestinationTag"`
    TransactionType       	string 		`json:"TransactionType"`
    Hash 			  		string 		`json:"hash"`
    InLedger 	 			int 		`json:"inLedger"`
    Flags 					int 		`json:"Flags"`
    Validated   			bool 		`json:"validated"`
}

func GetXRPTx(txHash string, latestAvailableLedger uint64, chainURL string) ([]byte, bool) {
	data := GetXRPTxRequestPayload{
		Method: "tx",
		Params: []GetXRPTxRequestParams{
			GetXRPTxRequestParams{
				Transaction: txHash,
				Binary: false,
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
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return []byte{}, true
	}
	defer resp.Body.Close()
	if (resp.StatusCode == 200) {
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
		if (jsonResp["result"].TransactionType == "Payment") {
			amountType := reflect.TypeOf(jsonResp["result"].Amount)
			if (amountType.Name() == "string" && jsonResp["result"].Flags != 131072 && uint64(jsonResp["result"].InLedger) < latestAvailableLedger && jsonResp["result"].Validated == true) {
				txIdHash := crypto.Keccak256([]byte(jsonResp["result"].Hash))
				ledgerHash := crypto.Keccak256(common.LeftPadBytes(common.FromHex(hexutil.EncodeUint64(uint64(jsonResp["result"].InLedger))), 32))
				sourceHash := crypto.Keccak256([]byte(jsonResp["result"].Account))
				destinationHash := crypto.Keccak256([]byte(jsonResp["result"].Destination))
				destinationTagHash := crypto.Keccak256(common.LeftPadBytes(common.FromHex(hexutil.EncodeUint64(uint64(jsonResp["result"].DestinationTag))), 32))
				amount, err := strconv.Atoi(jsonResp["result"].Amount.(string))
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
		if len(paymentHash) > 0 && bytes.Compare(paymentHash, checkRet[64:96]) == 0 {
			return true, false
		}
		return false, false
	}
	return false, true
}

func ProveXRP(blockNumber *big.Int, functionSelector []byte, checkRet []byte, chainURL string) (bool, bool) {
	if (bytes.Compare(functionSelector, GetProveClaimPeriodFinalitySelector(blockNumber)) == 0) {
		return ProveClaimPeriodFinalityXRP(checkRet, chainURL)
	} else if (bytes.Compare(functionSelector, GetProvePaymentFinalitySelector(blockNumber)) == 0) {
		return ProvePaymentFinalityXRP(checkRet, chainURL)
	}
	return false, true
}

// =======================================================
// Common
// =======================================================

func PingChain(chainId uint32, chainURL string) (bool) {
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

func ReadChain(blockNumber *big.Int, functionSelector []byte, checkRet []byte, chainURLs []string) (bool) {
    ok := false
    pong := false
    chainId := binary.BigEndian.Uint32(checkRet[28:32])
    if uint32(len(chainURLs)) > chainId {
    	ok = true
    }
	for !pong {
		if ok {
			pong = PingChain(chainId, chainURLs[chainId])
		}
		if !pong {
			// Notify this validator's admin here
			time.Sleep(time.Second)
		}
	}
	verified, error := ProveChain(blockNumber, functionSelector, checkRet, chainId, chainURLs[chainId])
	if error {
		// Notify this validator's admin here
		time.Sleep(time.Second)
		return ReadChain(blockNumber, functionSelector, checkRet, chainURLs)
	}
	return verified
}

// Verify proof against underlying chain
func StateConnectorCall(blockNumber *big.Int, functionSelector []byte, checkRet []byte, stateConnectorConfig []string) (bool) {
	fileMutex.Lock()
	defer fileMutex.Unlock()
	var data StateHashes
	stateCacheFilePath := stateConnectorConfig[0]
	rawHash := sha256.Sum256([]byte(hex.EncodeToString(functionSelector)+hex.EncodeToString(checkRet)))
	hexHash := hex.EncodeToString(rawHash[:])
	_, err := os.Stat(stateCacheFilePath)
    if os.IsNotExist(err) {
        os.Create(stateCacheFilePath)
    } else {
    	file, _ := ioutil.ReadFile(stateCacheFilePath)
		data = StateHashes{}
		json.Unmarshal(file, &data)
    }
    if !contains(data.Hashes, hexHash) {
    	if ReadChain(blockNumber, functionSelector, checkRet, stateConnectorConfig[1:]) {
    		data.Hashes = append(data.Hashes, hexHash)
			jsonData, _ := json.Marshal(data)
			ioutil.WriteFile(stateCacheFilePath, jsonData, 0644)
			return true
    	} else {
    		return false
    	}
    }
    return true
}