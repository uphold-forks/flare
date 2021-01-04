# Flare

Flare is a next-generation blockchain which enables smart contracts with multiple non-Turing complete assets that settle on their native chain.

## Features

- Federated Byzantine Agreement based Avalanche consensus. Control over the Flare network is proportionally given to the miners that contribute the most to safety in their underlying chains and that have the most value from their chain represented onto Flare as F-assets.
- State-connector system to observe the state of underlying chains. State-connector proofs only require one Flare transaction which can be submitted by anyone, and all nodes independently compare this proof to an underlying chain before permitting the proof to be finalised onto Flare.

## Dependencies

- Hardware per Flare node: 2 GHz or faster CPU, 4 GB RAM, 2 GB hard disk.
- OS: Ubuntu >= 18.04 or Mac OS X >= Catalina.
- Flare node software: [Go](https://golang.org/doc/install) version >= 1.13.X.
    - Ensure that you set up [`$GOPATH`](https://github.com/golang/go/wiki/SettingGOPATH).
- State-connector software: [NodeJS](https://nodejs.org/en/download/package-manager/) version >= v10 LTS.
- NodeJS dependency management: [Yarn](https://classic.yarnpkg.com/en/docs/install) version >= v1.13.0.

Clone Flare and use Yarn to install its dependencies:
```
git clone https://gitlab.com/flarenetwork/flare
cd flare
yarn
```

## Deploy

Configure a 4-node network and deploy the state-connector smart contract.

```
./config.sh
```

Once the above config script completes execution, launch the network using:
```
./launch.sh
```

## State-Connector System Operation

In a new terminal window, the following command launches a state-connector instance that observes to the XRP Ledger by using the inputted chainId `0`. Future chains will use the same command, but with a different chainId. The system proves relevant payments from a set of ledgers on the underlying chain, known as a claim period in the Flare network whitepaper, as a single merkle tree hash. This allows one to prove to a contract on the Flare Network, such as the F-asset contract, that a payment exists on an underlying chain such as the XRP Ledger using an SPV proof as a separate transaction that references the merkle tree hash. 

```
./bridge.sh 0
```

(c) Flare Networks Ltd. 2020
