const contracts = require('../contractAddresses.json')

const RootToken = artifacts.require('TestToken')
const StakeManager = artifacts.require('StakeManager')
const ChildERC20 = artifacts.require('ChildERC20')
const TestToken = artifacts.require('TestToken')
const DepositManager = artifacts.require('DepositManager')

async function getStakeManager() {
  return StakeManager.at(contracts.root.StakeManagerProxy)
}

async function stake() {
  console.log(process.argv)
  const stakeFor = process.argv[6]
  const amount = web3.utils.toWei(process.argv[7])
  const topup = web3.utils.toWei(process.argv[8])
  const pubkey = process.argv[9]
  console.log(`Staking ${amount} for ${stakeFor}...`)

  const accounts = await web3.eth.getAccounts()
  const stakeManager = await getStakeManager()

  // const rootToken = await RootToken.at(contracts.root.tokens.TestToken)
  // console.log({ stakeManager: stakeManager.address, rootToken: rootToken.address })
  // console.log('Sender accounts has a balanceOf', (await rootToken.balanceOf(accounts[0])).toString())
  // await rootToken.approve(stakeManager.address, web3.utils.toWei('1000000'))
  // console.log('approved, staking now...')

  // stakeManager.stakeFor('0x925a91f8003aaeabea6037103123b93c50b86ca3', amount, topup, true, '0xa312814042a6655c8e5ecf0c52cba0b6a6f3291c87cc42260a3c0222410c0d0d59b9139d1c56542e5df0ce2fce3a86ce13e93bd9bde0dc8ff664f8dd5294dead')
  // await wait(3)
  // stakeManager.stakeFor('0xc787af4624cb3e80ee23ae7faac0f2acea2be34c', amount, topup, true, '0x69536ae98030a7e83ec5ef3baffed2d05a32e31d978e58486f6bdb0fbbf240293838325116090190c0639db03f9cbd8b9aecfd269d016f46e3a2287fbf9ad232')
  // await wait(3)
  // stakeManager.stakeFor('0x1c4f0f054a0d6a1415382dc0fd83c6535188b220', amount, topup, true, '0x6434e10a34ade13c4fea917346a9fd1473eac2138a0b4e2a36426871918be63188fde4edbf598457592c9a49fe3b0036dd5497079495d132e5045bf499c4bdb1')
  // await wait(3)
  // stakeManager.stakeFor('0x461295d3d9249215e758e939a150ab180950720b', amount, topup, true, '0xd9d09f2afc9da3cccc164e8112eb6911a63f5ede10169768f800df83cf99c73f944411e9d4fac3543b11c5f84a82e56b36cfcd34f1d065855c1e2b27af8b5247')
  // await wait(3)
  // await stakeManager.stakeFor('0x836fe3e3dd0a5f77d9d5b0f67e48048aaafcd5a0', amount, topup, true, '0xa36f6ed1f93acb0a38f4cacbe2467c72458ac41ce3b12b34d758205b2bc5d930a4e059462da7a0976c32fce766e1f7e8d73933ae72ac2af231fe161187743932')
  // await wait(3)

  // stakeManager.stakeFor('0xC50fe6eea35B73a18F22C14c75456ea3BB01B25e', amount, topup, true, '0x0e328f024b0ce1bc3bcbddc0ea3120bb1ba575686a6528bc6547fb5b7dd77d1c720e1607841048549fe38076ba9f25dbb5d3d12e13392747df8175d6f46d035d')
  // await wait(3)
  // stakeManager.stakeFor('0xeA0f0CF25E2AeA2d09c742Ed04c80679372B81b7', amount, topup, true, '0x67e855742eeee3ea65c22ce3fc94768ea7f8fa5f9290346cf8bc22ef5deef1fba01a3b0c0fe68ac17c2b16ad07eb4de2d7e437c767845e7d02ae093e48144cd4')
  // await wait(3)
  // stakeManager.stakeFor('0x97bD5d7d2BDb3C7c2C5aF6c2c8ecd40f58B0e37D', amount, topup, true, '0x03b36af2ee44dfc0499f25127358a2468677e8133a9db4311f273f63ee2d6e5ce6e1f1db30c2fde519e27221f97e74926f2e25771614f1aaa09069c3e502150d')
  // await wait(3)
  // stakeManager.stakeFor('0xc70C6ea5336ae88a581b1336E774F53Aed3BF64E', amount, topup, true, '0xdd0f2f27cae91cd1774992f0daad844b3cad642e85bde5a72baea321e3aa6d7f6bc313ed89c74ea5cee3775fec8ada3f4afef59e989f4264a7fbd7478b732204')
  // await wait(3)
  // await stakeManager.stakeFor('0x25bE188468B1245Ab95037C238a24ee723493fE9', amount, topup, true, '0x8e0211eb2d420ae5e28a5440c2839f60087f8539f9ce20f9032c9f423f8ed30570fff0331de57c27122b347c7dad1a50230cf4d8bc1672a38a1517ba8161dea1')
  // await wait(30)
}

function wait(s) {
  return new Promise((resolve, reject) => {
    setTimeout(_ => resolve(), s * 1000);
  })
}

async function topUpForFee() {
  const stakeFor = process.argv[6]
  const amount = web3.utils.toWei(process.argv[7])
  const stakeManager = await getStakeManager()

  const rootToken = await RootToken.at(contracts.root.tokens.TestToken)
  await rootToken.approve(stakeManager.address, amount)
  console.log('approved, staking now...')

  const validatorId = await stakeManager.signerToValidator(stakeFor)
  console.log(validatorId.toString())
  let r = await stakeManager.topUpForFee(validatorId.toString(), amount)
  console.log(r.tx)
}

async function updateValidatorThreshold(number) {
  const stakeManager = await getStakeManager()
  console.log((await stakeManager.validatorThreshold()).toString())
  const r = await stakeManager.updateValidatorThreshold(number)
  console.log(r.tx)
  console.log((await stakeManager.validatorThreshold()).toString())
}

async function updateCheckpointReward(reward) {
  const stakeManager = await getStakeManager()
  console.log((await stakeManager.CHECKPOINT_REWARD()).toString())
  const r = await stakeManager.updateCheckpointReward(reward)
  console.log(r.tx)
  console.log((await stakeManager.CHECKPOINT_REWARD()).toString())
}

async function deposit() {
  const amount = web3.utils.toWei(process.argv[6])
  console.log(`Depositing ${amount}...`)
  const testToken = await TestToken.at(contracts.root.tokens.TestToken)
  let r = await testToken.approve(contracts.root.DepositManagerProxy, amount)
  console.log('approved', r.tx)
  const depositManager = await DepositManager.at(contracts.root.DepositManagerProxy)
  r = await depositManager.depositERC20(contracts.root.tokens.TestToken, amount)
  console.log('deposited', r.tx)
}

module.exports = async function (callback) {
  try {
    // await stake()
    // await topUpForFee()
    await updateValidatorThreshold(60)
    // await deposit()
    // await updateCheckpointReward(web3.utils.toWei('100'))
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
