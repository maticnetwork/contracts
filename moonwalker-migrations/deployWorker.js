const EthDeployer = require('moonwalker').default
const HDWalletProvider = require('truffle-hdwallet-provider')

const MNEMONIC = process.env.MNEMONIC || 'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
const API_KEY =  process.env.API_KEY

const url = `https://mainnet.infura.io/v3/${API_KEY}`
// const url = `http://localhost:9545`

const wallet = new HDWalletProvider(MNEMONIC, url)

async function consume() {
  const q = await EthDeployer.getQueue()
  const worker = new EthDeployer.Worker(
    wallet, q, {
      from: process.env.FROM || '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791',
      gas: 1000000,
      gasPrice: '45000000000' // 45 gwei
    },
    `${process.cwd()}/build`,
    0 // blockConfirmation
  )
  await worker.start('default-deposit-q')
  return 'worker started...'
}

consume().then(console.log)
