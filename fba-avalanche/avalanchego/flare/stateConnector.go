package flare

import (
	"encoding/json"
	"encoding/hex"
	"crypto/sha256"
	"io/ioutil"
	"os"
	"os/exec"
	"sync"
	"net/http"
	"time"
)

var fileMutex sync.Mutex

type VerifiedStateConnectorHashes struct {
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

func CheckAlive(stateConnectorPort string, chainURLs []string) (bool) {
	go func(stateConnectorPort string, chainURLs []string) {
			startCommand := []string{"nohup", "node", "flare/verify.js", stateConnectorPort}
			startCommand = append(startCommand, chainURLs[:]...)
			startCommand = append(startCommand, "&>/dev/null")
			exec.Command(startCommand[0], startCommand[1:]...).Output()
		}(stateConnectorPort, chainURLs)
	time.Sleep(1*time.Second)
	resp, err := client.Get("http://localhost:"+stateConnectorPort)
	if (err != nil) {
		return CheckAlive(stateConnectorPort, chainURLs)
	} else {
		if resp.StatusCode == http.StatusOK {
			return true
		} else {
			return CheckAlive(stateConnectorPort, chainURLs)
		}
	}
}

// Verify claim period 
func VerifyClaimPeriod(stateConnectorConfig []string, cacheRet []byte) (bool) {
	fileMutex.Lock()
	defer fileMutex.Unlock()
	var data VerifiedStateConnectorHashes
	stateConnectorPort := stateConnectorConfig[0]
	stateConnectorCacheFilePath := "flare/verifiedHashes"+stateConnectorPort+".json"
	rawHash := sha256.Sum256(cacheRet)
	hexHash := hex.EncodeToString(rawHash[:])
	_, err := os.Stat(stateConnectorCacheFilePath)
    if os.IsNotExist(err) {
        _, err := os.Create(stateConnectorCacheFilePath)
        if err != nil {
        	time.Sleep(1*time.Second)
        	return VerifyClaimPeriod(stateConnectorConfig, cacheRet)
        }
    } else {
    	file, _ := ioutil.ReadFile(stateConnectorCacheFilePath)
		data = VerifiedStateConnectorHashes{}
		json.Unmarshal(file, &data)
    }
    if (contains(data.Hashes, hexHash) == false) {
    	if (CheckAlive(stateConnectorPort, stateConnectorConfig[1:])) {
    		resp, err := client.Get("http://localhost:"+stateConnectorPort+"/?verify="+hex.EncodeToString(cacheRet[:]))
    		if (err != nil) {
    			return VerifyClaimPeriod(stateConnectorConfig, cacheRet)
    		} else {
    			if resp.StatusCode == http.StatusOK {
			    	data.Hashes = append(data.Hashes, hexHash)
					jsonData, _ := json.Marshal(data)
					ioutil.WriteFile(stateConnectorCacheFilePath, jsonData, 0644)
					return true
				} else {
					return false
				}
    		}
    	}
    }
    return true
}