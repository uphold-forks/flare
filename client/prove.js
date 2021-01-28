'use strict';
process.env.NODE_ENV = 'production';
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const fs = require('fs');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const stateConnectorContract = "0x1000000000000000000000000000000000000001";
var config,
	customCommon,
	stateConnector,
	chains = {
		'xrp': {
			api: null,
			chainId: 0,
			claimsInProgress: false
		},
		'ltc': {
			api: null,
			chainId: 1,
			claimsInProgress: false
		},
		'xlm': {
			api: null,
			chainId: 2,
			claimsInProgress: false
		}
	};

// ===============================================================
// XRPL Specific Functions
// ===============================================================

const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');

async function xrplProcessLedgers(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger, leaf) {
	console.log('Retrieving XRPL state from ledgers:', ledger, 'to', genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1);
	async function xrplProcessLedger(payloads, currLedger) {
		const command = 'ledger';
		const params = {
			'ledger_index': currLedger,
			'binary': false,
			'full': false,
			'accounts': false,
			'transactions': true,
			'expand': false,
			'owner_funds': false
		};
		return chains.xrp.api.request(command, params)
		.then(response => {
			async function responseIterate(payloads, response) {
				payloads = payloads.concat(response.ledger.transactions);
				if (chains.xrp.api.hasNextPage(response) == true) {
					chains.xrp.api.requestNextPage(command, params, response)
					.then(next_response => {
						responseIterate(payloads, next_response);
					})
					.catch(error => {
						processFailure(error);
					})
				} else if (parseInt(currLedger)+1 < genesisLedger + (claimPeriodIndex+1)*claimPeriodLength) {
					return xrplProcessLedger(payloads, parseInt(currLedger)+1);
				} else {
					if (payloads.length > 0) {
						const leaves = payloads.map(x => keccak256(x));
						const tree = new MerkleTree(leaves, keccak256, {sort: true});
						const root = tree.getHexRoot();
						const proof = tree.getProof(leaf.txHash);
						const verification = tree.verify(proof, leaf.txHash, root);
						console.log('Number of Merkle Tree Leaves:', payloads.length, '\n');
						if (verification == true) {
							const hexProof = tree.getHexProof(leaf.txHash);
							return provePaymentFinality(claimPeriodIndex, hexProof, leaf, root);
						} else {
							return processFailure('Invalid Merkle tree proof.');
						}
					} else {
						return processFailure('payloads.length == 0');
					}
				}	
			}
			responseIterate(payloads, response);
		})
		.catch(error => {
			processFailure(error);
		})
	}
	return xrplProcessLedger(payloads, ledger);
}

async function xrplConfig() {
	let rawConfig = fs.readFileSync('config/config.json');
	config = JSON.parse(rawConfig);
	chains.xrp.api = new RippleAPI({
	  server: config.chains[0].url,
	  timeout: 60000
	});
	web3.setProvider(new web3.providers.HttpProvider(config.flare.url));
	web3.eth.handleRevert = true;
	customCommon = Common.forCustomChain('ropsten',
						{
							name: 'coston',
							networkId: config.flare.chainId,
							chainId: config.flare.chainId,
						},
        				'petersburg',);
	chains.xrp.api.on('connected', () => {
		return run(0);
	})
}

function xrplClaimProcessingCompleted(message) {
	chains.xrp.api.disconnect().catch(processFailure)
	.then(() => {
		console.log(message);
		setTimeout(() => {return process.exit()}, 2500);
	})
}

async function xrplConnectRetry(error) {
	console.log('XRPL connecting...')
	sleep(1000).then(() => {
		chains.xrp.api.connect().catch(xrplConnectRetry);
	})
}

// ===============================================================
// Chain Invariant Functions
// ===============================================================

