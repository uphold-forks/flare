const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const fs = require('fs');
const fetch = require('node-fetch');
const express = require('express');
const app = express();

const stateConnectorContract = "0x1000000000000000000000000000000000000001";
const chains = {
	'btc': {
		chainId: 0,
		confirmations: 4,
		claimPeriodLength: 1,
		timeDiffExpected: 900
	},
	'ltc': {
		chainId: 1,
		confirmations: 12,
		claimPeriodLength: 1,
		timeDiffExpected: 150
	},
	'doge': {
		chainId: 2,
		confirmations: 40,
		claimPeriodLength: 2,
		timeDiffExpected: 120
	},
	'xrp': {
		chainId: 3,
		confirmations: 1,
		claimPeriodLength: 30,
		timeDiffExpected: 120
	},
	'xlm': {
		chainId: 4,
		confirmations: 1,
		claimPeriodLength: 20,
		timeDiffExpected: 120
	}
};

var active,
	config,
	customCommon,
	stateConnector,
	api,
	username,
	password,
	confirmations,
	claimPeriodLength,
	timeDiffExpected;

async function postData(url = '', username = '', password = '', data = {}) {
	const response = await fetch(url, {
		method: 'POST',
		headers: new fetch.Headers({
			'Authorization': 'Basic ' + Buffer.from(username + ':' + password).toString('base64'),
			'Content-Type': "application/json"
		}),
		credentials: 'include',
		body: JSON.stringify(data)
	}).catch(processFailure);
	return response.json();
}

// ===============================================================
// Proof of Work Specific Items
// ===============================================================

async function powProcessLedger(chainId, genesisLedger, claimPeriodIndex, claimPeriodLength, isCommit) {
	console.log('\nRetrieving proof of work state hash from ledger:', genesisLedger + (claimPeriodIndex + 1) * claimPeriodLength - 1);
	const currLedger = genesisLedger + (claimPeriodIndex + 1) * claimPeriodLength - 1;
	const method = 'getblockhash';
	const chainTipLedger = currLedger + confirmations*claimPeriodLength;
	var currLedgerHash;
	postData(api, username, password, { method: method, params: [currLedger] })
		.then(data => {
			currLedgerHash = '0x' + data.result;
			postData(api, username, password, { method: method, params: [chainTipLedger] })
				.then(data => {
					return proveClaimPeriodFinality(chainId, genesisLedger + (claimPeriodIndex + 1) * claimPeriodLength, claimPeriodIndex, currLedgerHash, '0x' + data.result, isCommit);
				})
				.catch(error => {
					processFailure(error);
				})
		})
		.catch(error => {
			processFailure(error);
		})
}

// ===============================================================
// XRP Specific Functions
// ===============================================================

async function xrplProcessLedger(genesisLedger, claimPeriodIndex, claimPeriodLength, isCommit) {
	console.log('\nRetrieving XRPL state hash from ledger:', genesisLedger + (claimPeriodIndex + 1) * claimPeriodLength - 1);
	const currLedger = genesisLedger + (claimPeriodIndex + 1) * claimPeriodLength - 1;
	const chainTipLedger = currLedger + chains['xrp'].confirmations*chains['xrp'].claimPeriodLength;
	const method = 'ledger';
	var params = [{
		'ledger_index': currLedger,
		'binary': false,
		'full': false,
		'accounts': false,
		'transactions': false,
		'expand': false,
		'owner_funds': false
	}];
	var currLedgerHash;
	postData(api, username, password, { method: method, params: params })
		.then(data => {
			currLedgerHash = web3.utils.sha3(data.result.ledger_hash);
			params = [{
				'ledger_index': chainTipLedger,
				'binary': false,
				'full': false,
				'accounts': false,
				'transactions': false,
				'expand': false,
				'owner_funds': false
			}];
			postData(api, username, password, { method: method, params: params })
				.then(data => {
					return proveClaimPeriodFinality(chains['xrp'].chainId, genesisLedger + (claimPeriodIndex + 1) * claimPeriodLength, claimPeriodIndex, currLedgerHash, web3.utils.sha3(data.result.ledger_hash), isCommit);
				})
				.catch(error => {
					processFailure(error);
				})
		})
		.catch(error => {
			processFailure(error);
		})
}

