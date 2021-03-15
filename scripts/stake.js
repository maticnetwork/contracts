const contracts = require('../contractAddresses.json')

const RootToken = artifacts.require('TestToken')
const Registry = artifacts.require('Registry')
const StakeManager = artifacts.require('StakeManager')
const StakingInfo = artifacts.require('StakingInfo')
const DrainStakeManager = artifacts.require('DrainStakeManager')
const StakeManagerProxy = artifacts.require('StakeManagerProxy')
const TestToken = artifacts.require('TestToken')
const DepositManager = artifacts.require('DepositManager')
const Governance = artifacts.require('Governance')
const WithdrawManager = artifacts.require('WithdrawManager')
const MRC20 = artifacts.require('MRC20')

const toBN = web3.utils.toBN

async function getStakeManager() {
  return StakeManager.at(contracts.root.StakeManagerProxy)
}

async function stake() {
  console.log(process.argv)
  const validatorAccount = process.argv[6]
  // pubkey should not have the leading 04 prefix
  const pubkey = process.argv[7]
  const stakeAmount = web3.utils.toWei(process.argv[8] || '10000')
  const heimdallFee = web3.utils.toWei(process.argv[9] || '1')
  console.log(`Staking ${stakeAmount} for ${validatorAccount}...`)

  const accounts = await web3.eth.getAccounts()
  const stakeManager = await getStakeManager()
  const maticToken = await RootToken.at(contracts.root.tokens.MaticToken)
  console.log({ stakeManager: stakeManager.address, maticToken: maticToken.address, stakeToken: await stakeManager.token() })
  console.log('Sender accounts has a balanceOf', (await maticToken.balanceOf(accounts[0])).toString())
  await maticToken.approve(stakeManager.address, web3.utils.toWei('1000000'))
  console.log('sent approve tx, staking now...')
  // Remember to change the 4th parameter to false if delegation is not required
  await stakeManager.stakeFor(validatorAccount, stakeAmount, heimdallFee, true, pubkey)
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

async function mapToken(root, child, isErc721) {
  const registry = await Registry.at(contracts.root.Registry)
  console.log(await registry.rootToChildToken(root))
  const governance = await Governance.at(contracts.root.GovernanceProxy)
  await governance.update(
    contracts.root.Registry,
    registry.contract.methods.mapToken(root, child, isErc721).encodeABI()
  )
  console.log(await registry.rootToChildToken(root))
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

async function updateDynasty() {
  const stakeManager = await getStakeManager()
  let auctionPeriod = await stakeManager.auctionPeriod()
  let dynasty = await stakeManager.dynasty()
  console.log({ dynasty: dynasty.toString(), auctionPeriod: auctionPeriod.toString(), signerUpdateLimit: (await stakeManager.signerUpdateLimit()).toString() })

  await stakeManager.updateSignerUpdateLimit(10)

  await stakeManager.updateDynastyValue(888)
  dynasty = await stakeManager.dynasty()
  auctionPeriod = await stakeManager.auctionPeriod()
  console.log({ dynasty: dynasty.toString(), auctionPeriod: auctionPeriod.toString() })

  await stakeManager.stopAuctions('10000')
}

async function updateExitPeriod() {
  const wm = await WithdrawManager.at(contracts.root.WithdrawManagerProxy)
  let period = await wm.HALF_EXIT_PERIOD()
  console.log({ period: period.toString()})

  await wm.updateExitPeriod('5')

  period = await wm.HALF_EXIT_PERIOD()
  console.log({ period: period.toString()})
}

async function child() {
  const mrc20 = await MRC20.at('0x0000000000000000000000000000000000001010')
  console.log(await mrc20.owner())
}

async function updateImplementation() {
  let stakeManager = await StakeManagerProxy.at(contracts.root.StakeManagerProxy)
  // const drainContract = '0xF6Fc3a5f0D6389cD96727955c813069B1d47F358' // on goerli for Mumbai
  const drainContract = '0x3025349b8BbBd3324aFe90c89157dBC567A7E5Ff' // on mainnet
  stakeManager.updateImplementation(drainContract)
  await delay(5)
  stakeManager = await DrainStakeManager.at(contracts.root.StakeManagerProxy)
  const governance = await Governance.at(contracts.root.GovernanceProxy)
  await governance.update(
    contracts.root.StakeManagerProxy,
    stakeManager.contract.methods.drain(process.env.FROM, web3.utils.toWei('70277')).encodeABI()
  )
}

async function setEpoch() {
  let stakeManager = await StakeManager.at(contracts.root.StakeManagerProxy)
  console.log((await stakeManager.currentEpoch()).toString())
  await stakeManager.setCurrentEpoch('1507')
  console.log((await stakeManager.currentEpoch()).toString())
}

async function stopAuctions() {
  let stakeManager = await StakeManager.at(contracts.root.StakeManagerProxy)
  await stakeManager.stopAuctions('10000')
}

async function updateNonce() {
  let stakeInfo = await StakingInfo.at(contracts.root.StakingInfo)
  await stakeInfo.updateNonce([1], [2])
}

module.exports = async function (callback) {
  try {
    await stake()
  } catch (e) {
    // truffle exec <script> doesn't throw errors, so handling it in a verbose manner here
    console.log(e)
  }
  callback()
}

function delay(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}
