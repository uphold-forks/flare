# Flare

Flare is a next-generation blockchain which enables smart contracts with XRP that settle on the XRP Ledger.

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

The changes made to Avalanche to enable FBA consensus are primarily underpinned by disabling the staking system of Avalanche, and instead allowing each node to independently define the probability of sampling peer nodes as opposed to globally basing this probability according to token ownership. 

1) Disabling the staking system, allowing private weighting of the importance of other nodes: 
- https://gitlab.com/flarenetwork/flare/-/blob/master/fba-avalanche/avalanchego/vms/platformvm/vm.go#L989
- https://gitlab.com/flarenetwork/flare/-/blob/master/fba-avalanche/avalanchego/genesis/genesis.go#L125

2) Private weighting of the probability of sampling other nodes: 
- https://gitlab.com/flarenetwork/flare/-/blob/master/fba-avalanche/avalanchego/main/params.go#L227

### Ethereum Virtual Machine: Fixed Gas Costs and Unique Node List Definition at the Contract Layer

No changes will ever be made to go-ethereum, only to coreth (maintained by Ava Labs) which inherits go-ethereum and interfaces with avalanchego. These changes represent enabling the state-connector system to operate exactly as specified in the Flare whitepaper: https://flare.xyz/app/uploads/2020/08/flare_v1.1.pdf. See section 2.2 "State-Connectors: Consensus on the state of external systems" as well as Appendix A: "Encoding the UNL within the smart contract layer" for a description of the system design and its engineering considerations.

1) Custom values of block.coinbase when the state connector contract is called: https://gitlab.com/flarenetwork/flare/-/blob/master/fba-avalanche/coreth/core/state_transition.go#L262

2) Fixed gas costs for the state connector system (at the same order of magnitude as the XRP Ledger), with an upper-limit on computational complexity per transaction: https://gitlab.com/flarenetwork/flare/-/blob/master/fba-avalanche/coreth/core/state_transition.go#L274

## State-Connector System

The state-connector system enables the Flare Network to encode the state of the XRP Ledger in a manner that provides:

- Open-membership in running the state-connector system.
- Consistent XRP Ledger state definition across Flare nodes.
- Independent verification by each Flare node of the XRP Ledger state, meaning that finality only occurs from the perspective of each node once they independently verify the XRP Ledger state.
- No reliance on staking or trusted authorities, thus unbounding the value that can be expressed in the system.

Typically, bridges between two networks rely on some form of k-of-n signature scheme to secure the bridge. However, k-of-n signature schemes can be broken if just n/3 of the parties refuse to sign anything. This means that n/3 parties can stop any action, including changing the definition of the set of parties in n. In other words, k-of-n signature schemes work until they break once.

By contrast, the state connector system is a Federated Byzantine Agreement setup, thus allowing node operators to circumvent liveness attacks by enabling each node operator to independently change their definition of the parties in the set of n. This enables a natural migration away from malicious parties that refuse to sign anything, while preserving consistency between honest nodes.

The state connector system has the useful safety property of only possibly having a safety attack between two nodes if 33% of the nodes that they intersect with in their UNL are malicious. This is in contrast to permissioned systems, where the safety condition is 33% of the closed-set of n nodes. This property of FBA and the state connector system enables permissionless open-membership without relying on any economic incentives, which limit the expressable value on such networks.

1) State-connector system solidity contract: https://gitlab.com/flarenetwork/flare/-/blob/master/solidity/fxrp.sol

2) State-connector system serverless infrastructure: https://gitlab.com/flarenetwork/flare/-/blob/master/fxrp.js

## Deploy

Configure and launch a 5-node network, with varying definitions of Unique Node List (UNL) across nodes. A node then mirrors its own network-level UNL definition at the contract level for the state-connector system.

```
./config.sh
```

Once the above config script completes execution, launch the network using:
```
./launch.sh
```

When the deployment is complete, this command displays the unique node list definitions of each node. Setting UNL definitions is a completely out-of-band operation that does not require any network-level consensus on which Node IDs are elegible to be included in the UNL.

To test the sampling of peer nodes, try these commands:

### Node 1's Unique Node List
```
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method" :"platform.sampleValidators",
    "params" :{
        "size":4
    }
}' -H 'content-type:application/json;' 127.0.0.1:9650/ext/P | jq '.result'
```

### Node 5's Unique Node List
```
curl -sX POST --data '{
    "jsonrpc":"2.0",
    "id"     :1,
    "method" :"platform.sampleValidators",
    "params" :{
        "size":4
    }
}' -H 'content-type:application/json;' 127.0.0.1:9658/ext/P | jq '.result'
```

## State-Connector System Operation

In new terminal windows, the following commands launch a state-connector instance attached to each respective node. The terminal output of the command shows the entire process of observing, registering and finalising the state of the XRP Ledger. The state connector deployment is configured to operate over a historic set of approximately 45k payments on the XRPL testnet beginning at ledger index number 11843371. The system records claim periods (see the Flare whitepaper linked above) as a merkle tree hash, allowing one to prove to a contract on the Flare Network, such as FXRP, that a payment exists on the XRPL using an SPV proof.

Terminal 1:
```
./bridge.sh 0
```

Terminal 2:
```
./bridge.sh 1
```

Terminal 3: 
```
./bridge.sh 2
```

Terminal 4:
```
./bridge.sh 3
```

Terminal 5:
```
./bridge.sh 4
```

Note that the terminal output of the state-connector reports each node's independent definition of the UNL, derived from their local definition of the `block.coinbase` variable which is used to index: `UNLmap[block.coinbase].list` https://gitlab.com/flarenetwork/flare/-/blob/master/solidity/fxrp.sol#L71. Also, the state connector smart contract automatically bounces excess transactions as part of its normal operation, so you will likely occasionally see transaction rejection messages in the terminal output of the bridge.sh script. This is normal and is performed in order to reduce the network traffic footprint of the state connector system.

## Google Cloud Platform deployment

To see how the Flare nodes can be deployed to GCP, see: https://gitlab.com/flarenetwork/flare/-/tree/master/gcp


(c) Flare Networks Ltd. 2020