// ===============================================================
// Chain Common Functions
// ===============================================================

async function run(chainId, minLedger) {
	console.log('\n\x1b[34mState Connector System connected at', Date(Date.now()).toString(), '\x1b[0m');
	stateConnector.methods.getLatestIndex(parseInt(chainId)).call().catch(initialiseChains)
		.then(getLatestIndexResult => {
			if (getLatestIndexResult != undefined) {
				if (chainId >= 0 && chainId < 3) {
					const method = 'getblockcount',
						params = [];
					postData(api, username, password, { method: method, params: params })
						.then(data => {
							return prepareDataAvailabilityProof(chainId, minLedger, getLatestIndexResult, data.result);
						})
				} else if (chainId == 3) {
					const method = 'ledger';
					const params = [{
						'ledger_index': "validated",
						'binary': false,
						'full': false,
						'accounts': false,
						'transactions': false,
						'expand': false,
						'owner_funds': false
					}];
					postData(api, username, password, { method: method, params: params })
						.then(data => {
							return prepareDataAvailabilityProof(chainId, minLedger, getLatestIndexResult, data.result.ledger_index);
						})
				} else {
					return processFailure('Invalid chainId.');
				}
			}
		})
}

async function prepareDataAvailabilityProof(chainId, minLedger, getLatestIndexResult, currentLedger) {
	const currTime = parseInt(Date.now() / 1000);
	var deferTime;
	console.log("Finalised claim period:\t\x1b[33m", parseInt(getLatestIndexResult.finalisedClaimPeriodIndex) - 1,
		"\n\x1b[0mFinalised Ledger Index:\t\x1b[33m", parseInt(getLatestIndexResult.finalisedLedgerIndex),
		"\n\x1b[0mCurrent Ledger Index:\t\x1b[33m", currentLedger);
	if (getLatestIndexResult.finalisedTimestamp > 0) {
		console.log("\x1b[0mFinalised Timestamp:\t\x1b[33m", parseInt(getLatestIndexResult.finalisedTimestamp),
			"\n\x1b[0mCurrent Timestamp:\t\x1b[33m", currTime,
			"\n\x1b[0mDiff Avg (sec):\t\t\x1b[33m", parseInt(getLatestIndexResult.timeDiffAvg));
	} else {
		console.log("\x1b[0mCurrent Timestamp:\t\x1b[33m", currTime,
			"\n\x1b[0mPermitted Reveal Time:\t\x1b[33m", parseInt(getLatestIndexResult.timeDiffAvg));
	}
	if (parseInt(getLatestIndexResult.finalisedTimestamp) > 0) {
		if (parseInt(getLatestIndexResult.timeDiffAvg) < timeDiffExpected / 2) {
			deferTime = parseInt(2 * parseInt(getLatestIndexResult.timeDiffAvg) / 3 - (currTime - parseInt(getLatestIndexResult.finalisedTimestamp)));
		} else {
			deferTime = parseInt(parseInt(getLatestIndexResult.timeDiffAvg) - (currTime - parseInt(getLatestIndexResult.finalisedTimestamp)) - 15);
		}
		if (deferTime > 0) {
			console.log("Not enough time elapsed since prior finality, deferring for", deferTime, "seconds.");
			return setTimeout(() => { run(chainId, minLedger) }, 1000 * (deferTime + 1));
		} else if (currentLedger >= parseInt(getLatestIndexResult.genesisLedger) + (parseInt(getLatestIndexResult.finalisedClaimPeriodIndex) + 1) * parseInt(getLatestIndexResult.claimPeriodLength) + confirmations*claimPeriodLength) {
			if (chainId >= 0 && chainId < 3) {
				return powProcessLedger(chainId, parseInt(getLatestIndexResult.genesisLedger), parseInt(getLatestIndexResult.finalisedClaimPeriodIndex), parseInt(getLatestIndexResult.claimPeriodLength), true);
			} else if (chainId == 3) {
				return xrplProcessLedger(parseInt(getLatestIndexResult.genesisLedger), parseInt(getLatestIndexResult.finalisedClaimPeriodIndex), parseInt(getLatestIndexResult.claimPeriodLength), true);
			} else {
				return processFailure('Invalid chainId.');
			}
		} else {
			console.log('Reached latest state, waiting for new ledgers.');
			setTimeout(() => { return process.exit() }, 5000);
		}
	} else {
		// Time to reveal the proof
		if (currTime > parseInt(getLatestIndexResult.timeDiffAvg)) {
			if (chainId >= 0 && chainId < 3) {
				return powProcessLedger(chainId, parseInt(getLatestIndexResult.genesisLedger), parseInt(getLatestIndexResult.finalisedClaimPeriodIndex), parseInt(getLatestIndexResult.claimPeriodLength), false);
			} else if (chainId == 3) {
				return xrplProcessLedger(parseInt(getLatestIndexResult.genesisLedger), parseInt(getLatestIndexResult.finalisedClaimPeriodIndex), parseInt(getLatestIndexResult.claimPeriodLength), false);
			} else {
				return processFailure('Invalid chainId.');
			}
		} else {
			deferTime = parseInt(getLatestIndexResult.timeDiffAvg) - currTime;
			console.log("Not enough time elapsed since proof commit, deferring for", deferTime, "seconds.");
			return setTimeout(() => { run(chainId, minLedger) }, 1000 * (deferTime + 1));
		}
	}
}

