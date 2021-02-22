# State Connector System

Proving the state of any underlying chain for all smart contracts on Flare.

Flare Network is purpose-built for safely interpreting the state of all underlying chains. Other networks either force you to rely on trusted third parties for this, or they force other chains to conform to their standards, in effect changing the independent chain's protocol so they can then begin to communicate. Flare by contrast does not require you to trust anyone but the validators of an underlying chain, and Flare does not require validators from the underlying chains to even be aware that Flare exists.

The state connector system enables Flare to attain the existence, validity and ordering of any transaction from any underlying chain such as XRP, LTC and others. The ability to prove these properties about any transaction from any chain is available freely to all apps on Flare, including the F-asset protocol for representing assets from other networks directly onto Flare.

## Design

The high-level premise for how the state connector system operates is best motivated by its threat-model: in order to absorb incorrect state into a Flare Network app from an underlying chain, an attacker would need to compromise:

1. Your own Flare validator's view of the underlying chain
2. A quorum of other Flare validators' views of the underlying chain
3. A sustained attack that lasts longer than the number of underlying-chain block confirmations independently required by your app on Flare

This threat model is achieved by requiring each Flare Network validator, no matter how prominently they feature in consensus, to independently observe the ongoing state of underlying chains. Propositions about the state of an underlying chain are only applied to a validator's local copy of the Ethereum Virtual Machine (EVM) on Flare after the validator independently verifies the proposed underlying-chain state.

In the following sections, the 2-stage mechanism design of the state connector is defined. The first stage enables Flare validators to agree on the span of data from an underlying chain that is currently available, and the second stage involves the actual proof of a transaction from an underlying chain.

## Stage 1: Agreement on Data Availability

Before any specific transaction from an underlying chain is proven on Flare, the span of blocks from the underlying chain that are globally available across all Flare validators is first agreed. Anyone is permitted to compete to keep this process alive over time by submitting data availability proof transactions to Flare. The proof format is simple, and only takes as input:

* **`chainId`**: A numeric identifier for the currently selected underlying chain.
* **`ledger`**: The last ledger index in the series of ledger(s) from the underlying chain currently being proposed as available.
* **`claimPeriodIndex`**: The ongoing state of an underlying chain is broken down into uniformly-sized and ordered groups of ledger(s) known as _claim periods_. In general, the expected length of time for an underlying chain to produce a claim period should be defined as being strictly greater than the time to finality of a single block on Flare. This is an important consideration, because it enables rapidly catching up to the latest claim period state of an underlying chain in the scenario that liveness in the process of agreeing data availability is temporarily lost. That is, longer claim periods enable faster bootstrapping to the latest state at the expense of longer time to finalize the present state of an underlying chain to Flare.
* **`claimPeriodHash`**: The keccak256 hash of the last ledger's regularly-formatted hash from this claim period.

```javascript
// flare/contracts/stateConnector.sol -> line 103

function proveClaimPeriodFinality(uint32 chainId, uint64 ledger, 
    uint64 claimPeriodIndex, bytes32 claimPeriodHash) public returns 
    (uint32 _chainId, uint64 _ledger, uint16 _numConfirmations, 
    bytes32 _claimPeriodHash)
```

The process of tracking claim period availability on Flare is performed at the EVM level using a Solidity smart contract. The contract permits anyone to compete to be the first to submit a valid claim period availability proof, assuming they've paid a sufficient gas cost for their proof transactions, but only permits one to do so after a timeout has elapsed since the last claim period availability proof was finalised for the underlying chain being presently considered.

### Pre-flight Checking of the Viability of a Data Availability Proof

Before a proof is compared against an underlying chain, it is first evaluated at the EVM level against a checklist for conformity to a basic set of rules that can be checked directly:

1. `chainId` exists as an option on the state connector smart contract.
2. The data availability proof is monotonic and is proving `claimPeriodIndex` where `claimPeriodIndex - 1` is the prior finalised data availability proof's index for this `chainId`.
3. `ledger == genesisLedger + (claimPeriodIndex+1)*claimPeriodLength` where `genesisLedger` is first available ledger on Flare for this `chainId` and `claimPeriodLength` is the constant-sized number of ledgers that form the length of this chain's claim periods.
4. The user is able to pay a `dataFee` outside of their normal gas cost that is now taken from them at the EVM systems-level, meaning that this fee will be taken even if their transaction reverts. This fee is used to make it expensive to compete in submitting data availability proofs, however the first sender to successfully prove data availability for a particular claim period has that proof's dataFee eventually returned to them from a fee pool contract plus an extra reward.
5. Data availability proofs are normally permitted to be submitted as frequently as `timeDiffAvg - 15` seconds, where `timeDiffAvg` is the exponential moving average of elapsed time between historic proof finalisations for this chain. This enables a recovery from a liveness outage in proving data availability by permitting a slow reduction in the value of `timeDiffAvg`. 
6. Each chain features a limit on what the value of `timeDiffAvg` can be, and this is defined as two times the expected length of time for a claim period on that chain: `2 * timeDiffExpected`. For example, for an underlying chain with average 4-second finality and a claim period size of 30 ledgers, `2 * timeDiffExpected` for this chain equals `2 * 120 == 240` seconds, where `timeDiffExpected` can be updated over time via governance.
7. When a chain reaches a value for `timeDiffAvg` of `1/2 * timeDiffExpected`, the permitted timeout between submitting data availability proofs is set to `2/3 * timeDiffAvg`, enabling a rapid bootstrapping to the latest state in the event of a liveness outage of the state-connector system.

