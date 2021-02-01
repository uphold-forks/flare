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

func GetRegisterClaimPeriodSelector(blockNumber *big.Int) ([]byte) {
    switch {
        default:
            return []byte{0x54,0x65,0xdf,0xc4}
    }
}

func GetProvePaymentFinalitySelector(blockNumber *big.Int) ([]byte) {
    switch {
        default:
            return []byte{0xf6,0xf5,0x6a,0xf7}
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
type GetXRPBlockLedgerResponsePayload struct {
    Accepted      			bool 		`json:"accepted"`
    AccountHash   			string 		`json:"account_hash"`
    CloseFlags     			int 		`json:"close_flags"`
    CloseTime       		int 		`json:"close_time"`
    CloseTimeHuman  		string 		`json:"close_time_human"`
    CloseTimeResolution 	int 		`json:"close_time_resolution"`
    Closed 					bool 		`json:"closed"`
    Hash 				 	string 		`json:"hash"`
    LedgerHash 				string 		`json:"ledger_hash"`
    LedgerIndex 			string 		`json:"ledger_index"`
    ParentCloseTime 		int 		`json:"parent_close_time"`
    ParentHash 		 		string 		`json:"parent_hash"`
    seqNum 			 		string 		`json:"seqNum"`
    TotalCoins 				string 		`json:"totalCoins"`
    Total_Coins 			string 		`json:"total_coins"`
    TransactionHash 		string 		`json:"transaction_hash"`
    Transactions 			[]string 	`json:"transactions"`
}
type GetXRPBlockLedgerResponse struct {
    Ledger      			GetXRPBlockLedgerResponsePayload 	`json:"ledger"`
    LedgerHash   			string 								`json:"ledger_hash"`
    LedgerIndex     		int 								`json:"ledger_index"`
    Status        			string 								`json:"status"`
    Validated   			bool 								`json:"validated"`
}

func GetXRPBlock(ledger uint64, chainURL string) ([]string, bool) {
	data := GetXRPBlockRequestPayload{
		Method: "ledger",
		Params: []GetXRPBlockRequestParams{
			GetXRPBlockRequestParams{
				LedgerIndex: ledger,
				Full: false,
				Accounts: false,
				Transactions: true,
				Expand: false,
				OwnerFunds: false,
			},
		},
	}
	payloadBytes, err := json.Marshal(data)
	if err != nil {
		return []string{}, true
	}
	body := bytes.NewReader(payloadBytes)
	req, err := http.NewRequest("POST", chainURL, body)
	if err != nil {
		return []string{}, true
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return []string{}, true
	}
	defer resp.Body.Close()
	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return []string{}, true
	}
	var jsonResp map[string]GetXRPBlockLedgerResponse
	err = json.Unmarshal(respBody, &jsonResp)
	if err != nil {
		return []string{}, true
	}
	return jsonResp["result"].Ledger.Transactions, false
}

func ProveRegisterClaimPeriodXRP(checkRet []byte, chainURL string) (bool, bool) {
	minLedger := binary.BigEndian.Uint64(checkRet[56:64])
	claimPeriodLength := binary.BigEndian.Uint16(checkRet[94:96])
	var i uint16
	for i = 0; i < claimPeriodLength; i++ {
		_, err := GetXRPBlock(minLedger+uint64(i), chainURL)
		if err {
			return false, true
		}
	}
	return true, false
}

func ProvePaymentFinalityXRP(checkRet []byte, chainURL string) (bool, bool) {
	return true, false
}

func ProveXRP(blockNumber *big.Int, functionSelector []byte, checkRet []byte, chainURL string) (bool, bool) {
	if (bytes.Compare(functionSelector, GetRegisterClaimPeriodSelector(blockNumber)) == 0) {
		return ProveRegisterClaimPeriodXRP(checkRet, chainURL)
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
			data.Hashes = append(data.Hashes, hex.EncodeToString(checkRet))
			jsonData, _ := json.Marshal(data)
			ioutil.WriteFile(stateCacheFilePath, jsonData, 0644)
			return true
    	} else {
    		return false
    	}
    }
    return true
}