async function proveClaimPeriodFinality(chainId, ledger, claimPeriodIndex, claimPeriodHash, chainTipHash, isCommit) {
	stateConnector.methods.getClaimPeriodIndexFinality(
		parseInt(chainId),
		claimPeriodIndex).call({
			from: config.accounts[0].address,
			gas: config.flare.gas,
			gasPrice: config.flare.gasPrice
		}).catch(processFailure)
		.then(result => {
			console.log('\x1b[0mClaim period:\t\t\x1b[33m', claimPeriodIndex, '\x1b[0m\nProof reveal:\t\t\x1b[33m', !isCommit, '\x1b[0m\nclaimPeriodHash:\t\x1b[33m', claimPeriodHash, '\x1b[0m\nchainTipHash:\t\t\x1b[33m', chainTipHash, '\x1b[0m');
			if (result == true) {
				console.log('This claim period already registered.');
				setTimeout(() => { return process.exit() }, 5000);
			} else {
				web3.eth.getTransactionCount(config.accounts[0].address)
					.then(nonce => {
						if (isCommit) {
							return [stateConnector.methods.proveClaimPeriodFinality(
								chainId,
								ledger,
								claimPeriodHash,
								web3.utils.soliditySha3(config.accounts[0].address, chainTipHash)).encodeABI(), nonce];
						} else {
							return [stateConnector.methods.proveClaimPeriodFinality(
								chainId,
								ledger,
								claimPeriodHash,
								chainTipHash).encodeABI(), nonce];
						}
					})
					.then(txData => {
						var rawTx = {
							nonce: txData[1],
							gasPrice: web3.utils.toHex(parseInt(config.flare.gasPrice)),
							gas: web3.utils.toHex(config.flare.gas),
							to: stateConnector.options.address,
							from: config.accounts[0].address,
							data: txData[0]
						};
						var tx = new Tx(rawTx, { common: customCommon });
						var key = Buffer.from(config.accounts[0].privateKey, 'hex');
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
												return setTimeout(() => { run(chainId, ledger) }, 5000);
											}
										})
										.on('error', error => {
											return processFailure(error);
										});
								} else {
									console.log('Already waiting for this transaction to be delivered.');
									setTimeout(() => { return process.exit() }, 5000);
								}
							})
					})
			}
		})
}

async function initialiseChains() {
	console.log('Initialising chains');
	web3.eth.getTransactionCount(config.accounts[0].address)
		.then(nonce => {
			return [stateConnector.methods.initialiseChains().encodeABI(), nonce];
		})
		.then(contractData => {
			var rawTx = {
				nonce: contractData[1],
				gasPrice: web3.utils.toHex(config.flare.gasPrice),
				gas: web3.utils.toHex(config.flare.gas),
				chainId: config.flare.chainId,
				from: config.accounts[0].address,
				to: stateConnector.options.address,
				data: contractData[0]
			}
			var tx = new Tx(rawTx, { common: customCommon });
			var key = Buffer.from(config.accounts[0].privateKey, 'hex');
			tx.sign(key);
			var serializedTx = tx.serialize();

			web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
				.on('receipt', receipt => {
					if (receipt.status == false) {
						return processFailure('receipt.status == false');
					} else {
						console.log("State-connector chains initialised.");
						setTimeout(() => { return process.exit() }, 5000);
					}
				})
				.on('error', error => {
					processFailure(error);
				});
		}).catch(processFailure);
}

