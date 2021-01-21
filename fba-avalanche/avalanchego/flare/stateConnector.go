package flare

import (
	"encoding/json"
	"encoding/hex"
	"crypto/sha256"
	"io/ioutil"
	"os"
	"os/exec"
	"time"
	"sync"
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
	go func(stateConnectorPort string) {client.Get("http://localhost:"+stateConnectorPort+"/?stop")}(stateConnectorPort)
	time.Sleep(1*time.Second)
	go func(stateConnectorPort string, chainURLs []string) {
		startCommand := []string{"nohup", "node", "flare/verify.js", stateConnectorPort}
		startCommand = append(startCommand, chainURLs[:]...)
		startCommand = append(startCommand, "&>/dev/null")
		exec.Command(startCommand[0], startCommand[1:]...).Output()
	}(stateConnectorPort, chainURLs)
	alive := false
	time.Sleep(1*time.Second)
	for (alive == false) {
		resp, err := client.Get("http://localhost:"+stateConnectorPort)
		if (err != nil) {
			time.Sleep(1*time.Second)
		} else if (resp.StatusCode != 204) {
			time.Sleep(1*time.Second)
		} else {
			alive = true
		}
	}
	return true
}

func ReadChain(cacheRet string, stateConnectorPort string, chainURLs []string) (bool) {
	if (CheckAlive(stateConnectorPort, chainURLs)) {
		resp, err := client.Get("http://localhost:"+stateConnectorPort+"/?verify="+cacheRet)
		if (err != nil) {
			time.Sleep(1*time.Second)
			return ReadChain(cacheRet, stateConnectorPort, chainURLs)
		} else {
			if resp.StatusCode == 200 {
				go func(stateConnectorPort string) {client.Get("http://localhost:"+stateConnectorPort+"/?stop")}(stateConnectorPort)
				return true
			} else if resp.StatusCode == 404 {
				go func(stateConnectorPort string) {client.Get("http://localhost:"+stateConnectorPort+"/?stop")}(stateConnectorPort)
				return false
			} else {
				time.Sleep(1*time.Second)
				return ReadChain(cacheRet, stateConnectorPort, chainURLs)
			}
		}
	} else {
		time.Sleep(1*time.Second)
		return ReadChain(cacheRet, stateConnectorPort, chainURLs)
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
        os.Create(stateConnectorCacheFilePath)
    } else {
    	file, _ := ioutil.ReadFile(stateConnectorCacheFilePath)
		data = VerifiedStateConnectorHashes{}
		json.Unmarshal(file, &data)
    }
    if (contains(data.Hashes, hexHash) == false) {
    	if (ReadChain(hex.EncodeToString(cacheRet[:]), stateConnectorPort, stateConnectorConfig[1:]) == true) {
    		data.Hashes = append(data.Hashes, hexHash)
			jsonData, _ := json.Marshal(data)
			ioutil.WriteFile(stateConnectorCacheFilePath, jsonData, 0644)
			return true
    	} else {
    		return false
    	}
    }
    return true
}