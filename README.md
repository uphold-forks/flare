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

Gecko changes: https://gitlab.com/flarenetwork/flare/-/commit/92b7224ab9e03af23ca0f9febe567a2e9c839b45

Disabling the staking system, allowing private weighting of importance of other nodes: https://gitlab.com/flarenetwork/flare/-/blob/92b7224ab9e03af23ca0f9febe567a2e9c839b45/gecko@0.5.7/genesis/genesis.go#L143

Private weighting of importance of other nodes: 
https://gitlab.com/flarenetwork/flare/-/blob/92b7224ab9e03af23ca0f9febe567a2e9c839b45/gecko@0.5.7/sc/state_connector.go#L16

No changes made to go-ethereum, only to coreth which inherits go-ethereum

Coreth changes: https://gitlab.com/flarenetwork/flare/-/commit/57b65ded955a23f691fae9df4c0c60e3c4be0691

Custom values of block.coinbase when the state connector contract is called: https://gitlab.com/flarenetwork/flare/-/blob/57b65ded955a23f691fae9df4c0c60e3c4be0691/coreth@v0.2.5/core/state_transition.go#L142

Fixed gas costs (at the same order of magnitude as the XRP Ledger), with an upper-limit on computational complexity per transaction: https://gitlab.com/flarenetwork/flare/-/blob/57b65ded955a23f691fae9df4c0c60e3c4be0691/coreth@v0.2.5/core/state_transition.go#L142


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