async function configure(chainId) {
	let rawConfig = fs.readFileSync('config.json');
	config = JSON.parse(rawConfig);
	if (chainId == 0) {
		api = config.chains.btc.api;
		username = config.chains.btc.username;
		password = config.chains.btc.password;
		confirmations = chains['btc'].confirmations;
		claimPeriodLength = chains['btc'].claimPeriodLength;
		timeDiffExpected = chains['btc'].timeDiffExpected;
	} else if (chainId == 1) {
		api = config.chains.ltc.api;
		username = config.chains.ltc.username;
		password = config.chains.ltc.password;
		confirmations = chains['ltc'].confirmations;
		claimPeriodLength = chains['ltc'].claimPeriodLength;
		timeDiffExpected = chains['ltc'].timeDiffExpected;
	} else if (chainId == 2) {
		api = config.chains.doge.api;
		username = config.chains.doge.username;
		password = config.chains.doge.password;
		confirmations = chains['doge'].confirmations;
		claimPeriodLength = chains['doge'].claimPeriodLength;
		timeDiffExpected = chains['doge'].timeDiffExpected;
	} else if (chainId == 3) {
		api = config.chains.xrp.api;
		username = config.chains.xrp.username;
		password = config.chains.xrp.password;
		confirmations = chains['xrp'].confirmations;
		claimPeriodLength = chains['xrp'].claimPeriodLength;
		timeDiffExpected = chains['xrp'].timeDiffExpected;
	} else if (chainId == 4) {
		api = config.chains.xlm.api;
		username = config.chains.xlm.username;
		password = config.chains.xlm.password;
		confirmations = chains['xlm'].confirmations;
		claimPeriodLength = chains['xlm'].claimPeriodLength;
		timeDiffExpected = chains['xlm'].timeDiffExpected;
	}
	web3.setProvider(new web3.providers.HttpProvider(config.flare.url));
	web3.eth.handleRevert = true;
	customCommon = Common.forCustomChain('ropsten',
		{
			name: 'coston',
			networkId: config.flare.chainId,
			chainId: config.flare.chainId,
		},
		'petersburg');
	web3.eth.getBalance(config.accounts[0].address)
		.then(balance => {
			if (parseInt(web3.utils.fromWei(balance, "ether")) < 1000000) {
				console.log("Not enough FLR reserved in your account, need 1M FLR.");
				sleep(5000);
				process.exit();
			} else {
				// Read the compiled contract code
				let source = fs.readFileSync("../bin/contracts/StateConnector.json");
				let contract = JSON.parse(source);
				// Create Contract proxy class
				stateConnector = new web3.eth.Contract(contract.abi);
				// Smart contract EVM bytecode as hex
				stateConnector.options.data = '0x' + contract.deployedBytecode;
				stateConnector.options.from = config.accounts[0].address;
				stateConnector.options.address = stateConnectorContract;
				return run(chainId, 0);
			}
		})
}

async function processFailure(error) {
	console.error('error:', error);
	setTimeout(() => { return process.exit() }, 2500);
}


async function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

setTimeout(() => { return process.exit() }, 600000);
app.get('/', (req, res) => {
	if ("prove" in req.query) {
		if (req.query.prove in chains) {
			if (active) {
				res.status(200).send('State Connector already active on this port.').end();
			} else {
				active = true;
				res.status(200).send('State Connector initiated.').end();
				return configure(chains[req.query.prove].chainId);
			}
		} else {
			res.status(404).send('Unknown chain.');
		}
	} else {
		res.status(200).send('Healthy.');
	}
});
// Start the server
const PORT = process.env.PORT || parseInt(process.argv[2]);
app.listen(PORT, () => {
});
module.exports = app;
