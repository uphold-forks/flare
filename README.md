# Flare

Flare is a next-generation blockchain which enables smart contracts with XRP that settle on the XRP ledger.

## Features

- Federated Byzantine Agreement based Avalanche consensus. 
- State-connector system to observe the state of the XRP Ledger, leveraging the same FBA consensus properties of the core Flare Network validators.

## Dependencies

- Hardware per Flare node: 2 GHz or faster CPU, 4 GB RAM, 2 GB hard disk.
- OS: Ubuntu >= 18.04 or Mac OS X >= Catalina.
- Flare node software: [Go](https://golang.org/doc/install) version >= 1.13.X and set up [`$GOPATH`](https://github.com/golang/go/wiki/SettingGOPATH).
- State-connector software: [NodeJS](https://nodejs.org/en/download/package-manager/) version >= v10 LTS.
- NodeJS dependency management: [Yarn](https://classic.yarnpkg.com/en/docs/install) version >= v1.13.0.

Clone Flare and use Yarn to install its dependencies:
```
git clone https://gitlab.com/flarenetwork/flare
cd flare
yarn
```

## Network

Flare runs the [Avalanche consensus protocol](https://github.com/ava-labs/avalanchego), adapted to Federated Byzantine Agreement as opposed to Proof-of-Stake to protect against the Sybil attack.

### FBA Avalanche Consensus

The SLOC size of the changes made to gecko, the distribution name of the avalanchego repo, includes 202 additions and 557 deletions: https://gitlab.com/flarenetwork/flare/-/commit/92b7224ab9e03af23ca0f9febe567a2e9c839b45. These changes largely represent disabling the staking system of Avalanche, and instead allowing each node to independently define the probability of sampling peer nodes as opposed to globally basing this probability according to token ownership. 

1) Disabling the staking system, allowing private weighting of the importance of other nodes: https://gitlab.com/flarenetwork/flare/-/blob/92b7224ab9e03af23ca0f9febe567a2e9c839b45/gecko@0.5.7/genesis/genesis.go#L143

2) Private weighting of the probability of sampling other nodes: 
https://gitlab.com/flarenetwork/flare/-/blob/92b7224ab9e03af23ca0f9febe567a2e9c839b45/gecko@0.5.7/sc/state_connector.go#L16

### Ethereum Virtual Machine: Fixed Gas Costs and Unique Node List Definition at the Contract Layer

No changes will ever be made to go-ethereum, only to coreth (maintained by Ava Labs) which inherits go-ethereum and interfaces with gecko. The SLOC size of the changes made to coreth includes 49 additions and 88 deletions: https://gitlab.com/flarenetwork/flare/-/commit/57b65ded955a23f691fae9df4c0c60e3c4be0691.

These changes represent enabling the state-connector system to operate exactly as specified in the Flare whitepaper: https://flare.xyz/app/uploads/2020/08/flare_v1.1.pdf. See Section 2.2 State-Connectors: Consensus on the state of external systems as well as Appendix A: Encoding the UNL Within the Smart Contract Layer for a description of the system design.

1) Custom values of block.coinbase when the state connector contract is called: https://gitlab.com/flarenetwork/flare/-/blob/57b65ded955a23f691fae9df4c0c60e3c4be0691/coreth@v0.2.5/core/state_transition.go#L142

2) Fixed gas costs (at the same order of magnitude as the XRP Ledger), with an upper-limit on computational complexity per transaction: https://gitlab.com/flarenetwork/flare/-/blob/57b65ded955a23f691fae9df4c0c60e3c4be0691/coreth@v0.2.5/core/state_transition.go#L142

## State-Connector System

The state-connector system enables the Flare Network to encode the state of the XRP Ledger in a manner that provides:

	1) Open-membership in running the state-connector system.
	2) Consistent XRP Ledger state definition across Flare nodes.
	3) Independent verification by each Flare node of the XRP Ledger state, meaning that finality only occurs from the perspective of each node once they independently verify the XRP Ledger state.
	4) No reliance on staking or trusted authorities, thus unbounding the value that can be expressed in the system.

Typically, bridges between two networks rely on some form of k-of-n signature scheme to secure the bridge. However, k-of-n signature schemes can be broken if just n/3 of the parties refuse to sign anything. This means that n/3 parties can stop any action, including changing the definition of the set of parties in n. In other words, k-of-n signature schemes work until they break once.

By contrast, the state connector system is a Federated Byzantine Agreement setup, thus allowing node operators to circumvent liveness attacks by enabling each node operator to independently change their definition of the parties in the set of n. This enables a natural migration away from malicious parties that refuse to sign anything, while preserving consistency between honest nodes.

The state connector system has the useful safety property of only possibly having a safety attack between two nodes if 33% of the nodes that they intersect with in their UNL are malicious. This is in contrast to permissioned systems, where the safety condition is 33% of the closed-set of n nodes. This property of FBA and the state connector system enables permissionless open-membership without relying on economic incentives which limit the expressable value on the network.

- State-connector system solidity contract: https://gitlab.com/flarenetwork/flare/-/blob/master/solidity/fxrp.sol

- State-connector system serverless infrastructure: https://gitlab.com/flarenetwork/flare/-/blob/master/fxrp.js

## Deploy

`./network.sh`

https://testnet.xrpl.org/

`./bridge.sh 0`
`./bridge.sh 1`
`./bridge.sh 2`
`./bridge.sh 3`
`./bridge.sh 4`

`curl -sX POST --data '{
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": [
        "0x7Ff2a962DC2A13114cc7e4b5b18277D43444526C",
        "latest"
    ],
    "id": 1
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/bc/C/rpc | jq '.result'`

`curl -sX POST --data '{
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": [
        "0x7Ff2a962DC2A13114cc7e4b5b18277D43444526C",
        "latest"
    ],
    "id": 1
}' -H 'content-type:application/json;' 127.0.0.1:9658/ext/bc/C/rpc | jq '.result'`