'use strict';
process.env.NODE_ENV = 'production';
const RippleAPI = require('ripple-lib').RippleAPI;
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const fs = require('fs');
const xrplAPI = new RippleAPI({
	server: 'wss://s.altnet.rippletest.net:51233'
});

var config;
var stateConnector;
var customCommon;

async function config() {
	let rawConfig = fs.readFileSync('config/config.json');
	config = JSON.parse(rawConfig);
	web3.setProvider(new web3.providers.HttpProvider(config.stateConnectors[0].F.url));
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
	stateConnector.options.from = config.stateConnectors[0].F.address;
	customCommon = Common.forCustomChain('ropsten',
						{
							name: 'coston',
							networkId: 16,
							chainId: 16,
						},
        				'petersburg',);
}

xrplAPI.on('connected', () => {
	config().then(() => {
		xrplAPI.getLedgerVersion().catch(console.error)
		.then(sampledLedger => {
			config.contract.genesisLedger = sampledLedger;
			return web3.eth.getTransactionCount(config.stateConnectors[0].F.address)
		})
		.then(nonce => {
			return [stateConnector.deploy({
				arguments: [config.contract.genesisLedger,
							config.contract.claimPeriodLength]
			}).encodeABI(), nonce];
		})
		.then(contractData => {
			var rawTx = {
				nonce: contractData[1],
				gasPrice: web3.utils.toHex(config.evm.gasPrice),
				gas: web3.utils.toHex(config.evm.contractGas),
				chainId: config.evm.chainId,
				from: config.stateConnectors[0].F.address,
				data: contractData[0]
			}
			var tx = new Tx(rawTx, {common: customCommon});
			var key = Buffer.from(config.stateConnectors[0].F.privateKey, 'hex');
			tx.sign(key);
			var serializedTx = tx.serialize();

			web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
			.on('receipt', receipt => {
				stateConnector.options.address = receipt.contractAddress;
				config.contract.address = receipt.contractAddress;
				let newConfig = JSON.stringify(config);
				fs.writeFileSync('config/config.json', newConfig);
				console.log("\nGlobal config:");
				console.log(config.contract);
				console.log("State-connector system deployed, configuring node endpoints...")
				sleep(10000)
				.then(() => {
					return UNLconfig(0);
				});
			})
			.on('error', error => {
				console.log(error);
			});
		}).catch(console.error);
	})
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
		return [stateConnector.methods.updateUNLpointer(UNL)
				.encodeABI(), nonce];
	})
	.then(txData => {
		var rawTx = {
			nonce: txData[1],
			gasPrice: web3.utils.toHex(config.evm.gasPrice),
			gas: web3.utils.toHex(config.evm.contractGas),
			chainId: config.evm.chainId,
			from: config.stateConnectors[n].F.address,
			to: stateConnector.options.address,
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
				return xrplAPI.disconnect().catch(xrplDisconnectRetry);
			}
		});
	}).catch(console.error);
}

xrplAPI.connect().catch(xrplConnectRetry);


