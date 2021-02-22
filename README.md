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

Clone Flare:
```
git clone https://gitlab.com/flarenetwork/flare
```

## Deploy

Configure and launch a 4-node network and deploy the state-connector smart contract.

```
./launch.sh
```

To restart a previously stopped network without resetting it, use the launch command above with the `--existing` flag.

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
./bridge.sh xrp
```

## Verify an Underlying Chain Payment on Flare

Once the first data availability proof has been finalised, you can then submit a payment proof regarding this XRP transaction: https://livenet.xrpl.org/transactions/9617C6513866328BF0C57746A0BF88F8752F2CF798ADAB121AA66770F3D040EF. Run the following command in a separate terminal window:

```
node prove xrp 9617C6513866328BF0C57746A0BF88F8752F2CF798ADAB121AA66770F3D040EF
```

(c) Flare Networks Ltd. 2020
