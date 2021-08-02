# Flare

Flare is a next-generation blockchain which enables smart contracts with multiple non-Turing complete assets that settle on their native chain.

## Features

- Federated Byzantine Agreement based Avalanche consensus. Control over the Flare network is proportionally given to the miners that contribute the most to the safety of underlying blockchains on Flare, weighted by market cap.
- State-connector system to observe the state of underlying chains. State-connector proofs can be submitted by anyone, and all nodes independently compare this proof to their own view of an underlying chain before permitting the proof to be finalised onto Flare.

## Documentation & FAQ's

Information about how Flare works at the network-level is available at https://docs.flare.network/en/.

Join the Flare community on [Discord](https://discord.gg/XqNa7Rq) for FAQ's and if you have any other questions or feedback.

## Dependencies

- Hardware per Flare node: AMD64 processor, 2 GHz or faster CPU, 6 GB RAM, 200 GB hard disk.
- OS: Ubuntu >= 20.04.
- Flare validator software: [Go](https://golang.org/doc/install) version 1.15.14
    - Ensure that you set up [`$GOPATH`](https://github.com/golang/go/wiki/SettingGOPATH).
- State-connector software: [NodeJS](https://nodejs.org/en/download/package-manager/) version 10.24.0.
- NodeJS dependency management: [Yarn](https://classic.yarnpkg.com/en/docs/install) version 1.22.10.
- gcc, g++, cURL and jq: `sudo apt update && sudo apt -y install gcc g++ curl jq`

Clone Flare:
```
git clone https://gitlab.com/flarenetwork/flare
cd flare
```

## Compile Flare

Run the following command:

```
./compile.sh
```

## Deploy a Local Network

Configure and launch a 5-node network:

```
./cmd/local.sh
```

To restart a previously stopped network without resetting it, use the launch command above with the `--existing` flag.

One can change the underlying-chain API endpoints they use for the state-connector system by editing the contents of the file at: `conf/local/chain_apis.json`. This file can differ across all validators on a Flare Network, because these values represent the private choices that a validator has made concerning which API endpoints they wish to rely on for safety in verifying proofs of the state of an underlying-chain.

## State-Connector System: Proving the state of any underlying chain for all smart contracts on Flare

The state connector system is a competitive approach for proving the state of an underlying chain to a smart contract, and it has the following advantages:

1. **Transaction validity references back to an underlying chain's genesis block**: Other approaches like the SPV proof do not check the validity of a transaction.

2. **Safety only depends on an underlying chain's validators**: There is no trusted third-party service that has its own set of economic incentives and risks. Trust is minimized by leveraging the guarantee that safety can only be lost in the state connector if an underlying chain's validators encounter a Byzantine fault.

3. **No cooperation needed from an underlying chain's validators**: Validators from an underlying chain do not need to modify their chain's codebase to permit Flare to interpret their network. An underlying chain's validators do not even need to be aware that Flare exists in order for the state connector system to operate.

4. **Can read the state of any blockchain**: The state connector can operate on any possible Sybil-resistance technique of an underlying chain. For example: proof-of-work, proof-of-stake and even federated byzantine agreement where there is not global agreement on the set of validators in control of a network.

5. **No encoding of the current validators in control of an underlying chain to a smart contract on Flare**: This requirement of other state-relay approaches such as the SPV proof leads to the hazardous scenario where the enforcement of bad behavior in relaying state needs to be conducted by the same set of operators that have performed the bad behavior.

6. **Constant-sized proofs**: both the data availability proof and the payment proof are constant-sized, independent of the number of other payments in the data availability period being considered.

7. **Every Flare validator independently verifies an underlying chain's state**: If your own Flare validator observes the canonical state of an underlying chain, then you will not lose safety against that chain.

In a new terminal window, the following command launches a web3 service that continually competes to prove data availability from the XRP Ledger to the Flare Network. The system submits a constant-sized data availability proof for each range of ledgers on the underlying chain, and the state connector system on Flare rewards the first account to successfully do so for each range of ledgers. This allows one to then prove that a payment exists on an underlying chain to any contract on the Flare Network, such as the F-asset contract.

```
cd client
yarn
./proveDataAvailability.sh xrp
```

Similarly, Litecoin block data availability can be proven using the command:

```
./proveDataAvailability.sh ltc
```

## Verify an Underlying Chain Payment on Flare

### Proving a Payment

Once the first data availability proof has been finalised, you can then submit a payment proof regarding the XRP transaction below. Run the following command in a separate terminal window:

```
node prove xrp FFB44382D074CB37B63AC9D3EB2D829C1D1FE4D54DC1A0BCC1D23BAE18D53272
```

Payment info: https://livenet.xrpl.org/transactions/FFB44382D074CB37B63AC9D3EB2D829C1D1FE4D54DC1A0BCC1D23BAE18D53272

### Disproving a Payment

One can also prove that a payment has not occurred by a certain ledger index on the underlying chain. For example, the following command proves to the state connector contract that payment F4D1EDBFB578A8C96CF12D90E9ADEDF22F556420276A1D0F13245E433020416A has not occurred by ledger 62880001 on the XRPL:

```
node disprove xrp F4D1EDBFB578A8C96CF12D90E9ADEDF22F556420276A1D0F13245E433020416A \
rKfXPjgLZvQ7ZLSkVDS88RwZM7MhUhzoUQ rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq 129053196 20000000000 XRP 62880001
```

Payment info: https://livenet.xrpl.org/transactions/F4D1EDBFB578A8C96CF12D90E9ADEDF22F556420276A1D0F13245E433020416A

### Custom-currency Proofs (e.g. Issued Currencies, ERC20s, etc.)

The proving/disproving of a custom-currency payment is also supported. The state connector supports any issued currency and differentiates them by appending their currency code to its issuer's address, e.g. USDrL7jDKUNmxBG24QsqA6fDUwFwjndgMojje. For example, this command proves that a payment of USD issued on the XRPL occurred:

```
node prove xrp 8B3FB7F0B5BDAB705FDB152EBA20BF47159898D76812DA80BD367D99206B5C59
```

Payment info: https://livenet.xrpl.org/transactions/8B3FB7F0B5BDAB705FDB152EBA20BF47159898D76812DA80BD367D99206B5C59

This example proves a BTC issued-currency payment on the XRPL:

```
node prove xrp 67B3F2CAF2905BC67FEB5417C1C3F9AA941DF8984F1F49EC48D4DCADFAC94418
```

Payment info: https://livenet.xrpl.org/transactions/67B3F2CAF2905BC67FEB5417C1C3F9AA941DF8984F1F49EC48D4DCADFAC94418

## License: MIT

Copyright 2021 Flare Foundation

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
