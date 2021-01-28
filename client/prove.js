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
						const proof = tree.getProof(leaf.txId);
						const verification = tree.verify(proof, leaf.txId, root);
						console.log('Number of Merkle Tree Leaves:', payloads.length, '\n');
						if (verification == true) {
							const hexProof = tree.getHexProof(leaf.txId);
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
		from: config.accounts[1].address,
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
				if (tx.type == 'payment') {
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
						const txId = web3.utils.soliditySha3(tx.id);
						const accountsHash = web3.utils.soliditySha3(web3.utils.soliditySha3(tx.specification.source.address, tx.specification.destination.address), destinationTag);
						const amountHash = web3.utils.soliditySha3(amount);
						const paymentHash = web3.utils.soliditySha3(chainIdHash, ledgerHash, txId, accountsHash, amountHash);
						const leaf = {
							"chainId": 				'0',
							"txId": 				txId,
							"paymentHash": 			paymentHash,
						}
						resolve(leaf);
					})
					leafPromise.then(leaf => {
						if (parseInt(tx.outcome.ledgerVersion) >= result[0] || parseInt(tx.outcome.ledgerVersion) < result[3]) {
							stateConnector.methods.getPaymentFinality(
											leaf.txId,
											leaf.paymentHash).call({
								from: config.accounts[1].address,
								gas: config.flare.gas,
								gasPrice: config.flare.gasPrice
							}).catch(() => {
								return xrplProcessLedgers([], result[0], parseInt((parseInt(tx.outcome.ledgerVersion)-result[0])/result[2]), result[2], result[0] + parseInt((parseInt(tx.outcome.ledgerVersion)-result[0])/result[2])*result[2], leaf);
							})
							.then(result => {
								if (result == true) {
									return xrplClaimProcessingCompleted('Payment already proven.');
								} 
							})
						} else {
							return processFailure('Transaction not yet finalised on Flare.')
						}
					})
				} else {
					return xrplClaimProcessingCompleted('Transaction type not yet supported on Flare.');
				}
			})
		} else {
			return processFailure('Invalid chainId.');
		}
	})
}

async function provePaymentFinality(claimPeriodIndex, proof, leaf, root) {
	console.log('Proof: ', proof, '\nLeaf: ', leaf, '\nRoot: ', root);
	web3.eth.getTransactionCount(config.accounts[1].address)
	.then(nonce => {
		return [stateConnector.methods.provePaymentFinality(
					leaf.chainId,
					claimPeriodIndex,
					root,
					leaf.txId,
					leaf.paymentHash,
					proof).encodeABI(), nonce];
	})
	.then(txData => {
		var rawTx = {
			nonce: txData[1],
			gasPrice: web3.utils.toHex(parseInt(config.flare.gasPrice)),
			gas: web3.utils.toHex(config.flare.gas),
			to: stateConnector.options.address,
			from: config.accounts[1].address,
			data: txData[0]
		};
		var tx = new Tx(rawTx, {common: customCommon});
		var key = Buffer.from(config.accounts[1].privateKey, 'hex');
		tx.sign(key);
		var serializedTx = tx.serialize();
		const txHash = web3.utils.sha3(serializedTx);
		console.log('Delivering transaction:\t\x1b[33m', txHash, '\x1b[0m');
		web3.eth.getTransaction(txHash)
		.then(txResult => {
			if (txResult == null) {
				web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
				.on('receipt', receipt => {
					if (receipt.status == false) {
						return processFailure('receipt.status == false');
					} else {
						console.log('Transaction delivered:\t \x1b[33m' + receipt.transactionHash + '\x1b[0m');
						async function getPaymentFinality() {
							return setTimeout(() => {
								stateConnector.methods.getPaymentFinality(
												leaf.txId,
												leaf.paymentHash).call({
									from: config.accounts[1].address,
									gas: config.flare.gas,
									gasPrice: config.flare.gasPrice
								}).catch(getPaymentFinality)
								.then(result => {
									if (result.finality == true) {
										return xrplClaimProcessingCompleted('Payment proven.');
									}
								})
							}, 5000)
						}
						return getPaymentFinality();
					}
				})
				.on('error', error => {
					return processFailure(error);
				});
			} else {
				return processFailure('Already waiting for this transaction to be delivered.');
			}
		})
	})
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
	stateConnector.options.from = config.accounts[1].address;
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