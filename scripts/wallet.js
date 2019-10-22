const Wallet = require('ethereumjs-wallet')
var EthUtil = require('ethereumjs-util');

const wallet = Wallet.fromPrivateKey(EthUtil.toBuffer('0xc8deb0bea5c41afe8e37b4d1bd84e31adff11b09c8c96ff4b605003cce067cd9'));
console.log(JSON.stringify(wallet.toV3('OqnV*12q$')))
