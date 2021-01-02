'use strict';
process.env.NODE_ENV = 'production';
const RippleAPI = require('ripple-lib').RippleAPI;
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const fs = require('fs');

var config;
var stateConnector;
var customCommon;

async function config() {
	let rawConfig = fs.readFileSync('config/config.json');
	config = JSON.parse(rawConfig);
	web3.setProvider(new web3.providers.HttpProvider(config.flare.url));
	web3.eth.handleRevert = true;
	// Read the compiled contract code
	let source = fs.readFileSync("solidity/stateConnector.json");
	let contracts = JSON.parse(source)["contracts"];
	// ABI description as JSON structure
	let abi = JSON.parse(contracts['stateConnector.sol:stateConnector'].abi);
	// Create Contract proxy class
	stateConnector = new web3.eth.Contract(abi);
	// Smart contract EVM bytecode as hex
	stateConnector.options.data = '0x' + contracts['stateConnector.sol:stateConnector'].bin;
	stateConnector.options.from = config.stateConnector.address;
	customCommon = Common.forCustomChain('ropsten',
						{
							name: 'coston',
							networkId: 16,
							chainId: 16,
						},
        				'petersburg',);
}

config().then(() => {
	web3.eth.getTransactionCount(config.stateConnector.address)
	.then(nonce => {
		return [stateConnector.deploy({
			arguments: [config.stateConnector.address, 1]
		}).encodeABI(), nonce];
	})
	.then(contractData => {
		var rawTx = {
			nonce: contractData[1],
			gasPrice: web3.utils.toHex(config.flare.gasPrice),
			gas: web3.utils.toHex(config.flare.contractGas),
			chainId: config.flare.chainId,
			from: config.stateConnector.address,
			data: contractData[0]
		}
		var tx = new Tx(rawTx, {common: customCommon});
		var key = Buffer.from(config.stateConnector.privateKey, 'hex');
		tx.sign(key);
		var serializedTx = tx.serialize();
		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('receipt', receipt => {
			stateConnector.options.address = receipt.contractAddress;
			config.stateConnector.contract = receipt.contractAddress;
			let newConfig = JSON.stringify(config);
			fs.writeFileSync('config/config.json', newConfig);
			console.log("\nGlobal config:");
			console.log(config);
			console.log("State-connector contract deployed, configuring chain endpoints...")
			sleep(10000)
			.then(() => {
				return chainConfig(0);
			});
		})
		.on('error', error => {
			console.log(error);
		});
	}).catch(console.error);
})

async function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function chainConfig(n) {
	web3.eth.getTransactionCount(config.stateConnector.address)
	.then(nonce => {
		return [stateConnector.methods.addChain(n, config.chains[n].genesisLedger, config.chains[n].claimPeriodLength
		).encodeABI(), nonce];
	})
	.then(txData => {
		var rawTx = {
			nonce: txData[1],
			gasPrice: web3.utils.toHex(config.flare.gasPrice),
			gas: web3.utils.toHex(config.flare.contractGas),
			chainId: config.flare.chainId,
			from: config.stateConnector.address,
			to: stateConnector.options.address,
			data: txData[0]
		}
		var tx = new Tx(rawTx, {common: customCommon});
		var key = Buffer.from(config.stateConnector.privateKey, 'hex');
		tx.sign(key);
		var serializedTx = tx.serialize();

		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('receipt', receipt => {
			console.log(config.chains[n].name, 'configured');
			if (n+1 < config.chains.length) {
				sleep(10000)
				.then(() => {
					return chainConfig(n+1);
				});
			} else {
				process.exit();
			}
		})
		.on('error', error => {
			console.log(error);
		});
	}).catch(console.error);
}

