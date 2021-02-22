# Flare Network Validators: Leveraging miners from underlying chains for consensus on Flare Network

Flare is unique as a network in that it is focused on bringing together liquidity from all other networks into a unified composable system, without levying any changes on how the underlying networks already work today. Flare's validator structure takes advantage of this idea; succinctly: control over the Flare network is proportionally given to the miners that contribute the most to safety in their underlying chains and that have the most value from their chain represented onto Flare as F-assets.

## Constructing the Validator List on Flare

* Each day, a ground truth list of miners from underlying networks will be deterministically generated [IE this is a process that is publicly verifiable and not controlled by a centralized party] , weighted according to their contribution to the safety on their own network. For example, in the case of a proof of work network this is calculated based on how many blocks a miner has successfully mined over a period of time. There is no limit to the size of this list of validators, and the list is comprised of any miner from an underlying chain that signals that they wish to also become a validator on Flare.

  * Example: suppose 3 miners from an underlying chain wish to become validators on Flare. 
    - Miner 1 mined 20 of the past 100 blocks on their chain 
    - Miner 2 mined 5 of the past 100 blocks on their chain 
    - Miner 3 mined 10 of the past 100 blocks on their chain 
  * The relative weighting of each of these miners as validators on Flare is then: 
    - Miner 1: 0.2/(0.2+0.05+0.1) == 0.2/0.35 == 0.57 
    - Miner 2: 0.05/0.35 == 0.14 
    - Miner 3: 0.1/0.35 == 0.29 
    Note that: 0.57 + 0.14 + 0.29 == 1.
  * Then, the relative weighting of this underlying chain compared to other underlying chains on Flare is calculated as follows: 
    - Underlying chain 1 has $1Bn represented as F-assets on Flare 
    - Underlying chain 2 has $2Bn represented as F-assets on Flare
  * The relative weighting of these underlying chains on Flare is then:
    - Chain 1: 0.33 
    - Chain 2: 0.66
  * This is because chain 2 has twice as large a presence as an F-asset compared to chain 1. To obtain a miner from chain 1's weighting as a validator on Flare, multiply their chain's weighting by their own weighting within their chain: 
    - Chain 1, miner 1: 0.57x0.33 = 0.19 
    - Chain 1, miner 2: 0.14x0.33 = 0.05 
    - Chain 1, miner 3: 0.29x0.33 = 0.09
  * The weightings above define the probability of sampling each validator during consensus on Flare. For example, suppose two validators exist on Flare. Validator 1 has a weighting of 0.25 and validator 2 has a weighting of 0.75. Although they are only two nodes, validator 2 behaves as if they are 3 nodes because they will be sampled 3 times as often during consensus on Flare compared to validator 1. 


* The final addition to the daily ground truth list of nodes is comprised of Flare Time Series Oracle miners. They are given a constant-sized 20% share of the validator list on Flare, and oracle miners divide up this 20% share of the validator list based on their successful contribution to the oracle mining process on Flare. This means that the remaining 80% of the validator list on Flare is always dedicated to being divided across miners from underlying chains that are represented as F-assets on Flare.

* A final important technical point is that an independent node operator has the right to privately redistribute 20% of the probability mass within the daily ground truth list however they see fit. This is because Flare is a Federated Byzantine Agreement network in the unique node list structure; targeting a minimum of 60% overlap in node lists. That means that 20% of the node list is free to be redistributed by each individual node operator. This is useful for removing a tail end of hundreds of smaller F-assets from control as validators on the network, or conversely in dampening the power of any single F-asset over the validation of the network, or for any other reason that an independent node operator sees fit.
  * Example: Suppose a node operator preferred to remove the Flare oracle miners from their validator list; they would therefore redistribute 20% probability mass from the oracle miners to the F-asset miners, giving the F-asset miners 100% share of the validator list from that node operator's perspective. Conversely, suppose another node operator preferred to increase the probability mass share of the oracle miner validator set by 20%; they would therefore give 40% probability mass to the oracle miners and 60% probability mass to the F-asset miners. This means that the two node operators intersect by 60% probability mass, which is the targeted minimum overlap to guarantee safety between them.
  * A technical detail here is that the sample size parameter `k` during consensus on Flare is set such that it always contains greater than 70% of the probability mass of an independent node operator's private validator list. This is because such a sample size is always guaranteed to contain more than half of the 60% overlap target of probability mass, which is necessary to guarantee the quorum intersection property (QIP) that provides safety on the network.


* Finally, any validator that exists on the daily ground truth list and also conforms to minimal uptime requirements as a validator is entitled to a share of the Flare network mining reward scaled by their weighting on the ground truth list and paid out daily.

## Relevant Code Segments

Updating the validator set on Flare with custom sampling probabilities: https://gitlab.com/flarenetwork/flare/-/blob/master/fba-avalanche/avalanchego/vms/platformvm/vm.go#L959
```golang
func (vm *VM) updateVdrSet(subnetID ids.ID) error {
	vdrs := validators.NewSet()
	stopPrefix := []byte(fmt.Sprintf("%s%s", constants.PrimaryNetworkID, stopDBPrefix))
	stopDB := prefixdb.NewNested(stopPrefix, vm.DB)
	defer stopDB.Close()
	for _, validator := range vm.ValidatorConfig.Validators {
		err := vdrs.AddWeight(validator.ShortNodeID, uint64(validator.Weighting))
		if err != nil {
			return err
		}
	}
	err := vm.vdrMgr.Set(constants.PrimaryNetworkID, vdrs)
	if err != nil {
		return err
	}
	return nil
}
```

Providing sampling probabilities via command-line input on launch using the `--validators-file` flag:
```bash
./build/avalanchego --public-ip=127.0.0.1 --snow-sample-size=2 --snow-quorum-size=2 --http-port=9650 --staking-port=9651 \
	--db-dir=db/node00/ --staking-enabled=true --network-id=coston --bootstrap-ips= --bootstrap-ids= \
	--staking-tls-cert-file=$(pwd)/config/keys/node00/staker.crt --staking-tls-key-file=$(pwd)/config/keys/node00/staker.key \
	--log-level=debug --validators-file=$(pwd)/config/validators/validators_0000.json --chain-apis="https://xrpl.ws"
```

Example `validators.json` definition: https://gitlab.com/flarenetwork/flare/-/blob/master/fba-avalanche/avalanchego/config/validators/validators_0000.json
```json
{
  "validators": [
    {
      "nodeID": "NodeID-GQ4292fG2RMRWa7RtphPJTYHeMR5YAQPM",
      "weighting": 1
    },
    {
      "nodeID": "NodeID-GMHrauiUPGikdbT4Z65dEBFpfQWKovLy5",
      "weighting": 1
    },
    {
      "nodeID": "NodeID-DhdvGK268cNmDPzvh1Vw7rzSmT1tptSUB",
      "weighting": 1
    },
    {
      "nodeID": "NodeID-hBfmpWJ87GSPHUtxthGd2fHsVdaGmkgq",
      "weighting": 1
    }
  ]
}
```