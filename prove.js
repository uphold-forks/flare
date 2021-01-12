'use strict';
process.env.NODE_ENV = 'production';
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const request = require('request');
const fs = require('fs');
const express = require('express');
const app = express();
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

const minFee = 1;
var config;
var customCommon;
var chainAPI;
var stateConnector;
var claimsInProgress = false;

// ===============================================================
// XRPL Specific Functions
// ===============================================================

const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');

async function xrplProcessLedgers(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger, leaf) {
	console.log('Retrieving XRPL state from ledgers:\t', ledger, 'to', genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1);
	async function xrplProcessLedger(currLedger) {
		const command = 'ledger';
		const params = {
			'ledger_index': currLedger,
			'binary': false,
			'full': false,
			'accounts': false,
			'transactions': true,
			'expand': true,
			'owner_funds': false
		};
		return chainAPI.request(command, params)
		.then(response => {
			async function responseIterate(response) {
				async function transactionIterate(item, i, numTransactions) {
					if (item.TransactionType == 'Payment' && typeof item.Amount == 'string' && item.metaData.TransactionResult == 'tesSUCCESS') {
						const prevLength = payloads.length;
						const payloadPromise = new Promise((resolve, reject) => {
							var destinationTag;
							if (!("DestinationTag" in item)) {
								destinationTag = 0;
							} else {
								destinationTag = item.DestinationTag;
							}
							stateConnector.methods.constructLeaf(
									'0',
									response.ledger.seqNum,
									item.hash,
									item.Account,
									item.Destination,
									destinationTag,
									item.metaData.delivered_amount).call({
								from: config.stateConnector.address,
								gas: config.flare.gas,
								gasPrice: config.flare.gasPrice})
							.then(result => {
								resolve(result);
							});
						})
						return await payloadPromise.then(newPayload => {
							payloads[payloads.length] = newPayload;
							if (payloads.length == prevLength + 1) {
								if (i+1 < numTransactions) {
									return transactionIterate(response.ledger.transactions[i+1], i+1, numTransactions);
								} else {
									return checkResponseCompletion(response);
								}
							} else {
								return processFailure("Unable to append payload:", item.hash);
							}
						}).catch(err => {
							return processFailure("Unable to intepret payload:", err, item.hash);
						})
					} else {
						if (i+1 < numTransactions) {
							return transactionIterate(response.ledger.transactions[i+1], i+1, numTransactions);
						} else {
							return checkResponseCompletion(response);
						}
					}
				}
				async function checkResponseCompletion(response) {
					if (chainAPI.hasNextPage(response) == true) {
						chainAPI.requestNextPage(command, params, response)
						.then(next_response => {
							responseIterate(next_response);
						})
					} else if (parseInt(currLedger)+1 < genesisLedger + (claimPeriodIndex+1)*claimPeriodLength) {
						return xrplProcessLedger(parseInt(currLedger)+1);
					} else {
						if (payloads.length > 0) {
							const tree = new MerkleTree(payloads, keccak256, {sort: true});
							const root = tree.getHexRoot();
							const proof = tree.getProof(leaf.leafHash);
							const verification = tree.verify(proof, leaf.leafHash, root);
							console.log('\nNumber of Merkle Tree Leaves:\t\t', payloads.length);
							if (verification == true) {
								const hexProof = tree.getHexProof(leaf.leafHash);
								return provePaymentFinality(claimPeriodIndex, hexProof, leaf, root);
							} else {
								return processFailure('Invalid Merkle tree proof.');
							}
						} else {
							return processFailure('payloads.length == 0');
						}
					}
				}
				if (response.ledger.transactions.length > 0) {
					return transactionIterate(response.ledger.transactions[0], 0, response.ledger.transactions.length);
				} else {
					return checkResponseCompletion(response);
				}
			}
			responseIterate(response);
		})
		.catch(error => {
			processFailure(error);
		})
	}
	return xrplProcessLedger(ledger);
}

async function xrplConfig() {
	let rawConfig = fs.readFileSync('config/config.json');
	config = JSON.parse(rawConfig);
	chainAPI = new RippleAPI({
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
	chainAPI.on('connected', () => {
		return run(0);
	})
}

function xrplClaimProcessingCompleted(message) {
	chainAPI.disconnect().catch(processFailure)
	.then(() => {
		console.log(message);
		setTimeout(() => {return process.exit()}, 2500);
	})
}

async function xrplConnectRetry(error) {
	console.log('XRPL connecting...')
	sleep(1000).then(() => {
		chainAPI.connect().catch(xrplConnectRetry);
	})
}

// ===============================================================
// Chain Invariant Functions
// ===============================================================

async function run(chainId) {
	stateConnector.methods.getlatestIndex(parseInt(chainId)).call({
		from: config.stateConnector.address,
		gas: config.flare.gas,
		gasPrice: config.flare.gasPrice
	}).catch(processFailure)
	.then(result => {
		return [parseInt(result.genesisLedger), parseInt(result.finalisedClaimPeriodIndex), parseInt(result.claimPeriodLength), 
		parseInt(result.finalisedLedgerIndex)];
	})
	.then(result => {
		if (chainId == 0) {
			chainAPI.getTransaction(txId).catch(processFailure)
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
					stateConnector.methods.constructLeaf(
							'0',
							tx.outcome.ledgerVersion,
							tx.id,
							tx.specification.source.address,
							tx.specification.destination.address,
							destinationTag,
							amount).call({
						from: config.stateConnector.address,
						gas: config.flare.gas,
						gasPrice: config.flare.gasPrice})
					.then(result => {
						const leaf = {
							"leafHash": 			result,
							"chainId": 				'0',
							"ledger": 				tx.outcome.ledgerVersion,
							"txId": 				tx.id,
							"source": 				tx.specification.source.address,
							"destination": 			tx.specification.destination.address,
							"destinationTag": 		destinationTag,
							"amount": 				amount,
						}
						resolve(leaf);
					})
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
					leaf.ledger,
					leaf.txId,
					leaf.source,
					leaf.destination,
					leaf.destinationTag,
					leaf.amount,
					root,
					web3.utils.toHex(leaf.leafHash),
					proof).call({
		from: config.stateConnector.address,
		gas: config.flare.gas,
		gasPrice: config.flare.gasPrice})
	.then(result => {
		if (result == true) {
			return xrplClaimProcessingCompleted('\nPayment verified.\n');
		} else {
			return xrplClaimProcessingCompleted('\nInvalid payment.\n');
		}
	});
}

async function contract() {
	// Read the compiled contract code
	let source = fs.readFileSync("solidity/stateConnector.json");
	let contracts = JSON.parse(source)["contracts"];
	// ABI description as JSON structure
	let abi = JSON.parse(contracts['stateConnector.sol:stateConnector'].abi);
	// Create Contract proxy class
	stateConnector = new web3.eth.Contract(abi);
	// Smart contract EVM bytecode as hex
	stateConnector.options.data = '0x' + contracts['stateConnector.sol:stateConnector'].bin;
	stateConnector.options.from = config.stateConnector.address;
	stateConnector.options.address = config.stateConnector.contract;
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

const chainId = parseInt(process.argv[2]);
const txId = process.argv[3];
if (chainId == 0) {
	xrplConfig().catch(processFailure)
	.then(() => {
		return contract().catch(processFailure);
	})
	.then(() => {
		return chainAPI.connect().catch(xrplConnectRetry);
	})
} else {
	processFailure('Invalid chainId');
}