![alt text](https://gitlab.com/flarenetwork/flare/-/blob/master/docs/StateConnector/timeDelays.png "Data Availability Proof Timing")
Frequency in Permitting Data Availability Proof Submissions to Flare.

If the presently submitted data availability proof conforms to all of these basic conditions, then the logic proceeds to the next stage of verifying the data availability proof. Otherwise, the entire transaction containing this proof proposal is reverted and the sender can never recuperate their `dataFee` value.

### Verifying a Data Availability Proof

Once the basic viability of a data availability proof has been determined, the prior function call to `proveClaimPeriodFinality`  returns 4 variables: `_chainId`, `_ledger`, `_numConfirmations` and `_claimPeriodHash`. These outputs mirror their correspondingly-named function inputs, with the exception of `_numConfirmations`, which was retrieved from the state connector contract storage given the inputted `chainId`. The value of `_numConfirmations` represents the number of consensus confirmations to judge a block on an underlying chain as being finalised; this primarily applies to proof-of-work based chains and is set to `0` for instant-finality chains like XRP.

At the systems-level, the initial viability check is performed using a standard EVM state transition call: `st.evm.Call(from, to, data, gas, value)`. However, this call is performed separately and ahead of the actual state transition call that changes the EVM state. The systems-level code knows to only perform this 2-phase call of `st.evm.Call` because it checks the `to` address-value and the function selector bytes contained in the data bytes-value to check that this transaction is pertaining to calling the `proveClaimPeriodFinality` function in the state connector contract, which has a fixed address from the genesis file but can be updated over time through governance.

```golang
// flare/fba-avalanche/coreth/core/state_transition.go -> line 259

// Check basic viability of the data availability proof
checkRet, _, checkVmerr := st.evm.Call(sender, st.to(), st.data, st.gas, st.value)
if (checkVmerr == nil) {
	// Basic viability test passed
	chainConfig := st.evm.ChainConfig()
	// Verify the data availability proof by contacting your underlying chain validator
	if (StateConnectorCall(st.evm.Context.BlockNumber, st.data[0:4], checkRet, *chainConfig.StateConnectorConfig) == true) {
		// Proof was verified
		originalCoinbase := st.evm.Context.Coinbase
		defer func() {
			st.evm.Context.Coinbase = originalCoinbase
		}()
		// Create signal that proof has been verified
		st.evm.Context.Coinbase = st.msg.From()
	}
}
// The data availability proof is only permitted to transition EVM state
// in this call if st.evm.Context.Coinbase == st.msg.From()
ret, st.gas, vmerr = st.evm.Call(sender, st.to(), st.data, st.gas, st.value)
```

After the basic viability check, the values `checkRet` and `checkVmerr` are returned at the systems-level. `checkRet` contains the values `{_chainId,  _ledger, _numConfirmations, _claimPeriodHash}`, and `checkVmerr` is equal to `nil` if the basic viability test passes.

The next step is that your underlying chain validator is directly contacted via a URL endpoint that you provided to your Flare validator as a command-line argument on its launch. The values in `checkRet` are used to determine if `claimPeriodHash` matches the keccak256 hash of the regularly formatted hash of the `ledger` from this presently-considered underlying chain. This is a straightforward, single-call operation, and the system for this features complete error-handling to continually request the information until it becomes available on your underlying-chain validator. There is no time-limit to this process reaching completion; however, the Flare Network will continue without you once a sufficient number of validators return from this external call step and transition the EVM state. Your own validator's EVM state will only ever be transitioned once your call to your own underlying chain validator returns an answer about the correctness of `claimPeriodHash`, meaning that no one can force you to assume an incorrect state as long as your underlying-chain validator is safe.

Once the prior step returns and if it was successful, the `block.coinbase` value in the EVM is changed to the value of `msg.sender`. The value of `block.coinbase` is typically used on a blockchain to define the rewarded address for successfully being the leader that mines a block. However, the Avalanche consensus protocol is a leaderless protocol, so the value of `block.coinbase` is disused and normally hard-coded to `0x0100000000000000000000000000000000000000`. This step of changing block.coinbase to the successful data-availability proof sender is used to indicate to the state connector contract that the data availability proof transaction is verified, and that the rewards from being the first one to submit this proof should be sent to `msg.sender`.

Finally, the value of `timeDiffAvg` is updated for a successful data availability proof submission as follows:

```javascript
// stateConnector.sol -> line 133

// Calculate the actual moving average of timeDiff updates
uint256 timeDiffAvgUpdate = (chains[chainId].timeDiffAvg + (block.timestamp-chains[chainId].finalisedTimestamp))/2;
if (timeDiffAvgUpdate > 2*chains[chainId].timeDiffExpected) {
    // timeDiffAvg is not permitted to ever be
    // higher than 2*timeDiffExpected
    chains[chainId].timeDiffAvg = 2*chains[chainId].timeDiffExpected;
} else {
    chains[chainId].timeDiffAvg = timeDiffAvgUpdate;
}
chains[chainId].finalisedTimestamp = block.timestamp;
```

## Stage 2: Proving a Transaction

The process of proving a transaction from an underlying chain is much more straightforward than the previous stage of agreeing on data availability. One just sends a transaction that provides:

1. **`{chainId, claimPeriodIndex, claimPeriodHash}`** for determining that the payment is contained within a data-available region. 
2. **`paymentHash`**: The keccak256 hash of the underlying chain payment's regularly formatted hash, ledger number, source account, destination account, destination tag and amount sent. The pre-image of `paymentHash` isn't provided at this stage within the EVM transaction.
3. **`txId`**: The regularly formatted hash of the underlying chain payment.

A similar 2-phase mechanism as in the data availability proof system involving the use of a pre-check for basic viability is performed by first checking that the payment exists within a data-available region. If the basic test passes, then  the system calls on your underlying chain validator to retrieve the details from the payment using its `txId`. The system ensures that a retrieved payment exists within the data availability region.  The retrieved payment details are then used as the pre-image to construct a keccak256 hash that matches the form of `paymentHash`, and if the constructed hash matches the value of `paymentHash` then the payment is deemed to be valid and it's stored in the state connector contract storage for reference by any other contract on Flare that wants to check that the pre-image of `paymentHash` was finalised to Flare.

## Simple Payment Verification (SPV) Proofs Considered Harmful

A simple payment verification (SPV) proof is a way to prove to a blockchain that a payment has occurred on another blockchain. The proof typically consists of a header that contains a consensus proof such as a proof-of-work, or a signed k-of-n multisignature from a set of validators that are currently believed to be in control of the underlying chain being presently considered. The SPV proof itself then just contains a merkle-tree based set of hashes that proves that a provided payment forms the pre-image to a hash that is contained within the provided merkle tree.

One of the main advantages of a blockchain is that we do not depend on its validators for anything other than being tie-breakers in sequencing transactions. That is, validators on a blockchain cannot insert erroneous transactions into the network that do not conform to the state transition rules that everyone agrees to run. For example, as a miner on a blockchain, one cannot compel the movement of a single coin that does not belong to them, the only way to do so is to sign a valid transaction that can be traced all the way back to the network genesis state as having a valid transfer of ownership history.

However, an SPV proof breaks this separation of powers guarantee -- it permits validators to now submit an isolated merkle tree proof that is self-referential and cannot be tied back to the genesis of the network. For example, if validators collude to manufacture a false SPV proof, they could convince a separate blockchain that a transaction sending them a billion units of an asset has occurred, when they had in fact never owned such an amount.

SPV proofs are also complicated for non-proof-of-work chains by having to keep track of changing validator sets on an underlying chain over time. Consider the scenario where an outgoing set of validators from an underlying chain refuses to sign a proof to Flare that they are now leaving power -- what penalty do they have for refusing to do this? Trying to manage validator sets in this way relies on the enforcement of bad behavior to be conducted by the same set of operators that have performed the bad behavior.

SPV proofs are therefore considered harmful for the purpose of proving the state of an underlying chain to another network. The approach escalates the privilege of underlying chain validators to be able to falsify the ownership of an asset, and the enforcement of bad behavior in the approach must be conducted by the same set of operators that have performed the bad behavior.

## State Connector System Advantages

The state connector system is a competitive approach for proving the state of an underlying chain to a smart contract, and it has the following advantages:

1. **Transaction validity references back to an underlying chain's genesis block**: Other approaches like the SPV proof do not check the validity of a transaction.
2. **Safety only depends on an underlying chain's validators**: There is no trusted third-party service that has its own set of economic incentives and risks. Trust is minimized by leveraging the guarantee that safety can only be lost in the state connector if an underlying chain's validators encounter a Byzantine fault.
3. **No cooperation needed from an underlying chain's validators**: Validators from an underlying chain do not need to modify their chain's code base to permit Flare to interpret their network. An underlying chain's validators do not even need to be aware that Flare exists in order for the state connector system to operate.
4. **Can read the state of any blockchain**: The state connector can operate on any possible Sybil-resistance technique of an underlying chain. For example: proof-of-work, proof-of-stake and even federated byzantine agreement where there is not global agreement on the set of validators in control of a network.
5. **No encoding of the current validators in control of an underlying chain to a smart contract on Flare**: This requirement of other state-relay approaches such as the SPV proof leads to the hazardous scenario where the enforcement of bad behavior in relaying state needs to be conducted by the same set of operators that have performed the bad behavior.
6. **Constant-sized proofs**: both the data availability proof and the payment proof are constant-sized, independent of the number of other payments in the data availability period being considered.
7. **Every Flare validator independently verifies an underlying chain's state**: If your own Flare validator observes the canonical state of an underlying chain, then you will not lose safety against that chain.