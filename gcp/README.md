# Simple GCP Deployment

This guide is to create and peer 5 nodes in GCP. 

## GCP Dependencies
- 5 x Google Cloud Platform e2-medium servers with 20gb storage
- OS: Ubuntu >= 18.04
- Flare node software: Go version >= 1.14.X and set up $GOPATH.
- State-connector software: NodeJS version >= v10 LTS.
- NodeJS dependency management: Yarn version >= v1.13.0.

### GCP Dependency Installation
Create a firewall rule called `flare-standard` in your project in your chosen VPC, this will allow external RPC and Peering, using the following config:
- IP ranges: 0.0.0.0/0
- Protocols and ports: tcp:9650, tcp:9651, tcp:9652, tcp:9653, tcp:9654, tcp:9655, tcp:9656, tcp:9657, tcp:9658, tcp:9659

Create 5 servers in your chosen VPC, in your chosen subnet and location. Assign the `flare-standard`, `default-allow-icmp`, `default-allow-internal`, and `default-allow-ssh` firewall rules to each node. A quick way to create all five servers is, after you have created the first one, you can click on the server and click create similar. Each node needs to be in the same region, but can be in different zones.
Name each one:
- node00
- node01
- node02
- node03
- node04


  Set up git access to GitLab and then:
```bash
mkdir ~/flare
git clone https://gitlab.com/flarenetwork/flare ~/flare
```
  
_Alternatively through the GCP SSH window you could upload a zip of the repo._  

Then run the following install and update commands on each node:
```bash
# Install dependencies
cd ~/flare
bash gcp/install_deps.sh
source ~/.profile
```

## GCP Network Deployment
### Make sure to run all of these commands within 5 seconds of each other, it is best to line all of the commands up in multiple ssh terminals and run them one after the other in quick succession. Testnet addresses can be generated here: https://xrpl.org/xrp-testnet-faucet.html. This may take a few mins to finish.   
  
Node 00
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node00" "<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657,<insert-node04-internal-ip-address>:9659" "<insert-node00-internal-ip-address>:9650,<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656,<insert-node04-internal-ip-address>:9658"

# Check it's running
ps aux | grep avalanchego
```

Node 01
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node01" "<insert-node00-internal-ip-address>:9651,<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657" "<insert-node00-internal-ip-address>:9650,<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656,<insert-node04-internal-ip-address>:9658"

# Check it's running
ps aux | grep avalanchego
```

Node 02
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node02" "<insert-node00-internal-ip-address>:9651,<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657" "<insert-node00-internal-ip-address>:9650,<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656,<insert-node04-internal-ip-address>:9658"

# Check it's running
ps aux | grep avalanchego
```

Node 03
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node03" "<insert-node00-internal-ip-address>:9651,<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657" "<insert-node00-internal-ip-address>:9650,<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656,<insert-node04-internal-ip-address>:9658"

# Check it's running
ps aux | grep avalanchego
```

Node 04
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node04" "<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657,<insert-node04-internal-ip-address>:9659" "<insert-node00-internal-ip-address>:9650,<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656,<insert-node04-internal-ip-address>:9658"

# Check it's running
ps aux | grep avalanchego
```

## GCP State-Connector System Deployment
### Wait until the network scripts have finished running to run the following bridge scripts
Node 00
```bash
./bridge.sh 0
```

Node 01
```bash
./bridge.sh 1
```

Node 02
```bash
./bridge.sh 2
```

Node 03
```bash
./bridge.sh 3
```

Node 04
```bash
./bridge.sh 4
```

### node00's State

```bash
curl -sX POST --data '{
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": [
        "0x0000000000000000000000000000000000000002",
        "latest"
    ],
    "id": 1
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/bc/C/rpc | jq '.result'
```

### node04's State

```bash
curl -sX POST --data '{
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": [
        "0x0000000000000000000000000000000000000002",
        "latest"
    ],
    "id": 1
}' -H 'content-type:application/json;' 127.0.0.1:9658/ext/bc/C/rpc | jq '.result'
```


(c) Flare Networks Ltd. 2020