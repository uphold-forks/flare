Gecko changes: https://gitlab.com/flarenetwork/flare/-/commit/92b7224ab9e03af23ca0f9febe567a2e9c839b45

Coreth changes: https://gitlab.com/flarenetwork/flare/-/commit/57b65ded955a23f691fae9df4c0c60e3c4be0691

`yarn`

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