async function run(chainId) {
	stateConnector.methods.getlatestIndex(parseInt(chainId)).call({
		from: config.account.address,
		gas: config.flare.gas,
		gasPrice: config.flare.gasPrice
	}).catch(processFailure)
	.then(result => {
		return [parseInt(result.genesisLedger), parseInt(result.finalisedClaimPeriodIndex), parseInt(result.claimPeriodLength), 
		parseInt(result.finalisedLedgerIndex)];
	})
	.then(result => {
		if (chainId == 0) {
			chains.xrp.api.getTransaction(txId).catch(processFailure)
			.then(tx => {
				const leafPromise = new Promise((resolve, reject) => {
					var destinationTag;
					if (!("tag" in tx.specification.destination)) {
						destinationTag = '0';
					} else {
						destinationTag = String(tx.specification.destination.tag);
					}
					const amount = String(parseInt(parseFloat(tx.outcome.deliveredAmount.value) / Math.pow(10, -6)));
					console.log('\nchainId: \t\t', '0', '\n',
						'ledger: \t\t', tx.outcome.ledgerVersion, '\n',
						'txId: \t\t\t', tx.id, '\n',
						'source: \t\t', tx.specification.source.address, '\n',
						'destination: \t\t', tx.specification.destination.address, '\n',
						'destinationTag: \t', destinationTag, '\n',
						'amount: \t\t', amount, '\n');
					const chainIdHash = web3.utils.soliditySha3('0');
					const ledgerHash = web3.utils.soliditySha3(tx.outcome.ledgerVersion);
					const txHash = web3.utils.soliditySha3(tx.id);
					const accountsHash = web3.utils.soliditySha3(web3.utils.soliditySha3(tx.specification.source.address, tx.specification.destination.address), destinationTag);
					const amountHash = web3.utils.soliditySha3(amount);
					const leafHash = web3.utils.soliditySha3(chainIdHash, ledgerHash, txHash, accountsHash, amountHash);
					const leaf = {
						"leafHash": 			leafHash,
						"chainId": 				'0',
						"ledger": 				tx.outcome.ledgerVersion,
						"txHash": 				txHash,
						"accountsHash": 		accountsHash,
						"amount": 				amount,
					}
					resolve(leaf);
				})
				leafPromise.then(leaf => {
					if (parseInt(tx.outcome.ledgerVersion) >= result[0] || parseInt(tx.outcome.ledgerVersion) < result[3]) {
						return xrplProcessLedgers([], result[0], parseInt((parseInt(tx.outcome.ledgerVersion)-result[0])/result[2]), result[2], result[0] + parseInt((parseInt(tx.outcome.ledgerVersion)-result[0])/result[2])*result[2], leaf);
					} else {
						return processFailure('Transaction not yet finalised on Flare.')
					}
				})
			})
		} else {
			return processFailure('Invalid chainId.');
		}
	})
}

async function provePaymentFinality(claimPeriodIndex, proof, leaf, root) {
	console.log('Proof: ', proof, '\nLeaf: ', leaf.leafHash, '\nRoot: ', root);
	stateConnector.methods.provePaymentFinality(
					leaf.chainId,
					claimPeriodIndex,
					root,
					leaf.txHash,
					proof).call().catch(processFailure)
	.then(result => {
		if (result == true) {
			return xrplClaimProcessingCompleted('\nPayment verified.');
		} else {
			return xrplClaimProcessingCompleted('\nInvalid payment.');
		}
	});
}

async function initialiseChains() {
	console.log('Initialising chains');
	web3.eth.getTransactionCount(config.account.address)
	.then(nonce => {
		return [stateConnector.methods.initialiseChains().encodeABI(), nonce];
	})
	.then(contractData => {
		var rawTx = {
			nonce: contractData[1],
			gasPrice: web3.utils.toHex(config.flare.gasPrice),
			gas: web3.utils.toHex(config.flare.contractGas),
			chainId: config.flare.chainId,
			from: config.account.address,
			to: stateConnector.options.address,
			data: contractData[0]
		}
		var tx = new Tx(rawTx, {common: customCommon});
		var key = Buffer.from(config.account.privateKey, 'hex');
		tx.sign(key);
		var serializedTx = tx.serialize();
		
		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('receipt', receipt => {
			if (receipt.status == false) {
				return processFailure('receipt.status == false');
			} else {
				console.log("State-connector chains initialised.");
				setTimeout(() => {return run(0)}, 5000);
			}
		})
		.on('error', error => {
			processFailure(error);
		});
	}).catch(processFailure);
}

async function configure(chainId) {
	web3Config().catch(processFailure)
	.then(chainConfig(chainId).catch(processFailure));
}

async function chainConfig(chainId) {
	if (chainId == chains.xrp.chainId) {
		chains.xrp.api = new RippleAPI({
		  server: config.chains[chainId].url,
		  timeout: 60000
		});
		chains.xrp.api.on('connected', () => {
			return run(chainId);
		})
		return chains.xrp.api.connect().catch(xrplConnectRetry);
	} else {
		processFailure('Invalid chainId.');
	}
}

async function web3Config() {
	let rawConfig = fs.readFileSync('config.json');
	config = JSON.parse(rawConfig);
	// console.log(config);
	web3.setProvider(new web3.providers.HttpProvider(config.flare.url));
	web3.eth.handleRevert = true;
	customCommon = Common.forCustomChain('ropsten',
		{
			name: 'coston',
			networkId: config.flare.chainId,
			chainId: config.flare.chainId,
		},
		'petersburg',);
	// Read the compiled contract code
	let source = fs.readFileSync("../contracts/stateConnector.json");
	let contracts = JSON.parse(source)["contracts"];
	// ABI description as JSON structure
	let abi = JSON.parse(contracts['stateConnector.sol:stateConnector'].abi);
	// Create Contract proxy class
	stateConnector = new web3.eth.Contract(abi);
	// Smart contract EVM bytecode as hex
	stateConnector.options.data = '0x' + contracts['stateConnector.sol:stateConnector'].bin;
	stateConnector.options.from = config.account.address;
	stateConnector.options.address = stateConnectorContract;
}


async function processFailure(error) {
	console.error('error:', error);
	setTimeout(() => {return process.exit()}, 2500);
}

async function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

const chainName = process.argv[2];
const txId = process.argv[3];
if (chainName in chains) {
	return configure(chains[chainName].chainId);
} else {
	processFailure('Invalid chainName');
}