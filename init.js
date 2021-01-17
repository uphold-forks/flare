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
	stateConnector.options.address = config.stateConnector.contract;
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
		return [stateConnector.methods.initialiseChains().encodeABI(), nonce];
	})
	.then(contractData => {
		var rawTx = {
			nonce: contractData[1],
			gasPrice: web3.utils.toHex(config.flare.gasPrice),
			gas: web3.utils.toHex(config.flare.contractGas),
			chainId: config.flare.chainId,
			from: config.stateConnector.address,
			to: config.stateConnector.contract,
			data: contractData[0]
		}
		var tx = new Tx(rawTx, {common: customCommon});
		var key = Buffer.from(config.stateConnector.privateKey, 'hex');
		tx.sign(key);
		var serializedTx = tx.serialize();
		
		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('receipt', receipt => {
			console.log(receipt);
			console.log("State-connector contract initialised.");
			setTimeout(() => {
				stateConnector.methods.getGovernanceContract().call({
					from: config.stateConnector.address,
					to: config.stateConnector.contract,
					gas: config.flare.gas,
					gasPrice: config.flare.gasPrice})
				.then(result => {
					console.log(result);
					setTimeout(() => {return process.exit()}, 2500);
				})
				//
			}, 5000);
		})
		.on('error', error => {
			console.log(error);
		});
	}).catch(console.error);
})
