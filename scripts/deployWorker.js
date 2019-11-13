const EthDeployer = require('moonwalker').default
const HDWalletProvider = require('truffle-hdwallet-provider')

const MNEMONIC = process.env.MNEMONIC
const API_KEY = process.env.API_KEY

// const url = `https://ropsten.infura.io/v3/${API_KEY}`
const url = `https://mainnet.infura.io/v3/${API_KEY}`

const wallet = new HDWalletProvider(MNEMONIC, url, 0, 2)

async function consume() {
  const q = await EthDeployer.getQueue()
  const worker = new EthDeployer.Worker(
    wallet, q, {
      from: '0x78AE2fe5ab0b3f362890Bf88f4994d75405683f8',
      gas: 6000000,
      gasPrice: '15000000000' // 15 gwei
    },
    `${process.cwd()}/build/contracts`,
    6 // blockConfirmation
  )
  await worker.start('deposit-test-1')
  return 'worker started...'
}

consume().then(console.log)
