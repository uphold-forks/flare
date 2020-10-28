const fs = require("fs");
const readline = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
});
let rawConfig = fs.readFileSync('config/config.json');
const config = JSON.parse(rawConfig);
console.log('Generate XRPL Testnet credentials at:\nhttps://xrpl.org/xrp-testnet-faucet.html \n');
readline.question(`XRPL Testnet Address: `, (publicKey) => {
	config.contract.agents[0] = publicKey;
	readline.close();
	let newConfig = JSON.stringify(config);
	fs.writeFileSync('config/config.json', newConfig);
})