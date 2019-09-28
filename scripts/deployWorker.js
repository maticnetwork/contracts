const EthDeployer = require('moonwalker').default
const HDWalletProvider = require('truffle-hdwallet-provider')
// const Web3 = require('web3')

const MNEMONIC = 'clock radar mass judge dismiss just intact mind resemble fringe diary casino'
const url = 'https://testnet2.matic.network'
// const url = 'http://localhost:8545'

const wallet = new HDWalletProvider(MNEMONIC, url, 0, 2)

async function consume() {
  const q = await EthDeployer.getQueue()
  const worker = new EthDeployer.Worker(
    wallet, q, {
      from: '0x9fB29AAc15b9A4B7F17c3385939b007540f4d791',
      gas: 6000000,
      gasPrice: '1000000000' // 1 gwei
    },
    `${process.cwd()}/build/contracts`,
    1 // blockConfirmation
  )
  await worker.start('deposit-test-1')
  return 'worker started...'
}

// async function consume() {
//   const web3 = new Web3(url)
//   console.log(await web3.eth.getAccounts())
// }

consume().then(console.log)
