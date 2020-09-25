const fs = require("fs");
const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');
const Accounts = require('web3-eth-accounts');
const accounts = new Accounts('');
const xrplAPI = new RippleAPI({
	server: 'wss://s.altnet.rippletest.net:51233'
});

var agents;
const PAYMENTS_PER_AGENT = 100;

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

async function sendPayment(agentNum, agentX, testAddress, paymentsNum) {
	const payment = {
	    "source": {
			"address": agentX.address,
			"maxAmount": {
				"value": "0.000001",
				"currency": "XRP"
			}
	    },
	    "destination": {
			"address": agents[agentNum],
			"amount": {
				"value": "0.000001",
				"currency": "XRP"
			}
		},
		"memos": [{
			"data": testAddress
		}]
	};
	return xrplAPI.preparePayment(agentX.address, payment)
	.then(preparedPayment=> {
		return xrplAPI.sign(preparedPayment['txJSON'], agentX.privateKey)
	})
	.then(signedPayment=> {
		console.log('\nSending payment', parseInt(agentNum)*PAYMENTS_PER_AGENT+(PAYMENTS_PER_AGENT-parseInt(paymentsNum))+1, ' to address: ', agents[agentNum]);
		return xrplAPI.submit(signedPayment.signedTransaction)
	})
	.then((response)=> {
		if (response.resultCode != 'tesSUCCESS'){
			console.error('\nError:\n',response);
			process.exit();
		} else {
			console.log('Success:\x1b[32m', response.tx_json.hash, '\x1b[0m');
			if (paymentsNum > 1) {
				return sendPayment(agentNum, agentX, testAddress, paymentsNum-1);
			} else {
				if (parseInt(agentNum) + 1 < agents.length) {
					return sendPayment(parseInt(agentNum) + 1, agentX, testAddress, PAYMENTS_PER_AGENT); 
				} else {
					return xrplAPI.disconnect().catch(xrplDisconnectRetry);
				}
			}
		}
 	})
}

xrplAPI.on('connected', () => {
	console.log('\x1b[34mXRPL connected.\x1b[0m');
	return sendPayment(0, config.stateConnectors[0].X, config.contract.testAddress, PAYMENTS_PER_AGENT); 
})

xrplAPI.on('disconnected', () => {
	console.log('XRPL disconnected.\n\n');
	process.exit();
})

console.log('\x1b[4m\nFlare Network FXRP State Connector Client\x1b[0m\n');
let rawConfig = fs.readFileSync('config.json');
const config = JSON.parse(rawConfig);
agents = config.contract.agents;
agents.forEach(function(item, index, array) {
	const agent = RippleKeys.deriveAddress(item);
	agents[index] = agent;
	if (index + 1 >= agents.length) {
		xrplAPI.connect().catch(xrplConnectRetry);
	}
})


