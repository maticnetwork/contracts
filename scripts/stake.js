const contracts = require('../contractAddresses.json')

const RootToken = artifacts.require('TestToken')
const StakeManager = artifacts.require('StakeManager')
const ChildERC20 = artifacts.require('ChildERC20')
const TestToken = artifacts.require('TestToken')
const DepositManager = artifacts.require('DepositManager')

async function getStakeManager() {
  return StakeManager.at(contracts.root.StakeManager)
}

async function stake() {
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
  const stake = await stakeManager.stakeFor(address, amount, 0, address, false)
  console.log('staked; txHash is', stake.tx)
}

async function topUpForFee(address, amount) {
  const stakeManager = await getStakeManager()
  const validatorId = await stakeManager.signerToValidator('0x25bE188468B1245Ab95037C238a24ee723493fE9')
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
  console.log(r)
  const depositManager = await DepositManager.at(contracts.root.DepositManagerProxy)
  let r = await depositManager.depositERC20(contracts.root.tokens.TestToken, amount)
  console.log(r)
  const childToken = await ChildERC20.at(contracts.child.tokens.TestToken)
  console.log((await childToken.balanceOf('0x907f2e1F4A477319A700fC9a28374BA47527050e')).toString())
}

module.exports = async function(callback) {
  try {
    await stake()
  } catch(e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
