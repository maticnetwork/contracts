const contracts = require('../contractAddresses.json')

const RootToken = artifacts.require('TestToken')
const StakeManager = artifacts.require('StakeManager')

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

module.exports = async function(callback) {
  try {
    await stake()
    // await updateCheckpointReward(web3.utils.toWei('10'))
  } catch(e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
