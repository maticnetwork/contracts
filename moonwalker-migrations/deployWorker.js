const EthDeployer = require('moonwalker').default
const HDWalletProvider = require('truffle-hdwallet-provider')

const MNEMONIC = process.env.MNEMONIC || 'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
const API_KEY =  process.env.API_KEY

// const url = `https://ropsten.infura.io/v3/${API_KEY}`
// const url = `https://mainnet.infura.io/v3/${API_KEY}`
const url = `http://localhost:8545`

const wallet = new HDWalletProvider(MNEMONIC, url, 0, 2)

async function consume() {
  const q = await EthDeployer.getQueue()
  const worker = new EthDeployer.Worker(
    wallet, q, {
      from: '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791',
      gas: 7000000,
      gasPrice: '10000000000' // 10 gwei
    },
    `${process.cwd()}/build/contracts`,
    1 // blockConfirmation
  )
  await worker.start('deposit-test-1')
  return 'worker started...'
}

consume().then(console.log)
