'use strict';
process.env.NODE_ENV = 'production';
const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const request = require('request');
const fs = require('fs');
const express = require('express');
const app = express();
const { MerkleTree } = require('merkletreejs');
const SHA256 = require('crypto-js/sha256');

const minFee = 1;
var config;
var customCommon;
var xrplAPI;
var stateConnector;
var n;
var claimsInProgress = false;

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

async function registerClaimPeriod(ledger, claimPeriodIndex, claimPeriodHash) {
	stateConnector.methods.checkIfRegistered(
					ledger,
					claimPeriodIndex,
					claimPeriodHash).call({
		from: config.stateConnectors[n].F.address,
		gas: config.evm.gas,
		gasPrice: config.evm.gasPrice
	}).catch(processFailure)
	.then(result => {
		console.log('Claim period:\t\t\x1b[33m', claimPeriodIndex, '\x1b[0m\nclaimPeriodHash:\t\x1b[33m', claimPeriodHash, '\x1b[0m');
		if (result == true) {
			console.log('Deferring until peers catch up.');
			return setTimeout(() => {return run()}, getRandomInt(5000,10000));
		} else {
			web3.eth.getTransactionCount(config.stateConnectors[n].F.address)
			.then(nonce => {
				return [stateConnector.methods.registerClaimPeriod(
							ledger,
							claimPeriodIndex,
							claimPeriodHash).encodeABI(), nonce];
			})
			.then(txData => {
				var rawTx = {
					nonce: txData[1],
					gasPrice: web3.utils.toHex(parseInt(config.evm.gasPrice)),
					gas: web3.utils.toHex(config.evm.gas),
					to: stateConnector.options.address,
					from: config.stateConnectors[n].F.address,
					data: txData[0]
				};
				var tx = new Tx(rawTx, {common: customCommon});
				var key = Buffer.from(config.stateConnectors[n].F.privateKey, 'hex');
				tx.sign(key);
				var serializedTx = tx.serialize();
				const txHash = web3.utils.sha3(serializedTx);

				console.log('Delivering transaction:\t\x1b[33m', txHash, '\x1b[0m');
				return web3.eth.getTransaction(txHash)
				.then(txResult => {
					if (txResult == null) {
						web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
						.on('receipt', receipt => {
							if (receipt.status == false) {
								return processFailure('receipt.status == false');
							} else {
								console.log('Transaction finalised:\t \x1b[33m' + receipt.transactionHash + '\x1b[0m');
								return setTimeout(() => {return run()}, getRandomInt(5000,10000));
							}
						})
						.on('error', error => {
							return processFailure(error);
						});
					} else {
						return processFailure('txResult != null');
					}
				})
			})
		}
	})
}

async function run() {
	console.log('\n\x1b[34mState Connector System connected at', Date(Date.now()).toString(), '\x1b[0m' );
	stateConnector.methods.getlatestIndex().call({
		from: config.stateConnectors[n].F.address,
		gas: config.evm.gas,
		gasPrice: config.evm.gasPrice
	}).catch(processFailure)
	.then(result => {
		return [parseInt(result._genesisLedger), parseInt(result._claimPeriodIndex), parseInt(result._claimPeriodLength),
		parseInt(result._ledger), result._coinbase, result._UNL];
	})
	.then(result => {
		xrplAPI.getLedgerVersion().catch(processFailure)
		.then(sampledLedger => {
			console.log("Finalised claim period:\t\x1b[33m", result[1]-1, 
				"\n\x1b[0mLast processed ledger:\t\x1b[33m", result[3], '\n\x1b[0mCurrent sampled ledger:\t\x1b[33m', sampledLedger);
			console.log("\x1b[0mCoinbase address:\t\x1b[33m", result[4], '\x1b[0m');
			console.log("\x1b[0mContract-layer UNL:\n", result[5], '\x1b[0m');
			if (sampledLedger > result[0] + (result[1]+1)*result[2]) {
				return processLedgers([], result[0], result[1], result[2], result[3]);
			} else {
				return claimProcessingCompleted('Reached edge of the XRPL state, waiting for new ledgers.');
			}
		})
	})
}

