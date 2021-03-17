'use strict';
process.env.NODE_ENV = 'production';
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const fs = require('fs');
const express = require('express');
const app = express();

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

async function xrplProcessLedger(genesisLedger, claimPeriodIndex, claimPeriodLength) {
	console.log('\nRetrieving XRPL state hash from ledger:', genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1);
	const currLedger = genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1;
	const command = 'ledger';
	const params = {
		'ledger_index': currLedger,
		'binary': false,
		'full': false,
		'accounts': false,
		'transactions': false,
		'expand': false,
		'owner_funds': false
	};
	return chains.xrp.api.request(command, params)
	.then(response => {
		return proveClaimPeriodFinality(0, genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, claimPeriodIndex, web3.utils.sha3(response.ledger_hash));
	})
	.catch(error => {
		processFailure(error);
	})
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
	stateConnector.methods.getLatestIndex(parseInt(chainId)).call().catch(initialiseChains)
	.then(result => {
		if (result != undefined) {
			if (chainId == 0) {
				chains.xrp.api.getLedgerVersion().catch(processFailure)
				.then(sampledLedger => {
					if (parseInt(result.finalisedLedgerIndex) < parseInt(minLedger)) {
						console.log("Waiting for network to independently verify prior claim period registration.");
						return setTimeout(() => {run(chainId, minLedger)}, 5000);
					} else {
						console.log("Finalised claim period:\t\x1b[33m", parseInt(result.finalisedClaimPeriodIndex)-1, 
							"\n\x1b[0mFinalised Ledger Index:\t\x1b[33m", parseInt(result.finalisedLedgerIndex),
							"\n\x1b[0mCurrent Ledger Index:\t\x1b[33m", sampledLedger,
							"\n\x1b[0mFinalised Timestamp:\t\x1b[33m", parseInt(result.finalisedTimestamp),
							"\n\x1b[0mCurrent Timestamp:\t\x1b[33m", parseInt(Date.now()/1000),
							"\n\x1b[0mDiff Avg (sec):\t\t\x1b[33m", parseInt(result.timeDiffAvg));
						const currTime = parseInt(Date.now()/1000);
						var deferTime;
						if (parseInt(result.timeDiffAvg) < 60) {
							deferTime = parseInt(2*parseInt(result.timeDiffAvg)/3 - (currTime-parseInt(result.finalisedTimestamp)));
						} else {
							deferTime = parseInt(parseInt(result.timeDiffAvg) - (currTime-parseInt(result.finalisedTimestamp)) - 15);
						}
						
						if (deferTime > 0) {
							console.log("Not enough time elapsed since prior finality, deferring for", deferTime, "seconds.");
							return setTimeout(() => {run(chainId, minLedger)}, 1000*(deferTime+1));
						} else if (sampledLedger >= parseInt(result.genesisLedger) + (parseInt(result.finalisedClaimPeriodIndex)+1)*parseInt(result.claimPeriodLength)) {
							return xrplProcessLedger(parseInt(result.genesisLedger), parseInt(result.finalisedClaimPeriodIndex), parseInt(result.claimPeriodLength));
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

async function proveClaimPeriodFinality(chainId, ledger, claimPeriodIndex, claimPeriodHash) {
	stateConnector.methods.getClaimPeriodIndexFinality(
					parseInt(chainId),
					claimPeriodIndex).call({
		from: config.accounts[0].address,
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
			web3.eth.getTransactionCount(config.accounts[0].address)
			.then(nonce => {
				return [stateConnector.methods.proveClaimPeriodFinality(
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
					from: config.accounts[0].address,
					data: txData[0]
				};
				var tx = new Tx(rawTx, {common: customCommon});
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
								return setTimeout(() => {run(chainId, ledger)}, 5000);
							}
						})
						.on('error', error => {
							return processFailure(error);
						});
					} else {
						console.log('Already waiting for this transaction to be delivered.');
						return setTimeout(() => {xrplClaimProcessingCompleted()}, 5000);
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
			gas: web3.utils.toHex(config.flare.contractGas),
			chainId: config.flare.chainId,
			from: config.accounts[0].address,
			to: stateConnector.options.address,
			data: contractData[0]
		}
		var tx = new Tx(rawTx, {common: customCommon});
		var key = Buffer.from(config.accounts[0].privateKey, 'hex');
		tx.sign(key);
		var serializedTx = tx.serialize();
		
		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('receipt', receipt => {
			if (receipt.status == false) {
				return processFailure('receipt.status == false');
			} else {
				console.log("State-connector chains initialised.");
				return setTimeout(() => {run(0, 0)}, 5000);
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
	let source = fs.readFileSync("../bin/contracts/StateConnector.json");
	let contract = JSON.parse(source);
	// Create Contract proxy class
	stateConnector = new web3.eth.Contract(contract.abi);
	// Smart contract EVM bytecode as hex
	stateConnector.options.data = '0x' + contract.deployedBytecode;
	stateConnector.options.from = config.accounts[0].address;
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