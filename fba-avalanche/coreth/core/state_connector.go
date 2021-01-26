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
            return []byte{0x76,0x0f,0x6a,0x5a}
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

type Payload struct {
	Method string   `json:"method"`
	Params []Params `json:"params"`
}

type Params struct {
}

func PingChain(chainURL string) (bool) {
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

func ReadChain(cacheRet string, chainURLs []string) (bool) {
	pong := false
	for pong == false {
		pong = PingChain(chainURLs[0])
		if (pong == false) {
			time.Sleep(1*time.Second)
		}
	}
	return true
}

// Verify claim period 
func VerifyClaimPeriod(stateConnectorConfig []string, cacheRet []byte) (bool) {
	fileMutex.Lock()
	defer fileMutex.Unlock()
	var data StateHashes
	stateCacheFilePath := "db/stateHashes"+strconv.Itoa(os.Getpid())+".json"
	rawHash := sha256.Sum256(cacheRet)
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
    	if (ReadChain(hex.EncodeToString(cacheRet[:]), stateConnectorConfig[:]) == true) {
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