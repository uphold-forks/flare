package flare

import (
	"time"
	"encoding/json"
	"encoding/hex"
	"crypto/sha256"
	"io/ioutil"
	"os"
	"sync"
)

var fileMutex sync.Mutex

type ClaimPeriod struct {
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

// Verify claim period 
func VerifyClaimPeriod(stData []byte, nodeUrl []string) (bool) {
	fileMutex.Lock()
	defer fileMutex.Unlock()
	var data ClaimPeriod
	rawHash := sha256.Sum256(stData)
	hexHash := hex.EncodeToString(rawHash[:])
	_, err := os.Stat(StateConnectorCacheFilename)
    if os.IsNotExist(err) {
        _, err := os.Create(StateConnectorCacheFilename)
        if err != nil {
        }
    } else {
    	file, _ := ioutil.ReadFile(StateConnectorCacheFilename)
		data = ClaimPeriod{}
		json.Unmarshal(file, &data)
    }

    if (contains(data.Hashes, hexHash) == false) {
    	data.Hashes = append(data.Hashes, hexHash)
		jsonData, _ := json.Marshal(data)
		ioutil.WriteFile(StateConnectorCacheFilename, jsonData, 0644)
		// Temporary delay for testing cache efficacy
		time.Sleep(30*time.Second)
    }
    return true;
}