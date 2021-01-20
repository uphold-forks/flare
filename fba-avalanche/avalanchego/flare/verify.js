'use strict';
process.env.NODE_ENV = 'production';
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const express = require('express');
const app = express();

// ===============================================================
// XRPL Specific Functions
// ===============================================================

const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');

async function xrplProcessLedgers(res, chainAPI, chainId, minLedger, claimPeriodLength, claimPeriodHash, payloads) {
	async function xrplProcessLedger(currLedger) {
		const command = 'ledger';
		const params = {
			'ledger_index': parseInt(currLedger),
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
						const leafPromise = new Promise((resolve, reject) => {
							var destinationTag;
							if (!("DestinationTag" in item)) {
								destinationTag = 0;
							} else {
								destinationTag = item.DestinationTag;
							}
							const chainIdHash = web3.utils.soliditySha3('0');
							const ledgerHash = web3.utils.soliditySha3(response.ledger.seqNum);
							const txHash = web3.utils.soliditySha3(item.hash);
							const accountsHash = web3.utils.soliditySha3(web3.utils.soliditySha3(item.Account, item.Destination), destinationTag);
							const amountHash = web3.utils.soliditySha3(item.metaData.delivered_amount);
							const leafHash = web3.utils.soliditySha3(chainIdHash, ledgerHash, txHash, accountsHash, amountHash);
							resolve(leafHash);
						})
						return await leafPromise.then(newPayload => {
							payloads[payloads.length] = newPayload;
							if (payloads.length == prevLength + 1) {
								if (i+1 < numTransactions) {
									return transactionIterate(response.ledger.transactions[i+1], i+1, numTransactions);
								} else {
									return checkResponseCompletion(response);
								}
							} else {
								return res.status(500).send("Error.").end().then(process.exit());
							}
						}).catch(error => {
							return res.status(500).send("Error.").end().then(process.exit());
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
					} else if (parseInt(currLedger)+1 < parseInt(minLedger) + parseInt(claimPeriodLength)) {
						return xrplProcessLedger(parseInt(currLedger)+1);
					} else {
						var root;
						if (payloads.length > 0) {
							const tree = new MerkleTree(payloads, keccak256, {sort: true});
							root = tree.getHexRoot();
						} else {
							root = "0x0000000000000000000000000000000000000000000000000000000000000000";
						}
						if (root == claimPeriodHash) {
							res.status(200).send("Correct.").end()
							.then(process.exit());
						} else {
							res.status(404).send("Incorrect.").end()
							.then(process.exit());
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
			return res.status(500).send("Error.").end().then(process.exit());
		})
	}
	return xrplProcessLedger(minLedger);
}

async function run(res, chainAPI, chainId, minLedger, claimPeriodLength, claimPeriodHash) {
	if (parseInt(chainId) == 0) {
		return xrplProcessLedgers(res, chainAPI, chainId, minLedger, claimPeriodLength, claimPeriodHash, []).catch(error => {
			res.status(500).send("Error.").end().then(process.exit());
		});
	} else {
		return res.status(500).send("Error.").end().then(process.exit());
	}
}

async function xrpVerify(res, url, chainId, minLedger, claimPeriodLength, claimPeriodHash) {
	var chainAPI = new RippleAPI({
	  server: url,
	  timeout: 60000
	});
	chainAPI.on('connected', () => {
		return run(res, chainAPI, chainId, minLedger, claimPeriodLength, claimPeriodHash);
	})
	async function xrplConnectRetry(error) {
		console.log('Connecting...');
		setTimeout(() => {chainAPI.connect().catch(xrplConnectRetry)}, 1000);
	}
	return chainAPI.connect().catch(xrplConnectRetry);
}

app.get('/', (req, res) => {
	if ("verify" in req.query) {
		if (req.query.verify.length == 256) {
			setTimeout((res) => {res.status(500).send("Error.").end().then(process.exit());}, 60000);
			var chainId = web3.eth.abi.decodeParameter('uint256', req.query.verify.substring(0,64));
			var maxLedger = web3.eth.abi.decodeParameter('uint256', req.query.verify.substring(64,128));
			var claimPeriodLength = web3.eth.abi.decodeParameter('uint256', req.query.verify.substring(128,192));
			var claimPeriodHash = web3.eth.abi.decodeParameter('bytes32', req.query.verify.substring(192,256));
			var minLedger = parseInt(maxLedger)-parseInt(claimPeriodLength);
			var url = process.argv[3+parseInt(chainId)];
			if (chainId == 0) {
				return xrpVerify(res, url, chainId, minLedger, claimPeriodLength, claimPeriodHash);
			} else {
				res.status(500).send("Error.").end().then(process.exit());
			}
		} else {
			res.status(500).send("Error.").end().then(process.exit());
		}
	} else if ("stop" in req.query) {
		res.status(205).send("Stopped.").end().then(process.exit());
	} else {
		res.status(204).send("Alive.").end();
	}
});
// Start the server
const PORT = process.env.PORT || parseInt(process.argv[2]);
app.listen(PORT, () => {
});
module.exports = app;