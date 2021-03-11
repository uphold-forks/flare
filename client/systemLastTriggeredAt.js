'use strict';
process.env.NODE_ENV = 'production';
const Web3 = require('web3');
const web3 = new Web3();
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;
const fs = require('fs');
const express = require('express');
const app = express();

const systemTriggerAddress = "0x1000000000000000000000000000000000000002";
var config,
	customCommon,
	systemTrigger;

async function web3Config() {
	let rawConfig = fs.readFileSync('config.json');
	config = JSON.parse(rawConfig);
	// console.log(config);
	web3.setProvider(new web3.providers.HttpProvider(config.flare.url));
	web3.eth.handleRevert = true;
	customCommon = Common.forCustomChain('ropsten',
		{
			name: 'coston',
			networkId: config.flare.chainId,
			chainId: config.flare.chainId,
		},
		'petersburg',);
	// Read the compiled contract code
	let source = fs.readFileSync("../bin/contracts/FlareKeeper.json");
	let contract = JSON.parse(source);
	// Create Contract proxy class
	systemTrigger = new web3.eth.Contract(contract.abi);
	// Smart contract EVM bytecode as hex
	systemTrigger.options.data = '0x' + contract.deployedBytecode;
	systemTrigger.options.from = config.accounts[0].address;
	systemTrigger.options.address = systemTriggerAddress;
}

return web3Config()
.then(() => {
	systemTrigger.methods.systemLastTriggeredAt().call(function(err, res){
	    console.log(res);
	});
})