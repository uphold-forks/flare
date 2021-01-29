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

func PingXRP(chainURL string) (bool) {
	type Params struct {
	}
	type Payload struct {
		Method string   `json:"method"`
		Params []Params `json:"params"`
	}
	data := Payload{
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

func ProveRegisterClaimPeriodXRP(checkRet []byte, chainURL string) (bool, bool) {
	type Params struct {
		LedgerIndex  string `json:"ledger_index"`
		Full         bool   `json:"full"`
		Accounts     bool   `json:"accounts"`
		Transactions bool   `json:"transactions"`
		Expand       bool   `json:"expand"`
		OwnerFunds   bool   `json:"owner_funds"`
	}
	type Payload struct {
		Method string   `json:"method"`
		Params []Params `json:"params"`
	}
	data := Payload{
		Method: "ledger",
		Params: []Params{
			Params{
				LedgerIndex: "61050250",
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
		return false, true
	}
	body := bytes.NewReader(payloadBytes)
	req, err := http.NewRequest("POST", chainURL, body)
	if err != nil {
		return false, true
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, true
	}
	defer resp.Body.Close()
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
    chainId := binary.BigEndian.Uint32(checkRet[0:4])
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