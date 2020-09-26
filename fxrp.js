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
const MAX_PAYLOAD_TX_SIZE = 200;
var claimsInProgress = false;

var config;
var xrplAPI;
var agents;
var fxrp;
var n;

const customCommon = Common.forCustomChain('ropsten',
						{
							name: 'coston',
							networkId: 14,
							chainId: 14,
						},
        				'petersburg',);

async function registerPayloads(claimPeriodIndex, ledger, payloads, partialRegistration, agent, payloadSkipIndex, nonceOffset) {
	console.log('\n');
	if (partialRegistration == false) {
		console.log('Claim period:\t\t\x1b[33m', claimPeriodIndex, '\x1b[0m');
	}
	web3.eth.getTransactionCount(config.stateConnectors[n].F.address)
	.then(nonce => {
		return [fxrp.methods.registerPayloads(
					claimPeriodIndex,
					ledger,
					payloads.ledger,
					payloads.txHash,
					payloads.sender,
					payloads.receiver,
					payloads.amount,
					payloads.memo,
					partialRegistration,
					agent,
					payloadSkipIndex
        		).encodeABI(), nonce];
	})
	.then(txData => {
		var rawTx = {
			nonce: txData[1]+nonceOffset,
			gasPrice: web3.utils.toHex(config.evm.gasPrice),
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
		console.log('Delivering payloads:\t\x1b[33m', txHash, '\x1b[0m');
		return web3.eth.getTransaction(txHash)
		.then(txResult => {
			if (txResult == null) {
				web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
				.on('receipt', receipt => {
					if (receipt.status == false) {
						return processFailure(receipt.transactionHash);
					}
					console.log('Payloads registered:\t\x1b[33m', receipt.transactionHash, '\x1b[0m');	
					return run();
				})
				.on('error', error => {
					console.log(error);
					return claimProcessingCompleted();
				});
			} else {
				return registerPayloads(claimPeriodIndex, ledger, payloads, partialRegistration, agent, payloadSkipIndex, nonceOffset+2);
			}
		})
	})
}

async function run() {
	console.log('\n\x1b[34mState Connector System connected at', Date(Date.now()).toString(), '\x1b[0m' );
	fxrp.methods.getlatestIndex().call({
		from: config.stateConnectors[n].F.address,
		gas: config.evm.gas,
		gasPrice: config.evm.gasPrice
	}).catch(processFailure)
	.then(result => {
		return [parseInt(result._genesisLedger), parseInt(result._claimPeriodIndex), parseInt(result._claimPeriodLength),
		parseInt(result._ledger), parseInt(result._agent), parseInt(result._payloadSkipIndex),
		parseInt(result._finalisedClaimPeriodIndex), result._coinbase, result._UNL];
	})
	.then(result => {
		xrplAPI.getLedgerVersion().catch(processFailure)
		.then(sampledLedger => {
			console.log("Finalised claim period:\t\x1b[33m", result[6], "\n\x1b[0mLocal claim period:\t\x1b[33m", result[1], 
				"\n\x1b[0mLast processed ledger:\t\x1b[33m", result[3], '\n\x1b[0mCurrent sampled ledger:\t\x1b[33m', sampledLedger);
			console.log("\x1b[0mCoinbase address:\t\x1b[33m", result[7], '\x1b[0m');
			console.log("\x1b[0mContract-layer UNL:\n", result[8], '\x1b[0m');
			if (sampledLedger > result[0] + (result[1]+1)*result[2]) {
				return processAgents({
						ledger: 	[],
						txHash: 	[],
						sender: 	[],
						receiver: 	[],
						amount: 	[],
						memo: 		[]
					},
					result[0], result[1], result[2], result[3], result[4], result[5]);
			} else {
				return claimProcessingCompleted();
			}
		})
	})
}

async function processAgents(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger, agent, payloadSkipIndex) {
	const command = 'account_tx';
	const params = {
		'account': agents[agent],
		'ledger_index_min': ledger,
		'ledger_index_max': genesisLedger + (claimPeriodIndex+1)*claimPeriodLength - 1,
		'binary': false,
		'forward': true
	};

	return xrplAPI.request(command, params)
	.then(response => {
		var currPayloadIndex = 0;
		async function responseIterate(response) {
			for (const item of response.transactions) {  
				currPayloadIndex++;
				if (currPayloadIndex < payloadSkipIndex) {
					continue;
				} else if (payloads.ledger.length >= MAX_PAYLOAD_TX_SIZE) {
					return registerPayloads(claimPeriodIndex, genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, payloads, true, agent, currPayloadIndex, 0);
				}
				if (item.meta.TransactionResult != 'tesSUCCESS') {
					console.error("ErrorCode001 - Unsuccessful transaction: ", item.tx.hash);
					continue;
				}
				if (item.tx.TransactionType != 'Payment') {
					console.error("ErrorCode002 - Invalid transaction type: ", item.tx.hash);
					continue;
				}
				if (item.tx.Amount < xrpAmount) {
					console.error("ErrorCode003 - Invalid payment amount: ", item.tx.hash);
					continue;
				}
				if (!("Memos" in item.tx)){
					console.error("ErrorCode004 - No memo: ", item.tx.hash);
					continue;
				} else if (!("MemoData" in item.tx.Memos[0].Memo)) {
					console.error("ErrorCode005 - Invalid memo: ", item.tx.hash);
					continue;
				}
				const memo = Buffer.from(item.tx.Memos[0].Memo.MemoData, "hex").toString("utf-8");
				console.log('\ntxHash:', item.tx.hash, 
					'\ninLedger:', item.tx.inLedger, 
					'\nDate:', item.tx.date, 
					'\nXRPL Sender:', item.tx.Account, 
					'\nXRPL Receiver:', item.tx.Destination, 
					'\nXRP Drops Amount:', item.tx.Amount, 
					'\nMemo:', memo);
				payloads.ledger.push(item.tx.inLedger);
				payloads.txHash.push(item.tx.hash);
				payloads.sender.push(item.tx.Account);
				payloads.receiver.push(item.tx.Destination);
				payloads.amount.push(item.tx.Amount);
				payloads.memo.push(memo);
			}
			if (xrplAPI.hasNextPage(response) == true) {
				xrplAPI.requestNextPage(command, params, response)
				.then(next_response => {
					responseIterate(next_response);
				})
			} else {
				if (agent+1 >= agents.length) {
					return registerPayloads(claimPeriodIndex, genesisLedger + (claimPeriodIndex+1)*claimPeriodLength, payloads, false, 0, 0, 0);
				} else {
					return processAgents(payloads, genesisLedger, claimPeriodIndex, claimPeriodLength, ledger, agent+1, 0);
				}
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

	agents = config.contract.agents;
	agents.forEach(function(item, index, array) {
		const agent = RippleKeys.deriveAddress(item);
		agents[index] = agent;
	});

	web3.setProvider(new web3.providers.HttpProvider(config.stateConnectors[n].F.url));

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

async function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
} 

async function xrplConnectRetry(error) {
	console.log('XRPL connecting...');
	console.log(error);
	sleep(1000).then(() => {
		xrplAPI.connect().catch(xrplConnectRetry);
	})
}

async function processFailure(error) {
	console.error('error:', error);
	process.exit();
}

async function updateClaimsInProgress(status) {
	claimsInProgress = status;
	return claimsInProgress;
}

function claimProcessingCompleted() {
	console.log('Claim-period processing complete, waiting for a new claim-period.');
	xrplAPI.disconnect()
	.then(() => {
		return sleep(5000)
		.then(() => {
			return process.exit();
		})
	})
}

app.get('/fxrp', (req, res) => {
	if (claimsInProgress == true) {
		res.status(200).send('Claims already being processed.').end();
	} else {
		updateClaimsInProgress(true)
		.then(result => {
			if (result == true) {
				res.status(200).send('FXRP State Connector initiated.').end();
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



