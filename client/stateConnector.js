'use strict';
process.env.NODE_ENV = 'production';
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const fs = require('fs');
const express = require('express');
const app = express();
const {MerkleTree} = require('merkletreejs');
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
// XRP Specific Items
// ===============================================================

const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');

async function xrplProcessLedgers(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger) {
	console.log('\nRetrieving XRPL state from ledgers:', ledger, 'to', genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1);
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
		return chains.xrp.api.request(command, params)
		.then(response => {
			async function responseIterate(response) {
				async function transactionIterate(item, i, numTransactions) {
					if (item.TransactionType == 'Payment' && typeof item.Amount == 'string' && item.metaData.TransactionResult == 'tesSUCCESS') {
						const prevLength = payloads.length;
						const leafPromise = new Promise((resolve, reject) => {
							var destinationTag;
							if (!("DestinationTag" in item)) {
								destinationTag = 0;
							} else {
								destinationTag = item.DestinationTag;
							}
							// console.log('chainId: \t\t', '0', '\n',
							// 	'ledger: \t\t', response.ledger.seqNum, '\n',
							// 	'txId: \t\t\t', item.hash, '\n',
							// 	'source: \t\t', item.Account, '\n',
							// 	'destination: \t\t', item.Destination, '\n',
							// 	'destinationTag: \t', String(destinationTag), '\n',
							// 	'amount: \t\t', parseInt(item.metaData.delivered_amount), '\n');
							const chainIdHash = web3.utils.soliditySha3('0');
							const ledgerHash = web3.utils.soliditySha3(response.ledger.seqNum);
							const txHash = web3.utils.soliditySha3(item.hash);
							const accountsHash = web3.utils.soliditySha3(web3.utils.soliditySha3(item.Account, item.Destination), destinationTag);
							const amountHash = web3.utils.soliditySha3(item.metaData.delivered_amount);
							const leafHash = web3.utils.soliditySha3(chainIdHash, ledgerHash, txHash, accountsHash, amountHash);
							resolve(leafHash);
						}).catch(processFailure)
						return await leafPromise.then(newPayload => {
							payloads[payloads.length] = newPayload;
							if (payloads.length == prevLength + 1) {
								if (i+1 < numTransactions) {
									return transactionIterate(response.ledger.transactions[i+1], i+1, numTransactions);
								} else {
									return checkResponseCompletion(response);
								}
							} else {
								return processFailure("Unable to append payload:", tx.hash);
							}
						}).catch(error => {
							return processFailure("Unable to intepret payload:", error, tx.hash);
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
					if (chains.xrp.api.hasNextPage(response) == true) {
						chains.xrp.api.requestNextPage(command, params, response)
						.then(next_response => {
							responseIterate(next_response);
						})
					} else if (parseInt(currLedger)+1 < genesisLedger + (claimPeriodIndex+1)*claimPeriodLength) {
						return xrplProcessLedger(parseInt(currLedger)+1);
					} else {
						var root;
						if (payloads.length > 0) {
							const tree = new MerkleTree(payloads, keccak256, {sort: true});
							root = tree.getHexRoot();
						} else {
							root = "0x0000000000000000000000000000000000000000000000000000000000000000";
						}
						console.log('Num Payloads:\t\t', payloads.length);
						return registerClaimPeriod(0, genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, claimPeriodIndex, root);
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

function xrplClaimProcessingCompleted(message) {
	chains.xrp.api.disconnect().catch(processFailure)
	.then(() => {
		console.log(message);
		setTimeout(() => {return process.exit()}, 5000);
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

async function run(chainId, minLedger) {
	console.log('\n\x1b[34mState Connector System connected at', Date(Date.now()).toString(), '\x1b[0m' );
	stateConnector.methods.getlatestIndex(parseInt(chainId)).call().catch(initialiseChains)
	.then(result => {
		if (result != undefined) {
			if (chainId == 0) {
				chains.xrp.api.getLedgerVersion().catch(processFailure)
				.then(sampledLedger => {
					if (parseInt(result.finalisedLedgerIndex) < parseInt(minLedger)) {
						console.log("Waiting for network to independently verify prior claim period registration.");
						setTimeout(() => {return run(chainId, minLedger)}, 5000);
					} else {
						console.log("Finalised claim period:\t\x1b[33m", parseInt(result.finalisedClaimPeriodIndex)-1, 
							"\n\x1b[0mFinalised Ledger Index:\t\x1b[33m", parseInt(result.finalisedLedgerIndex),
							"\n\x1b[0mCurrent Ledger Index:\t\x1b[33m", sampledLedger,
							"\n\x1b[0mFinalised Timestamp:\t\x1b[33m", parseInt(result.finalisedTimestamp),
							"\n\x1b[0mCurrent Timestamp:\t\x1b[33m", parseInt(Date.now()/1000),
							"\n\x1b[0mDiff Avg (sec):\t\t\x1b[33m", parseInt(result.timeDiffAvg));
						const currTime = parseInt(Date.now()/1000);
						const deferTime = parseInt(parseInt(result.timeDiffAvg)/2) - (currTime-parseInt(result.finalisedTimestamp)) - 5;
						if (deferTime > 5) {
							console.log("Not enough time elapsed since prior finality, deferring for", deferTime, "seconds.");
							setTimeout(() => {return run(chainId, minLedger)}, 1000*deferTime);
						} else if (sampledLedger > parseInt(result.genesisLedger) + (parseInt(result.finalisedClaimPeriodIndex)+1)*parseInt(result.claimPeriodLength)) {
							return xrplProcessLedgers([], parseInt(result.genesisLedger), parseInt(result.finalisedClaimPeriodIndex), parseInt(result.claimPeriodLength), parseInt(result.finalisedLedgerIndex));
						} else {
							return xrplClaimProcessingCompleted('Reached latest state, waiting for new ledgers.');
						}
					}
				})
			} else {
				return processFailure('Invalid chainId.');
			}
		}	
	})
}

async function registerClaimPeriod(chainId, ledger, claimPeriodIndex, claimPeriodHash) {
	stateConnector.methods.checkFinality(
					parseInt(chainId),
					claimPeriodIndex).call({
		from: config.account.address,
		gas: config.flare.gas,
		gasPrice: config.flare.gasPrice
	}).catch(processFailure)
	.then(result => {
		console.log('Claim period:\t\t\x1b[33m', claimPeriodIndex, '\x1b[0m\nclaimPeriodHash:\t\x1b[33m', claimPeriodHash, '\x1b[0m');
		if (result == true) {
			if (chainId == 0) {
				return xrplClaimProcessingCompleted('This claim period already registered.');
			} else {
				return processFailure('Invalid chainId.');
			}
		} else {
			web3.eth.getTransactionCount(config.account.address)
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
					from: config.account.address,
					data: txData[0]
				};
				var tx = new Tx(rawTx, {common: customCommon});
				var key = Buffer.from(config.account.privateKey, 'hex');
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
								console.log('Transaction delivered:\t \x1b[33m' + receipt.transactionHash + '\x1b[0m');
								setTimeout(() => {return run(chainId, ledger)}, 15000);
							}
						})
						.on('error', error => {
							return processFailure(error);
						});
					} else {
						console.log('Already waiting for this transaction to be delivered.');
						setTimeout(() => {return run(chainId, ledger)}, 5000);
					}
				})
			})
		}
	})
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
				setTimeout(() => {return run(0, 0)}, 5000);
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
			return run(chainId, 0);
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

async function updateClaimsInProgress(chain, status) {
	chains[chain].claimsInProgress = status;
	return chains[chain].claimsInProgress;
}

async function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

// setTimeout(() => {return process.exit()}, 600000);
app.get('/', (req, res) => {
	if ("verify" in req.query) {
		console.log(req.query.verify);
		res.status(200).send(req.query.verify).end();
	} else if ("prove" in req.query) {
		if (req.query.prove in chains) {
			if (chains[req.query.prove].claimsInProgress == true) {
				res.status(200).send('Claims already being processed.').end();
			} else {
				updateClaimsInProgress(req.query.prove, true)
				.then(result => {
					if (result == true) {
						res.status(200).send('State Connector initiated.').end();
						return configure(chains[req.query.prove].chainId);
					} else {
						return processFailure('Error updating claimsInProgress.');
					}
				})
			}
		} else {
			res.status(404).send('Unknown chain.');
		}
	} else {
		res.status(200).send('Alive.');
	}
});
// Start the server
const PORT = process.env.PORT || parseInt(process.argv[2]);
app.listen(PORT, () => {
});
module.exports = app;