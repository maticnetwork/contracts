const contracts = require('../contractAddresses.json')

const RootToken = artifacts.require('TestToken')
const StakeManager = artifacts.require('StakeManager')
const ValidatorShare = artifacts.require('ValidatorShare')

async function getStakeManager() {
  return StakeManager.at(contracts.root.StakeManager)
}

async function stake() {
  const accounts = await web3.eth.getAccounts()
  const stakeFor = accounts[0]
  const amount = web3.utils.toWei('1000')
  console.log(`Staking ${web3.utils.toWei('100')} for ${stakeFor}...`)

  const stakeManager = await getStakeManager()
  const rootToken = await RootToken.at(contracts.root.tokens.TestToken)
  console.log({ stakeManager: stakeManager.address, rootToken: rootToken.address })
  console.log('Sender accounts has a balanceOf', (await rootToken.balanceOf(accounts[0])).toString())
  await rootToken.approve(stakeManager.address, amount)
  console.log('approved, staking now...')
  let result = await stakeManager.stakeFor(stakeFor, web3.utils.toWei('100'), 0, stakeFor, true)
  console.log('staked; txHash is', result.tx)

  const validatorId = await stakeManager.signerToValidator(stakeFor)
  console.log(validatorId.toString())
  console.log('TopUpForFee')
  result = await stakeManager.topUpForFee(validatorId.toString(), web3.utils.toWei('10'))
  console.log('TopUpForFee: txHash is', result.tx)
  console.log(result.tx)
  console.log('ReStaking now...')
  result = await stakeManager.restake(validatorId, web3.utils.toWei('100'), false)
  console.log('ReStaked: txHash is', result.tx)
  console.log('Delegation test ...')
  const _validator = await stakeManager.validators(validatorId)
  const validator = await ValidatorShare.at(_validator.contractAddress)
  console.log('approved, delegating now...')
  result = await validator.buyVoucher(web3.utils.toWei('100'), 0)
  console.log(`Bond ${web3.utils.toWei('100')} tokens to ${validatorId}: txHash ${result.tx}`)
  result = await validator.sellVoucher(web3.utils.toWei('100'))
  console.log(`UnBond from ${validatorId}: txHash ${result.tx}`)
  console.log('UnStaking now...')
  result = await stakeManager.unstake(validatorId)
  console.log(`UnStaked ${validatorId} : txHash is`, result.tx)
}

async function delegate(validatorId) {
  const accounts = await web3.eth.getAccounts()
  const amount = web3.utils.toWei('1000')
  console.log(`Delegating ${amount} for ${validatorId}...`)

  const stakeManager = await getStakeManager()
  const rootToken = await RootToken.at(contracts.root.tokens.TestToken)
  console.log({ stakeManager: stakeManager.address, rootToken: rootToken.address })
  console.log('Sender accounts has a balanceOf', (await rootToken.balanceOf(accounts[0])).toString())
  await rootToken.approve(stakeManager.address, amount)
  const _validator = await stakeManager.validators(validatorId)
  const validator = await ValidatorShare.at(_validator.contractAddress)
  console.log('approved, delegating now...')
  let result = await validator.buyVoucher(web3.utils.toWei('100'), 0)
  console.log(`Bond ${web3.utils.toWei('100')} to ${validatorId}: txHash ${result.tx}`)
  result = await validator.sellVoucher(web3.utils.toWei('100'))
  console.log(`UnBond from ${validatorId}: txHash ${result.tx}`)
}

module.exports = async function(callback) {
  try {
    await stake()
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}
// How to run
// npm run truffle exec scripts/stakeManagerTest.js --network development
