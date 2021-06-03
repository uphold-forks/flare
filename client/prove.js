'use strict';
process.env.NODE_ENV = 'production';
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const fs = require('fs');

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
// XRPL Specific Functions
// ===============================================================

const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');

async function xrplProcessLedger(currLedger, leaf) {
	console.log('Retrieving XRPL state hash from ledger:', currLedger);
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
			return provePaymentFinality(leaf);
		})
		.catch(error => {
			processFailure(error);
		})
}

async function xrplConfig() {
	let rawConfig = fs.readFileSync('config/config.json');
	config = JSON.parse(rawConfig);
	chains.xrp.api = new RippleAPI({
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
		'petersburg');
	chains.xrp.api.on('connected', () => {
		return run(0);
	})
}

function xrplProofProcessingCompleted() {
	chains.xrp.api.disconnect().catch(processFailure)
		.then(() => {
			return process.exit();
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

async function run(chainId) {
	stateConnector.methods.getLatestIndex(parseInt(chainId)).call({
		from: config.accounts[1].address,
		gas: config.flare.gas,
		gasPrice: config.flare.gasPrice
	}).catch(processFailure)
		.then(result => {
			if (chainId == 0) {
				chains.xrp.api.getTransaction(txId).catch(processFailure)
					.then(tx => {
						if (tx.type == 'payment') {
							const leafPromise = new Promise((resolve, reject) => {
								var destinationTag;
								if (!("tag" in tx.specification.destination)) {
									destinationTag = 0;
								} else {
									destinationTag = tx.specification.destination.tag;
								}
								const amount = parseInt(parseFloat(tx.outcome.deliveredAmount.value) / Math.pow(10, -6));
								var currency;
								if (tx.outcome.deliveredAmount.currency == 'XRP') {
									currency = 'XRP';
								} else {
									currency = tx.outcome.deliveredAmount.currency + tx.outcome.deliveredAmount.counterparty;
								}
								console.log('\nchainId: \t\t', '0', '\n',
									'ledger: \t\t', tx.outcome.ledgerVersion, '\n',
									'txId: \t\t\t', tx.id, '\n',
									'source: \t\t', tx.specification.source.address, '\n',
									'destination: \t\t', tx.specification.destination.address, '\n',
									'destinationTag: \t', destinationTag, '\n',
									'amount: \t\t', amount, '\n',
									'currency: \t\t', currency, '\n');
								const txIdHash = web3.utils.soliditySha3(tx.id);
								const sourceHash = web3.utils.soliditySha3(tx.specification.source.address);
								const destinationHash = web3.utils.soliditySha3(tx.specification.destination.address);
								const destinationTagHash = web3.utils.soliditySha3(destinationTag);
								const amountHash = web3.utils.soliditySha3(amount);
								const currencyHash = web3.utils.soliditySha3(currency);
								const paymentHash = web3.utils.soliditySha3(txIdHash, sourceHash, destinationHash, destinationTagHash, amountHash, currencyHash);
								const leaf = {
									"chainId": '0',
									"txId": tx.id,
									"ledger": parseInt(tx.outcome.ledgerVersion),
									"source": sourceHash,
									"destination": destinationHash,
									"destinationTag": destinationTag,
									"amount": parseInt(amount),
									"currency": currencyHash,
									"paymentHash": paymentHash,
								}
								resolve(leaf);
							})
							leafPromise.then(leaf => {
								if (parseInt(tx.outcome.ledgerVersion) >= result[0] || parseInt(tx.outcome.ledgerVersion) < result[3]) {
									stateConnector.methods.getPaymentFinality(
										leaf.chainId,
										web3.utils.soliditySha3(leaf.txId),
										leaf.source,
										leaf.destination,
										leaf.destinationTag,
										leaf.amount,
										leaf.currency).call({
											from: config.accounts[1].address,
											gas: config.flare.gas,
											gasPrice: config.flare.gasPrice
										}).catch(() => {
										})
										.then(paymentResult => {
											if (typeof paymentResult != "undefined") {
												if ("finality" in paymentResult) {
													if (paymentResult.finality == true) {
														return xrplProofProcessingCompleted('Payment already proven.');
													} else {
														return xrplProcessLedger(parseInt(result.genesisLedger) + parseInt((parseInt(tx.outcome.ledgerVersion) - parseInt(result.genesisLedger)) / parseInt(result.claimPeriodLength)) * parseInt(result.claimPeriodLength) + parseInt(result.claimPeriodLength) - 1, leaf);
													}
												}
											} else {
												return xrplProcessLedger(parseInt(result.genesisLedger) + parseInt((parseInt(tx.outcome.ledgerVersion) - parseInt(result.genesisLedger)) / parseInt(result.claimPeriodLength)) * parseInt(result.claimPeriodLength) + parseInt(result.claimPeriodLength) - 1, leaf);
											}
										})
								} else {
									return processFailure('Transaction not yet finalised on Flare.')
								}
							})
						} else {
							return xrplProofProcessingCompleted('Transaction type not yet supported.');
						}
					})
			} else {
				return processFailure('Invalid chainId.');
			}
		})
}

async function provePaymentFinality(leaf) {
	web3.eth.getTransactionCount(config.accounts[1].address)
		.then(nonce => {
			return [stateConnector.methods.provePaymentFinality(
				leaf.chainId,
				leaf.paymentHash,
				leaf.ledger,
				leaf.txId).encodeABI(), nonce];
		})
		.then(txData => {
			var rawTx = {
				nonce: txData[1],
				gasPrice: web3.utils.toHex(parseInt(config.flare.gasPrice)),
				gas: web3.utils.toHex(config.flare.gas),
				to: stateConnector.options.address,
				from: config.accounts[1].address,
				data: txData[0]
			};
			var tx = new Tx(rawTx, { common: customCommon });
			var key = Buffer.from(config.accounts[1].privateKey, 'hex');
			tx.sign(key);
			var serializedTx = tx.serialize();
			const txHash = web3.utils.sha3(serializedTx);
			console.log('Delivering proof:\t\x1b[33m', txHash, '\x1b[0m');
			web3.eth.getTransaction(txHash)
				.then(txResult => {
					if (txResult == null) {
						web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
							.on('receipt', receipt => {
								if (receipt.status == false) {
									return processFailure('receipt.status == false');
								} else {
									console.log('Proof delivered:\t \x1b[33m' + receipt.transactionHash + '\x1b[0m');
									return xrplProofProcessingCompleted();
								}
							})
							.on('error', error => {
								return processFailure(error);
							});
					} else {
						return processFailure('Already waiting for this transaction to be delivered.');
					}
				})
		})
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
			return run(chainId);
		})
		return chains.xrp.api.connect().catch(xrplConnectRetry);
	} else {
		processFailure('Invalid chainId.');
	}
}

async function web3Config() {
	let rawConfig = fs.readFileSync('config.json');
	config = JSON.parse(rawConfig);
	web3.setProvider(new web3.providers.HttpProvider(config.flare.url));
	web3.eth.handleRevert = true;
	customCommon = Common.forCustomChain('ropsten',
		{
			name: 'coston',
			networkId: config.flare.chainId,
			chainId: config.flare.chainId,
		},
		'petersburg');
	// Read the compiled contract code
	let source = fs.readFileSync("../bin/contracts/StateConnector.json");
	let contract = JSON.parse(source);
	// Create Contract proxy class
	stateConnector = new web3.eth.Contract(contract.abi);
	// Smart contract EVM bytecode as hex
	stateConnector.options.data = '0x' + contract.deployedBytecode;
	stateConnector.options.from = config.accounts[1].address;
	stateConnector.options.address = stateConnectorContract;
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

const chainName = process.argv[2];
const txId = process.argv[3];
if (chainName in chains) {
	return configure(chains[chainName].chainId);
} else {
	processFailure('Invalid chainName');
}