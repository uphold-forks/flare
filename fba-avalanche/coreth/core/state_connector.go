package core

import (
	"sync"
	"math/big"
	"encoding/json"
	"encoding/hex"
	"crypto/sha256"
	"io/ioutil"
	"os"
	"time"
	"net/http"
	"strconv"
	"bytes"
)

var fileMutex sync.Mutex

// Fixed gas used for custom block.coinbase operations
func GetDataFee(BlockNumber *big.Int) (uint64) {
    switch {
        default:
            return 10000000
    }
}

func GetGovernanceContractAddr(BlockNumber *big.Int) (string) {
    switch {
        default:
            return "0x1000000000000000000000000000000000000000"
    }
}

func GetStateConnectorContractAddr(BlockNumber *big.Int) (string) {
    switch {
        default:
            return "0x1000000000000000000000000000000000000001"
    }
}

func GetRegisterClaimPeriodSelector(BlockNumber *big.Int) ([]byte) {
    switch {
        default:
            return []byte{0x54,0x65,0xdf,0xc4}
    }
}

func GetProvePaymentFinalitySelector(BlockNumber *big.Int) ([]byte) {
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

func PingChain(chainURL string) (bool) {
	
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
	if (resp.StatusCode == 200) {
		return true
	} else {
		return false
	}
}

// func GetXRPBlock(index int) (bool) {
// 	type Payload struct {
// 		Method string   `json:"method"`
// 		Params []Params `json:"params"`
// 	}
// 	type Params struct {
// 		LedgerIndex  string `json:"ledger_index"`
// 		Full         bool   `json:"full"`
// 		Accounts     bool   `json:"accounts"`
// 		Transactions bool   `json:"transactions"`
// 		Expand       bool   `json:"expand"`
// 		OwnerFunds   bool   `json:"owner_funds"`
// 	}
// 	data := Payload{
// 	// fill struct
// 	}
// 	payloadBytes, err := json.Marshal(data)
// 	if err != nil {
// 		// handle err
// 	}
// 	body := bytes.NewReader(payloadBytes)

// 	req, err := http.NewRequest("POST", "https://s1.ripple.com:51234/", body)
// 	if err != nil {
// 		// handle err
// 	}
// 	req.Header.Set("Content-Type", "application/json")

// 	resp, err := http.DefaultClient.Do(req)
// 	if err != nil {
// 		// handle err
// 	}
// 	defer resp.Body.Close()
// }

func ReadChain(cacheRet string, chainURLs []string) (bool) {
	pong := false
	for pong == false {
		pong = PingChain(chainURLs[0])
		if (pong == false) {
			// Notify this validator's admin here
			time.Sleep(1*time.Second)
		}
	}
	return true
}

// Verify proof against underlying chain
func StateConnectorCall(stateConnectorConfig []string, checkRet []byte, functionSelector []byte) (bool) {
	fileMutex.Lock()
	defer fileMutex.Unlock()
	var data StateHashes
	stateCacheFilePath := "db/stateHashes"+strconv.Itoa(os.Getpid())+".json"
	rawHash := sha256.Sum256(checkRet)
	hexHash := hex.EncodeToString(rawHash[:])
	_, err := os.Stat(stateCacheFilePath)
    if os.IsNotExist(err) {
        os.Create(stateCacheFilePath)
    } else {
    	file, _ := ioutil.ReadFile(stateCacheFilePath)
		data = StateHashes{}
		json.Unmarshal(file, &data)
    }
    if (contains(data.Hashes, hexHash) == false) {
    	if (ReadChain(hex.EncodeToString(checkRet[:]), stateConnectorConfig[:]) == true) {
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