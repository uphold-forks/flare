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
							console.log('chainId: \t\t', '0', '\n',
								'ledger: \t\t', response.ledger.seqNum, '\n',
								'txId: \t\t\t', item.hash, '\n',
								'source: \t\t', item.Account, '\n',
								'destination: \t\t', item.Destination, '\n',
								'destinationTag: \t', String(destinationTag), '\n',
								'amount: \t\t', parseInt(item.metaData.delivered_amount), '\n');
							const chainIdHash = web3.utils.soliditySha3('0');
							const ledgerHash = web3.utils.soliditySha3(response.ledger.seqNum);
							const txHash = web3.utils.soliditySha3(item.hash);
							const accountsHash = web3.utils.soliditySha3(item.Account, item.Destination, destinationTag);
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
								return verificationComplete(chainAPI, chainId, "Unable to append to payloads[].");
							}
						}).catch(error => {
							return verificationComplete(chainAPI, chainId, error);
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
						if (payloads.length > 0) {
							const tree = new MerkleTree(payloads, keccak256, {sort: true});
							const root = tree.getHexRoot();
							console.log('Num Payloads:\t\t', payloads.length);
							console.log(root);
							console.log(claimPeriodHash);
							return verificationComplete(chainAPI, chainId, "Verification complete.");
						} else {
							return verificationComplete(chainAPI, chainId, "payloads.length == 0");
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
			return verificationComplete(chainAPI, chainId, error);
		})
	}
	return xrplProcessLedger(minLedger);
}

function verificationComplete(chainAPI, chainId, message) {
	console.log(message);
	if (parseInt(chainId) == 0) {
		chainAPI.disconnect().catch(process.exit());
	}
	setTimeout(() => {return process.exit()}, 5000);
}

async function run(res, chainAPI, chainId, minLedger, claimPeriodLength, claimPeriodHash) {
	if (parseInt(chainId) == 0) {
		return xrplProcessLedgers(res, chainAPI, chainId, minLedger, claimPeriodLength, claimPeriodHash, []).catch(error => {
			verificationComplete(chainAPI, chainId, error);
		});
	} else {
		return verificationComplete(chainAPI, chainId, "Invalid chainId.");
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
		sleep(1000).then(() => {
			chainAPI.connect().catch(xrplConnectRetry);
		})
	}
	return chainAPI.connect().catch(xrplConnectRetry);
}

setTimeout(() => {return process.exit()}, 300000);
app.get('/', (req, res) => {
	if ("verify" in req.query) {
		if (req.query.verify.length == 256) {
			var chainId = web3.eth.abi.decodeParameter('uint256', req.query.verify.substring(0,64));
			var maxLedger = web3.eth.abi.decodeParameter('uint256', req.query.verify.substring(64,128));
			var claimPeriodLength = web3.eth.abi.decodeParameter('uint256', req.query.verify.substring(128,192));
			var minLedger = parseInt(maxLedger)-parseInt(claimPeriodLength);
			var claimPeriodHash = web3.eth.abi.decodeParameter('bytes32', req.query.verify.substring(192,256));
			var url = process.argv[3+parseInt(chainId)];
			if (chainId == 0) {
				return xrpVerify(res, url, chainId, minLedger, claimPeriodLength, claimPeriodHash);
			} else {
				res.status(404).send('Chain not found.').end();
			}
		} else {
			res.status(500).send("Invalid request.").end();
		}
	} else {
		res.status(200).send("Alive.").end();
	}
});
// Start the server
const PORT = process.env.PORT || parseInt(process.argv[2]);
app.listen(PORT, () => {
});
module.exports = app;