async function processLedgers(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger) {
	console.log('\nRetrieving XRPL state from ledgers:', ledger, 'to', genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1);
	const command = 'account_tx';
	const params = {
		'account': config.contract.signal,
		'ledger_index_min': ledger,
		'ledger_index_max': genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1,
		'binary': false,
		'forward': true
	};

	return xrplAPI.request(command, params)
	.then(response => {
		async function responseIterate(response) {
			async function transactionIterate(item, i, numTransactions) {
				if (item.meta.TransactionResult != 'tesSUCCESS') {
					console.error("ErrorCode001 - Unsuccessful transaction (Pointer): ", item.tx.hash);
					if (i+1 < numTransactions) {
						return transactionIterate(response.transactions[i+1], i+1, numTransactions);
					} else {
						return checkResponseCompletion(response);
					}
				} else if (item.tx.TransactionType != 'Payment') {
					console.error("ErrorCode002 - Invalid transaction type (Pointer): ", item.tx.hash);
					if (i+1 < numTransactions) {
						return transactionIterate(response.transactions[i+1], i+1, numTransactions);
					} else {
						return checkResponseCompletion(response);
					}
				} else if (item.tx.Amount < minFee) {
					console.error("ErrorCode003 - Invalid payment amount (Pointer): ", item.tx.hash);
					if (i+1 < numTransactions) {
						return transactionIterate(response.transactions[i+1], i+1, numTransactions);
					} else {
						return checkResponseCompletion(response);
					}
				} else if (!("Memos" in item.tx)) {
					console.error("ErrorCode004 - No memo (Pointer): ", item.tx.hash);
					if (i+1 < numTransactions) {
						return transactionIterate(response.transactions[i+1], i+1, numTransactions);
					} else {
						return checkResponseCompletion(response);
					}
				} else if (!("MemoData" in item.tx.Memos[0].Memo)) {
					console.error("ErrorCode005 - Invalid memo data type (Pointer): ", item.tx.hash);
					if (i+1 < numTransactions) {
						return transactionIterate(response.transactions[i+1], i+1, numTransactions);
					} else {
						return checkResponseCompletion(response);
					}
				} else {
					// Memo is a tx hash pointing to another transaction -> take that transaction's details
					const memo = Buffer.from(item.tx.Memos[0].Memo.MemoData, "hex").toString("utf-8");
					if (web3.utils.isHex(memo) == true && memo.length == 64) {
						xrplAPI.getTransaction(memo).then(tx => {
							async function processPayload(tx) {
								if (tx.outcome.result != 'tesSUCCESS') {
									console.error("ErrorCode008 - Unsuccessful transaction (Payload): ", tx.id);
									if (i+1 < numTransactions) {
										return transactionIterate(response.transactions[i+1], i+1, numTransactions);
									} else {
										return checkResponseCompletion(response);
									}
								} else if (tx.type != 'payment') {
									console.error("ErrorCode009 - Invalid transaction type (Payload): ", tx.id);
									if (i+1 < numTransactions) {
										return transactionIterate(response.transactions[i+1], i+1, numTransactions);
									} else {
										return checkResponseCompletion(response);
									}
								} else if (!("memos" in tx.specification)) {
									console.error("ErrorCode010 - No memo (Payload): ", tx.id);
									if (i+1 < numTransactions) {
										return transactionIterate(response.transactions[i+1], i+1, numTransactions);
									} else {
										return checkResponseCompletion(response);
									}
								} else if (!("data" in tx.specification.memos[0])) {
									console.error("ErrorCode011 - Invalid memo data type (Payload): ", tx.id);
									if (i+1 < numTransactions) {
										return transactionIterate(response.transactions[i+1], i+1, numTransactions);
									} else {
										return checkResponseCompletion(response);
									}
								} else {
									if (web3.utils.isHexStrict(tx.specification.memos[0].data) == true && tx.specification.memos[0].data.length == 66) {
										const prevLength = payloads.length;
										const payloadPromise = new Promise((resolve, reject) => {
											const value = parseFloat(tx.outcome.deliveredAmount.value) / Math.pow(10, -6);
											const newPayload = web3.utils.soliditySha3(
												web3.utils.soliditySha3('ledger', tx.outcome.ledgerVersion),
												web3.utils.soliditySha3('indexInLedger', tx.outcome.indexInLedger),
												web3.utils.soliditySha3('txId', tx.id),
												web3.utils.soliditySha3('source', tx.specification.source.address),
												web3.utils.soliditySha3('destination', tx.specification.destination.address),
												web3.utils.soliditySha3('currency', tx.outcome.deliveredAmount.currency),
												web3.utils.soliditySha3('value', value),
												web3.utils.soliditySha3('memo', tx.specification.memos[0].data));
											// return console.log('ledger: ', tx.outcome.ledgerVersion, '\n',
											// 			'indexInLedger: ', tx.outcome.indexInLedger, '\n',
											// 			'txId: ', tx.id, '\n',
											// 			'source: ', tx.specification.source.address, '\n',
											// 			'destination: ', tx.specification.destination.address, '\n',
											// 			'currency: ', tx.outcome.deliveredAmount.currency, '\n',
											// 			'value: ', value, '\n',
											// 			'memo: ', tx.specification.memos[0].data, '\n');
											payloads[payloads.length] = newPayload;
											const currLength = payloads.length;
											resolve(currLength);
										})

										return await payloadPromise.then(currLength => {
											if (currLength == prevLength + 1) {
												if (i+1 < numTransactions) {
													return transactionIterate(response.transactions[i+1], i+1, numTransactions);
												} else {
													return checkResponseCompletion(response);
												}
											} else {
												return processFailure("ErrorCode015 - Unable to append payload:", tx.id);
											}
										}).catch(err => {
											return processFailure("ErrorCode014 - Unable to intepret payload:", tx.id);
										})
									} else {
										console.error("ErrorCode012 - Memo not a correctly formatted and pre-fixed bytes32 hash (Payload): ", tx.specification.memos[0].data);
										if (i+1 < numTransactions) {
											return transactionIterate(response.transactions[i+1], i+1, numTransactions);
										} else {
											return checkResponseCompletion(response);
										}
									}
								}
							}
							return processPayload(tx);
						}).catch((error) => {
							const errorMessage = EvalError(error);
							if (errorMessage.message == '[DisconnectedError(websocket was closed)]') {
								processFailure("ErrorCode007 - ", error, ": ", memo);
							} else {
								console.error("ErrorCode013 - ", error, ": ", memo);
								if (i+1 < numTransactions) {
									return transactionIterate(response.transactions[i+1], i+1, numTransactions);
								} else {
									return checkResponseCompletion(response);
								}
							}
						})
					} else {
						console.error("ErrorCode006 - Memo not a correctly formatted bytes32 hash (Pointer): ", memo);
						if (i+1 < numTransactions) {
							return transactionIterate(response.transactions[i+1], i+1, numTransactions);
						} else {
							return checkResponseCompletion(response);
						}
					}
				}
			}
			async function checkResponseCompletion(response) {
				if (xrplAPI.hasNextPage(response) == true) {
					xrplAPI.requestNextPage(command, params, response)
					.then(next_response => {
						responseIterate(next_response);
					})
				} else {
					const leaves = payloads.map(x => SHA256(x))
					const tree = new MerkleTree(leaves, SHA256);
					const root = tree.getRoot().toString('hex');
					console.log('Num Payloads:\t\t', payloads.length);
					const claimPeriodHash = web3.utils.soliditySha3(ledger, 'flare', claimPeriodIndex, '0x'+root);
					return registerClaimPeriod(genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, claimPeriodIndex, claimPeriodHash);
				}
			}
			const numTransactions = response.transactions.length;
			if (numTransactions > 0) {
				return transactionIterate(response.transactions[0], 0, numTransactions);
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

async function config(stateConnector) {
	let rawConfig = fs.readFileSync('config/config.json');
	config = JSON.parse(rawConfig);
	n = stateConnector;
	if (n > config.stateConnectors.length) {
		return processFailure('n > config.stateConnectors.length');
	}
	xrplAPI = new RippleAPI({
	  server: config.stateConnectors[n].X.url,
	  timeout: 60000
	});

	web3.setProvider(new web3.providers.HttpProvider(config.stateConnectors[n].F.url));
	web3.eth.handleRevert = true;
	customCommon = Common.forCustomChain('ropsten',
						{
							name: 'coston',
							networkId: config.evm.chainId,
							chainId: config.evm.chainId,
						},
        				'petersburg',);

	xrplAPI.on('connected', () => {
		return run();
	})
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
	stateConnector.options.from = config.stateConnectors[n].F.address;
	stateConnector.options.address = config.contract.address;
}

async function processFailure(error) {
	console.error('error:', error);
	setTimeout(() => {return process.exit()}, getRandomInt(2500,5000));
}

async function updateClaimsInProgress(status) {
	claimsInProgress = status;
	return claimsInProgress;
}

function claimProcessingCompleted(message) {
	xrplAPI.disconnect().catch(processFailure)
	.then(() => {
		console.log(message);
		setTimeout(() => {return process.exit()}, getRandomInt(2500,5000));
	})
}

async function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function xrplConnectRetry(error) {
	console.log('XRPL connecting...')
	sleep(1000).then(() => {
		xrplAPI.connect().catch(xrplConnectRetry);
	})
}

app.get('/stateConnector', (req, res) => {
	setTimeout(() => {return processFailure("Request timed out after 5 minutes.")}, 300000);
	if (claimsInProgress == true) {
		res.status(200).send('Claims already being processed.').end();
	} else {
		updateClaimsInProgress(true)
		.then(result => {
			if (result == true) {
				res.status(200).send('State Connector initiated.').end();
				config(parseInt(process.argv[2])).catch(processFailure)
				.then(() => {
					return contract().catch(processFailure);
				})
				.then(() => {
					return xrplAPI.connect().catch(xrplConnectRetry);
				})
			} else {
				return processFailure('Error updating claimsInProgress.');
			}
		})
	}
});
// Start the server
const PORT = process.env.PORT || 8080+parseInt(process.argv[2]);
app.listen(PORT, () => {
});

module.exports = app;



