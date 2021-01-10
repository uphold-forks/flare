package flare

import (
	"encoding/json"
	"encoding/hex"
	"crypto/sha256"
	"io/ioutil"
	"os"
	"os/exec"
	"sync"
	"strings"
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

// Verify claim period 
func VerifyClaimPeriod(stData []byte, nodeUrl []string) (bool) {
	fileMutex.Lock()
	defer fileMutex.Unlock()
	var data VerifiedStateConnectorHashes
	rawHash := sha256.Sum256(stData)
	hexHash := hex.EncodeToString(rawHash[:])
	_, err := os.Stat(StateConnectorCacheFilename)
    if os.IsNotExist(err) {
        _, err := os.Create(StateConnectorCacheFilename)
        if err != nil {
        }
    } else {
    	file, _ := ioutil.ReadFile(StateConnectorCacheFilename)
		data = VerifiedStateConnectorHashes{}
		json.Unmarshal(file, &data)
    }

    if (contains(data.Hashes, hexHash) == false) {
    	// Independent verification calling StateConnector
		parts := strings.Fields(VerificationCommand+hex.EncodeToString(stData))        
		byteResponse, _ := exec.Command(parts[0], parts[1:]...).Output()
		// if err != nil {
		//     panic(err)
		// }
		stringReponse := string(byteResponse)

    	// If it's valid, cache stData
    	// data.Hashes = append(data.Hashes, hexHash)
    	data.Hashes = append(data.Hashes, hexHash)
    	data.Hashes = append(data.Hashes, stringReponse)
		jsonData, _ := json.Marshal(data)
		ioutil.WriteFile(StateConnectorCacheFilename, jsonData, 0644)
    }
    return true;
}