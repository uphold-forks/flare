const fs = require("fs");
const readline = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
});
let rawConfig = fs.readFileSync('config/config.json');
const config = JSON.parse(rawConfig);

var xrplAPI = new RippleAPI({
	server: config.stateConnectors[0].X.url,
	timeout: 60000
});

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

xrplAPI.connect().catch(xrplConnectRetry);
xrplAPI.on('connected', () => {
	return xrplAPI.getLedgerVersion()
	.then(sampledLedger => {
		config.contract.genesisLedger = sampledLedger;
		console.log('Generate XRPL Testnet credentials at:\nhttps://xrpl.org/xrp-testnet-faucet.html \n');
		readline.question(`XRPL Testnet Address: `, (publicKey) => {
			config.contract.agents[0] = publicKey;
			readline.close();
			let newConfig = JSON.stringify(config);
			fs.writeFileSync('config/config.json', newConfig);
		})
	})
	.then(xrplAPI.disconnect()).catch(xrplDisconnectRetry);
})