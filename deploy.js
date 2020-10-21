'use strict';
process.env.NODE_ENV = 'production';
const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const fs = require('fs');

var config;
var xrplAPI;
var signal;
var fxrp;
var customCommon;

async function config() {
	let rawConfig = fs.readFileSync('config/config.json');
	config = JSON.parse(rawConfig);
	xrplAPI = new RippleAPI({
		server: config.stateConnectors[0].X.url,
		timeout: 60000
	});
	signal = RippleKeys.deriveAddress(config.contract.agents[0]);
	web3.setProvider(new web3.providers.HttpProvider(config.stateConnectors[0].F.url));
	// Read the compiled contract code
	let source = fs.readFileSync("solidity/fxrp.json");
	let contracts = JSON.parse(source)["contracts"];
	// ABI description as JSON structure
	let abi = JSON.parse(contracts['fxrp.sol:fxrp'].abi);
	// Create Contract proxy class
	fxrp = new web3.eth.Contract(abi);
	// Smart contract EVM bytecode as hex
	fxrp.options.data = '0x' + contracts['fxrp.sol:fxrp'].bin;
	fxrp.options.from = config.stateConnectors[0].F.address;
	customCommon = Common.forCustomChain('ropsten',
						{
							name: 'coston',
							networkId: 14,
							chainId: 14,
						},
        				'petersburg',);
}

config().then(() => {
	xrplAPI.connect().catch(xrplConnectRetry);
})

async function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function xrplConnectRetry(error) {
	console.log('XRPL connecting...')
	sleep(1000).then(() => {
		xrplAPI.connect().catch(xrplConnectRetry);
	})
}

async function xrplDisconnectRetry(error) {
	console.log('XRPL disconnecting...')
	sleep(1000).then(() => {
		xrplAPI.disconnect().catch(xrplDisconnectRetry);
	})
}

async function UNLconfig(n) {
	var UNL = [];
	for (const u of config.stateConnectors[n].UNL){
		UNL.push(config.stateConnectors[u].F.address)
	};
	web3.eth.getTransactionCount(config.stateConnectors[n].F.address)
	.then(nonce => {
		return [fxrp.methods.updateUNL(UNL)
				.encodeABI(), nonce];
	})
	.then(txData => {
		var rawTx = {
			nonce: txData[1],
			gasPrice: web3.utils.toHex(config.evm.gasPrice),
			gas: web3.utils.toHex(config.evm.gas),
			chainId: config.evm.chainId,
			from: config.stateConnectors[n].F.address,
			to: fxrp.options.address,
			data: txData[0]
		}
		var tx = new Tx(rawTx, {common: customCommon});
		var key = Buffer.from(config.stateConnectors[n].F.privateKey, 'hex');
		tx.sign(key);
		var serializedTx = tx.serialize();

		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('receipt', receipt => {
			console.log('State Connector', n+1, 'configured');
			if (n+1 < config.stateConnectors.length) {
				return UNLconfig(n+1);
			} else {
				return;
			}
		});
	}).catch(console.error);
}

xrplAPI.on('connected', () => {
	return xrplAPI.getLedgerVersion()
	.then(sampledLedger => {config.contract.genesisLedger = sampledLedger})
	.then(xrplAPI.disconnect()).catch(xrplDisconnectRetry);
})

xrplAPI.on('disconnected', () => {
	web3.eth.getTransactionCount(config.stateConnectors[0].F.address)
	.then(nonce => {
		return [fxrp.deploy({
			arguments: [config.contract.genesisLedger,
						config.contract.claimPeriodLength,
						config.contract.UNLsize,
						config.contract.VblockingSize]
		}).encodeABI(), nonce];
	})
	.then(contractData => {
		var rawTx = {
			nonce: contractData[1],
			gasPrice: web3.utils.toHex(config.evm.gasPrice),
			gas: web3.utils.toHex(config.evm.gas),
			chainId: config.evm.chainId,
			from: config.stateConnectors[0].F.address,
			data: contractData[0],
			value: web3.utils.toHex(config.contract.balance)
		}
		var tx = new Tx(rawTx, {common: customCommon});
		var key = Buffer.from(config.stateConnectors[0].F.privateKey, 'hex');
		tx.sign(key);
		var serializedTx = tx.serialize();

		web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
		.on('receipt', receipt => {
			fxrp.options.address = receipt.contractAddress;
			config.contract.address = receipt.contractAddress;
			let newConfig = JSON.stringify(config);
			fs.writeFileSync('config/config.json', newConfig);
			console.log("State-connector system deployed.\n\nConfig:");
			console.log(config.contract);
			console.log("")
			sleep(5000)
			.then(() => {
				return UNLconfig(0);
			});
		})
		.on('error', error => {
			console.log(error);
		});
	}).catch(console.error);
})



