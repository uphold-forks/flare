'use strict';
process.env.NODE_ENV = 'production';
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

var chainAPI;

// ===============================================================
// XRPL Specific Functions
// ===============================================================

const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');

async function xrplProcessLedgers(payloads) {
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
								return verificationMessage('error');
							}
						}).catch(error => {
							return verificationMessage('error');
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
							return verificationMessage(root);
						} else {
							return verificationMessage('error');
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
			verificationMessage('error');
		})
	}
	return xrplProcessLedger(minLedger);
}

async function xrplConfig() {
	chainAPI = new RippleAPI({
	  server: chainUrl,
	  timeout: 60000
	});
	chainAPI.on('connected', () => {
		return run(0);
	})
}

function verificationMessage(message) {
	chainAPI.disconnect().catch(error => {
		verificationMessage('error');
	})
	.then(() => {
		process.stdout.write(message);
		setTimeout(() => {return process.exit()}, 2500);
	})
}

async function xrplConnectRetry(error) {
	sleep(1000).then(() => {
		chainAPI.connect().catch(xrplConnectRetry);
	})
}

// ===============================================================
// Chain Invariant Functions
// ===============================================================

async function run(chainId) {
	if (chainId == 0) {
		return xrplProcessLedgers([]).catch(error => {
			verificationMessage('error');
		});
	} else {
		return verificationMessage('error');
	}
}

const chainUrl = process.argv[2];
const chainId = parseInt(process.argv[3]);
const minLedger = parseInt(process.argv[4]);
const claimPeriodLength = parseInt(process.argv[5]);
setTimeout(() => {return process.exit()}, 60000);
if (chainId == 0) {
	xrplConfig().catch(error => {
		verificationMessage('error');
	})
	.then(() => {
		return chainAPI.connect().catch(xrplConnectRetry);
	})
} else {
	verificationMessage('error');
}