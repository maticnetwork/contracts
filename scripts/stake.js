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
  console.log(`Staking ${amount} for ${stakeFor}...`)

  const accounts = await web3.eth.getAccounts()
  const stakeManager = await getStakeManager()
  const rootToken = await RootToken.at(contracts.root.tokens.TestToken)
  console.log({ stakeManager: stakeManager.address, rootToken: rootToken.address })
  console.log('Sender accounts has a balanceOf', (await rootToken.balanceOf(accounts[0])).toString())
  await rootToken.approve(stakeManager.address, amount)
  console.log('approved, staking now...')
  const stake = await stakeManager.stakeFor(stakeFor, amount, 0, stakeFor, false)
  console.log('staked; txHash is', stake.tx)
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

module.exports = async function(callback) {
  try {
    await stake()
    // await topUpForFee()
    // await updateValidatorThreshold(20)
    // await deposit()
  } catch(e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
