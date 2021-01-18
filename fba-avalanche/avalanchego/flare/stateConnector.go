package flare

import (
	"encoding/json"
	"encoding/hex"
	"crypto/sha256"
	"io/ioutil"
	"os"
	"sync"
	// "net/http"
	// "time"
	// "strings"
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

// func checkAlive(stateConnectorPort string) (bool) {
// 	resp, err := client.Get("http://localhost"+stateConnectorPort)
// 	defer resp.Body.Close()
// 	startRequired := false
// 	if err != nil {
// 		startRequired = true
// 	} else if resp.StatusCode != http.StatusOK {
// 		startRequired = true
// 	} 
// 	if startRequired {
// 		// Report to monitoring system here
// 		startCommand := "nohup node stateConnector " + stateConnectorPort + " &>/dev/null"
// 		parts := strings.Fields(startCommand)
// 		exec.Command(parts[0], parts[1:]...).Output()
// 		time.Sleep(5*time.Second)
// 		return checkAlive(stateConnectorPort)
// 	} else {
// 		return true
// 	}
// }

// Verify claim period 
func VerifyClaimPeriod(stateConnectorConfig []string, cacheRet []byte) (bool) {
	fileMutex.Lock()
	defer fileMutex.Unlock()
	var data VerifiedStateConnectorHashes
	stateConnectorCacheFilePath := "flare/verifiedHashes"+stateConnectorConfig[0]+".json"
	rawHash := sha256.Sum256(cacheRet)
	hexHash := hex.EncodeToString(rawHash[:])
	_, err := os.Stat(stateConnectorCacheFilePath)
    if os.IsNotExist(err) {
        _, err := os.Create(stateConnectorCacheFilePath)
        if err != nil {
        }
    } else {
    	file, _ := ioutil.ReadFile(stateConnectorCacheFilePath)
		data = VerifiedStateConnectorHashes{}
		json.Unmarshal(file, &data)
    }

    if (contains(data.Hashes, hexHash) == false) {
    	// Check if state-connector is alive; if not, start it
  //   	checkAlive(stateConnectorPort)
		// resp, err := client.Get("http://localhost"+stateConnectorPort+"?verify="+hex.EncodeToString(cacheRet[:]))
  //   	defer resp.Body.Close()
		// if err != nil {
		// 	data.Hashes = append(data.Hashes, err.Error())
		// }
		// if resp.StatusCode == http.StatusOK {
		//     bodyBytes, err := ioutil.ReadAll(resp.Body)
		//     if err != nil {
		//         data.Hashes = append(data.Hashes, err.Error())
		//     }
		//     bodyString := string(bodyBytes)
		//     data.Hashes = append(data.Hashes, bodyString)
		// }
    	// If valid, store hash
    	data.Hashes = append(data.Hashes, hexHash)
    	data.Hashes = append(data.Hashes, hex.EncodeToString(cacheRet[:]))
    	// data.Hashes = append(data.Hashes, stateConnectorConfig[1])
    	// data.Hashes = append(data.Hashes, stateConnectorConfig[2])
    	// data.Hashes = append(data.Hashes, stateConnectorConfig[3])
		jsonData, _ := json.Marshal(data)
		ioutil.WriteFile(stateConnectorCacheFilePath, jsonData, 0644)
    }
    return true;
}