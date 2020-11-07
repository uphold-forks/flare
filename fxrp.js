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

const xrpAmount = 1;
const MAX_PAYLOAD_TX_SIZE = 1;
const MAX_RUNS = 1000;

var config;
var customCommon;
var xrplAPI;
var fxrp;
var n;

var claimsInProgress = false;
var globalNonce = 0;
var globalGasPriceMultiplier = 1;
var numRuns = 0;
var firstRun = false;

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

// async function registerPayloads(claimPeriodIndex, ledger, payloads, partialRegistration, agent, payloadSkipIndex) {
// 	console.log('\n');
// 	console.log('Claim period:\t\t\x1b[33m', claimPeriodIndex, '\x1b[0m\nPayload Skip Index:\t\x1b[33m', payloadSkipIndex, '\x1b[0m\nPartial Registration:\t\x1b[33m', partialRegistration, '\x1b[0m');
// 	web3.eth.getTransactionCount(config.stateConnectors[n].F.address)
// 	.then(nonce => {
// 		if (firstRun == false) {
// 			globalNonce = nonce;
// 			firstRun = true;
// 		} else {
// 			nonce = globalNonce;
// 		}
// 		return [fxrp.methods.registerPayloads(
// 					claimPeriodIndex,
// 					ledger,
// 					payloads.ledger,
// 					payloads.txHash,
// 					payloads.sender,
// 					payloads.receiver,
// 					payloads.amount,
// 					payloads.memo,
// 					partialRegistration,
// 					agent,
// 					payloadSkipIndex
//         		).encodeABI(), nonce];
// 	})
// 	.then(txData => {
// 		var rawTx = {
// 			nonce: txData[1],
// 			gasPrice: web3.utils.toHex(parseInt(config.evm.gasPrice)*globalGasPriceMultiplier),
// 			gas: web3.utils.toHex(config.evm.gas),
// 			to: fxrp.options.address,
// 			from: config.stateConnectors[n].F.address,
// 			data: txData[0]
// 		};
// 		var tx = new Tx(rawTx, {common: customCommon});
// 		var key = Buffer.from(config.stateConnectors[n].F.privateKey, 'hex');
// 		tx.sign(key);
// 		var serializedTx = tx.serialize();

// 		const txHash = web3.utils.sha3(serializedTx);
// 		console.log('Delivering payloads:\t\x1b[33m', txHash, '\x1b[0m');
// 		return web3.eth.getTransaction(txHash)
// 		.then(txResult => {
// 			if (txResult == null) {
// 				web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
// 				.on('receipt', receipt => {
// 					if (receipt.status == false) {
// 						return processFailure('receipt.status == false');
// 					} else {
// 						console.log('Payloads registered:\t\x1b[33m', receipt.transactionHash, '\x1b[0m');	
// 						globalNonce = globalNonce + 1;
// 						var delay = getRandomInt(7500,12500);
// 						console.log('Continuing in:\t\t', delay, '\x1b[33mmilliseconds\x1b[0m')
// 						setTimeout(() => {return run()}, delay);
// 					}
// 				})
// 				.on('error', error => {
// 					return processFailure(error);
// 				});
// 			} else {
// 				return processFailure('txResult != null');
// 			}
// 		})
// 	})
// }

