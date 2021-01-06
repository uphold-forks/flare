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
const SHA256 = require('crypto-js/sha256');

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

async function xrplProcessLedgers(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger, registrationFee) {
	console.log('\nRetrieving XRPL state from ledgers:', ledger, 'to', genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1);
	const command = 'account_tx';
	const params = {
		'account': config.chains[0].signal,
		'ledger_index_min': ledger,
		'ledger_index_max': genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1,
		'binary': false,
		'forward': true
	};

	return chainAPI.request(command, params)
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
						chainAPI.getTransaction(memo).then(tx => {
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
											const newPayload = SHA256(
												web3.utils.soliditySha3('chainId', 0),
												web3.utils.soliditySha3('ledger', tx.outcome.ledgerVersion),
												web3.utils.soliditySha3('indexInLedger', tx.outcome.indexInLedger),
												web3.utils.soliditySha3('txId', tx.id),
												web3.utils.soliditySha3('source', tx.specification.source.address),
												web3.utils.soliditySha3('destination', tx.specification.destination.address),
												web3.utils.soliditySha3('currency', tx.outcome.deliveredAmount.currency),
												web3.utils.soliditySha3('value', value),
												web3.utils.soliditySha3('memo', tx.specification.memos[0].data));
											console.log('chainId: ', 0, '\n',
												'ledger: ', tx.outcome.ledgerVersion, '\n',
												'indexInLedger: ', tx.outcome.indexInLedger, '\n',
												'txId: ', tx.id, '\n',
												'source: ', tx.specification.source.address, '\n',
												'destination: ', tx.specification.destination.address, '\n',
												'currency: ', tx.outcome.deliveredAmount.currency, '\n',
												'value: ', value, '\n',
												'memo: ', tx.specification.memos[0].data, '\n');
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
											return processFailure("ErrorCode014 - Unable to intepret payload:", err, tx.id);
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
				if (chainAPI.hasNextPage(response) == true) {
					chainAPI.requestNextPage(command, params, response)
					.then(next_response => {
						responseIterate(next_response);
					})
				} else {
					var root;
					if (payloads.length > 0) {
						const tree = new MerkleTree(payloads, SHA256, {sort: true});
						root = tree.getHexRoot();
					} else {
						root = "0x0000000000000000000000000000000000000000000000000000000000000000";
					}
					console.log('Num Payloads:\t\t', payloads.length);
					return registerClaimPeriod(0, genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, claimPeriodIndex, root, registrationFee);
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
	console.log('\n\x1b[34mState Connector System connected at', Date(Date.now()).toString(), '\x1b[0m' );
	stateConnector.methods.getlatestIndex(parseInt(chainId)).call({
		from: config.stateConnector.address,
		gas: config.flare.gas,
		gasPrice: config.flare.gasPrice
	}).catch(processFailure)
	.then(result => {
		return [parseInt(result.genesisLedger), parseInt(result.finalisedClaimPeriodIndex), parseInt(result.claimPeriodLength), 
		parseInt(result.finalisedLedgerIndex), parseInt(result._registrationFee)];
	})
	.then(result => {
		chainAPI.getLedgerVersion().catch(processFailure)
		.then(sampledLedger => {
			console.log("Finalised claim period:\t\x1b[33m", result[1]-1, 
				"\n\x1b[0mFinalised Ledger Index:\t\x1b[33m", result[3], '\n\x1b[0mCurrent Ledger Index:\t\x1b[33m', sampledLedger);
			if (sampledLedger > result[0] + (result[1]+1)*result[2]) {
				if (chainId == 0) {
					return xrplProcessLedgers([], result[0], result[1], result[2], result[3], result[4]);
				} else {
					return processFailure('Invalid chainId.')
				}
			} else {
				return xrplClaimProcessingCompleted('Reached latest state, waiting for new ledgers.');
			}
		})
	})
}

async function registerClaimPeriod(chainId, ledger, claimPeriodIndex, claimPeriodHash, registrationFee) {
	stateConnector.methods.checkFinality(
					parseInt(chainId),
					ledger,
					claimPeriodIndex).call({
		from: config.stateConnector.address,
		gas: config.flare.gas,
		gasPrice: config.flare.gasPrice
	}).catch(processFailure)
	.then(result => {
		console.log('Claim period:\t\t\x1b[33m', claimPeriodIndex, '\x1b[0m\nclaimPeriodHash:\t\x1b[33m', claimPeriodHash, '\x1b[0m');
		if (result == true) {
			if (chainId == 0) {
				return xrplClaimProcessingCompleted('Latest claim period already registered, waiting for new ledgers.');
			} else {
				return processFailure('Invalid chainId.');
			}
		} else {
			web3.eth.getTransactionCount(config.stateConnector.address)
			.then(nonce => {
				return [stateConnector.methods.registerClaimPeriod(
							chainId,
							ledger,
							claimPeriodIndex,
							claimPeriodHash).encodeABI(), nonce];
			})
			.then(txData => {
				var rawTx = {
					nonce: txData[1],
					gasPrice: web3.utils.toHex(parseInt(config.flare.gasPrice)),
					gas: web3.utils.toHex(config.flare.gas),
					to: stateConnector.options.address,
					from: config.stateConnector.address,
					value: parseInt(registrationFee),
					data: txData[0]
				};
				var tx = new Tx(rawTx, {common: customCommon});
				var key = Buffer.from(config.stateConnector.privateKey, 'hex');
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
								return setTimeout(() => {return run(0)}, 5000);
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

async function updateClaimsInProgress(status) {
	claimsInProgress = status;
	return claimsInProgress;
}

async function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
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
				const chainId = parseInt(process.argv[2]);
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