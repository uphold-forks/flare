package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io/ioutil"
	"math/big"
	"os"
	"path/filepath"
	"time"

	"github.com/ava-labs/avalanchego/ids"
	"github.com/ava-labs/avalanchego/utils/hashing"
)

// GenerateStakingKeyCert generates a self-signed TLS key/cert pair to use in staking
// The key and files will be placed at [keyPath] and [certPath], respectively
// If there is already a file at [keyPath], returns nil
func GenerateStakingKeyCert(path string) error {
	keyPath := path + "/node.key"
	certPath := path + "/node.crt"
	err := os.MkdirAll(path, 0700)
	if err != nil {
		return fmt.Errorf("couldn't create path: %w", err)
	}

	// Create key to sign cert with
	key, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		return fmt.Errorf("couldn't generate rsa key: %w", err)
	}

	// Create self-signed staking cert
	certTemplate := &x509.Certificate{
		SerialNumber:          big.NewInt(0),
		NotBefore:             time.Date(2000, time.January, 0, 0, 0, 0, 0, time.UTC),
		NotAfter:              time.Now().AddDate(100, 0, 0),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature | x509.KeyUsageDataEncipherment,
		BasicConstraintsValid: true,
	}
	certBytes, err := x509.CreateCertificate(rand.Reader, certTemplate, certTemplate, &key.PublicKey, key)
	if err != nil {
		return fmt.Errorf("couldn't create certificate: %w", err)
	}

	// Ensure directory where key/cert will live exist
	if err := os.MkdirAll(filepath.Dir(certPath), 0700); err != nil {
		return fmt.Errorf("couldn't create path for cert: %w", err)
	} else if err := os.MkdirAll(filepath.Dir(keyPath), 0700); err != nil {
		return fmt.Errorf("couldn't create path for key: %w", err)
	}

	// Write cert to disk
	certFile, err := os.Create(certPath)
	if err != nil {
		return fmt.Errorf("couldn't create cert file: %w", err)
	}
	if err := pem.Encode(certFile, &pem.Block{Type: "CERTIFICATE", Bytes: certBytes}); err != nil {
		return fmt.Errorf("couldn't write cert file: %w", err)
	}
	if err := certFile.Close(); err != nil {
		return fmt.Errorf("couldn't close cert file: %w", err)
	}
	if err := os.Chmod(certPath, 0400); err != nil { // Make cert read-only
		return fmt.Errorf("couldn't change permissions on cert: %w", err)
	}

	// Write key to disk
	keyOut, err := os.Create(keyPath)
	if err != nil {
		return fmt.Errorf("couldn't create key file: %w", err)
	}
	privBytes, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return fmt.Errorf("couldn't marshal private key: %w", err)
	}
	if err := pem.Encode(keyOut, &pem.Block{Type: "PRIVATE KEY", Bytes: privBytes}); err != nil {
		return fmt.Errorf("couldn't write private key: %w", err)
	}
	if err := keyOut.Close(); err != nil {
		return fmt.Errorf("couldn't close key file: %w", err)
	}
	if err := os.Chmod(keyPath, 0400); err != nil { // Make key read-only
		return fmt.Errorf("couldn't change permissions on key")
	}

	stakeCert, err := ioutil.ReadFile(certPath)
	if err != nil {
		return fmt.Errorf("problem reading staking certificate: %w", err)
	}

	block, _ := pem.Decode(stakeCert)
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return fmt.Errorf("problem parsing staking certificate: %w", err)
	}
	nodeID, err := ids.ToShortID(hashing.PubkeyBytesToAddress(cert.Raw))
	if err != nil {
		return fmt.Errorf("problem deriving nodeID from certificate: %w", err)
	}
	prefixedNodeID := nodeID.PrefixedString("NodeID-")
	prefixedNodeIDBytes := []byte(prefixedNodeID)
	err = ioutil.WriteFile(path+"/node.txt", prefixedNodeIDBytes, 0400)
	if err != nil {
		return fmt.Errorf("problem writing nodeID to file: %w", err)
	}
	fmt.Printf("%s\n", prefixedNodeID)

	return nil
}

func main() {
	wdPath, err := os.Getwd()
	if err != nil {
		fmt.Errorf("couldn't get working directory: %w", err)
		return
	}
	keyPath := wdPath + "/keys"
	err = os.RemoveAll(keyPath)
	if err != nil {
		fmt.Errorf("couldn't delete keys folder: %w", err)
		return
	}
	GenerateStakingKeyCert(keyPath + "/node00")
	GenerateStakingKeyCert(keyPath + "/node01")
	GenerateStakingKeyCert(keyPath + "/node02")
	GenerateStakingKeyCert(keyPath + "/node03")
}
