# Simple GCP Deployment

This guide is to create and peer 5 nodes in GCP. 

## GCP Dependencies
- 5 x Google Cloud Platform e2-medium servers with 10gb storage
- OS: Ubuntu >= 18.04
- Flare node software: Go version >= 1.14.X and set up $GOPATH.
- State-connector software: NodeJS version >= v10 LTS.
- NodeJS dependency management: Yarn version >= v1.13.0.

### GCP Dependency Installation
Create a firewall rule called `flare-standard` in your project in your chosen VPC, this will allow external RPC and Peering, using the following config:
- IP ranges: 0.0.0.0/0
- Protocols and ports: tcp:9650, tcp:9651

Create 5 servers in your chosen VPC, in your chosen subnet and location. Assign the `flare-standard`, `default-allow-icmp`, `default-allow-internal`, and `default-allow-ssh` firewall rules to each node. A quick way to create all five servers is, after you have created the first one, you can click on the server and click create similar. Each node needs to be in the same region, but can be in different zones.
Name each one:
- node00
- node01
- node02
- node03
- node04

Then run the following install and update commands on each node:
```bash
# Update, Upgrade, Clean
sudo apt update -y && sudo apt full-upgrade -y && sudo apt autoremove -y && sudo apt clean -y && sudo apt autoclean -y && sudo snap refresh

# Install Deps
sudo apt install -y jq unzip

# Install Go at 1.14.10
sudo apt remove 'golang-*'
wget https://golang.org/dl/go1.14.10.linux-amd64.tar.gz
tar xf go1.14.10.linux-amd64.tar.gz
sha256sum go1.14.10.linux-amd64.tar.gz
sudo chown -R root:root ./go
sudo mv go /usr/local
# Can add these to ~/.profile so available on next log in
export GOPATH=$HOME/go
export PATH=$PATH:/usr/local/go/bin:$GOPATH/bin

# Install Node at 10.22.1
sudo apt install -y npm
sudo npm cache clean -f
sudo npm install -g n
sudo n 10.22.1
node --version  # Should be v10.22.1

# Install yarn at v1.22.10
wget https://github.com/yarnpkg/yarn/releases/download/v1.22.10/yarn_1.22.10_all.deb
sudo dpkg -i yarn_1.22.10_all.deb
yarn --version  # Should be 1.22.10
```

## GCP Installation
Create the install location:
```bash
mkdir ~/flare
```
  
Set up git access to GitLab and then:
```bash
git clone https://gitlab.com/flarenetwork/flare ~/flare
```
  
_Alternatively through the GCP SSH window you could upload a zip of the repo._  
  
Install dependencies with yarn:
```bash
cd flare
yarn
```

## GCP Network Deployment
### Make sure to run all of these commands within 5 seconds of each other, it is best to line all of the commands up in multiple ssh terminals and run them one after the other in quick succession. Testnet addresses can be generated here: https://xrpl.org/xrp-testnet-faucet.html. This may take a few mins to finish.   
  
Node 00
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node00" "<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657,<insert-node04-internal-ip-address>:9659" "<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656,<insert-node04-internal-ip-address>:9658"

# Check it's running
ps aux | grep avalanchego
```

Node 01
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node01" "<insert-node00-internal-ip-address>:9651,<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657" "<insert-node00-internal-ip-address>:9650,<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656"

# Check it's running
ps aux | grep avalanchego
```

Node 02
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node02" "<insert-node00-internal-ip-address>:9651,<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657" "<insert-node00-internal-ip-address>:9650,<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656"

# Check it's running
ps aux | grep avalanchego
```

Node 03
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node03" "<insert-node00-internal-ip-address>:9651,<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657" "<insert-node00-internal-ip-address>:9650,<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656"

# Check it's running
ps aux | grep avalanchego
```

Node 04
```bash
# Run node - bash -x gcp/network.sh "<node-id>" "<peering-ips>" "state-connector-ips"
bash -x gcp/network.sh "node04" "<insert-node01-internal-ip-address>:9653,<insert-node02-internal-ip-address>:9655,<insert-node03-internal-ip-address>:9657,<insert-node04-internal-ip-address>:9659" "<insert-node01-internal-ip-address>:9652,<insert-node02-internal-ip-address>:9654,<insert-node03-internal-ip-address>:9656,<insert-node04-internal-ip-address>:9658"

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