async function registerClaimPeriod(ledger, claimPeriodIndex, claimPeriodHash) {
	console.log('\nClaim period:\t\t\x1b[33m', claimPeriodIndex, '\x1b[0m\nclaimPeriodHash:\t\x1b[33m', claimPeriodHash, '\x1b[0m');
	web3.eth.getTransactionCount(config.stateConnectors[n].F.address)
	.then(nonce => {
		if (firstRun == false) {
			globalNonce = nonce;
			firstRun = true;
		} else {
			nonce = globalNonce;
		}
		return [fxrp.methods.registerClaimPeriod(
					ledger,
					claimPeriodIndex,
					claimPeriodHash
        		).encodeABI(), nonce];
	})
	.then(txData => {
		var rawTx = {
			nonce: txData[1],
			gasPrice: web3.utils.toHex(parseInt(config.evm.gasPrice)*globalGasPriceMultiplier),
			gas: web3.utils.toHex(config.evm.gas),
			to: fxrp.options.address,
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
						console.log('Transaction finalised:\t\x1b[33m', receipt.transactionHash, '\x1b[0m');	
						globalNonce = globalNonce + 1;
						var delay = getRandomInt(7500,12500);
						console.log('Continuing in:\t\t', delay, '\x1b[33mmilliseconds\x1b[0m')
						setTimeout(() => {return run()}, delay);
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

async function run() {
	numRuns = numRuns + 1;
	if (numRuns > MAX_RUNS) {
		return claimProcessingCompleted('Starting new state connector instance...');
	} else {
		console.log('\n\x1b[34mState Connector System connected at', Date(Date.now()).toString(), '\x1b[0m' );
		fxrp.methods.getlatestIndex().call({
			from: config.stateConnectors[n].F.address,
			gas: config.evm.gas,
			gasPrice: config.evm.gasPrice
		}).catch(processFailure)
		.then(result => {
			return [parseInt(result._genesisLedger), parseInt(result._claimPeriodIndex), parseInt(result._claimPeriodLength),
			parseInt(result._ledger), result._coinbase, result._UNL, parseInt(result._finalisedClaimPeriodIndex)];
		})
		.then(result => {
			xrplAPI.getLedgerVersion().catch(processFailure)
			.then(sampledLedger => {
				console.log("Finalised claim period:\t\x1b[33m", result[6], "\n\x1b[0mLocal claim period:\t\x1b[33m", result[1], 
					"\n\x1b[0mLast processed ledger:\t\x1b[33m", result[3], '\n\x1b[0mCurrent sampled ledger:\t\x1b[33m', sampledLedger);
				console.log("\x1b[0mCoinbase address:\t\x1b[33m", result[4], '\x1b[0m');
				console.log("\x1b[0mContract-layer UNL:\n", result[5], '\x1b[0m');
				if (sampledLedger > result[0] + (result[1]+1)*result[2]) {
					return processLedgers({
							ledger: 	[],
							txHash: 	[],
							sender: 	[],
							receiver: 	[],
							amount: 	[],
							memo: 		[]
						},
						result[0], result[1], result[2], result[3]);
				} else {
					return claimProcessingCompleted('Claim period processing complete, waiting for a new claim period...');
				}
			})
		})
	}	
}

async function processLedgers(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger) {
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
			for (const item of response.transactions) {  
				if (item.meta.TransactionResult != 'tesSUCCESS') {
					console.error("ErrorCode001 - Unsuccessful transaction: ", item.tx.hash);
					continue;
				} else if (item.tx.TransactionType != 'Payment') {
					console.error("ErrorCode002 - Invalid transaction type: ", item.tx.hash);
					continue;
				} else if (item.tx.Amount < xrpAmount) {
					console.error("ErrorCode003 - Invalid payment amount: ", item.tx.hash);
					continue;
				} else if (!("Memos" in item.tx)){
					console.error("ErrorCode004 - No memo: ", item.tx.hash);
					continue;
				} else if (!("MemoData" in item.tx.Memos[0].Memo)) {
					console.error("ErrorCode005 - Invalid memo: ", item.tx.hash);
					continue;
				} else {
					const memo = Buffer.from(item.tx.Memos[0].Memo.MemoData, "hex").toString("utf-8");
					if (web3.utils.isAddress(memo) == true) {
						// console.log('\ntxHash:', item.tx.hash, 
						// 	'\ninLedger:', item.tx.inLedger, 
						// 	'\nDate:', item.tx.date, 
						// 	'\nXRPL Sender:', item.tx.Account, 
						// 	'\nXRPL Receiver:', item.tx.Destination, 
						// 	'\nXRP Drops Amount:', item.tx.Amount, 
						// 	'\nMemo:', memo);
						payloads.ledger.push(item.tx.inLedger);
						payloads.txHash.push(item.tx.hash);
						payloads.sender.push(item.tx.Account);
						payloads.receiver.push(item.tx.Destination);
						payloads.amount.push(item.tx.Amount);
						payloads.memo.push(memo);
					} else {
						console.error("ErrorCode006 - Invalid EVM address: ", item.tx.hash);
						continue;
					}
				}
			}
			if (xrplAPI.hasNextPage(response) == true) {
				xrplAPI.requestNextPage(command, params, response)
				.then(next_response => {
					responseIterate(next_response);
				})
			} else {
				var payloadsString = JSON.stringify(payloads);
				var payloadsHash = web3.utils.soliditySha3(payloadsString);
				var claimPeriodHash = web3.utils.soliditySha3(ledger, claimPeriodIndex, payloadsHash);
				registerClaimPeriod(genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, claimPeriodIndex, claimPeriodHash);
			}
		}
		responseIterate(response);
	})
	.catch(error => {
		processFailure(error);
	})
}


// async function processLedgers(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger, agent, payloadSkipIndex) {
// 	const command = 'account_tx';
// 	const params = {
// 		'account': config.contract.agents[agent],
// 		'ledger_index_min': ledger,
// 		'ledger_index_max': genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1,
// 		'binary': false,
// 		'forward': true
// 	};

// 	return xrplAPI.request(command, params)
// 	.then(response => {
// 		var currPayloadIndex = 0;
// 		async function responseIterate(response) {
// 			for (const item of response.transactions) {  
// 				currPayloadIndex++;
// 				if (currPayloadIndex < payloadSkipIndex) {
// 					continue;
// 				} else if (payloads.ledger.length >= MAX_PAYLOAD_TX_SIZE) {
// 					return registerPayloads(claimPeriodIndex, genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, payloads, true, agent, currPayloadIndex);
// 				} else if (item.meta.TransactionResult != 'tesSUCCESS') {
// 					console.error("ErrorCode001 - Unsuccessful transaction: ", item.tx.hash);
// 					continue;
// 				} else if (item.tx.TransactionType != 'Payment') {
// 					console.error("ErrorCode002 - Invalid transaction type: ", item.tx.hash);
// 					continue;
// 				} else if (item.tx.Amount < xrpAmount) {
// 					console.error("ErrorCode003 - Invalid payment amount: ", item.tx.hash);
// 					continue;
// 				} else if (!("Memos" in item.tx)){
// 					console.error("ErrorCode004 - No memo: ", item.tx.hash);
// 					continue;
// 				} else if (!("MemoData" in item.tx.Memos[0].Memo)) {
// 					console.error("ErrorCode005 - Invalid memo: ", item.tx.hash);
// 					continue;
// 				} else {
// 					const memo = Buffer.from(item.tx.Memos[0].Memo.MemoData, "hex").toString("utf-8");
// 					if (web3.utils.isAddress(memo) == true) {
// 						console.log('\ntxHash:', item.tx.hash, 
// 							'\ninLedger:', item.tx.inLedger, 
// 							'\nDate:', item.tx.date, 
// 							'\nXRPL Sender:', item.tx.Account, 
// 							'\nXRPL Receiver:', item.tx.Destination, 
// 							'\nXRP Drops Amount:', item.tx.Amount, 
// 							'\nMemo:', memo);
// 						payloads.ledger.push(item.tx.inLedger);
// 						payloads.txHash.push(item.tx.hash);
// 						payloads.sender.push(item.tx.Account);
// 						payloads.receiver.push(item.tx.Destination);
// 						payloads.amount.push(item.tx.Amount);
// 						payloads.memo.push(memo);
// 					} else {
// 						console.error("ErrorCode006 - Invalid EVM address: ", item.tx.hash);
// 						continue;
// 					}
// 				}
// 			}
// 			if (xrplAPI.hasNextPage(response) == true) {
// 				xrplAPI.requestNextPage(command, params, response)
// 				.then(next_response => {
// 					responseIterate(next_response);
// 				})
// 			} else {
// 				if (agent+1 >= config.contract.agents.length) {
// 					return registerPayloads(claimPeriodIndex, genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, payloads, false, 0, 0);
// 				} else {
// 					return processAgents(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger, agent+1, 0);
// 				}
// 			}
// 		}
// 		responseIterate(response);
// 	})
// 	.catch(error => {
// 		processFailure(error);
// 	})
// }

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
	let source = fs.readFileSync("solidity/fxrp.json");
	let contracts = JSON.parse(source)["contracts"];
	// ABI description as JSON structure
	let abi = JSON.parse(contracts['fxrp.sol:fxrp'].abi);
	// Create Contract proxy class
	fxrp = new web3.eth.Contract(abi);
	// Smart contract EVM bytecode as hex
	fxrp.options.data = '0x' + contracts['fxrp.sol:fxrp'].bin;
	fxrp.options.from = config.stateConnectors[n].F.address;
	fxrp.options.address = config.contract.address;
}


async function xrplConnectRetry(error) {
	console.log('XRPL connecting...');
	console.log(error);
	setTimeout(() => {return xrplAPI.connect().catch(xrplConnectRetry)}, 1000);
}

async function processFailure(error) {
	console.error('error:', error);
	process.exit();
}

async function updateClaimsInProgress(status) {
	claimsInProgress = status;
	return claimsInProgress;
}

function claimProcessingCompleted(message) {
	xrplAPI.disconnect()
	.then(() => {
		console.log(message);
		setTimeout(() => {return process.exit()}, 5000);
	})
}

app.get('/fxrp', (req, res) => {
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



