const fs = require("fs");
const Web3 = require('web3');
const web3 = new Web3();
const RippleAPI = require('ripple-lib').RippleAPI;
const RippleKeys = require('ripple-keypairs');
const Accounts = require('web3-eth-accounts');
const accounts = new Accounts('');
const xrplAPI = new RippleAPI({
	server: 'wss://s.altnet.rippletest.net:51233'
});

const NUM_PAYMENTS = 100000;
const xrplAccount = {
	address: 'rEXiuTnmNa8YaZRZDcQjapXt2xxq5m54NQ',
	privateKey: 'snm2KRWGGiHG1Qxh1ryFUzc7ths6F'
}

const xrplDestination = 'rfBUpzoBh8Q9ShgcxCpkYQLArZnYDZKQDf';

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

async function sendSignal(account, hash) {
	const payment = {
	    "source": {
			"address": account.address,
			"maxAmount": {
				"value": "0.000001",
				"currency": "XRP"
			}
	    },
	    "destination": {
			"address": config.chains[0].signal,
			"amount": {
				"value": "0.000001",
				"currency": "XRP"
			}
		},
		"memos": [{
			"data": hash
		}]
	};
	return xrplAPI.preparePayment(account.address, payment)
	.then(preparedPayment=> {
		return xrplAPI.sign(preparedPayment['txJSON'], account.privateKey)
	})
	.then(signedPayment=> {
		return xrplAPI.submit(signedPayment.signedTransaction)
	})
	.then((response)=> {
		if (response.resultCode != 'tesSUCCESS'){
			console.error('\nError:\n',response);
			process.exit();
		} else {
			console.log('Pointer:\t\x1b[32m', response.tx_json.hash, '\x1b[0m\t', response.tx_json.LastLedgerSequence);
			return;
		}
 	})
}

async function sendPayment(account, paymentsNum) {

	const payment = {
	    "source": {
			"address": account.address,
			"maxAmount": {
				"value": "0.000001",
				"currency": "XRP"
			}
	    },
	    "destination": {
			"address": xrplDestination,
			"amount": {
				"value": "0.000001",
				"currency": "XRP"
			}
		},
		"memos": [{
			"data": web3.utils.soliditySha3(paymentsNum)
		}]
	};

	return xrplAPI.preparePayment(account.address, payment)
	.then(preparedPayment=> {
		return xrplAPI.sign(preparedPayment['txJSON'], account.privateKey)
	})
	.then(signedPayment=> {
		console.log('\nSending payment', NUM_PAYMENTS - paymentsNum + 1, ' to address: ', xrplDestination);
		return xrplAPI.submit(signedPayment.signedTransaction)
	})
	.then((response)=> {
		if (response.resultCode != 'tesSUCCESS'){
			console.error('\nError:\n',response);
			process.exit();
		} else {
			console.log('Payment:\t\x1b[32m', response.tx_json.hash, '\x1b[0m\t', response.tx_json.LastLedgerSequence);
			setTimeout(() => {
				sendSignal(account, response.tx_json.hash)
				.then(()=> {
					if (paymentsNum > 1) {
						setTimeout(() => {
							return sendPayment(account, paymentsNum-1);
						}, 500);
					} else {
						return xrplAPI.disconnect().catch(xrplDisconnectRetry);
					}
				})
			}, 500);
		}
 	})
}

xrplAPI.on('connected', () => {
	console.log('\x1b[34mXRPL connected.\x1b[0m');
	return sendPayment(xrplAccount, NUM_PAYMENTS); 
})

xrplAPI.on('disconnected', () => {
	console.log('XRPL disconnected.\n\n');
	process.exit();
})

console.log('\x1b[4m\nFlare Network FXRP State Connector Client\x1b[0m\n');
let rawConfig = fs.readFileSync('config/config.json');
const config = JSON.parse(rawConfig);
xrplAPI.connect().catch(xrplConnectRetry);