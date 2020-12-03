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
	console.log('\nClaim period:\t\t\x1b[33m', claimPeriodIndex, '\x1b[0m\nclaimPeriodHash:\t\x1b[33m', claimPeriodHash, '\x1b[0m');
	web3.eth.getTransactionCount(config.stateConnectors[n].F.address)
	.then(nonce => {
		return [stateConnector.methods.registerClaimPeriod(
					ledger,
					claimPeriodIndex,
					claimPeriodHash
        		).encodeABI(), nonce];
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
						console.log('Transaction finalised:\t\x1b[33m', receipt.transactionHash, '\x1b[0m');	
						return claimProcessingCompleted('Claim period processing complete');
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
			console.log("Finalised claim period:\t\x1b[33m", result[1], 
				"\n\x1b[0mLast processed ledger:\t\x1b[33m", result[3], '\n\x1b[0mCurrent sampled ledger:\t\x1b[33m', sampledLedger);
			console.log("\x1b[0mCoinbase address:\t\x1b[33m", result[4], '\x1b[0m');
			console.log("\x1b[0mContract-layer UNL:\n", result[5], '\x1b[0m');
			if (sampledLedger > result[0] + (result[1]+1)*result[2]) {
				return processLedgers([], result[0], result[1], result[2], result[3]);
			} else {
				return claimProcessingCompleted('Claim period processing complete, waiting for a new claim period...');
			}
		})
	})
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
				} else if (item.tx.Amount < minFee) {
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
						// payloads.push(web3.utils.soliditySha3(
						// 		web3.eth.abi.encodeParameters(
						// 		[
						// 			'uint256',
						// 			'string',
						// 			'string',
						// 			'string',
						// 			'uint256',
						// 			'string'
						// 		],
						// 		[
						// 			item.tx.inLedger,
						// 			item.tx.hash,
						// 			item.tx.Account,
						// 			item.tx.Destination,
						// 			item.tx.Amount,
						// 			memo
						// 		])
						// 	)
						// );

						payloads.push(web3.utils.soliditySha3(
							web3.utils.soliditySha3('ledger', item.tx.inLedger),
							web3.utils.soliditySha3('txHash', item.tx.hash),
							web3.utils.soliditySha3('sender', item.tx.Account),
							web3.utils.soliditySha3('destination', item.tx.Destination),
							web3.utils.soliditySha3('amount', item.tx.Amount),
							web3.utils.soliditySha3('memo', memo))
						);
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
				var leaves = payloads.map(x => SHA256(x));
				var tree = new MerkleTree(leaves, SHA256);
				var root = tree.getRoot().toString('hex');
				var claimPeriodHash = web3.utils.soliditySha3(ledger, 'flare', claimPeriodIndex, '0x'+root);
				registerClaimPeriod(genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, claimPeriodIndex, claimPeriodHash);
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
	setTimeout(() => {return process.exit()}, getRandomInt(1000,5000));
}

async function updateClaimsInProgress(status) {
	claimsInProgress = status;
	return claimsInProgress;
}

function claimProcessingCompleted(message) {
	xrplAPI.disconnect().catch(processFailure)
	.then(() => {
		console.log(message);
		setTimeout(() => {return process.exit()}, getRandomInt(1000,5000));
	})
}

app.get('/stateConnector', (req, res) => {
	setTimeout(() => {process.exit()}, 60000);
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
					return xrplAPI.connect().catch(processFailure);
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



