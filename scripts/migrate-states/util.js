const Web3 = require('web3');

const oldChainProvider = new Web3.providers.HttpProvider(process.env.OLD_CHAIN_PROVIDER || 'http://localhost:9546');
const newChainProvider = new Web3.providers.HttpProvider(process.env.NEW_CHAIN_PROVIDER || 'http://localhost:9545');

const oldChain = new Web3(oldChainProvider);
const newChain = new Web3(newChainProvider);

const privateKey = process.env.PRIVATE_KEY; // Private key of the account that will call the functions
const fromAccount = newChain.eth.accounts.privateKeyToAccount(privateKey).address;

const newChainId = process.env.NEW_CHAIN_ID || 11155111; // Chain ID of sepolia

exports.oldChain = oldChain;
exports.newChain = newChain;
exports.fromAccount = fromAccount;
exports.privateKey = privateKey;
exports.newChainId = newChainId;